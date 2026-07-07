const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { journalSalesOrderApproved } = require('../utils/journal');
const { advanceApproval } = require('./approvals');
const adminOnly = authorize('owner', 'admin');

const generateCode = async (prefix, tableName, codeColumn) => {
  const year = new Date().getFullYear();
  const result = await query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE ${codeColumn} LIKE $1`,
    [`${prefix}-${year}-%`]
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
};

const generateOrderNumber = () => generateCode('SO', 'sales_orders', 'order_number');
const generateInvoiceNumber = () => generateCode('INV', 'invoices', 'invoice_number');

router.get('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { status, client, paymentType, search } = req.query;
    
    const conditions = [];
    const params = [];
    let paramIdx = 1;
    
    if (status) {
      conditions.push(`o.status = $${paramIdx++}`);
      params.push(status);
    }
    if (client) {
      conditions.push(`o.client_id = $${paramIdx++}`);
      params.push(client);
    }
    if (paymentType) {
      conditions.push(`o.payment_status = $${paramIdx++}`);
      params.push(paymentType);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const result = await query(
      `SELECT o.*, 
        COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name,
        c.name_arabic as client_name_arabic,
        (SELECT COUNT(*) FROM sales_order_items WHERE order_id = o.id) as item_count,
        inv.id as invoice_id,
        inv.invoice_number,
        inv.status as invoice_status,
        inv.amount as invoice_amount
       FROM sales_orders o
       LEFT JOIN clients c ON o.client_id = c.id
       LEFT JOIN invoices inv ON inv.order_id = o.id
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );
    
    const orders = result.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      clientId: o.client_id,
      clientName: o.client_name,
      status: o.status,
      totalAmount: parseFloat(o.total_amount),
      discountAmount: parseFloat(o.discount_amount),
      taxAmount: parseFloat(o.tax_amount),
      finalAmount: parseFloat(o.final_amount),
      paymentStatus: o.payment_status,
      deliveryDate: o.delivery_date,
      notes: o.notes,
      rejectionReason: o.rejection_reason,
      createdBy: o.created_by,
      approvedBy: o.approved_by,
      approvedAt: o.approved_at,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      itemCount: parseInt(o.item_count) || 0,
      invoice: o.invoice_id ? {
        id: o.invoice_id,
        invoiceNumber: o.invoice_number,
        status: o.invoice_status,
        amount: parseFloat(o.invoice_amount) || 0
      } : null
    }));
    
    res.json({ orders, total: orders.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    
    const todayResult = await query(
      `SELECT COUNT(*) as count FROM sales_orders WHERE created_at::date = $1`,
      [today]
    );
    const todayOrders = parseInt(todayResult.rows[0].count);
    
    const revenueResult = await query(
      `SELECT COALESCE(SUM(final_amount), 0) as total 
       FROM sales_orders`,
      []
    );
    const totalRevenue = parseFloat(revenueResult.rows[0].total);
    
    const totalResult = await query(`SELECT COUNT(*) as count FROM sales_orders`);
    const total = parseInt(totalResult.rows[0].count);
    
    res.json({ total, todayOrders, totalRevenue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pending/delivery', authenticate, adminOnly, async (req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
       FROM sales_orders o
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE o.status IN ('confirmed', 'processing', 'in_transit')
       ORDER BY o.delivery_date ASC`
    );
    
    const orders = result.rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      clientId: o.client_id,
      clientName: o.client_name,
      status: o.status,
      totalAmount: parseFloat(o.total_amount),
      finalAmount: parseFloat(o.final_amount),
      deliveryDate: o.delivery_date,
      createdAt: o.created_at
    }));
    
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, adminOnly, async (req, res) => {
  try {
    const orderResult = await query(
      `SELECT o.*, COALESCE(NULLIF(c.name_arabic, ''), c.name_english) as client_name
       FROM sales_orders o
       LEFT JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1`,
      [req.params.id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const o = orderResult.rows[0];
    
    const itemsResult = await query(
      `SELECT soi.*, ft.name_arabic as feed_type_name, ft.name_english as feed_type_name_en
       FROM sales_order_items soi
       LEFT JOIN feed_types ft ON soi.feed_type_id = ft.id
       WHERE soi.order_id = $1`,
      [req.params.id]
    );
    
    const order = {
      id: o.id,
      orderNumber: o.order_number,
      clientId: o.client_id,
      clientName: o.client_name,
      status: o.status,
      totalAmount: parseFloat(o.total_amount),
      discountAmount: parseFloat(o.discount_amount),
      taxAmount: parseFloat(o.tax_amount),
      finalAmount: parseFloat(o.final_amount),
      paymentStatus: o.payment_status,
      deliveryDate: o.delivery_date,
      notes: o.notes,
      rejectionReason: o.rejection_reason,
      items: itemsResult.rows.map(item => ({
        id: item.id,
        feedTypeId: item.feed_type_id,
        feedType: { name: item.feed_type_name_ar || item.feed_type_name_en || item.feed_type_name },
        packageSize: item.package_size,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        costPrice: parseFloat(item.cost_price) || 0,
        totalCost: parseFloat(item.total_cost) || 0
      })),
      createdBy: o.created_by,
      approvedBy: o.approved_by,
      approvedAt: o.approved_at,
      createdAt: o.created_at,
      updatedAt: o.updated_at
    };
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try {
    const { clientId, items, paymentType, deliveryAddress, deliveryDate, notes, forceOverride } = req.body;
    
    const clientResult = await query(
      `SELECT * FROM clients WHERE id = $1`,
      [clientId]
    );
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const client = clientResult.rows[0];
    
    let subtotal = 0;
    const orderItems = await Promise.all(items.map(async item => {
      let unitPrice = item.unitPrice || 0;
      const pkg = item.packageSize || 50;
      
      if (!unitPrice) {
        try {
          const pricingRes = await query(
            `SELECT selling_price_75 FROM feed_pricing WHERE feed_type_id = $1 AND package_size = $2 AND is_active = true LIMIT 1`,
            [item.feedTypeId, pkg]
          );
          if (pricingRes.rows.length > 0) {
            unitPrice = parseFloat(pricingRes.rows[0].selling_price_75) / 100;
          }
        } catch (e) {
          console.error('Error fetching selling price:', e.message);
        }
      }
      
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;
      
      let costPrice = 0;
      try {
        const recipeRes = await query(
          `SELECT total_cost, total_quantity_kg FROM feed_recipes WHERE feed_type_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1`,
          [item.feedTypeId]
        );
        if (recipeRes.rows.length > 0) {
          const costPerKg = parseFloat(recipeRes.rows[0].total_cost) / parseFloat(recipeRes.rows[0].total_quantity_kg);
          costPrice = costPerKg * pkg;
        }
      } catch (e) {
        console.error('Error fetching recipe cost:', e.message);
      }
      
      return {
        feedTypeId: item.feedTypeId,
        packageSize: pkg,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        costPrice
      };
    }));
    
    // All amounts now in EGP (no piasters)
    if (paymentType === 'credit' && client.credit_limit > 0) {
      const projected = parseFloat(client.current_balance || 0) + subtotal;
      const percent = (projected / client.credit_limit) * 100;
      if (percent >= 80 && !forceOverride) {
        return res.status(403).json({
          error: 'Credit limit exceeded', 
          blocked: true,
          message: `Client at ${percent.toFixed(1)}% credit. Admin override required.`,
          canOverride: true, 
          currentBalance: parseFloat(client.current_balance), 
          projectedCredit: projected,
          creditLimit: client.credit_limit
        });
      }
    }
    
    const orderNumber = await generateOrderNumber();
    
    const creditPeriod = paymentType === 'credit' ? (client.payment_terms || 0) : 0;
    const dueDate = creditPeriod > 0 
      ? new Date(Date.now() + creditPeriod * 86400000).toISOString().split('T')[0] 
      : null;
    
    const orderResult = await query(
      `INSERT INTO sales_orders (
        order_number, client_id, status, total_amount, 
        discount_amount, tax_amount, final_amount, 
        payment_status, delivery_date, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, 0, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING *`,
      [orderNumber, clientId, 'pending_approval', subtotal, 'pending', deliveryDate || null, notes, req.user.id]
    );
    
    const order = orderResult.rows[0];
    
    for (const item of orderItems) {
      await query(
        `INSERT INTO sales_order_items (order_id, feed_type_id, package_size, quantity, unit_price, total_price, cost_price, total_cost, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [order.id, item.feedTypeId, item.packageSize, item.quantity, item.unitPrice, item.totalPrice, item.costPrice, item.costPrice * item.quantity]
      );
    }
    
    // Balance is updated during invoice creation (approval flow in sales.js), not here
    // to prevent double-counting when order goes through sales approval
    
    // Auto-create production orders for each item
    try {
      for (const item of orderItems) {
        const recipeRes = await query(
          `SELECT id, total_cost, total_quantity_kg FROM feed_recipes WHERE feed_type_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1`,
          [item.feedTypeId]
        );
        if (recipeRes.rows.length > 0) {
          // item.quantity is number of bags (frontend computes from tons * 1000 / packageSize)
          const totalKg = (parseFloat(item.quantity) || 0) * (item.packageSize || 50);
          const r = recipeRes.rows[0];
          const recipeTotalKg = parseFloat(r.total_quantity_kg) || 1000;
          const estimatedCost = totalKg > 0 ? (totalKg / recipeTotalKg) * parseFloat(r.total_cost) : 0;
          const prodResult = await query(
            `INSERT INTO production_orders (order_number, feed_type_id, recipe_id, quantity_kg, package_size, number_of_bags, batch_number, status, production_date, notes, created_by, actual_cost)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', CURRENT_DATE, $8, $9, $10)
             RETURNING id`,
            [
              `PROD-${order.order_number}-${item.feedTypeId}`,
              item.feedTypeId,
              r.id,
              totalKg,
              item.packageSize || 50,
              item.quantity,
              `BATCH-${order.order_number}`,
              `Auto from ${order.order_number}`,
              req.user.id,
              estimatedCost
            ]
          );
          const productionOrderId = prodResult.rows[0].id;

          const recipeItems = await query(
            `SELECT fri.raw_material_id, fri.quantity_kg, rm.unit_price
             FROM feed_recipe_items fri
             JOIN raw_materials rm ON rm.id = fri.raw_material_id
             WHERE fri.recipe_id = $1`,
            [r.id]
          );
          for (const ri of recipeItems.rows) {
            const scaledQty = (ri.quantity_kg / recipeTotalKg) * totalKg;
            const totalCostItem = scaledQty * parseFloat(ri.unit_price);
            await query(
              `INSERT INTO production_order_items
               (production_order_id, raw_material_id, planned_quantity,
                actual_quantity, unit_cost, total_cost)
               VALUES ($1, $2, $3, $3, $4, $5)`,
              [productionOrderId, ri.raw_material_id,
               scaledQty.toFixed(4), ri.unit_price, totalCostItem.toFixed(2)]
            );
          }
          await query(
            `UPDATE production_orders
             SET actual_cost = (
               SELECT COALESCE(SUM(total_cost), 0)
               FROM production_order_items
               WHERE production_order_id = $1
             )
             WHERE id = $1`,
            [productionOrderId]
          );
        }
      }
    } catch (prodErr) {
      console.error('[PRODUCTION] Auto-create failed:', prodErr.message);
    }
    
    // ── Create approval request so the order appears in the Approvals screen ──
    // sales_orders go to sales_manager (Stage 1) then owner (Stage 2).
    try {
      await query(
        `INSERT INTO approval_requests
           (module_name, request_type, request_id, requester_id, notes, status, stage)
         VALUES ('sales_orders', 'sales_order', $1, $2, $3, 'pending', 'manager_review')
         ON CONFLICT DO NOTHING`,
        [order.id, req.user.id,
         `طلب مبيعات ${order.order_number} — ${order.final_amount} EGP`]
      );
    } catch (approvalErr) {
      console.error('[APPROVAL] Failed to create approval request for order:', approvalErr.message);
    }

    res.status(201).json({
      id: order.id,
      orderNumber: order.order_number,
      clientId: order.client_id,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      finalAmount: parseFloat(order.final_amount),
      deliveryDate: order.delivery_date,
      notes: order.notes,
      createdAt: order.created_at
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id/status', authenticate, adminOnly, async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const validStatuses = ['pending_approval','approved','confirmed','processing','ready_for_delivery','in_transit','rejected','cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Note: "delivered" can no longer be set here — it is only set by the delivery confirmation flow (POST /api/delivery/:id/confirm), which captures proof of delivery.' });
    }

    // Guard: ready_for_delivery and in_transit must be triggered from Production, not Sales
    if (status === 'ready_for_delivery' || status === 'in_transit') {
      return res.status(403).json({ error: 'هذا التحويل يتم فقط من صفحة الإنتاج — لا يمكن تحديث الحالة من المبيعات' });
    }

    // Per access doc: approval/rejection AND confirmation require sales_manager+.
    // Delegated entirely to the shared approval_requests workflow (approvals.js)
    // so invoice/production-order/journal side effects live in exactly one place.
    const approvalTierStatuses = ['approved', 'rejected', 'confirmed'];
    if (approvalTierStatuses.includes(status)) {
      const role = req.user.role;
      if (!['sales_manager', 'admin', 'owner'].includes(role)) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لهذا الإجراء — يحتاج موافقة مدير المبيعات' });
      }

      const arResult = await query(
        `SELECT * FROM approval_requests WHERE module_name = 'sales_orders' AND request_id = $1 AND status = 'pending'`,
        [req.params.id]
      );
      if (arResult.rows.length === 0) {
        return res.status(404).json({ error: 'No pending approval request found for this order' });
      }

      const outcome = await advanceApproval({
        approvalId: arResult.rows[0].id,
        userId: req.user.id,
        role,
        notes,
        action: status === 'rejected' ? 'reject' : 'approve'
      });
      if (outcome.statusCode >= 400) {
        return res.status(outcome.statusCode).json(outcome.body);
      }

      const updatedOrder = await query(`SELECT * FROM sales_orders WHERE id = $1`, [req.params.id]);
      const o = updatedOrder.rows[0];
      return res.json({
        id: o.id, orderNumber: o.order_number, clientId: o.client_id, status: o.status,
        totalAmount: parseFloat(o.total_amount), finalAmount: parseFloat(o.final_amount),
        deliveryDate: o.delivery_date, notes: o.notes, rejectionReason: o.rejection_reason,
        approvedAt: o.approved_at, updatedAt: o.updated_at
      });
    }

    const updates = [status];
    let sql = `UPDATE sales_orders SET status = $1`;
    let paramIdx = 2;

    if (status === 'ready_for_delivery') {
      sql += `, ready_at = NOW(), ready_by = $${paramIdx++}`;
      updates.push(req.user.id);
    }
    if (status === 'cancelled') {
      sql += `, notes = COALESCE(notes, '') || ' | Cancellation: ' || $${paramIdx++}`;
      updates.push(notes || '');
    }

    sql += `, updated_at = NOW() WHERE id = $${paramIdx++} RETURNING *`;
    updates.push(req.params.id);

    const result = await query(sql, updates);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const o = result.rows[0];

    // Auto-create production orders when status changes to 'processing'
    if (status === 'processing') {
      try {
        const items = await query(
          'SELECT * FROM sales_order_items WHERE order_id = $1',
          [req.params.id]
        );
        for (const item of items.rows) {
          const quantityKg = parseFloat(item.quantity) * parseFloat(item.package_size);
          const numberOfBags = parseInt(item.quantity);
          const orderNumber = `PRD-${Date.now()}-${item.id}`;

          const recipeResult = await query(
            `SELECT id, total_quantity_kg FROM feed_recipes
             WHERE feed_type_id = $1 AND is_active = true
             ORDER BY version DESC LIMIT 1`,
            [item.feed_type_id]
          );
          const recipe = recipeResult.rows[0];
          if (!recipe) {
            console.warn(`[PRODUCTION] No active recipe for feed_type_id=${item.feed_type_id}, creating order without items`);
          }

          const prodResult = await query(
            `INSERT INTO production_orders
             (order_number, feed_type_id, recipe_id, quantity_kg, status, production_date,
              sales_order_id, package_size, number_of_bags, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, 'draft', CURRENT_DATE, $5, $6, $7, $8, NOW(), NOW())
             RETURNING id`,
            [orderNumber, item.feed_type_id, recipe ? recipe.id : null, quantityKg,
             req.params.id, item.package_size, numberOfBags, req.user?.id || 1]
          );
          const productionOrderId = prodResult.rows[0].id;

          if (recipe && productionOrderId) {
            const recipeItems = await query(
              `SELECT fri.raw_material_id, fri.quantity_kg, rm.unit_price
               FROM feed_recipe_items fri
               JOIN raw_materials rm ON rm.id = fri.raw_material_id
               WHERE fri.recipe_id = $1`,
              [recipe.id]
            );
            for (const ri of recipeItems.rows) {
              const scaledQty = (ri.quantity_kg / recipe.total_quantity_kg) * quantityKg;
              const totalCost = scaledQty * parseFloat(ri.unit_price);
              await query(
                `INSERT INTO production_order_items
                 (production_order_id, raw_material_id, planned_quantity,
                  actual_quantity, unit_cost, total_cost)
                 VALUES ($1, $2, $3, $3, $4, $5)`,
                [productionOrderId, ri.raw_material_id,
                 scaledQty.toFixed(4), ri.unit_price, totalCost.toFixed(2)]
              );
            }
            await query(
              `UPDATE production_orders
               SET actual_cost = (
                 SELECT COALESCE(SUM(total_cost), 0)
                 FROM production_order_items
                 WHERE production_order_id = $1
               )
               WHERE id = $1`,
              [productionOrderId]
            );
          }
        }
      } catch (prodErr) {
        console.error('Failed to create production orders:', prodErr.message);
      }

      // Create journal entry for sales revenue (idempotent)
      try {
        const existingJE = await query(
          `SELECT id FROM journal_entries WHERE reference_type = 'sales_order' AND reference_id = $1`,
          [o.id]
        );
        if (existingJE.rows.length === 0) {
          await journalSalesOrderApproved(o);
        }
      } catch (jeErr) {
        console.error('Failed to create sales journal entry:', jeErr.message);
      }
    }

    res.json({
      id: o.id,
      orderNumber: o.order_number,
      clientId: o.client_id,
      status: o.status,
      totalAmount: parseFloat(o.total_amount),
      finalAmount: parseFloat(o.final_amount),
      deliveryDate: o.delivery_date,
      notes: o.notes,
      rejectionReason: o.rejection_reason,
      approvedAt: o.approved_at,
      updatedAt: o.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/orders/:id/send-to-delivery
// The actual hand-off to Logistics — creates the delivery_assignments row
// that makes the order visible in the Logistics Coordinator's queue for
// driver/vehicle assignment. Distinct from PUT /:id/status with
// 'ready_for_delivery', which only marks the order as processed/fulfilled
// without yet notifying delivery.
//
// Role scope confirmed 2026-06-21: owner/admin only for now. sales_manager
// was removed pending a decision on broader role assignment (logistics
// coordinator, etc.) — re-add here if/when that's decided.
router.post('/:id/send-to-delivery', authenticate, authorize('owner', 'admin', 'production_mgr'), async (req, res) => {
  try {
    const orderRes = await query('SELECT id, order_number, status FROM sales_orders WHERE id = $1', [req.params.id]);
    if (orderRes.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    if (order.status !== 'ready_for_delivery') {
      return res.status(400).json({ error: `Order must be marked ready for delivery first (current status: ${order.status})` });
    }

    const existingDel = await query(
      `SELECT id FROM delivery_assignments WHERE order_id = $1 AND status IN ('pending','assigned','accepted','picked_up','in_transit','arrived')`,
      [order.id]
    );
    if (existingDel.rows.length > 0) {
      return res.status(400).json({ error: 'This order already has an active delivery assignment', deliveryId: existingDel.rows[0].id });
    }

    const { scheduled_date, notes } = req.body || {};

    const delResult = await query(
      `INSERT INTO delivery_assignments (order_id, scheduled_date, status, notes, created_by)
       VALUES ($1, $2, 'pending', $3, $4) RETURNING *`,
      [order.id, scheduled_date || null, notes || `Sent to delivery from order ${order.order_number}`, req.user.id]
    );

    await query(
      `UPDATE sales_orders SET status = 'in_transit', sent_to_delivery_at = NOW(), sent_to_delivery_by = $1, updated_at = NOW() WHERE id = $2`,
      [req.user.id, order.id]
    );

    res.status(201).json({
      message: 'Order sent to delivery successfully',
      delivery: delResult.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/invoice', authenticate, adminOnly, async (req, res) => {
  try {
    const orderResult = await query(
      `SELECT * FROM sales_orders WHERE id = $1`,
      [req.params.id]
    );
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderResult.rows[0];
    
    const existingInvoice = await query(
      `SELECT * FROM invoices WHERE order_id = $1`,
      [req.params.id]
    );
    
    if (existingInvoice.rows.length > 0) {
      const ei = existingInvoice.rows[0];
      return res.status(200).json({
        id: ei.id,
        invoiceNumber: ei.invoice_number,
        orderId: ei.order_id,
        clientId: ei.client_id,
        amount: parseFloat(ei.amount),
        paidAmount: parseFloat(ei.paid_amount),
        balanceDue: parseFloat(ei.balance_due),
        status: ei.status,
        issueDate: ei.issue_date,
        dueDate: ei.due_date,
        createdAt: ei.created_at,
        alreadyExisted: true
      });
    }
    
    const invoiceNumber = await generateInvoiceNumber();
    
    const invoiceResult = await query(
      `INSERT INTO invoices (
        invoice_number, order_id, client_id, amount, 
        paid_amount, balance_due, status, issue_date, due_date, notes, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 0, $4, 'pending', CURRENT_DATE, $5, $6, $7, NOW(), NOW())
      RETURNING *`,
      [invoiceNumber, req.params.id, order.client_id, order.final_amount, order.delivery_date, order.notes, req.user.id]
    );
    
    const invoice = invoiceResult.rows[0];
    
    res.status(201).json({
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      orderId: invoice.order_id,
      clientId: invoice.client_id,
      amount: parseFloat(invoice.amount),
      paidAmount: parseFloat(invoice.paid_amount),
      balanceDue: parseFloat(invoice.balance_due),
      status: invoice.status,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      createdAt: invoice.created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;