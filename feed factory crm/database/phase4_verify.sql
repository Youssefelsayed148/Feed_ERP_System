-- ============================================================
-- PHASE 4 VERIFICATION SQL
-- Run this in pgAdmin or psql to verify PostgreSQL migration
-- ============================================================

-- ============================================================
-- 1. TABLE COUNT VERIFICATION
-- ============================================================
SELECT 
  'TABLE COUNT CHECK' as check_type,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- 2. CRITICAL REFERENTIAL INTEGRITY (ORPHAN CHECKS)
-- ============================================================

-- Orphan sales orders (client doesn't exist)
SELECT 
  'ORPHAN sales_orders.client_id' as check_name,
  COUNT(*) as orphan_count
FROM sales_orders so
LEFT JOIN clients c ON c.id = so.client_id
WHERE c.id IS NULL;

-- Orphan sales order items (order doesn't exist)
SELECT 
  'ORPHAN sales_order_items.order_id' as check_name,
  COUNT(*) as orphan_count
FROM sales_order_items soi
LEFT JOIN sales_orders so ON so.id = soi.order_id
WHERE so.id IS NULL;

-- Orphan recipe items (recipe doesn't exist)
SELECT 
  'ORPHAN feed_recipe_items.recipe_id' as check_name,
  COUNT(*) as orphan_count
FROM feed_recipe_items fri
LEFT JOIN feed_recipes fr ON fr.id = fri.recipe_id
WHERE fr.id IS NULL;

-- Orphan production orders (recipe doesn't exist)
SELECT 
  'ORPHAN production_orders.recipe_id' as check_name,
  COUNT(*) as orphan_count
FROM production_orders po
LEFT JOIN feed_recipes fr ON fr.id = po.recipe_id
WHERE po.recipe_id IS NOT NULL AND fr.id IS NULL;

-- Orphan invoices (order doesn't exist)
SELECT 
  'ORPHAN invoices.order_id' as check_name,
  COUNT(*) as orphan_count
FROM invoices inv
LEFT JOIN sales_orders so ON so.id = inv.order_id
WHERE inv.order_id IS NOT NULL AND so.id IS NULL;

-- Orphan invoice items (invoice doesn't exist)
SELECT 
  'ORPHAN invoice_items.invoice_id' as check_name,
  COUNT(*) as orphan_count
FROM invoice_items ii
LEFT JOIN invoices inv ON inv.id = ii.invoice_id
WHERE inv.id IS NULL;

-- Orphan inventory transactions (raw_material doesn't exist)
SELECT 
  'ORPHAN inventory_transactions.raw_material_id' as check_name,
  COUNT(*) as orphan_count
FROM inventory_transactions it
LEFT JOIN raw_materials rm ON rm.id = it.raw_material_id
WHERE it.raw_material_id IS NOT NULL AND rm.id IS NULL;

-- Orphan client liabilities (client doesn't exist)
SELECT 
  'ORPHAN client_liabilities.client_id' as check_name,
  COUNT(*) as orphan_count
FROM client_liabilities cl
LEFT JOIN clients c ON c.id = cl.client_id
WHERE c.id IS NULL;

-- Orphan client payment history (client doesn't exist)
SELECT 
  'ORPHAN client_payment_history.client_id' as check_name,
  COUNT(*) as orphan_count
FROM client_payment_history cph
LEFT JOIN clients c ON c.id = cph.client_id
WHERE c.id IS NULL;

-- Orphan production order items (production order doesn't exist)
SELECT 
  'ORPHAN production_order_items.production_order_id' as check_name,
  COUNT(*) as orphan_count
FROM production_order_items poi
LEFT JOIN production_orders po ON po.id = poi.production_order_id
WHERE po.id IS NULL;

-- ============================================================
-- 3. CHECK CONSTRAINT VALIDATION
-- ============================================================

-- Invalid client.type values
SELECT 
  'INVALID clients.type' as check_name,
  COUNT(*) as invalid_count
FROM clients
WHERE type NOT IN ('wholesale', 'retail', 'distributor', 'farm');

-- Invalid client.status values
SELECT 
  'INVALID clients.status' as check_name,
  COUNT(*) as invalid_count
FROM clients
WHERE status NOT IN ('active', 'inactive', 'blocked');

-- Invalid sales_orders.status values
SELECT 
  'INVALID sales_orders.status' as check_name,
  COUNT(*) as invalid_count
FROM sales_orders
WHERE status NOT IN ('pending_approval', 'approved', 'confirmed', 'processing', 'in_transit', 'delivered', 'rejected', 'cancelled');

-- Invalid sales_orders.payment_status values
SELECT 
  'INVALID sales_orders.payment_status' as check_name,
  COUNT(*) as invalid_count
FROM sales_orders
WHERE payment_status NOT IN ('pending', 'partial', 'paid', 'overdue');

-- Invalid invoices.status values
SELECT 
  'INVALID invoices.status' as check_name,
  COUNT(*) as invalid_count
FROM invoices
WHERE status NOT IN ('pending', 'partial', 'paid', 'overdue', 'cancelled');

-- Invalid production_orders.status values
SELECT 
  'INVALID production_orders.status' as check_name,
  COUNT(*) as invalid_count
FROM production_orders
WHERE status NOT IN ('draft', 'approved', 'in_progress', 'completed', 'cancelled');

-- Invalid users.role values
SELECT 
  'INVALID users.role' as check_name,
  COUNT(*) as invalid_count
FROM users
WHERE role NOT IN ('owner', 'admin', 'sales_manager', 'sales_rep', 'purchase_officer', 'production_manager', 'finance_manager', 'hr_manager', 'warehouse_manager');

-- ============================================================
-- 4. NULL CONSTRAINT VIOLATIONS (critical fields)
-- ============================================================

-- Users with NULL password_hash (security risk)
SELECT 
  'NULL users.password_hash' as check_name,
  COUNT(*) as violation_count
FROM users
WHERE password_hash IS NULL OR password_hash = '';

-- Users with NULL email
SELECT 
  'NULL users.email' as check_name,
  COUNT(*) as violation_count
FROM users
WHERE email IS NULL OR email = '';

-- Clients with NULL name_arabic
SELECT 
  'NULL clients.name_arabic' as check_name,
  COUNT(*) as violation_count
FROM clients
WHERE name_arabic IS NULL OR name_arabic = '';

-- Feed types with NULL code
SELECT 
  'NULL feed_types.code' as check_name,
  COUNT(*) as violation_count
FROM feed_types
WHERE code IS NULL OR code = '';

-- Sales orders with NULL order_number
SELECT 
  'NULL sales_orders.order_number' as check_name,
  COUNT(*) as violation_count
FROM sales_orders
WHERE order_number IS NULL OR order_number = '';

-- Invoices with NULL invoice_number
SELECT 
  'NULL invoices.invoice_number' as check_name,
  COUNT(*) as violation_count
FROM invoices
WHERE invoice_number IS NULL OR invoice_number = '';

-- ============================================================
-- 5. DUPLICATE KEY CHECKS
-- ============================================================

-- Duplicate client codes
SELECT 
  'DUPLICATE clients.code' as check_name,
  code,
  COUNT(*) as dup_count
FROM clients
GROUP BY code
HAVING COUNT(*) > 1;

-- Duplicate sales order numbers
SELECT 
  'DUPLICATE sales_orders.order_number' as check_name,
  order_number,
  COUNT(*) as dup_count
FROM sales_orders
GROUP BY order_number
HAVING COUNT(*) > 1;

-- Duplicate invoice numbers
SELECT 
  'DUPLICATE invoices.invoice_number' as check_name,
  invoice_number,
  COUNT(*) as dup_count
FROM invoices
GROUP BY invoice_number
HAVING COUNT(*) > 1;

-- Duplicate feed type codes
SELECT 
  'DUPLICATE feed_types.code' as check_name,
  code,
  COUNT(*) as dup_count
FROM feed_types
GROUP BY code
HAVING COUNT(*) > 1;

-- Duplicate user emails
SELECT 
  'DUPLICATE users.email' as check_name,
  email,
  COUNT(*) as dup_count
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- ============================================================
-- 6. BUSINESS LOGIC VALIDATION
-- ============================================================

-- Sales orders where total_amount > 0 but no items exist
SELECT 
  'sales_orders with no items' as check_name,
  COUNT(*) as count
FROM sales_orders so
WHERE so.total_amount > 0
  AND NOT EXISTS (SELECT 1 FROM sales_order_items soi WHERE soi.order_id = so.id);

-- Clients with negative credit limit
SELECT 
  'clients with negative credit_limit' as check_name,
  COUNT(*) as count
FROM clients
WHERE credit_limit < 0;

-- Clients with negative current_balance
SELECT 
  'clients with negative current_balance' as check_name,
  COUNT(*) as count
FROM clients
WHERE current_balance < 0;

-- Invoices where paid_amount > amount
SELECT 
  'invoices overpaid' as check_name,
  COUNT(*) as count
FROM invoices
WHERE paid_amount > amount;

-- Invoices where balance_due != amount - paid_amount (within rounding)
SELECT 
  'invoices balance mismatch' as check_name,
  COUNT(*) as count
FROM invoices
WHERE ABS(balance_due - (amount - paid_amount)) > 0.01;

-- Production orders with NULL recipe_id but status = 'completed'
SELECT 
  'completed production_orders with no recipe' as check_name,
  COUNT(*) as count
FROM production_orders
WHERE status = 'completed' AND recipe_id IS NULL;

-- Raw materials with negative current_stock
SELECT 
  'raw_materials with negative stock' as check_name,
  COUNT(*) as count
FROM raw_materials
WHERE current_stock < 0;

-- ============================================================
-- 7. EXPECTED DATA PRESENCE
-- ============================================================

-- Count of all critical tables
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'feed_types', COUNT(*) FROM feed_types
UNION ALL SELECT 'feed_recipes', COUNT(*) FROM feed_recipes
UNION ALL SELECT 'feed_recipe_items', COUNT(*) FROM feed_recipe_items
UNION ALL SELECT 'raw_materials', COUNT(*) FROM raw_materials
UNION ALL SELECT 'sales_orders', COUNT(*) FROM sales_orders
UNION ALL SELECT 'sales_order_items', COUNT(*) FROM sales_order_items
UNION ALL SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items', COUNT(*) FROM invoice_items
UNION ALL SELECT 'production_orders', COUNT(*) FROM production_orders
UNION ALL SELECT 'production_order_items', COUNT(*) FROM production_order_items
UNION ALL SELECT 'suppliers', COUNT(*) FROM suppliers
UNION ALL SELECT 'inventory_transactions', COUNT(*) FROM inventory_transactions
UNION ALL SELECT 'client_liabilities', COUNT(*) FROM client_liabilities
UNION ALL SELECT 'client_payment_history', COUNT(*) FROM client_payment_history
UNION ALL SELECT 'client_expected_payments', COUNT(*) FROM client_expected_payments
UNION ALL SELECT 'reminders', COUNT(*) FROM reminders
ORDER BY table_name;

-- ============================================================
-- 8. CONNECTION TEST (run last)
-- ============================================================
SELECT 
  'DATABASE CONNECTION OK' as status,
  current_database() as database_name,
  current_user as connected_user,
  version() as postgres_version;
