const { query } = require('../src/config/database');

async function migrate() {
  try {
    // 1. Drop FK constraint on payroll_records.user_id
    try {
      await query(`ALTER TABLE payroll_records DROP CONSTRAINT payroll_records_user_id_fkey`);
      console.log('✓ Dropped FK constraint payroll_records_user_id_fkey');
    } catch (e) {
      if (e.message.includes('does not exist')) {
        console.log('- FK constraint already removed');
      } else {
        throw e;
      }
    }

    // 2. Delete all existing payroll periods and records
    await query('DELETE FROM payroll_records');
    await query('DELETE FROM payroll_periods');
    console.log('✓ Deleted all existing payroll records and periods');

    console.log('\nMigration complete. Payroll can now use employee IDs directly.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
