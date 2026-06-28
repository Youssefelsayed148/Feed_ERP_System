/**
 * Migration: add suppliers.credit_days
 *
 * Root cause: backend/routes/payables.js (GET / and GET /dashboard) selects
 * s.credit_days from suppliers, but that column was never created — only
 * payment_terms (a free-text field like "Net 30" or "نقدي") exists. This
 * crashed both /api/payables and /api/payables/dashboard with a Postgres
 * "column does not exist" error every time either page loaded.
 *
 * credit_days is added as a real numeric field so future aging/due-date
 * calculations in Payables can do actual date math, separate from the
 * free-text payment_terms field which stays untouched.
 *
 * Run on Windows: cd backend && node src/scripts/add-supplier-credit-days.js
 */

require('dotenv').config();
const { query } = require('../config/database');

async function run() {
  console.log('Adding credit_days column to suppliers table...\n');

  try {
    await query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 30`);
    console.log('  OK  suppliers.credit_days (INTEGER DEFAULT 30)');
  } catch (error) {
    console.error('  FAILED  suppliers.credit_days:', error.message);
  }

  console.log('\nDone. Verifying...\n');

  const verify = await query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'credit_days'
  `);
  console.log('suppliers.credit_days:', verify.rows[0] || 'NOT FOUND');

  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});