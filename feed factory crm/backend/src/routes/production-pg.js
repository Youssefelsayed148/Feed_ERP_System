const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { journalProductionCompleted } = require('../utils/journal');

// Generate production order number
const generateOrderNumber = () => {
  const prefix = 'PO';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// GET all production orders
router.get('/production-orders', authenticate, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT 
        po.id, po.order_number, po.quantity_kg, po.package_size, po.number_of_bags, po.batch_number,
        po.status, po.production_date, po.completion_date,
        po.actual_cost, po.notes, po.created_at,
        ft.code as feed_code, ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english
      FROM production_orders po
      JOIN feed_types ft ON po.feed_type_id = ft.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      queryStr += ` AND po.status = $${paramCount}`;
      params.push(status);
    }

    queryStr += ` ORDER BY po.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM production_orders WHERE 1=1 ${status ? 'AND status = $1' : ''}`,
      status ? [status] : []
    );

    res.json({
      orders: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching production orders:', error);
    res.status(500).json({ error: 'Failed to fetch production orders' });
  }
});

// GET single production order with materials
router.get('/production-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get order header
    const orderResult = await query(`
      SELECT 
        po.*,
        ft.code as feed_code, ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english, ft.protein_percentage
      FROM production_orders po
      JOIN feed_types ft ON po.feed_type_id = ft.id
      WHERE po.id = $1
    `, [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Production order not found' });
    }

    const order = orderResult.rows[0];

    // Get consumed materials
    const materialsResult = await query(`
      SELECT 
        poi.*,
        rm.code as material_code, rm.name_arabic as material_name_arabic,
        rm.name_english as material_name_english, rm.unit
      FROM production_order_items poi
      JOIN raw_materials rm ON poi.raw_material_id = rm.id
      WHERE poi.production_order_id = $1
      ORDER BY poi.planned_quantity DESC
    `, [id]);

    order.materials = materialsResult.rows;

    res.json(order);
  } catch (error) {
    console.error('Error fetching production order:', error);
    res.status(500).json({ error: 'Failed to fetch production order' });
  }
});

// POST create production order
router.post('/production-orders', async (req, res) => {
  try {
    const { 
      feed_type_id, 
      quantity_kg, 
      batch_number, 
      production_date, 
      notes,
      created_by 
    } = req.body;

    if (!feed_type_id || !quantity_kg) {
      return res.status(400).json({ 
        error: 'Feed type and quantity are required' 
      });
    }

    // Get recipe for this feed type
    const recipeResult = await query(`
      SELECT id, total_cost, total_quantity_kg
      FROM feed_recipes
      WHERE feed_type_id = $1 AND is_active = true
      ORDER BY version DESC
      LIMIT 1
    `, [feed_type_id]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No recipe found for this feed type' 
      });
    }

    const recipe = recipeResult.rows[0];
    const recipeTotalKg = parseFloat(recipe.total_quantity_kg) || 1000;
    const recipeCost = parseFloat(recipe.total_cost) || 0;
    const estimatedCost = quantity_kg > 0 ? (quantity_kg / recipeTotalKg) * recipeCost : 0;
    const order_number = generateOrderNumber();

    // Create production order
    const result = await transaction(async (client) => {
      // Insert order
      const orderResult = await client.query(`
        INSERT INTO production_orders 
        (order_number, feed_type_id, recipe_id, quantity_kg, batch_number, 
         status, production_date, notes, created_by, actual_cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        order_number, feed_type_id, recipe.id, quantity_kg, 
        batch_number, 'draft', production_date, notes, created_by, estimatedCost
      ]);

      const order = orderResult.rows[0];

      // Get recipe ingredients WITH raw material unit_price (price per kg)
      const ingredientsResult = await client.query(`
        SELECT 
          fri.raw_material_id, fri.quantity_kg, fri.unit_cost,
          rm.current_stock, rm.name_arabic as material_name, rm.unit_price
        FROM feed_recipe_items fri
        JOIN raw_materials rm ON fri.raw_material_id = rm.id
        WHERE fri.recipe_id = $1
      `, [recipe.id]);

      // Calculate required quantities and check stock
      const requiredMaterials = [];
      const factor = quantity_kg / 1000; // Recipe is per 1000kg (1 ton)

      for (const ingredient of ingredientsResult.rows) {
        const requiredQty = ingredient.quantity_kg * factor;
        
        if (ingredient.current_stock < requiredQty) {
          throw new Error(
            `Insufficient stock for ${ingredient.material_name}. ` +
            `Required: ${requiredQty.toFixed(2)}kg, Available: ${ingredient.current_stock}kg`
          );
        }

        // Use raw_material.unit_price (price per kg) as per-unit cost
        // NOT ingredient.unit_cost which is the line total cost per ton
        const perUnitPrice = parseFloat(ingredient.unit_price) || 0;
        requiredMaterials.push({
          raw_material_id: ingredient.raw_material_id,
          planned_quantity: requiredQty,
          unit_cost: perUnitPrice,
          total_cost: requiredQty * perUnitPrice
        });
      }

      // Insert production order items
      for (const material of requiredMaterials) {
        await client.query(`
          INSERT INTO production_order_items 
          (production_order_id, raw_material_id, planned_quantity, unit_cost, total_cost)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          order.id, material.raw_material_id, material.planned_quantity,
          material.unit_cost, material.total_cost
        ]);
      }

      return order;
    });

    logActivity({
      userId: created_by, action: 'create', module: 'production',
      description: `Created production order ${result.order_number}`,
      entityId: result.id, entityType: 'production_order'
    });

    res.status(201).json({
      message: 'Production order created successfully',
      order: result
    });
  } catch (error) {
    console.error('Error creating production order:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to create production order' 
    });
  }
});

// PUT update draft production order
router.put('/production-orders/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['feed_type_id', 'quantity_kg', 'package_size', 'number_of_bags', 'production_date', 'notes', 'batch_number'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const setClause = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = Object.values(updates);
    values.push(id);
    const result = await query(
      `UPDATE production_orders SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} AND status = 'draft' RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Draft production order not found' });
    }
    res.json({ message: 'Production order updated', order: result.rows[0] });
  } catch (error) {
    console.error('Error updating production order:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT approve production order (production_manager or inventory_manager)
router.put('/production-orders/:id/approve', authenticate, authorize('production_manager', 'inventory_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await transaction(async (client) => {
      const poRes = await client.query(`SELECT * FROM production_orders WHERE id = $1 AND status = 'draft'`, [id]);
      if (poRes.rows.length === 0) throw new Error('Order not found or already processed');
      const po = poRes.rows[0];

      // Check if production_order_items already exist
      const existingItems = await client.query('SELECT COUNT(*) as cnt FROM production_order_items WHERE production_order_id = $1', [id]);
      if (parseInt(existingItems.rows[0].cnt) === 0 && po.recipe_id) {
        // Auto-create material items from recipe
        const recipeItems = await client.query(`
          SELECT fri.raw_material_id, fri.quantity_kg, rm.unit_price
          FROM feed_recipe_items fri
          JOIN raw_materials rm ON fri.raw_material_id = rm.id
          WHERE fri.recipe_id = $1
        `, [po.recipe_id]);

        const qtyKg = parseFloat(po.quantity_kg) || 1000;
        for (const ri of recipeItems.rows) {
          const baseQty = parseFloat(ri.quantity_kg) || 0;
          const scaledQty = (baseQty / 1000) * qtyKg;
          const unitPrice = parseFloat(ri.unit_price) || 0;
          await client.query(`
            INSERT INTO production_order_items (production_order_id, raw_material_id, planned_quantity, unit_cost, total_cost)
            VALUES ($1, $2, $3, $4, $5)
          `, [id, ri.raw_material_id, scaledQty, unitPrice, scaledQty * unitPrice]);
        }
        console.log(`[PRODUCTION] Auto-created ${recipeItems.rows.length} material items for PO #${id}`);
      }

      await client.query(`UPDATE production_orders SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      const updated = await client.query('SELECT * FROM production_orders WHERE id = $1', [id]);
      return updated.rows[0];
    });

    res.json({ message: 'Production order approved', order: result });
  } catch (error) {
    console.error('Error approving production order:', error);
    res.status(500).json({ error: error.message || 'Failed to approve production order' });
  }
});

// PUT start production order (consume raw materials) - production_manager or inventory_manager
router.put('/production-orders/:id/start', authenticate, authorize('production_manager', 'inventory_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const result = await transaction(async (client) => {
      // Get order details
      const orderResult = await client.query(`
        SELECT po.*, ft.name_arabic as feed_name
        FROM production_orders po
        JOIN feed_types ft ON po.feed_type_id = ft.id
        WHERE po.id = $1 AND po.status = 'approved'
      `, [id]);

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or not in approved status');
      }

      const order = orderResult.rows[0];

      // Get planned materials
      const materialsResult = await client.query(`
        SELECT 
          poi.id, poi.raw_material_id, poi.planned_quantity,
          rm.current_stock, rm.name_arabic as material_name, rm.unit_price
        FROM production_order_items poi
        JOIN raw_materials rm ON poi.raw_material_id = rm.id
        WHERE poi.production_order_id = $1
      `, [id]);

      let totalActualCost = 0;

      for (const material of materialsResult.rows) {
        const plannedQty = parseFloat(material.planned_quantity) || 0;
        const currentStock = parseFloat(material.current_stock) || 0;
        if (currentStock < plannedQty) {
          throw new Error(
            `Insufficient stock for ${material.material_name}. Required: ${plannedQty}kg, Available: ${currentStock}kg`
          );
        }

        const actualQty = plannedQty;
        const actualUnitCost = parseFloat(material.unit_price) || 0;
        const actualTotalCost = actualQty * actualUnitCost;
        totalActualCost += actualTotalCost;

        // Update actual quantity and cost
        await client.query(`
          UPDATE production_order_items 
          SET actual_quantity = $1, unit_cost = $2, total_cost = $3
          WHERE id = $4
        `, [actualQty, actualUnitCost, actualTotalCost, material.id]);

        // Deduct from inventory (skip if qty is negligible)
        if (actualQty > 0.01) {
          await client.query(`
            UPDATE raw_materials 
            SET current_stock = current_stock - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [actualQty, material.raw_material_id]);

          // Record inventory transaction
          await client.query(`
            INSERT INTO inventory_transactions 
            (raw_material_id, transaction_type, quantity, unit_price, total_cost, 
             reference_id, reference_type, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            material.raw_material_id,
            'production',
            -actualQty,
            actualUnitCost,
            actualTotalCost,
            order.id,
            'production_order',
            `Production started: ${order.order_number} - ${order.feed_name}`
          ]);
        }
      }

      // Update order status to in_progress
      const updateResult = await client.query(`
        UPDATE production_orders 
        SET status = 'in_progress', 
            actual_cost = $1,
            notes = COALESCE($2, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [totalActualCost, notes, id]);

      return updateResult.rows[0];
    });

    res.json({
      message: 'Production started successfully',
      order: result
    });
  } catch (error) {
    console.error('Error starting production order:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to start production order' 
    });
  }
});

// PUT complete production order (add finished goods)
router.put('/production-orders/:id/complete', authenticate, authorize('production_manager', 'inventory_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { actual_cost, notes, actual_quantity_kg } = req.body;
    const userId = req.user?.id || 1;

    const result = await transaction(async (client) => {
      // Get order details
      const orderResult = await client.query(`
        SELECT po.*, ft.name_arabic as feed_name, ft.name_english as feed_name_en
        FROM production_orders po
        JOIN feed_types ft ON po.feed_type_id = ft.id
        WHERE po.id = $1 AND po.status IN ('approved', 'in_progress')
      `, [id]);

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or not in approved/in_progress status');
      }

      const order = orderResult.rows[0];

      // If coming from approved (not in_progress), we need to deduct stock too
      if (order.status === 'approved') {
        const materialsResult = await client.query(`
          SELECT 
            poi.id, poi.raw_material_id, poi.planned_quantity,
            rm.current_stock, rm.name_arabic as material_name, rm.unit_price
          FROM production_order_items poi
          JOIN raw_materials rm ON poi.raw_material_id = rm.id
          WHERE poi.production_order_id = $1
        `, [id]);

        let totalActualCost = 0;
        for (const material of materialsResult.rows) {
          const plannedQty = parseFloat(material.planned_quantity) || 0;
          if (plannedQty < 0.01) continue; // skip negligible quantities
          const currentStock = parseFloat(material.current_stock) || 0;
          if (currentStock < plannedQty) {
            throw new Error(`Insufficient stock for ${material.material_name}`);
          }
          const actualQty = plannedQty;
          const actualUnitCost = parseFloat(material.unit_price) || 0;
          const actualTotalCost = actualQty * actualUnitCost;
          totalActualCost += actualTotalCost;

          await client.query(`
            UPDATE production_order_items 
            SET actual_quantity = $1, unit_cost = $2, total_cost = $3
            WHERE id = $4
          `, [actualQty, actualUnitCost, actualTotalCost, material.id]);

          await client.query(`
            UPDATE raw_materials 
            SET current_stock = current_stock - $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [actualQty, material.raw_material_id]);

          await client.query(`
            INSERT INTO inventory_transactions 
            (raw_material_id, transaction_type, quantity, unit_price, total_cost, 
             reference_id, reference_type, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            material.raw_material_id,
            'production',
            -actualQty,
            actualUnitCost,
            actualTotalCost,
            order.id,
            'production_order',
            `Production complete: ${order.order_number} - ${order.feed_name}`
          ]);
        }
      }

      const producedQty = actual_quantity_kg || order.quantity_kg;
      const unitCost = (actual_cost || order.actual_cost || 0) / producedQty;
      const totalCost = actual_cost || order.actual_cost || 0;
      const pkgSize = parseInt(order.package_size) || 50;
      const numBags = Math.round(parseFloat(producedQty) / pkgSize);

      // Add to finished goods inventory
      await client.query(`
        INSERT INTO finished_goods 
        (feed_type_id, batch_number, quantity_kg, package_size, number_of_bags, unit_cost, total_cost, production_order_id, status, expiry_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'available', CURRENT_DATE + INTERVAL '90 days')
      `, [
        order.feed_type_id,
        order.batch_number || `FG-${order.order_number}`,
        producedQty,
        pkgSize,
        numBags,
        unitCost || 0,
        totalCost,
        order.id
      ]);

      // Deduct packaging bags (شكاير - RM025) from raw materials
      if (numBags > 0) {
        await client.query(`
          UPDATE raw_materials SET current_stock = GREATEST(current_stock - $1, 0), updated_at = NOW()
          WHERE id = 25
        `, [numBags]);
        await client.query(`
          INSERT INTO inventory_transactions (raw_material_id, transaction_type, quantity, unit_price, total_cost, reference_id, reference_type, notes, created_by, created_at)
          VALUES (25, 'production', $1, (SELECT unit_price FROM raw_materials WHERE id = 25), $1 * (SELECT unit_price FROM raw_materials WHERE id = 25), $2, 'production', 'Bags used for packaging', $3, NOW())
        `, [-numBags, id, userId]);
      }

      // Update order status
      const updateResult = await client.query(`
        UPDATE production_orders 
        SET status = 'completed', 
            completion_date = CURRENT_DATE,
            actual_cost = COALESCE($1, actual_cost),
            quantity_kg = COALESCE($2, quantity_kg),
            notes = COALESCE($3, notes),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *
      `, [actual_cost, actual_quantity_kg, notes, id]);

      return updateResult.rows[0];
    });

    const soNumberFromNotes = result.notes?.match(/from sales order (SO-\d+)/i)?.[1] || result.notes?.match(/Auto from (SO-\d+)/i)?.[1];

    logActivity({
      userId: result.created_by || 0, action: 'complete', module: 'production',
      description: `Completed production order ${result.order_number}`,
      entityId: result.id, entityType: 'production_order',
      oldStatus: 'in_progress', newStatus: 'completed'
    });

    journalProductionCompleted(result).catch(e => console.error('[JOURNAL] production:', e.message));

    // Auto-create delivery assignment if linked to a sales order
    try {
      if (soNumberFromNotes) {
        const soNumber = soNumberFromNotes;
        const soRes = await query('SELECT id, client_id FROM sales_orders WHERE order_number = $1', [soNumber]);
        if (soRes.rows.length > 0) {
          const existingDel = await query(
            'SELECT id FROM delivery_assignments WHERE order_id = $1 AND status IN ($2, $3, $4)',
            [soRes.rows[0].id, 'pending', 'in_transit', 'assigned']
          );
          if (existingDel.rows.length === 0) {
            // Update sales order status to 'ready'
            await query(
              'UPDATE sales_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              ['ready', soRes.rows[0].id]
            );
            const delResult = await query(`
              INSERT INTO delivery_assignments (order_id, scheduled_date, status, notes, created_by)
              VALUES ($1, CURRENT_DATE + INTERVAL '1 day', 'pending', $2, $3) RETURNING id
            `, [soRes.rows[0].id, `Auto from production ${result.order_number}`, result.created_by || 1]);
            console.log(`[DELIVERY] Auto-created delivery #${delResult.rows[0].id} for ${soNumber}`);
          }
        }
      }
    } catch (delErr) {
      console.error('[DELIVERY] Failed to auto-create delivery:', delErr.message);
    }

    res.json({
      message: 'Production order completed successfully. ' + (soNumberFromNotes ? 'Delivery assignment created.' : ''),
      order: result
    });
  } catch (error) {
    console.error('Error completing production order:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to complete production order' 
    });
  }
});

// PUT cancel production order
router.put('/production-orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await query(`
      UPDATE production_orders 
      SET status = 'cancelled', 
          notes = COALESCE(notes, '') || ' | Cancelled: ' || $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status IN ('draft', 'approved', 'in_progress')
      RETURNING *
    `, [id, reason]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Order not found or cannot be cancelled' 
      });
    }

    res.json({
      message: 'Production order cancelled',
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Error cancelling production order:', error);
    res.status(500).json({ error: 'Failed to cancel production order' });
  }
});

// GET production stats
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COALESCE(SUM(quantity_kg) FILTER (WHERE status = 'completed'), 0) as total_produced_kg,
        COALESCE(SUM(actual_cost) FILTER (WHERE status = 'completed'), 0) as total_production_cost
      FROM production_orders
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching production stats:', error);
    res.status(500).json({ error: 'Failed to fetch production stats' });
  }
});

// GET low stock suggestions - suggest production orders for low finished goods inventory
router.get('/low-stock-suggestions', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ft.id as feed_type_id,
        ft.code as feed_code,
        ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english,
        ft.protein_percentage,
        ft.category,
        COALESCE(fgi.total_quantity, 0) as current_inventory_kg,
        COALESCE(fgi.batch_count, 0) as batch_count,
        CASE 
          WHEN COALESCE(fgi.total_quantity, 0) < 5000 THEN 'critical'
          WHEN COALESCE(fgi.total_quantity, 0) < 10000 THEN 'low'
          ELSE 'normal'
        END as stock_status,
        fr.id as recipe_id,
        fr.total_cost as recipe_cost_per_1000kg
      FROM feed_types ft
      LEFT JOIN LATERAL (
        SELECT 
          SUM(quantity_kg) as total_quantity,
          COUNT(*) as batch_count
        FROM finished_goods
        WHERE feed_type_id = ft.id AND status = 'available'
      ) fgi ON true
      LEFT JOIN feed_recipes fr ON fr.feed_type_id = ft.id AND fr.is_active = true
      WHERE ft.is_active = true
      ORDER BY current_inventory_kg ASC
    `);

    res.json({ suggestions: result.rows });
  } catch (error) {
    console.error('Error fetching low stock suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch low stock suggestions' });
  }
});

// POST /api/production/create-from-suggestion - Create production order from low-stock suggestion
// Accepts quantity_tons (default) or quantity_kg. Package size: 10, 25, or 50 kg bags.
router.post('/create-from-suggestion', async (req, res) => {
  try {
    const { feed_type_id, quantity_tons, quantity_kg, package_size, auto_create_po, notes } = req.body;
    const createdBy = req.user?.id || 1;

    if (!feed_type_id || (!quantity_tons && !quantity_kg)) {
      return res.status(400).json({ error: 'feed_type_id and quantity_tons (or quantity_kg) are required' });
    }

    // Convert to kg internally, calculate bags
    const qtyKg = quantity_tons ? parseFloat(quantity_tons) * 1000 : parseFloat(quantity_kg);
    const pkgSize = package_size || 50;
    const numBags = Math.round(qtyKg / pkgSize);

    const result = await transaction(async (client) => {
      // Get recipe
      const recipeResult = await client.query(`
        SELECT id, total_cost, name FROM feed_recipes
        WHERE feed_type_id = $1 AND is_active = true
        ORDER BY version DESC LIMIT 1
      `, [feed_type_id]);

      if (recipeResult.rows.length === 0) {
        throw new Error('No active recipe found for this feed type');
      }

      const recipe = recipeResult.rows[0];

      // Get recipe ingredients
      const ingredientsResult = await client.query(`
        SELECT fri.raw_material_id, fri.quantity_kg, fri.unit_cost,
               rm.code, rm.name_arabic, rm.name_english, rm.current_stock,
               rm.min_stock_level, rm.reorder_level
        FROM feed_recipe_items fri
        JOIN raw_materials rm ON fri.raw_material_id = rm.id
        WHERE fri.recipe_id = $1
      `, [recipe.id]);

      const factor = qtyKg / 1000;
      const shortages = [];
      const sufficientMaterials = [];

      for (const ing of ingredientsResult.rows) {
        const requiredQty = parseFloat(ing.quantity_kg) * factor;
        const currentStock = parseFloat(ing.current_stock) || 0;
        const shortage = Math.max(0, requiredQty - currentStock);

        if (shortage > 0) {
          shortages.push({
            raw_material_id: ing.raw_material_id,
            code: ing.code,
            name_arabic: ing.name_arabic,
            name_english: ing.name_english,
            required: Math.round(requiredQty * 100) / 100,
            available: Math.round(currentStock * 100) / 100,
            shortage: Math.round(shortage * 100) / 100,
            unit_cost: ing.unit_cost
          });
        } else {
          sufficientMaterials.push({
            raw_material_id: ing.raw_material_id,
            quantity_kg: requiredQty,
            unit_cost: ing.unit_cost,
            total_cost: requiredQty * ing.unit_cost
          });
        }
      }

      // Create production order
      const orderNumber = generateOrderNumber();
      const poResult = await client.query(`
        INSERT INTO production_orders
        (order_number, feed_type_id, recipe_id, quantity_kg, package_size, number_of_bags, batch_number,
         status, production_date, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', CURRENT_DATE, $8, $9)
        RETURNING *
      `, [orderNumber, feed_type_id, recipe.id, qtyKg, pkgSize, numBags,
          `BATCH-${feed_type_id}-${Date.now().toString(36).toUpperCase()}`,
          notes || `Auto-created from low-stock suggestion`, createdBy]);

      const productionOrder = poResult.rows[0];

      // Insert production order items for all materials (even if short - for planning)
      for (const ing of ingredientsResult.rows) {
        const requiredQty = parseFloat(ing.quantity_kg) * factor;
        await client.query(`
          INSERT INTO production_order_items
          (production_order_id, raw_material_id, planned_quantity, unit_cost, total_cost)
          VALUES ($1, $2, $3, $4, $5)
        `, [productionOrder.id, ing.raw_material_id, requiredQty,
            ing.unit_cost, requiredQty * ing.unit_cost]);
      }

      // Auto-create purchase orders for shortages if requested
      const createdPOs = [];
      if (auto_create_po && shortages.length > 0) {
        for (const short of shortages) {
          const supplierRes = await client.query(`
            SELECT s.id, s.code, s.name, s.payment_terms
            FROM suppliers s
            WHERE $1 = ANY(s.materials_supplied)
            AND s.is_active = true
            ORDER BY s.performance_rating DESC
            LIMIT 1
          `, [short.code]);

          if (supplierRes.rows.length === 0) continue;

          const supplier = supplierRes.rows[0];
          const poNumber = `PO-AUTO-${Date.now()}-${short.raw_material_id}`;
          const qty = Math.ceil(short.shortage * 1.1);
          const unitCost = short.unit_cost;
          const subtotal = qty * unitCost;
          const vat = subtotal * 0.14;
          const total = subtotal + vat;

          const poResult = await client.query(`
            INSERT INTO purchase_orders
            (po_number, supplier_id, status, total_amount, expected_date, notes, created_by)
            VALUES ($1, $2, 'draft', $3, CURRENT_DATE + INTERVAL '7 days', $4, $5)
            RETURNING *
          `, [poNumber, supplier.id, total,
              `Auto-generated for production order ${orderNumber} - shortage of ${short.name_arabic}`,
              createdBy]);

          await client.query(`
            INSERT INTO purchase_order_items
            (purchase_order_id, raw_material_id, quantity, unit, unit_cost, total_cost)
            VALUES ($1, $2, $3, 'kg', $4, $5)
          `, [poResult.rows[0].id, short.raw_material_id, qty, unitCost, qty * unitCost]);

          createdPOs.push({
            po_id: poResult.rows[0].id,
            po_number: poNumber,
            supplier_name: supplier.name,
            material: short.name_arabic,
            quantity: qty,
            total: total
          });
        }
      }

      // Return with tons for display
      return {
        productionOrder: {
          ...productionOrder,
          quantity_tons: parseFloat(productionOrder.quantity_kg) / 1000,
          package_size: pkgSize,
          number_of_bags: numBags
        },
        recipe: { id: recipe.id, name: recipe.name, total_cost: recipe.total_cost },
        shortages,
        createdPOs,
        canStart: shortages.length === 0
      };
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error creating production from suggestion:', error);
    res.status(500).json({
      error: error.message || 'Failed to create production order from suggestion'
    });
  }
});

// GET finished goods inventory
router.get('/finished-goods', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        fgi.id,
        fgi.feed_type_id,
        ft.code as feed_code,
        ft.name_arabic as feed_name_arabic,
        ft.name_english as feed_name_english,
        ft.protein_percentage,
        fgi.batch_number,
        fgi.quantity_kg,
        fgi.package_size,
        fgi.number_of_bags,
        fgi.unit_cost,
        fgi.total_cost,
        fgi.status,
        fgi.expiry_date,
        fgi.created_at,
        po.order_number as production_order_number
      FROM finished_goods fgi
      JOIN feed_types ft ON fgi.feed_type_id = ft.id
      LEFT JOIN production_orders po ON fgi.production_order_id = po.id
      WHERE fgi.status = 'available'
      ORDER BY fgi.created_at DESC
    `);

    res.json({ finishedGoods: result.rows });
  } catch (error) {
    console.error('Error fetching finished goods:', error);
    res.status(500).json({ error: 'Failed to fetch finished goods' });
  }
});

module.exports = router;
