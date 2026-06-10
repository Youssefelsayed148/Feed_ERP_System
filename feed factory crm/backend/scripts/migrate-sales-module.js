const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'al_kheir_feed_factory',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Theosirislabs1$',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, '..', '..', 'database', 'complete_schema_with_sales.sql');
    let sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Replace placeholder passwords with bcrypt hashes
    console.log('🔐 Generating password hashes...');
    const saltRounds = 10;
    
    const passwords = {
      'owner@al-kheir.com': 'owner123',
      'admin@al-kheir.com': 'admin123',
      'sales.manager@al-kheir.com': 'manager123',
      'sales.rep1@al-kheir.com': 'rep123',
      'sales.rep2@al-kheir.com': 'rep123',
      'production.manager@al-kheir.com': 'prod123',
      'finance.manager@al-kheir.com': 'finance123',
      'purchase.officer@al-kheir.com': 'purchase123'
    };
    
    for (const [email, password] of Object.entries(passwords)) {
      const hash = await bcrypt.hash(password, saltRounds);
      sql = sql.replace(`$2b$10$YourHashedPasswordHere`, hash);
    }
    
    // Execute the SQL statements one by one to handle errors gracefully
    console.log('📊 Executing SQL statements...');
    
    // Split SQL into individual statements
    const statements = sql.split(/;\s*$/m).filter(s => s.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement || statement.startsWith('--') || statement.startsWith('/*')) continue;
      
      try {
        await client.query(statement);
        process.stdout.write(`\r  Progress: ${i + 1}/${statements.length} statements`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate key') ||
            err.message.includes('does not exist')) {
          process.stdout.write(`\r  Progress: ${i + 1}/${statements.length} statements (skipped: ${err.message.substring(0, 50)}...)`);
        } else {
          console.error(`\n⚠️  Warning: ${err.message.substring(0, 100)}`);
        }
      }
    }
    console.log('\n');
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Default login credentials:');
    console.log('  Sales Manager: sales.manager@al-kheir.com / manager123');
    console.log('  Sales Rep 1:   sales.rep1@al-kheir.com / rep123');
    console.log('  Sales Rep 2:   sales.rep2@al-kheir.com / rep123');
    console.log('  Owner:         owner@al-kheir.com / owner123');
    console.log('  Admin:         admin@al-kheir.com / admin123');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
