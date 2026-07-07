require('dotenv').config();
const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      ALTER TABLE production_orders
      ADD COLUMN IF NOT EXISTS materials_deducted BOOLEAN DEFAULT false
    `);
    console.log('[MIGRATION 002] Added materials_deducted to production_orders');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION 002] Failed:', error.message);
    process.exit(1);
  }
}

migrate();
