const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Machines
router.get('/machines', authenticate, async (req, res) => {
  try {
    const { status } = req.query;
    let sql = `
      SELECT
        m.*,
        (SELECT MAX(ms.scheduled_date)
         FROM maintenance_schedules ms
         WHERE ms.machine_id = m.id AND ms.status = 'completed') as last_maintenance_date,
        (SELECT MIN(mr.due_date)
         FROM maintenance_reminders mr
         WHERE mr.machine_id = m.id AND mr.status IN ('scheduled', 'pending') AND mr.due_date >= CURRENT_DATE) as next_maintenance_date
      FROM machines m
      WHERE m.is_active = true
    `;
    const params = [];
    if (status) { sql += ` AND m.status = $1`; params.push(status); }
    sql += ` ORDER BY m.code`;
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

router.post('/machines', authenticate, authorize('maintenance_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    // Accept both snake_case (API) and camelCase (frontend form)
    const code = req.body.code;
    const name_arabic = req.body.name_arabic || req.body.name || null;
    const name_english = req.body.name_english || req.body.name || '';
    const type = req.body.type || null;
    const location = req.body.location || null;
    const purchase_date = req.body.purchase_date || req.body.purchaseDate || null;
    const purchase_cost = req.body.purchase_cost || req.body.purchaseCost || null;
    const notes = req.body.notes || null;
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

router.put('/machines/:id', authenticate, authorize('maintenance_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    // Normalise camelCase → snake_case from frontend
    const body = { ...req.body };
    if (body.name && !body.name_english) body.name_english = body.name;
    if (body.name && !body.name_arabic) body.name_arabic = body.name;
    if (body.purchaseDate && !body.purchase_date) body.purchase_date = body.purchaseDate;
    if (body.purchaseCost && !body.purchase_cost) body.purchase_cost = body.purchaseCost;

    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['code','name_arabic','name_english','type','location','status','purchase_date','purchase_cost','is_active'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(body[key]);
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
    let sql = `
      SELECT
        v.*,
        u.name as driver_name,
        (SELECT MAX(ms.scheduled_date)
         FROM maintenance_schedules ms
         WHERE ms.machine_id IS NULL
           AND ms.description LIKE '[مركبة #' || v.id::text || ']%'
           AND ms.status = 'completed') as last_maintenance_date,
        (SELECT MIN(mr.due_date)
         FROM maintenance_reminders mr
         WHERE mr.vehicle_id = v.id AND mr.status IN ('scheduled', 'pending') AND mr.due_date >= CURRENT_DATE) as next_maintenance_date
      FROM vehicles v
      LEFT JOIN users u ON v.driver_id = u.id
      WHERE v.is_active = true
    `;
    const params = [];
    if (status) { sql += ` AND v.status = $1`; params.push(status); }
    sql += ` ORDER BY v.code`;
    const result = await query(sql, params);
    res.json({ vehicles: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assets/vehicles/stats
router.get('/vehicles/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='available') as available,
        COUNT(*) FILTER (WHERE status='on_delivery') as on_delivery,
        COUNT(*) FILTER (WHERE status='maintenance') as in_maintenance
      FROM vehicles WHERE is_active = true
    `);
    res.json(result.rows[0]);
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

router.post('/vehicles', authenticate, authorize('logistics_coordinator', 'maintenance_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    // Accept both snake_case (API) and camelCase (frontend form)
    const code = req.body.code;
    const plate_number = req.body.plate_number || req.body.plateNumber || '';
    const make = req.body.make || req.body.manufacturer || req.body.name || null;
    const model = req.body.model || null;
    const type = req.body.type || null;
    const capacity_kg = req.body.capacity_kg || req.body.capacityKg || null;
    const driver_id = req.body.driver_id || req.body.driverId || null;
    const notes = req.body.notes || null;
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

router.put('/vehicles/:id', authenticate, authorize('logistics_coordinator', 'maintenance_mgr', 'admin', 'owner'), async (req, res) => {
  try {
    // Normalise camelCase → snake_case from frontend
    const body = { ...req.body };
    if (body.plateNumber && !body.plate_number) body.plate_number = body.plateNumber;
    if (body.capacityKg && !body.capacity_kg) body.capacity_kg = body.capacityKg;
    if (body.driverId && !body.driver_id) body.driver_id = body.driverId;

    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['code','plate_number','make','model','type','capacity_kg','driver_id','status','is_active'];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(body[key]);
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

// POST /api/assets/machines/:id/record-maintenance
// Inserts a completed maintenance job into maintenance_schedules.
router.post('/machines/:id/record-maintenance', authenticate, authorize('maintenance_mgr', 'maintenance_tech', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type, description, cost, hoursSpent, partsReplaced, performedBy } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'وصف العمل مطلوب' });
    }

    const machineRes = await query('SELECT id FROM machines WHERE id = $1 AND is_active = true', [id]);
    if (machineRes.rows.length === 0) {
      return res.status(404).json({ error: 'الآلة غير موجودة' });
    }

    const parts = Array.isArray(partsReplaced)
      ? partsReplaced.join(', ')
      : (partsReplaced || '');
    const fullNotes = [
      performedBy ? `نفذ بواسطة: ${performedBy}` : '',
      hoursSpent ? `ساعات العمل: ${hoursSpent}` : '',
      parts ? `قطع الغيار: ${parts}` : ''
    ].filter(Boolean).join(' | ');

    const result = await query(
      `INSERT INTO maintenance_schedules
         (machine_id, scheduled_date, type, description, status, cost, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'completed', $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        id,
        date || new Date().toISOString().split('T')[0],
        type || 'preventive',
        description,
        parseFloat(cost) || 0,
        fullNotes || null
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error recording machine maintenance:', error);
    res.status(500).json({ error: 'Failed to record maintenance' });
  }
});

// POST /api/assets/vehicles/:id/record-maintenance
router.post('/vehicles/:id/record-maintenance', authenticate, authorize('maintenance_mgr', 'maintenance_tech', 'admin', 'owner'), async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type, description, cost, hoursSpent, partsReplaced, performedBy } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'وصف العمل مطلوب' });
    }

    const vehicleRes = await query('SELECT id FROM vehicles WHERE id = $1 AND is_active = true', [id]);
    if (vehicleRes.rows.length === 0) {
      return res.status(404).json({ error: 'المركبة غير موجودة' });
    }

    // vehicles don't have a maintenance_schedules FK, store note with vehicle id in description
    const parts = Array.isArray(partsReplaced)
      ? partsReplaced.join(', ')
      : (partsReplaced || '');
    const fullNotes = [
      performedBy ? `نفذ بواسطة: ${performedBy}` : '',
      hoursSpent ? `ساعات العمل: ${hoursSpent}` : '',
      parts ? `قطع الغيار: ${parts}` : ''
    ].filter(Boolean).join(' | ');

    // maintenance_schedules is machine-specific; for vehicles we use machine_id=NULL
    // and embed vehicle id in notes since no vehicle_id FK exists on the table
    const result = await query(
      `INSERT INTO maintenance_schedules
         (machine_id, scheduled_date, type, description, status, cost, notes, created_at, updated_at)
       VALUES (NULL, $1, $2, $3, 'completed', $4, $5, NOW(), NOW())
       RETURNING *`,
      [
        date || new Date().toISOString().split('T')[0],
        type || 'preventive',
        `[مركبة #${id}] ${description}`,
        parseFloat(cost) || 0,
        fullNotes || null
      ]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error recording vehicle maintenance:', error);
    res.status(500).json({ error: 'Failed to record maintenance' });
  }
});

// GET machine maintenance history
router.get('/machines/:id/maintenance-history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         ms.id, ms.scheduled_date, ms.type, ms.description, ms.status, ms.cost, ms.notes
       FROM maintenance_schedules ms
       WHERE ms.machine_id = $1
       ORDER BY ms.scheduled_date DESC`,
      [id]
    );
    const history = result.rows.map(r => {
      const noteParts = (r.notes || '').split(' | ').reduce((acc, part) => {
        if (part.startsWith('نفذ بواسطة: ')) acc.performedBy = part.replace('نفذ بواسطة: ', '');
        if (part.startsWith('ساعات العمل: ')) acc.hoursSpent = part.replace('ساعات العمل: ', '');
        if (part.startsWith('قطع الغيار: ')) acc.partsReplaced = part.replace('قطع الغيار: ', '').split(', ');
        return acc;
      }, {});
      return {
        _id: r.id,
        date: r.scheduled_date,
        type: r.type,
        description: r.description,
        status: r.status,
        cost: r.cost,
        performedBy: noteParts.performedBy || '',
        hoursSpent: noteParts.hoursSpent || '',
        partsReplaced: noteParts.partsReplaced || []
      };
    });
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance history' });
  }
});

// GET vehicle maintenance history
router.get('/vehicles/:id/maintenance-history', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         ms.id, ms.scheduled_date, ms.type, ms.description, ms.status, ms.cost, ms.notes
       FROM maintenance_schedules ms
       WHERE ms.description LIKE $1 AND ms.machine_id IS NULL
       ORDER BY ms.scheduled_date DESC`,
      [`%[مركبة #${id}]%`]
    );
    const history = result.rows.map(r => {
      const noteParts = (r.notes || '').split(' | ').reduce((acc, part) => {
        if (part.startsWith('نفذ بواسطة: ')) acc.performedBy = part.replace('نفذ بواسطة: ', '');
        if (part.startsWith('ساعات العمل: ')) acc.hoursSpent = part.replace('ساعات العمل: ', '');
        if (part.startsWith('قطع الغيار: ')) acc.partsReplaced = part.replace('قطع الغيار: ', '').split(', ');
        return acc;
      }, {});
      return {
        _id: r.id,
        date: r.scheduled_date,
        type: r.type,
        description: r.description,
        status: r.status,
        cost: r.cost,
        performedBy: noteParts.performedBy || '',
        hoursSpent: noteParts.hoursSpent || '',
        partsReplaced: noteParts.partsReplaced || []
      };
    });
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching vehicle maintenance history:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle maintenance history' });
  }
});

// Maintenance schedules
router.get('/maintenance', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT
         ms.id, ms.machine_id, ms.scheduled_date, ms.type, ms.description,
         ms.status, ms.cost, ms.notes, ms.created_at, ms.updated_at,
         m.code as machine_code, COALESCE(NULLIF(m.name_arabic, ''), m.name_english) as machine_name
       FROM maintenance_schedules ms
       JOIN machines m ON ms.machine_id = m.id
       ORDER BY ms.scheduled_date DESC`
    );
    const records = result.rows.map(r => ({
      _id: r.id,
      recordNumber: `MS-${r.id}`,
      title: r.description || r.type,
      asset: { name: r.machine_name, code: r.machine_code },
      maintenanceType: r.type,
      totalCost: r.cost,
      scheduledDate: r.scheduled_date,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at
    }));
    res.json({ records, total: records.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assets/maintenance/stats
router.get('/maintenance/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status='scheduled') as scheduled,
        COUNT(*) FILTER (WHERE status='in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status='completed') as completed,
        COALESCE(SUM(cost) FILTER (WHERE status='completed' AND scheduled_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) as monthly_cost
      FROM maintenance_schedules
    `);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      scheduled: parseInt(row.scheduled),
      in_progress: parseInt(row.in_progress),
      completed: parseInt(row.completed),
      monthlyCost: parseFloat(row.monthly_cost)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;