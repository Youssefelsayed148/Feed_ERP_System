const { query } = require('../src/config/database');
const bcrypt = require('bcrypt');

async function addUsersAndCompleteData() {
  console.log('👤 Adding Users and completing data...\n');

  try {
    // Check if users table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating users table...');
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          department VARCHAR(50),
          phone VARCHAR(20),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Add users
    console.log('Adding users...');
    const saltRounds = 10;
    
    const users = [
      { name: 'Sales Manager', email: 'sales.manager@al-kheir.com', password: 'manager123', role: 'sales_manager' },
      { name: 'Sales Rep 1', email: 'sales.rep1@al-kheir.com', password: 'rep123', role: 'sales_rep' },
      { name: 'Admin', email: 'admin@al-kheir.com', password: 'admin123', role: 'admin' }
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, saltRounds);
      try {
        await query(`
          INSERT INTO users (name, email, password_hash, role, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (email) DO NOTHING
        `, [user.name, user.email, hash, user.role]);
        console.log(`  ✅ ${user.name} (${user.role})`);
      } catch (e) {
        console.log(`  ⚠️  ${user.name}: ${e.message}`);
      }
    }

    // Get the users we just created
    const usersResult = await query('SELECT id, role FROM users');
    const salesRep = usersResult.rows.find(u => u.role === 'sales_rep');
    const manager = usersResult.rows.find(u => u.role === 'sales_manager');
    const userId = salesRep ? salesRep.id : usersResult.rows[0].id;

    // Add Sales Orders
    console.log('\n📋 Adding Sales Orders...');
    const clientsResult = await query('SELECT id, code FROM clients');
    
    const orders = [
      { client_code: 'CLI-001', amount: 10500 },
      { client_code: 'CLI-002', amount: 21500 },
      { client_code: 'CLI-003', amount: 15300 },
      { client_code: 'CLI-001', amount: 8400 }
    ];

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      try {
        const client = clientsResult.rows.find(c => c.code === o.client_code);
        if (!client) continue;

        const orderNumber = `SO-2025-${String(i + 1).padStart(4, '0')}`;
        
        await query(`
          INSERT INTO sales_orders (order_number, client_id, status, order_date, total_amount, notes, created_by)
          VALUES ($1, $2, 'approved', CURRENT_DATE, $3, 'Real order from customer', $4)
          ON CONFLICT DO NOTHING
        `, [orderNumber, client.id, o.amount, userId]);
        
        console.log(`  ✅ Order ${orderNumber}: ${o.amount} SAR`);
      } catch (e) {
        console.log(`  ⚠️  Order ${i + 1}: ${e.message}`);
      }
    }

    // Create Invoices
    console.log('\n🧾 Creating Invoices...');
    const ordersResult = await query("SELECT id, order_number, client_id, total_amount FROM sales_orders WHERE status = 'approved'");
    
    for (let i = 0; i < ordersResult.rows.length; i++) {
      const order = ordersResult.rows[i];
      try {
        const invoiceNumber = `INV-2025-${String(i + 1).padStart(4, '0')}`;
        await query(`
          INSERT INTO invoices (invoice_number, client_id, sales_order_id, invoice_date, due_date, total_amount, status, created_by)
          VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $4, 'pending', $5)
          ON CONFLICT DO NOTHING
        `, [invoiceNumber, order.client_id, order.id, order.total_amount, userId]);
        console.log(`  ✅ Invoice ${invoiceNumber}: ${order.total_amount} SAR`);
      } catch (e) {
        // Ignore duplicates
      }
    }

    // Assign clients to sales rep
    if (salesRep) {
      console.log('\n👤 Assigning clients to Sales Rep...');
      await query(`
        UPDATE clients SET 
          contact_person = (SELECT name FROM users WHERE id = $1)
        WHERE code IN ('CLI-001', 'CLI-004')
      `, [salesRep.id]);
      console.log('  ✅ 2 clients assigned');
    }

    console.log('\n✅ Data setup completed!');
    console.log('\n📊 Final Summary:');
    console.log(`  - Users: ${usersResult.rows.length}`);
    console.log(`  - Orders: ${ordersResult.rows.length}`);
    console.log(`  - Invoices: Created for all orders`);
    console.log('\n🔑 Login Credentials:');
    console.log('  Sales Manager: sales.manager@al-kheir.com / manager123');
    console.log('  Sales Rep:     sales.rep1@al-kheir.com / rep123');
    console.log('  Admin:         admin@al-kheir.com / admin123');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addUsersAndCompleteData();
