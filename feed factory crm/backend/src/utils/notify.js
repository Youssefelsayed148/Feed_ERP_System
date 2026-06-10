const { query } = require('../config/database');

async function createNotification({ userId, role, module, type, title, message, referenceId, referenceType }) {
  try {
    let sql, params;
    if (userId) {
      sql = `INSERT INTO notifications (user_id, role, module, type, title, message, reference_id, reference_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
      params = [userId, role || null, module, type, title, message, referenceId || null, referenceType || null];
    } else if (role) {
      sql = `INSERT INTO notifications (role, module, type, title, message, reference_id, reference_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
      params = [role, module, type, title, message, referenceId || null, referenceType || null];
    } else {
      return null;
    }
    const result = await query(sql, params);
    return result.rows[0].id;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
}

async function notifyRole(role, { module, type, title, message, referenceId, referenceType }) {
  return createNotification({ role, module, type, title, message, referenceId, referenceType });
}

async function notifyUser(userId, { module, type, title, message, referenceId, referenceType }) {
  return createNotification({ userId, module, type, title, message, referenceId, referenceType });
}

module.exports = { createNotification, notifyRole, notifyUser };
