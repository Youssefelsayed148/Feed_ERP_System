const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET all employees
router.get('/', authenticate, async (req, res) => {
  try {
    const { department, status, search } = req.query;
    let sql = `
      SELECT e.*, u.email as user_email, u.role as user_role, u.phone as user_phone
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;
    
    if (department) {
      sql += ` AND e.department = $${idx++}`;
      params.push(department);
    }
    if (status) {
      sql += ` AND e.status = $${idx++}`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (e.name ILIKE $${idx} OR e.title ILIKE $${idx})`;
      params.push(`%${search}%`);
    }
    
    sql += ` ORDER BY e.department, e.name`;
    
    const result = await query(sql, params);
    res.json({ employees: result.rows, total: result.rowCount });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single employee
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, u.email as user_email, u.role as user_role, u.phone as user_phone
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET departments list
router.get('/departments/stats', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT department, COUNT(*) as count, COUNT(*) FILTER (WHERE status = 'active') as active_count
      FROM employees
      GROUP BY department
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
