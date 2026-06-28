const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');

// GET /api/reminders/invoices - Get upcoming/due invoice reminders grouped by sales rep
router.get('/invoices', authenticate, async (req, res) => {
  try {
    // Invoices due in 10 days, 5 days, and overdue
    const result = await query(`
      SELECT i.id, i.invoice_number, i.amount, i.balance_due, i.due_date, i.status,
        c.name_arabic as client_name, c.phone as client_phone, c.assigned_to as sales_rep_id,
        u.name as sales_rep_name,
        CASE 
          WHEN i.due_date = CURRENT_DATE THEN 'due_today'
          WHEN i.due_date = CURRENT_DATE + INTERVAL '5 days' THEN 'due_in_5'
          WHEN i.due_date = CURRENT_DATE + INTERVAL '10 days' THEN 'due_in_10'
          WHEN i.due_date < CURRENT_DATE AND i.balance_due > 0 THEN 'overdue'
          ELSE 'other'
        END as reminder_type,
        (i.due_date - CURRENT_DATE) as days_until_due
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN users u ON c.assigned_to = u.id
      WHERE i.balance_due > 0
        AND (
          i.due_date = CURRENT_DATE
          OR i.due_date = CURRENT_DATE + INTERVAL '5 days'
          OR i.due_date = CURRENT_DATE + INTERVAL '10 days'
          OR (i.due_date < CURRENT_DATE AND i.status != 'paid')
        )
      ORDER BY i.due_date ASC
    `);
    
    // Group by sales rep
    const byRep = {};
    for (const inv of result.rows) {
      const repId = inv.sales_rep_id || 0;
      if (!byRep[repId]) byRep[repId] = { 
        rep_name: inv.sales_rep_name || 'Unassigned', 
        rep_id: repId,
        invoices: [],
        overdue_count: 0,
        due_today_count: 0,
        due_in_5_count: 0,
        due_in_10_count: 0
      };
      byRep[repId].invoices.push(inv);
      if (inv.reminder_type === 'overdue') byRep[repId].overdue_count++;
      if (inv.reminder_type === 'due_today') byRep[repId].due_today_count++;
      if (inv.reminder_type === 'due_in_5') byRep[repId].due_in_5_count++;
      if (inv.reminder_type === 'due_in_10') byRep[repId].due_in_10_count++;
    }
    
    res.json({ success: true, reminders: Object.values(byRep), total: result.rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/reminders/send - Send WhatsApp reminder for an invoice
router.post('/send', authenticate, async (req, res) => {
  try {
    const { invoice_id, message } = req.body;
    const result = await query(`
      SELECT i.invoice_number, i.amount, i.balance_due, i.due_date,
        c.name_arabic as client_name, c.phone as client_phone
      FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.id = $1
    `, [invoice_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const inv = result.rows[0];
    const text = message || `Dear ${inv.client_name}, invoice ${inv.invoice_number} for ${inv.amount} is due on ${new Date(inv.due_date).toLocaleDateString()}. Balance: ${inv.balance_due}`;
    // Log the reminder
    await query(
      `INSERT INTO activity_log (user_id, action, module, description) VALUES ($1, 'sent_reminder', 'sales', $2)`,
      [req.user.id, `Sent payment reminder for invoice ${inv.invoice_number} to ${inv.client_name}`]
    );
    res.json({ success: true, message: text, phone: inv.client_phone });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;