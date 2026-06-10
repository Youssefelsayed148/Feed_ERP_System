const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const isConfigured = () => !!process.env.WHATSAPP_ACCESS_TOKEN;

// GET /api/whatsapp/conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.json({ configured: false });
    }

    // Use notifications table as conversation history
    const result = await query(`
      SELECT 
        id,
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        created_at
      FROM notifications
      WHERE type = 'whatsapp'
      ORDER BY created_at DESC
      LIMIT 200
    `);

    // Group by reference_id (conversation identifier / phone)
    const conversations = {};
    result.rows.forEach(row => {
      const key = row.reference_id || 'unknown';
      if (!conversations[key]) {
        conversations[key] = {
          reference_id: key,
          messages: [],
          last_message_at: row.created_at
        };
      }
      conversations[key].messages.push(row);
      if (new Date(row.created_at) > new Date(conversations[key].last_message_at)) {
        conversations[key].last_message_at = row.created_at;
      }
    });

    res.json({
      configured: true,
      conversations: Object.values(conversations)
    });
  } catch (error) {
    console.error('Error fetching WhatsApp conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/whatsapp/conversations/:id
router.get('/conversations/:id', authenticate, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.json({ configured: false });
    }

    const { id } = req.params;
    const result = await query(`
      SELECT 
        id,
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read,
        created_at
      FROM notifications
      WHERE type = 'whatsapp' AND reference_id = $1
      ORDER BY created_at ASC
    `, [id]);

    res.json({
      configured: true,
      reference_id: id,
      messages: result.rows
    });
  } catch (error) {
    console.error('Error fetching WhatsApp conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/whatsapp/send
router.post('/send', authenticate, async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.json({ configured: false });
    }

    const { to, message, reference_id } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient (to) and message are required' });
    }

    // Store outgoing message in notifications table
    await query(`
      INSERT INTO notifications (user_id, title, message, type, reference_id, is_read)
      VALUES ($1, $2, $3, 'whatsapp', $4, true)
    `, [req.user.id, `To: ${to}`, message, reference_id || to]);

    res.json({
      configured: true,
      success: true,
      message: 'Message queued for sending',
      to,
      body: message
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/whatsapp/webhook - Incoming webhook (no auth required)
router.post('/webhook', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ configured: false, error: 'WhatsApp not configured' });
    }

    const { from, message, timestamp } = req.body;
    if (!from || !message) {
      return res.status(400).json({ error: 'from and message are required' });
    }

    // Store incoming message in notifications table
    await query(`
      INSERT INTO notifications (user_id, title, message, type, reference_id, is_read)
      VALUES (NULL, $1, $2, 'whatsapp', $3, false)
    `, [`From: ${from}`, message, from]);

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;
