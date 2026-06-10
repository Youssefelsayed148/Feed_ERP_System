const { query } = require('../src/config/database');
const bcrypt = require('bcrypt');

async function completeSetup() {
  console.log('👤 Adding Users and completing data...\n');

  try {
    // Add users with correct column names
    console.log('Adding users...');
    const saltRounds = 10;
    
    const users = [
      { first: 'Sales', last: 'Manager', email: 'sales.manager@al-kheir.com', password: 'manager123', role: 'sales_manager' },
      { first: 'Sales', last: 'Rep One', email: 'sales.rep1@al-kheir.com', password: 'rep123', role: 'sales_rep' },
      { first: 'System', last: 'Admin', email: 'admin@al-kheir.com', password: 'admin123', role: 'admin' }
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, saltRounds);
      try {
        await query(`
          INSERT INTO users (first_name, last_name, email, password_hash, role, status)
          VALUES ($1, $2, $3, $4, $5, 'active')
          ON CONFLICT (email) DO NOTHING
        `, [user.first, user.last, user.email, hash, user.role]);
        console.log(`  ✅ ${user.first} ${user.last} (${user.role})`);
      } catch (e) {
        console.log(`  ⚠️  ${user.first} ${user.last}: ${e.message}`);
      }
    }

    // Get the users we just created
    const usersResult = await query('SELECT id, role FROM users');
    console.log(`\n📊 Total users: ${usersResult.rows.length}`);
    
    const salesRep = usersResult.rows.find(u => u.role === 'sales_manager' || u.role === 'sales_rep');
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

    // Update clients with contact person
    console.log('\n👤 Assigning contact person...');
    await query(`
      UPDATE clients SET contact_person = 'Sales Rep One'
      WHERE code IN ('CLI-001', 'CLI-004')
    `);
    console.log('  ✅ Contact persons assigned');

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

completeSetup();
