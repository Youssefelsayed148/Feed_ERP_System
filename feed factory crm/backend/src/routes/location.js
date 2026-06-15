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

module.exports = router;
