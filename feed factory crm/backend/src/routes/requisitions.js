const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { getLowStockMaterialsWithSuggestions } = require('../services/autoReorderCheck');

// ============================================
// LOW STOCK REQUISITION GENERATION
// ============================================

// Get all requisitions
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, u.name as created_by_name,
             (SELECT COUNT(*) FROM requisition_items WHERE requisition_id = r.id) as item_count
      FROM requisitions r
      LEFT JOIN users u ON r.created_by = u.id
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, requisitions: result.rows });
  } catch (error) {
    console.error('Error fetching requisitions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Preview low stock items (without creating requisition)
router.get('/preview', authenticate, async (req, res) => {
  try {
    const items = await getLowStockMaterialsWithSuggestions();

    if (items.length === 0) {
      return res.json({ success: true, items: [], message: 'No materials below reorder level' });
    }

    // Group by supplier
    const bySupplier = {};
    for (const item of items) {
      const supplierId = item.supplier_id || 'unassigned';
      const supplierName = item.supplier_name || 'No preferred supplier';
      if (!bySupplier[supplierId]) {
        bySupplier[supplierId] = { supplier_id: item.supplier_id, supplier_name: supplierName, items: [] };
      }
      bySupplier[supplierId].items.push(item);
    }

    const totalCost = items.reduce((sum, item) => sum + item.total_cost, 0);

    res.json({
      success: true,
      items,
      bySupplier: Object.values(bySupplier),
      totalItems: items.length,
      totalCost
    });
  } catch (error) {
    console.error('Error previewing low stock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate requisition from low stock materials
router.post('/generate', authenticate, async (req, res) => {
  const createdBy = req.user.id;

  try {
    const items = await getLowStockMaterialsWithSuggestions();

    if (items.length === 0) {
      throw new Error('No materials below reorder level');
    }

    const requisition = await transaction(async (client) => {
      // Generate requisition number
      const reqNumberResult = await client.query(
        "SELECT COALESCE(MAX(CAST(SUBSTRING(requisition_number FROM 5) AS INTEGER)), 0) + 1 as next_num FROM requisitions WHERE requisition_number LIKE 'REQ-%'"
      );
      const reqNumber = `REQ-${String(reqNumberResult.rows[0].next_num).padStart(5, '0')}`;

      let totalCost = 0;

      // Create requisition
      const reqResult = await client.query(
        `INSERT INTO requisitions (requisition_number, status, total_items, total_cost, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [reqNumber, 'draft', items.length, 0, 'Auto-generated from low stock levels', createdBy]
      );
      const requisition = reqResult.rows[0];

      // Create requisition items
      for (const material of items) {
        totalCost += material.total_cost;

        await client.query(
          `INSERT INTO requisition_items (requisition_id, raw_material_id, suggested_quantity, unit_price, total_cost, supplier_id, supplier_name, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            requisition.id,
            material.raw_material_id,
            material.suggested_quantity,
            material.unit_price,
            material.total_cost,
            material.supplier_id || null,
            material.supplier_name || null,
            `Current stock: ${material.current_stock} kg, Reorder level: ${material.reorder_level} kg`
          ]
        );
      }

      // Update total cost
      await client.query(
        'UPDATE requisitions SET total_cost = $1 WHERE id = $2',
        [totalCost, requisition.id]
      );
      requisition.total_cost = totalCost;

      return requisition;
    });

    res.status(201).json({ success: true, requisition, message: 'Requisition generated successfully' });
  } catch (error) {
    console.error('Error generating requisition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single requisition with items
router.get('/:id', authenticate, async (req, res) => {
  const reqId = req.params.id;

  try {
    const reqResult = await query(`
      SELECT r.*, u.name as created_by_name
      FROM requisitions r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = $1
    `, [reqId]);

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Requisition not found' });
    }

    const itemsResult = await query(`
      SELECT ri.*, COALESCE(rm.name_arabic, rm.name_english) as material_name, rm.code as material_code, rm.current_stock, rm.unit as material_unit
      FROM requisition_items ri
      JOIN raw_materials rm ON ri.raw_material_id = rm.id
      WHERE ri.requisition_id = $1
      ORDER BY ri.id
    `, [reqId]);

    res.json({
      success: true,
      requisition: reqResult.rows[0],
      items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching requisition:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send requisition to suppliers (convert items to purchase orders)
router.post('/:id/send', authenticate, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  const reqId = req.params.id;
  const createdBy = req.user.id;

  try {
    // Ensure requisition_items has a status column (safety check for older DB schemas)
    try {
      await query(`ALTER TABLE requisition_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'`);
      // Update any existing rows that have NULL status to 'pending'
      await query(`UPDATE requisition_items SET status = 'pending' WHERE status IS NULL`);
    } catch (e) {
      // schema safety check — silent
    }

    // First check requisition exists and has items
    const reqCheck = await query('SELECT id, status FROM requisitions WHERE id = $1', [reqId]);
    if (reqCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Requisition not found' });
    }
    if (reqCheck.rows[0].status === 'sent') {
      return res.status(400).json({ success: false, error: 'Requisition already sent' });
    }

    const itemCheck = await query(
      "SELECT COUNT(*) as cnt FROM requisition_items WHERE requisition_id = $1 AND status = 'pending'",
      [reqId]
    );

    const result = await transaction(async (client) => {
      // Get requisition items grouped by supplier
      const itemsResult = await client.query(`
        SELECT ri.*, COALESCE(rm.name_arabic, rm.name_english) as material_name, rm.code as material_code, rm.unit
        FROM requisition_items ri
        JOIN raw_materials rm ON ri.raw_material_id = rm.id
        WHERE ri.requisition_id = $1 AND ri.status = 'pending'
      `, [reqId]);

      if (itemsResult.rows.length === 0) {
        throw new Error('No pending items in requisition');
      }

      // Group by supplier
      const supplierGroups = {};
      for (const item of itemsResult.rows) {
        const supplierId = item.supplier_id || 'unassigned';
        if (!supplierGroups[supplierId]) {
          supplierGroups[supplierId] = {
            supplier_id: item.supplier_id,
            supplier_name: item.supplier_name,
            items: []
          };
        }
        supplierGroups[supplierId].items.push(item);
      }

      const createdPOs = [];

      // Create purchase order for each supplier group (including unassigned)
      for (const groupKey of Object.keys(supplierGroups)) {
        const group = supplierGroups[groupKey];
        const supplierId = group.supplier_id;

        // Generate PO number
        const poNumberResult = await client.query(
          "SELECT COUNT(*) as count FROM purchase_orders WHERE po_number LIKE 'PO-%'"
        );
        const poCount = parseInt(poNumberResult.rows[0].count) + 1;
        const poNumber = `PO-${String(poCount).padStart(5, '0')}`;

        let poTotal = 0;
        for (const item of group.items) {
          poTotal += parseFloat(item.total_cost);
        }

        // Create PO
        const poResult = await client.query(
          `INSERT INTO purchase_orders (po_number, supplier_id, status, total_amount, expected_date, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [poNumber, supplierId, 'draft', poTotal, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], `Generated from requisition REQ-${reqId}`, createdBy]
        );
        const po = poResult.rows[0];

          // Create PO items
          for (const item of group.items) {
            await client.query(
              `INSERT INTO purchase_order_items (purchase_order_id, raw_material_id, quantity, unit_cost, total_cost)
               VALUES ($1, $2, $3, $4, $5)`,
              [po.id, item.raw_material_id, item.suggested_quantity, item.unit_price, item.total_cost]
            );

          // Update requisition item status
          await client.query(
            'UPDATE requisition_items SET status = $1, purchase_order_id = $2 WHERE id = $3',
            ['ordered', po.id, item.id]
          );
        }

        createdPOs.push(po);
      }

      // Update requisition status
      await client.query(
        "UPDATE requisitions SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = $1",
        [reqId]
      );

      return createdPOs;
    });

    res.json({ success: true, purchaseOrders: result, message: `Requisition sent successfully. ${result.length} purchase order(s) created.` });
  } catch (error) {
    console.error('[REQ SEND] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update requisition status
router.put('/:id/status', authenticate, authorize('purchasing_mgr', 'admin', 'owner'), async (req, res) => {
  const reqId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['draft', 'sent', 'partial', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  try {
    const result = await query(
      'UPDATE requisitions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, reqId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Requisition not found' });
    }

    res.json({ success: true, requisition: result.rows[0], message: 'Status updated' });
  } catch (error) {
    console.error('Error updating requisition status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INVENTORY TRANSFER
// ============================================

// Transfer finished goods between locations or deduct for internal use
router.post('/transfer', authenticate, authorize('production_mgr', 'admin', 'owner'), async (req, res) => {
  const { feedTypeId, packageSize, numberOfBags, transferType, notes } = req.body;
  const createdBy = req.user.id;

  if (!feedTypeId || !packageSize || !numberOfBags || !transferType) {
    return res.status(400).json({ success: false, error: 'feedTypeId, packageSize, numberOfBags, and transferType are required' });
  }

  try {
    const result = await transaction(async (client) => {
      const kgToDeduct = numberOfBags * packageSize;

      // Find available batches FIFO
      const batchesResult = await client.query(`
        SELECT id, quantity_kg, number_of_bags
        FROM finished_goods
        WHERE feed_type_id = $1 AND package_size = $2 AND status = 'available' AND quantity_kg > 0
        ORDER BY created_at ASC
      `, [feedTypeId, packageSize]);

      if (batchesResult.rows.length === 0) {
        throw new Error('No available finished goods inventory for this feed type and package size');
      }

      let remainingKg = kgToDeduct;
      let totalBagsDeducted = 0;

      for (const batch of batchesResult.rows) {
        if (remainingKg <= 0) break;

        const batchQty = parseFloat(batch.quantity_kg);
        const deductQty = Math.min(batchQty, remainingKg);
        const deductBags = Math.round(deductQty / packageSize);
        const actualDeductKg = deductBags * packageSize;

        // Update batch
        await client.query(
          `UPDATE finished_goods
           SET quantity_kg = quantity_kg - $1,
               number_of_bags = number_of_bags - $2,
               status = CASE WHEN (quantity_kg - $1) <= 0 THEN 'depleted' ELSE status END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [actualDeductKg, deductBags, batch.id]
        );

        // Log transaction
        await client.query(
          `INSERT INTO inventory_transactions (raw_material_id, transaction_type, reference_type, reference_id, quantity, unit_price, total_cost, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)`,
          [feedTypeId, 'adjustment', `fg_${transferType}`, batch.id, -actualDeductKg, notes || `Transfer: ${transferType}`, createdBy]
        );

        remainingKg -= actualDeductKg;
        totalBagsDeducted += deductBags;
      }

      if (remainingKg > 0) {
        throw new Error(`Insufficient inventory. Could only deduct ${totalBagsDeducted} bags, requested ${numberOfBags}`);
      }

      return { totalBagsDeducted, kgDeducted: kgToDeduct - remainingKg };
    });

    res.json({ success: true, transfer: result, message: 'Transfer completed successfully' });
  } catch (error) {
    console.error('Error transferring inventory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
