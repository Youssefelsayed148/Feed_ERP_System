-- FILE 06: ALL TRIGGERS + UPDATED_AT FUNCTION
-- Run after all tables and indexes. Enables auto-updating timestamps.
-- =====================================================

-- ---------- 1. UPDATED_AT FUNCTION ----------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- 2. CORE TABLE TRIGGERS ----------
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

-- ---------- 3. SALES + PRODUCTION TRIGGERS ----------
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

-- ---------- 4. PROCUREMENT + HR + LOGISTICS TRIGGERS ----------
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

-- ---------- 5. APPROVAL SYSTEM TRIGGERS ----------
CREATE TRIGGER trg_approval_requests_updated_at
    BEFORE UPDATE ON approval_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
