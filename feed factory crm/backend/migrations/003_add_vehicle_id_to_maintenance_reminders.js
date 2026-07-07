require('dotenv').config();
const { query } = require('../src/config/database');

async function migrate() {
  try {
    await query(`
      ALTER TABLE maintenance_reminders
      ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE
    `);
    await query(`
      ALTER TABLE maintenance_reminders
      ADD CONSTRAINT chk_machine_or_vehicle
      CHECK ((machine_id IS NOT NULL AND vehicle_id IS NULL) OR
             (machine_id IS NULL AND vehicle_id IS NOT NULL))
    `);
    console.log('[MIGRATION 003] Added vehicle_id to maintenance_reminders and chk_machine_or_vehicle constraint');
    process.exit(0);
  } catch (error) {
    console.error('[MIGRATION 003] Failed:', error.message);
    process.exit(1);
  }
}

migrate();
