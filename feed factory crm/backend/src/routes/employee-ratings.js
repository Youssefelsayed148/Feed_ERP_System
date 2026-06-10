const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, phone, department, is_active, created_at
       FROM users WHERE is_active = true AND role NOT IN ('owner','admin')
       ORDER BY name`
    );
    res.json({ employees: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
