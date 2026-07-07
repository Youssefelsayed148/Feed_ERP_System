const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  await query(`
    CREATE TABLE IF NOT EXISTS partners (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      type VARCHAR(50),
      contact_person VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableInitialized = true;
}

// GET /api/partners - List partners
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { type, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT * FROM partners WHERE is_active = true`;
    const params = [];
    let idx = 0;

    if (type) {
      idx++;
      sql += ` AND type = $${idx}`;
      params.push(type);
    }

    if (search) {
      idx++;
      sql += ` AND (name ILIKE $${idx} OR contact_person ILIKE $${idx} OR email ILIKE $${idx} OR phone ILIKE $${idx})`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM partners WHERE is_active = true`;
    const countParams = [];
    let cidx = 0;
    if (type) {
      cidx++;
      countSql += ` AND type = $${cidx}`;
      countParams.push(type);
    }
    if (search) {
      cidx++;
      countSql += ` AND (name ILIKE $${cidx} OR contact_person ILIKE $${cidx} OR email ILIKE $${cidx} OR phone ILIKE $${cidx})`;
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      partners: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

// GET /api/partners/:id - Get single partner
router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const result = await query(`SELECT * FROM partners WHERE id = $1`, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching partner:', error);
    res.status(500).json({ error: 'Failed to fetch partner' });
  }
});

// POST /api/partners - Create partner
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { name, type, contact_person, phone, email, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(`
      INSERT INTO partners (name, type, contact_person, phone, email, address, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *
    `, [name, type || null, contact_person || null, phone || null, email || null, address || null]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating partner:', error);
    res.status(500).json({ error: 'Failed to create partner' });
  }
});

// PUT /api/partners/:id - Update partner
router.put('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['name', 'type', 'contact_person', 'phone', 'email', 'address', 'is_active'];
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

    values.push(req.params.id);
    const result = await query(`
      UPDATE partners SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating partner:', error);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

// DELETE /api/partners/:id - Soft delete partner
router.delete('/:id', authenticate, authorize('admin', 'owner'), async (req, res) => {
  try {
    await ensureTable();
    const result = await query(`
      UPDATE partners SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({ success: true, partner: result.rows[0] });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

module.exports = router;
