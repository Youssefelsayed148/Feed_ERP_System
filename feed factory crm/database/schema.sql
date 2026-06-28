-- Al Kheir Feed Factory - PostgreSQL Database Schema
-- Updated: June 17, 2026
-- Complete schema with all tables, indexes, triggers, and foreign keys
-- Run this file first, then run seed_data.sql

-- ============================================================
-- DROP TABLES (for clean setup)
-- ============================================================
--DROP TABLE IF EXISTS journal_entry_lines CASCADE;
--DROP TABLE IF EXISTS journal_entries CASCADE;
--DROP TABLE IF EXISTS invoice_items CASCADE;
--DROP TABLE IF EXISTS invoices CASCADE;
--DROP TABLE IF EXISTS sales_order_items CASCADE;
--DROP TABLE IF EXISTS sales_orders CASCADE;
--DROP TABLE IF EXISTS reminders CASCADE;
--DROP TABLE IF EXISTS activity_log CASCADE;
--DROP TABLE IF EXISTS user_activity_log CASCADE;
--DROP TABLE IF EXISTS approval_requests CASCADE;
--DROP TABLE IF EXISTS approval_settings CASCADE;
--DROP TABLE IF EXISTS maintenance_schedules CASCADE;
--DROP TABLE IF EXISTS maintenance_reminders CASCADE;
--DROP TABLE IF EXISTS delivery_assignments CASCADE;
--DROP TABLE IF EXISTS expenses CASCADE;
--DROP TABLE IF EXISTS payroll_records CASCADE;
--DROP TABLE IF EXISTS payroll_periods CASCADE;
--DROP TABLE IF EXISTS leave_requests CASCADE;
--DROP TABLE IF EXISTS attendance_records CASCADE;
--DROP TABLE IF EXISTS purchase_requisitions CASCADE;
--DROP TABLE IF EXISTS requisition_items CASCADE;
--DROP TABLE IF EXISTS requisitions CASCADE;
--DROP TABLE IF EXISTS supplier_payments CASCADE;
--DROP TABLE IF EXISTS supplier_payables CASCADE;
--DROP TABLE IF EXISTS grn_items CASCADE;
--DROP TABLE IF EXISTS goods_receipt_notes CASCADE;
--DROP TABLE IF EXISTS purchase_order_items CASCADE;
--DROP TABLE IF EXISTS purchase_orders CASCADE;
--DROP TABLE IF EXISTS finished_goods CASCADE;
--DROP TABLE IF EXISTS production_order_items CASCADE;
--DROP TABLE IF EXISTS production_orders CASCADE;
--DROP TABLE IF EXISTS inventory_transactions CASCADE;
--DROP TABLE IF EXISTS client_payment_history CASCADE;
--DROP TABLE IF EXISTS client_expected_payments CASCADE;
--DROP TABLE IF EXISTS client_liabilities CASCADE;
--DROP TABLE IF EXISTS supplier_materials CASCADE;
--DROP TABLE IF EXISTS feed_recipe_items CASCADE;
--DROP TABLE IF EXISTS feed_recipes CASCADE;
--DROP TABLE IF EXISTS feed_pricing CASCADE;
--DROP TABLE IF EXISTS raw_materials CASCADE;
--DROP TABLE IF EXISTS feed_types CASCADE;
--DROP TABLE IF EXISTS vehicles CASCADE;
--DROP TABLE IF EXISTS machines CASCADE;
--DROP TABLE IF EXISTS clients CASCADE;
--DROP TABLE IF EXISTS suppliers CASCADE;
--DROP TABLE IF EXISTS employees CASCADE;
--DROP TABLE IF EXISTS accounts CASCADE;
--DROP TABLE IF EXISTS companies CASCADE;
--DROP TABLE IF EXISTS users CASCADE;
--DROP TABLE IF EXISTS notifications CASCADE;

-- ============================================================
-- TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 1: CORE ERP TABLES (no dependencies)
-- ============================================================

-- 1. COMPANIES
CREATE TABLE companies (
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

-- 2. USERS
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (
        role IN (
            'owner','admin','sales_manager','sales_rep',
            'purchase_officer','production_manager',
            'finance_manager','hr_manager','warehouse_manager',
            'customer_accountant','cashier','logistics_coordinator',
            'purchasing_coordinator','quality_assistant'
        )
    ),
    phone VARCHAR(20),
    department VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. EMPLOYEES
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    position VARCHAR(255),
    department VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    hire_date DATE,
    salary NUMERIC(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    documents JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ACCOUNTS (Chart of Accounts)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. FEED TYPES
CREATE TABLE feed_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200) NOT NULL,
    protein_percentage VARCHAR(10),
    category VARCHAR(50) NOT NULL,
    sub_category VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. RAW MATERIALS
CREATE TABLE raw_materials (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) DEFAULT 'kg',
    unit_price DECIMAL(10,2) NOT NULL,
    min_stock_level DECIMAL(10,2) DEFAULT 1000,
    reorder_level DECIMAL(10,2) DEFAULT 2000,
    current_stock DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. SUPPLIERS
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    materials_supplied TEXT[],
    payment_terms VARCHAR(50),
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. SUPPLIER MATERIALS
CREATE TABLE supplier_materials (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT false,
    unit_price NUMERIC(10,2),
    lead_time_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, raw_material_id)
);

-- 9. CLIENTS
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200),
    type VARCHAR(50) CHECK (type IN ('wholesale', 'retail', 'distributor', 'farm')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    payment_terms VARCHAR(50),
    current_balance DECIMAL(12,2) DEFAULT 0,
    total_purchases DECIMAL(12,2) DEFAULT 0,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP,
    last_order_date DATE,
    last_payment_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. MACHINES
CREATE TABLE machines (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_arabic VARCHAR(255),
    name_english VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    purchase_date DATE,
    purchase_cost NUMERIC(12,2),
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. VEHICLES
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    type VARCHAR(50),
    capacity_kg NUMERIC(10,2),
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SECTION 2: SALES + PRODUCTION + FINANCE (depends on Section 1)
-- ============================================================

-- 12. FEED PRICING
CREATE TABLE feed_pricing (
    id SERIAL PRIMARY KEY,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE CASCADE,
    package_size INTEGER NOT NULL CHECK (package_size IN (10, 25, 50)),
    unit VARCHAR(10) DEFAULT 'kg',
    cost_price DECIMAL(12,2) NOT NULL,
    selling_price_7 DECIMAL(12,2) NOT NULL,
    selling_price_75 DECIMAL(12,2) NOT NULL,
    selling_price_8 DECIMAL(12,2) NOT NULL,
    max_price DECIMAL(12,2) NOT NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_type_id, package_size)
);

-- 13. FEED RECIPES
CREATE TABLE feed_recipes (
    id SERIAL PRIMARY KEY,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    name VARCHAR(200),
    total_quantity_kg DECIMAL(10,2) DEFAULT 1000,
    total_cost DECIMAL(12,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_type_id, version)
);

-- 14. FEED RECIPE ITEMS
CREATE TABLE feed_recipe_items (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES feed_recipes(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10,4) NOT NULL,
    percentage DECIMAL(5,2),
    unit_cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, raw_material_id)
);

-- 15. CLIENT LIABILITIES
CREATE TABLE client_liabilities (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    due_date DATE,
    description TEXT,
    type VARCHAR(50) CHECK (type IN ('balance', 'invoice', 'charge')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. CLIENT EXPECTED PAYMENTS
CREATE TABLE client_expected_payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    expected_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'overdue')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. CLIENT PAYMENT HISTORY
CREATE TABLE client_payment_history (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    invoice_id INTEGER,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    method VARCHAR(50) CHECK (method IN ('cash', 'bank_transfer', 'check', 'credit_card')),
    collected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. SALES ORDERS
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    status VARCHAR(30) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'confirmed', 'processing', 'in_transit', 'delivered', 'rejected', 'cancelled')),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    final_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
    delivery_date DATE,
    notes TEXT,
    rejection_reason TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. SALES ORDER ITEMS
CREATE TABLE sales_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE SET NULL,
    package_size INTEGER NOT NULL CHECK (package_size IN (10, 25, 50)),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 20. INVOICES
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    paid_amount DECIMAL(12,2) DEFAULT 0,
    balance_due DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 21. INVOICE ITEMS
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 22. REMINDERS
CREATE TABLE reminders (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    sales_rep_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT,
    reminder_date TIMESTAMP NOT NULL,
    reminder_type VARCHAR(50) CHECK (reminder_type IN ('payment', 'follow_up', 'order', 'visit', 'call', 'other')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
    sent_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 23. PRODUCTION ORDERS
CREATE TABLE production_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE SET NULL,
    recipe_id INTEGER REFERENCES feed_recipes(id) ON DELETE SET NULL,
    quantity_kg DECIMAL(10,2) NOT NULL,
    batch_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
    production_date DATE,
    completion_date DATE,
    actual_cost DECIMAL(12,2),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 24. PRODUCTION ORDER ITEMS
CREATE TABLE production_order_items (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER REFERENCES production_orders(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    planned_quantity DECIMAL(10,4) NOT NULL,
    actual_quantity DECIMAL(10,4),
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 25. FINISHED GOODS
CREATE TABLE finished_goods (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER REFERENCES production_orders(id) ON DELETE SET NULL,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE SET NULL,
    batch_number VARCHAR(50) UNIQUE,
    quantity_kg NUMERIC(12,3),
    package_size NUMERIC(8,2),
    packages_count INTEGER DEFAULT 0,
    number_of_bags INTEGER DEFAULT 0,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 26. INVENTORY TRANSACTIONS
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'production', 'adjustment', 'return', 'sale')),
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    reference_id INTEGER,
    reference_type VARCHAR(50),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 27. JOURNAL ENTRIES
CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    entry_number VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id INTEGER,
    total_amount NUMERIC(12,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 28. JOURNAL ENTRY LINES
CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    account_name VARCHAR(255),
    debit NUMERIC(12,2) DEFAULT 0,
    credit NUMERIC(12,2) DEFAULT 0,
    description TEXT,
    line_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SECTION 3: OPERATIONS + PROCUREMENT + HR + LOGISTICS
-- ============================================================

-- 29. PURCHASE ORDERS
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    total_amount NUMERIC(12,2) DEFAULT 0,
    vat_amount NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 30. PURCHASE ORDER ITEMS
CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    quantity NUMERIC(12,3),
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(12,2),
    unit_price NUMERIC(10,2) DEFAULT 0,
    total_price NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 31. GOODS RECEIPT NOTES
CREATE TABLE goods_receipt_notes (
    id SERIAL PRIMARY KEY,
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    received_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 32. GRN ITEMS
CREATE TABLE grn_items (
    id SERIAL PRIMARY KEY,
    grn_id INTEGER REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    quantity_ordered NUMERIC(12,3),
    quantity_received NUMERIC(12,3),
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 33. SUPPLIER PAYABLES
CREATE TABLE supplier_payables (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    grn_id INTEGER REFERENCES goods_receipt_notes(id) ON DELETE SET NULL,
    amount NUMERIC(12,2),
    paid_amount NUMERIC(12,2) DEFAULT 0,
    balance NUMERIC(12,2),
    due_date DATE,
    status VARCHAR(20) DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 34. SUPPLIER PAYMENTS
CREATE TABLE supplier_payments (
    id SERIAL PRIMARY KEY,
    payable_id INTEGER REFERENCES supplier_payables(id) ON DELETE CASCADE,
    amount NUMERIC(12,2),
    payment_date DATE DEFAULT CURRENT_DATE,
    method VARCHAR(50),
    reference VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 35. REQUISITIONS
CREATE TABLE requisitions (
    id SERIAL PRIMARY KEY,
    requisition_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    total_items INTEGER DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    sent_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 36. REQUISITION ITEMS
CREATE TABLE requisition_items (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER REFERENCES requisitions(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    suggested_quantity NUMERIC(12,3) DEFAULT 0,
    unit_price NUMERIC(10,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 37. PURCHASE REQUISITIONS
CREATE TABLE purchase_requisitions (
    id SERIAL PRIMARY KEY,
    requisition_number VARCHAR(50) UNIQUE NOT NULL,
    requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    department VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    items JSONB,
    notes TEXT,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 38. NOTIFICATIONS
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(255),
    role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 39. ATTENDANCE RECORDS
CREATE TABLE attendance_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    check_in TIMESTAMP,
    check_out TIMESTAMP,
    status VARCHAR(20) DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- 40. LEAVE REQUESTS
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    days_count INTEGER,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 41. PAYROLL PERIODS
CREATE TABLE payroll_periods (
    id SERIAL PRIMARY KEY,
    period_name VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE,
    end_date DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'draft',
    total_basic_salary NUMERIC(12,2) DEFAULT 0,
    total_bonus NUMERIC(12,2) DEFAULT 0,
    total_deductions NUMERIC(12,2) DEFAULT 0,
    total_net_salary NUMERIC(12,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 42. PAYROLL RECORDS
CREATE TABLE payroll_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    period_id INTEGER REFERENCES payroll_periods(id) ON DELETE SET NULL,
    period_start DATE,
    period_end DATE,
    basic_salary NUMERIC(12,2),
    deductions NUMERIC(12,2) DEFAULT 0,
    additions NUMERIC(12,2) DEFAULT 0,
    net_salary NUMERIC(12,2),
    status VARCHAR(20) DEFAULT 'draft',
    is_posted_to_finance BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 43. EXPENSES
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100),
    description TEXT,
    amount NUMERIC(12,2),
    date DATE DEFAULT CURRENT_DATE,
    reference VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 44. DELIVERY ASSIGNMENTS
CREATE TABLE delivery_assignments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
    vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    scheduled_date DATE,
    actual_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 45. MAINTENANCE REMINDERS
CREATE TABLE maintenance_reminders (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    type VARCHAR(50) DEFAULT 'routine',
    description TEXT,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    cost NUMERIC(10,2),
    notes TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 46. MAINTENANCE SCHEDULES
CREATE TABLE maintenance_schedules (
    id SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
    scheduled_date DATE,
    type VARCHAR(50),
    description TEXT,
    status VARCHAR(20) DEFAULT 'scheduled',
    cost NUMERIC(10,2),
    technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SECTION 4: APPROVAL SYSTEM + ACTIVITY LOGGING
-- ============================================================

-- 47. APPROVAL SETTINGS
CREATE TABLE approval_settings (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) UNIQUE NOT NULL,
    requires_approval BOOLEAN DEFAULT true,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 48. APPROVAL REQUESTS
CREATE TABLE approval_requests (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    request_id INTEGER NOT NULL,
    requester_id INTEGER REFERENCES users(id),
    approver_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 49. USER ACTIVITY LOG
CREATE TABLE user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    module_name VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 50. ACTIVITY LOG
CREATE TABLE activity_log (
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

-- ============================================================
-- ALL INDEXES
-- ============================================================

-- USERS
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- EMPLOYEES
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_status ON employees(status);

-- ACCOUNTS
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);

-- COMPANIES
CREATE INDEX idx_companies_name ON companies(name_arabic);

-- CLIENTS
CREATE INDEX idx_clients_type ON clients(type);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX idx_clients_code ON clients(code);

-- SUPPLIERS
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_suppliers_active ON suppliers(is_active);

-- SUPPLIER MATERIALS
CREATE INDEX idx_supplier_materials_supplier ON supplier_materials(supplier_id);
CREATE INDEX idx_supplier_materials_material ON supplier_materials(raw_material_id);

-- FEED SYSTEM
CREATE INDEX idx_feed_types_code ON feed_types(code);
CREATE INDEX idx_feed_types_category ON feed_types(category);
CREATE INDEX idx_feed_types_active ON feed_types(is_active);
CREATE INDEX idx_feed_pricing_feed_type ON feed_pricing(feed_type_id);

-- RAW MATERIALS
CREATE INDEX idx_raw_materials_code ON raw_materials(code);
CREATE INDEX idx_raw_materials_category ON raw_materials(category);

-- RECIPES
CREATE INDEX idx_feed_recipes_feed_type ON feed_recipes(feed_type_id);
CREATE INDEX idx_feed_recipe_items_recipe ON feed_recipe_items(recipe_id);
CREATE INDEX idx_feed_recipe_items_material ON feed_recipe_items(raw_material_id);

-- CLIENT FINANCE
CREATE INDEX idx_client_liabilities_client ON client_liabilities(client_id);
CREATE INDEX idx_client_liabilities_status ON client_liabilities(status);
CREATE INDEX idx_client_payments_client ON client_payment_history(client_id);
CREATE INDEX idx_client_expected_client ON client_expected_payments(client_id);

-- SALES SYSTEM
CREATE INDEX idx_sales_orders_client ON sales_orders(client_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX idx_sales_orders_created_by ON sales_orders(created_by);
CREATE INDEX idx_sales_items_order ON sales_order_items(order_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_reminders_client ON reminders(client_id);
CREATE INDEX idx_reminders_sales_rep ON reminders(sales_rep_id);
CREATE INDEX idx_reminders_date ON reminders(reminder_date);

-- PRODUCTION
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_feed ON production_orders(feed_type_id);
CREATE INDEX idx_production_orders_recipe ON production_orders(recipe_id);
CREATE INDEX idx_production_order_items_order ON production_order_items(production_order_id);
CREATE INDEX idx_production_order_items_material ON production_order_items(raw_material_id);

-- INVENTORY
CREATE INDEX idx_inventory_material ON inventory_transactions(raw_material_id);
CREATE INDEX idx_inventory_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_date ON inventory_transactions(created_at);

-- FINISHED GOODS
CREATE INDEX idx_finished_goods_production ON finished_goods(production_order_id);
CREATE INDEX idx_finished_goods_feed ON finished_goods(feed_type_id);
CREATE INDEX idx_finished_goods_status ON finished_goods(status);
CREATE INDEX idx_finished_goods_batch ON finished_goods(batch_number);

-- JOURNAL
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);

-- MACHINES / VEHICLES
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_machines_is_active ON machines(is_active);
CREATE INDEX idx_machines_created_by ON machines(created_by);
CREATE INDEX idx_machines_code ON machines(code);
CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_vehicles_is_active ON vehicles(is_active);
CREATE INDEX idx_vehicles_code ON vehicles(code);
CREATE INDEX idx_vehicles_plate ON vehicles(plate_number);

-- PROCUREMENT
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_material ON purchase_order_items(raw_material_id);
CREATE INDEX idx_grn_po ON goods_receipt_notes(purchase_order_id);
CREATE INDEX idx_grn_supplier ON goods_receipt_notes(supplier_id);
CREATE INDEX idx_grn_status ON goods_receipt_notes(status);
CREATE INDEX idx_grn_created_by ON goods_receipt_notes(created_by);
CREATE INDEX idx_grn_grn_number ON goods_receipt_notes(grn_number);
CREATE INDEX idx_grn_items_grn ON grn_items(grn_id);
CREATE INDEX idx_grn_items_material ON grn_items(raw_material_id);

-- SUPPLIER FINANCE
CREATE INDEX idx_supplier_payables_supplier ON supplier_payables(supplier_id);
CREATE INDEX idx_supplier_payables_po ON supplier_payables(po_id);
CREATE INDEX idx_supplier_payables_grn ON supplier_payables(grn_id);
CREATE INDEX idx_supplier_payables_status ON supplier_payables(status);
CREATE INDEX idx_supplier_payables_due_date ON supplier_payables(due_date);
CREATE INDEX idx_supplier_payments_payable ON supplier_payments(payable_id);
CREATE INDEX idx_supplier_payments_created_by ON supplier_payments(created_by);
CREATE INDEX idx_supplier_payments_date ON supplier_payments(payment_date);

-- REQUISITIONS
CREATE INDEX idx_requisitions_created_by ON requisitions(created_by);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisition_items_requisition ON requisition_items(requisition_id);
CREATE INDEX idx_requisition_items_material ON requisition_items(raw_material_id);
CREATE INDEX idx_purchase_requisitions_requested_by ON purchase_requisitions(requested_by);
CREATE INDEX idx_purchase_requisitions_status ON purchase_requisitions(status);
CREATE INDEX idx_purchase_requisitions_approved_by ON purchase_requisitions(approved_by);
CREATE INDEX idx_purchase_requisitions_number ON purchase_requisitions(requisition_number);

-- NOTIFICATIONS
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- HR MODULE
CREATE INDEX idx_attendance_user ON attendance_records(user_id);
CREATE INDEX idx_attendance_date ON attendance_records(date);
CREATE INDEX idx_attendance_status ON attendance_records(status);
CREATE INDEX idx_leave_user ON leave_requests(user_id);
CREATE INDEX idx_leave_status ON leave_requests(status);
CREATE INDEX idx_leave_approved_by ON leave_requests(approved_by);
CREATE INDEX idx_payroll_user ON payroll_records(user_id);
CREATE INDEX idx_payroll_status ON payroll_records(status);
CREATE INDEX idx_payroll_is_posted ON payroll_records(is_posted_to_finance);
CREATE INDEX idx_payroll_created_by ON payroll_records(created_by);
CREATE INDEX idx_payroll_period ON payroll_records(period_start, period_end);
CREATE INDEX idx_payroll_periods_name ON payroll_periods(period_name);
CREATE INDEX idx_payroll_periods_status ON payroll_periods(status);

-- LOGISTICS
CREATE INDEX idx_delivery_order ON delivery_assignments(order_id);
CREATE INDEX idx_delivery_vehicle ON delivery_assignments(vehicle_id);
CREATE INDEX idx_delivery_driver ON delivery_assignments(driver_id);
CREATE INDEX idx_delivery_status ON delivery_assignments(status);
CREATE INDEX idx_delivery_scheduled ON delivery_assignments(scheduled_date);

-- EXPENSES
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_approved_by ON expenses(approved_by);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_expenses_is_active ON expenses(is_active);

-- MAINTENANCE
CREATE INDEX idx_maintenance_reminders_machine ON maintenance_reminders(machine_id);
CREATE INDEX idx_maintenance_reminders_status ON maintenance_reminders(status);
CREATE INDEX idx_maintenance_reminders_due ON maintenance_reminders(due_date);
CREATE INDEX idx_maintenance_schedules_machine ON maintenance_schedules(machine_id);
CREATE INDEX idx_maintenance_schedules_technician ON maintenance_schedules(technician_id);
CREATE INDEX idx_maintenance_schedules_status ON maintenance_schedules(status);
CREATE INDEX idx_maintenance_schedules_date ON maintenance_schedules(scheduled_date);

-- APPROVAL SYSTEM
CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_module ON approval_requests(module_name);
CREATE INDEX idx_user_activity_user ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_time ON user_activity_log(created_at);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_module ON activity_log(module);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

-- ============================================================
-- ALL TRIGGERS
-- ============================================================

-- CORE TABLE TRIGGERS
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_feed_types_updated_at
    BEFORE UPDATE ON feed_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_raw_materials_updated_at
    BEFORE UPDATE ON raw_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_machines_updated_at
    BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SALES + PRODUCTION TRIGGERS
CREATE TRIGGER trg_feed_pricing_updated_at
    BEFORE UPDATE ON feed_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_feed_recipes_updated_at
    BEFORE UPDATE ON feed_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sales_orders_updated_at
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_production_orders_updated_at
    BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_finished_goods_updated_at
    BEFORE UPDATE ON finished_goods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- PROCUREMENT + HR + LOGISTICS TRIGGERS
CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_grn_updated_at
    BEFORE UPDATE ON goods_receipt_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_supplier_payables_updated_at
    BEFORE UPDATE ON supplier_payables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_requisitions_updated_at
    BEFORE UPDATE ON requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_requisitions_updated_at
    BEFORE UPDATE ON purchase_requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_leave_requests_updated_at
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payroll_periods_updated_at
    BEFORE UPDATE ON payroll_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payroll_records_updated_at
    BEFORE UPDATE ON payroll_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_delivery_updated_at
    BEFORE UPDATE ON delivery_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_maintenance_reminders_updated_at
    BEFORE UPDATE ON maintenance_reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_maintenance_schedules_updated_at
    BEFORE UPDATE ON maintenance_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- APPROVAL SYSTEM TRIGGERS
CREATE TRIGGER trg_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schema creation complete
SELECT 'Schema created successfully' as status;