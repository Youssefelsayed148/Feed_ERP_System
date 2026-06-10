const { query } = require('../config/database');

// Log any user action to activity_log table
async function logActivity({ userId, userName, userRole, action, module, description, entityId, entityType, amount, oldStatus, newStatus }) {
  try {
    await query(
      `INSERT INTO activity_log (user_id, user_name, user_role, action, module, description, entity_id, entity_type, amount, old_status, new_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [userId, userName, userRole, action, module, description, entityId, entityType, amount, oldStatus, newStatus]
    );
  } catch (error) {
    console.error('[ACTIVITY_LOG] Failed to log:', error.message);
  }
}

// Get recent activities for dashboard feed
async function getRecentActivities(limit = 20) {
  try {
    const result = await query(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('[ACTIVITY_LOG] Failed to fetch:', error.message);
    return [];
  }
}

// Get activities by user
async function getUserActivities(userId, limit = 20) {
  try {
    const result = await query(
      `SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (error) {
    return [];
  }
}

// Get activities by module
async function getModuleActivities(module, limit = 20) {
  try {
    const result = await query(
      `SELECT * FROM activity_log WHERE module = $1 ORDER BY created_at DESC LIMIT $2`,
      [module, limit]
    );
    return result.rows;
  } catch (error) {
    return [];
  }
}

module.exports = { logActivity, getRecentActivities, getUserActivities, getModuleActivities };
