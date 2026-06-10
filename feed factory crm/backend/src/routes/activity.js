const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { getRecentActivities, getUserActivities, getModuleActivities, logActivity } = require('../utils/activity');

// GET /api/activity - Recent activities feed
router.get('/', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const activities = await getRecentActivities(limit);
    
    res.json({
      success: true,
      activities: activities.map(a => ({
        id: a.id,
        userId: a.user_id,
        userName: a.user_name,
        userRole: a.user_role,
        action: a.action,
        module: a.module,
        description: a.description,
        entityId: a.entity_id,
        entityType: a.entity_type,
        amount: parseFloat(a.amount) || 0,
        oldStatus: a.old_status,
        newStatus: a.new_status,
        createdAt: a.created_at
      })),
      total: activities.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/activity/stats - Activity statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    // Today's activity count by module
    const moduleStats = await query(`
      SELECT module, COUNT(*) as count
      FROM activity_log
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY module
      ORDER BY count DESC
    `);
    
    // Today's activity count by user
    const userStats = await query(`
      SELECT user_name, user_role, COUNT(*) as count
      FROM activity_log
      WHERE DATE(created_at) = CURRENT_DATE
      GROUP BY user_name, user_role
      ORDER BY count DESC
    `);
    
    // Total today
    const todayCount = await query(`
      SELECT COUNT(*) as count FROM activity_log WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    res.json({
      success: true,
      todayTotal: parseInt(todayCount.rows[0].count),
      byModule: moduleStats.rows,
      byUser: userStats.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/activity/user/:userId - User specific activities
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await getUserActivities(req.params.userId, limit);
    res.json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/activity/module/:module - Module specific activities
router.get('/module/:module', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await getModuleActivities(req.params.module, limit);
    res.json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
