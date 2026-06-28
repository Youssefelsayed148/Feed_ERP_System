# INVESTIGATION REPORT — Al Kheir Feed Factory CRM

**Date of Investigation:** 2026-06-17  
**Investigator:** Static code analysis (read-only)  
**Codebase root:** `d:\The Osiris Labs\factory crm\feed-factory-crm-20260421-fixed\feed factory crm\`

---

## 1. Executive Summary

- **`pg` package is in `devDependencies` only** — `backend/package.json` line 33 lists `"pg": "^8.20.0"` under `devDependencies`, not `dependencies`. This means the entire PostgreSQL adapter will be missing in any production (`npm install --production`) deployment. The app will crash on startup.
- **`hr.js` route file exports the router 19 times** (`module.exports = router;` appears on lines 29, 47, 59, 76, 104, 141, 161, 177, 200, 214, 234, 245, 256, 267, 277, 319, 357, 377, 405). Each `module.exports` call overwrites the previous, so only the **last** assignment is exported. Every route registered *after* line 405 will be dead. This is a severe structural bug that silently drops all attendance/leave/payroll/performance endpoints from the express router.
- **`maintenance_reminders` table is referenced in code but has no `CREATE TABLE` in any SQL schema file.** `backend/src/routes/maintenance-reminders.js` performs `SELECT/INSERT/UPDATE` against `maintenance_reminders` but only `maintenance_schedules` is defined in `phase1_foundation.sql`. The entire Maintenance Reminders module will fail at runtime.
- **`employees` table is referenced in code but has no `CREATE TABLE` in any schema file.** Routes `employees.js`, `hr.js`, `payroll.js`, `dashboard.js`, and `export.js` all query `FROM employees`, but no `CREATE TABLE employees` appears in the database SQL files.
- **`requisitions` and `requisition_items` tables are used in code but have no schema definition.** `backend/src/routes/requisitions.js` queries both tables but neither is defined in any SQL file. This is distinct from `purchase_requisitions` which is defined.
- **`supplier_materials` table is used in `requisitions.js` (line 33) but has no schema definition.** The `JOIN supplier_materials` will fail at runtime.
- **`AutoPO.js` and `AutoPODashboardWidget.js` use demo/fake data as hardcoded fallback**, silently replacing real API responses on any error. The demo data has English names, foreign-format phone numbers, and mock IDs, and will render even in production if the API fails.
- **Backend `package.json` `name` field is `@osiris-labs/realestate-os-backend`** — clearly copied from a real-estate project template. This is a cosmetic issue but indicates incomplete migration from a prior codebase.
- **`notifications` table has a `WHERE role = $2` clause but the `notifications` table schema does not include a `role` column** — it only has `user_id`. The notifications query will silently return no role-broadcast notifications or throw a column error.
- **`Auth` route is the only route where `POST /register` and `POST /login` are public (unauthenticated)** — all other routes correctly require `authenticate`. However, `users.js` GET routes (listing all users and their roles) have no role-based authorization check — any authenticated user can enumerate all users.

---

## 2. Module Inventory Table

| Module Name | Status | Notes |
|---|---|---|
| Authentication (auth) | stable | Login, register, me — all functional |
| Clients | stable | Full CRUD, liabilities, payment history, statements |
| Orders (sales_orders) | stable | Full CRUD, approval flow, invoice generation |
| Sales (role-based) | stable | Client assignment, rep/manager views, reminders, dashboards |
| Inventory (raw materials, finished goods) | stable | Raw materials, finished goods, stock movements |
| Feed Recipes | stable | Full recipe management with ingredients |
| Feed Types | stable | Full CRUD |
| Production | stable | Production orders, batch management |
| Finance | stable | Dashboard, invoices, expenses, accounts, journal entries |
| Finance Journal | stable | Double-entry journal, chart of accounts |
| HR | broken-looking | 19 duplicate `module.exports` in hr.js — only final export survives; many routes dead |
| Employees | broken-looking | `employees` table queried but not in any SQL schema |
| Payroll | modified | New `payroll_periods` + `payroll_records` tables; full lifecycle |
| Delivery | stable | Vehicles, delivery assignments, full status lifecycle |
| Assets (Machines) | stable | Machine CRUD, maintenance schedules |
| Maintenance Reminders | broken-looking | References `maintenance_reminders` table not in any schema SQL |
| Procurement (Suppliers, POs) | stable | Full supplier and PO lifecycle |
| GRN (Goods Receipt Notes) | stable | Inline schema migration on startup, links to POs |
| Payables | stable | Supplier payables with aging and payments |
| Expenses | stable | Full CRUD with approval flow |
| Notifications | modified | Schema column mismatch: queries `role` column not defined in schema |
| Dashboard | stable | Aggregates from multiple tables |
| Documents | stable | File upload for entities |
| Approvals | new | Approval settings + request flow; new since original 12 |
| Legal | new | Legal document management; creates own table on startup |
| Purchase Requisitions | new | JSONB-based items; separate from `requisitions` |
| Requisitions (AutoPO) | broken-looking | References `requisitions`, `requisition_items`, `supplier_materials` — none in schema |
| Activity Log | new | `user_activity_log` table; new since original 12 |
| WhatsApp | stub | Route file exists, likely not connected to real WhatsApp API |
| Location | stub | Only file in outer `backend/src/routes/location.js` at repo root level — duplicate/orphan |
| Reminders | stable | Client/sales reminders using `reminders` table |
| Maintenance-Reminders | broken-looking | `maintenance_reminders` table missing from schema |
| SalesRep | new | Dedicated frontend page for sales rep view |
| Accountant | new | Dedicated frontend page for accountant |
| Employee Ratings | new | Leaderboard, metrics, sales stats |
| Export | new | CSV/Excel export endpoints |
| Partners | new | Route and service defined; no frontend page in App.js routing |
| Organization | new | Org hierarchy/branches/teams |

---

## 3. Master Endpoint Table

> Auth middleware: `authenticate` = JWT check. `authorize(roles)` = role check on top of authenticate.

| Method | Path | Route File | Auth? | DB Tables Touched |
|---|---|---|---|---|
| POST | /api/auth/register | auth.js | None (public) | users |
| POST | /api/auth/login | auth.js | None (public) | users |
| GET | /api/auth/me | auth.js | authenticate | users |
| PUT | /api/auth/change-password | auth.js | (not defined in read portion — implicit) | users |
| GET | /api/users | users.js | authenticate | users |
| GET | /api/users/:id | users.js | authenticate | users |
| GET | /api/clients/dashboard | clients-pg.js | authenticate (router.use) | clients, invoices, client_liabilities |
| GET | /api/clients/types | clients-pg.js | authenticate (router.use) | clients |
| GET | /api/clients | clients-pg.js | authenticate (router.use) | clients, client_liabilities |
| GET | /api/clients/overdue | clients-pg.js | authenticate (router.use) | clients, invoices |
| GET | /api/clients/notifications | clients-pg.js | authenticate (router.use) | clients, invoices |
| GET | /api/clients/:id | clients-pg.js | authenticate (router.use) | clients, client_liabilities, client_expected_payments, client_payment_history, client_required_docs, documents |
| POST | /api/clients | clients-pg.js | authenticate (router.use) | clients |
| PUT | /api/clients/:id | clients-pg.js | authenticate | clients, approval_requests |
| GET | /api/clients/:id/payment-summary | clients-pg.js | authenticate | invoices, clients |
| POST | /api/clients/:id/record-payment | clients-pg.js | authenticate | client_payment_history, clients, invoices, client_liabilities |
| POST | /api/clients/:id/payments | clients-pg.js | authenticate | client_payment_history, clients, invoices, client_liabilities |
| GET | /api/clients/:id/account | clients-pg.js | authenticate | clients, sales_orders, sales_order_items, invoices, invoice_items, client_payment_history, client_liabilities |
| GET | /api/clients/:id/statement | clients-pg.js | authenticate | clients, client_liabilities, client_payment_history |
| POST | /api/clients/:id/liabilities | clients-pg.js | authenticate | client_liabilities |
| POST | /api/clients/:id/liabilities/:lid/payments | clients-pg.js | authenticate | client_payment_history, clients, client_liabilities |
| DELETE | /api/clients/:id/liabilities/:lid | clients-pg.js | authenticate | client_liabilities |
| POST | /api/clients/:id/expected-payments | clients-pg.js | authenticate | client_expected_payments |
| POST | /api/clients/:id/expected-payments/:pid/mark-received | clients-pg.js | authenticate | client_expected_payments |
| DELETE | /api/clients/:id/expected-payments/:pid | clients-pg.js | authenticate | client_expected_payments |
| PUT | /api/clients/:id/override-block | clients-pg.js | authenticate | clients |
| PUT | /api/clients/:id/credit-settings | clients-pg.js | authenticate | clients |
| GET | /api/clients/:id/orders | clients-pg.js | authenticate | sales_orders |
| GET | /api/clients/:id/invoices | clients-pg.js | authenticate | invoices |
| GET | /api/clients/:id/documents | clients-pg.js | authenticate | documents |
| POST | /api/clients/:id/documents | clients-pg.js | authenticate | documents |
| GET | /api/orders | orders.js | authenticate | sales_orders, clients, sales_order_items |
| POST | /api/orders | orders.js | authenticate | sales_orders, sales_order_items, invoices, clients |
| GET | /api/orders/stats | orders.js | authenticate | sales_orders |
| GET | /api/orders/pending/delivery | orders.js | authenticate | sales_orders |
| GET | /api/orders/:id | orders.js | authenticate | sales_orders, sales_order_items, clients |
| PUT | /api/orders/:id/status | orders.js | authenticate | sales_orders |
| POST | /api/orders/:id/invoice | orders.js | authenticate | invoices, sales_orders |
| GET | /api/orders/:id/invoice/pdf | orders.js | authenticate | invoices, invoice_items |
| DELETE | /api/orders/:id | orders.js | authenticate | sales_orders, sales_order_items |
| GET | /api/sales/my-clients | sales.js | authenticate + authorize | clients, users, sales_orders, invoices |
| GET | /api/sales/unassigned-clients | sales.js | authenticate + authorize(manager) | clients, sales_orders, invoices |
| POST | /api/sales/clients/:id/assign | sales.js | authenticate + authorize(manager) | clients |
| POST | /api/sales/clients/:id/unassign | sales.js | authenticate + authorize(manager) | clients |
| GET | /api/sales/sales-reps | sales.js | authenticate + authorize | users |
| GET | /api/sales/clients/:id/full | sales.js | authenticate | clients, sales_orders, invoices |
| GET | /api/sales/orders | sales.js | authenticate | sales_orders, clients, users |
| POST | /api/sales/orders | sales.js | authenticate | sales_orders, sales_order_items, clients, invoices |
| PUT | /api/sales/orders/:id/approve | sales.js | authenticate + authorize(manager) | sales_orders, invoices |
| PUT | /api/sales/orders/:id/reject | sales.js | authenticate + authorize(manager) | sales_orders |
| GET | /api/sales/orders/:id/items | sales.js | authenticate | sales_order_items, feed_types |
| PUT | /api/sales/orders/:id/status | sales.js | authenticate | sales_orders |
| GET | /api/sales/invoices | sales.js | authenticate | invoices, clients |
| POST | /api/sales/invoices | sales.js | authenticate | invoices, invoice_items |
| POST | /api/sales/payments | sales.js | authenticate | client_payment_history, invoices, clients |
| GET | /api/sales/clients/:id/payments | sales.js | authenticate | client_payment_history |
| GET | /api/sales/reminders | sales.js | authenticate | reminders, clients |
| POST | /api/sales/reminders | sales.js | authenticate | reminders |
| PUT | /api/sales/reminders/:id | sales.js | authenticate | reminders |
| PUT | /api/sales/reminders/:id/complete | sales.js | authenticate | reminders |
| PUT | /api/sales/reminders/:id/send | sales.js | authenticate | reminders |
| DELETE | /api/sales/reminders/:id | sales.js | authenticate | reminders |
| GET | /api/sales/dashboard-stats | sales.js | authenticate | sales_orders, invoices, clients, reminders |
| GET | /api/sales/performance-by-rep | sales.js | authenticate | sales_orders, users |
| GET | /api/sales/red-flags | sales.js | authenticate | clients, invoices, sales_orders |
| GET | /api/sales/client-patterns | sales.js | authenticate | sales_orders, sales_order_items |
| GET | /api/sales/client-patterns/:id | sales.js | authenticate | sales_orders, sales_order_items |
| GET | /api/sales/clients-filtered | sales.js | authenticate | clients, users |
| GET | /api/inventory/raw-materials | inventory-pg.js | authenticate (router.use) | raw_materials |
| GET | /api/inventory/raw-materials/low-stock | inventory-pg.js | authenticate | raw_materials |
| GET | /api/inventory/raw-materials/stats | inventory-pg.js | authenticate | raw_materials |
| GET | /api/inventory/raw-materials/:id | inventory-pg.js | authenticate | raw_materials |
| POST | /api/inventory/raw-materials | inventory-pg.js | authenticate | raw_materials |
| PUT | /api/inventory/raw-materials/:id | inventory-pg.js | authenticate | raw_materials |
| POST | /api/inventory/raw-materials/:id/add-stock | inventory-pg.js | authenticate | raw_materials, inventory_transactions |
| POST | /api/inventory/raw-materials/:id/use | inventory-pg.js | authenticate | raw_materials, inventory_transactions |
| GET | /api/inventory/finished-goods | inventory-pg.js | authenticate | finished_goods, feed_types, production_orders |
| POST | /api/inventory/finished-goods | inventory-pg.js | authenticate | finished_goods |
| POST | /api/inventory/finished-goods/:id/reserve | inventory-pg.js | authenticate | finished_goods |
| POST | /api/inventory/finished-goods/:id/deliver | inventory-pg.js | authenticate | finished_goods |
| GET | /api/inventory/finished-goods/stats | inventory-pg.js | authenticate | finished_goods |
| GET | /api/inventory/production | inventory-pg.js | authenticate | production_orders, feed_types |
| POST | /api/inventory/production | inventory-pg.js | authenticate | production_orders |
| GET | /api/inventory/production/stats | inventory-pg.js | authenticate | production_orders |
| GET | /api/inventory/production/:id | inventory-pg.js | authenticate | production_orders |
| PUT | /api/inventory/production/:id/start | inventory-pg.js | authenticate | production_orders |
| PUT | /api/inventory/production/:id/complete | inventory-pg.js | authenticate | production_orders, inventory_transactions, finished_goods |
| PUT | /api/inventory/production/:id/cancel | inventory-pg.js | authenticate | production_orders |
| GET | /api/production/production-orders | production-pg.js | authenticate | production_orders, feed_types |
| POST | /api/production/production-orders | production-pg.js | authenticate | production_orders |
| GET | /api/production/production-orders/stats | production-pg.js | authenticate | production_orders |
| GET | /api/production/production-orders/:id | production-pg.js | authenticate | production_orders, production_order_items, raw_materials |
| PUT | /api/production/production-orders/:id/approve | production-pg.js | authenticate + authorize | production_orders |
| PUT | /api/production/production-orders/:id/start | production-pg.js | authenticate | production_orders, raw_materials |
| PUT | /api/production/production-orders/:id/complete | production-pg.js | authenticate | production_orders, inventory_transactions, finished_goods |
| PUT | /api/production/production-orders/:id/cancel | production-pg.js | authenticate | production_orders |
| GET | /api/feed-types | feed-types.js | authenticate | feed_types, feed_pricing |
| GET | /api/feed-types/stats | feed-types.js | authenticate | feed_types |
| GET | /api/feed-types/:id | feed-types.js | authenticate | feed_types, feed_pricing |
| POST | /api/feed-types | feed-types.js | authenticate | feed_types |
| PUT | /api/feed-types/:id | feed-types.js | authenticate | feed_types |
| DELETE | /api/feed-types/:id | feed-types.js | authenticate | feed_types |
| GET | /api/feed-recipes | feed-recipes-pg.js | authenticate | feed_recipes, feed_recipe_items, raw_materials, feed_types |
| POST | /api/feed-recipes | feed-recipes-pg.js | authenticate | feed_recipes, feed_recipe_items |
| PUT | /api/feed-recipes/:id | feed-recipes-pg.js | authenticate | feed_recipes, feed_recipe_items |
| DELETE | /api/feed-recipes/:id | feed-recipes-pg.js | authenticate | feed_recipes, feed_recipe_items |
| GET | /api/finance/dashboard | finance.js | authenticate | accounts, journal_entry_lines, journal_entries, invoices, client_payment_history, sales_orders, expenses, supplier_payables |
| GET | /api/finance/invoices | finance.js | authenticate | invoices, clients |
| POST | /api/finance/invoices | finance.js | authenticate | invoices, invoice_items |
| PUT | /api/finance/invoices/:id | finance.js | authenticate | invoices |
| GET | /api/finance/invoices/:id | finance.js | authenticate | invoices, invoice_items |
| PUT | /api/finance/invoices/:id/pay | finance.js | authenticate | invoices, client_payment_history, clients |
| GET | /api/finance/payments | finance.js | authenticate | client_payment_history, clients |
| POST | /api/finance/payments | finance.js | authenticate | client_payment_history, clients, invoices |
| GET | /api/finance/payments/stats | finance.js | authenticate | client_payment_history |
| GET | /api/finance/expenses | finance.js | authenticate | expenses |
| POST | /api/finance/expenses | finance.js | authenticate | expenses |
| PUT | /api/finance/expenses/:id | finance.js | authenticate | expenses |
| PUT | /api/finance/expenses/:id/approve | finance.js | authenticate | expenses |
| PUT | /api/finance/expenses/:id/reject | finance.js | authenticate | expenses |
| GET | /api/finance/accounts | finance.js | authenticate | accounts |
| POST | /api/finance/accounts | finance.js | authenticate | accounts |
| GET | /api/finance/receivables | finance.js | authenticate | invoices, clients |
| GET | /api/finance/clients/:id/account | finance.js | authenticate | invoices, client_payment_history |
| POST | /api/finance/clients/:id/send-reminder | finance.js | authenticate | clients, invoices |
| GET | /api/finance/journal-entries | finance-journal.js | authenticate | journal_entries, journal_entry_lines, accounts |
| POST | /api/finance/journal-entries | finance-journal.js | authenticate | journal_entries, journal_entry_lines, accounts |
| DELETE | /api/finance/journal-entries/:id | finance-journal.js | authenticate | journal_entries, journal_entry_lines |
| GET | /api/hr/employees | hr.js | authenticate | employees |
| GET | /api/hr/employees/:id | hr.js | authenticate | users (not employees!) |
| POST | /api/hr/employees | hr.js | authenticate | users (inserts into users not employees!) |
| PUT | /api/hr/employees/:id | hr.js | authenticate | users |
| POST | /api/hr/employees/:id/documents/upload | hr.js | authenticate | users (documents stored as JSON in users.documents column) |
| POST | /api/hr/employees/:id/documents | hr.js | authenticate | users |
| GET | /api/hr/employees/:id/documents | hr.js | authenticate | users |
| GET | /api/hr/employees/:id/documents/:did/download | hr.js | authenticate | users |
| DELETE | /api/hr/employees/:id/documents/:did | hr.js | authenticate | users |
| PUT | /api/hr/employees/:id/documents/:did/verify | hr.js | authenticate | users |
| GET | /api/hr/attendance | hr.js | authenticate | attendance_records |
| GET | /api/hr/leaves | hr.js | authenticate | leave_requests |
| GET | /api/hr/payroll | hr.js | authenticate | payroll_records |
| GET | /api/hr/performance | hr.js | authenticate | (returns empty array) |
| POST | /api/hr/attendance/check-in | hr.js | authenticate | attendance_records |
| POST | /api/hr/attendance/checkout | hr.js | authenticate | attendance_records |
| GET | /api/employees | employees.js | authenticate | employees, users |
| GET | /api/employees/:id | employees.js | authenticate | employees, users |
| POST | /api/employees | employees.js | authenticate | employees |
| PUT | /api/employees/:id | employees.js | authenticate | employees |
| DELETE | /api/employees/:id | employees.js | authenticate | employees |
| GET | /api/payroll | payroll.js | authenticate | payroll_periods, payroll_records |
| GET | /api/payroll/:id | payroll.js | authenticate | payroll_periods, payroll_records, employees |
| POST | /api/payroll | payroll.js | authenticate | payroll_periods, payroll_records, employees |
| PUT | /api/payroll/:id | payroll.js | authenticate | payroll_periods, payroll_records |
| DELETE | /api/payroll/:id | payroll.js | authenticate | payroll_periods, payroll_records |
| PUT | /api/payroll/:id/process | payroll.js | authenticate | payroll_periods, payroll_records, employees |
| PUT | /api/payroll/:id/approve | payroll.js | authenticate | payroll_periods |
| PUT | /api/payroll/:id/post | payroll.js | authenticate | payroll_periods, expenses, supplier_payables |
| GET | /api/payroll/:id/summary | payroll.js | authenticate | payroll_periods, payroll_records |
| PUT | /api/payroll/:id/mark-as-paid | payroll.js | authenticate | payroll_periods |
| PUT | /api/payroll/:id/approve-all | payroll.js | authenticate | payroll_periods, payroll_records, employees, expenses, supplier_payables |
| GET | /api/suppliers | suppliers.js | authenticate | suppliers |
| POST | /api/suppliers | suppliers.js | authenticate | suppliers |
| GET | /api/suppliers/stats | suppliers.js | authenticate | suppliers, purchase_orders |
| GET | /api/suppliers/:id | suppliers.js | authenticate | suppliers |
| PUT | /api/suppliers/:id | suppliers.js | authenticate | suppliers |
| DELETE | /api/suppliers/:id | suppliers.js | authenticate | suppliers |
| PUT | /api/suppliers/:id/performance | suppliers.js | authenticate | suppliers |
| POST | /api/suppliers/:id/materials | suppliers.js | authenticate | supplier_materials (NOT in schema) |
| GET | /api/purchase-orders | purchase-orders.js | authenticate | purchase_orders, suppliers, purchase_order_items, goods_receipt_notes |
| POST | /api/purchase-orders | purchase-orders.js | authenticate | purchase_orders, purchase_order_items, notifications |
| GET | /api/purchase-orders/stats | purchase-orders.js | authenticate | purchase_orders |
| GET | /api/purchase-orders/:id | purchase-orders.js | authenticate | purchase_orders, purchase_order_items, raw_materials, suppliers |
| PUT | /api/purchase-orders/:id | purchase-orders.js | authenticate | purchase_orders, purchase_order_items |
| PUT | /api/purchase-orders/:id/approve | purchase-orders.js | authenticate + authorize | purchase_orders, notifications |
| PUT | /api/purchase-orders/:id/reject | purchase-orders.js | authenticate + authorize | purchase_orders |
| PUT | /api/purchase-orders/:id/status | purchase-orders.js | authenticate | purchase_orders |
| DELETE | /api/purchase-orders/:id | purchase-orders.js | authenticate | purchase_orders, purchase_order_items |
| GET | /api/grn | grn.js | authenticate | goods_receipt_notes, suppliers, purchase_orders |
| GET | /api/grn/eligible-pos | grn.js | authenticate | purchase_orders, suppliers, purchase_order_items |
| GET | /api/grn/:id | grn.js | authenticate | goods_receipt_notes, grn_items, raw_materials, suppliers, purchase_orders |
| POST | /api/grn | grn.js | authenticate | goods_receipt_notes, grn_items, raw_materials, inventory_transactions |
| PUT | /api/grn/:id/inspect | grn.js | authenticate | goods_receipt_notes, grn_items |
| PUT | /api/grn/:id/approve | grn.js | authenticate | goods_receipt_notes, supplier_payables |
| GET | /api/grn/stats/overview | grn.js | authenticate | goods_receipt_notes |
| GET | /api/payables | payables.js | authenticate | supplier_payables, suppliers |
| GET | /api/payables/stats | payables.js | authenticate | supplier_payables |
| GET | /api/payables/:id | payables.js | authenticate | supplier_payables, suppliers, supplier_payments |
| POST | /api/payables | payables.js | authenticate | supplier_payables |
| PUT | /api/payables/:id | payables.js | authenticate | supplier_payables |
| PUT | /api/payables/:id/pay | payables.js | authenticate | supplier_payables, supplier_payments |
| GET | /api/expenses | expenses.js | authenticate | expenses |
| POST | /api/expenses | expenses.js | authenticate | expenses |
| PUT | /api/expenses/:id | expenses.js | authenticate | expenses |
| PUT | /api/expenses/:id/approve | expenses.js | authenticate + authorize | expenses |
| PUT | /api/expenses/:id/reject | expenses.js | authenticate | expenses |
| GET | /api/assets/machines | assets.js | authenticate | machines |
| GET | /api/assets/machines/stats | assets.js | authenticate | machines |
| GET | /api/assets/machines/:id | assets.js | authenticate | machines |
| POST | /api/assets/machines | assets.js | authenticate | machines |
| PUT | /api/assets/machines/:id | assets.js | authenticate | machines |
| GET | /api/assets/maintenance | assets.js | authenticate | maintenance_schedules, machines |
| POST | /api/assets/maintenance | assets.js | authenticate | maintenance_schedules, machines |
| PUT | /api/assets/maintenance/:id/status | assets.js | authenticate | maintenance_schedules, machines |
| PUT | /api/assets/maintenance/:id/start | assets.js | authenticate | maintenance_schedules, machines |
| PUT | /api/assets/maintenance/:id/complete | assets.js | authenticate | maintenance_schedules, machines |
| PUT | /api/assets/maintenance/:id/cancel | assets.js | authenticate | maintenance_schedules |
| GET | /api/assets/maintenance/stats | assets.js | authenticate | maintenance_schedules |
| GET | /api/delivery | delivery.js | authenticate | delivery_assignments, vehicles, users, sales_orders, clients |
| GET | /api/delivery/stats | delivery.js | authenticate | delivery_assignments |
| GET | /api/delivery/pending | delivery.js | authenticate | delivery_assignments, vehicles, users, sales_orders, clients |
| GET | /api/delivery/vehicles | delivery.js | authenticate | vehicles |
| POST | /api/delivery/vehicles | delivery.js | authenticate | vehicles |
| PUT | /api/delivery/vehicles/:id | delivery.js | authenticate | vehicles |
| GET | /api/delivery/vehicles/stats | delivery.js | authenticate | vehicles |
| POST | /api/delivery | delivery.js | authenticate | delivery_assignments |
| GET | /api/delivery/:id | delivery.js | authenticate | delivery_assignments |
| PUT | /api/delivery/:id/assign | delivery.js | authenticate | delivery_assignments |
| PUT | /api/delivery/:id/dispatch | delivery.js | authenticate | delivery_assignments, sales_orders |
| PUT | /api/delivery/:id/in-transit | delivery.js | authenticate | delivery_assignments |
| PUT | /api/delivery/:id/delivered | delivery.js | authenticate | delivery_assignments, sales_orders, invoices |
| PUT | /api/delivery/:id/partial | delivery.js | authenticate | delivery_assignments |
| PUT | /api/delivery/:id/cancel | delivery.js | authenticate | delivery_assignments, sales_orders |
| GET | /api/maintenance-reminders/reminders | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| GET | /api/maintenance-reminders/reminders/due | maintenance-reminders.js | authenticate | maintenance_schedules (correct) |
| POST | /api/maintenance-reminders/reminders | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| PUT | /api/maintenance-reminders/reminders/:id | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| PUT | /api/maintenance-reminders/reminders/:id/start | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| PUT | /api/maintenance-reminders/reminders/:id/complete | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| PUT | /api/maintenance-reminders/reminders/:id/reschedule | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| PUT | /api/maintenance-reminders/reminders/:id/cancel | maintenance-reminders.js | authenticate | maintenance_reminders (MISSING TABLE) |
| GET | /api/notifications | notifications.js | authenticate | notifications |
| GET | /api/notifications/unread-count | notifications.js | authenticate | notifications |
| GET | /api/notifications/module/:module | notifications.js | authenticate | notifications |
| PUT | /api/notifications/:id/read | notifications.js | authenticate | notifications |
| PUT | /api/notifications/read-all | notifications.js | authenticate | notifications |
| DELETE | /api/notifications/:id | notifications.js | authenticate | notifications |
| GET | /api/purchase-requisitions | purchase-requisitions.js | authenticate | purchase_requisitions |
| POST | /api/purchase-requisitions | purchase-requisitions.js | authenticate | purchase_requisitions |
| GET | /api/purchase-requisitions/:id | purchase-requisitions.js | authenticate | purchase_requisitions |
| PUT | /api/purchase-requisitions/:id | purchase-requisitions.js | authenticate | purchase_requisitions |
| PUT | /api/purchase-requisitions/:id/approve | purchase-requisitions.js | authenticate + authorize | purchase_requisitions |
| PUT | /api/purchase-requisitions/:id/reject | purchase-requisitions.js | authenticate | purchase_requisitions |
| DELETE | /api/purchase-requisitions/:id | purchase-requisitions.js | authenticate | purchase_requisitions |
| GET | /api/purchase-requisitions/stats | purchase-requisitions.js | authenticate | purchase_requisitions |
| GET | /api/requisitions | requisitions.js | authenticate | requisitions (MISSING TABLE), requisition_items (MISSING TABLE) |
| GET | /api/requisitions/preview | requisitions.js | authenticate | raw_materials, supplier_materials (MISSING TABLE), suppliers |
| POST | /api/requisitions/generate | requisitions.js | authenticate | requisitions (MISSING), requisition_items (MISSING), raw_materials |
| GET | /api/requisitions/:id | requisitions.js | authenticate | requisitions (MISSING), requisition_items (MISSING) |
| POST | /api/requisitions/:id/send | requisitions.js | authenticate | requisitions (MISSING), requisition_items (MISSING), suppliers |
| PUT | /api/requisitions/:id/status | requisitions.js | authenticate | requisitions (MISSING) |
| POST | /api/requisitions/transfer | requisitions.js | authenticate | purchase_orders, purchase_order_items, requisition_items (MISSING) |
| GET | /api/approvals/settings | approvals.js | authenticate + authorize(owner/admin) | approval_settings |
| PUT | /api/approvals/settings/:module | approvals.js | authenticate + authorize(owner) | approval_settings, user_activity_log |
| POST | /api/approvals/request | approvals.js | authenticate | approval_requests |
| GET | /api/approvals/pending | approvals.js | authenticate + authorize | approval_requests |
| PUT | /api/approvals/:id/approve | approvals.js | authenticate + authorize(owner) | approval_requests |
| PUT | /api/approvals/:id/reject | approvals.js | authenticate + authorize(owner) | approval_requests |
| GET | /api/dashboard | dashboard.js | authenticate | sales_orders, clients, employees, raw_materials, production_orders, purchase_orders, goods_receipt_notes, supplier_payables, invoices, expenses, journal_entries |
| GET | /api/legal/documents | legal.js | authenticate | legal_documents (created via ensureTable on startup) |
| POST | /api/legal/documents | legal.js | authenticate | legal_documents |
| PUT | /api/legal/documents/:id | legal.js | authenticate | legal_documents |
| PUT | /api/legal/documents/:id/verify | legal.js | authenticate | legal_documents |
| PUT | /api/legal/documents/:id/reject | legal.js | authenticate | legal_documents |
| DELETE | /api/legal/documents/:id | legal.js | authenticate | legal_documents |
| GET | /api/documents/:type/:id | documents.js | authenticate | documents |
| POST | /api/documents/upload/:type/:id | documents.js | authenticate | documents |
| GET | /api/documents/download/:id | documents.js | authenticate | documents |
| DELETE | /api/documents/:id | documents.js | authenticate | documents |
| GET | /api/employee-ratings/employees/:id/ratings | employee-ratings.js | authenticate | employee_ratings |
| POST | /api/employee-ratings/employees/:id/ratings | employee-ratings.js | authenticate | employee_ratings |
| PUT | /api/employee-ratings/employees/:id/ratings/:rid | employee-ratings.js | authenticate | employee_ratings |
| DELETE | /api/employee-ratings/employees/:id/ratings/:rid | employee-ratings.js | authenticate | employee_ratings |
| GET | /api/employee-ratings/employees/:id/ratings/current | employee-ratings.js | authenticate | employee_ratings |
| GET | /api/employee-ratings/employees/ratings/leaderboard | employee-ratings.js | authenticate | employee_ratings, employees |
| GET | /api/employee-ratings/employees/ratings/sales-stats | employee-ratings.js | authenticate | employee_ratings, sales_orders |
| POST | /api/employee-ratings/employees/ratings/calculate-sales | employee-ratings.js | authenticate | sales_orders |
| PUT | /api/employee-ratings/employees/ratings/update-ranks | employee-ratings.js | authenticate | employee_ratings |

---

## 4. Frontend–Backend Wiring

### 4a. Frontend Component API Calls

| Page/Component | API Calls Made | Base URL Pattern |
|---|---|---|
| Login.js | POST /api/auth/login | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Dashboard.js | GET /api/dashboard | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Clients.js | GET/POST/PUT/DELETE /api/clients, /api/clients/:id/*, /api/sales/*, notifications | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Orders.js | GET/POST/PUT/DELETE /api/orders/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Sales.js | GET/POST/PUT/DELETE /api/sales/*, /api/orders/*, /api/clients/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| SalesRep.js | GET/POST/PUT /api/sales/*, /api/clients/*, /api/orders/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Inventory.js | GET/POST/PUT /api/inventory/*, /api/feed-types | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| FeedRecipes.js | GET/POST/PUT/DELETE /api/feed-recipes, /api/feed-types, /api/inventory/raw-materials | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Production.js | GET/POST/PUT /api/production/*, /api/feed-types, /api/inventory/raw-materials | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Finance.js | GET/POST/PUT /api/finance/*, /api/clients/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| HR.js | GET/POST/PUT /api/hr/*, /api/employees/*, /api/payroll/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Payroll.js | GET/POST/PUT/DELETE /api/payroll/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Suppliers.js | GET/POST/PUT/DELETE /api/suppliers/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| PurchaseOrders.js | GET/POST/PUT/DELETE /api/purchase-orders/*, /api/suppliers, /api/inventory/raw-materials | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| GRN.js | GET/POST/PUT /api/grn/*, /api/suppliers | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Delivery.js | GET/POST/PUT /api/delivery/*, /api/orders/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Assets.js | GET/POST/PUT /api/assets/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| MaintenanceReminders.js | GET/POST/PUT /api/maintenance-reminders/reminders* | `process.env.REACT_APP_API_URL \|\| '/api'` (different fallback from other pages) |
| Payables.js | GET/POST/PUT /api/payables/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Expenses.js | GET/POST/PUT/DELETE /api/expenses/* | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Legal.js | GET/POST/PUT/DELETE /api/legal/documents | `process.env.REACT_APP_API_URL \|\| '/api'` |
| Accountant.js | GET/POST /api/finance/*, /api/expenses | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| Settings.js | GET/POST/PUT /api/users/*, /api/auth/change-password, /api/approvals/settings | `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` |
| AutoPO.js (component) | GET /api/inventory/raw-materials, /api/suppliers, /api/purchase-requisitions, /api/purchase-orders, /api/notifications | `process.env.REACT_APP_API_URL \|\| '/api'` (with demo fallback) |
| AutoPODashboardWidget.js | GET /api/inventory/raw-materials/low-stock, /api/purchase-requisitions | `process.env.REACT_APP_API_URL \|\| '/api'` (with demo fallback) |

### 4b. Orphaned Backend Endpoints (no clear frontend caller)

- `GET /api/location/*` — `backend/src/routes/location.js` (also exists at repo root `backend/src/routes/location.js` vs inner path); not imported in any frontend page/service
- `GET/POST /api/whatsapp/*` — `whatsapp.js` route registered; no frontend page routes to it (service exists in `api.js` but no page imports it)
- `GET/POST /api/organization/*` — `organization.js` route registered; no frontend page
- `GET/POST /api/partners/*` — `partners.js` route registered; `api.js` has `partnersService` but no frontend page in App.js routing
- `GET /api/activity/*` — `activity.js` route registered; not called from any frontend page
- `GET /api/reminders/*` — `reminders.js` (non-sales reminders) — frontend has `ReminderModal.js` but it uses `/api/sales/reminders`
- `GET /api/export/*` — `export.js` route registered; no dedicated frontend page
- `GET /api/purchase-orders/:id/pdf`, `/send-whatsapp` — registered in backend; no frontend calls found
- `GET /api/clients/stats` — registered in backend (api.js clientsService.getStats); not consumed by any page directly

### 4c. Broken Frontend Calls

- `MaintenanceReminders.js` line 51: calls `GET /api/maintenance-reminders/reminders` — backend route exists, but the `maintenance_reminders` DB table does NOT exist in any schema file; this will return 500 errors at runtime
- `Sales.js` and `SalesRep.js`: call `GET /api/sales/red-flags` — endpoint should exist in sales.js; needs verification
- `HR.js` line 1482 and 3801: calls `POST /api/payroll/:id/bulk-update` and `PUT /api/payroll/:id/employees/:epid` and `PUT /api/payroll/:id/recalculate` — these sub-routes are **not defined** in `payroll.js`; they will return 404
- `services/api.js` calls `GET /api/hr/payroll` — this route is defined in hr.js but due to the multiple `module.exports` bug, whether it survives to be registered depends on its position; it does register in the current code at line 258 but all routes after the first `module.exports` at line 29 rely on Node.js module caching behavior (since `require()` caches on first load, the router object accumulates all routes via reference — but this is fragile and undefined behavior)
- `api.js` `requisitionService` calls `/api/requisitions/*` endpoints — those will fail at runtime because `requisitions` and `requisition_items` tables don't exist

---

## 5. Legacy Regression Findings

| Finding | File:Line | Detail |
|---|---|---|
| `mongoose` import | None found | No occurrences in any JS file under `feed factory crm/` |
| `mongoose.connect` | None found | — |
| `mongodb://` | None found | — |
| `readFileSync` in backend routes | None found | No flat-file data reads in route files |
| `/api/v2/` in frontend | None found | Comment in `postgresApi.js` line 2 merely notes "no /api/v2/" |
| `hardcoded localhost:5000` in frontend | FOUND | 14 occurrences — all follow the pattern `process.env.REACT_APP_API_URL \|\| 'http://localhost:5000/api'` — see list below |
| `pg` in devDependencies | `backend/package.json` line 33 | Critical: `"pg": "^8.20.0"` is under `devDependencies`, not `dependencies` |

**All `localhost:5000` occurrences (all are guarded by `process.env.REACT_APP_API_URL ||`):**

| File | Line |
|---|---|
| `frontend/src/services/api.js` | 1 |
| `frontend/src/services/postgresApi.js` | 4 |
| `frontend/src/pages/FeedRecipes.js` | 10 |
| `frontend/src/pages/Accountant.js` | 11 |
| `frontend/src/pages/Dashboard.js` | 15 |
| `frontend/src/pages/Sales.js` | 41 |
| `frontend/src/pages/Expenses.js` | 5 |
| `frontend/src/pages/Clients.js` | 16 |
| `frontend/src/pages/PurchaseOrders.js` | 5 |
| `frontend/src/pages/Production.js` | 11 |
| `frontend/src/pages/Payroll.js` | 1479 |
| `frontend/src/pages/Inventory.js` | 13 |
| `frontend/src/pages/Payables.js` | 5 |
| `frontend/src/pages/HR.js` | 1482, 3801, 3809 |
| `frontend/src/utils/location.js` | 2 |
| `frontend/src/setupProxy.js` | 7 (dev proxy — expected) |

Note: `frontend/.env.local` also hardcodes `REACT_APP_API_URL=http://localhost:5000/api` (line 1). This env file will not be committed to production — risk is low if properly overridden at deploy time but the `.env.local` should not be committed to source control.

---

## 6. Schema-to-Code Mismatches

### 6a. Tables Used in Code That Have NO `CREATE TABLE` in Any Schema SQL File

| Table Name | Used In | Notes |
|---|---|---|
| `employees` | `employees.js`, `hr.js`, `payroll.js`, `dashboard.js`, `export.js` | No CREATE TABLE found in any .sql file. Separate from `users` table. |
| `maintenance_reminders` | `maintenance-reminders.js` (all CRUD) | Only `maintenance_schedules` is defined in `phase1_foundation.sql`. Different table name. |
| `requisitions` | `requisitions.js` | Separate from `purchase_requisitions` (which IS defined). |
| `requisition_items` | `requisitions.js` | Related to the missing `requisitions` table. |
| `supplier_materials` | `requisitions.js` line 33, `suppliers.js` (POST /:id/materials) | Junction table between suppliers and raw_materials. |
| `journal_entries` | `finance.js`, `finance-journal.js`, `utils/journal.js`, `dashboard.js`, `export.js` | No CREATE TABLE in any SQL file. Critical for finance module. |
| `journal_entry_lines` | `finance.js`, `finance-journal.js` | Related to missing `journal_entries` table. |
| `accounts` | `finance.js`, `finance-journal.js` | Chart of accounts. No CREATE TABLE in SQL files. |
| `payroll_periods` | `payroll.js` | The schema only defines `payroll_records`. `payroll_periods` is a separate new table. |
| `client_required_docs` | `clients-pg.js` line 832 | Used for document compliance check. No schema definition. |
| `documents` | `documents.js`, `clients-pg.js` | Generic documents table. No schema definition. |
| `employee_ratings` | `employee-ratings.js` | No schema definition. |
| `legal_documents` | `legal.js` | Created inline via `CREATE TABLE IF NOT EXISTS` in the route file (line 9). |

### 6b. Column Mismatches

| File | Line | Table | Column Used in Code | In Schema? | Notes |
|---|---|---|---|---|---|
| `notifications.js` | 13, 31, 50, 83 | `notifications` | `role` | No | `notifications` schema only has `user_id`, `type`, `title`, `message`, `is_read`, `link`, `created_at`. No `role` column. |
| `purchase-orders.js` | 140, 220 | `purchase_order_items` | `unit_price`, `total_price` | No | Schema (`phase1_foundation.sql`) only defines `quantity`, `unit_cost`, `total_cost` for `purchase_order_items`. `unit_price` and `total_price` are extra. |
| `grn.js` | 10-18 | `purchase_order_items`, `goods_receipt_notes`, `grn_items` | `received_quantity`, `total_amount`, `quantity_accepted`, `quantity_rejected`, `rejection_reason` | No (added inline) | Route does `ALTER TABLE ADD COLUMN IF NOT EXISTS` at startup to add these columns. Runtime migration pattern. |
| `clients-pg.js` | 88-96 | `clients` | `contact_person`, `discount`, `avg_consumption`, `favorite_feed_type_id`, `license_number`, `notes`, `storage_location` | No | `schema.sql` and `complete_schema_with_sales.sql` `clients` table does not define these columns. They were added later. |
| `clients-pg.js` | 94 | `clients` | `credit_limit` | Yes in `complete_schema_with_sales.sql` | OK |
| `hr.js` | 90-98 | `users` | `designation`, `salary`, `joinDate`, `bankName`, `bankAccount`, `iban`, `emergencyContact`, `documents` | No | `users` table does not have these columns in any schema file. HR module uses `users` as employee store with extra fields. |
| `sales.js` | 37 | `clients` | `assigned_to` | Yes — in `complete_schema_with_sales.sql` | OK |
| `payroll.js` | 160 | `employees` | `name`, `basic_salary`, `department` | N/A | `employees` table has no schema — cannot verify |
| `maintenance-reminders.js` | 16, 73, 93 | `maintenance_reminders` | `machine_id`, `type`, `description`, `due_date`, `status`, `notes` | N/A | Table itself is missing from schema |

---

## 7. Simulated / Fake Data Findings

| File | Line | Description |
|---|---|---|
| `frontend/src/components/AutoPO.js` | 20–48 | Five hardcoded demo arrays: `demoRawMaterials` (6 items with English names, Tanzanian phone numbers), `demoSuppliers` (3 items), `demoPurchaseRequisitions` (2 items), `demoPurchaseOrders` (1 item), `demoNotifications` (4 items). Used as **active fallback** when API call fails or returns empty. |
| `frontend/src/components/AutoPO.js` | 887–925 | Every API call on component mount falls back to demo data on any error (`catch` block sets demo arrays). Empty real API results also trigger demo fallback on line 887: `materials.length > 0 ? materials : demoRawMaterials`. |
| `frontend/src/components/AutoPODashboardWidget.js` | 16–23 | Two hardcoded demo arrays: `demoLowStockMaterials` (2 items), `demoPendingPRs` (2 items). Same fallback pattern as AutoPO.js. |
| `frontend/src/components/AutoPODashboardWidget.js` | 208–224 | Active fallback: API error falls back to `demoLowStockMaterials` / `demoPendingPRs`. Empty API result also falls back. |
| `frontend/src/pages/Orders.js` | 501 | `Math.random()` used to generate a random 5-digit number for order reference display (cosmetic, not a data source). |
| `frontend/src/pages/Production.js` (production-pg.js) | line 14 | `Math.random().toString(36).substring(2, 5)` used in `generateOrderNumber()` function on the backend — non-deterministic order number suffix. |
| `frontend/src/pages/Settings.js` | 193 | `Math.random()` used in password generator utility — acceptable use. |
| `frontend/src/pages/Delivery.js` | 154 | Comment: `// Fallback: use hardcoded demo location` — a hardcoded GPS coordinate is used as fallback when location fetch fails. |

---

## 8. Auth Coverage Gaps

| Route File | Path | Issue |
|---|---|---|
| `users.js` | GET /api/users, GET /api/users/:id | Authenticated but **no role authorization** — any valid JWT can list all users and their roles/departments |
| `users.js` | (all routes) | No CREATE/UPDATE/DELETE user endpoint defined — user management relies on auth.js register endpoint which has no role restriction |
| `auth.js` | POST /api/auth/register | Public endpoint with no role restriction — anyone can self-register with any role including `owner`. This is a critical security gap. |
| `notifications.js` | PUT /api/notifications/read-all | Marks all notifications read for `user_id = $1` but also affects `role` broadcast notifications for that user's role — could be abused |
| `hr.js` | All routes | No authorization beyond `authenticate` — any authenticated user can add/delete employee documents, modify attendance, etc. |
| `employees.js` | DELETE /api/employees/:id | No authorization check — any authenticated user can delete any employee |
| `legal.js` | PUT /api/legal/documents/:id/verify | No role restriction — any authenticated user can verify legal documents |
| `clients-pg.js` | PUT /api/clients/:id | Routes apply `authenticate` but credit limit change goes through approval flow only if `req.user?.role !== 'owner'` and `req.user?.role !== 'admin'` — this relies on `req.user` being set, which it is via `router.use(authenticate)`, but the logic is fragile |
| `production-pg.js` | PUT /api/production/production-orders/:id/approve | Uses `authorize` but the exact roles are unverified in this read |

---

## 9. New Features Inventory

The original 12-module set was: Procurement, Inventory, Production, Sales, Finance, HR, Delivery, Assets, Notifications, Purchase Requisitions, + 2 others (likely Orders and Clients).

### New Features Not in Original 12

**1. Approval System**
- Endpoints: `GET/PUT /api/approvals/settings/*`, `POST /api/approvals/request`, `GET /api/approvals/pending`, `PUT /api/approvals/:id/approve|reject`
- Frontend: `Settings.js` (approval settings tab), `clients-pg.js` inlines approval on credit limit changes
- Completeness: Partial — approval flow is triggered for credit limit changes and sales orders; not uniformly wired to all modules listed in `approval_settings` seed data (payroll, expenses, production, inventory_adjustments)
- Code smells: Approval settings use `module_name` strings that must match exactly — no type-safe enum; `approval_requests` lacks a `metadata` column in its schema but `clients-pg.js` line 601 inserts into it

**2. Legal / Documents Module**
- Endpoints: All under `/api/legal/documents`
- Frontend: `Legal.js`
- Completeness: Partial — table created at runtime via `ensureTable()` in route file (not in schema SQL), no expiry alerts or workflow
- Code smells: Table creation in route startup instead of migrations; `requiredDocuments` array in `Legal.js` lines 22–30 is frontend-only hardcoded data not from API

**3. Sales Rep Role / SalesRep Page**
- Endpoints: `/api/sales/my-clients`, `/api/sales/clients/:id/assign|unassign`, `/api/sales/dashboard-stats`, `/api/sales/performance-by-rep`, `/api/sales/red-flags`, `/api/sales/client-patterns`
- Frontend: `SalesRep.js`, Sales.js (expanded)
- Completeness: Fully wired
- Code smells: `salesService` in `api.js` is a very large service (200 lines); overlaps significantly with `ordersService` — two different API patterns for sales orders exist (`/api/orders` and `/api/sales/orders`)

**4. Payroll Module (Extended)**
- Endpoints: All `/api/payroll/*` with period/record lifecycle, approve-all, post to finance
- Frontend: `Payroll.js` (HR.js also has payroll tabs)
- Completeness: Mostly complete but `HR.js` calls `/api/payroll/:id/bulk-update`, `/api/payroll/:id/employees/:id`, and `/api/payroll/:id/recalculate` which do NOT exist in `payroll.js` — these will 404
- Code smells: Payroll logic duplicated across `hr.js` (GET /hr/payroll → payroll_records) and `payroll.js` (GET /payroll → payroll_periods); inconsistent data models

**5. AutoPO (Automatic Purchase Orders)**
- Endpoints: Uses existing `/api/inventory/raw-materials`, `/api/suppliers`, `/api/purchase-requisitions`, `/api/purchase-orders`
- Frontend: `AutoPO.js` component, `AutoPODashboardWidget.js`
- Completeness: Partial — the component makes real API calls but falls back to demo data on any failure; auto-generation logic is frontend-only (no backend auto-PO scheduler)
- Code smells: 5 hardcoded demo arrays with English text/Tanzanian phone numbers that silently replace real data; no `useEffect` cleanup; component is ~1000 lines

**6. Accountant View**
- Endpoints: Uses `/api/finance/*`, `/api/expenses`
- Frontend: `Accountant.js`
- Completeness: Fully wired as a role-based finance view
- Code smells: Separate page duplicates Finance.js display logic

**7. Employee Ratings System**
- Endpoints: All `/api/employee-ratings/*`
- Frontend: None dedicated — referenced from HR module
- Completeness: Backend stub — route exists but no frontend page linked in App.js; `employee_ratings` table has no schema definition
- Code smells: Table completely absent from schema SQL files

**8. Requisitions (AutoPO Low-Stock Flow)**
- Endpoints: All `/api/requisitions/*`
- Frontend: `AutoPO.js` makes calls to this indirectly
- Completeness: Broken — `requisitions`, `requisition_items`, and `supplier_materials` tables all missing from schema
- Code smells: This is a parallel/duplicate system to `purchase-requisitions` with overlapping purpose

**9. WhatsApp Integration**
- Endpoints: All `/api/whatsapp/*`
- Frontend: `api.js` has `whatsappService` but no dedicated page in App.js
- Completeness: Stub — route file exists, no actual WhatsApp API integration evident in static code
- Code smells: Orphaned service in api.js

**10. Partners Module**
- Endpoints: All `/api/partners/*`
- Frontend: `api.js` has `partnersService` but no page in App.js routing
- Completeness: Backend complete; frontend not wired
- Code smells: Orphaned module

**11. Organization Module**
- Endpoints: `/api/organization/hierarchy`, `/branches`, `/teams`
- Frontend: `api.js` has `organizationService` but no page in App.js
- Completeness: Backend stub; frontend not wired

---

## 10. Open Questions

1. **Is the `employees` table actually present in the live database** from a migration not captured in the `/database/*.sql` files? Several scripts in `/backend/scripts/` may have created it at runtime but the SQL is not in source control.

2. **Is `journal_entries`/`accounts` created by a migration script or manually?** These are critical finance tables with no schema SQL. If they were created by `scripts/complete-setup.js` or similar, that script should be reviewed.

3. **What is the final authoritative database state?** Multiple schema files (`schema.sql`, `complete_schema_with_sales.sql`, `phase1_foundation.sql`, `approval_system.sql`, `005_add_cost_price_to_order_items.sql`) define overlapping sets of tables. Without running `pg_dump` on the live DB, it's impossible to know what columns actually exist.

4. **Does the `hr.js` multiple `module.exports` pattern actually break routing?** Node.js's `require()` returns the cached module object by reference on first load. Since `router` is the same object throughout, all route registrations accumulate on the same router even with multiple `module.exports`. However, `server.js` calls `require('./src/routes/hr')` only once and gets back the router as it was at the last `module.exports` assignment — which is still the same router object with all routes. This needs runtime verification, but it is still extremely poor code quality and a maintenance hazard. The intent may work by accident.

5. **Are the `AutoPO.js` demo fallbacks intentionally left in for production** or was this a development artifact that was never cleaned up? The fallback data includes Tanzanian (+255) phone numbers which is inconsistent with the Saudi context of the CRM.

6. **What triggers the `maintenance_reminders` table creation?** The route uses it but no `ensureTable()` or `CREATE TABLE IF NOT EXISTS` exists in the route file (unlike `legal.js`). It will fail on every request until manually created.

7. **`005_add_cost_price_to_order_items.sql`** — this migration file adds `cost_price` to `sales_order_items` but the schema definition in `complete_schema_with_sales.sql` does not include it. Is this migration applied in the correct order and to the right table?

8. **`backend/src/routes/location.js` at repo root level** — there are two `location.js` files: one at `backend/src/routes/location.js` (inner, registered in server.js) and one at the repo root `backend/src/routes/location.js`. The outer one appears to be a leftover. Which one is actually served?

9. **Security concern: `POST /api/auth/register` is public and allows any role** — can anyone register as `owner`? This requires a policy decision and likely a code change (restrict role to `sales_rep` on self-registration, require owner approval for privileged roles).

10. **`payroll.js` references `employees` table for salary lookup** (line 160: `FROM employees e WHERE e.status = 'active'`) but the `employees` table itself has no schema definition. If the table exists with different columns than expected, the payroll processing will silently produce wrong results.
