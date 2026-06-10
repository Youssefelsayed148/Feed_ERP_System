require('dotenv').config();
const { query } = require('./src/config/database');

async function test() {
  const tests = [
    ['clients assigned_to',
     `SELECT id, name_english, assigned_to, is_active
      FROM clients LIMIT 3`],
    ['sales_orders columns',
     `SELECT id, order_number, status, final_amount,
      approved_by, rejection_reason FROM sales_orders LIMIT 3`],
    ['invoices columns',
     `SELECT id, invoice_number, amount, paid_amount,
      balance_due, status FROM invoices LIMIT 3`],
    ['reminders columns',
     `SELECT id, client_id, sales_rep_id, title,
      reminder_type, status FROM reminders LIMIT 3`],
    ['client_payment_history',
     `SELECT id, client_id, amount, method,
      collected_by FROM client_payment_history LIMIT 3`],
    ['dashboard stats query',
     `SELECT
       (SELECT COUNT(*) FROM clients WHERE is_active=true)
         as total_clients,
       (SELECT COUNT(*) FROM sales_orders)
         as total_orders,
       (SELECT COALESCE(SUM(final_amount),0)
        FROM sales_orders WHERE status='delivered')
         as total_revenue,
       (SELECT COUNT(*) FROM sales_orders
        WHERE status='pending_approval')
         as pending_approvals`]
  ];

  for (const [name, sql] of tests) {
    try {
      const r = await query(sql);
      console.log('OK  ', name, '->', JSON.stringify(r.rows[0]));
    } catch(e) {
      console.error('FAIL', name, '->', e.message);
    }
  }
  process.exit(0);
}
test().catch(console.error);
