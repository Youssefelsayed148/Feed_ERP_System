const { query } = require('../src/config/database');

// List of expected tables based on init-db.js
const EXPECTED_TABLES = [
  'users',
  'organizations',
  'suppliers',
  'raw_materials',
  'feed_types',
  'feed_recipes',
  'clients',
  'purchase_orders',
  'goods_receipt_notes',
  'sales_orders',
  'invoices',
  'payables',
  'expenses',
  'stock_movements',
  'production_orders',
  'finished_goods',
  'payroll',
  'vehicles',
  'deliveries',
  'machines'
];

// Table creation SQL statements
const TABLE_DEFINITIONS = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      department VARCHAR(100),
      designation VARCHAR(100),
      salary DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  organizations: `
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(50),
      parent_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  suppliers: `
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      contact_person VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      payment_terms VARCHAR(100),
      credit_limit DECIMAL(12,2),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  raw_materials: `
    CREATE TABLE IF NOT EXISTS raw_materials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      name_arabic VARCHAR(255),
      code VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(100),
      quantity DECIMAL(12,3) DEFAULT 0,
      unit VARCHAR(20) DEFAULT 'kg',
      cost_per_unit DECIMAL(10,2),
      average_cost DECIMAL(10,2),
      minimum_stock DECIMAL(12,3) DEFAULT 0,
      reorder_level DECIMAL(12,3) DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  feed_types: `
    CREATE TABLE IF NOT EXISTS feed_types (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(100),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  feed_recipes: `
    CREATE TABLE IF NOT EXISTS feed_recipes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      feed_type_id INTEGER REFERENCES feed_types(id),
      total_cost_per_ton DECIMAL(10,2),
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  clients: `
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(100),
      payment_type VARCHAR(20) DEFAULT 'credit',
      credit_limit DECIMAL(12,2) DEFAULT 0,
      current_credit DECIMAL(12,2) DEFAULT 0,
      credit_period INTEGER DEFAULT 30,
      blocking_threshold DECIMAL(5,2) DEFAULT 80.00,
      contact_person VARCHAR(255),
      phone VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  purchase_orders: `
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      status VARCHAR(50) DEFAULT 'draft',
      order_date DATE DEFAULT CURRENT_DATE,
      expected_date DATE,
      total_amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  goods_receipt_notes: `
    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id SERIAL PRIMARY KEY,
      grn_number VARCHAR(50) UNIQUE NOT NULL,
      purchase_order_id INTEGER REFERENCES purchase_orders(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      receipt_date DATE DEFAULT CURRENT_DATE,
      status VARCHAR(50) DEFAULT 'pending',
      total_amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  sales_orders: `
    CREATE TABLE IF NOT EXISTS sales_orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) UNIQUE NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      status VARCHAR(50) DEFAULT 'draft',
      order_date DATE DEFAULT CURRENT_DATE,
      delivery_date DATE,
      total_amount DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  invoices: `
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      sales_order_id INTEGER REFERENCES sales_orders(id),
      invoice_date DATE DEFAULT CURRENT_DATE,
      due_date DATE,
      total_amount DECIMAL(12,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'unpaid',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  payables: `
    CREATE TABLE IF NOT EXISTS payables (
      id SERIAL PRIMARY KEY,
      payable_number VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(50) DEFAULT 'supplier',
      supplier_id INTEGER REFERENCES suppliers(id),
      amount DECIMAL(12,2) DEFAULT 0,
      due_date DATE,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  expenses: `
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      expense_number VARCHAR(50) UNIQUE NOT NULL,
      category VARCHAR(100),
      description TEXT,
      amount DECIMAL(12,2) DEFAULT 0,
      date DATE DEFAULT CURRENT_DATE,
      payment_method VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  stock_movements: `
    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      material_id INTEGER REFERENCES raw_materials(id),
      movement_type VARCHAR(50) NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      unit_cost DECIMAL(10,2),
      total_cost DECIMAL(12,2),
      reference_type VARCHAR(50),
      reference_id INTEGER,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  production_orders: `
    CREATE TABLE IF NOT EXISTS production_orders (
      id SERIAL PRIMARY KEY,
      production_number VARCHAR(50) UNIQUE NOT NULL,
      batch_number VARCHAR(50) UNIQUE,
      feed_type_id INTEGER REFERENCES feed_types(id),
      recipe_id INTEGER REFERENCES feed_recipes(id),
      planned_quantity DECIMAL(12,3),
      actual_quantity DECIMAL(12,3) DEFAULT 0,
      package_size DECIMAL(8,2),
      status VARCHAR(50) DEFAULT 'pending',
      start_date TIMESTAMP,
      completion_date TIMESTAMP,
      total_cost DECIMAL(12,2),
      quality_passed BOOLEAN DEFAULT false,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  finished_goods: `
    CREATE TABLE IF NOT EXISTS finished_goods (
      id SERIAL PRIMARY KEY,
      batch_number VARCHAR(50) NOT NULL,
      feed_type_id INTEGER REFERENCES feed_types(id),
      production_order_id INTEGER REFERENCES production_orders(id),
      quantity DECIMAL(12,3) DEFAULT 0,
      unit VARCHAR(20) DEFAULT 'kg',
      unit_cost DECIMAL(10,2),
      total_cost DECIMAL(12,2),
      status VARCHAR(50) DEFAULT 'available',
      expiry_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  payroll: `
    CREATE TABLE IF NOT EXISTS payroll (
      id SERIAL PRIMARY KEY,
      month VARCHAR(20) NOT NULL,
      year INTEGER NOT NULL,
      status VARCHAR(50) DEFAULT 'draft',
      total_basic_salary DECIMAL(12,2) DEFAULT 0,
      total_allowances DECIMAL(12,2) DEFAULT 0,
      total_deductions DECIMAL(12,2) DEFAULT 0,
      total_gross_salary DECIMAL(12,2) DEFAULT 0,
      total_net_salary DECIMAL(12,2) DEFAULT 0,
      notes TEXT,
      processed_by INTEGER REFERENCES users(id),
      processed_at TIMESTAMP,
      posted_to_finance BOOLEAN DEFAULT false,
      expense_id INTEGER REFERENCES expenses(id),
      payable_id INTEGER REFERENCES payables(id),
      posted_by INTEGER REFERENCES users(id),
      posted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  vehicles: `
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      vehicle_number VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(50),
      capacity DECIMAL(8,2),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  deliveries: `
    CREATE TABLE IF NOT EXISTS deliveries (
      id SERIAL PRIMARY KEY,
      delivery_number VARCHAR(50) UNIQUE NOT NULL,
      sales_order_id INTEGER REFERENCES sales_orders(id),
      vehicle_id INTEGER REFERENCES vehicles(id),
      driver_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      delivery_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `,
  machines: `
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      type VARCHAR(100),
      capacity DECIMAL(8,2),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
};

async function checkExistingTables() {
  try {
    console.log('🔍 Checking existing tables in PostgreSQL database...\n');
    
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const existingTables = result.rows.map(row => row.table_name);
    console.log(`📊 Found ${existingTables.length} existing tables:`);
    existingTables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table}`);
    });
    
    return existingTables;
  } catch (error) {
    console.error('❌ Error checking existing tables:', error.message);
    throw error;
  }
}

async function analyzeSchemaStatus(existingTables) {
  console.log('\n📋 Schema Analysis:');
  console.log('='.repeat(60));
  
  const missingTables = [];
  const existingExpectedTables = [];
  const unexpectedTables = [];
  
  // Check expected tables
  for (const table of EXPECTED_TABLES) {
    if (existingTables.includes(table)) {
      existingExpectedTables.push(table);
    } else {
      missingTables.push(table);
    }
  }
  
  // Check for unexpected tables
  for (const table of existingTables) {
    if (!EXPECTED_TABLES.includes(table)) {
      unexpectedTables.push(table);
    }
  }
  
  // Report status
  console.log(`\n✅ Existing Expected Tables (${existingExpectedTables.length}/${EXPECTED_TABLES.length}):`);
  if (existingExpectedTables.length > 0) {
    existingExpectedTables.forEach(table => console.log(`   ✓ ${table}`));
  } else {
    console.log('   None');
  }
  
  console.log(`\n❌ Missing Tables (${missingTables.length}):`);
  if (missingTables.length > 0) {
    missingTables.forEach(table => console.log(`   ✗ ${table}`));
  } else {
    console.log('   None - All expected tables exist!');
  }
  
  if (unexpectedTables.length > 0) {
    console.log(`\n⚠️ Unexpected Tables (${unexpectedTables.length}):`);
    unexpectedTables.forEach(table => console.log(`   ! ${table}`));
  }
  
  const completionPercentage = Math.round((existingExpectedTables.length / EXPECTED_TABLES.length) * 100);
  console.log(`\n📊 Schema Completion: ${completionPercentage}%`);
  
  return { missingTables, existingExpectedTables, unexpectedTables };
}

async function createMissingTables(missingTables) {
  if (missingTables.length === 0) {
    console.log('\n✅ No missing tables to create.');
    return;
  }
  
  console.log(`\n🔨 Creating ${missingTables.length} missing tables...\n`);
  
  const results = {
    successful: [],
    failed: []
  };
  
  // Sort tables by dependency order (tables with no FKs first)
  const dependencyOrder = [
    'users', 'organizations', 'suppliers', 'feed_types', 'raw_materials',
    'feed_recipes', 'clients', 'purchase_orders', 'goods_receipt_notes',
    'sales_orders', 'invoices', 'payables', 'expenses', 'stock_movements',
    'production_orders', 'finished_goods', 'payroll', 'vehicles', 'deliveries', 'machines'
  ];
  
  const sortedMissing = missingTables.sort((a, b) => {
    return dependencyOrder.indexOf(a) - dependencyOrder.indexOf(b);
  });
  
  for (const table of sortedMissing) {
    try {
      const createSql = TABLE_DEFINITIONS[table];
      if (!createSql) {
        console.log(`   ⚠️ No definition found for table: ${table}`);
        results.failed.push({ table, error: 'No definition found' });
        continue;
      }
      
      await query(createSql);
      console.log(`   ✅ Created table: ${table}`);
      results.successful.push(table);
    } catch (error) {
      console.log(`   ❌ Failed to create table: ${table}`);
      console.log(`      Error: ${error.message}`);
      results.failed.push({ table, error: error.message });
    }
  }
  
  console.log(`\n📊 Creation Results:`);
  console.log(`   ✅ Successful: ${results.successful.length}`);
  console.log(`   ❌ Failed: ${results.failed.length}`);
  
  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔧 Database Schema Check & Fix Tool');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Step 1: Check existing tables
    const existingTables = await checkExistingTables();
    
    // Step 2: Analyze schema status
    const { missingTables } = await analyzeSchemaStatus(existingTables);
    
    // Step 3: Create missing tables
    await createMissingTables(missingTables);
    
    // Step 4: Final verification
    console.log('\n🔍 Final Verification:');
    console.log('='.repeat(60));
    const finalCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const finalTables = finalCheck.rows.map(row => row.table_name);
    const finalExpectedCount = EXPECTED_TABLES.filter(t => finalTables.includes(t)).length;
    const finalPercentage = Math.round((finalExpectedCount / EXPECTED_TABLES.length) * 100);
    
    console.log(`\n📊 Final Status: ${finalExpectedCount}/${EXPECTED_TABLES.length} expected tables (${finalPercentage}%)`);
    
    if (finalPercentage === 100) {
      console.log('\n🎉 All expected tables are now in place!');
    } else {
      const stillMissing = EXPECTED_TABLES.filter(t => !finalTables.includes(t));
      console.log(`\n⚠️ Still missing ${stillMissing.length} tables:`);
      stillMissing.forEach(t => console.log(`   - ${t}`));
    }
    
    console.log('\n✅ Schema check and fix completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  }
}

main();
