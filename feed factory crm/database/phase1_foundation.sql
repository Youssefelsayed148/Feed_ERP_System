-- ============================================================
-- Al Kheir Feed Factory - Phase 1 Foundation Schema
-- Missing tables, indexes, and seed users using REAL column names
-- Created: April 28, 2026
-- Run AFTER complete_schema_with_sales.sql
-- ============================================================

-- ============================================================
-- A) CREATE TABLE IF NOT EXISTS for missing tables
-- ============================================================

-- 1. Machines
CREATE TABLE IF NOT EXISTS machines (
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

-- 2. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
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

-- 3. Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft',
    order_date DATE DEFAULT CURRENT_DATE,
    expected_date DATE,
    total_amount NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id SERIAL PRIMARY KEY,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    quantity NUMERIC(12,3),
    unit_cost NUMERIC(10,2),
    total_cost NUMERIC(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Goods Receipt Notes
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
    id SERIAL PRIMARY KEY,
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    po_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    received_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'draft',
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. GRN Items
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

-- 7. Supplier Payables
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

-- 8. Supplier Payments
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

-- 9. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Purchase Requisitions
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

-- 11. Attendance Records
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

-- 12. Leave Requests
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

-- 13. Maintenance Schedules
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

-- 14. Delivery Assignments
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

-- 15. Finished Goods
CREATE TABLE IF NOT EXISTS finished_goods (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER REFERENCES production_orders(id) ON DELETE SET NULL,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE SET NULL,
    batch_number VARCHAR(50) UNIQUE,
    quantity_kg NUMERIC(12,3),
    package_size NUMERIC(8,2),
    packages_count INTEGER,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Payroll Records
CREATE TABLE IF NOT EXISTS payroll_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

-- 17. Expenses
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

-- ============================================================
-- B) Indexes on ALL foreign key columns and ALL status/is_active columns
-- ============================================================

-- Machines indexes
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_is_active ON machines(is_active);
CREATE INDEX IF NOT EXISTS idx_machines_created_by ON machines(created_by);
CREATE INDEX IF NOT EXISTS idx_machines_code ON machines(code);

-- Vehicles indexes
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_code ON vehicles(code);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate_number ON vehicles(plate_number);

-- Purchase Orders indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);

-- Purchase Order Items indexes
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_raw_material_id ON purchase_order_items(raw_material_id);

-- Goods Receipt Notes indexes
CREATE INDEX IF NOT EXISTS idx_grn_po_id ON goods_receipt_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier_id ON goods_receipt_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipt_notes(status);
CREATE INDEX IF NOT EXISTS idx_grn_created_by ON goods_receipt_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_grn_grn_number ON goods_receipt_notes(grn_number);

-- GRN Items indexes
CREATE INDEX IF NOT EXISTS idx_grn_items_grn_id ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_raw_material_id ON grn_items(raw_material_id);

-- Supplier Payables indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payables_supplier_id ON supplier_payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_po_id ON supplier_payables(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_grn_id ON supplier_payables(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_status ON supplier_payables(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_due_date ON supplier_payables(due_date);

-- Supplier Payments indexes
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payable_id ON supplier_payments(payable_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_created_by ON supplier_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payment_date ON supplier_payments(payment_date);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Purchase Requisitions indexes
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_requested_by ON purchase_requisitions(requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_approved_by ON purchase_requisitions(approved_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_requisition_number ON purchase_requisitions(requisition_number);

-- Attendance Records indexes
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON attendance_records(status);

-- Leave Requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approved_by ON leave_requests(approved_by);

-- Maintenance Schedules indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_machine_id ON maintenance_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_technician_id ON maintenance_schedules(technician_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_status ON maintenance_schedules(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_scheduled_date ON maintenance_schedules(scheduled_date);

-- Delivery Assignments indexes
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_vehicle_id ON delivery_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_id ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_scheduled_date ON delivery_assignments(scheduled_date);

-- Finished Goods indexes
CREATE INDEX IF NOT EXISTS idx_finished_goods_production_order_id ON finished_goods(production_order_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_feed_type_id ON finished_goods(feed_type_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_status ON finished_goods(status);
CREATE INDEX IF NOT EXISTS idx_finished_goods_batch_number ON finished_goods(batch_number);

-- Payroll Records indexes
CREATE INDEX IF NOT EXISTS idx_payroll_records_user_id ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_is_posted_to_finance ON payroll_records(is_posted_to_finance);
CREATE INDEX IF NOT EXISTS idx_payroll_records_created_by ON payroll_records(created_by);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(period_start, period_end);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_approved_by ON expenses(approved_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_is_active ON expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ============================================================
-- Triggers for updated_at columns (function already exists from original schema)
-- ============================================================

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goods_receipt_notes_updated_at BEFORE UPDATE ON goods_receipt_notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_payables_updated_at BEFORE UPDATE ON supplier_payables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_requisitions_updated_at BEFORE UPDATE ON purchase_requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_schedules_updated_at BEFORE UPDATE ON maintenance_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_delivery_assignments_updated_at BEFORE UPDATE ON delivery_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_finished_goods_updated_at BEFORE UPDATE ON finished_goods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_records_updated_at BEFORE UPDATE ON payroll_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- C) Seed users using WHERE NOT EXISTS pattern
-- Password for all: "password123"
-- Real bcrypt hash (verified with bcryptjs compare):
-- $2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O
-- ============================================================

INSERT INTO users (name, email, password_hash, role, department, is_active)
SELECT 'Sales Manager', 'sales.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'sales_manager', 'Sales', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'sales.manager@al-kheir.com');

INSERT INTO users (name, email, password_hash, role, department, is_active)
SELECT 'HR Manager', 'hr.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'hr_manager', 'HR', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'hr.manager@al-kheir.com');

INSERT INTO users (name, email, password_hash, role, department, is_active)
SELECT 'Warehouse Manager', 'warehouse.manager@al-kheir.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'warehouse_manager', 'Warehouse', true
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'warehouse.manager@al-kheir.com');

-- ============================================================
-- Phase 1 Foundation complete
-- ============================================================
SELECT 'Phase 1 Foundation schema created successfully' as status;
