const { query } = require('../config/database');

async function resetDatabase() {
  try {
    console.log('🔄 Resetting Al Kheir Feed Factory CRM Database...');

    // Drop all tables in reverse dependency order
    const tables = [
      'deliveries',
      'vehicles',
      'machines',
      'finished_goods',
      'production_orders',
      'stock_movements',
      'expenses',
      'payables',
      'invoices',
      'sales_orders',
      'goods_receipt_notes',
      'purchase_orders',
      'clients',
      'feed_recipes',
      'feed_types',
      'raw_materials',
      'suppliers',
      'organizations',
      'users'
    ];

    for (const table of tables) {
      try {
        await query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Dropped table: ${table}`);
      } catch (error) {
        console.log(`⚠️  Could not drop table ${table}:`, error.message);
      }
    }

    console.log('✅ Database reset completed!');
    return true;

  } catch (error) {
    console.error('❌ Database reset failed:', error);
    throw error;
  }
}

// Export for use in scripts
module.exports = { resetDatabase };

// Run if called directly
if (require.main === module) {
  resetDatabase()
    .then(() => {
      console.log('🎉 Database reset completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database reset failed:', error);
      process.exit(1);
    });
}