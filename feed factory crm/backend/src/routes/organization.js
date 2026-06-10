const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.get('/company', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM companies LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
