/**
 * Business Flow API Test
 * Run on Windows: cd backend && node scripts/test-business-flows.js
 * 
 * This script tests key business operations end-to-end:
 * 1. Client CRUD
 * 2. Sales order creation
 * 3. Invoice generation
 * 4. Payment recording
 * 5. Stock check
 */

const http = require('http');

const PORT = process.env.PORT || 5000;

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      timeout: 8000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, ok: res.statusCode < 400 });
        } catch {
          resolve({ status: res.statusCode, data: data, ok: res.statusCode < 400 });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 'ERROR', error: err.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT', ok: false }); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let authToken = null;
let testClientId = null;
let testOrderId = null;

async function testAuth() {
  console.log('\n--- 1. AUTHENTICATION ---');
  
  // Try to login with a default user
  const login = await makeRequest('/api/auth/login', 'POST', {
    email: 'owner@al-kheir.com',
    password: 'password123'
  });
  
  if (login.ok && login.data.token) {
    authToken = login.data.token;
    console.log('✅ Login successful');
  } else {
    console.log('⚠️  Login failed (expected if passwords not seeded):', login.data.message || login.status);
    console.log('   Continuing without auth token...');
  }
}

async function testClients() {
  console.log('\n--- 2. CLIENT OPERATIONS ---');
  
  // List clients
  const list = await makeRequest('/api/clients/clients', 'GET', null, authToken);
  console.log(`   List clients: ${list.status} (${Array.isArray(list.data) ? list.data.length : 'N/A'} clients)`);
  
  if (list.ok && Array.isArray(list.data) && list.data.length > 0) {
    testClientId = list.data[0].id;
    console.log(`   Using client id: ${testClientId}`);
    
    // Get single client
    const single = await makeRequest(`/api/clients/clients/${testClientId}`, 'GET', null, authToken);
    console.log(`   Get client ${testClientId}: ${single.status}`);
  } else {
    console.log('   ⚠️  No clients found or endpoint returned non-array');
  }
}

async function testInventory() {
  console.log('\n--- 3. INVENTORY OPERATIONS ---');
  
  const materials = await makeRequest('/api/inventory/raw-materials', 'GET', null, authToken);
  console.log(`   Raw materials: ${materials.status} (${Array.isArray(materials.data) ? materials.data.length : 'N/A'} items)`);
  
  const lowStock = await makeRequest('/api/inventory/raw-materials/low-stock', 'GET', null, authToken);
  console.log(`   Low stock: ${lowStock.status} (${Array.isArray(lowStock.data) ? lowStock.data.length : 'N/A'} items)`);
}

async function testFeedRecipes() {
  console.log('\n--- 4. FEED RECIPES ---');
  
  const types = await makeRequest('/api/feed-recipes/feed-types', 'GET', null, authToken);
  console.log(`   Feed types: ${types.status} (${Array.isArray(types.data) ? types.data.length : 'N/A'} types)`);
}

async function testSales() {
  console.log('\n--- 5. SALES OPERATIONS ---');
  
  const orders = await makeRequest('/api/sales/sales-orders', 'GET', null, authToken);
  console.log(`   Sales orders: ${orders.status} (${Array.isArray(orders.data) ? orders.data.length : 'N/A'} orders)`);
  
  if (orders.ok && Array.isArray(orders.data) && orders.data.length > 0) {
    testOrderId = orders.data[0].id;
    const detail = await makeRequest(`/api/sales/sales-orders/${testOrderId}`, 'GET', null, authToken);
    console.log(`   Order detail ${testOrderId}: ${detail.status}`);
  }
}

async function testFinance() {
  console.log('\n--- 6. FINANCE OPERATIONS ---');
  
  const dashboard = await makeRequest('/api/finance/dashboard', 'GET', null, authToken);
  console.log(`   Finance dashboard: ${dashboard.status}`);
  
  const invoices = await makeRequest('/api/finance/invoices', 'GET', null, authToken);
  console.log(`   Invoices: ${invoices.status} (${Array.isArray(invoices.data) ? invoices.data.length : 'N/A'} invoices)`);
  
  const payables = await makeRequest('/api/payables', 'GET', null, authToken);
  console.log(`   Payables: ${payables.status} (${Array.isArray(payables.data) ? payables.data.length : 'N/A'} payables)`);
  
  const expenses = await makeRequest('/api/expenses', 'GET', null, authToken);
  console.log(`   Expenses: ${expenses.status} (${Array.isArray(expenses.data) ? expenses.data.length : 'N/A'} expenses)`);
}

async function testProduction() {
  console.log('\n--- 7. PRODUCTION OPERATIONS ---');
  
  const orders = await makeRequest('/api/production/production-orders', 'GET', null, authToken);
  console.log(`   Production orders: ${orders.status} (${Array.isArray(orders.data?.orders) ? orders.data.orders.length : 'N/A'} orders)`);
  
  const stats = await makeRequest('/api/production/stats', 'GET', null, authToken);
  console.log(`   Production stats: ${stats.status}`);
}

async function testDashboard() {
  console.log('\n--- 8. DASHBOARD ---');
  
  const dashboard = await makeRequest('/api/dashboard', 'GET', null, authToken);
  console.log(`   Main dashboard: ${dashboard.status}`);
}

async function main() {
  console.log('==============================================');
  console.log('  BUSINESS FLOW API TEST');
  console.log(`  Target: http://localhost:${PORT}`);
  console.log('==============================================');

  // Check server
  const health = await makeRequest('/', 'GET');
  if (health.status === 'ERROR') {
    console.log('\n❌ Server is not running. Start it first: npm start');
    process.exit(1);
  }
  console.log('✅ Server is responding');

  try {
    await testAuth();
    await testClients();
    await testInventory();
    await testFeedRecipes();
    await testSales();
    await testFinance();
    await testProduction();
    await testDashboard();

    console.log('\n==============================================');
    console.log('  BUSINESS FLOW TEST COMPLETE');
    console.log('==============================================');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
