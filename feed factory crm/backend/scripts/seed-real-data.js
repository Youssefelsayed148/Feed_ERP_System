const { query } = require('../src/config/database');

async function seedRealData() {
  console.log('🌱 Seeding real data into PostgreSQL...\n');

  try {
    // 1. Add Feed Types (Products)
    console.log('📦 Adding Feed Types...');
    const feedTypes = [
      { code: 'BRO-S-01', name: 'Broiler Starter', desc: 'High protein starter feed for broilers', category: 'poultry' },
      { code: 'BRO-G-01', name: 'Broiler Grower', desc: 'Grower feed for broilers', category: 'poultry' },
      { code: 'BRO-F-01', name: 'Broiler Finisher', desc: 'Finisher feed for broilers', category: 'poultry' },
      { code: 'LAY-01', name: 'Layer Feed', desc: 'Production feed for layers', category: 'poultry' },
      { code: 'DRY-01', name: 'Dairy Feed', desc: 'Feed for dairy cows', category: 'cattle' }
    ];

    for (const ft of feedTypes) {
      try {
        await query(`
          INSERT INTO feed_types (code, name, description, category, status)
          VALUES ($1, $2, $3, $4, 'active')
          ON CONFLICT (code) DO NOTHING
        `, [ft.code, ft.name, ft.desc, ft.category]);
        console.log(`  ✅ ${ft.name}`);
      } catch (e) {
        console.log(`  ⚠️  ${ft.name}: ${e.message}`);
      }
    }

    // 2. Add Raw Materials (Inventory)
    console.log('\n📦 Adding Raw Materials (Inventory)...');
    const materials = [
      { code: 'CORN-001', name: 'Yellow Corn', name_ar: 'ذرة صفراء', cat: 'grain', cost: 1.2, qty: 50000 },
      { code: 'SBM-001', name: 'Soybean Meal', name_ar: 'كسبة فول صويا', cat: 'protein', cost: 2.5, qty: 25000 },
      { code: 'WHT-001', name: 'Wheat', name_ar: 'قمح', cat: 'grain', cost: 1.0, qty: 30000 },
      { code: 'LIM-001', name: 'Limestone', name_ar: 'حجر جيري', cat: 'mineral', cost: 0.3, qty: 15000 },
      { code: 'VIT-001', name: 'Vitamins Premix', name_ar: 'فيتامينات', cat: 'additive', cost: 15.0, qty: 5000 }
    ];

    for (const m of materials) {
      try {
        await query(`
          INSERT INTO raw_materials (code, name, name_arabic, category, quantity, unit, cost_per_unit, status)
          VALUES ($1, $2, $3, $4, $5, 'kg', $6, 'active')
          ON CONFLICT (code) DO NOTHING
        `, [m.code, m.name, m.name_ar, m.cat, m.qty, m.cost]);
        console.log(`  ✅ ${m.name} (${m.qty}kg)`);
      } catch (e) {
        console.log(`  ⚠️  ${m.name}: ${e.message}`);
      }
    }

    // 3. Add Real Clients
    console.log('\n👥 Adding Real Clients...');
    const clients = [
      { code: 'CLI-001', name: 'Elite Farms', cat: 'farm', credit: 100000, phone: '+966501234567' },
      { code: 'CLI-002', name: 'Peak Trading', cat: 'wholesale', credit: 250000, phone: '+966502345678' },
      { code: 'CLI-003', name: 'Pioneer Co', cat: 'distributor', credit: 500000, phone: '+966503456789' },
      { code: 'CLI-004', name: 'Salam Farm', cat: 'farm', credit: 50000, phone: '+966504567890' },
      { code: 'CLI-005', name: 'Tech Trader', cat: 'retail', credit: 25000, phone: '+966505678901' }
    ];

    for (const c of clients) {
      try {
        await query(`
          INSERT INTO clients (code, name, category, payment_type, credit_limit, phone, status)
          VALUES ($1, $2, $3, 'credit', $4, $5, 'active')
          ON CONFLICT (code) DO NOTHING
        `, [c.code, c.name, c.cat, c.credit, c.phone]);
        console.log(`  ✅ ${c.name}`);
      } catch (e) {
        console.log(`  ⚠️  ${c.name}: ${e.message}`);
      }
    }

    // 4. Add Sales Orders with Real Data
    console.log('\n📋 Adding Sales Orders...');
    const clientsResult = await query('SELECT id, code FROM clients');
    const feedResult = await query('SELECT id, code FROM feed_types');
    const usersResult = await query("SELECT id FROM users LIMIT 1");
    
    const userId = usersResult.rows.length > 0 ? usersResult.rows[0].id : 1;
    
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

    // 5. Create Invoices
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

    console.log('\n✅ Data seeding completed!');
    console.log('\n📊 Summary:');
    console.log(`  - Feed Types: ${feedTypes.length}`);
    console.log(`  - Raw Materials: ${materials.length}`);
    console.log(`  - Clients: ${clients.length}`);
    console.log(`  - Orders: ${orders.length}`);
    console.log(`  - Invoices: ${ordersResult.rows.length}`);

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }
}

seedRealData();
