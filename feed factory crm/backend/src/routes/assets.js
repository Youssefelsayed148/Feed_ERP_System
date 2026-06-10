const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// Machines
router.get('/machines', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM machines WHERE is_active = true`;
    const params = [];
    if (status) { sql += ` AND status = $1`; params.push(status); }
    sql += ` ORDER BY code`;
    const result = await query(sql, params);
    res.json({ machines: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/machines/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='active') as active,
        COUNT(*) FILTER (WHERE status='maintenance') as in_maintenance,
        COUNT(*) FILTER (WHERE is_active=false) as inactive
      FROM machines
    `);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      active: parseInt(row.active),
      inMaintenance: parseInt(row.in_maintenance),
      inactive: parseInt(row.inactive)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/machines/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM machines WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/machines', authenticate, async (req, res) => {
  try {
    const { code, name_arabic, name_english, type, location, purchase_date, purchase_cost } = req.body;
    const result = await query(
      `INSERT INTO machines (code, name_arabic, name_english, type, location, status, purchase_date, purchase_cost, is_active)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, true) RETURNING *`,
      [code, name_arabic, name_english, type, location, purchase_date, purchase_cost]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/machines/:id', authenticate, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['code','name_arabic','name_english','type','location','status','purchase_date','purchase_cost','is_active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(req.params.id);
    const result = await query(
      `UPDATE machines SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vehicles
router.get('/vehicles', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `SELECT * FROM vehicles WHERE is_active = true`;
    const params = [];
    if (status) { sql += ` AND status = $1`; params.push(status); }
    sql += ` ORDER BY code`;
    const result = await query(sql, params);
    res.json({ vehicles: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`SELECT * FROM vehicles WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/vehicles', authenticate, async (req, res) => {
  try {
    const { code, plate_number, make, model, type, capacity_kg, driver_id } = req.body;
    const result = await query(
      `INSERT INTO vehicles (code, plate_number, make, model, type, capacity_kg, driver_id, status, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'available', true) RETURNING *`,
      [code, plate_number, make, model, type, capacity_kg, driver_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/vehicles/:id', authenticate, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['code','plate_number','make','model','type','capacity_kg','driver_id','status','is_active'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(req.body[key]);
        idx++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
    values.push(req.params.id);
    const result = await query(
      `UPDATE vehicles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Maintenance schedules
router.get('/maintenance', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT ms.*, m.code as machine_code, m.name_english as machine_name
       FROM maintenance_schedules ms
       JOIN machines m ON ms.machine_id = m.id
       ORDER BY ms.scheduled_date`
    );
    res.json({ records: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
