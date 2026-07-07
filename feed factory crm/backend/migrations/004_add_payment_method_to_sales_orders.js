require('dotenv').config();
const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      ALTER TABLE sales_orders
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) DEFAULT 'credit' CHECK (payment_method IN ('cash', 'credit'))
    `);
    console.log('[MIGRATION 004] Added payment_method to sales_orders');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION 004] Failed:', error.message);
    process.exit(1);
  }
}

migrate();
