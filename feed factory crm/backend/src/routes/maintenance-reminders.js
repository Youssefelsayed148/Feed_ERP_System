const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate: auth } = require('../middleware/auth');

// GET /api/maintenance/reminders - List all maintenance reminders
router.get('/reminders', auth, async (req, res) => {
  try {
    const { status, machine_id } = req.query;

    let sql = `
      SELECT 
        ms.*,
        m.code as machine_code,
        m.name as machine_name
      FROM maintenance_reminders ms
      LEFT JOIN machines m ON m.id = ms.machine_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 0;

    if (status) {
      idx++;
      sql += ` AND ms.status = $${idx}`;
      params.push(status);
    }

    if (machine_id) {
      idx++;
      sql += ` AND ms.machine_id = $${idx}`;
      params.push(machine_id);
    }

    sql += ` ORDER BY ms.due_date ASC`;

    const result = await query(sql, params);
    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// GET /api/maintenance/reminders/due - List due reminders
router.get('/reminders/due', auth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        ms.*,
        COALESCE(NULLIF(m.name_arabic, ''), m.name_english) as machine_name,
        m.code as machine_code
      FROM maintenance_schedules ms
      LEFT JOIN machines m ON m.id = ms.machine_id
      WHERE ms.scheduled_date <= NOW() + INTERVAL '7 days'
        AND ms.status = 'scheduled'
      ORDER BY ms.scheduled_date ASC
    `);

    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Error fetching due reminders:', error);
    res.status(500).json({ error: 'Failed to fetch due reminders' });
  }
});

// GET /api/machines/:id/reminders - Get reminders for a machine
router.get('/machines/:id/reminders', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT ms.*, m.code as machine_code, m.name as machine_name
      FROM maintenance_reminders ms
      LEFT JOIN machines m ON m.id = ms.machine_id
      WHERE ms.machine_id = $1
      ORDER BY ms.due_date ASC
    `, [id]);

    res.json({ reminders: result.rows });
  } catch (error) {
    console.error('Error fetching machine reminders:', error);
    res.status(500).json({ error: 'Failed to fetch machine reminders' });
  }
});

// POST /api/machines/:id/schedule-maintenance - Schedule maintenance
router.post('/machines/:id/schedule-maintenance', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, due_date, notes } = req.body;

    const result = await query(`
      INSERT INTO maintenance_reminders (machine_id, type, description, due_date, status, notes)
      VALUES ($1, $2, $3, $4, 'scheduled', $5) RETURNING *
    `, [id, title || 'routine', description || null, due_date, notes || null]);

    res.status(201).json({ success: true, reminder: result.rows[0] });
  } catch (error) {
    console.error('Error scheduling maintenance:', error);
    res.status(500).json({ error: 'Failed to schedule maintenance' });
  }
});

// POST /api/machines/:id/record-maintenance - Record maintenance done
router.post('/machines/:id/record-maintenance', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule_id, completed_at, notes, cost } = req.body;

    const result = await query(`
      UPDATE maintenance_reminders 
      SET status = 'completed', 
          completed_at = COALESCE($1, NOW()), 
          notes = COALESCE($2, notes),
          cost = COALESCE($3, cost)
      WHERE id = $4 AND machine_id = $5
      RETURNING *
    `, [completed_at || null, notes || null, cost || null, schedule_id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    res.json({ success: true, reminder: result.rows[0] });
  } catch (error) {
    console.error('Error recording maintenance:', error);
    res.status(500).json({ error: 'Failed to record maintenance' });
  }
});

// POST /api/maintenance/check-reminders - Check and update overdue reminders
router.post('/check-reminders', auth, async (req, res) => {
  try {
    const result = await query(`
      UPDATE maintenance_reminders 
      SET status = 'overdue'
      WHERE status = 'pending' AND due_date < CURRENT_DATE
      RETURNING *
    `);

    res.json({ 
      success: true, 
      updated: result.rows.length,
      reminders: result.rows 
    });
  } catch (error) {
    console.error('Error checking reminders:', error);
    res.status(500).json({ error: 'Failed to check reminders' });
  }
});

// PUT /api/maintenance-reminders/:id/reschedule - Reschedule maintenance
router.put('/:id/reschedule', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { due_date } = req.body;

    if (!due_date) {
      return res.status(400).json({ error: 'due_date is required' });
    }

    const result = await query(`
      UPDATE maintenance_reminders
      SET due_date = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [due_date, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (error) {
    console.error('Error rescheduling maintenance:', error);
    res.status(500).json({ error: 'Failed to reschedule maintenance' });
  }
});

// PUT /api/maintenance-reminders/:id/start - Start maintenance
router.put('/:id/start', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE maintenance_reminders
      SET status = 'in_progress', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (error) {
    console.error('Error starting maintenance:', error);
    res.status(500).json({ error: 'Failed to start maintenance' });
  }
});

// PUT /api/maintenance-reminders/:id/complete - Complete maintenance
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cost, notes } = req.body;

    const result = await query(`
      UPDATE maintenance_reminders
      SET status = 'completed',
          completed_at = NOW(),
          cost = COALESCE($1, cost),
          notes = COALESCE($2, notes),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [cost, notes, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (error) {
    console.error('Error completing maintenance:', error);
    res.status(500).json({ error: 'Failed to complete maintenance' });
  }
});

// PUT /api/maintenance-reminders/:id/cancel - Cancel maintenance
router.put('/:id/cancel', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE maintenance_reminders
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance schedule not found' });
    }

    res.json({ success: true, schedule: result.rows[0] });
  } catch (error) {
    console.error('Error cancelling maintenance:', error);
    res.status(500).json({ error: 'Failed to cancel maintenance' });
  }
});

module.exports = router;
