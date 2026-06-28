const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, role: user.role, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Helper to return safe user object (no password_hash)
const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  modulePermissions: Array.isArray(user.module_permissions)
    ? user.module_permissions
    : (user.module_permissions ? JSON.parse(user.module_permissions) : [])
});

// POST /api/auth/register
// SECURITY: This is a public, unauthenticated endpoint. It must NEVER trust
// role/department from the request body — doing so allows anyone to create
// an owner/admin account with no authentication at all. All accounts created
// here are forced to the lowest-privilege role. Privileged accounts (manager
// roles, admin, owner) must be created by an existing admin/owner via
// Settings -> User Management (see POST /api/users below), not via this route.
router.post('/register', async (req, res) => {
  try {
    const { name, email: rawEmail, password } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Role and department are NEVER taken from the request body here.
    // Self-registered accounts always get the lowest-privilege role.
    // An admin/owner must promote the account afterward via User Management.
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, department, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, 'sales_rep', 'Sales', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, role, department, is_active, created_at`,
      [name, email, password_hash]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email: rawEmail, password } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Query user with real column names
    const result = await query(
      `SELECT id, email, password_hash, name, role, department, is_active, module_permissions
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account disabled' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user);

    res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, name, role, department, is_active, last_login, created_at, updated_at, module_permissions
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(safeUser(user));
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;