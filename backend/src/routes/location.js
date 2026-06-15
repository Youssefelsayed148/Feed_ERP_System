const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// POST /api/location/log - Log user location
router.post('/log', authenticate, async (req, res) => {
  try {
    const { latitude, longitude, accuracy, context } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'Coordinates required' });
    await query(
      `INSERT INTO user_locations (user_id, latitude, longitude, accuracy, context)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, parseFloat(latitude), parseFloat(longitude), parseFloat(accuracy || 0), context || 'page_load']
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/location/users - Get latest location for active users today
router.get('/users', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT DISTINCT ON (ul.user_id) ul.user_id, u.name, u.role,
        ul.latitude, ul.longitude, ul.created_at as last_seen
      FROM user_locations ul
      JOIN users u ON ul.user_id = u.id
      WHERE ul.created_at > CURRENT_DATE - INTERVAL '1 day'
      ORDER BY ul.user_id, ul.created_at DESC
    `);
    res.json({ success: true, locations: result.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
