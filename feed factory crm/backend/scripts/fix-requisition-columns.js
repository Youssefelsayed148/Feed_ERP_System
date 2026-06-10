const { query } = require('../src/config/database');

async function addColumn(col, def) {
  try {
    await query(`ALTER TABLE requisition_items ADD COLUMN ${col} ${def}`);
    console.log(`  ✓ Added ${col}`);
  } catch (e) {
    if (e.message.includes('already exists')) console.log(`  - ${col} already exists`);
    else throw e;
  }
}

async function fix() {
  console.log('Adding missing columns to requisition_items...');
  await addColumn('suggested_quantity', 'NUMERIC(12,3) DEFAULT 0');
  await addColumn('unit_price', 'NUMERIC(10,2) DEFAULT 0');
  await addColumn('total_cost', 'NUMERIC(12,2) DEFAULT 0');
  await addColumn('supplier_id', 'INTEGER');
  await addColumn('supplier_name', 'VARCHAR(200)');
  await addColumn('purchase_order_id', 'INTEGER');

  // Also fix requisitions table
  try {
    await query(`ALTER TABLE requisitions ADD COLUMN total_items INTEGER DEFAULT 0`);
    console.log('  ✓ Added total_items to requisitions');
  } catch (e) {
    if (e.message.includes('already exists')) console.log('  - total_items already exists');
    else throw e;
  }
  try {
    await query(`ALTER TABLE requisitions ADD COLUMN total_cost NUMERIC(12,2) DEFAULT 0`);
    console.log('  ✓ Added total_cost to requisitions');
  } catch (e) {
    if (e.message.includes('already exists')) console.log('  - total_cost already exists');
    else throw e;
  }

  console.log('\nDone.');
  process.exit(0);
}
fix().catch(e => { console.error(e); process.exit(1); });
