const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/location/factory-config - Get factory geofence coordinates
router.get('/factory-config', authenticate, async (req, res) => {
  try {
    const result = await query("SELECT key, value FROM system_config WHERE key IN ('factory_latitude','factory_longitude','factory_geofence_radius')");
    const config = {};
    result.rows.forEach(r => { config[r.key.replace('factory_','')] = r.value; });
    res.json({ success: true, ...config });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/location/factory-config - Update factory coordinates
router.post('/factory-config', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;
    if (latitude) await query("INSERT INTO system_config (key, value) VALUES ('factory_latitude',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [String(latitude)]);
    if (longitude) await query("INSERT INTO system_config (key, value) VALUES ('factory_longitude',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [String(longitude)]);
    if (radius) await query("INSERT INTO system_config (key, value) VALUES ('factory_geofence_radius',$1) ON CONFLICT (key) DO UPDATE SET value=$1", [String(radius)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/location/auto-checkin - Auto clock-in when entering factory
router.post('/auto-checkin', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, distance } = req.body;
    // Check if already clocked in today
    const existing = await query(
      "SELECT id FROM attendance_records WHERE user_id=$1 AND date=CURRENT_DATE AND check_out IS NULL LIMIT 1",
      [req.user.id]
    );
    if (existing.rows.length > 0) return res.json({ success: true, message: 'Already clocked in' });
    
    await query(
      `INSERT INTO attendance_records (user_id, date, check_in, check_in_lat, check_in_lng, check_in_distance, source)
       VALUES ($1, CURRENT_DATE, NOW(), $2, $3, $4, 'geofence')`,
      [req.user.id, latitude, longitude, distance || 0]
    );
    res.json({ success: true, message: 'Auto clocked in' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/location/auto-checkout - Auto clock-out when leaving factory
router.post('/auto-checkout', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, distance } = req.body;
    const existing = await query(
      "SELECT id FROM attendance_records WHERE user_id=$1 AND date=CURRENT_DATE AND check_out IS NULL LIMIT 1",
      [req.user.id]
    );
    if (existing.rows.length === 0) return res.json({ success: true, message: 'No active session' });
    
    await query(
      `UPDATE attendance_records SET check_out=NOW(), check_out_lat=$1, check_out_lng=$2, check_out_distance=$3, source='geofence'
       WHERE id=$4`,
      [latitude, longitude, distance || 0, existing.rows[0].id]
    );
    res.json({ success: true, message: 'Auto clocked out' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/location/log — driver location ping (drivers with active deliveries only)
router.post('/log', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, context, delivery_id } = req.body;

    if (req.user.role !== 'driver') {
      return res.json({ success: true, skipped: true, reason: 'not_driver' });
    }

    await query(
      `INSERT INTO driver_locations (driver_user_id, delivery_id, latitude, longitude, accuracy, context)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, delivery_id || null, latitude, longitude, accuracy || null, context || null]
    );

    res.json({ success: true, logged: true });
  } catch (e) {
    console.error('[location] Failed to log location:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/location/users — latest known location per driver
router.get('/users', authenticate, async (req, res) => {
  try {
    const { delivery_id } = req.query;
    let sql;
    let params = [];

    if (delivery_id) {
      sql = `
        SELECT dl.driver_user_id, dl.delivery_id, dl.latitude, dl.longitude, dl.accuracy,
               dl.context, dl.created_at, COALESCE(e.name, u.name) as driver_name
        FROM driver_locations dl
        JOIN users u ON u.id = dl.driver_user_id
        LEFT JOIN employees e ON e.user_id = u.id OR e.id = u.id
        WHERE dl.delivery_id = $1
        ORDER BY dl.created_at DESC`;
      params = [delivery_id];
    } else {
      sql = `
        SELECT DISTINCT ON (dl.driver_user_id)
               dl.driver_user_id, dl.delivery_id, dl.latitude, dl.longitude, dl.accuracy,
               dl.context, dl.created_at, COALESCE(e.name, u.name) as driver_name
        FROM driver_locations dl
        JOIN users u ON u.id = dl.driver_user_id
        LEFT JOIN employees e ON e.user_id = u.id OR e.id = u.id
        ORDER BY dl.driver_user_id, dl.created_at DESC`;
    }

    const result = await query(sql, params);
    res.json({ success: true, locations: result.rows });
  } catch (e) {
    console.error('[location] Failed to fetch locations:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
