const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// Official role list per Al-Khair CRM Employee Access & Permissions doc (v2.0)
const VALID_ROLES = [
  'owner', 'admin',
  'sales_manager', 'sales_rep',
  'purchasing_mgr',
  'production_mgr', 'production_asst',
  'finance_manager', 'accountant', 'cost_accountant',
  'maintenance_mgr', 'maintenance_tech',
  'legal_mgr', 'legal_officer',
  'driver', 'logistics_coordinator'
];

router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, phone, department, is_active, created_at, updated_at
       FROM users ORDER BY name`
    );
    res.json({ users: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, phone, department, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Create a new employee account.
// Owner/admin only. This is the ONLY place privileged roles should be assigned
// (never via the public /api/auth/register endpoint).
router.post('/', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { name, email: rawEmail, password, role, department, phone } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, department, phone, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, role, department, phone, is_active, created_at`,
      [name, email, password_hash, role, department || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update an employee account (role, department, active status).
// Owner/admin only.
router.put('/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = ['name', 'role', 'department', 'phone', 'is_active'];
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
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}
       RETURNING id, name, email, role, department, phone, is_active, updated_at`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Deactivate (not hard-delete) an employee account.
// Owner/admin only. Soft delete preserves audit trail / created_by references.
router.delete('/:id', authenticate, authorize('owner', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
       RETURNING id, name, email, is_active`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
