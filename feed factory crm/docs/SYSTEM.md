# Feed Factory CRM — Al Kheir

## System Overview

A complete CRM + ERP system for a feed factory managing sales, production, inventory, purchasing, finance, HR, and accounting. Built with Node.js/Express backend, React frontend, PostgreSQL database.

## Quick Start

**Login**: `owner@al-kheir.com` / `password123`
**Backend**: `http://localhost:5000`
**Frontend**: `http://localhost:3000`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router, Lucide icons |
| **Backend** | Node.js, Express, JWT auth |
| **Database** | PostgreSQL 18 (user-local, TCP 5432, trust auth) |
| **File uploads** | Multer → `uploads/` directory |

## Database

- **42 tables** across all modules
- All monetary amounts stored in **piasters** (display /100 → EGP)
- Recipes & raw material prices stored in **piasters** (display raw values)
- **Login**: `owner@al-kheir.com` / `password123`

## Module Map

```
Sales → Production → Inventory → Purchase → GRN → Payables → Finance → Accounting
  ↑                                                              ↓
  └─────────────────────── Activity Log ─────────────────────────┘
```

---

## 1. AUTH MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login → JWT token |
| `/api/auth/me` | GET | Current user info |

**Roles**: owner, admin, sales_manager, sales_rep, purchase_officer, production_manager, finance_manager, hr_manager, warehouse_manager
**Owner/Admin bypass**: All role checks auto-approve owner and admin.

---

## 2. DASHBOARD

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/dashboard` | GET | 33 KPIs + recent data |
| `/api/dashboard/charts` | GET | Revenue by month, expenses by category, production by type, sales by month, top clients, aging dist, inventory by category |

**Key KPIs**: Total clients, suppliers, materials, orders, revenue, pending orders, low stock, active production, overdue invoices, payables, receivables, employees, POs, GRNs, finished goods, expenses, maintenance

---

## 3. SALES MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sales/orders` | GET | List orders (filters: status, client, date) |
| `/api/sales/orders` | POST | Create order (requires client docs) |
| `/api/sales/orders/:id/approve` | PUT | Approve → auto-creates invoice + journal entry + production order |
| `/api/sales/orders/:id/reject` | PUT | Reject with reason |
| `/api/sales/orders/:id/status` | PUT | Update status |
| `/api/sales/invoices` | GET | List invoices |
| `/api/sales/invoices` | POST | Create invoice from order |
| `/api/clients` | GET | List clients with categories |
| `/api/clients/:id` | GET | Client detail + document status |

**Order flow**: Create → Approve → Auto-invoice → Auto-journal → Auto-production order
**Document requirement**: Clients need 5 documents (commercial_registration, tax_card, national_id, contract, license) before ordering
**Pricing**: Per-ton selling price = recipe cost/ton × 1.15 (15% margin)

---

## 4. PURCHASE MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/purchase-orders` | GET | List POs with GRN status |
| `/api/purchase-orders` | POST | Create PO |
| `/api/purchase-orders/:id` | GET | PO detail with items |
| `/api/purchase-orders/:id/approve` | PUT | Approve PO |
| `/api/suppliers` | GET | List suppliers |
| `/api/suppliers` | POST | Create supplier (auto-code `SUP-XXX`) |
| `/api/suppliers/:id/materials` | GET | Materials this supplier provides |

**Low-stock suggestions**: `/api/inventory/raw-materials/low-stock` — materials below reorder level with preferred supplier

---

## 5. GOODS RECEIPT NOTES (GRN)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/grn/eligible-pos` | GET | Approved POs with unreceived items |
| `/api/grn` | GET | List GRNs (with totals) |
| `/api/grn` | POST | Create GRN from PO |
| `/api/grn/:id` | GET | GRN detail with items |
| `/api/grn/:id/inspect` | PUT | Record accepted/rejected quantities |
| `/api/grn/:id/approve` | PUT | Approve → updates stock + creates payable + journal entry |

**Flow**: PO → Create GRN → Inspect (add rejection+reason) → Approve → Stock updated + Payable created + Journal entry

---

## 6. PRODUCTION MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/production/production-orders` | GET | List production orders |
| `/api/production/production-orders` | POST | Create production order |
| `/api/production/production-orders/:id/approve` | PUT | Approve |
| `/api/production/production-orders/:id/start` | PUT | Start (deducts raw materials) |
| `/api/production/production-orders/:id/complete` | PUT | Complete (adds finished goods, deducts bags) |
| `/api/production/create-from-suggestion` | POST | Create from low-stock suggestion |
| `/api/production/stats` | GET | Production statistics |
| `/api/production/finished-goods` | GET | Finished goods inventory |
| `/api/production/low-stock-suggestions` | GET | Feed types needing production |

**Auto-creation**: When sales order approved → production order created for each feed type
**Bag deduction**: On completion, deducts packaging bags (شكاير RM025) from raw materials

---

## 7. INVENTORY MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory/raw-materials` | GET | 25 raw materials with stock |
| `/api/inventory/raw-materials/low-stock` | GET | Materials below reorder level + preferred supplier |
| `/api/inventory/raw-materials/:id` | GET | Single material detail |
| `/api/inventory/dashboard` | GET | Inventory stats (total value, low/critical counts) |
| `/api/inventory/categories` | GET | Material categories |
| `/api/inventory/movements` | GET | Transaction history (filters: material, type, date) |
| `/api/inventory/finished-goods` | GET | Finished goods from inventory route |
| `/api/inventory/transfer` | POST | Record material transfer |

**Raw Materials**: 25 items with `current_stock`, `unit_price` (piasters), `reorder_level`, `min_stock_level`

---

## 8. FINANCE MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/finance/dashboard` | GET | Revenue, AR, AP, Cash, Inventory, Net Position |
| `/api/finance/accounts` | GET | Chart of accounts |
| `/api/finance/account-balances` | GET | Real balances from journal entries |
| `/api/finance/journal-entries` | GET | All journal entries with lines |
| `/api/finance/trial-balance` | GET | Trial balance (Dr/Cr + balanced check) |
| `/api/finance/receivables` | GET | Receivables aging |
| `/api/finance/payments` | POST | Record payment → auto journal entry |

**Accounting**: 10 accounts (Cash, AR, Inventory, AP, Equity, Revenue, COGS, Salaries, Rent, Utilities)
**Journal entries**: 30+ entries across all transaction types — **always balanced**

---

## 9. PAYABLES MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payables` | GET | List with aging buckets |
| `/api/payables` | POST | Create payable |
| `/api/payables/:id/payment` | POST | Record payment → auto journal entry |
| `/api/payables/:id/reminders` | POST | Set reminder → creates WhatsApp notification |
| `/api/payables/reminders` | GET | Get all reminders |
| `/api/payables/aging-report` | GET | Aging report |

**Auto-creation**: 
- GRN approval → Payable created (Dr Inventory / Cr AP)
- Expense approval → Payable created (Dr Expense / Cash)

---

## 10. EXPENSES MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/expenses` | GET | List expenses with filters |
| `/api/expenses` | POST | Create expense → auto journal entry |
| `/api/expenses/:id/approve` | PUT | Approve → creates payable + journal entry |

**Categories**: salaries, utilities, rent, maintenance, transport

---

## 11. HR MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/hr/employees` | GET | List 36 employees with departments |
| `/api/hr/employees/:id` | GET | Employee detail |
| `/api/hr/employees/:id/documents` | POST | Upload employee document |

**Employees**: 36 employees from the organization file across 9 departments

---

## 12. PAYROLL MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payroll` | GET | List payroll periods |
| `/api/payroll` | POST | Create payroll period |
| `/api/payroll/:id/process` | PUT | Process |
| `/api/payroll/:id/approve` | PUT | Approve |
| `/api/payroll/:id/post` | PUT | Post to finance → auto journal entry |
| `/api/payroll/employee/:employeeId` | GET | Employee payroll history |

---

## 13. ASSETS MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/assets/machines` | GET | 5 machines |
| `/api/assets/vehicles` | GET | 3 vehicles |
| `/api/assets/maintenance` | GET | 3 maintenance schedules |

---

## 14. LEGAL MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/legal/documents` | GET | List legal docs |
| `/api/legal/documents` | POST | Create legal doc |
| `/api/legal/documents/:id/verify` | PUT | Verify/reject document |

---

## 15. EXPORT MODULE

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/export/sales` | GET | Sales orders CSV |
| `/api/export/purchases` | GET | Purchase orders CSV |
| `/api/export/inventory` | GET | Inventory CSV |
| `/api/export/payables` | GET | Payables CSV |
| `/api/export/journal` | GET | Journal entries CSV |
| `/api/export/employees` | GET | Employees CSV |

---

## 16. NOTIFICATIONS / ACTIVITY

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/activity` | GET | Activity feed (all modules) |
| `/api/notifications` | GET | User notifications (role-based) |
| `/api/whatsapp/send` | POST | Send WhatsApp message (requires API token) |

---

## Cross-Module Workflows

### Sales Order → Production → Inventory
1. Create SO → Approve → Invoice created → Journal entry (Dr AR / Cr Revenue)
2. Auto-production order created (draft) → Approve → Start → Complete
3. Finished goods added to inventory
4. Packaging bags deducted from RM025 (شكاير)

### Purchase Order → GRN → Payables → Payment
1. Create PO → Approve → Create GRN → Inspect → Approve GRN
2. Stock updated + Payable created + Journal entry (Dr Inventory / Cr AP)
3. Pay payment → Journal entry (Dr AP / Cr Cash)

### Expense → Payable → Journal
1. Create expense → Approve → Payable auto-created + Journal entry (Dr Expense / Cr Cash)

### Pricing Calculation
- **Recipe cost/ton**: `recipe.total_cost / (recipe.total_quantity_kg / 1000)`
- **Selling price/ton**: `cost_per_ton × 1.15` (15% margin)
- **Order subtotal**: `quantityTons × sell_per_ton`
- **Order cost**: `quantityTons × cost_per_ton`

### Accounting Flow
Every business transaction creates a double-entry journal entry:
```
Sale approval:       Dr AR / Cr Revenue
Payment received:    Dr Cash / Cr AR
GRN approved:        Dr Inventory / Cr AP
Supplier payment:    Dr AP / Cr Cash
Production complete: Dr FG Inventory / Cr RM Inventory
Expense created:     Dr Expense / Cr Cash
Payroll posted:      Dr Salaries / Cr Cash
```

---

## Key Business Rules

1. **Client documents required**: 5 docs before any order (Commercial Registration, Tax Card, National ID, Contract, License)
2. **Credit limit**: Orders exceeding 80% of client credit limit are blocked
3. **15% margin**: Selling price = cost × 1.15 (auto-calculated)
4. **Bag deduction**: Production completion deducts packaging bags automatically
5. **Owner/admin bypass**: All role-based permissions auto-approved for owner/admin
6. **Entry numbers**: Auto-generated with regex digit extraction (handles JE-ADJ-001 format)

## Tables Created During Setup

accounts, activity_log, assets, client_expected_payments, client_liabilities, client_payment_history, client_required_docs, clients, delivery_assignments, documents, employee_payrolls, employees, expenses, feed_pricing, feed_recipe_items, feed_recipes, feed_types, finished_goods, goods_receipt_notes, grn_items, inventory_transactions, invoice_items, invoices, journal_entries, journal_entry_lines, leave_requests, legal_documents, machines, maintenance_schedules, notifications, payables_reminders, payroll_periods, payroll_records, production_order_items, production_orders, purchase_order_items, purchase_orders, purchase_requisitions, raw_materials, reminders, requisition_items, requisitions, sales_order_items, sales_orders, supplier_materials, supplier_payables, supplier_payments, suppliers, users, vehicles

## Database Connection

```bash
export LD_LIBRARY_PATH="/home/moo/.local/pgsql/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
/home/moo/.local/pgsql/usr/lib/postgresql/18/bin/psql -h localhost -p 5432 -U postgres -d al_kheir_feed_factory
```
