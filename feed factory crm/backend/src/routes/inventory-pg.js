const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { checkAndCreateRequisition } = require('../services/autoReorderCheck');

// ============================================================
// All routes require authentication
// ============================================================
router.use(authenticate);

// GET all raw materials
router.get('/raw-materials', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT
        rm.id, rm.code, rm.name_arabic, rm.name_english,
        rm.category, rm.unit, rm.unit_price,
        rm.min_stock_level, rm.reorder_level, rm.current_stock,
        rm.is_active,
        CASE
          WHEN rm.current_stock <= rm.min_stock_level THEN 'critical'
          WHEN rm.current_stock <= rm.reorder_level THEN 'low'
          ELSE 'normal'
        END as stock_status
      FROM raw_materials rm
      WHERE rm.is_active = true
      ORDER BY rm.category, rm.name_arabic
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await query(`SELECT COUNT(*) FROM raw_materials rm WHERE rm.is_active = true`);

    // Add display_unit and per-ton pricing for bulk materials
    // Bulk categories (grain, protein, fiber) are traded in tons
    // Everything else (additives, minerals, oil, packaging, etc.) in kg
    const bulkCategories = ['grain', 'protein', 'fiber'];
    const rows = result.rows.map(rm => {
      const isBulk = bulkCategories.includes(rm.category);
      return {
        ...rm,
        display_unit: isBulk ? 'ton' : (rm.unit || 'kg'),
        price_per_ton: parseFloat(rm.unit_price) * 1000,
        current_stock_tons: isBulk ? parseFloat(rm.current_stock) / 1000 : null,
        current_stock_display: isBulk
          ? (parseFloat(rm.current_stock) / 1000).toFixed(3)
          : parseFloat(rm.current_stock).toFixed(2),
        unit_display: isBulk ? 'ton' : (rm.unit || 'kg')
      };
    });

    res.json({
      materials: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    res.status(500).json({ error: 'Failed to fetch raw materials' });
  }
});

// GET raw materials with low stock
router.get('/raw-materials/low-stock', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        rm.id, rm.code, rm.name_arabic, rm.name_english,
        rm.category, rm.current_stock, rm.min_stock_level, rm.reorder_level,
        rm.unit_price,
        (rm.reorder_level - rm.current_stock) as quantity_to_order,
        (rm.reorder_level - rm.current_stock) * rm.unit_price as estimated_cost,
        (SELECT json_build_object(
          'id', s.id,
          'name', s.name,
          'unit_price', sm.unit_price,
          'lead_time_days', sm.lead_time_days
        ) FROM supplier_materials sm
        JOIN suppliers s ON sm.supplier_id = s.id
        WHERE sm.raw_material_id = rm.id
        ORDER BY sm.is_preferred DESC, sm.unit_price ASC
        LIMIT 1) as preferred_supplier
      FROM raw_materials rm
      WHERE rm.is_active = true
        AND rm.current_stock <= rm.reorder_level
      ORDER BY 
        CASE 
          WHEN rm.current_stock <= rm.min_stock_level THEN 1
          ELSE 2
        END,
        rm.current_stock / rm.min_stock_level ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock materials:', error);
    res.status(500).json({ error: 'Failed to fetch low stock materials' });
  }
});

// GET single raw material
router.get('/raw-materials/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        rm.*,
        CASE 
          WHEN rm.current_stock <= rm.min_stock_level THEN 'critical'
          WHEN rm.current_stock <= rm.reorder_level THEN 'low'
          ELSE 'normal'
        END as stock_status
      FROM raw_materials rm
      WHERE rm.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Get recent transactions
    const transactionsResult = await query(`
      SELECT 
        it.id, it.transaction_type, it.quantity,
        it.unit_price, it.total_cost, it.notes,
        it.created_at, it.created_by
      FROM inventory_transactions it
      WHERE it.raw_material_id = $1
      ORDER BY it.created_at DESC
      LIMIT 20
    `, [id]);

    const material = result.rows[0];
    material.recent_transactions = transactionsResult.rows;

    // Get recipes that use this material
    const recipesResult = await query(`
      SELECT
        fr.id as recipe_id,
        fr.name as recipe_name,
        ft.name_arabic as feed_type_name,
        fri.quantity_kg
      FROM feed_recipe_items fri
      JOIN feed_recipes fr ON fr.id = fri.recipe_id
      LEFT JOIN feed_types ft ON ft.id = fr.feed_type_id
      WHERE fri.raw_material_id = $1
      ORDER BY fr.name
    `, [id]);
    material.used_in_recipes = recipesResult.rows;

    // Get linked suppliers via supplier_materials
    const suppliersResult = await query(`
      SELECT s.id, s.name, sm.is_preferred, sm.unit_price, sm.lead_time_days
      FROM supplier_materials sm
      JOIN suppliers s ON s.id = sm.supplier_id
      WHERE sm.raw_material_id = $1
      ORDER BY sm.is_preferred DESC
    `, [id]);
    material.linked_suppliers = suppliersResult.rows || [];

    res.json(material);
  } catch (error) {
    console.error('Error fetching raw material:', error);
    res.status(500).json({ error: 'Failed to fetch raw material' });
  }
});

// GET suppliers linked to a specific raw material (scoped list for the preferred-supplier
// selector — never the full unscoped suppliers list)
router.get('/raw-materials/:id/available-suppliers', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT s.id, s.name, sm.is_preferred
      FROM supplier_materials sm
      JOIN suppliers s ON s.id = sm.supplier_id
      WHERE sm.raw_material_id = $1
      ORDER BY sm.is_preferred DESC, s.name ASC
    `, [id]);
    res.json({ success: true, suppliers: result.rows });
  } catch (error) {
    console.error('Error fetching available suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch available suppliers' });
  }
});

// PUT update raw material metadata (owner/admin only)
router.put('/raw-materials/:id', authenticate, authorize('admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = [
      'name_arabic', 'name_english', 'unit_price',
      'reorder_level', 'min_stock_level', 'restock_quantity',
      'preferred_supplier_id'
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    if (updates.preferred_supplier_id !== undefined && updates.preferred_supplier_id !== null) {
      const linkCheck = await query(
        'SELECT 1 FROM supplier_materials WHERE raw_material_id = $1 AND supplier_id = $2',
        [id, updates.preferred_supplier_id]
      );
      if (linkCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Selected supplier is not linked to this material — add them via supplier_materials first' });
      }
    }
    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    const result = await query(
      `UPDATE raw_materials SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raw material not found' });
    }
    res.json({ success: true, material: result.rows[0] });
  } catch (error) {
    console.error('Error updating raw material:', error);
    res.status(500).json({ error: error.message || 'Failed to update raw material' });
  }
});

// POST create new raw material (owner/admin only)
router.post('/raw-materials', authenticate, authorize('admin', 'owner'), async (req, res) => {
  try {
    const {
      name_arabic, name_english, category, unit, unit_price,
      current_stock, reorder_level, min_stock_level,
      restock_quantity, preferred_supplier_id
    } = req.body;

    if (!name_arabic || !category) {
      return res.status(400).json({ error: 'name_arabic and category are required' });
    }

    // Auto-generate code: RM-XXX sequential
    const lastResult = await query(
      "SELECT code FROM raw_materials WHERE code LIKE 'RM-%' ORDER BY id DESC LIMIT 1"
    );
    const lastCode = lastResult.rows[0]?.code || 'RM-000';
    const num = parseInt(lastCode.replace(/\D/g, '')) + 1;
    const code = `RM-${String(num).padStart(3, '0')}`;

    const material = await transaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO raw_materials
         (code, name_arabic, name_english, category, unit, unit_price, current_stock,
          reorder_level, min_stock_level, restock_quantity, preferred_supplier_id, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         RETURNING *`,
        [
          code, name_arabic, name_english || null, category,
          unit || 'kg', unit_price || 0, current_stock || 0,
          reorder_level || 0, min_stock_level || 0,
          restock_quantity || null, preferred_supplier_id || null
        ]
      );
      const newMaterial = inserted.rows[0];

      // A brand-new material normally has no supplier_materials rows yet, so there's
      // nothing to validate preferred_supplier_id against — allow it through as the
      // initial assignment. Only enforce the link check if rows already exist for it.
      if (preferred_supplier_id) {
        const existingLinks = await client.query(
          'SELECT 1 FROM supplier_materials WHERE raw_material_id = $1',
          [newMaterial.id]
        );
        if (existingLinks.rows.length > 0) {
          const linkCheck = await client.query(
            'SELECT 1 FROM supplier_materials WHERE raw_material_id = $1 AND supplier_id = $2',
            [newMaterial.id, preferred_supplier_id]
          );
          if (linkCheck.rows.length === 0) {
            const err = new Error('Selected supplier is not linked to this material — add them via supplier_materials first');
            err.statusCode = 400;
            throw err;
          }
        }
      }

      return newMaterial;
    });

    res.status(201).json({ success: true, material });
  } catch (error) {
    console.error('Error creating raw material:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create raw material' });
  }
});

// POST update stock (purchase or adjustment)
router.post('/raw-materials/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, unit_price, transaction_type, notes, created_by } = req.body;

    if (!quantity || !transaction_type) {
      return res.status(400).json({ error: 'Quantity and transaction type are required' });
    }

    // Use transaction for atomic operation
    const result = await transaction(async (client) => {
      // Get current material info
      const materialResult = await client.query(
        'SELECT unit_price FROM raw_materials WHERE id = $1',
        [id]
      );
      
      if (materialResult.rows.length === 0) {
        throw new Error('Raw material not found');
      }

      const currentUnitPrice = materialResult.rows[0].unit_price;
      const totalCost = quantity * (unit_price || currentUnitPrice);

      // Update stock
      await client.query(
        `UPDATE raw_materials 
         SET current_stock = current_stock + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [quantity, id]
      );

      // Record transaction
      await client.query(
        `INSERT INTO inventory_transactions 
         (raw_material_id, transaction_type, quantity, unit_price, total_cost, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, transaction_type, quantity, unit_price || currentUnitPrice, totalCost, notes, created_by]
      );

      // Return updated material
      const updatedResult = await client.query(
        'SELECT * FROM raw_materials WHERE id = $1',
        [id]
      );

      return updatedResult.rows[0];
    });

    res.json({
      message: 'Stock updated successfully',
      material: result
    });

    // Auto-reorder check on deductions — fire-and-forget
    const qty = parseFloat(req.body.quantity);
    if (qty < 0) {
      try {
        checkAndCreateRequisition(
          [parseInt(req.params.id)],
          req.user?.id || 0,
          'تم الإنشاء تلقائياً بسبب خصم مخزون يدوي'
        ).catch(() => {});
      } catch (e) { /* never blocks */ }
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// GET /api/inventory/finished-goods - List finished goods
router.get('/finished-goods', async (req, res) => {
  try {
    const result = await query(`
      SELECT fg.*, ft.name_arabic as feed_name, po.order_number as production_order_number
      FROM finished_goods fg
      LEFT JOIN feed_types ft ON fg.feed_type_id = ft.id
      LEFT JOIN production_orders po ON fg.production_order_id = po.id
      ORDER BY fg.created_at DESC
    `);
    res.json({ finishedGoods: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET inventory dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_materials,
        COUNT(CASE WHEN current_stock <= min_stock_level THEN 1 END) as critical_stock_count,
        COUNT(CASE WHEN current_stock <= reorder_level AND current_stock > min_stock_level THEN 1 END) as low_stock_count,
        SUM(current_stock * unit_price) as total_inventory_value
      FROM raw_materials
      WHERE is_active = true
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET material categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT category
      FROM raw_materials
      WHERE is_active = true
      ORDER BY category
    `);

    res.json(result.rows.map(r => r.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /transfer - Record a stock transfer (validates stock, updates raw_materials)
router.post('/transfer', async (req, res) => {
  try {
    const { raw_material_id, quantity, from_location, to_location, notes } = req.body;

    if (!raw_material_id || !quantity) {
      return res.status(400).json({ error: 'raw_material_id and quantity are required' });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'quantity must be a positive number' });
    }

    const transferNote = notes
      ? `${notes} | Transfer from ${from_location || 'unknown'} to ${to_location || 'unknown'}`
      : `Transfer from ${from_location || 'unknown'} to ${to_location || 'unknown'}`;

    const result = await transaction(async (client) => {
      // 1. Lock the material row and get current stock
      const materialRes = await client.query(
        `SELECT id, code, name_arabic, name_english, unit, current_stock FROM raw_materials WHERE id = $1 FOR UPDATE`,
        [raw_material_id]
      );

      if (materialRes.rows.length === 0) {
        throw new Error('Material not found');
      }

      const material = materialRes.rows[0];
      const currentStock = parseFloat(material.current_stock || 0);

      // 2. Check if enough stock exists
      if (currentStock < qty) {
        throw new Error(`Insufficient stock. Available: ${currentStock} ${material.unit || 'kg'}, Requested: ${qty}`);
      }

      // 3. Deduct from raw_materials
      await client.query(
        `UPDATE raw_materials SET current_stock = current_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [qty, raw_material_id]
      );

      // 4. Record the transaction (use 'adjustment' since 'transfer' is not in the enum)
      await client.query(`
        INSERT INTO inventory_transactions
        (raw_material_id, transaction_type, quantity, reference_type, notes, created_by)
        VALUES ($1, 'adjustment', $2, 'transfer', $3, $4)
      `, [raw_material_id, -qty, transferNote, req.user?.id || null]);

      return material;
    });

    res.json({
      success: true,
      message: 'Transfer recorded',
      material: {
        id: result.id,
        name: result.name_arabic || result.name_english,
        unit: result.unit || 'kg'
      },
      quantity: qty
    });

    // Auto-reorder check — fire-and-forget
    try {
      checkAndCreateRequisition(
        [parseInt(raw_material_id)],
        req.user?.id || 0,
        'تم الإنشاء تلقائياً بسبب تحويل مخزون'
      ).catch(() => {});
    } catch (e) { /* never blocks */ }
  } catch (error) {
    console.error('Error recording transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to record transfer' });
  }
});

// GET /api/inventory/movements - Inventory transaction history
router.get('/movements', authenticate, async (req, res) => {
  try {
    const { material_id, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        it.*,
        rm.name_arabic as material_name,
        rm.code as material_code,
        rm.unit,
        u.name as user_name,
        s.name as supplier_name
      FROM inventory_transactions it
      LEFT JOIN raw_materials rm ON it.raw_material_id = rm.id
      LEFT JOIN users u ON it.created_by = u.id
      LEFT JOIN suppliers s ON it.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;
    if (material_id) { idx++; sql += ` AND it.raw_material_id = $${idx}`; params.push(material_id); }
    if (type) { idx++; sql += ` AND it.transaction_type = $${idx}`; params.push(type); }
    if (startDate) { idx++; sql += ` AND it.created_at >= $${idx}`; params.push(startDate); }
    if (endDate) { idx++; sql += ` AND it.created_at <= $${idx}`; params.push(endDate); }
    sql += ` ORDER BY it.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);
    
    const countResult = await query(`SELECT COUNT(*) FROM inventory_transactions it WHERE 1=1`);
    const result = await query(sql, params);
    res.json({
      movements: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;