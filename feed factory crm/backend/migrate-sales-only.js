require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Connect to PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'al_kheir_feed_factory',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const DATA_ARCHIVE = path.join(__dirname, '..', 'data_archive');

async function query(sql, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function getClientByCodeOrName(code, name) {
  // Try exact code match first
  let result = await query(`SELECT id FROM clients WHERE code = $1`, [code]);
  if (result.rows.length > 0) return result.rows[0].id;

  // Try name match
  result = await query(`SELECT id FROM clients WHERE name_arabic = $1 OR name_english = $1`, [name]);
  if (result.rows.length > 0) return result.rows[0].id;

  // Try case-insensitive code
  result = await query(`SELECT id FROM clients WHERE LOWER(code) = LOWER($1)`, [code]);
  if (result.rows.length > 0) return result.rows[0].id;

  return null;
}

async function getFeedTypeByCode(code) {
  const result = await query(`SELECT id FROM feed_types WHERE code = $1`, [code]);
  if (result.rows.length > 0) return result.rows[0].id;
  return null;
}

async function getSalesOrderByNumber(orderNumber) {
  const result = await query(`SELECT id FROM sales_orders WHERE order_number = $1`, [orderNumber]);
  if (result.rows.length > 0) return result.rows[0].id;
  return null;
}

async function migrateSalesOrders() {
  console.log('\n=== MIGRATING SALES ORDERS ===');
  const filePath = path.join(DATA_ARCHIVE, 'salesorders.json');
  if (!fs.existsSync(filePath)) {
    console.log('salesorders.json not found in data_archive, skipping.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let inserted = 0;
  let skipped = 0;

  for (const so of data) {
    const clientId = await getClientByCodeOrName(so.client, so.clientName);
    if (!clientId) {
      console.log(`  ⚠️  Client not found for sales order ${so.orderNumber} (client: ${so.client}, name: ${so.clientName})`);
      skipped++;
      continue;
    }

    // Check if already exists
    const existingId = await getSalesOrderByNumber(so.orderNumber);
    if (existingId) {
      console.log(`  ℹ️  Sales order ${so.orderNumber} already exists (id: ${existingId}), skipping insert.`);
      skipped++;
      continue;
    }

    // Map JSON status to PostgreSQL CHECK constraint values
    const statusMap = {
      'pending': 'pending_approval',
      'approved': 'approved',
      'confirmed': 'confirmed',
      'processing': 'processing',
      'in_transit': 'in_transit',
      'delivered': 'delivered',
      'rejected': 'rejected',
      'cancelled': 'cancelled'
    };
    const pgStatus = statusMap[so.status] || 'pending_approval';

    // Map payment status
    const paymentStatusMap = {
      'pending': 'pending',
      'partial': 'partial',
      'paid': 'paid',
      'overdue': 'overdue'
    };
    const pgPaymentStatus = paymentStatusMap[so.paymentStatus] || 'pending';

    // Insert sales order
    const soResult = await query(`
      INSERT INTO sales_orders 
      (order_number, client_id, status, total_amount, discount_amount, tax_amount, final_amount, 
       payment_status, delivery_date, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      so.orderNumber,
      clientId,
      pgStatus,
      so.subtotal || 0,
      0,
      so.vatAmount || 0,
      so.total || 0,
      pgPaymentStatus,
      so.deliveryDate || null,
      so.notes || null,
      so.createdAt || new Date().toISOString(),
      so.updatedAt || new Date().toISOString()
    ]);

    const orderId = soResult.rows[0].id;
    console.log(`  ✅ Inserted sales order ${so.orderNumber} (id: ${orderId})`);

    // Insert sales order items
    if (so.items && so.items.length > 0) {
      for (const item of so.items) {
        const feedTypeId = await getFeedTypeByCode(item.feedType);
        if (!feedTypeId) {
          console.log(`    ⚠️  Feed type ${item.feedType} not found, skipping item.`);
          continue;
        }

        await query(`
          INSERT INTO sales_order_items 
          (order_id, feed_type_id, package_size, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          orderId,
          feedTypeId,
          item.packageSize || 50,
          item.quantity || 0,
          item.unitPrice || 0,
          item.totalPrice || (item.unitPrice * item.quantity) || 0
        ]);
        console.log(`    ✅ Inserted item: ${item.feedTypeName} x${item.quantity}`);
      }
    }

    inserted++;
  }

  console.log(`Sales orders: ${inserted} inserted, ${skipped} skipped`);
}

async function migrateInvoices() {
  console.log('\n=== MIGRATING INVOICES ===');
  const filePath = path.join(DATA_ARCHIVE, 'invoices.json');
  if (!fs.existsSync(filePath)) {
    console.log('invoices.json not found in data_archive, skipping.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let inserted = 0;
  let skipped = 0;

  for (const inv of data) {
    // Find the sales order by order number
    const orderResult = await query(`SELECT id, client_id FROM sales_orders WHERE order_number = $1`, [inv.salesOrder]);
    if (orderResult.rows.length === 0) {
      console.log(`  ⚠️  Sales order ${inv.salesOrder} not found for invoice ${inv.invoiceNumber}, skipping.`);
      skipped++;
      continue;
    }

    const orderId = orderResult.rows[0].id;
    const clientId = orderResult.rows[0].client_id;

    // Check if invoice already exists
    const existingResult = await query(`SELECT id FROM invoices WHERE invoice_number = $1`, [inv.invoiceNumber]);
    if (existingResult.rows.length > 0) {
      console.log(`  ℹ️  Invoice ${inv.invoiceNumber} already exists, skipping.`);
      skipped++;
      continue;
    }

    // Map status
    const statusMap = {
      'pending': 'pending',
      'partial': 'partial',
      'paid': 'paid',
      'overdue': 'overdue',
      'cancelled': 'cancelled'
    };
    const pgStatus = statusMap[inv.status] || 'pending';

    const invResult = await query(`
      INSERT INTO invoices 
      (invoice_number, order_id, client_id, amount, paid_amount, balance_due, status, 
       issue_date, due_date, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      inv.invoiceNumber,
      orderId,
      clientId,
      inv.total || 0,
      inv.paidAmount || 0,
      inv.balance || (inv.total - (inv.paidAmount || 0)),
      pgStatus,
      inv.issueDate || new Date().toISOString(),
      inv.dueDate || null,
      inv.notes || null,
      inv.createdAt || new Date().toISOString(),
      inv.updatedAt || new Date().toISOString()
    ]);

    const invoiceId = invResult.rows[0].id;
    console.log(`  ✅ Inserted invoice ${inv.invoiceNumber} (id: ${invoiceId})`);

    // Insert invoice items
    if (inv.items && inv.items.length > 0) {
      for (const item of inv.items) {
        await query(`
          INSERT INTO invoice_items 
          (invoice_id, description, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          invoiceId,
          item.description || item.feedTypeName || 'Item',
          item.quantity || 0,
          item.unitPrice || 0,
          item.total || (item.unitPrice * item.quantity) || 0
        ]);
        console.log(`    ✅ Inserted invoice item: ${item.description || item.feedTypeName}`);
      }
    }

    inserted++;
  }

  console.log(`Invoices: ${inserted} inserted, ${skipped} skipped`);
}

async function migratePayments() {
  console.log('\n=== MIGRATING PAYMENTS ===');
  const filePath = path.join(DATA_ARCHIVE, 'payments.json');
  if (!fs.existsSync(filePath)) {
    console.log('payments.json not found in data_archive, skipping.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let inserted = 0;
  let skipped = 0;

  for (const payment of data) {
    // Try to find client - payments.json uses cl_1, cl_2 format
    // Map variants: cl_1 -> cl_001, CLI-001, etc.
    let clientId = null;
    const clientVariants = [
      payment.client,
      payment.client.replace('cl_', 'cl_00'),
      payment.client.replace('cl_', 'CLI-00').toUpperCase(),
      payment.client.replace('cl_', 'cli-00').toLowerCase()
    ];
    
    for (const variant of clientVariants) {
      const result = await query(`SELECT id FROM clients WHERE code = $1 OR LOWER(code) = LOWER($1)`, [variant]);
      if (result.rows.length > 0) {
        clientId = result.rows[0].id;
        break;
      }
    }

    if (!clientId) {
      console.log(`  ⚠️  Client not found for payment ${payment.paymentNumber} (client: ${payment.client}), skipping.`);
      skipped++;
      continue;
    }

    // Try to find order - payments.json uses so_1, so_2 format
    let orderId = null;
    const orderVariants = [
      payment.order,
      payment.order.replace('so_', 'SO-2026-00'),
      payment.order.replace('so_', 'so_00')
    ];

    for (const variant of orderVariants) {
      const result = await query(`SELECT id FROM sales_orders WHERE order_number = $1 OR LOWER(order_number) = LOWER($1)`, [variant]);
      if (result.rows.length > 0) {
        orderId = result.rows[0].id;
        break;
      }
    }

    // Check if this payment already exists (by paymentNumber or duplicate amount+date+client)
    const existingResult = await query(`
      SELECT id FROM client_payment_history 
      WHERE client_id = $1 AND amount = $2 AND date = $3
    `, [clientId, payment.amount, payment.transactionDate]);
    
    if (existingResult.rows.length > 0) {
      console.log(`  ℹ️  Payment for client ${payment.client}, amount ${payment.amount} on ${payment.transactionDate} already exists, skipping.`);
      skipped++;
      continue;
    }

    // Map payment method
    const methodMap = {
      'cash': 'cash',
      'bank_transfer': 'bank_transfer',
      'check': 'check',
      'credit_card': 'credit_card'
    };
    const pgMethod = methodMap[payment.method] || 'cash';

    await query(`
      INSERT INTO client_payment_history 
      (client_id, invoice_id, amount, date, description, method, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      clientId,
      null, // We don't have invoice_id mapping for these payments
      payment.amount,
      payment.transactionDate || new Date().toISOString(),
      `Payment ${payment.paymentNumber} for order ${payment.order}`,
      pgMethod,
      payment.transactionDate || new Date().toISOString()
    ]);

    console.log(`  ✅ Inserted payment ${payment.paymentNumber} (client: ${payment.client}, amount: ${payment.amount})`);
    inserted++;
  }

  console.log(`Payments: ${inserted} inserted, ${skipped} skipped`);
}

async function main() {
  console.log('==============================================');
  console.log('  PHASE 4 SALES DATA MIGRATION');
  console.log('  PostgreSQL-only, no JSON, no Mongoose');
  console.log('==============================================');

  try {
    await migrateSalesOrders();
    await migrateInvoices();
    await migratePayments();

    console.log('\n==============================================');
    console.log('  MIGRATION COMPLETE');
    console.log('==============================================');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
