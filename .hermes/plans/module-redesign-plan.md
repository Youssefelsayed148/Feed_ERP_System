# CRM Module Audit & Redesign Plan

## Phase 1: Database Schema Audit
For each module, verify:
- DB table columns match frontend form fields
- Required fields are enforced
- Foreign key relationships exist
- Indexes for performance

## Phase 2: Module-by-Module Verification

### 1. ASSETS (machines + vehicles)
**DB Tables**: machines, vehicles, maintenance_records, maintenance_schedules
**Frontend**: Assets.js, Maintenance.js, MaintenanceReminders.js
**Checklist**:
- [ ] Machine CRUD (create, read, update, delete)
- [ ] Vehicle CRUD
- [ ] Maintenance scheduling
- [ ] Maintenance history logging
- [ ] Maintenance reminders (due/overdue)
- [ ] Status tracking (operational, maintenance, idle, broken)
- [ ] Machine types translation
- [ ] All fields: name, code, type, location, status, hours, purchase_date, last_maintenance

### 2. LEGAL
**DB Table**: legal_documents
**Frontend**: Legal.js
**Checklist**:
- [ ] Document CRUD
- [ ] Client folders
- [ ] Client onboarding workflow
- [ ] Document verify/reject flow
- [ ] Document status: pending, pending_review, verified, rejected, expired
- [ ] Expiry date tracking
- [ ] Document upload
- [ ] All fields: title, client_id, type, status, expiry_date, notes, document_url

### 3. PAYROLL
**DB Tables**: payroll_periods, payroll_records, payroll_items
**Frontend**: Payroll.js, HR.js (payroll tab)
**Checklist**:
- [ ] Payroll period creation
- [ ] Employee payroll record creation
- [ ] Auto-calculate from attendance
- [ ] Salary adjustments (additions/deductions)
- [ ] Approve/reject workflow
- [ ] Post to finance
- [ ] Pay history
- [ ] All fields: period_name, start_date, end_date, basic_salary, deductions, net_salary, status

### 4. MAINTENANCE
**DB Tables**: maintenance_schedules, maintenance_records, machines
**Frontend**: Maintenance.js, MaintenanceReminders.js, Assets.js
**Checklist**:
- [ ] Schedule maintenance
- [ ] Log maintenance completion
- [ ] View maintenance history
- [ ] Due/overdue reminders
- [ ] Recurring maintenance
- [ ] Parts used tracking
- [ ] Cost tracking

### 5. HR / EMPLOYEES
**DB Tables**: employees, users, attendance_records, leave_requests
**Frontend**: HR.js
**Checklist**:
- [ ] Employee CRUD
- [ ] Department management
- [ ] Position/designation
- [ ] Attendance tracking
- [ ] Leave management
- [ ] Document upload (with storage location)
- [ ] Salary management
- [ ] All fields: name, position, department, salary, phone, email, status

### 6. SALES
**DB Tables**: sales_orders, sales_order_items, invoices, invoice_items, clients
**Frontend**: Sales.js, Orders.js
**Checklist**:
- [ ] Order creation with items
- [ ] Invoice generation
- [ ] Approval workflow
- [ ] Payment tracking
- [ ] Client credit management

### 7. INVENTORY
**DB Tables**: raw_materials, finished_goods, inventory_transactions
**Frontend**: Inventory.js
**Checklist**:
- [ ] Material CRUD
- [ ] Stock in/out
- [ ] Stock transfers
- [ ] Low stock alerts
- [ ] Valuation
- [ ] Category management

### 8. PURCHASING
**DB Tables**: purchase_orders, purchase_order_items, purchase_requisitions, suppliers
**Frontend**: PurchaseOrders.js, Suppliers.js
**Checklist**:
- [ ] PO creation
- [ ] GRN (goods receipt)
- [ ] Supplier management
- [ ] Approval workflow
- [ ] Three-way matching

### 9. FINANCE
**DB Tables**: accounts, invoices, payables, expenses, journal_entries
**Frontend**: Finance.js, Expenses.js, Accountant.js
**Checklist**:
- [ ] Chart of accounts
- [ ] Invoice management
- [ ] Expense tracking
- [ ] Payables/receivables
- [ ] Financial reports
- [ ] Journal entries

### 10. PRODUCTION
**DB Tables**: production_orders, production_order_items, feed_recipes, feed_recipe_items
**Frontend**: Production.js, Recipes.js
**Checklist**:
- [ ] Production order creation
- [ ] BOM/Recipe management
- [ ] Finished goods tracking
- [ ] Production efficiency

## Phase 3: Data Integrity
- [ ] Verify all FK relationships
- [ ] Check for orphaned records
- [ ] Verify required fields have data
- [ ] Check date ranges

## Phase 4: UI/UX Verification
- [ ] Each form has all fields from DB
- [ ] Form validation works
- [ ] Language switching works
- [ ] Console has 0 errors
- [ ] CRUD operations complete successfully
- [ ] Navigation between modules works

## Execution Order
1. Assets (machines + vehicles + maintenance)
2. Legal
3. Payroll
4. HR/Employees
5. Sales/Orders
6. Inventory
7. Purchasing
8. Finance
9. Production
