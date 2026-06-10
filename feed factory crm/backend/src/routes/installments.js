const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  await query(`
    CREATE TABLE IF NOT EXISTS installments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      invoice_id INTEGER REFERENCES invoices(id),
      amount NUMERIC(12,2),
      due_date DATE,
      paid_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableInitialized = true;
}

// GET /api/installments - List installments
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { status, client_id, invoice_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        i.*,
        c.name_arabic as client_name,
        c.code as client_code,
        inv.invoice_number
      FROM installments i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN invoices inv ON i.invoice_id = inv.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND i.status = $${idx}`;
      params.push(status);
    }

    if (client_id) {
      idx++;
      sql += ` AND i.client_id = $${idx}`;
      params.push(client_id);
    }

    if (invoice_id) {
      idx++;
      sql += ` AND i.invoice_id = $${idx}`;
      params.push(invoice_id);
    }

    sql += ` ORDER BY i.due_date ASC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM installments i WHERE 1=1`;
    const countParams = [];
    let cidx = 0;
    if (status) {
      cidx++;
      countSql += ` AND i.status = $${cidx}`;
      countParams.push(status);
    }
    if (client_id) {
      cidx++;
      countSql += ` AND i.client_id = $${cidx}`;
      countParams.push(client_id);
    }
    if (invoice_id) {
      cidx++;
      countSql += ` AND i.invoice_id = $${cidx}`;
      countParams.push(invoice_id);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      installments: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching installments:', error);
    res.status(500).json({ error: 'Failed to fetch installments' });
  }
});

// GET /api/installments/:id - Get single installment
router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await query(`
      SELECT 
        i.*,
        c.name_arabic as client_name,
        c.code as client_code,
        inv.invoice_number
      FROM installments i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN invoices inv ON i.invoice_id = inv.id
      WHERE i.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching installment:', error);
    res.status(500).json({ error: 'Failed to fetch installment' });
  }
});

// POST /api/installments/:id/pay - Pay installment
router.post('/:id/pay', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { paid_date, amount_paid, notes } = req.body;

    const result = await query(`
      UPDATE installments 
      SET status = 'paid', 
          paid_date = COALESCE($1, CURRENT_DATE),
          notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *
    `, [paid_date || null, notes || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installment not found' });
    }

    res.json({ success: true, installment: result.rows[0] });
  } catch (error) {
    console.error('Error paying installment:', error);
    res.status(500).json({ error: 'Failed to pay installment' });
  }
});

module.exports = router;
