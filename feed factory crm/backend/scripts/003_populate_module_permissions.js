require('dotenv').config();

// =====================================================================
// 003_populate_module_permissions.js
// ONE-OFF STOPGAP — will be replaced by a proper permission system later.
//
// Populates users.module_permissions with role-based defaults.
// Does NOT include 'dashboard' in any role except owner/admin.
// Run:  node backend/scripts/003_populate_module_permissions.js
// =====================================================================

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'al_kheir_feed_factory',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 1,
});

// Role → module_permissions array (NO 'dashboard' except owner/admin)
const ROLE_DEFAULTS = {
  owner: [
    'dashboard', 'sales', 'clients', 'orders', 'suppliers', 'purchase_orders',
    'grn', 'inventory', 'feed_recipes', 'production', 'finance', 'receivables',
    'payables', 'expenses', 'accounting', 'legal', 'assets', 'hr', 'payroll',
    'delivery', 'approvals', 'settings',
  ],
  admin: [
    'dashboard', 'sales', 'clients', 'orders', 'suppliers', 'purchase_orders',
    'grn', 'inventory', 'feed_recipes', 'production', 'finance', 'receivables',
    'payables', 'expenses', 'accounting', 'legal', 'assets', 'hr', 'payroll',
    'delivery', 'approvals', 'settings',
  ],
  ceo: [
    'dashboard', 'sales', 'clients', 'orders', 'suppliers', 'purchase_orders',
    'grn', 'inventory', 'feed_recipes', 'production', 'finance', 'receivables',
    'payables', 'expenses', 'accounting', 'legal', 'assets', 'hr', 'payroll',
    'delivery', 'approvals', 'settings',
  ],
  sales_manager:     ['sales', 'clients', 'orders', 'inventory', 'receivables', 'delivery', 'approvals'],
  sales_rep:         ['sales', 'clients', 'orders', 'approvals'],
  purchasing_mgr:    ['suppliers', 'purchase_orders', 'grn', 'inventory', 'payables', 'approvals'],
  production_mgr:    ['production', 'inventory', 'feed_recipes', 'assets', 'approvals'],
  production_asst:   ['production', 'inventory', 'feed_recipes'],
  finance_manager:   ['finance', 'receivables', 'payables', 'expenses', 'accounting', 'hr', 'payroll', 'approvals'],
  accountant:        ['finance', 'receivables', 'payables', 'accounting'],
  cost_accountant:   ['finance', 'accounting', 'inventory'],
  maintenance_mgr:   ['assets', 'approvals'],
  maintenance_tech:  ['assets'],
  legal_mgr:         ['legal', 'clients', 'approvals'],
  legal_officer:     ['legal', 'clients'],
  driver:            ['delivery'],
  logistics_coordinator: ['delivery', 'assets', 'suppliers'],
};

async function main() {
  try {
    // ---- STEP 1: Show BEFORE state ----
    console.log('\n========== BEFORE ==========');
    const before = await pool.query(
      `SELECT id, name, role, email, module_permissions
       FROM users
       WHERE is_active = true
       ORDER BY role, id`
    );
    console.table(before.rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      email: r.email,
      perms: Array.isArray(r.module_permissions) ? r.module_permissions.join(',') || '(empty)' : '(null)',
    })));

    // ---- STEP 2: Apply updates ----
    console.log('\n========== APPLYING UPDATES ==========');
    for (const [role, perms] of Object.entries(ROLE_DEFAULTS)) {
      const result = await pool.query(
        'UPDATE users SET module_permissions = $1, updated_at = CURRENT_TIMESTAMP WHERE role = $2',
        [perms, role]
      );
      console.log(`  ${role}: ${result.rowCount} row(s) updated`);
    }

    // Also catch any unknown role that might have slipped in (set to empty)
    // Don't touch unknown roles — leave them as-is.

    // ---- STEP 3: Show AFTER state ----
    console.log('\n========== AFTER ==========');
    const after = await pool.query(
      `SELECT id, name, role, email, module_permissions
       FROM users
       WHERE is_active = true
       ORDER BY role, id`
    );
    console.table(after.rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      perms: Array.isArray(r.module_permissions) ? r.module_permissions.join(',') || '(empty)' : '(null)',
    })));

    // ---- STEP 4: Verify ----
    console.log('\n========== VERIFICATION ==========');
    const verify = await pool.query(
      `SELECT role,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE module_permissions = '{}' OR module_permissions IS NULL) as still_empty
       FROM users
       WHERE is_active = true
       GROUP BY role
       ORDER BY role`
    );
    console.table(verify.rows);

    const emptyRoles = verify.rows.filter(r => r.still_empty > 0);
    if (emptyRoles.length > 0) {
      console.log('\nWARNING: The following roles still have empty module_permissions:');
      console.table(emptyRoles);
    } else {
      console.log('\nAll roles have non-empty module_permissions.');
    }

    console.log('\nDone.');
  } catch (err) {
    console.error('FATAL:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
