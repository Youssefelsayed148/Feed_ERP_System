const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const result = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1 OR (user_id IS NULL AND role = $2)
       ORDER BY created_at DESC LIMIT 50`,
      [userId, role]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const result = await query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE (user_id = $1 OR (user_id IS NULL AND role = $2))
       AND is_read = false`,
      [userId, role]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/notifications/module/:module
router.get('/module/:module', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { module } = req.params;
    const result = await query(
      `SELECT * FROM notifications
       WHERE module = $1 AND (user_id = $2 OR (user_id IS NULL AND role = $3))
       ORDER BY created_at DESC LIMIT 20`,
      [module, userId, role]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching module notifications:', error);
    res.status(500).json({ error: 'Failed to fetch module notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 OR (user_id IS NULL AND role = $2)',
      [userId, role]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await query(
      'DELETE FROM notifications WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [id, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
