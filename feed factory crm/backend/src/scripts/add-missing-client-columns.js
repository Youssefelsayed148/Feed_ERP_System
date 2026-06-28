/**
 * Migration: Add missing columns to clients and feed_recipes tables,
 * plus create the missing system_config table
 *
 * PART 1 — clients table
 * The create-client form (frontend/src/pages/Clients.js) collects fields that
 * were never added to the `clients` table schema, causing every client
 * creation to fail with a 500 error ("column ... does not exist").
 * Missing columns: contact_person, discount, avg_consumption,
 * favorite_feed_type_id, license_number, notes, storage_location
 *
 * PART 2 — feed_recipes table
 * Three separate backend route handlers (backend/routes/feed-types.js,
 * backend/routes/feed-recipes-pg.js GET /recipes, GET /recipes/:id) all
 * reference fr.selling_price as a manual price-override feature, but the
 * column was never added to feed_recipes. This caused the Feed Recipes page
 * to 500 on load and silently broke price overrides elsewhere.
 * Missing column: selling_price
 *
 * PART 3 — system_config table
 * backend/routes/location.js reads/writes a system_config key-value table
 * for factory geofence settings (latitude, longitude, radius), but the
 * table was never created. This caused GET /api/location/factory-config
 * to 500 on every page that loads it (observed on the Clients page).
 *
 * Run on Windows: cd backend && node scripts/add-missing-client-columns.js
 */

require('dotenv').config();
const { query } = require('../config/database');

async function run() {
  console.log('Adding missing columns to clients table...\n');

  const clientColumns = [
    { name: 'contact_person', ddl: 'VARCHAR(100)' },
    { name: 'discount', ddl: 'DECIMAL(5,2) DEFAULT 0' },
    { name: 'avg_consumption', ddl: 'DECIMAL(10,2) DEFAULT 0' },
    { name: 'favorite_feed_type_id', ddl: 'INTEGER REFERENCES feed_types(id) ON DELETE SET NULL' },
    { name: 'license_number', ddl: 'VARCHAR(100)' },
    { name: 'notes', ddl: 'TEXT' },
    { name: 'storage_location', ddl: 'VARCHAR(200)' },
  ];

  for (const col of clientColumns) {
    try {
      await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${col.name} ${col.ddl}`);
      console.log(`  OK  clients.${col.name} (${col.ddl})`);
    } catch (error) {
      console.error(`  FAILED  clients.${col.name}:`, error.message);
      process.exitCode = 1;
    }
  }

  console.log('\nAdding missing column to feed_recipes table...\n');

  try {
    await query(`ALTER TABLE feed_recipes ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2)`);
    console.log('  OK  feed_recipes.selling_price (DECIMAL(12,2))');
  } catch (error) {
    console.error('  FAILED  feed_recipes.selling_price:', error.message);
    process.exitCode = 1;
  }

  console.log('\nCreating system_config table if missing...\n');

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('  OK  system_config table ready');
  } catch (error) {
    console.error('  FAILED  system_config:', error.message);
    process.exitCode = 1;
  }

  console.log('\nDone. Verifying final column lists...\n');

  const clientsResult = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'clients'
    ORDER BY ordinal_position
  `);
  console.log('clients:');
  for (const row of clientsResult.rows) {
    console.log(`  ${row.column_name} (${row.data_type})`);
  }

  const recipesResult = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'feed_recipes'
    ORDER BY ordinal_position
  `);
  console.log('\nfeed_recipes:');
  for (const row of recipesResult.rows) {
    console.log(`  ${row.column_name} (${row.data_type})`);
  }

  const configResult = await query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'system_config'
    ORDER BY ordinal_position
  `);
  console.log('\nsystem_config:');
  for (const row of configResult.rows) {
    console.log(`  ${row.column_name} (${row.data_type})`);
  }

  process.exit(process.exitCode || 0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});