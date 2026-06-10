const { query } = require('../src/config/database');

async function fix() {
  // Create requisitions table if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS requisitions (
      id SERIAL PRIMARY KEY,
      requisition_number VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'draft',
      total_items INTEGER DEFAULT 0,
      total_cost NUMERIC(12,2) DEFAULT 0,
      notes TEXT,
      sent_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Created requisitions table');

  // Create requisition_items table if not exists
  await query(`
    CREATE TABLE IF NOT EXISTS requisition_items (
      id SERIAL PRIMARY KEY,
      requisition_id INTEGER REFERENCES requisitions(id) ON DELETE CASCADE,
      raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
      suggested_quantity NUMERIC(12,3) DEFAULT 0,
      quantity NUMERIC(12,3) DEFAULT 0,
      unit_price NUMERIC(10,2) DEFAULT 0,
      total_cost NUMERIC(12,2) DEFAULT 0,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name VARCHAR(200),
      status VARCHAR(20) DEFAULT 'pending',
      purchase_order_id INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ Created requisition_items table with suggested_quantity column');

  console.log('\nSchema fix complete.');
  process.exit(0);
}

fix().catch(e => { console.error(e); process.exit(1); });
