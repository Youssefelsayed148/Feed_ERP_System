-- FILE 03: OPERATIONS + PROCUREMENT + HR + LOGISTICS
-- Run after File 02. Tables depend on File 01 and 02.
-- =====================================================

-- ---------- 1. PURCHASE ORDERS ----------
CREATE TABLE IF NOT EXISTS purchase_orders (
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

-- ---------- 2. PURCHASE ORDER ITEMS ----------
CREATE TABLE IF NOT EXISTS purchase_order_items (
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

-- ---------- 3. GOODS RECEIPT NOTES ----------
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
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

-- ---------- 4. GRN ITEMS ----------
CREATE TABLE IF NOT EXISTS grn_items (
    id SERIAL PRIMARY KEY,
    grn_id INTEGER REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    quantity_ordered NUMERIC(12,3),
    quantity_received NUMERIC(12,3),
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 5. SUPPLIER PAYABLES ----------
CREATE TABLE IF NOT EXISTS supplier_payables (
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

-- ---------- 6. SUPPLIER PAYMENTS ----------
CREATE TABLE IF NOT EXISTS supplier_payments (
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

-- ---------- 7. REQUISITIONS ----------
CREATE TABLE IF NOT EXISTS requisitions (
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

-- ---------- 8. REQUISITION ITEMS ----------
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
    status VARCHAR(20) DEFAULT 'pending',
    purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 9. PURCHASE REQUISITIONS ----------
CREATE TABLE IF NOT EXISTS purchase_requisitions (
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

-- ---------- 10. NOTIFICATIONS ----------
CREATE TABLE IF NOT EXISTS notifications (
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

-- ---------- 11. ATTENDANCE RECORDS ----------
CREATE TABLE IF NOT EXISTS attendance_records (
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

-- ---------- 12. LEAVE REQUESTS ----------
CREATE TABLE IF NOT EXISTS leave_requests (
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

-- ---------- 13. PAYROLL PERIODS ----------
CREATE TABLE IF NOT EXISTS payroll_periods (
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

-- ---------- 14. PAYROLL RECORDS ----------
CREATE TABLE IF NOT EXISTS payroll_records (
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

-- ---------- 15. EXPENSES ----------
CREATE TABLE IF NOT EXISTS expenses (
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

-- ---------- 16. DELIVERY ASSIGNMENTS ----------
CREATE TABLE IF NOT EXISTS delivery_assignments (
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

-- ---------- 17. MAINTENANCE REMINDERS ----------
CREATE TABLE IF NOT EXISTS maintenance_reminders (
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

-- ---------- 18. MAINTENANCE SCHEDULES ----------
CREATE TABLE IF NOT EXISTS maintenance_schedules (
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
