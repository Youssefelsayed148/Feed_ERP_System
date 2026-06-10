const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'al_kheir_feed_factory',
    user: 'postgres',
    password: ''
  });

  try {
    // Update PO delivery dates to realistic 2026 dates
    await pool.query(`
      UPDATE purchase_orders SET delivery_date = '2026-03-15' WHERE po_number = 'PO-2025-001';
      UPDATE purchase_orders SET delivery_date = '2026-03-10' WHERE po_number = 'PO-2025-002';
      UPDATE purchase_orders SET delivery_date = '2026-03-20' WHERE po_number = 'PO-2025-003';
      UPDATE purchase_orders SET delivery_date = '2026-03-12' WHERE po_number = 'PO-2025-004';
      UPDATE purchase_orders SET delivery_date = '2026-04-01' WHERE po_number = 'PO-2025-005';
    `);
    console.log('Updated PO delivery dates');

    // Update payables due dates for realistic aging relative to 2026-05-11
    // id 1: completed -> past due but excluded from aging
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-03-20' WHERE id = 1`);
    // id 2: completed -> past due but excluded
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-04-05' WHERE id = 2`);
    // id 3: partial, balance 3130000 -> due in 3 days (current)
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-05-14' WHERE id = 3`);
    // id 4: pending, balance 1231200 -> due in 14 days (current)
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-05-25' WHERE id = 4`);
    // id 5: pending, balance 3990000 -> due in 21 days (current)
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-06-01' WHERE id = 5`);
    // id 6: overdue, balance 1500000 -> overdue 21 days (1-30)
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-04-20' WHERE id = 6`);
    // id 7: partial, balance 1800000 -> overdue 56 days (31-60)
    await pool.query(`UPDATE supplier_payables SET due_date = '2026-03-15' WHERE id = 7`);
    console.log('Updated payable due dates');

    // Also update any overdue statuses based on new dates
    await pool.query(`
      UPDATE supplier_payables SET status = 'overdue'
      WHERE status IN ('pending', 'partial') AND due_date < CURRENT_DATE;
    `);
    console.log('Synced overdue statuses');

    // Verify
    const res = await pool.query(`
      SELECT id, status, due_date, balance,
        CASE 
          WHEN due_date >= CURRENT_DATE THEN 'current'
          WHEN CURRENT_DATE - due_date <= 30 THEN '1-30'
          WHEN CURRENT_DATE - due_date <= 60 THEN '31-60'
          WHEN CURRENT_DATE - due_date <= 90 THEN '61-90'
          ELSE '90+'
        END as bucket
      FROM supplier_payables
      WHERE status IN ('pending', 'partial', 'overdue')
      ORDER BY id;
    `);
    console.log('\nPayables aging after fix:');
    for (const row of res.rows) {
      console.log(`  id=${row.id} status=${row.status} due=${row.due_date} balance=${row.balance} bucket=${row.bucket}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
