# Phase 4 - Windows Execution Commands
# Run these in the EXACT ORDER listed below
# PostgreSQL must be running and accessible from Windows

# ============================================================
# STEP 1: Navigate to backend folder
# ============================================================
cd "E:\feed factory crm\backend"

# ============================================================
# STEP 2: Install dependencies (if not already done)
# ============================================================
npm install

# ============================================================
# STEP 3: Run the sales data migration script
# This inserts sales orders, items, invoices, and payments
# from the archived JSON files into PostgreSQL
# ============================================================
node migrate-sales-only.js

# Expected output:
# - 1 sales order inserted (SO-2026-001)
# - 2 sales order items inserted
# - 1 invoice inserted (INV-2026-001)
# - 2 invoice items inserted
# - 0-5 payments inserted (depending on client matches)

# ============================================================
# STEP 4: Run SQL verification in pgAdmin
# Open pgAdmin, connect to al_kheir_feed_factory database,
# open Query Tool, and run this file:
# ============================================================
# File: E:\feed factory crm\database\phase4_verify.sql

# Look for these key results:
# - All orphan counts should be 0
# - All invalid counts should be 0
# - All NULL violation counts should be 0
# - No duplicate rows
# - Table counts should match expected baseline

# ============================================================
# STEP 5: Start the server (in a separate terminal)
# ============================================================
cd "E:\feed factory crm\backend"
npm start

# Wait for: "Feed Factory OS Server running on port 5000"
# Wait for: "PostgreSQL database connection verified"

# ============================================================
# STEP 6: Test all API routes (in a new terminal while server is running)
# ============================================================
cd "E:\feed factory crm\backend"
node scripts\test-api-routes.js

# Expected: ALL ROUTES LOADED SUCCESSFULLY
# Any HTTP 500 errors indicate a route that needs fixing

# ============================================================
# STEP 7: Test business flows (in a new terminal while server is running)
# ============================================================
cd "E:\feed factory crm\backend"
node scripts\test-business-flows.js

# Expected: All operations return 200 OK
# Check that clients, inventory, sales, finance all respond correctly

# ============================================================
# STEP 8: Manual spot checks (optional but recommended)
# Open browser or Postman and test these endpoints:
# ============================================================
# GET  http://localhost:5000/
# GET  http://localhost:5000/api/clients/clients
# GET  http://localhost:5000/api/sales/sales-orders
# GET  http://localhost:5000/api/finance/invoices
# GET  http://localhost:5000/api/dashboard

# ============================================================
# TROUBLESHOOTING
# ============================================================
# If migrate-sales-only.js fails:
#   - Check that .env has correct DB_PASSWORD
#   - Check that PostgreSQL is running on Windows
#   - Check that al_kheir_feed_factory database exists
#
# If API routes return 500:
#   - Check server logs in the terminal running npm start
#   - Look for "Error fetching..." messages
#   - Common issues: missing table, wrong column name, constraint violation
#
# If SQL verification shows orphans:
#   - Check that Phase 2 migration was fully completed
#   - Run the orphan cleanup queries manually
