const express = require('express');
const router = express.Router();
const { query, transaction } = require('../config/database');
const { authenticate } = require('../middleware/auth');

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
        COUNT(*) FILTER (WHERE current_balance > 0) as clients_with_balance,
        COALESCE(SUM(current_balance), 0) as total_receivables,
        COALESCE(SUM(current_balance) FILTER (WHERE status = 'active'), 0) as active_receivables
      FROM clients
      WHERE is_active = true
    `);

    // Get overdue clients
    const overdueResult = await query(`
      SELECT COUNT(DISTINCT c.id) as overdue_count
      FROM clients c
      JOIN client_liabilities cl ON c.id = cl.client_id
      WHERE c.is_active = true
        AND cl.status = 'pending'
        AND cl.due_date < CURRENT_DATE
    `);

    res.json({
      ...result.rows[0],
      overdue_clients: overdueResult.rows[0].overdue_count
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
        c.current_balance, c.phone,
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

// POST record payment
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, description, method } = req.body;

    if (!amount || !date) {
      return res.status(400).json({ error: 'Amount and date are required' });
    }

    const result = await transaction(async (client) => {
      // Insert payment
      await client.query(`
        INSERT INTO client_payment_history
        (client_id, amount, date, description, method)
        VALUES ($1, $2, $3, $4, $5)
      `, [id, amount, date, description, method]);

      // Update client balance
      await client.query(`
        UPDATE clients
        SET current_balance = current_balance - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [amount, id]);

      // Return updated client
      const clientResult = await client.query(
        'SELECT * FROM clients WHERE id = $1',
        [id]
      );

      return clientResult.rows[0];
    });

    res.json({
      message: 'Payment recorded successfully',
      client: result
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
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
         favorite_feed_type_id, license_number, notes,
         is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0,
         $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
         true, NOW(), NOW())
       RETURNING *`,
      [
        clientCode,
        name_arabic, name_english || name_arabic, type || 'farm', status || 'active',
        payment_terms || 'cash', credit_limit || 0,
        phone || null, email || null, address || null, city || null,
        contact_person || null, discount || 0, avg_consumption || 0,
        favorite_feed_type_id || null, license_number || null, notes || null
      ]
    );

    res.status(201).json({ success: true, client: result.rows[0] });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client', message: error.message });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name_arabic, name_english, type, status,
      payment_terms, credit_limit, phone, email,
      address, city, contact_person, discount,
      avg_consumption, favorite_feed_type_id,
      license_number, notes
    } = req.body;

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
        updated_at = NOW()
       WHERE id = $17
       RETURNING *`,
      [
        name_arabic, name_english, type, status,
        payment_terms, credit_limit, phone, email,
        address, city,
        contact_person, discount, avg_consumption,
        favorite_feed_type_id, license_number, notes,
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

module.exports = router;
