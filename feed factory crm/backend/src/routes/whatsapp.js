const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// =====================================================================
// WhatsApp Business Cloud API credentials — set these in backend/.env
// =====================================================================
//   WHATSAPP_ACCESS_TOKEN      Permanent or long-lived access token from
//                              your Meta App (System User token recommended
//                              for production, not the 24h test token)
//   WHATSAPP_PHONE_NUMBER_ID   The Phone Number ID of your sending number
//                              (NOT the phone number itself — this is an
//                              internal Meta ID, found in Meta Business
//                              Suite > WhatsApp > API Setup)
//   WHATSAPP_API_VERSION       Optional, defaults to v21.0 below
//
// Get these from: https://developers.facebook.com/apps -> your app ->
// WhatsApp -> API Setup. Until both WHATSAPP_ACCESS_TOKEN and
// WHATSAPP_PHONE_NUMBER_ID are set, isConfigured() is false and every
// send falls back to store-only behavior (logged to the notifications
// table, nothing actually sent) — same as before this fix, so nothing
// breaks for a deployment that hasn't set these up yet.
// =====================================================================
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const isConfigured = () => !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

// Normalize a phone number to the digits-only international format
// WhatsApp's API expects (no +, no spaces, no leading zeros after country code).
const normalizePhone = (raw) => {
  if (!raw) return null;
  return String(raw).replace(/[^\d]/g, '');
};

// Actually calls the WhatsApp Cloud API. Returns { ok, data } — never
// throws, so callers can decide how to handle a failed send (e.g. still
// show the OTP on-screen as a fallback if the real send fails).
const sendWhatsAppMessage = async (to, body) => {
  const phone = normalizePhone(to);
  if (!phone) return { ok: false, error: 'Invalid recipient phone number' };

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[WHATSAPP] Send failed:', data);
      return { ok: false, error: data.error?.message || 'WhatsApp API error', data };
    }
    return { ok: true, data };
  } catch (error) {
    console.error('[WHATSAPP] Send threw:', error.message);
    return { ok: false, error: error.message };
  }
};

// Exported so other route files (e.g. delivery.js, for OTP) can send a
// real message without duplicating the fetch/credential-check logic.
// Attached directly to `router` (not a separate module.exports.x = ...)
// so the single `module.exports = router` at the end of this file
// exposes both the Express router itself AND these helper functions —
// require('./whatsapp') for app.use(), require('./whatsapp').sendWhatsAppMessage
// for direct use elsewhere.
router.sendWhatsAppMessage = sendWhatsAppMessage;
router.isWhatsAppConfigured = isConfigured;

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
    const { to, message, reference_id } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient (to) and message are required' });
    }

    let actuallySent = false;
    let sendError = null;

    if (isConfigured()) {
      const result = await sendWhatsAppMessage(to, message);
      actuallySent = result.ok;
      if (!result.ok) sendError = result.error;
    }

    // Always log the message for conversation history, regardless of
    // whether the real send succeeded — this preserves the existing
    // /conversations behavior either way.
    await query(`
      INSERT INTO notifications (user_id, title, message, type, reference_id, is_read)
      VALUES ($1, $2, $3, 'whatsapp', $4, true)
    `, [req.user.id, `إلى: ${to}`, message, reference_id || to]);

    res.json({
      configured: isConfigured(),
      success: actuallySent,
      message: actuallySent ? 'Message sent' : (isConfigured() ? `Send failed: ${sendError}` : 'WhatsApp not configured — message logged only, not sent'),
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
    `, [`من: ${from}`, message, from]);

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;
