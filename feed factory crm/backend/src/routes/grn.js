const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate: auth, authorize } = require('../middleware/auth');
const { journalPayableCreated } = require('../utils/journal');
const { logActivity } = require('../utils/activity');
const { checkAndCreateRequisition } = require('../services/autoReorderCheck');

// Ensure required columns exist (runtime schema safety for older DBs)
(async () => {
  try {
    await query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(12,3) DEFAULT 0`);
    await query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'kg'`);
    await query(`ALTER TABLE goods_receipt_notes ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0`);
    await query(`ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS quantity_accepted NUMERIC(12,3) DEFAULT 0`);
    await query(`ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS quantity_rejected NUMERIC(12,3) DEFAULT 0`);
    await query(`ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await query(`ALTER TABLE grn_items ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'kg'`);
    await query(`ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id)`);
  } catch (e) {
    console.log('[GRN] Schema migration check:', e.message);
  }
})();

const generateCode = async (prefix, tableName, codeColumn) => {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE ${codeColumn} LIKE $1`,
    [`${prefix}-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
};

// GET /api/grn/eligible-pos - Get POs that are approved/completed and have unreceived items
router.get('/eligible-pos', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        po.id,
        po.po_number,
        po.supplier_id,
        po.status,
        po.total_amount,
        COALESCE(po.vat_amount, 0) as vat_amount,
        po.expected_date,
        po.notes,
        s.name as supplier_name,
        s.code as supplier_code,
        json_agg(
          json_build_object(
            'id', poi.id,
            'raw_material_id', poi.raw_material_id,
            'name', rm.name_arabic,
            'raw_material_name', rm.name_arabic,
            'raw_material_code', rm.code,
            'quantity', poi.quantity,
            'unit', COALESCE(poi.unit, rm.unit, 'kg'),
            'unit_cost', poi.unit_cost,
            'total_cost', poi.total_cost,
            'received_quantity', COALESCE(poi.received_quantity, 0),
            'pending_quantity', GREATEST(poi.quantity - COALESCE(poi.received_quantity, 0), 0)
          ) ORDER BY poi.id
        ) FILTER (WHERE poi.quantity > COALESCE(poi.received_quantity, 0)) as items
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      LEFT JOIN raw_materials rm ON poi.raw_material_id = rm.id
      WHERE po.status IN ('approved', 'completed')
        AND poi.quantity > COALESCE(poi.received_quantity, 0)
        AND NOT EXISTS (
          SELECT 1 FROM goods_receipt_notes g2
          WHERE g2.purchase_order_id = po.id
          AND g2.status NOT IN ('rejected')
        )
      GROUP BY po.id, s.name, s.code
      ORDER BY po.expected_date ASC
    `);

    // Filter out POs with no pending items (json_agg returns [null] when filter removes all)
    const eligiblePOs = result.rows.filter(po => {
      return po.items && po.items.length > 0 && po.items[0] !== null;
    });

    res.json({ purchaseOrders: eligiblePOs, total: eligiblePOs.length });
  } catch (error) {
    console.error('Error fetching eligible POs:', error);
    res.status(500).json({ error: 'Failed to fetch eligible purchase orders' });
  }
});

// GET /api/grn - List all GRNs
router.get('/', auth, async (req, res) => {
  try {
    const { status, supplier, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        g.*,
        s.name as supplier_name,
        p.po_number,
        COUNT(gi.id) as item_count,
        COALESCE(SUM(gi.quantity_accepted), 0) as total_accepted,
        COALESCE(SUM(gi.quantity_rejected), 0) as total_rejected
      FROM goods_receipt_notes g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      LEFT JOIN purchase_orders p ON g.purchase_order_id = p.id
      LEFT JOIN grn_items gi ON g.id = gi.grn_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND g.status = $${idx}`;
      params.push(status);
    }

    if (supplier) {
      idx++;
      sql += ` AND g.supplier_id = $${idx}`;
      params.push(supplier);
    }

    sql += ` GROUP BY g.id, s.name, p.po_number ORDER BY g.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM goods_receipt_notes g WHERE 1=1`;
    const countParams = [];
    let cidx = 0;
    if (status) {
      cidx++;
      countSql += ` AND g.status = $${cidx}`;
      countParams.push(status);
    }
    if (supplier) {
      cidx++;
      countSql += ` AND g.supplier_id = $${cidx}`;
      countParams.push(supplier);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      grns: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching GRNs:', error);
    res.status(500).json({ error: 'Failed to fetch GRNs' });
  }
});

// GET /api/grn/:id - Get single GRN with items
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const grnResult = await query(`
      SELECT g.*, s.name as supplier_name, p.po_number
      FROM goods_receipt_notes g
      LEFT JOIN suppliers s ON g.supplier_id = s.id
      LEFT JOIN purchase_orders p ON g.purchase_order_id = p.id
      WHERE g.id = $1
    `, [id]);

    if (grnResult.rows.length === 0) {
      return res.status(404).json({ error: 'GRN not found' });
    }

    const itemsResult = await query(`
      SELECT gi.*,
             r.name_arabic as raw_material_name,
             r.code as raw_material_code,
             COALESCE(gi.unit, poi.unit, r.unit, 'kg') as unit
      FROM grn_items gi
      LEFT JOIN raw_materials r ON gi.raw_material_id = r.id
      LEFT JOIN goods_receipt_notes g ON gi.grn_id = g.id
      LEFT JOIN purchase_order_items poi
        ON poi.purchase_order_id = g.purchase_order_id
        AND poi.raw_material_id = gi.raw_material_id
      WHERE gi.grn_id = $1
    `, [id]);

    res.json({
      ...grnResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching GRN:', error);
    res.status(500).json({ error: 'Failed to fetch GRN' });
  }
});

// POST /api/grn - Create GRN from PO
router.post('/', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { grn_number: req_grn, purchase_order_id: po_id, supplier_id, receipt_date, notes, items } = req.body;
    const grn_number = req_grn || await generateCode('GRN', 'goods_receipt_notes', 'grn_number');
    const createdBy = req.user.id;

    if (!po_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Purchase order ID and items are required' });
    }

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.total_cost) || 0), 0);

    const result = await transaction(async (client) => {
      // Create GRN
      const grnResult = await client.query(`
        INSERT INTO goods_receipt_notes (grn_number, purchase_order_id, supplier_id, received_date, status, total_amount, notes, created_by)
        VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7) RETURNING *
      `, [grn_number, po_id, supplier_id, receipt_date || new Date(), totalAmount, notes || null, createdBy]);

      const grn = grnResult.rows[0];

      // Insert GRN items
      for (const item of items) {
        await client.query(`
          INSERT INTO grn_items (grn_id, raw_material_id, quantity_ordered, quantity_received, quantity_accepted, quantity_rejected, rejection_reason, unit_cost, total_cost, unit)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          grn.id,
          item.raw_material_id,
          item.ordered_quantity || item.quantity_ordered || 0,
          item.received_quantity || item.quantity_received || 0,
          item.accepted_quantity || item.quantity_accepted || 0,
          item.rejected_quantity || item.quantity_rejected || 0,
          item.rejection_reason || null,
          item.unit_price || item.unit_cost || 0,
          item.total_price || item.total_cost || 0,
          item.unit || 'kg'
        ]);
      }

      return grn;
    });

    // GRN goes direct to owner_review (no manager stage — same as POs)
    try {
      const { query: dbQuery } = require('../config/database');
      await dbQuery(
        `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status)
         VALUES ($1, $2, $3, $4, $5, 'owner_review', 'pending') ON CONFLICT DO NOTHING`,
        ['grn', 'grn', result.id, req.user.id,
         `GRN: ${result.grn_number} - Total: ${result.total_amount} EGP`]
      );
    } catch (e) { console.error('Error creating GRN approval request:', e.message); }

    res.status(201).json({ success: true, grn: result });
  } catch (error) {
    console.error('Error creating GRN:', error);
    res.status(500).json({ error: 'Failed to create GRN', message: error.message });
  }
});

// PUT /api/grn/:id/inspect - Inspect GRN (record received quantities)
router.put('/:id/inspect', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { items, notes } = req.body;

    const result = await transaction(async (client) => {
      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(`
            UPDATE grn_items
            SET received_quantity = $1,
                quantity_accepted = $2,
                rejected_quantity = $3,
                rejection_reason = $4,
                total_cost = $5
            WHERE id = $6
          `, [
            item.received_quantity || item.quantity_received || 0,
            item.accepted_quantity || item.quantity_accepted || 0,
            item.rejected_quantity || 0,
            item.rejection_reason || null,
            item.total_cost || 0,
            item.id
          ]);
        }
      }

      // Determine status: rejected if all items have zero accepted quantity
      const itemsResult = await client.query(`
        SELECT quantity_accepted FROM grn_items WHERE grn_id = $1
      `, [id]);
      const allRejected = itemsResult.rows.length > 0 && itemsResult.rows.every(i => Number(i.quantity_accepted || 0) === 0);
      const newStatus = allRejected ? 'rejected' : 'inspected';

      const grnResult = await client.query(`
        UPDATE goods_receipt_notes SET status = $1, notes = COALESCE($2, notes), updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 RETURNING *
      `, [newStatus, notes || null, id]);

      if (grnResult.rows.length === 0) {
        throw new Error('GRN not found');
      }

      return grnResult.rows[0];
    });

    res.json({ success: true, grn: result });
  } catch (error) {
    console.error('Error inspecting GRN:', error);
    res.status(500).json({ error: 'Failed to inspect GRN', message: error.message });
  }
});

// PUT /api/grn/:id/approve - Approve GRN (update inventory)
// Per access doc: GRN approval (which triggers stock auto-update) is
// admin/owner only — purchasing_mgr and inventory staff explicitly have
// "No approval rights" here, by design (segregation of duties).
router.put('/:id/approve', auth, authorize('admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await transaction(async (client) => {
      // Get GRN with items
      const grnResult = await client.query(`
        SELECT g.*, po.id as po_id FROM goods_receipt_notes g
        LEFT JOIN purchase_orders po ON g.purchase_order_id = po.id
        WHERE g.id = $1
      `, [id]);

      if (grnResult.rows.length === 0) {
        throw new Error('GRN not found');
      }

      const grn = grnResult.rows[0];

      // Prevent re-approving already approved GRNs (idempotency check)
      if (grn.status === 'approved') {
        throw new Error('GRN is already approved. Cannot approve again.');
      }

      // Prevent approving GRNs that have been fully inspected and rejected
      if (grn.status === 'rejected') {
        throw new Error('Cannot approve a rejected GRN.');
      }

      // Get all GRN items
      const itemsResult = await client.query(`
        SELECT gi.*, poi.id as po_item_id
        FROM grn_items gi
        LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = $1 AND poi.raw_material_id = gi.raw_material_id
        WHERE gi.grn_id = $2
      `, [grn.po_id, id]);

      const items = itemsResult.rows;

      // Update raw_materials stock, purchase_order_items received_quantity, and create inventory_transactions
      for (const item of items) {
        const acceptedQty = parseFloat(item.quantity_accepted) || 0;
        if (acceptedQty <= 0) continue;

        // Determine unit from grn_items → join back to purchase_order_items unit
        const poUnitRes = await client.query(
          `SELECT COALESCE(poi.unit, 'kg') as unit
           FROM grn_items gi
           LEFT JOIN purchase_order_items poi
             ON poi.purchase_order_id = $1 AND poi.raw_material_id = gi.raw_material_id
           WHERE gi.id = $2
           LIMIT 1`,
          [grn.po_id, item.id]
        );
        const poUnit = poUnitRes.rows[0]?.unit || 'kg';

        // Convert to kg for stock storage — raw_materials.current_stock is always in kg
        const qtyInKg = poUnit === 'ton' ? acceptedQty * 1000 : acceptedQty;

        // 1. Update raw_materials current_stock (always in kg)
        await client.query(`
          UPDATE raw_materials
          SET current_stock = current_stock + $1,
              updated_at = NOW()
          WHERE id = $2
        `, [qtyInKg, item.raw_material_id]);

        // 2. Update purchase_order_items received_quantity (in original PO unit)
        if (item.po_item_id) {
          await client.query(`
            UPDATE purchase_order_items
            SET received_quantity = COALESCE(received_quantity, 0) + $1
            WHERE id = $2
          `, [acceptedQty, item.po_item_id]);
        }

        // 3. Create inventory transaction — store qty in kg, preserve display unit
        await client.query(`
          INSERT INTO inventory_transactions
          (raw_material_id, transaction_type, quantity, unit_price, total_cost, reference_id, reference_type, notes, created_by, supplier_id, created_at)
          VALUES ($1, 'purchase', $2, $3, $4, $5, 'grn', $6, $7, $8, NOW())
          ON CONFLICT DO NOTHING
        `, [
          item.raw_material_id,
          qtyInKg,
          item.unit_cost || 0,
          qtyInKg * (item.unit_cost || 0),
          id,
          `GRN ${grn.grn_number} — ${acceptedQty} ${poUnit}`,
          userId,
          grn.supplier_id || null
        ]);
      }

      // Update PO status to completed if all items received
      if (grn.po_id) {
        const pendingItems = await client.query(`
          SELECT COUNT(*) as count
          FROM purchase_order_items
          WHERE purchase_order_id = $1 AND quantity > COALESCE(received_quantity, 0)
        `, [grn.po_id]);

        if (parseInt(pendingItems.rows[0].count) === 0) {
          await client.query(`
            UPDATE purchase_orders SET status = 'received', updated_at = NOW() WHERE id = $1
          `, [grn.po_id]);
        }
      }

      // Update GRN status
      const updateResult = await client.query(`
        UPDATE goods_receipt_notes SET status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 RETURNING *
      `, [id]);

      const updatedGrn = updateResult.rows[0];

      // Calculate actual total from accepted items
      let grnTotal = 0;
      for (const item of items) {
        const acceptedQty = parseFloat(item.quantity_accepted) || 0;
        if (acceptedQty > 0) {
          grnTotal += acceptedQty * (parseFloat(item.unit_cost) || 0);
        }
      }

      // Update GRN total_amount
      await client.query(
        `UPDATE goods_receipt_notes SET total_amount = $1 WHERE id = $2`,
        [grnTotal, id]
      );

      // Sync approval_requests status
      await client.query(
        `UPDATE approval_requests SET status = 'approved', approver_id = $1, updated_at = NOW()
         WHERE module_name = 'grn' AND request_id = $2 AND status = 'pending'`,
        [userId, id]
      );

      // Create supplier payable from PO
      let payable = null;
      if (grn.po_id && grn.supplier_id && grnTotal > 0) {
        // Get supplier credit terms
        const supRes = await client.query('SELECT credit_days, name FROM suppliers WHERE id = $1', [grn.supplier_id]);
        const creditDays = supRes.rows[0]?.credit_days || 30;
        const poRes = await client.query('SELECT order_date, po_number FROM purchase_orders WHERE id = $1', [grn.po_id]);
        const orderDate = poRes.rows[0]?.order_date ? new Date(poRes.rows[0].order_date) : new Date();
        const dueDate = new Date(orderDate);
        dueDate.setDate(dueDate.getDate() + parseInt(creditDays));

        // Check if payable already exists for this PO
        const existingPayable = await client.query(
          'SELECT id FROM supplier_payables WHERE po_id = $1',
          [grn.po_id]
        );

        if (existingPayable.rows.length === 0) {
          const payableResult = await client.query(
            `INSERT INTO supplier_payables (supplier_id, po_id, amount, paid_amount, balance, due_date, status, notes, created_at)
             VALUES ($1, $2, $3, 0, $3, $4, 'pending', $5, CURRENT_DATE) RETURNING *`,
            [grn.supplier_id, grn.po_id, grnTotal, dueDate.toISOString().split('T')[0], `Auto from GRN ${grn.grn_number}`]
          );
          payable = payableResult.rows[0];
        }
      }

      return { grn: updatedGrn, payable, totalAmount: grnTotal };
    });

    res.json({ success: true, grn: result.grn, payable: result.payable, totalAmount: result.totalAmount });

    // Create journal entry for payable (non-critical)
    if (result.payable) {
      try {
        const supRes = await query('SELECT name FROM suppliers WHERE id = $1', [result.grn.supplier_id]);
        await journalPayableCreated(result.payable, supRes.rows[0]?.name || '');
      } catch (e) { console.error('[JOURNAL] Failed to create entry for payable:', e.message); }

      logActivity({
        userId, action: 'create', module: 'purchase',
        description: `Created payable from GRN ${result.grn.grn_number} for ${result.totalAmount}`,
        entityId: result.payable.id, entityType: 'supplier_payable',
        amount: result.totalAmount
      });
    }

    logActivity({
      userId, action: 'approve', module: 'inventory',
      description: `Approved GRN ${result.grn.grn_number} - stock updated`,
      entityId: result.grn.id, entityType: 'grn',
      amount: result.totalAmount
    });

    // Auto-reorder check — fire-and-forget, never blocks GRN approval
    try {
      const result = await checkAndCreateRequisition(
        null,
        userId,
        'تم الإنشاء تلقائياً بسبب انخفاض المخزون بعد اعتماد GRN'
      );
      if (result.created) {
        // Auto-reorder requisition created successfully
      }
    } catch (reorderErr) {
      console.error('[AUTO-REORDER] Check failed (GRN approval not affected):', reorderErr.message);
    }
  } catch (error) {
    console.error('Error approving GRN:', error);
    res.status(500).json({ error: 'Failed to approve GRN', message: error.message });
  }
});

// GET /api/grn/stats/overview - GRN stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'inspected') as inspected,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM goods_receipt_notes
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching GRN stats:', error);
    res.status(500).json({ error: 'Failed to fetch GRN stats' });
  }
});

module.exports = router;