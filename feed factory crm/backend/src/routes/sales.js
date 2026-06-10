const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { notifyRole, notifyUser } = require('../utils/notify');
const { logActivity } = require('../utils/activity');
const { journalInvoiceCreated } = require('../utils/journal');

// ============================================
// SALES ROUTES - Complete Sales Module API
// Includes: Orders, Invoices, Client Assignment, Reminders
// Role-based access: sales_manager, sales_rep
// ============================================

// Middleware for sales roles
const salesRoles = ['sales_manager', 'sales_rep', 'admin', 'owner'];
const managerRoles = ['sales_manager', 'admin', 'owner'];

// ============================================
// CLIENT ASSIGNMENT ROUTES
// ============================================

// Get clients assigned to logged-in sales rep
router.get('/my-clients', authenticate, authorize('sales_rep', 'sales_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let sql;
    let params;
    
    if (managerRoles.includes(userRole)) {
      // Sales managers see all clients or can filter by assigned rep
      sql = `
        SELECT c.*,
               u.name as assigned_to_name,
               (SELECT COUNT(*) FROM sales_orders WHERE client_id = c.id) as total_orders,
               (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE client_id = c.id AND status != 'paid') as due_amount
        FROM clients c
        LEFT JOIN users u ON c.assigned_to = u.id
        ORDER BY c.name_arabic
      `;
      params = [];
    } else {
      // Sales reps see only their assigned clients
      sql = `
        SELECT c.*,
               u.name as assigned_to_name,
               (SELECT COUNT(*) FROM sales_orders WHERE client_id = c.id) as total_orders,
               (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE client_id = c.id AND status != 'paid') as due_amount
        FROM clients c
        LEFT JOIN users u ON c.assigned_to = u.id
        WHERE c.assigned_to = $1 AND c.is_active = true
        ORDER BY c.name_arabic
      `;
      params = [userId];
    }
    
    const result = await query(sql, params);
    res.json({ success: true, clients: result.rows });
  } catch (error) {
    console.error('Error fetching my clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unassigned clients (for sales manager to assign)
router.get('/unassigned-clients', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM sales_orders WHERE client_id = c.id) as total_orders,
             (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE client_id = c.id AND status != 'paid') as due_amount
      FROM clients c
      WHERE c.assigned_to IS NULL
      ORDER BY c.name_arabic
    `);
    res.json({ success: true, clients: result.rows });
  } catch (error) {
    console.error('Error fetching unassigned clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Runtime migration: ensure clients table has assignment columns
let columnsEnsured = false;
async function ensureClientAssignmentColumns() {
  if (columnsEnsured) return;
  try {
    await query(`
      ALTER TABLE clients 
      ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP
    `);
    columnsEnsured = true;
  } catch (e) {
    console.error('Error ensuring client assignment columns:', e.message);
  }
}

// Assign client to sales rep (Sales Manager only)
router.post('/clients/:id/assign', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  await ensureClientAssignmentColumns();
  const clientId = req.params.id;
  const { salesRepId } = req.body;
  const assignedBy = req.user.id;
  
  if (!salesRepId) {
    return res.status(400).json({ success: false, error: 'Sales Rep ID is required' });
  }
  
  try {
    await transaction(async (client) => {
      // Verify client exists
      const clientCheck = await client.query('SELECT id FROM clients WHERE id = $1', [clientId]);
      if (clientCheck.rows.length === 0) {
        throw new Error('Client not found');
      }
      
      // Verify sales rep exists and has correct role
      const repCheck = await client.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'sales_rep' AND is_active = true",
        [salesRepId]
      );
      if (repCheck.rows.length === 0) {
        throw new Error('Sales Rep not found or not active');
      }
      
      // Update client assignment
      await client.query(
        `UPDATE clients 
         SET assigned_to = $1, assigned_by = $2, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [salesRepId, assignedBy, clientId]
      );
    });
    
    res.json({ success: true, message: 'Client assigned successfully' });
  } catch (error) {
    console.error('Error assigning client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Unassign client (Sales Manager only)
router.post('/clients/:id/unassign', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  await ensureClientAssignmentColumns();
  const clientId = req.params.id;
  
  try {
    await query(
      `UPDATE clients 
       SET assigned_to = NULL, assigned_by = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [clientId]
    );
    
    res.json({ success: true, message: 'Client unassigned successfully' });
  } catch (error) {
    console.error('Error unassigning client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sales reps list (for assignment dropdown)
router.get('/sales-reps', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, email, phone, department, 
             (SELECT COUNT(*) FROM clients WHERE assigned_to = users.id) as assigned_clients_count
      FROM users 
      WHERE role = 'sales_rep' AND is_active = true
      ORDER BY name
    `);
    res.json({ success: true, salesReps: result.rows });
  } catch (error) {
    console.error('Error fetching sales reps:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT DETAIL WITH FULL DATA
// ============================================

// Get client with full details (orders, invoices, payments, reminders)
router.get('/clients/:id/full', authenticate, authorize(...salesRoles), async (req, res) => {
  const clientId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  try {
    // Check if user has access to this client
    const accessCheck = await query(
      `SELECT assigned_to FROM clients WHERE id = $1`,
      [clientId]
    );
    
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    
    // Sales reps can only view their assigned clients
    if (userRole === 'sales_rep' && accessCheck.rows[0].assigned_to !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied - client not assigned to you' });
    }
    
    // Get client details
    const clientResult = await query(`
      SELECT c.*, u.name as assigned_to_name
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE c.id = $1
    `, [clientId]);
    
    // Get client's orders
    const ordersResult = await query(`
      SELECT so.*, 
             (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) as item_count
      FROM sales_orders so
      WHERE so.client_id = $1
      ORDER BY so.created_at DESC
    `, [clientId]);
    
    // Get client's invoices
    const invoicesResult = await query(`
      SELECT i.*, so.order_number
      FROM invoices i
      LEFT JOIN sales_orders so ON i.order_id = so.id
      WHERE i.client_id = $1
      ORDER BY i.issue_date DESC
    `, [clientId]);
    
    // Get client's payment history
    const paymentsResult = await query(`
      SELECT ph.*, u.name as collected_by_name
      FROM client_payment_history ph
      LEFT JOIN users u ON ph.collected_by = u.id
      WHERE ph.client_id = $1
      ORDER BY ph.date DESC
    `, [clientId]);
    
    // Get client's reminders
    const remindersResult = await query(`
      SELECT r.*, u.name as sales_rep_name
      FROM reminders r
      LEFT JOIN users u ON r.sales_rep_id = u.id
      WHERE r.client_id = $1
      ORDER BY r.reminder_date DESC
    `, [clientId]);
    
    // Calculate totals
    const totalsResult = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status != 'paid' THEN balance_due ELSE 0 END), 0) as total_due,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN balance_due ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN balance_due ELSE 0 END), 0) as overdue_amount,
        COUNT(*) FILTER (WHERE status != 'paid') as unpaid_invoices
      FROM invoices
      WHERE client_id = $1
    `, [clientId]);
    
    res.json({
      success: true,
      client: clientResult.rows[0],
      orders: ordersResult.rows,
      invoices: invoicesResult.rows,
      payments: paymentsResult.rows,
      reminders: remindersResult.rows,
      financialSummary: totalsResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching client details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SALES ORDERS
// ============================================

// Get orders with role-based filtering
router.get('/orders', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status, clientId, page = 1, limit = 20 } = req.query;
  
  try {
    let sql = `
      SELECT so.*, c.name_arabic as client_name, c.name_english as client_name_en,
             u.name as created_by_name, approver.name as approved_by_name,
             (SELECT COUNT(*) FROM sales_order_items WHERE order_id = so.id) as item_count,
             (SELECT status FROM production_orders po 
              WHERE po.notes LIKE '%' || so.order_number || '%' 
              ORDER BY po.created_at DESC LIMIT 1) as production_status,
             (SELECT order_number FROM production_orders po 
              WHERE po.notes LIKE '%' || so.order_number || '%' 
              ORDER BY po.created_at DESC LIMIT 1) as production_order_number
      FROM sales_orders so
      JOIN clients c ON so.client_id = c.id
      LEFT JOIN users u ON so.created_by = u.id
      LEFT JOIN users approver ON so.approved_by = approver.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Role-based filtering
    if (userRole === 'sales_rep') {
      sql += ` AND (so.created_by = $${paramIndex} OR c.assigned_to = $${paramIndex})`;
      params.push(userId);
      paramIndex++;
    }
    
    if (status) {
      sql += ` AND so.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (clientId) {
      sql += ` AND so.client_id = $${paramIndex}`;
      params.push(clientId);
      paramIndex++;
    }
    
    sql += ` ORDER BY so.created_at DESC`;
    
    // Add pagination
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);
    
    const result = await query(sql, params);
    
    // Get total count for pagination
    let countSql = `SELECT COUNT(*) FROM sales_orders so JOIN clients c ON so.client_id = c.id WHERE 1=1`;
    const countParams = [];
    let countIndex = 1;
    
    if (userRole === 'sales_rep') {
      countSql += ` AND (so.created_by = $${countIndex} OR c.assigned_to = $${countIndex})`;
      countParams.push(userId);
      countIndex++;
    }
    
    const countResult = await query(countSql, countParams);
    
    res.json({
      success: true,
      orders: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get order items
router.get('/orders/:id/items', authenticate, authorize(...salesRoles), async (req, res) => {
  try {
    const result = await query(
      `SELECT soi.*, ft.name_english as feed_type_name, ft.name_arabic as feed_type_name_ar
       FROM sales_order_items soi
       JOIN feed_types ft ON soi.feed_type_id = ft.id
       WHERE soi.order_id = $1
       ORDER BY soi.id`,
      [req.params.id]
    );
    const items = result.rows.map(item => ({
      ...item,
      cost_price: parseFloat(item.cost_price) || 0,
      total_cost: parseFloat(item.total_cost) || 0
    }));
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching order items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new order
router.post('/orders', authenticate, authorize(...salesRoles), async (req, res) => {
  const { clientId, items, deliveryDate, notes, discountAmount = 0, taxAmount = 0 } = req.body;
  const createdBy = req.user.id;
  
  if (!clientId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Client ID and items are required' });
  }

  try {
    // Check client has all required documents before allowing orders
    const docCheck = await query(`
      SELECT COUNT(*) as required FROM client_required_docs WHERE is_required = true
    `);
    const docActual = await query(`
      SELECT COUNT(DISTINCT description) as uploaded FROM documents 
      WHERE entity_type = 'client' AND entity_id = $1 AND description IS NOT NULL
    `, [clientId]);
    const required = parseInt(docCheck.rows[0].required) || 0;
    const uploaded = parseInt(docActual.rows[0].uploaded) || 0;
    if (required > 0 && uploaded < required) {
      const missing = await query(`
        SELECT label_arabic, label_english FROM client_required_docs 
        WHERE is_required = true AND doc_type NOT IN (
          SELECT description FROM documents WHERE entity_type = 'client' AND entity_id = $1 AND description IS NOT NULL
        ) ORDER BY sort_order
      `, [clientId]);
      const missingLabels = missing.rows.map(r => r.label_arabic || r.label_english).join(', ');
      return res.status(400).json({
        success: false,
        error: `Client must complete all required documents before placing orders. Missing: ${missingLabels}`,
        missingDocuments: missing.rows.map(r => r.label_arabic || r.label_english),
        documentsRequired: required,
        documentsUploaded: uploaded
      });
    }

    const order = await transaction(async (client) => {
      // Check client credit limit
      const clientResult = await client.query(
        'SELECT credit_limit, current_balance FROM clients WHERE id = $1',
        [clientId]
      );
      
      if (clientResult.rows.length === 0) {
        throw new Error('Client not found');
      }
      
      const { credit_limit, current_balance } = clientResult.rows[0];

      // Calculate totals — ALL in tons, price per ton from recipe cost + 16.5% margin
      const PROFIT_MARGIN = 0.165; // 16.5%
      let totalAmount = 0;
      const itemsWithCost = [];
      for (const item of items) {
        const tons = parseFloat(item.quantity) || 0; // quantity is in tons
        const pkg = item.packageSize || 50; // bag size for inventory, default 50kg

        // Get recipe cost per ton
        let costPerTon = 0;
        let pricePerTon = parseFloat(item.unitPrice) || 0;
        try {
          const recipeRes = await client.query(
            `SELECT total_cost, total_quantity_kg FROM feed_recipes WHERE feed_type_id = $1 AND is_active = true ORDER BY version DESC LIMIT 1`,
            [item.feedTypeId]
          );
          if (recipeRes.rows.length > 0) {
            const totalCost = parseFloat(recipeRes.rows[0].total_cost) || 0;
            const totalKg = parseFloat(recipeRes.rows[0].total_quantity_kg) || 1000;
            costPerTon = (totalCost / totalKg) * 1000;
          }
        } catch (e) {
          console.error('Error fetching recipe cost:', e.message);
        }

        // Calculate selling price per ton: cost × (1 + margin) or use provided price
        if (!pricePerTon && costPerTon > 0) {
          pricePerTon = costPerTon * (1 + PROFIT_MARGIN);
        }

        // Total = tons × price per ton
        const itemTotal = tons * pricePerTon;
        totalAmount += itemTotal;

        itemsWithCost.push({
          feedTypeId: item.feedTypeId,
          packageSize: pkg,
          quantity: tons, // stored in tons
          unitPrice: pricePerTon, // EGP per ton
          totalPrice: itemTotal,
          costPerTon,
          costPrice: costPerTon * tons
        });
      }

      const finalAmount = totalAmount - (discountAmount || 0) + (taxAmount || 0);

      // Check if order exceeds 80% of client credit limit
      let orderStatus = 'pending_approval';
      let creditNote = null;
      if (credit_limit > 0 && (parseFloat(current_balance) + finalAmount) > (credit_limit * 0.8)) {
        // Flag for admin approval but still allow creation
        orderStatus = 'pending_approval';
        creditNote = `Credit limit warning: Order exceeds 80% of limit (${((parseFloat(current_balance) + finalAmount) / credit_limit * 100).toFixed(1)}%). Admin approval required.`;
      }
      
      // Generate order number
      const countResult = await client.query("SELECT COUNT(*) + 1 as next_num FROM sales_orders");
      const orderNumber = `SO-${String(countResult.rows[0].next_num).padStart(5, '0')}`;
      
      // Append credit limit warning to notes if triggered
      const finalNotes = creditNote 
        ? (notes ? `${notes}\n${creditNote}` : creditNote)
        : notes;

      // Create order
      const orderResult = await client.query(
        `INSERT INTO sales_orders (order_number, client_id, status, total_amount, discount_amount, tax_amount, final_amount, delivery_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [orderNumber, clientId, orderStatus, totalAmount, discountAmount, taxAmount, finalAmount, deliveryDate, finalNotes, createdBy]
      );
      
      const newOrder = orderResult.rows[0];
      
      // Create order items (quantity in tons, prices per ton in EGP)
      for (const item of itemsWithCost) {
        const bags = Math.ceil((item.quantity * 1000) / item.packageSize);
        await client.query(
          `INSERT INTO sales_order_items (order_id, feed_type_id, package_size, quantity, unit_price, total_price, cost_price, total_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [newOrder.id, item.feedTypeId, item.packageSize, item.quantity, item.unitPrice, item.totalPrice, item.costPerTon, item.costPrice]
        );
      }
      
      return newOrder;
    });
    
    res.status(201).json({ success: true, order, message: 'Order created successfully' });

    logActivity({
      userId: createdBy, action: 'create', module: 'sales',
      description: `Created sales order ${order.order_number}`,
      entityId: order.id, entityType: 'sales_order',
      amount: parseFloat(order.final_amount)
    });

    notifyRole('sales_manager', {
      module: 'sales', type: 'order_pending_approval',
      title: `Order ${order.order_number} Pending Approval`,
      message: `New sales order ${order.order_number} for client #${clientId} needs approval`,
      referenceId: order.id, referenceType: 'sales_order'
    });
    notifyRole('owner', {
      module: 'sales', type: 'order_pending_approval',
      title: `Order ${order.order_number} Pending Approval`,
      message: `New sales order ${order.order_number} created, pending manager approval`,
      referenceId: order.id, referenceType: 'sales_order'
    });
    notifyRole('admin', {
      module: 'sales', type: 'order_pending_approval',
      title: `Order ${order.order_number} Pending Approval`,
      message: `New sales order ${order.order_number} needs approval`,
      referenceId: order.id, referenceType: 'sales_order'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve order (Sales Manager only)
router.put('/orders/:id/approve', authenticate, authorize(...managerRoles), async (req, res) => {
  const orderId = req.params.id;
  const approvedBy = req.user.id;

  try {
    const result = await transaction(async (client) => {
      // 1. Update order status
      const orderResult = await client.query(
        `UPDATE sales_orders
         SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND status = 'pending_approval'
         RETURNING *`,
        [approvedBy, orderId]
      );

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or not pending approval');
      }

      const order = orderResult.rows[0];

      // 2. Check if invoice already exists
      const existingInvoice = await client.query(
        'SELECT id FROM invoices WHERE order_id = $1',
        [orderId]
      );

      let invoice = null;
      if (existingInvoice.rows.length === 0) {
        // Get client payment terms for due date calculation
        const clientRes = await client.query(
          'SELECT payment_terms FROM clients WHERE id = $1',
          [order.client_id]
        );
        const paymentTerms = clientRes.rows[0]?.payment_terms || 'cash';
        // Extract number of days from terms like "21 days", "30 days", "cash"
        const daysMatch = paymentTerms.match(/(\d+)/);
        const creditDays = daysMatch ? parseInt(daysMatch[1]) : 0;

        // Generate invoice number
        const invNumResult = await client.query(
          "SELECT COUNT(*) + 1 as next_num FROM invoices"
        );
        const invoiceNumber = `INV-${String(invNumResult.rows[0].next_num).padStart(5, '0')}`;

        // Create invoice with due date based on CURRENT_DATE + credit days (PG handles timezone)
        const invResult = await client.query(
          `INSERT INTO invoices (invoice_number, order_id, client_id, amount, balance_due, due_date, notes, created_by, created_at)
           VALUES ($1, $2, $3, $4, $4, CURRENT_DATE + INTERVAL '${creditDays} days', $5, $6, CURRENT_DATE) RETURNING *`,
          [invoiceNumber, orderId, order.client_id, order.final_amount, `Auto-generated from ${order.order_number}`, approvedBy]
        );
        invoice = invResult.rows[0];

        // Create invoice items
        const invItemsResult = await client.query(
          `SELECT soi.*, ft.name_arabic as feed_name
           FROM sales_order_items soi
           JOIN feed_types ft ON soi.feed_type_id = ft.id
           WHERE soi.order_id = $1`,
          [orderId]
        );
        for (const item of invItemsResult.rows) {
          await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [invoice.id, `${item.feed_name} (${item.package_size}kg)`, item.quantity, item.unit_price, item.total_price]
          );
        }

        // Update client balance
        await client.query(
          `UPDATE clients SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [parseFloat(order.final_amount), order.client_id]
        );

        // Create client expected payment
        await client.query(
          `INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status)
           VALUES ($1, $2, CURRENT_DATE + INTERVAL '${creditDays} days', $3, 'expected')`,
          [order.client_id, order.final_amount, `Invoice ${invoiceNumber}`]
        );
      }

      // Get order items for production auto-creation (always)
      const orderItemsResult = await client.query(
        'SELECT * FROM sales_order_items WHERE order_id = $1',
        [orderId]
      );

      return { order, invoice, items: orderItemsResult.rows };
    });

    const { order, invoice, items: orderItems } = result;

    // Create journal entry outside transaction (non-critical)
    if (invoice) {
      try {
        const clientRes = await query('SELECT name_arabic FROM clients WHERE id = $1', [order.client_id]);
        await journalInvoiceCreated({ ...invoice, client_name: clientRes.rows[0]?.name_arabic || '' });
      } catch (e) {
        console.error('[JOURNAL] Failed to create entry for invoice:', e.message);
      }
    }

    // Log activity
    logActivity({
      userId: approvedBy, action: 'approve', module: 'sales',
      description: `Approved sales order ${order.order_number}` + (invoice ? ` and created invoice ${invoice.invoice_number}` : ''),
      entityId: order.id, entityType: 'sales_order',
      oldStatus: 'pending_approval', newStatus: 'approved',
      amount: parseFloat(order.final_amount)
    });

    // Auto-create production orders for each feed type in the order
    try {
      for (const item of orderItems) {
        const existingProdQuery = await query(
          `SELECT id FROM production_orders WHERE notes ILIKE $1 AND status NOT IN ('completed','cancelled')`,
          [`%${order.order_number}%`]
        );
        if (existingProdQuery.rows.length === 0) {
          const recipeRes = await query(
            'SELECT id FROM feed_recipes WHERE feed_type_id = $1 AND is_active = true LIMIT 1',
            [item.feed_type_id]
          );
          if (recipeRes.rows.length > 0) {
            const totalKg = item.quantity * 1000; // quantity is in tons
            const pkgSize = item.package_size || 50;
            const numBags = Math.ceil(totalKg / pkgSize);
            // Calculate estimated cost from recipe
            const recipeCostRes = await query(
              'SELECT total_cost, total_quantity_kg FROM feed_recipes WHERE id = $1',
              [recipeRes.rows[0].id]
            );
            let estCost = 0;
            if (recipeCostRes.rows.length > 0) {
              const rc = parseFloat(recipeCostRes.rows[0].total_cost) || 0;
              const rq = parseFloat(recipeCostRes.rows[0].total_quantity_kg) || 1000;
              estCost = (rc / rq) * totalKg;
            }
            await query(
              `INSERT INTO production_orders (order_number, feed_type_id, recipe_id, quantity_kg, package_size, number_of_bags, batch_number, status, production_date, notes, created_by, actual_cost)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', CURRENT_DATE, $8, $9, $10)`,
              [
                `PROD-${order.order_number}-${item.feed_type_id}`,
                item.feed_type_id,
                recipeRes.rows[0].id,
                totalKg,
                pkgSize,
                numBags,
                `BATCH-${order.order_number}`,
                `Auto from ${order.order_number}`,
                approvedBy,
                estCost
              ]
            );
          }
        }
      }
    } catch (prodErr) {
      console.error('[PRODUCTION] Failed to auto-create from sales order:', prodErr.message);
    }

    res.json({
      success: true,
      order,
      invoice,
      message: invoice ? 'Order approved and invoice created' : 'Order approved (invoice already exists)'
    });

    notifyRole('sales_rep', {
      module: 'sales', type: 'order_approved',
      title: `Order ${order.order_number} Approved`,
      message: `Sales order ${order.order_number} has been approved${invoice ? ` and invoiced ${invoice.invoice_number}` : ''}`,
      referenceId: order.id, referenceType: 'sales_order'
    });
  } catch (error) {
    console.error('Error approving order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject order (Sales Manager only)
router.put('/orders/:id/reject', authenticate, authorize(...managerRoles), async (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Rejection reason is required' });
  }
  
  try {
    const result = await query(
      `UPDATE sales_orders 
       SET status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND status = 'pending_approval'
       RETURNING *`,
      [reason, orderId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found or not pending approval' });
    }
    
    res.json({ success: true, order: result.rows[0], message: 'Order rejected' });
  } catch (error) {
    console.error('Error rejecting order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
router.put('/orders/:id/status', authenticate, authorize(...salesRoles), async (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  const validStatuses = ['pending_approval', 'approved', 'confirmed', 'processing', 'in_transit', 'delivered', 'cancelled'];
  
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  
  try {
    const result = await transaction(async (client) => {
      // Update order status
      const orderResult = await client.query(
        'UPDATE sales_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [status, orderId]
      );
      
      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }
      
      const order = orderResult.rows[0];
      
        // If status is delivered, deduct from finished goods inventory (FIFO)
        // Quantity is in tons; convert to kg (1 ton = 1000 kg)
        // We sell by tons but deduct from inventory by bag sizes (50kg default fallback)
        if (status === 'delivered') {
          const itemsResult = await client.query(
            'SELECT * FROM sales_order_items WHERE order_id = $1',
            [orderId]
          );

          for (const item of itemsResult.rows) {
            const tons = parseFloat(item.quantity) || 0;
            const kgToDeduct = tons * 1000; // convert tons to kg
            let remainingKg = kgToDeduct;
            const preferredPkg = item.package_size || 50;

            // Try preferred package size first, then fall back to any available
            const pkgSizes = [preferredPkg, 50, 25, 10];
            let foundSome = false;

            for (const pkgSize of pkgSizes) {
              if (remainingKg <= 0) break;

              const batchesResult = await client.query(
                `SELECT id, quantity_kg, number_of_bags
                 FROM finished_goods
                 WHERE feed_type_id = $1 AND package_size = $2 AND status = 'available' AND quantity_kg > 0
                 ORDER BY created_at ASC`,
                [item.feed_type_id, pkgSize]
              );

              if (batchesResult.rows.length === 0) continue;

              for (const batch of batchesResult.rows) {
                if (remainingKg <= 0) break;

                const batchQty = parseFloat(batch.quantity_kg);
                const deductQty = Math.min(batchQty, remainingKg);
                const deductBags = Math.floor(deductQty / pkgSize);
                const actualDeductKg = deductBags * pkgSize;

                if (actualDeductKg <= 0) continue;

                foundSome = true;

                await client.query(
                  `UPDATE finished_goods
                   SET quantity_kg = quantity_kg - $1,
                       number_of_bags = number_of_bags - $2,
                       status = CASE WHEN (quantity_kg - $1) <= 0 THEN 'depleted' ELSE status END,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE id = $3`,
                  [actualDeductKg, deductBags, batch.id]
                );

                await client.query(
                  `INSERT INTO inventory_transactions (raw_material_id, transaction_type, reference_type, reference_id, quantity, unit_price, total_cost, notes, created_by)
                   VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $7)`,
                  [item.feed_type_id, 'sale', 'fg_sale', batch.id, -actualDeductKg, `Sale order ${order.order_number}`, order.created_by]
                );

                remainingKg -= actualDeductKg;
              }
            }

            if (!foundSome) {
              throw new Error(`No available finished goods inventory for feed type ${item.feed_type_id}`);
            }

            if (remainingKg > 10) {
              console.warn(`[INVENTORY] Shortfall for order ${order.order_number}: ${remainingKg}kg could not be fulfilled from FG inventory (within 10kg tolerance)`);
            }
          }
        
        // Update client last_order_date
        await client.query(
          'UPDATE clients SET last_order_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [order.client_id]
        );
      }
      
      return order;
    });
    
    res.json({ success: true, order: result, message: 'Order status updated' });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// INVOICES
// ============================================

// Get invoices with role-based filtering
router.get('/invoices', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status, clientId, page = 1, limit = 20 } = req.query;
  
  try {
    let sql = `
      SELECT i.*, c.name_arabic as client_name, so.order_number
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN sales_orders so ON i.order_id = so.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Role-based filtering
    if (userRole === 'sales_rep') {
      sql += ` AND c.assigned_to = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    if (status) {
      sql += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (clientId) {
      sql += ` AND i.client_id = $${paramIndex}`;
      params.push(clientId);
      paramIndex++;
    }
    
    sql += ` ORDER BY i.issue_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);
    
    const result = await query(sql, params);
    res.json({ success: true, invoices: result.rows });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create invoice from order
router.post('/invoices', authenticate, authorize(...managerRoles), async (req, res) => {
  const { orderId, dueDate, notes } = req.body;
  const createdBy = req.user.id;
  
  if (!orderId) {
    return res.status(400).json({ success: false, error: 'Order ID is required' });
  }
  
  try {
    const invoice = await transaction(async (client) => {
      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM sales_orders WHERE id = $1 AND status IN (\'approved\', \'confirmed\', \'delivered\')',
        [orderId]
      );
      
      if (orderResult.rows.length === 0) {
        throw new Error('Order not found or not approved');
      }
      
      const order = orderResult.rows[0];
      
      // Check if invoice already exists
      const existingInvoice = await client.query(
        'SELECT id FROM invoices WHERE order_id = $1',
        [orderId]
      );
      
      if (existingInvoice.rows.length > 0) {
        throw new Error('Invoice already exists for this order');
      }
      
      // Generate invoice number
      const invNumberResult = await client.query(
        "SELECT COUNT(*) + 1 as next_num FROM invoices"
      );
      const invoiceNumber = `INV-${String(invNumberResult.rows[0].next_num).padStart(5, '0')}`;
      
      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (invoice_number, order_id, client_id, amount, balance_due, due_date, notes, created_by)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7) RETURNING *`,
        [invoiceNumber, orderId, order.client_id, order.final_amount, dueDate, notes, createdBy]
      );
      
      // Get order items for invoice items
      const itemsResult = await client.query(
        `SELECT soi.*, ft.name_arabic as feed_name 
         FROM sales_order_items soi
         JOIN feed_types ft ON soi.feed_type_id = ft.id
         WHERE soi.order_id = $1`,
        [orderId]
      );
      
      // Create invoice items
      for (const item of itemsResult.rows) {
        await client.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            invoiceResult.rows[0].id,
            `${item.feed_name} (${item.package_size}kg)`,
            item.quantity,
            item.unit_price,
            item.total_price
          ]
        );
      }
      
      return invoiceResult.rows[0];
    });
    
    res.status(201).json({ success: true, invoice, message: 'Invoice created successfully' });

    // Update client balance
    try {
      await query(
        `UPDATE clients SET current_balance = current_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [parseFloat(invoice.amount), invoice.client_id]
      );
    } catch (e) { console.error('[INVOICE] Failed to update client balance:', e.message); }

    // Create client expected payment
    try {
      const clientRes = await query('SELECT payment_terms FROM clients WHERE id = $1', [invoice.client_id]);
      const paymentTerms = clientRes.rows[0]?.payment_terms || 'cash';
      const daysMatch = paymentTerms.match(/(\d+)/);
      const creditDays = daysMatch ? parseInt(daysMatch[1]) : 0;
      await query(
        `INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status)
         VALUES ($1, $2, CURRENT_DATE + INTERVAL '${creditDays} days', $3, 'expected')`,
        [invoice.client_id, invoice.amount, `Invoice ${invoice.invoice_number}`]
      );
    } catch (e) { console.error('[INVOICE] Failed to create expected payment:', e.message); }

    // Create journal entry
    try {
      const clientRes = await query('SELECT name_arabic FROM clients WHERE id = $1', [invoice.client_id]);
      await journalInvoiceCreated({ ...invoice, client_name: clientRes.rows[0]?.name_arabic || '' });
    } catch (e) { console.error('[JOURNAL] Failed to create entry for invoice:', e.message); }

    logActivity({
      userId: createdBy, action: 'create', module: 'sales',
      description: `Created invoice ${invoice.invoice_number} for order ${orderId}`,
      entityId: invoice.id, entityType: 'invoice',
      amount: parseFloat(invoice.amount)
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAYMENTS
// ============================================

// Record payment
router.post('/payments', authenticate, authorize(...salesRoles), async (req, res) => {
  const { clientId, invoiceId, amount, method, date, description } = req.body;
  const collectedBy = req.user.id;
  
  if (!clientId || !amount || !method) {
    return res.status(400).json({ success: false, error: 'Client ID, amount, and method are required' });
  }
  
  const validMethods = ['cash', 'bank_transfer', 'check', 'credit_card'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ success: false, error: 'Invalid payment method' });
  }
  
  try {
    await transaction(async (client) => {
      // Record payment
      await client.query(
        `INSERT INTO client_payment_history (client_id, invoice_id, amount, date, description, method, collected_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [clientId, invoiceId || null, amount, date || new Date(), description, method, collectedBy]
      );

      // Update invoice if provided
      if (invoiceId) {
        await client.query(
          `UPDATE invoices
           SET paid_amount = paid_amount + $1,
               balance_due = GREATEST(balance_due - $1, 0),
               status = CASE
                 WHEN (balance_due - $1) <= 0 THEN 'paid'
                 ELSE 'partial'
               END,
               paid_date = CASE
                 WHEN (balance_due - $1) <= 0 THEN $2
                 ELSE paid_date
               END,
               updated_at = NOW()
           WHERE id = $3`,
          [amount, date || new Date(), invoiceId]
        );
      }

      // Update client balance
      await client.query(
        `UPDATE clients
         SET current_balance = GREATEST(current_balance - $1, 0),
             last_payment_date = CURRENT_DATE,
             updated_at = NOW()
         WHERE id = $2`,
        [amount, clientId]
      );
    });

    res.json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get payments for a client
router.get('/clients/:id/payments', authenticate, authorize(...salesRoles), async (req, res) => {
  const clientId = req.params.id;
  
  try {
    const result = await query(`
      SELECT ph.*, u.name as collected_by_name
      FROM client_payment_history ph
      LEFT JOIN users u ON ph.collected_by = u.id
      WHERE ph.client_id = $1
      ORDER BY ph.date DESC
    `, [clientId]);
    
    res.json({ success: true, payments: result.rows });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REMINDERS
// ============================================

// Get reminders for logged-in sales rep
router.get('/reminders', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { status, clientId } = req.query;
  
  try {
    let sql = `
      SELECT r.*, c.name_arabic as client_name, c.phone as client_phone
      FROM reminders r
      JOIN clients c ON r.client_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    // Role-based filtering
    if (userRole === 'sales_rep') {
      sql += ` AND r.sales_rep_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }
    
    if (status) {
      sql += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (clientId) {
      sql += ` AND r.client_id = $${paramIndex}`;
      params.push(clientId);
      paramIndex++;
    }
    
    sql += ` ORDER BY r.reminder_date ASC`;
    
    const result = await query(sql, params);
    res.json({ success: true, reminders: result.rows });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create reminder
router.post('/reminders', authenticate, authorize(...salesRoles), async (req, res) => {
  const { clientId, title, message, reminderDate, reminderType } = req.body;
  const salesRepId = req.user.id;
  
  if (!clientId || !title || !reminderDate) {
    return res.status(400).json({ success: false, error: 'Client ID, title, and reminder date are required' });
  }
  
  const validTypes = ['payment', 'follow_up', 'order', 'visit', 'call', 'other'];
  
  try {
    // Verify client access
    const clientCheck = await query('SELECT assigned_to FROM clients WHERE id = $1', [clientId]);
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }
    
    // Sales reps can only create reminders for their assigned clients
    if (req.user.role === 'sales_rep' && clientCheck.rows[0].assigned_to !== salesRepId) {
      return res.status(403).json({ success: false, error: 'Client not assigned to you' });
    }
    
    const result = await query(
      `INSERT INTO reminders (client_id, sales_rep_id, title, message, reminder_date, reminder_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [clientId, salesRepId, title, message, reminderDate, reminderType || 'other']
    );
    
    res.status(201).json({ success: true, reminder: result.rows[0], message: 'Reminder created successfully' });
  } catch (error) {
    console.error('Error creating reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update reminder
router.put('/reminders/:id', authenticate, authorize(...salesRoles), async (req, res) => {
  const reminderId = req.params.id;
  const { title, message, reminderDate, reminderType, status } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  try {
    // Check ownership
    const ownershipCheck = await query('SELECT sales_rep_id FROM reminders WHERE id = $1', [reminderId]);
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }
    
    if (userRole === 'sales_rep' && ownershipCheck.rows[0].sales_rep_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const result = await query(
      `UPDATE reminders 
       SET title = COALESCE($1, title),
           message = COALESCE($2, message),
           reminder_date = COALESCE($3, reminder_date),
           reminder_type = COALESCE($4, reminder_type),
           status = COALESCE($5, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, message, reminderDate, reminderType, status, reminderId]
    );
    
    res.json({ success: true, reminder: result.rows[0], message: 'Reminder updated successfully' });
  } catch (error) {
    console.error('Error updating reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark reminder as completed
router.put('/reminders/:id/complete', authenticate, authorize(...salesRoles), async (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.id;
  
  try {
    const result = await query(
      `UPDATE reminders 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (sales_rep_id = $2 OR $3 = ANY(ARRAY['sales_manager', 'admin', 'owner']))
       RETURNING *`,
      [reminderId, userId, req.user.role]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reminder not found or access denied' });
    }
    
    res.json({ success: true, reminder: result.rows[0], message: 'Reminder marked as completed' });
  } catch (error) {
    console.error('Error completing reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send reminder (mark as sent)
router.put('/reminders/:id/send', authenticate, authorize(...salesRoles), async (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.id;
  
  try {
    const result = await query(
      `UPDATE reminders 
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND (sales_rep_id = $2 OR $3 = ANY(ARRAY['sales_manager', 'admin', 'owner']))
       RETURNING *`,
      [reminderId, userId, req.user.role]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reminder not found or access denied' });
    }
    
    res.json({ success: true, reminder: result.rows[0], message: 'Reminder sent successfully' });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete reminder
router.delete('/reminders/:id', authenticate, authorize(...salesRoles), async (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  
  try {
    // Check ownership
    const ownershipCheck = await query('SELECT sales_rep_id FROM reminders WHERE id = $1', [reminderId]);
    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reminder not found' });
    }
    
    if (userRole === 'sales_rep' && ownershipCheck.rows[0].sales_rep_id !== userId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    await query('DELETE FROM reminders WHERE id = $1', [reminderId]);
    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Error deleting reminder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DASHBOARD & STATISTICS
// ============================================

// Get sales dashboard statistics
router.get('/dashboard-stats', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    let stats = {};

    if (userRole === 'sales_rep') {
      // Sales rep sees only their own data
      const myClients = await query(
        `SELECT COUNT(*) as count FROM clients WHERE assigned_to = $1 AND is_active = true`,
        [userId]
      );

      const myOrders = await query(
        `SELECT COUNT(*) as count FROM sales_orders WHERE created_by = $1`,
        [userId]
      );

      const myRevenue = await query(
        `SELECT COALESCE(SUM(final_amount), 0) as total
         FROM sales_orders WHERE created_by = $1 AND status = 'delivered'`,
        [userId]
      );

      const pendingApprovals = await query(
        `SELECT COUNT(*) as count FROM sales_orders
         WHERE status = 'pending_approval' AND created_by = $1`,
        [userId]
      );

      const amountDue = await query(
        `SELECT COALESCE(SUM(i.balance_due), 0) as total
         FROM invoices i
         JOIN sales_orders so ON so.id = i.order_id
         WHERE so.created_by = $1 AND i.status != 'paid'`,
        [userId]
      );

      let upcomingRemindersCount = 0;
      try {
        const upcomingReminders = await query(
          `SELECT COUNT(*) as count FROM reminders
           WHERE status = 'pending' AND reminder_date <= CURRENT_DATE + INTERVAL '7 days'
           AND sales_rep_id = $1`,
          [userId]
        );
        upcomingRemindersCount = parseInt(upcomingReminders.rows[0].count);
      } catch (e) {
        console.log('Reminders table not available:', e.message);
      }

      let myActiveOrders = 0;
      let myDeliveredOrders = 0;
      try {
        const activeRes = await query(
          `SELECT COUNT(*) as count FROM sales_orders WHERE created_by = $1 AND status IN ('approved','confirmed','processing','in_transit')`,
          [userId]
        );
        myActiveOrders = parseInt(activeRes.rows[0].count);
        const deliveredRes = await query(
          `SELECT COUNT(*) as count FROM sales_orders WHERE created_by = $1 AND status = 'delivered'`,
          [userId]
        );
        myDeliveredOrders = parseInt(deliveredRes.rows[0].count);
      } catch (e) {}

      stats = {
        totalClients: parseInt(myClients.rows[0].count),
        totalOrders: parseInt(myOrders.rows[0].count),
        activeOrders: myActiveOrders,
        deliveredOrders: myDeliveredOrders,
        totalRevenue: parseFloat(myRevenue.rows[0].total),
        pendingApprovals: parseInt(pendingApprovals.rows[0].count),
        totalDue: parseFloat(amountDue.rows[0].total),
        unpaidInvoices: 0,
        upcomingReminders: upcomingRemindersCount
      };
    } else {
      // Manager / owner sees all data
      const totalClients = await query(
        `SELECT COUNT(*) as count FROM clients WHERE is_active = true`
      );

      const totalOrders = await query(
        `SELECT COUNT(*) as count FROM sales_orders`
      );

      const activeOrders = await query(
        `SELECT COUNT(*) as count FROM sales_orders WHERE status IN ('approved','confirmed','processing','in_transit')`
      );

      const deliveredOrders = await query(
        `SELECT COUNT(*) as count FROM sales_orders WHERE status = 'delivered'`
      );

      const totalRevenue = await query(
        `SELECT COALESCE(SUM(final_amount), 0) as total
         FROM sales_orders`
      );

      const pendingApprovals = await query(
        `SELECT COUNT(*) as count FROM sales_orders WHERE status = 'pending_approval'`
      );

      const totalDue = await query(
        `SELECT COALESCE(SUM(balance_due), 0) as total
         FROM invoices WHERE status != 'paid'`
      );

      const unpaidInvoices = await query(
        `SELECT COUNT(*) as count FROM invoices WHERE status != 'paid'`
      );

      let upcomingRemindersCount = 0;
      try {
        const upcomingReminders = await query(
          `SELECT COUNT(*) as count FROM reminders
           WHERE status = 'pending' AND reminder_date <= CURRENT_DATE + INTERVAL '7 days'`
        );
        upcomingRemindersCount = parseInt(upcomingReminders.rows[0].count);
      } catch (e) {
        console.log('Reminders table not available:', e.message);
      }

      stats = {
        totalClients: parseInt(totalClients.rows[0].count),
        totalOrders: parseInt(totalOrders.rows[0].count),
        activeOrders: parseInt(activeOrders.rows[0].count),
        deliveredOrders: parseInt(deliveredOrders.rows[0].count),
        totalRevenue: parseFloat(totalRevenue.rows[0].total),
        pendingApprovals: parseInt(pendingApprovals.rows[0].count),
        totalDue: parseFloat(totalDue.rows[0].total),
        unpaidInvoices: parseInt(unpaidInvoices.rows[0].count),
        upcomingReminders: upcomingRemindersCount
      };
    }

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get sales performance by rep (Manager only)
router.get('/performance-by-rep', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  try {
    const result = await query(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.department,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT so.id) as order_count,
        COALESCE(SUM(so.final_amount), 0) as total_sales,
        COUNT(DISTINCT so.id) FILTER (
          WHERE so.status = 'pending_approval'
        ) as pending_count
      FROM users u
      LEFT JOIN clients c ON c.assigned_to = u.id
        AND c.is_active = true
      LEFT JOIN sales_orders so ON so.created_by = u.id
      WHERE u.role = 'sales_rep'
      AND u.is_active = true
      GROUP BY u.id, u.name, u.email, u.department
      ORDER BY total_sales DESC
    `);

    res.json({ success: true, performance: result.rows });
  } catch (error) {
    console.error('Error fetching performance stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// RED FLAGS - Delayed payments & credit alerts
// ============================================

router.get('/red-flags', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Real red flags: clients with invoices past due date that are NOT paid
    let sql = `
      WITH overdue_invoices AS (
        SELECT
          i.client_id,
          COUNT(*) as overdue_count,
          COALESCE(SUM(i.balance_due), 0) as overdue_amount,
          MAX(i.due_date) as oldest_due_date,
          MIN(CURRENT_DATE - i.due_date) as days_overdue_min,
          MAX(CURRENT_DATE - i.due_date) as days_overdue_max
        FROM invoices i
        WHERE i.due_date < CURRENT_DATE
          AND i.status IN ('pending', 'partial', 'overdue')
        GROUP BY i.client_id
      ),
      client_flags AS (
        SELECT
          c.id as client_id,
          c.name_arabic as client_name,
          c.name_english as client_name_en,
          c.code,
          c.city,
          c.payment_terms,
          c.credit_limit,
          c.current_balance,
          c.last_order_date,
          c.last_payment_date,
          c.assigned_to,
          COALESCE(oi.overdue_amount, 0) as overdue_amount,
          COALESCE(oi.overdue_count, 0) as overdue_invoice_count,
          oi.oldest_due_date,
          COALESCE(oi.days_overdue_min, 0) as days_overdue_min,
          COALESCE(oi.days_overdue_max, 0) as days_overdue_max,
          CASE
            WHEN COALESCE(oi.overdue_amount, 0) >= c.credit_limit * 0.8 THEN 'critical'
            WHEN COALESCE(oi.overdue_amount, 0) >= c.credit_limit * 0.5 THEN 'high'
            WHEN COALESCE(oi.overdue_count, 0) > 0 THEN 'warning'
            ELSE 'none'
          END as severity,
          CASE
            WHEN COALESCE(oi.overdue_amount, 0) >= c.credit_limit * 0.8 THEN
              'متأخر: ج.م ' || TO_CHAR(COALESCE(oi.overdue_amount, 0) / 100, 'FM999,999,999.00') || ' (' || COALESCE(oi.days_overdue_max, 0) || ' يوم تأخير)'
            WHEN COALESCE(oi.overdue_amount, 0) >= c.credit_limit * 0.5 THEN
              'متأخر: ج.م ' || TO_CHAR(COALESCE(oi.overdue_amount, 0) / 100, 'FM999,999,999.00') || ' (' || COALESCE(oi.days_overdue_max, 0) || ' يوم تأخير)'
            WHEN COALESCE(oi.overdue_count, 0) > 0 THEN
              COALESCE(oi.overdue_count, 0) || ' فاتورة متأخرة: ج.م ' || TO_CHAR(COALESCE(oi.overdue_amount, 0) / 100, 'FM999,999,999.00')
            ELSE 'لا توجد مشاكل'
          END as message
        FROM clients c
        LEFT JOIN overdue_invoices oi ON oi.client_id = c.id
        WHERE c.is_active = true
    `;
    const params = [];
    let paramIdx = 1;

    if (userRole === 'sales_rep') {
      sql += ` AND c.assigned_to = $${paramIdx}`;
      params.push(userId);
      paramIdx++;
    }

    sql += `
      )
      SELECT * FROM client_flags WHERE severity != 'none' ORDER BY
        CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'warning' THEN 3 ELSE 5 END,
        overdue_amount DESC
    `;

    const result = await query(sql, params);
    res.json({ success: true, redFlags: result.rows });
  } catch (error) {
    console.error('Error fetching red flags:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CLIENT ORDERING PATTERNS
// ============================================

router.get('/client-patterns/:id?', authenticate, authorize(...salesRoles), async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const clientId = req.params.id;

  try {
    let clientSql = `
      SELECT id, name_arabic, assigned_to
      FROM clients
      WHERE is_active = true
    `;
    const clientParams = [];

    if (clientId) {
      clientSql += ` AND id = $1`;
      clientParams.push(clientId);
    }
    if (userRole === 'sales_rep') {
      clientSql += clientParams.length > 0 ? ` AND assigned_to = $${clientParams.length + 1}` : ` AND assigned_to = $1`;
      clientParams.push(userId);
    }

    const clientsResult = await query(clientSql, clientParams);
    const patterns = {};

    for (const client of clientsResult.rows) {
      // Get order history
      const ordersResult = await query(`
        SELECT so.*, soi.feed_type_id, ft.name_arabic as feed_name, soi.quantity, soi.package_size
        FROM sales_orders so
        JOIN sales_order_items soi ON soi.order_id = so.id
        JOIN feed_types ft ON ft.id = soi.feed_type_id
        WHERE so.client_id = $1
        ORDER BY so.created_at DESC
        LIMIT 20
      `, [client.id]);

      const orders = ordersResult.rows;
      if (orders.length === 0) {
        patterns[client.id] = {
          clientId: client.id,
          clientName: client.name_arabic,
          totalOrders: 0,
          hasPattern: false
        };
        continue;
      }

      // Find most ordered feed type
      const feedTypeCounts = {};
      let totalQuantity = 0;
      let totalValue = 0;
      for (const order of orders) {
        const key = order.feed_name || 'Unknown';
        feedTypeCounts[key] = (feedTypeCounts[key] || 0) + parseInt(order.quantity || 0);
        totalQuantity += parseInt(order.quantity || 0);
        totalValue += parseFloat(order.final_amount || 0);
      }
      const usualFeedType = Object.entries(feedTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';

      // Calculate average order value
      const distinctOrders = [...new Map(orders.map(o => [o.id, o])).values()];
      const avgOrderValue = distinctOrders.length > 0
        ? distinctOrders.reduce((s, o) => s + parseFloat(o.final_amount || 0), 0) / distinctOrders.length / 100
        : 0;

      // Average quantity per order
      const avgQuantity = distinctOrders.length > 0
        ? Math.round(totalQuantity / distinctOrders.length)
        : 0;

      // Order frequency (days between orders)
      let avgOrderFrequency = null;
      if (distinctOrders.length >= 2) {
        const dates = distinctOrders.map(o => new Date(o.created_at)).sort((a, b) => a - b);
        let totalDays = 0;
        for (let i = 1; i < dates.length; i++) {
          totalDays += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
        }
        avgOrderFrequency = Math.round(totalDays / (dates.length - 1));
      }

      // Last order date
      const lastOrderDate = distinctOrders[0]?.created_at;

      // Days since last order
      const daysSinceLastOrder = lastOrderDate
        ? Math.round((new Date() - new Date(lastOrderDate)) / (1000 * 60 * 60 * 24))
        : null;

      patterns[client.id] = {
        clientId: client.id,
        clientName: client.name_arabic,
        totalOrders: distinctOrders.length,
        usualFeedType,
        avgQuantity,
        avgOrderValue: Math.round(avgOrderValue),
        avgOrderFrequency,
        lastOrderDate,
        daysSinceLastOrder,
        hasPattern: true,
        atRisk: avgOrderFrequency && daysSinceLastOrder && daysSinceLastOrder > avgOrderFrequency * 1.5
      };
    }

    if (clientId) {
      res.json({ success: true, pattern: patterns[clientId] || null });
    } else {
      res.json({ success: true, patterns });
    }
  } catch (error) {
    console.error('Error fetching client patterns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MANAGER FILTERS - Enhanced clients list
// ============================================

router.get('/clients-filtered', authenticate, authorize('sales_manager', 'admin', 'owner'), async (req, res) => {
  const { city, minDue, maxDue, minQuantity, paymentTerms, hasOverdue, search } = req.query;

  try {
    let sql = `
      SELECT
        c.*,
        u.name as assigned_to_name,
        COALESCE(SUM(i.balance_due) FILTER (WHERE i.status != 'paid'), 0) as total_due,
        COUNT(i.id) FILTER (WHERE i.status = 'overdue') as overdue_count,
        COUNT(so.id) as total_orders,
        COALESCE(SUM(soi.quantity), 0) as total_quantity
      FROM clients c
      LEFT JOIN users u ON c.assigned_to = u.id
      LEFT JOIN invoices i ON i.client_id = c.id
      LEFT JOIN sales_orders so ON so.client_id = c.id
      LEFT JOIN sales_order_items soi ON soi.order_id = so.id
      WHERE c.is_active = true
    `;
    const params = [];
    let paramIdx = 1;

    if (city) {
      sql += ` AND c.city ILIKE $${paramIdx}`;
      params.push(`%${city}%`);
      paramIdx++;
    }
    if (minDue) {
      sql += ` AND (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE client_id = c.id AND status != 'paid') >= $${paramIdx}`;
      params.push(parseFloat(minDue));
      paramIdx++;
    }
    if (maxDue) {
      sql += ` AND (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE client_id = c.id AND status != 'paid') <= $${paramIdx}`;
      params.push(parseFloat(maxDue));
      paramIdx++;
    }
    if (minQuantity) {
      sql += ` AND (SELECT COALESCE(SUM(quantity), 0) FROM sales_order_items soi2 JOIN sales_orders so2 ON so2.id = soi2.order_id WHERE so2.client_id = c.id) >= $${paramIdx}`;
      params.push(parseInt(minQuantity));
      paramIdx++;
    }
    if (paymentTerms) {
      sql += ` AND c.payment_terms ILIKE $${paramIdx}`;
      params.push(`%${paymentTerms}%`);
      paramIdx++;
    }
    if (hasOverdue === 'true') {
      sql += ` AND EXISTS (SELECT 1 FROM invoices i2 WHERE i2.client_id = c.id AND i2.status = 'overdue')`;
    }
    if (search) {
      sql += ` AND (c.name_arabic ILIKE $${paramIdx} OR c.name_english ILIKE $${paramIdx} OR c.code ILIKE $${paramIdx} OR c.city ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    sql += ` GROUP BY c.id, u.name ORDER BY c.name_arabic`;

    const result = await query(sql, params);
    res.json({ success: true, clients: result.rows });
  } catch (error) {
    console.error('Error fetching filtered clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
