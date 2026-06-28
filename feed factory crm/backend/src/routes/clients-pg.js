const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const adminOnly = authorize('owner', 'admin');

// ============================================================
// All routes require authentication
// ============================================================
router.use(authenticate);

// GET clients dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(*) FILTER (WHERE type = 'wholesale') as wholesale_count,
        COUNT(*) FILTER (WHERE type = 'retail') as retail_count,
        COUNT(*) FILTER (WHERE type = 'farm') as farm_count,
        COUNT(*) FILTER (WHERE type = 'distributor') as distributor_count,
        COUNT(*) FILTER (WHERE current_balance > 0) as clients_with_balance,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(SUM(current_balance) FILTER (WHERE status = 'active'), 0) as active_balance
      FROM clients
      WHERE is_active = true
    `);

    // Get overdue invoice count and amount
    const overdueResult = await query(`
      SELECT
        COUNT(DISTINCT c.id) as overdue_clients,
        COUNT(i.id) as overdue_invoice_count,
        COALESCE(SUM(i.balance_due), 0) as overdue_amount
      FROM clients c
      JOIN invoices i ON c.id = i.client_id
      WHERE c.is_active = true
        AND i.status != 'paid'
        AND i.due_date < CURRENT_DATE
        AND i.balance_due > 0
    `);

    // Get total receivables from invoices (matches Finance dashboard)
    const receivablesResult = await query(`
      SELECT COALESCE(SUM(balance_due), 0) as total_receivables
      FROM invoices
      WHERE status IN ('pending', 'partial', 'overdue')
    `);

    res.json({
      ...result.rows[0],
      total_receivables: receivablesResult.rows[0].total_receivables,
      overdue_clients: overdueResult.rows[0].overdue_clients,
      overdue_invoice_count: overdueResult.rows[0].overdue_invoice_count,
      overdue_amount: overdueResult.rows[0].overdue_amount
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET client types
router.get('/types', async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT type
      FROM clients
      WHERE is_active = true
      ORDER BY type
    `);

    res.json(result.rows.map(r => r.type));
  } catch (error) {
    console.error('Error fetching client types:', error);
    res.status(500).json({ error: 'Failed to fetch client types' });
  }
});

// GET all clients with summary
router.get('/', async (req, res) => {
  try {
    const { type, status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryStr = `
      SELECT
        c.id, c.code, c.name_arabic, c.name_english,
        c.type, c.status, c.credit_limit,
        c.current_balance, c.phone, c.payment_terms,
        c.is_active, c.created_at,
        COALESCE(SUM(cl.amount) FILTER (WHERE cl.status = 'pending'), 0) as total_pending,
        COUNT(cl.id) FILTER (WHERE cl.status = 'pending') as pending_count
      FROM clients c
      LEFT JOIN client_liabilities cl ON c.id = cl.client_id
      WHERE c.is_active = true
    `;

    const params = [];
    let paramCount = 0;

    if (type) {
      paramCount++;
      queryStr += ` AND c.type = $${paramCount}`;
      params.push(type);
    }

    if (status) {
      paramCount++;
      queryStr += ` AND c.status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      queryStr += ` AND (c.name_arabic ILIKE $${paramCount} OR c.name_english ILIKE $${paramCount} OR c.code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    queryStr += ` GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) FROM clients c
      WHERE c.is_active = true
      ${type ? 'AND c.type = $1' : ''}
      ${status ? `AND c.status = $${type ? 2 : 1}` : ''}
      ${search ? `AND (c.name_arabic ILIKE $${(type ? 1 : 0) + (status ? 1 : 0) + 1} OR c.name_english ILIKE $${(type ? 1 : 0) + (status ? 1 : 0) + 1} OR c.code ILIKE $${(type ? 1 : 0) + (status ? 1 : 0) + 1})` : ''}
    `;
    const countParams = [];
    if (type) countParams.push(type);
    if (status) countParams.push(status);
    if (search) countParams.push(`%${search}%`);

    const countResult = await query(countQuery, countParams);

    // Add category breakdown for stats
    const catStats = await query(`
      SELECT type, COUNT(*) as count FROM clients WHERE is_active = true GROUP BY type
    `);
    const byCategory = {};
    for (const r of catStats.rows) byCategory[r.type] = parseInt(r.count);

    res.json({
      clients: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      byCategory: Object.entries(byCategory).map(([key, count]) => ({ _id: key, count }))
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET client payment summary
router.get('/:id/payment-summary', async (req, res) => {
  try {
    const { id } = req.params;
    // Get pending invoices
    const invoicesResult = await query(
      `SELECT i.*, COUNT(ii.id) as item_count
       FROM invoices i LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.client_id = $1 AND i.status != 'paid'
       GROUP BY i.id ORDER BY i.created_at DESC`,
      [id]
    );
    // Get client info
    const clientResult = await query('SELECT * FROM clients WHERE id = $1', [id]);
    res.json({
      totalReceivables: invoicesResult.rows.reduce((s, i) => s + parseFloat(i.balance_due || 0), 0),
      overdueAmount: invoicesResult.rows.filter(i => new Date(i.due_date) < new Date()).reduce((s, i) => s + parseFloat(i.balance_due || 0), 0),
      pendingInvoices: invoicesResult.rows,
      recentPayments: [],
      client: clientResult.rows[0] || {}
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    res.status(500).json({ error: 'Failed to fetch payment summary' });
  }
});

// POST record payment — applies payment to oldest pending invoices
router.post('/:id/record-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, description, paymentMethod, notes } = req.body;
    if (!amount || !date) {
      return res.status(400).json({ error: 'Amount and date are required' });
    }
    // Normalize payment method to DB-accepted values
    const methodMap = { 'bank': 'bank_transfer', 'card': 'credit_card', 'cheque': 'check', 'check': 'check' };
    const normalizedMethod = methodMap[paymentMethod] || paymentMethod || 'cash';
    const payAmount = parseFloat(amount);
    const result = await transaction(async (client) => {
      // Insert payment record
      const payResult = await client.query(
        `INSERT INTO client_payment_history (client_id, amount, date, description, method)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [id, payAmount, date, description || 'Payment received', normalizedMethod]
      );
      // Update client balance
      await client.query(
        `UPDATE clients SET current_balance = GREATEST(current_balance - $1, 0), updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [payAmount, id]
      );
      // Apply payment to oldest pending invoices
      let remaining = payAmount;
      const pendingInv = await client.query(
        `SELECT id, amount, paid_amount, balance_due FROM invoices
         WHERE client_id = $1 AND status IN ('pending','partial') AND balance_due > 0
         ORDER BY due_date ASC, id ASC`,
        [id]
      );
      for (const inv of pendingInv.rows) {
        if (remaining <= 0) break;
        const invBalance = parseFloat(inv.balance_due);
        const invPaid = parseFloat(inv.paid_amount || 0);
        const invAmount = parseFloat(inv.amount);
        if (remaining >= invBalance) {
          // Fully pay this invoice
          remaining -= invBalance;
          await client.query(
            `UPDATE invoices SET status = 'paid', paid_amount = $1, balance_due = 0, paid_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [invAmount, date, inv.id]
          );
        } else {
          // Partial payment
          const newPaid = invPaid + remaining;
          const newBalance = invAmount - newPaid;
          await client.query(
            `UPDATE invoices SET status = 'partial', paid_amount = $1, balance_due = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newPaid, Math.max(0, newBalance), inv.id]
          );
          remaining = 0;
        }
      }
      // Apply remaining payment to oldest pending liabilities
      if (remaining > 0) {
        const pendingLiab = await client.query(
          `SELECT id, amount, paid_amount, remaining_amount FROM client_liabilities
           WHERE client_id = $1 AND status IN ('pending','partial') AND remaining_amount > 0
           ORDER BY due_date ASC, id ASC`,
          [id]
        );
        for (const liab of pendingLiab.rows) {
          if (remaining <= 0) break;
          const liabRemaining = parseFloat(liab.remaining_amount || liab.amount);
          const liabPaid = parseFloat(liab.paid_amount || 0);
          const liabAmount = parseFloat(liab.amount);
          if (remaining >= liabRemaining) {
            // Fully pay this liability
            remaining -= liabRemaining;
            const newPaid = liabPaid + liabRemaining;
            await client.query(
              `UPDATE client_liabilities SET status = 'paid', paid_amount = $1, remaining_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [newPaid, liab.id]
            );
          } else {
            // Partial payment
            const newPaid = liabPaid + remaining;
            const newRemaining = liabAmount - newPaid;
            await client.query(
              `UPDATE client_liabilities SET status = 'partial', paid_amount = $1, remaining_amount = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
              [newPaid, Math.max(0, newRemaining), liab.id]
            );
            remaining = 0;
          }
        }
      }
      return payResult.rows[0];
    });
    res.json({ success: true, payment: result, message: 'Payment recorded and applied to invoices', receiptNumber: `PAY-${String(result.id).padStart(5, '0')}` });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// POST record payment (older endpoint, same logic)
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, description, method } = req.body;

    if (!amount || !date) {
      return res.status(400).json({ error: 'Amount and date are required' });
    }
    // Normalize payment method to DB-accepted values
    const methodMap = { 'bank': 'bank_transfer', 'card': 'credit_card', 'cheque': 'check', 'check': 'check' };
    const normalizedMethod = methodMap[method] || method || 'cash';
    const payAmount = parseFloat(amount);

    const result = await transaction(async (client) => {
      // Insert payment
      const payResult = await client.query(`
        INSERT INTO client_payment_history
        (client_id, amount, date, description, method)
        VALUES ($1, $2, $3, $4, $5) RETURNING id
      `, [id, payAmount, date, description, normalizedMethod]);

      // Update client balance
      await client.query(`
        UPDATE clients
        SET current_balance = GREATEST(current_balance - $1, 0),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [payAmount, id]);

      // Apply payment to oldest pending invoices
      let remaining = payAmount;
      const pendingInv = await client.query(
        `SELECT id, amount, paid_amount, balance_due FROM invoices
         WHERE client_id = $1 AND status IN ('pending','partial') AND balance_due > 0
         ORDER BY due_date ASC, id ASC`,
        [id]
      );
      for (const inv of pendingInv.rows) {
        if (remaining <= 0) break;
        const invBalance = parseFloat(inv.balance_due);
        const invPaid = parseFloat(inv.paid_amount || 0);
        const invAmount = parseFloat(inv.amount);
        if (remaining >= invBalance) {
          remaining -= invBalance;
          await client.query(
            `UPDATE invoices SET status = 'paid', paid_amount = $1, balance_due = 0, paid_date = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [invAmount, date, inv.id]
          );
        } else {
          const newPaid = invPaid + remaining;
          const newBalance = invAmount - newPaid;
          await client.query(
            `UPDATE invoices SET status = 'partial', paid_amount = $1, balance_due = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
            [newPaid, Math.max(0, newBalance), inv.id]
          );
          remaining = 0;
        }
      }
      // Apply remaining payment to oldest pending liabilities
      if (remaining > 0) {
        const pendingLiab = await client.query(
          `SELECT id, amount, paid_amount, remaining_amount FROM client_liabilities
           WHERE client_id = $1 AND status IN ('pending','partial') AND remaining_amount > 0
           ORDER BY due_date ASC, id ASC`,
          [id]
        );
        for (const liab of pendingLiab.rows) {
          if (remaining <= 0) break;
          const liabRemaining = parseFloat(liab.remaining_amount || liab.amount);
          const liabPaid = parseFloat(liab.paid_amount || 0);
          const liabAmount = parseFloat(liab.amount);
          if (remaining >= liabRemaining) {
            remaining -= liabRemaining;
            const newPaid = liabPaid + liabRemaining;
            await client.query(
              `UPDATE client_liabilities SET status = 'paid', paid_amount = $1, remaining_amount = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [newPaid, liab.id]
            );
          } else {
            const newPaid = liabPaid + remaining;
            const newRemaining = liabAmount - newPaid;
            await client.query(
              `UPDATE client_liabilities SET status = 'partial', paid_amount = $1, remaining_amount = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
              [newPaid, Math.max(0, newRemaining), liab.id]
            );
            remaining = 0;
          }
        }
      }

      // Return updated client
      const clientResult = await client.query(
        'SELECT * FROM clients WHERE id = $1',
        [id]
      );

      return { payment: payResult.rows[0], client: clientResult.rows[0] };
    });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      client: result.client,
      payment: result.payment,
      receiptNumber: `PAY-${String(result.payment.id).padStart(5, '0')}`
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// GET client full account details (orders, invoices, payments)
router.get('/:id/account', async (req, res) => {
  try {
    const { id } = req.params;

    // Get client info
    const clientResult = await query(`SELECT * FROM clients WHERE id = $1`, [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const client = clientResult.rows[0];

    // Get orders
    const ordersResult = await query(
      `SELECT so.*, COUNT(soi.id) as item_count
       FROM sales_orders so
       LEFT JOIN sales_order_items soi ON so.id = soi.order_id
       WHERE so.client_id = $1
       GROUP BY so.id
       ORDER BY so.created_at DESC LIMIT 20`,
      [id]
    );

    // Get invoices
    const invoicesResult = await query(
      `SELECT i.*, COUNT(ii.id) as item_count
       FROM invoices i
       LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE i.client_id = $1
       GROUP BY i.id
       ORDER BY i.created_at DESC LIMIT 20`,
      [id]
    );

    // Get payments
    const paymentsResult = await query(
      `SELECT * FROM client_payment_history WHERE client_id = $1 ORDER BY date DESC LIMIT 20`,
      [id]
    );

    // Get liabilities
    const liabilitiesResult = await query(
      `SELECT * FROM client_liabilities WHERE client_id = $1 ORDER BY due_date DESC`,
      [id]
    );

    // Summary — total_paid from payment history (single source of truth)
    const summaryResult = await query(
      `SELECT
        COUNT(DISTINCT so.id) as total_orders,
        COALESCE(SUM(so.final_amount), 0) as total_amount,
        COALESCE((SELECT SUM(amount) FROM client_payment_history WHERE client_id = $1 AND description NOT LIKE '%liability%'), 0) as total_paid,
        GREATEST(COALESCE(SUM(so.final_amount), 0) - COALESCE((SELECT SUM(amount) FROM client_payment_history WHERE client_id = $1 AND description NOT LIKE '%liability%'), 0), 0) as total_pending
       FROM sales_orders so
       WHERE so.client_id = $1`,
      [id]
    );

    res.json({
      client,
      orders: ordersResult.rows,
      invoices: invoicesResult.rows,
      payments: paymentsResult.rows,
      liabilities: liabilitiesResult.rows,
      pendingInvoices: invoicesResult.rows.filter(i => i.status !== 'paid'),
      recentPayments: paymentsResult.rows.slice(0, 5),
      summary: summaryResult.rows[0] || { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalPending: 0 }
    });
  } catch (error) {
    console.error('Error fetching client account:', error);
    res.status(500).json({ error: 'Failed to fetch client account' });
  }
});

// GET client statement of account
router.get('/:id/statement', async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Get client info
    const clientResult = await query(`
      SELECT id, name_arabic, name_english, code, current_balance
      FROM clients WHERE id = $1
    `, [id]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get all transactions (liabilities and payments)
    const transactionsResult = await query(`
      SELECT
        'liability' as transaction_type,
        date,
        amount,
        description,
        status
      FROM client_liabilities
      WHERE client_id = $1
        AND ($2::date IS NULL OR date >= $2::date)
        AND ($3::date IS NULL OR date <= $3::date)

      UNION ALL

      SELECT
        'payment' as transaction_type,
        date,
        -amount as amount,
        description,
        'completed' as status
      FROM client_payment_history
      WHERE client_id = $1
        AND ($2::date IS NULL OR date >= $2::date)
        AND ($3::date IS NULL OR date <= $3::date)

      ORDER BY date DESC
    `, [id, from_date || null, to_date || null]);

    res.json({
      client: clientResult.rows[0],
      transactions: transactionsResult.rows,
      from_date,
      to_date
    });
  } catch (error) {
    console.error('Error fetching client statement:', error);
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
});

// POST create new client
router.post('/', async (req, res) => {
  try {
    const {
      name_arabic, name_english, code, type, status,
      payment_terms, credit_limit, phone, email,
      address, city, contact_person, discount,
      avg_consumption, favorite_feed_type_id,
      license_number, notes
    } = req.body;

    if (!name_arabic) {
      return res.status(400).json({ error: 'Name (Arabic) is required' });
    }

    // Auto-generate code if not provided
    let clientCode = code;
    if (!clientCode) {
      const seqResult = await query("SELECT nextval('clients_id_seq') as seq");
      const seq = seqResult.rows[0].seq;
      clientCode = 'CLT-' + String(seq).padStart(5, '0');
    }

    const result = await query(
      `INSERT INTO clients
        (code, name_arabic, name_english, type, status,
         payment_terms, credit_limit, current_balance,
         phone, email, address, city,
         contact_person, discount, avg_consumption,
         favorite_feed_type_id, license_number, notes, storage_location,
         is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0,
         $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
         $18, true, NOW(), NOW())
         RETURNING *`,
      [
        clientCode,
        name_arabic, name_english || name_arabic, type || 'farm', status || 'active',
        payment_terms || 'cash', credit_limit || 0,
        phone || null, email || null, address || null, city || null,
        contact_person || null, discount || 0, avg_consumption || 0,
        favorite_feed_type_id || null, license_number || null, notes || null,
        req.body.storage_location || ''
      ]
    );

    res.status(201).json({ success: true, client: result.rows[0] });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client', message: error.message });
  }
});

// PUT update client
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name_arabic, name_english, type, status,
      payment_terms, credit_limit, phone, email,
      address, city, contact_person, discount,
      avg_consumption, favorite_feed_type_id,
      license_number, notes
    } = req.body;

    // Credit limit change requires owner approval
    if (credit_limit !== undefined && req.user?.role !== 'owner' && req.user?.role !== 'admin') {
      const current = await query('SELECT credit_limit, name_arabic, name_english, code FROM clients WHERE id = $1', [id]);
      if (current.rows.length > 0 && parseFloat(current.rows[0].credit_limit) !== parseFloat(credit_limit)) {
        const client = current.rows[0];
        await query(
          `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, status, notes, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['clients', 'credit_limit_change', id, req.user.id, 'pending',
           `Credit limit change for ${client.name_arabic || client.name_english}: ${client.credit_limit} → ${credit_limit}`,
           JSON.stringify({ client_id: id, old_limit: client.credit_limit, new_limit: credit_limit, client_code: client.code })]
        );
        return res.status(200).json({ success: true, message: 'Credit limit change sent for owner approval', pendingApproval: true });
      }
    }

    const result = await query(
      `UPDATE clients SET
        name_arabic = COALESCE($1, name_arabic),
        name_english = COALESCE($2, name_english),
        type = COALESCE($3, type),
        status = COALESCE($4, status),
        payment_terms = COALESCE($5, payment_terms),
        credit_limit = COALESCE($6, credit_limit),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        address = COALESCE($9, address),
        city = COALESCE($10, city),
        contact_person = COALESCE($11, contact_person),
        discount = COALESCE($12, discount),
        avg_consumption = COALESCE($13, avg_consumption),
        favorite_feed_type_id = COALESCE($14, favorite_feed_type_id),
        license_number = COALESCE($15, license_number),
        notes = COALESCE($16, notes),
        storage_location = COALESCE($17, storage_location),
        updated_at = NOW()
       WHERE id = $18
       RETURNING *`,
      [
        name_arabic, name_english, type, status,
        payment_terms, credit_limit, phone, email,
        address, city,
        contact_person, discount, avg_consumption,
        favorite_feed_type_id, license_number, notes,
        req.body.storage_location || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ success: true, client: result.rows[0] });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client', message: error.message });
  }
});

// ============================================================
// LIABILITIES ROUTES
// ============================================================

// POST create liability
router.post('/:id/liabilities', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, type, date, dueDate, notes } = req.body;
    if (!amount || !date) {
      return res.status(400).json({ error: 'Amount and date are required' });
    }
    const result = await query(
      `INSERT INTO client_liabilities (client_id, amount, date, due_date, description, type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [id, amount, date, dueDate || null, description || null, type || 'balance']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating liability:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST record payment against a liability
router.post('/:id/liabilities/:liabilityId/payments', async (req, res) => {
  try {
    const { id, liabilityId } = req.params;
    const { amount, method, date, reference, notes } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    const methodNormalized = { 'bank': 'bank_transfer', 'card': 'credit_card', 'cheque': 'check', 'check': 'check' }[method] || method || 'cash';
    // Insert payment into payment history
    await query(
      `INSERT INTO client_payment_history (client_id, amount, date, description, method)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, amount, date || new Date().toISOString().split('T')[0], notes || `Payment for liability #${liabilityId}`, methodNormalized]
    );
    // Update client balance
    await query(
      'UPDATE clients SET current_balance = current_balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [amount, id]
    );
    // Calculate total paid from payment history for this liability
    const paidRes = await query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid FROM client_payment_history
       WHERE client_id = $1 AND description LIKE $2`,
      [id, `%#${liabilityId}%`]
    );
    const totalPaid = parseFloat(paidRes.rows[0].total_paid);
    // Get the liability
    const liab = await query('SELECT * FROM client_liabilities WHERE id = $1', [liabilityId]);
    const liability = liab.rows[0];
    if (liability) {
      const remaining = parseFloat(liability.amount) - totalPaid;
      const newStatus = remaining <= 0 ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';
      await query(
        `UPDATE client_liabilities SET status = $1, paid_amount = $2, remaining_amount = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`,
        [newStatus, totalPaid, Math.max(0, remaining), liabilityId]
      );
      const result = { ...liability, status: newStatus, remainingAmount: Math.max(0, remaining), paidAmount: totalPaid };
      res.json(result);
    } else {
      res.json({ id: liabilityId, remainingAmount: 0, paidAmount: parseFloat(amount), status: 'paid' });
    }
  } catch (error) {
    console.error('Error recording liability payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE liability
router.delete('/:id/liabilities/:liabilityId', async (req, res) => {
  try {
    const { liabilityId } = req.params;
    await query('DELETE FROM client_liabilities WHERE id = $1', [liabilityId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting liability:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EXPECTED PAYMENTS ROUTES
// ============================================================

// POST create expected payment
router.post('/:id/expected-payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, expectedDate, description } = req.body;
    if (!amount || !expectedDate) {
      return res.status(400).json({ error: 'Amount and expected date are required' });
    }
    const result = await query(
      `INSERT INTO client_expected_payments (client_id, amount, expected_date, description, status)
       VALUES ($1, $2, $3, $4, 'expected') RETURNING *`,
      [id, amount, expectedDate, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expected payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST mark expected payment as received
router.post('/:id/expected-payments/:paymentId/mark-received', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await query(
      `UPDATE client_expected_payments SET status = 'received' WHERE id = $1 RETURNING *`,
      [paymentId]
    );
    res.json(result.rows[0] || { success: true });
  } catch (error) {
    console.error('Error marking expected payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE expected payment
router.delete('/:id/expected-payments/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    await query('DELETE FROM client_expected_payments WHERE id = $1', [paymentId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting expected payment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single client with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get client details
    const clientResult = await query(`
      SELECT * FROM clients WHERE id = $1
    `, [id]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const client = clientResult.rows[0];

    // Get liabilities
    const liabilitiesResult = await query(`
      SELECT * FROM client_liabilities
      WHERE client_id = $1
      ORDER BY date DESC
    `, [id]);

    client.liabilities = liabilitiesResult.rows;

    // Get expected payments
    const expectedResult = await query(`
      SELECT * FROM client_expected_payments
      WHERE client_id = $1
      ORDER BY expected_date ASC
    `, [id]);

    client.expected_payments = expectedResult.rows;

    // Get payment history
    const historyResult = await query(`
      SELECT * FROM client_payment_history
      WHERE client_id = $1
      ORDER BY date DESC
      LIMIT 50
    `, [id]);

    client.payment_history = historyResult.rows;

    // Document compliance status
    const docRequired = await query(`SELECT COUNT(*) as count FROM client_required_docs WHERE is_required = true`);
    const docUploaded = await query(`
      SELECT COUNT(DISTINCT description) as count FROM documents 
      WHERE entity_type = 'client' AND entity_id = $1 AND description IS NOT NULL
    `, [id]);
    const docMissing = await query(`
      SELECT doc_type, label_arabic, label_english FROM client_required_docs 
      WHERE is_required = true AND doc_type NOT IN (
        SELECT description FROM documents WHERE entity_type = 'client' AND entity_id = $1 AND description IS NOT NULL
      ) ORDER BY sort_order
    `, [id]);
    client.document_status = {
      required: parseInt(docRequired.rows[0].count),
      uploaded: parseInt(docUploaded.rows[0].count),
      complete: parseInt(docUploaded.rows[0].count) >= parseInt(docRequired.rows[0].count),
      missing: docMissing.rows.map(r => r.label_arabic || r.label_english)
    };

    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// DELETE client (soft-delete + purge associated legal documents)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await transaction(async (client) => {
      const clientResult = await client.query(
        `UPDATE clients SET is_active = false, updated_at = NOW() WHERE id = $1 AND is_active = true RETURNING id`,
        [id]
      );
      if (clientResult.rows.length === 0) {
        return null;
      }
      await client.query(
        `DELETE FROM legal_documents WHERE client_id = $1`,
        [id]
      );
      return clientResult.rows[0];
    });
    if (!result) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;
