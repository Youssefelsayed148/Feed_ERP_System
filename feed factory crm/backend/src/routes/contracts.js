const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  await query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      contract_number VARCHAR(50) UNIQUE,
      title VARCHAR(255),
      start_date DATE,
      end_date DATE,
      value NUMERIC(12,2),
      status VARCHAR(20) DEFAULT 'active',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableInitialized = true;
}

// GET /api/contracts - List contracts
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { status, client_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        c.*,
        cl.name_arabic as client_name,
        cl.code as client_code
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND c.status = $${idx}`;
      params.push(status);
    }

    if (client_id) {
      idx++;
      sql += ` AND c.client_id = $${idx}`;
      params.push(client_id);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM contracts c WHERE 1=1`;
    const countParams = [];
    let cidx = 0;
    if (status) {
      cidx++;
      countSql += ` AND c.status = $${cidx}`;
      countParams.push(status);
    }
    if (client_id) {
      cidx++;
      countSql += ` AND c.client_id = $${cidx}`;
      countParams.push(client_id);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      contracts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// GET /api/contracts/stats - Contract stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COALESCE(SUM(value), 0) as total_value
      FROM contracts
    `);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contract stats:', error);
    res.status(500).json({ error: 'Failed to fetch contract stats' });
  }
});

// GET /api/contracts/:id - Get single contract
router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await query(`
      SELECT c.*, cl.name as client_name, cl.code as client_code
      FROM contracts c
      LEFT JOIN clients cl ON c.client_id = cl.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

// POST /api/contracts - Create contract
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { client_id, contract_number, title, start_date, end_date, value, status = 'active', notes } = req.body;
    const createdBy = req.user.id;

    const result = await query(`
      INSERT INTO contracts (client_id, contract_number, title, start_date, end_date, value, status, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [client_id || null, contract_number || null, title || null, start_date || null, end_date || null, value || 0, status, notes || null, createdBy]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// PUT /api/contracts/:id - Update contract
router.put('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['client_id', 'contract_number', 'title', 'start_date', 'end_date', 'value', 'status', 'notes'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const result = await query(`
      UPDATE contracts SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// POST /api/contracts/:id/documents - Log document upload
router.post('/:id/documents', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { document_name, document_url } = req.body;

    const result = await query(`
      UPDATE contracts 
      SET notes = COALESCE(notes, '') || E'\n[Document] ' || $1 || ': ' || $2 || ' at ' || CURRENT_TIMESTAMP::text
      WHERE id = $3
      RETURNING *
    `, [document_name || 'Unnamed', document_url || '', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json({ success: true, contract: result.rows[0] });
  } catch (error) {
    console.error('Error logging document:', error);
    res.status(500).json({ error: 'Failed to log document' });
  }
});

// POST /api/contracts/:id/sign - Sign contract
router.post('/:id/sign', authenticate, authorize('owner', 'admin', 'legal_mgr', 'sales_manager'), async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await query(`
      UPDATE contracts SET status = 'signed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    res.json({ success: true, contract: result.rows[0] });
  } catch (error) {
    console.error('Error signing contract:', error);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

module.exports = router;
