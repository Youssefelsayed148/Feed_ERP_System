const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate: auth, authorize } = require('../middleware/auth');
const { notifyRole, notifyUser } = require('../utils/notify');
const { logActivity } = require('../utils/activity');

const generateCode = async (prefix, tableName, codeColumn) => {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE ${codeColumn} LIKE $1`,
    [`${prefix}-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
};

// GET /api/purchase-orders - List all purchase orders
router.get('/', auth, async (req, res) => {
  try {
    const { status, supplier, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        po.*,
        s.name as supplier_name,
        s.credit_days,
        COUNT(poi.id) as item_count,
        (SELECT grn.grn_number FROM goods_receipt_notes grn WHERE grn.purchase_order_id = po.id ORDER BY grn.created_at DESC LIMIT 1) as grn_number,
        (SELECT grn.status FROM goods_receipt_notes grn WHERE grn.purchase_order_id = po.id ORDER BY grn.created_at DESC LIMIT 1) as grn_status,
        (SELECT grn.received_date FROM goods_receipt_notes grn WHERE grn.purchase_order_id = po.id ORDER BY grn.created_at DESC LIMIT 1) as grn_receipt_date
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND po.status = $${idx}`;
      params.push(status);
    }

    if (supplier) {
      idx++;
      sql += ` AND po.supplier_id = $${idx}`;
      params.push(supplier);
    }

    sql += ` GROUP BY po.id, s.name, s.credit_days ORDER BY po.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM purchase_orders po WHERE 1=1`;
    const countParams = [];
    let cidx = 0;
    if (status) {
      cidx++;
      countSql += ` AND po.status = $${cidx}`;
      countParams.push(status);
    }
    if (supplier) {
      cidx++;
      countSql += ` AND po.supplier_id = $${cidx}`;
      countParams.push(supplier);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      purchaseOrders: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

// GET /api/purchase-orders/:id - Get single PO with items
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const poResult = await query(`
      SELECT po.*, s.name as supplier_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `, [id]);

    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const itemsResult = await query(`
      SELECT poi.*, r.name_arabic as raw_material_name, r.code as raw_material_code,
             COALESCE(poi.unit, r.unit, 'kg') as unit
      FROM purchase_order_items poi
      LEFT JOIN raw_materials r ON poi.raw_material_id = r.id
      WHERE poi.purchase_order_id = $1
    `, [id]);

    res.json({
      ...poResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// POST /api/purchase-orders - Create PO
router.post('/', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    // Ensure unit column exists on purchase_order_items
    await query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit VARCHAR(10) DEFAULT 'kg'`);
    await query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) DEFAULT 0`);

    const { supplierId, supplier_id, deliveryDate, delivery_date, subtotal, vatAmount, vat_amount, total, notes, status, items } = req.body;
    const createdBy = req.user.id;
    const supId = supplierId || supplier_id;
    const delDate = deliveryDate || delivery_date;

    // Generate PO number
    const poNumber = await generateCode('PO', 'purchase_orders', 'po_number');

    // Calculate totals from items if not provided
    const itemList = items || [];
    const calculatedSubtotal = itemList.reduce((sum, item) => sum + (item.total || item.total_cost || 0), 0);
    const finalSubtotal = subtotal || calculatedSubtotal;
    const finalVat = parseFloat(vatAmount || vat_amount || Math.round(finalSubtotal * 0.14));
    const finalTotal = parseFloat(total || (finalSubtotal + finalVat));

    const result = await transaction(async (client) => {
      const poResult = await client.query(`
        INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, vat_amount, expected_date, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
      `, [poNumber, supId || null, status || 'draft', finalSubtotal, finalVat, delDate || null, notes || null, createdBy]);

      const po = poResult.rows[0];

      if (itemList.length > 0) {
        for (const item of itemList) {
          await client.query(`
            INSERT INTO purchase_order_items (purchase_order_id, raw_material_id, quantity, unit, unit_price, total_price, unit_cost, total_cost)
            VALUES ($1, $2, $3, $4, $5, $6, $5, $6)
          `, [
            po.id,
            item.material || item.raw_material_id,
            item.quantity || 0,
            item.unit || 'kg',
            item.unitPrice || item.unit_cost || 0,
            item.total || item.total_cost || 0
          ]);
        }
      }

      return po;
    });

    res.status(201).json({ success: true, data: result });

    // If created directly as pending_approval, insert approval request immediately
    if ((status || 'draft') === 'pending_approval') {
      try {
        await query(
          `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status) VALUES ($1, $2, $3, $4, $5, 'owner_review', 'pending') ON CONFLICT DO NOTHING`,
          ['purchase_orders', 'purchase_order', result.id, createdBy, `PO ${poNumber} - Total: ${finalSubtotal} EGP`]
        );
      } catch (e) {
        console.error('Error creating approval request for new PO:', e.message);
      }
    }

    logActivity({
      userId: createdBy, userName: req.user.name, userRole: req.user.role,
      action: 'create', module: 'purchase',
      description: `تم إنشاء أمر شراء ${poNumber}`,
      entityId: result.id, entityType: 'purchase_order',
      amount: finalTotal
    });

    notifyRole('purchasing_mgr', {
      module: 'procurement', type: 'po_created',
      title: `أمر شراء جديد ${poNumber}`,
      message: `تم إنشاء أمر الشراء ${poNumber} بقيمة ${finalTotal} ج.م`,
      referenceId: result.id, referenceType: 'purchase_order'
    });
    if (status === 'draft' || status === 'pending_approval') {
      notifyRole('owner', {
        module: 'procurement', type: 'po_pending_approval',
        title: `أمر الشراء ${poNumber} بانتظار الاعتماد`,
        message: `أمر الشراء ${poNumber} بقيمة ${finalTotal} ج.م بحاجة للاعتماد`,
        referenceId: result.id, referenceType: 'purchase_order'
      });
      notifyRole('admin', {
        module: 'procurement', type: 'po_pending_approval',
        title: `أمر الشراء ${poNumber} بانتظار الاعتماد`,
        message: `أمر الشراء ${poNumber} بقيمة ${finalTotal} ج.م بحاجة للاعتماد`,
        referenceId: result.id, referenceType: 'purchase_order'
      });
    }
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// PUT /api/purchase-orders/:id - Update PO
router.put('/:id', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_id, supplierId, deliveryDate, delivery_date, notes, items } = req.body;
    const supId = supplierId || supplier_id;
    const delDate = deliveryDate || delivery_date;

    const result = await transaction(async (client) => {
      const poResult = await client.query(`
        UPDATE purchase_orders 
        SET supplier_id = COALESCE($1, supplier_id), 
            expected_date = COALESCE($2, expected_date), 
            notes = COALESCE($3, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 RETURNING *
      `, [supId || null, delDate || null, notes || null, id]);

      if (poResult.rows.length === 0) {
        throw new Error('Purchase order not found');
      }

      if (items && items.length > 0) {
        // Simple approach: delete existing items and re-insert
        await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [id]);
        let newTotal = 0;
        for (const item of items) {
          const itemTotal = parseFloat(item.total_cost || item.total || 0);
          newTotal += itemTotal;
          await client.query(`
            INSERT INTO purchase_order_items (purchase_order_id, raw_material_id, quantity, unit, unit_price, total_price, unit_cost, total_cost)
            VALUES ($1, $2, $3, $4, $5, $6, $5, $6)
          `, [
            id,
            item.raw_material_id,
            item.quantity || 0,
            item.unit || 'kg',
            item.unit_cost || 0,
            itemTotal
          ]);
        }
        const newVat = Math.round(newTotal * 0.14 * 100) / 100;
        // Recalculate PO total and vat
        await client.query(`
          UPDATE purchase_orders SET total_amount = $1, vat_amount = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
        `, [newTotal, newVat, id]);
      }

      return poResult.rows[0];
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// PUT /api/purchase-orders/:id/approve - Approve PO
// Per access doc: purchasing_mgr explicitly has "No approval rights" on POs —
// approval goes to Admin/IT or Owner only (segregation of duties: the person
// who creates/submits a PO is not the one who approves it).
router.put('/:id/approve', auth, authorize('admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE purchase_orders SET status = 'approved', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(result.rows[0]);

    const po = result.rows[0];
    
    // Update approval request
    try {
      const { query: dbQuery } = require('../config/database');
      await dbQuery(
        `UPDATE approval_requests SET status = 'approved', approver_id = $1, updated_at = NOW()
         WHERE module_name = 'purchase_orders' AND request_id = $2 AND status = 'pending'`,
        [req.user.id, id]
      );
    } catch (e) {}

    notifyRole('purchasing_mgr', {
      module: 'procurement', type: 'po_approved',
      title: `تم اعتماد أمر الشراء ${po.po_number}`,
      message: `تم اعتماد أمر الشراء ${po.po_number} — بانتظار استلام المخزون`,
      referenceId: po.id, referenceType: 'purchase_order'
    });
    notifyRole('production_mgr', {
      module: 'production', type: 'po_approved',
      title: `أمر الشراء ${po.po_number} معتمد — مخزون قادم`,
      message: `تم اعتماد أمر الشراء ${po.po_number}، المواد في الطريق`,
      referenceId: po.id, referenceType: 'purchase_order'
    });
  } catch (error) {
    console.error('Error approving purchase order:', error);
    res.status(500).json({ error: 'Failed to approve purchase order' });
  }
});

// PUT /api/purchase-orders/:id/reject - Reject PO (inventory team)
router.put('/:id/reject', auth, authorize('admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE purchase_orders SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('draft', 'pending_approval') RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found or cannot be rejected' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error rejecting purchase order:', error);
    res.status(500).json({ error: 'Failed to reject purchase order' });
  }
});

// PUT /api/purchase-orders/:id/cancel - Cancel PO
router.put('/:id/cancel', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE purchase_orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({ error: 'Failed to cancel purchase order' });
  }
});

// PUT /api/purchase-orders/:id/submit - Submit for approval
router.put('/:id/submit', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE purchase_orders SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'draft' RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found or already submitted' });
    }

    res.json(result.rows[0]);

    const po = result.rows[0];
    
    // Create approval request
    try {
      const { query: dbQuery } = require('../config/database');
      await dbQuery(
        `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status)
         VALUES ($1, $2, $3, $4, $5, 'owner_review', 'pending')`,
        ['purchase_orders', 'purchase_order', po.id, req.user.id, `PO ${po.po_number} - Total: ${po.total_amount}`]
      );
    } catch (e) {
      console.error('Error creating approval request:', e.message);
    }

    notifyRole('owner', {
      module: 'procurement', type: 'po_pending_approval',
      title: `أمر الشراء ${po.po_number} بانتظار الاعتماد`,
        message: `أمر الشراء ${po.po_number} بقيمة ${parseFloat(po.total_amount).toFixed(2)} ج.م بحاجة للاعتماد`,
        referenceId: po.id, referenceType: 'purchase_order'
      });
      notifyRole('admin', {
        module: 'procurement', type: 'po_pending_approval',
        title: `أمر الشراء ${po.po_number} بانتظار الاعتماد`,
        message: `أمر الشراء ${po.po_number} بقيمة ${parseFloat(po.total_amount).toFixed(2)} ج.م بحاجة للاعتماد`,
      referenceId: po.id, referenceType: 'purchase_order'
    });
  } catch (error) {
    console.error('Error submitting purchase order:', error);
    res.status(500).json({ error: 'Failed to submit purchase order' });
  }
});

// POST /api/purchase-orders/:id/send-whatsapp - Send PO via WhatsApp
router.post('/:id/send-whatsapp', auth, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const poResult = await query(`
      SELECT po.*, s.name as supplier_name, s.phone as supplier_phone
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.id = $1
    `, [id]);

    if (poResult.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    // Placeholder: actual WhatsApp integration would go here
    res.json({
      success: true,
      message: 'WhatsApp send request logged',
      po: poResult.rows[0]
    });
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp' });
  }
});

// GET /api/purchase-orders/stats/overview - PO stats
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM purchase_orders
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching PO stats:', error);
    res.status(500).json({ error: 'Failed to fetch PO stats' });
  }
});

module.exports = router;