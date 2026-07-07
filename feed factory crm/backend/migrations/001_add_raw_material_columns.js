require('dotenv').config();
const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      ALTER TABLE raw_materials
      ADD COLUMN IF NOT EXISTS restock_quantity DECIMAL(12,3) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS preferred_supplier_id INTEGER REFERENCES suppliers(id) DEFAULT NULL
    `);
    console.log('[MIGRATION 001] Added restock_quantity and preferred_supplier_id to raw_materials');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION 001] Failed:', error.message);
    process.exit(1);
  }
}

migrate();
