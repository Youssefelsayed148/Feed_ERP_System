# REBUILD PLAN — Al Kheir Feed Factory CRM
## Fresh PostgreSQL Database Setup

**Date:** 2026-06-17  
**Purpose:** Start from an empty `al_kheir_feed_factory` database and reach a state where `npm start` runs without crashing on missing tables.

---

## STEP 1 — SQL File Inventory

### Files found under `database/`

| File | Type | Creates | Alters | Seeds | Ordering clue |
|---|---|---|---|---|---|
| `complete_schema_with_sales.sql` | Schema | users, feed_types, feed_pricing, raw_materials, feed_recipes, feed_recipe_items, clients (full), client_liabilities, client_expected_payments, client_payment_history, sales_orders, sales_order_items, invoices, invoice_items, reminders, suppliers, inventory_transactions, production_orders, production_order_items | — | 8 users (owner through purchase_officer) | April 21, 2026 — has `DROP TABLE` block at top for clean slate |
| `phase1_foundation.sql` | Schema | machines, vehicles, purchase_orders, purchase_order_items ⚠️, goods_receipt_notes ⚠️, grn_items, supplier_payables, supplier_payments, notifications, purchase_requisitions, attendance_records, leave_requests, maintenance_schedules, delivery_assignments, finished_goods, payroll_records ⚠️, expenses | — | 3 extra users (WHERE NOT EXISTS guard) | April 28, 2026 — top comment says "Run AFTER complete_schema_with_sales.sql" |
| `approval_system.sql` | Schema | approval_settings, approval_requests, user_activity_log | — | approval_settings (6 rows) | No numeric prefix; must run after `users` exists (FK) |
| `005_add_cost_price_to_order_items.sql` | Migration | — | sales_order_items: adds `cost_price`, `total_cost` | — | Numeric prefix 005; must run after `sales_order_items` exists |
| `01_seed_data.sql` | Seed | — | — | 16 feed_types, 48 feed_pricing rows, 25 raw_materials | Prefix 01; must run after schema |
| `02_recipes_part1.sql` | Seed | — | — | feed_recipes + feed_recipe_items (recipes 1–8) | Prefix 02; after 01 |
| `03_recipes_part2.sql` | Seed | — | — | feed_recipes + feed_recipe_items (recipes 9–16) | Prefix 03; after 02 |
| `04_clients_suppliers.sql` | Seed | — | — | clients, suppliers | Prefix 04; after 01 |
| `schema.sql` | Schema | Same 13 tables as complete_schema_with_sales.sql but older/incomplete version | — | — | March 31, 2026 — **SKIP. See CONFLICT 1.** |
| `complete_migration.sql` | Runner | — | — | — | Calls `\i schema.sql` (the old one) — **SKIP.** |
| `phase4_verify.sql` | Verification | — | — | — | Only SELECTs; run manually after setup to audit data. |
| `fix-login-hashes.sql` | Emergency fix | — | users.password_hash | — | Not needed on a fresh DB — passwords are correct from seed. |

### Scripts under `backend/scripts/` that affect schema

These are Node.js files, not `.sql` files. They must be run with `node`, not `psql`.

| Script | What it does |
|---|---|
| `seed-employees.js` | Creates `employees` table (with `CREATE TABLE IF NOT EXISTS`) and inserts 36 real Arabic-name employees. **Must run after users exist.** |

### Routes that self-create tables at server startup (`ensureTable()` pattern)

These require no manual action — they run automatically the first time the backend starts:

| Route file | Table auto-created |
|---|---|
| `legal.js` | `legal_documents` |
| `contracts.js` | `contracts` |
| `installments.js` | `installments` |
| `reservations.js` | `reservations` |
| `partners.js` | `partners` |
| `grn.js` | Adds columns to `goods_receipt_notes`, `grn_items`, `purchase_order_items` via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |

---

## STEP 2 — Conflicts

### CONFLICT 1: `schema.sql` vs `complete_schema_with_sales.sql` — same 13 tables, two versions

`schema.sql` (March 31) and `complete_schema_with_sales.sql` (April 21) both CREATE the same core tables.

**Key differences that make `complete_schema_with_sales.sql` the authoritative version:**

| Table | schema.sql | complete_schema_with_sales.sql |
|---|---|---|
| `users` | **Missing entirely** | Present (email, password_hash, name, role, phone, department, is_active) |
| `clients` | Missing assigned_to, assigned_by, total_purchases | Has all assignment and tracking columns |
| `client_payment_history` | No `invoice_id`, no `collected_by` | Has both |
| `inventory_transactions.created_by` | `VARCHAR(100)` — a string | `INTEGER REFERENCES users(id)` — proper FK |
| `production_orders.created_by` | `VARCHAR(100)` | `INTEGER REFERENCES users(id)` |
| Sales tables | **Missing entirely** | Has sales_orders, sales_order_items, invoices, invoice_items, reminders |

**Resolution: Skip `schema.sql` entirely. Use only `complete_schema_with_sales.sql`.**

---

### CONFLICT 2: `purchase_order_items` — wrong FK column name in `phase1_foundation.sql`

`phase1_foundation.sql` defines the FK column as **`po_id`**.  
Every route that queries this table (`purchase-orders.js`, `grn.js`, `requisitions.js`) uses **`purchase_order_id`**.

- `purchase-orders.js` line 25: `LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id`
- `purchase-orders.js` line 95: `WHERE poi.purchase_order_id = $1`
- `purchase-orders.js` line 140: `INSERT INTO purchase_order_items (purchase_order_id, ...)`
- `requisitions.js` line 298: `INSERT INTO purchase_order_items (purchase_order_id, ...)`

Additionally, the route code inserts/reads columns that `phase1_foundation.sql` doesn't define:
- `unit_price` and `total_price` (INSERT in purchase-orders.js line 140)
- `received_quantity` (added by grn.js self-repair at startup — OK)

**Resolution:** `phase1_foundation.sql` uses `CREATE TABLE IF NOT EXISTS`. The `000_inferred_missing_tables.sql` file (Step 4) pre-creates this table with the correct column names AFTER phase1 creates `purchase_orders`. A post-phase1 ALTER RENAME is also included as a fallback.

---

### CONFLICT 3: `goods_receipt_notes` — wrong FK column name in `phase1_foundation.sql`

Same problem. `phase1_foundation.sql` names the FK `po_id`; all route code uses `purchase_order_id`.

- `purchase-orders.js` line 20–22: `grn.purchase_order_id = po.id`
- `grn.js` queries throughout use `purchase_order_id`

**Resolution:** Same approach as Conflict 2 — ALTER RENAME in the inferred tables file.

---

### CONFLICT 4: `payroll_records` missing `period_id` FK

`phase1_foundation.sql` creates `payroll_records` without a `period_id` column.  
`payroll.js` requires `period_id` for every meaningful operation:
- Line 11: `SELECT ... FROM payroll_periods pp JOIN ... WHERE pr.period_id = pp.id`
- Line 196: `INSERT INTO payroll_records (period_id, user_id, ...)`
- Line 677: `INSERT INTO payroll_records (user_id, period_id, period_start, ...)`

**Resolution:** The inferred tables file creates `payroll_periods` first (it has no schema file at all), then issues `ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS period_id`.

---

### CONFLICT 5: `notifications` missing `role` column

`phase1_foundation.sql` creates `notifications` without a `role` column.  
`notifications.js` (route) issues `WHERE role = $2` when filtering by role.

**Resolution:** `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role VARCHAR(50)` in the inferred file.

---

## STEP 3 — Tables Referenced in Code with NO Schema File

The following tables appear in `backend/src/routes/*.js` SQL queries but have no `CREATE TABLE` in any `.sql` schema file. **All CREATE TABLE statements below are written by me, inferred from how the code actually uses each table.**

---

### Table 1: `employees`

Inferred from: `employees.js`, `hr.js`, `payroll.js` (`payroll.js` line 158–163 accesses `e.salary, e.position`), `seed-employees.js` (CREATE TABLE block at line 21).

```sql
-- INFERRED: employees
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    position VARCHAR(255),          -- payroll.js line 80: e.position
    department VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    hire_date DATE,
    salary NUMERIC(12,2) DEFAULT 0, -- payroll.js line 163: parseFloat(e.salary)
    status VARCHAR(50) DEFAULT 'active',
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    documents JSONB,                -- hr.js uses JSON.parse on a documents field
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 2: `payroll_periods`

Inferred from: `payroll.js` throughout (GET /, GET /:id, POST /, PUT /:id/process, etc.)

```sql
-- INFERRED: payroll_periods
CREATE TABLE IF NOT EXISTS payroll_periods (
    id SERIAL PRIMARY KEY,
    period_name VARCHAR(20) NOT NULL UNIQUE,  -- format: "2026-06"
    start_date DATE,
    end_date DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'draft',       -- draft, processing, processed, approved, posted, paid
    total_basic_salary NUMERIC(12,2) DEFAULT 0,
    total_bonus NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    total_net_salary NUMERIC(12,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 3: `requisitions`

Inferred from: `requisitions.js` lines 116–127, 341.

```sql
-- INFERRED: requisitions
CREATE TABLE IF NOT EXISTS requisitions (
    id SERIAL PRIMARY KEY,
    requisition_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',       -- draft, sent, partial, completed, cancelled
    total_items INTEGER DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    sent_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 4: `requisition_items`

Inferred from: `requisitions.js` lines 139–152, 243–306.

```sql
-- INFERRED: requisition_items
CREATE TABLE IF NOT EXISTS requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER REFERENCES requisitions(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    suggested_quantity NUMERIC(12,3) DEFAULT 0,
    unit_price NUMERIC(10,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',     -- pending, ordered
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 5: `supplier_materials`

Inferred from: `requisitions.js` lines 32–33 (JOIN used in preview and generate).

```sql
-- INFERRED: supplier_materials
CREATE TABLE IF NOT EXISTS supplier_materials (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT false,
    unit_price NUMERIC(10,2),
    lead_time_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, raw_material_id)
);
```

---

### Table 6: `maintenance_reminders`

Inferred from: `maintenance-reminders.js` lines 11–17, 92–95, 109–118, 163–167.

```sql
-- INFERRED: maintenance_reminders
CREATE TABLE IF NOT EXISTS maintenance_reminders (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'routine',       -- routine, urgent, inspection
    description TEXT,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',     -- pending, scheduled, in_progress, completed, overdue, cancelled
    cost NUMERIC(10,2),
    notes TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 7: `journal_entries`

Inferred from: `finance-journal.js` lines 7–16, 56–61; `payroll.js` lines 342–349.

```sql
-- INFERRED: journal_entries
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),               -- payroll, expense, invoice, etc.
    reference_id INTEGER,
    total_amount NUMERIC(12,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 8: `journal_entry_lines`

Inferred from: `finance-journal.js` lines 17–28, 63–72; `payroll.js` lines 354–360.

```sql
-- INFERRED: journal_entry_lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER,                        -- FK to accounts; nullable (finance-journal.js line 63)
    account_name VARCHAR(255),                 -- denormalized copy; finance-journal.js line 69
    debit NUMERIC(12,2) DEFAULT 0,
    credit NUMERIC(12,2) DEFAULT 0,
    description TEXT,
    line_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Table 9: `accounts`

Inferred from: `finance-journal.js` lines 85–97, 107–120. Also: `payroll.js` line 359 hardcodes `account_id = 8` as "Salaries and Wages Expense" and `account_id = 1` as "Cash".

```sql
-- INFERRED: accounts (Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INFERRED seed: minimum chart of accounts
-- payroll.js hardcodes account_id=1 (Cash) and account_id=8 (Salaries Expense)
-- IDs must match exactly because payroll.js uses literal integers.
INSERT INTO accounts (id, name, type, is_active) VALUES
(1,  'النقدية',                    'asset',     true),
(2,  'حسابات القبض',               'asset',     true),
(3,  'مخزون - مواد خام',           'asset',     true),
(4,  'مخزون - منتجات تامة',        'asset',     true),
(5,  'حسابات الدفع',               'liability', true),
(6,  'حقوق الملكية',               'equity',    true),
(7,  'إيرادات المبيعات',           'revenue',   true),
(8,  'مصروفات الرواتب والأجور',    'expense',   true),
(9,  'تكلفة البضاعة المباعة',      'expense',   true),
(10, 'مصروفات أخرى',              'expense',   true)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence so future INSERTs start after 10
SELECT setval('accounts_id_seq', 10);
```

---

### Table 10: `activity_log`

Inferred from: `backend/src/utils/activity.js` lines 4–13, 19–21.

**Important:** This is distinct from `user_activity_log` (created by `approval_system.sql`). Both exist. Different column sets, different names.

```sql
-- INFERRED: activity_log (distinct from user_activity_log in approval_system.sql)
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255),
    user_role VARCHAR(50),
    action VARCHAR(100),
    module VARCHAR(50),
    description TEXT,
    entity_id INTEGER,
    entity_type VARCHAR(50),
    amount NUMERIC(12,2),
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
```

---

### Table 11: `companies`

Inferred from: `organization.js` line 8: `SELECT * FROM companies LIMIT 1`.

```sql
-- INFERRED: companies (used by organization module)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name_arabic VARCHAR(255),
    name_english VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    tax_number VARCHAR(100),
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert one placeholder row so the endpoint doesn't return null
INSERT INTO companies (name_arabic, name_english)
VALUES ('مصنع الخير للأعلاف', 'Al Kheir Feed Factory')
ON CONFLICT DO NOTHING;
```

---

### Post-phase1 ALTER TABLE fixes (included in the inferred file)

These correct the column naming conflicts identified in Step 2:

```sql
-- FIX CONFLICT 2: purchase_order_items po_id → purchase_order_id
ALTER TABLE purchase_order_items RENAME COLUMN po_id TO purchase_order_id;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS unit_price  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2) DEFAULT 0;

-- FIX CONFLICT 3: goods_receipt_notes po_id → purchase_order_id
ALTER TABLE goods_receipt_notes RENAME COLUMN po_id TO purchase_order_id;

-- FIX CONFLICT 4: payroll_records missing period_id
ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS period_id INTEGER REFERENCES payroll_periods(id) ON DELETE SET NULL;

-- FIX CONFLICT 5: notifications missing role column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS role VARCHAR(50);

-- FIX: finished_goods missing number_of_bags (requisitions.js line 401 UPDATE)
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS number_of_bags INTEGER DEFAULT 0;

-- FIX: purchase_orders missing vat_amount (purchase-orders.js adds it at runtime, but add it here too for cleanliness)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) DEFAULT 0;
```

---

## STEP 4 — Final Run Order

### Before you start

These commands assume:
- PostgreSQL is running on `localhost:5432`
- Your PostgreSQL username is `postgres`
- The database `al_kheir_feed_factory` already exists and is **empty** (zero tables)
- You are running from the `feed factory crm/` directory (the one containing `backend/` and `database/`)
- The password for `postgres` is what you have set locally (you'll be prompted, or set `PGPASSWORD` env var)

**To avoid being prompted for password on every command**, run this first in PowerShell:
```powershell
$env:PGPASSWORD = "your_postgres_password_here"
```

---

### The full run sequence

**1. FIRST — create the inferred missing tables file.**

Copy the entire content from the "STEP 3" sections above into a new file:
```
database\000_inferred_missing_tables.sql
```

The file must contain, in this order:
1. `CREATE TABLE IF NOT EXISTS employees`
2. `CREATE TABLE IF NOT EXISTS payroll_periods`
3. `CREATE TABLE IF NOT EXISTS requisitions`
4. `CREATE TABLE IF NOT EXISTS requisition_items`
5. `CREATE TABLE IF NOT EXISTS supplier_materials`
6. `CREATE TABLE IF NOT EXISTS maintenance_reminders`
7. `CREATE TABLE IF NOT EXISTS journal_entries`
8. `CREATE TABLE IF NOT EXISTS journal_entry_lines`
9. `CREATE TABLE IF NOT EXISTS accounts` + INSERT seed data + setval
10. `CREATE TABLE IF NOT EXISTS activity_log` + indexes
11. `CREATE TABLE IF NOT EXISTS companies` + INSERT placeholder
12. All the `ALTER TABLE` fixes from the "Post-phase1 fixes" section

> ⚠️ `requisition_items` has a FK to `purchase_orders` (via `purchase_order_id`). That table is created by `phase1_foundation.sql`. So `000_inferred_missing_tables.sql` must run **after** `phase1_foundation.sql`. The ordering below reflects this.

---

**Run these commands in PowerShell, in order:**

```powershell
# Navigate to the project root (adjust path if needed)
cd "d:\The Osiris Labs\factory crm\feed-factory-crm-20260421-fixed\feed factory crm"

# --- SCHEMA FILES ---

# 1. Core schema (users, clients, orders, invoices, recipes, etc.)
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\complete_schema_with_sales.sql"

# 2. Additional tables (machines, vehicles, POs, GRNs, payroll_records, expenses, etc.)
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\phase1_foundation.sql"

# 3. Approval system + user_activity_log
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\approval_system.sql"

# 4. Add cost_price column to sales_order_items
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\005_add_cost_price_to_order_items.sql"

# 5. Inferred missing tables + column name fixes (create this file from Step 3 above)
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\000_inferred_missing_tables.sql"

# --- SEED DATA ---

# 6. Feed types, pricing, raw materials
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\01_seed_data.sql"

# 7. Recipes part 1 (recipes 1-8)
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\02_recipes_part1.sql"

# 8. Recipes part 2 (recipes 9-16)
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\03_recipes_part2.sql"

# 9. Clients and suppliers
psql -h localhost -U postgres -d al_kheir_feed_factory -f "database\04_clients_suppliers.sql"

# --- NODE SCRIPT ---

# 10. Seed employees (creates employees table + 36 rows)
#     Must run after users are seeded (step 1 seeds them)
node backend\scripts\seed-employees.js
```

---

**Files to SKIP entirely:**

| File | Why |
|---|---|
| `database\schema.sql` | Superseded by `complete_schema_with_sales.sql` (Conflict 1) |
| `database\complete_migration.sql` | Runner that calls `schema.sql` — the wrong one |
| `database\phase4_verify.sql` | Verification queries only — run manually afterwards if you want |
| `database\fix-login-hashes.sql` | Not needed; fresh setup already has valid hashes |

---

## STEP 5 — Seed User

`complete_schema_with_sales.sql` (Step 1 above) already inserts these 8 users:

| Email | Password | Role |
|---|---|---|
| `owner@al-kheir.com` | `password123` | owner |
| `admin@al-kheir.com` | `password123` | admin |
| `sales.manager@al-kheir.com` | `password123` | sales_manager |
| `sales.rep1@al-kheir.com` | `password123` | sales_rep |
| `sales.rep2@al-kheir.com` | `password123` | sales_rep |
| `production.manager@al-kheir.com` | `password123` | production_manager |
| `finance.manager@al-kheir.com` | `password123` | finance_manager |
| `purchase.officer@al-kheir.com` | `password123` | purchase_officer |

`phase1_foundation.sql` (Step 2) also inserts `hr.manager@al-kheir.com` and `warehouse.manager@al-kheir.com` with the same password.

**No manual INSERT needed.** Log in with `owner@al-kheir.com` / `password123`.

The bcrypt hash used is:  
`$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O`  
(verified with bcryptjs cost=12, password="password123")

If logins still fail after setup, run `fix-login-hashes.sql` to repair any broken hashes without dropping data.

---

## Quick Verification Query

After all steps complete, run this in pgAdmin to confirm all critical tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see at least these tables:
`accounts`, `activity_log`, `approval_requests`, `approval_settings`,
`attendance_records`, `client_expected_payments`, `client_liabilities`,
`client_payment_history`, `clients`, `companies`, `delivery_assignments`,
`employees`, `expenses`, `feed_pricing`, `feed_recipe_items`, `feed_recipes`,
`feed_types`, `finished_goods`, `goods_receipt_notes`, `grn_items`,
`invoice_items`, `invoices`, `inventory_transactions`, `journal_entries`,
`journal_entry_lines`, `leave_requests`, `machines`, `maintenance_reminders`,
`maintenance_schedules`, `notifications`, `payroll_periods`, `payroll_records`,
`production_order_items`, `production_orders`, `purchase_order_items`,
`purchase_orders`, `purchase_requisitions`, `raw_materials`, `reminders`,
`requisition_items`, `requisitions`, `sales_order_items`, `sales_orders`,
`supplier_materials`, `supplier_payables`, `supplier_payments`, `suppliers`,
`user_activity_log`, `users`, `vehicles`

Tables auto-created on first server start (not in the list above yet):
`contracts`, `installments`, `legal_documents`, `partners`, `reservations`

---

## Known Remaining Issues (not blocking startup, but will cause errors when you click those features)

These are code bugs that no schema change will fix — they are noted here so you know what to expect when testing:

1. **`hr.js` exports the router 19 times** — only routes defined before the first `module.exports = router` on line 29 survive. All later route definitions in that file are silently dead. The GET `/hr/employees` endpoint works; most other HR routes return 404.

2. **`notifications.js` `WHERE role = $2`** — the `role` column fix in `000_inferred_missing_tables.sql` above will prevent this from throwing a column error. However the notifications table still has no `role` data, so role-filtered queries will return empty results.

3. **`AutoPO.js` / `AutoPODashboardWidget.js`** — these frontend components fall back to hardcoded demo data (with Tanzanian phone numbers) when any API call fails. This is a frontend code issue.

4. **`requisitions.js` preview/generate** — uses `supplier_materials` JOIN to find preferred suppliers. The table now exists (from `000_inferred_missing_tables.sql`) but will be empty until you assign supplier-material relationships. The endpoint still works — it just returns no supplier info.

5. **`payroll.js` line 357** — hardcodes `account_id = 8` and `account_id = 1`. Works because the accounts seed data above inserts those exact IDs.
