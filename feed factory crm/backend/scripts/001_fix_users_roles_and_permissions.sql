-- =====================================================================
-- Migration: Fix users.role CHECK constraint + add module_permissions
-- =====================================================================
-- WHY: The original users table CHECK constraint hardcoded role names
-- that don't match the actual Al-Khair CRM Employee Access & Permissions
-- doc (v2.0) or the backend authorize() calls across the codebase:
--   wrong: purchase_officer, production_manager, hr_manager,
--          warehouse_manager, customer_accountant, cashier,
--          purchasing_coordinator, quality_assistant
--   real:  purchasing_mgr, production_mgr, accountant (no hr_manager
--          role exists — HR is handled by accountant/owner per doc)
-- Inserting a user with the correct role would be REJECTED by Postgres
-- before the app ever sees it. This must run before any corrected seed.
--
-- Also adds module_permissions, which never existed in the schema at
-- all — Sidebar.js's hasModulePermission() and App.js's hasModuleAccess()
-- both read user.modulePermissions, but the column to store it was
-- missing, so every existing user effectively has no module access.
--
-- Run this from Windows PowerShell against the al_kheir_feed_factory
-- database (PostgreSQL runs on Windows, not WSL, per project setup).
-- =====================================================================

-- 1. Drop the old, incorrect CHECK constraint.
--    Constraint name may differ — find it first if this fails:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass AND contype = 'c';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Add the correct CHECK constraint matching the access doc's 16 roles.
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
    role IN (
        'owner', 'admin',
        'sales_manager', 'sales_rep',
        'purchasing_mgr',
        'production_mgr', 'production_asst',
        'finance_manager', 'accountant', 'cost_accountant',
        'maintenance_mgr', 'maintenance_tech',
        'legal_mgr', 'legal_officer',
        'driver', 'logistics_coordinator'
    )
);

-- 3. Add module_permissions column (text array), if it doesn't already exist.
ALTER TABLE users ADD COLUMN IF NOT EXISTS module_permissions TEXT[] DEFAULT '{}';

-- 4. If any existing rows have a now-invalid role from the old constraint,
--    they would block step 2 from succeeding. Run this check FIRST if the
--    ALTER above fails with a constraint violation:
--
--    SELECT id, email, role FROM users
--    WHERE role NOT IN (
--      'owner','admin','sales_manager','sales_rep','purchasing_mgr',
--      'production_mgr','production_asst','finance_manager','accountant',
--      'cost_accountant','maintenance_mgr','maintenance_tech','legal_mgr',
--      'legal_officer','driver','logistics_coordinator'
--    );
--
--    Manually update or remove any rows it returns before re-running this
--    migration. (On a fresh dev database with only the placeholder
--    owner/admin rows from the original 07_seed_data.sql, this should be
--    empty or limited to a couple of rows you can safely fix by hand.)
