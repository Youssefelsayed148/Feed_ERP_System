const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const SECRET = process.env.JWT_SECRET || 'feed-factory-secret-key-2026';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    
    // Get user from PostgreSQL using real column names
    const result = await query(
      'SELECT id, email, name, role, department, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = result.rows[0];
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department
    };
    req.token = token;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Owner and admin bypass role checks
    if (req.user.role === 'owner' || req.user.role === 'admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
