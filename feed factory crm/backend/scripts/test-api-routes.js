/**
 * API Route Load Test
 * Run on Windows: cd backend && node scripts/test-api-routes.js
 * 
 * This script starts the server, tests every mounted API route,
 * and reports which ones respond with 200/404 (expected) vs 500 (error).
 */

const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

const routes = [
  // Auth & Users
  { path: '/api/auth/login', method: 'POST', body: { email: 'test@test.com', password: 'test' } },
  { path: '/api/users', method: 'GET' },
  { path: '/api/organization/structure', method: 'GET' },
  
  // Core
  { path: '/api/clients/clients', method: 'GET' },
  { path: '/api/inventory/raw-materials', method: 'GET' },
  { path: '/api/feed-recipes/feed-types', method: 'GET' },
  { path: '/api/production/production-orders', method: 'GET' },
  { path: '/api/sales/sales-orders', method: 'GET' },
  { path: '/api/notifications', method: 'GET' },
  { path: '/api/purchase-requisitions', method: 'GET' },
  { path: '/api/maintenance-reminders/reminders', method: 'GET' },
  
  // Business
  { path: '/api/leads', method: 'GET' },
  { path: '/api/reservations', method: 'GET' },
  { path: '/api/contracts', method: 'GET' },
  { path: '/api/installments', method: 'GET' },
  { path: '/api/partners', method: 'GET' },
  { path: '/api/whatsapp/conversations', method: 'GET' },
  { path: '/api/dashboard', method: 'GET' },
  { path: '/api/hr/employees', method: 'GET' },
  { path: '/api/employee-ratings', method: 'GET' },
  { path: '/api/finance/dashboard', method: 'GET' },
  
  // Feed Factory - Finance
  { path: '/api/payables', method: 'GET' },
  { path: '/api/expenses', method: 'GET' },
  { path: '/api/payroll', method: 'GET' },
  
  // Feed Factory - Procurement
  { path: '/api/suppliers', method: 'GET' },
  { path: '/api/purchase-orders', method: 'GET' },
  { path: '/api/grn', method: 'GET' },
  
  // Feed Factory - Operations
  { path: '/api/feed-types', method: 'GET' },
  { path: '/api/orders', method: 'GET' },
  { path: '/api/delivery', method: 'GET' },
  { path: '/api/assets/machines', method: 'GET' },
  
  // Root
  { path: '/', method: 'GET' },
];

function makeRequest(path, method, body) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          path,
          method,
          status: res.statusCode,
          ok: res.statusCode < 500,
          error: res.statusCode >= 500,
        });
      });
    });

    req.on('error', (err) => {
      resolve({ path, method, status: 'ERROR', ok: false, error: true, message: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ path, method, status: 'TIMEOUT', ok: false, error: true });
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('==============================================');
  console.log('  API ROUTE LOAD TEST');
  console.log(`  Target: ${BASE_URL}`);
  console.log('==============================================\n');

  // First check if server is running
  try {
    const health = await makeRequest('/', 'GET');
    if (health.status === 'ERROR') {
      console.log('❌ Server is not running on port', PORT);
      console.log('   Start it first: npm start');
      process.exit(1);
    }
    console.log('✅ Server is responding\n');
  } catch (e) {
    console.log('❌ Could not connect to server:', e.message);
    process.exit(1);
  }

  const results = [];
  for (const route of routes) {
    const result = await makeRequest(route.path, route.method, route.body);
    results.push(result);
    const icon = result.error ? '❌' : '✅';
    const statusStr = result.status === 'ERROR' ? 'CONN ERR' : `HTTP ${result.status}`;
    console.log(`${icon} ${route.method.padEnd(6)} ${route.path.padEnd(45)} ${statusStr}`);
  }

  const errors = results.filter(r => r.error);
  const ok = results.filter(r => !r.error);

  console.log('\n==============================================');
  console.log(`  RESULTS: ${ok.length} OK, ${errors.length} ERRORS`);
  console.log('==============================================');

  if (errors.length > 0) {
    console.log('\nFailed routes:');
    errors.forEach(e => console.log(`  ❌ ${e.method} ${e.path} -> ${e.status}${e.message ? ' (' + e.message + ')' : ''}`));
    process.exit(1);
  } else {
    console.log('\n✅ ALL ROUTES LOADED SUCCESSFULLY');
    process.exit(0);
  }
}

main();
