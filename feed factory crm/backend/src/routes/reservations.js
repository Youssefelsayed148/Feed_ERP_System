const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

let tableInitialized = false;

async function ensureTable() {
  if (tableInitialized) return;
  await query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id),
      feed_type_id INTEGER REFERENCES feed_types(id),
      quantity_kg NUMERIC(12,3),
      reservation_date DATE DEFAULT CURRENT_DATE,
      delivery_date DATE,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableInitialized = true;
}

// GET /api/reservations - List reservations
router.get('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { status, client_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT 
        r.*,
        c.name_arabic as client_name,
        c.code as client_code,
        ft.name_arabic as feed_type_name,
        ft.code as feed_type_code
      FROM reservations r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN feed_types ft ON r.feed_type_id = ft.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND r.status = $${idx}`;
      params.push(status);
    }

    if (client_id) {
      idx++;
      sql += ` AND r.client_id = $${idx}`;
      params.push(client_id);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${++idx} OFFSET $${++idx}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM reservations r WHERE 1=1`;
    const countParams = [];
    let cidx = 0;
    if (status) {
      cidx++;
      countSql += ` AND r.status = $${cidx}`;
      countParams.push(status);
    }
    if (client_id) {
      cidx++;
      countSql += ` AND r.client_id = $${cidx}`;
      countParams.push(client_id);
    }
    const countResult = await query(countSql, countParams);

    res.json({
      reservations: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit)
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// GET /api/reservations/:id - Get single reservation
router.get('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await query(`
      SELECT 
        r.*,
        c.name_arabic as client_name,
        c.code as client_code,
        ft.name_arabic as feed_type_name,
        ft.code as feed_type_code
      FROM reservations r
      LEFT JOIN clients c ON r.client_id = c.id
      LEFT JOIN feed_types ft ON r.feed_type_id = ft.id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

// POST /api/reservations - Create reservation
router.post('/', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { client_id, feed_type_id, quantity_kg, reservation_date, delivery_date, notes } = req.body;
    const createdBy = req.user.id;

    const result = await query(`
      INSERT INTO reservations (client_id, feed_type_id, quantity_kg, reservation_date, delivery_date, status, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7) RETURNING *
    `, [client_id || null, feed_type_id || null, quantity_kg || 0, reservation_date || new Date(), delivery_date || null, notes || null, createdBy]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// PUT /api/reservations/:id - Update reservation
router.put('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['client_id', 'feed_type_id', 'quantity_kg', 'reservation_date', 'delivery_date', 'status', 'notes'];
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
      UPDATE reservations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

// DELETE /api/reservations/:id - Delete reservation
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await query(`DELETE FROM reservations WHERE id = $1 RETURNING *`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ error: 'Failed to delete reservation' });
  }
});

module.exports = router;
