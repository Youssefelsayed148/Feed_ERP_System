const { query } = require('../src/config/database');

async function checkUsersSchema() {
  try {
    const result = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' ORDER BY ordinal_position
    `);
    console.log('Users table columns:');
    result.rows.forEach(r => console.log('  - ' + r.column_name));
  } catch (e) {
    console.log('Error:', e.message);
  }
}

checkUsersSchema();
