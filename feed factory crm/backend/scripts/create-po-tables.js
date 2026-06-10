const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'al_kheir_feed_factory',
  user: 'postgres',
  password: ''
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

async function main() {
  console.log('=== Creating purchase orders and payables tables ===\n');

  // Create purchase_orders table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      status VARCHAR(50) DEFAULT 'draft',
      subtotal NUMERIC(15,2) DEFAULT 0,
      vat_amount NUMERIC(15,2) DEFAULT 0,
      total NUMERIC(15,2) DEFAULT 0,
      delivery_date DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('1. Created purchase_orders table');

  // Create purchase_order_items table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id SERIAL PRIMARY KEY,
      po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      raw_material_id INTEGER REFERENCES raw_materials(id),
      quantity NUMERIC(15,3) NOT NULL,
      unit VARCHAR(20),
      unit_cost NUMERIC(15,2) NOT NULL,
      total_cost NUMERIC(15,2) NOT NULL,
      received_quantity NUMERIC(15,3) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('2. Created purchase_order_items table');

  // Create supplier_payables table
  await query(`
    CREATE TABLE IF NOT EXISTS supplier_payables (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES suppliers(id),
      po_id INTEGER REFERENCES purchase_orders(id),
      invoice_number VARCHAR(100),
      amount NUMERIC(15,2) NOT NULL,
      paid_amount NUMERIC(15,2) DEFAULT 0,
      balance NUMERIC(15,2) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      due_date DATE,
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('3. Created supplier_payables table');

  // Seed purchase orders with real data from suppliers
  console.log('\n4. Seeding purchase orders...');
  
  // PO-001: Corn and Soybean from الحاج / ابراهيم النادى (SUP-001)
  const po1 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, subtotal, vat_amount, total, delivery_date, notes, created_by)
     VALUES ('PO-2025-001', 1, 'approved', 4500000, 630000, 5130000, '2025-03-15', 'شراء ذره وصويا - الحاج ابراهيم النادى', 8)
     RETURNING id`
  );
  await query(
    `INSERT INTO purchase_order_items (po_id, raw_material_id, quantity, unit, unit_cost, total_cost)
     VALUES ($1, 2, 150000, 'kg', 15.00, 2250000), ($1, 6, 80000, 'kg', 19.35, 1548000)`,
    [po1.rows[0].id]
  );

  // PO-002: Gluten from المنيرى (SUP-007)
  const po2 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, subtotal, vat_amount, total, delivery_date, notes, created_by)
     VALUES ('PO-2025-002', 7, 'completed', 1925000, 269500, 2194500, '2025-03-10', 'شراء جلوتين - المنيرى', 8)
     RETURNING id`
  );
  await query(
    `INSERT INTO purchase_order_items (po_id, raw_material_id, quantity, unit, unit_cost, total_cost)
     VALUES ($1, 1, 50000, 'kg', 38.50, 1925000)`,
    [po2.rows[0].id]
  );

  // PO-003: Wheat Bran from الشنيطى (SUP-011)
  const po3 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, subtotal, vat_amount, total, delivery_date, notes, created_by)
     VALUES ('PO-2025-003', 11, 'approved', 1080000, 151200, 1231200, '2025-03-20', 'شراء رده وسن - الشنيطى', 8)
     RETURNING id`
  );
  await query(
    `INSERT INTO purchase_order_items (po_id, raw_material_id, quantity, unit, unit_cost, total_cost)
     VALUES ($1, 4, 60000, 'kg', 10.80, 648000), ($1, 5, 36000, 'kg', 12.00, 432000)`,
    [po3.rows[0].id]
  );

  // PO-004: Limestone from منيا جلوب (SUP-014)
  const po4 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, subtotal, vat_amount, total, delivery_date, notes, created_by)
     VALUES ('PO-2025-004', 14, 'completed', 600000, 84000, 684000, '2025-03-12', 'شراء حجر جيرى - منيا جلوب', 8)
     RETURNING id`
  );
  await query(
    `INSERT INTO purchase_order_items (po_id, raw_material_id, quantity, unit, unit_cost, total_cost)
     VALUES ($1, 17, 1000000, 'kg', 0.60, 600000)`,
    [po4.rows[0].id]
  );

  // PO-005: Premix and additives from فارما كير (SUP-017)
  const po5 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, status, subtotal, vat_amount, total, delivery_date, notes, created_by)
     VALUES ('PO-2025-005', 17, 'draft', 3500000, 490000, 3990000, '2025-04-01', 'شراء بريمكس ولايسين وميثونين - فارما كير', 8)
     RETURNING id`
  );
  await query(
    `INSERT INTO purchase_order_items (po_id, raw_material_id, quantity, unit, unit_cost, total_cost)
     VALUES ($1, 11, 20000, 'kg', 112.00, 2240000), ($1, 20, 8000, 'kg', 100.00, 800000), ($1, 23, 3000, 'kg', 150.00, 450000)`,
    [po5.rows[0].id]
  );

  console.log('   Inserted 5 purchase orders');

  // Seed supplier payables
  console.log('\n5. Seeding supplier payables...');
  
  const payables = [
    [1, po2.rows[0].id, 'INV-SUP007-001', 2194500, 2194500, 0, 'completed', '2025-03-25', 'فاتورة جلوتين - المنيرى'],
    [14, po4.rows[0].id, 'INV-SUP014-001', 684000, 684000, 0, 'completed', '2025-03-20', 'فاتورة حجر جيرى - منيا جلوب'],
    [1, po1.rows[0].id, 'INV-SUP001-001', 5130000, 2000000, 3130000, 'partial', '2025-04-15', 'فاتورة ذره وصويا - الحاج ابراهيم'],
    [11, po3.rows[0].id, 'INV-SUP011-001', 1231200, 0, 1231200, 'pending', '2025-04-20', 'فاتورة رده وسن - الشنيطى'],
    [17, po5.rows[0].id, 'INV-SUP017-001', 3990000, 0, 3990000, 'pending', '2025-05-01', 'فاتورة بريمكس ولايسين - فارما كير'],
    [3, null, 'INV-SUP003-001', 1500000, 0, 1500000, 'overdue', '2025-03-01', 'فاتورة ذره - الحاج على اللويزى'],
    [6, null, 'INV-SUP006-001', 2800000, 1000000, 1800000, 'partial', '2025-04-10', 'فاتورة ذره وصويا - صبحى معروف'],
  ];

  for (const p of payables) {
    await query(
      `INSERT INTO supplier_payables (supplier_id, po_id, invoice_number, amount, paid_amount, balance, status, due_date, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      p
    );
  }
  console.log(`   Inserted ${payables.length} supplier payables`);

  // Verify
  const counts = await query(`
    SELECT 'purchase_orders' as tbl, COUNT(*) FROM purchase_orders
    UNION ALL SELECT 'purchase_order_items', COUNT(*) FROM purchase_order_items
    UNION ALL SELECT 'supplier_payables', COUNT(*) FROM supplier_payables
  `);
  console.log('\n=== Summary ===');
  for (const row of counts.rows) {
    console.log(`   ${row.tbl}: ${row.count}`);
  }

  await pool.end();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
