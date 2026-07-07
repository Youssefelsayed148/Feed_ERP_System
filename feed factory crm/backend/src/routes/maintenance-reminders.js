const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate: auth } = require('../middleware/auth');

// POST /api/maintenance-reminders/reminders - Create a new maintenance reminder
router.post('/reminders', auth, async (req, res) => {
  try {
    const { machine_id, vehicle_id, type, title, description, due_date, cost, notes } = req.body;
    if (!machine_id && !vehicle_id) {
      return res.status(400).json({ error: 'machine_id or vehicle_id is required' });
    }

    const result = await query(`
      INSERT INTO maintenance_reminders (machine_id, vehicle_id, type, description, due_date, status, notes, cost)
      VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7) RETURNING *
    `, [machine_id || null, vehicle_id || null, type || 'preventive', title || description || 'صيانة مجدولة', due_date, notes || null, cost || 0]);

    res.status(201).json({ success: true, reminder: result.rows[0] });
  } catch (error) {
    console.error('Error creating maintenance reminder:', error);
    res.status(500).json({ error: 'Failed to create maintenance reminder' });
  }
});

// GET /api/maintenance/reminders - List all maintenance reminders
router.get('/reminders', auth, async (req, res) => {
  try {
    const { status, machine_id } = req.query;

    let sql = `
      SELECT
        ms.id, ms.machine_id, ms.vehicle_id, ms.type, ms.description, ms.due_date,
        ms.status, ms.notes, ms.completed_at, ms.cost,
        COALESCE(m.code, v.plate_number) as machine_code,
        COALESCE(NULLIF(m.name_arabic, ''), m.name_english, v.make) as machine_name
      FROM maintenance_reminders ms
      LEFT JOIN machines m ON m.id = ms.machine_id
      LEFT JOIN vehicles v ON v.id = ms.vehicle_id
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
    const reminders = result.rows.map(r => ({
      _id: r.id,
      recordNumber: `MR-${r.id}`,
      title: r.description || r.type,
      asset: { name: r.machine_name, code: r.machine_code },
      maintenanceType: r.type,
      scheduledDate: r.due_date,
      priority: 'medium',
      status: r.status,
      assignedTechnician: (r.notes || '').match(/نفذ بواسطة:\s*([^|]+)/)?.[1]?.trim() || '',
      totalCost: r.cost,
      description: r.description,
      notes: r.notes,
      completedAt: r.completed_at
    }));
    res.json({ success: true, reminders });
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
        mr.id, mr.machine_id, mr.vehicle_id, mr.type, mr.description, mr.due_date,
        mr.status, mr.notes, mr.completed_at, mr.cost,
        COALESCE(NULLIF(m.name_arabic, ''), m.name_english, v.make) as machine_name,
        COALESCE(m.code, v.plate_number) as machine_code
      FROM maintenance_reminders mr
      LEFT JOIN machines m ON m.id = mr.machine_id
      LEFT JOIN vehicles v ON v.id = mr.vehicle_id
      WHERE mr.due_date <= NOW() + INTERVAL '7 days'
        AND mr.status IN ('scheduled', 'pending')
      ORDER BY mr.due_date ASC
    `);

    const reminders = result.rows.map(r => ({
      _id: r.id,
      recordNumber: `MR-${r.id}`,
      title: r.description || r.type,
      asset: { name: r.machine_name, code: r.machine_code },
      maintenanceType: r.type,
      scheduledDate: r.due_date,
      priority: 'medium',
      status: r.status,
      assignedTechnician: (r.notes || '').match(/نفذ بواسطة:\s*([^|]+)/)?.[1]?.trim() || '',
      totalCost: r.cost,
      description: r.description,
      notes: r.notes,
      completedAt: r.completed_at
    }));
    res.json({ success: true, reminders });
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
      SELECT ms.*, m.code as machine_code, COALESCE(NULLIF(m.name_arabic, ''), m.name_english) AS machine_name
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
    const { type, intervalValue, intervalUnit, lastMaintenanceDate, lastMaintenanceHours, reminderDaysBefore, notes } = req.body;

    // Compute next due date from interval
    let nextDueDate = lastMaintenanceDate;
    if (intervalValue && intervalUnit && !lastMaintenanceDate) {
      const unitMap = { hours: 'hours', days: 'days', weeks: 'weeks', months: 'months' };
      const unit = unitMap[intervalUnit] || 'months';
      nextDueDate = new Date();
      if (unit === 'hours') nextDueDate.setHours(nextDueDate.getHours() + parseInt(intervalValue));
      else if (unit === 'days') nextDueDate.setDate(nextDueDate.getDate() + parseInt(intervalValue));
      else if (unit === 'weeks') nextDueDate.setDate(nextDueDate.getDate() + parseInt(intervalValue) * 7);
      else if (unit === 'months') nextDueDate.setMonth(nextDueDate.getMonth() + parseInt(intervalValue));
      nextDueDate = nextDueDate.toISOString().split('T')[0];
    }

    const scheduleNotes = [
      notes || '',
      intervalValue ? `فترة: ${intervalValue} ${intervalUnit}` : '',
      lastMaintenanceHours ? `ساعات التشغيل: ${lastMaintenanceHours}` : '',
      reminderDaysBefore ? `تذكير قبل: ${reminderDaysBefore} يوم` : ''
    ].filter(Boolean).join(' | ') || null;

    // Insert into maintenance_schedules
    const scheduleResult = await query(`
      INSERT INTO maintenance_schedules
        (machine_id, scheduled_date, type, description, status, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'scheduled', $5, NOW(), NOW())
      RETURNING *
    `, [id, nextDueDate || new Date().toISOString().split('T')[0], type || 'preventive', 'صيانة مجدولة', scheduleNotes]);

    // Also insert into maintenance_reminders
    const reminderResult = await query(`
      INSERT INTO maintenance_reminders (machine_id, type, description, due_date, status, notes)
      VALUES ($1, $2, $3, $4, 'pending', $5) RETURNING *
    `, [id, type || 'preventive', 'صيانة مجدولة', nextDueDate || new Date().toISOString().split('T')[0], scheduleNotes]);

    // Create approval request → maintenance_mgr Stage 1 → owner Stage 2
    try {
      await query(
        `INSERT INTO approval_requests (module_name, request_type, request_id, requester_id, notes, stage, status)
         VALUES ($1, $2, $3, $4, $5, 'manager_review', 'pending') ON CONFLICT DO NOTHING`,
        ['maintenance', 'maintenance_reminder', reminderResult.rows[0].id, req.user.id,
         `Maintenance: ${reminderResult.rows[0].description || reminderResult.rows[0].type} - Due: ${reminderResult.rows[0].due_date}`]
      );
    } catch (e) { console.error('Error creating maintenance approval request:', e.message); }

    res.status(201).json({ success: true, schedule: scheduleResult.rows[0], reminder: reminderResult.rows[0] });
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