const { query } = require('../src/config/database');

async function checkSchema() {
  try {
    console.log('Checking database schema...\n');
    
    const tables = ['feed_types', 'raw_materials', 'clients', 'sales_orders', 'invoices'];
    
    for (const table of tables) {
      try {
        const result = await query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table]);
        
        console.log(`\n📋 ${table}:`);
        result.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type}`);
        });
      } catch (e) {
        console.log(`\n❌ ${table}: ${e.message}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema();
