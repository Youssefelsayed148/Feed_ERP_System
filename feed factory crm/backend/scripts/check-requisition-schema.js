const { query } = require('../src/config/database');

async function check() {
  const r = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'requisition_items' ORDER BY ordinal_position`);
  console.log('requisition_items columns:');
  for (const c of r.rows) console.log(`  ${c.column_name} (${c.data_type})`);
  process.exit(0);
}
check();
