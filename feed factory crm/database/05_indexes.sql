-- FILE 05: ALL INDEXES
-- Run after all tables created. Optimizes query performance.
-- =====================================================

-- USERS
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- EMPLOYEES
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- ACCOUNTS
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);

-- COMPANIES
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name_arabic);

-- CLIENTS
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_code ON clients(code);

-- SUPPLIERS
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- SUPPLIER MATERIALS
CREATE INDEX IF NOT EXISTS idx_supplier_materials_supplier ON supplier_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_materials_material ON supplier_materials(raw_material_id);

-- FEED SYSTEM
CREATE INDEX IF NOT EXISTS idx_feed_types_code ON feed_types(code);
CREATE INDEX IF NOT EXISTS idx_feed_types_category ON feed_types(category);
CREATE INDEX IF NOT EXISTS idx_feed_types_active ON feed_types(is_active);
CREATE INDEX IF NOT EXISTS idx_feed_pricing_feed_type ON feed_pricing(feed_type_id);

-- RAW MATERIALS
CREATE INDEX IF NOT EXISTS idx_raw_materials_code ON raw_materials(code);
CREATE INDEX IF NOT EXISTS idx_raw_materials_category ON raw_materials(category);

-- RECIPES
CREATE INDEX IF NOT EXISTS idx_feed_recipes_feed_type ON feed_recipes(feed_type_id);
CREATE INDEX IF NOT EXISTS idx_feed_recipe_items_recipe ON feed_recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_feed_recipe_items_material ON feed_recipe_items(raw_material_id);

-- CLIENT FINANCE
CREATE INDEX IF NOT EXISTS idx_client_liabilities_client ON client_liabilities(client_id);
CREATE INDEX IF NOT EXISTS idx_client_liabilities_status ON client_liabilities(status);
CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payment_history(client_id);
CREATE INDEX IF NOT EXISTS idx_client_expected_client ON client_expected_payments(client_id);

-- SALES SYSTEM
CREATE INDEX IF NOT EXISTS idx_sales_orders_client ON sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_orders_created_by ON sales_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_items_order ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_client ON reminders(client_id);
CREATE INDEX IF NOT EXISTS idx_reminders_sales_rep ON reminders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON reminders(reminder_date);

-- PRODUCTION
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_production_orders_feed ON production_orders(feed_type_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_recipe ON production_orders(recipe_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_order ON production_order_items(production_order_id);
CREATE INDEX IF NOT EXISTS idx_production_order_items_material ON production_order_items(raw_material_id);

-- INVENTORY
CREATE INDEX IF NOT EXISTS idx_inventory_material ON inventory_transactions(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_transactions(created_at);

-- FINISHED GOODS
CREATE INDEX IF NOT EXISTS idx_finished_goods_production ON finished_goods(production_order_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_feed ON finished_goods(feed_type_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_status ON finished_goods(status);
CREATE INDEX IF NOT EXISTS idx_finished_goods_batch ON finished_goods(batch_number);

-- JOURNAL
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_entry_lines(account_id);

-- MACHINES / VEHICLES
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_is_active ON machines(is_active);
CREATE INDEX IF NOT EXISTS idx_machines_created_by ON machines(created_by);
CREATE INDEX IF NOT EXISTS idx_machines_code ON machines(code);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON vehicles(is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_code ON vehicles(code);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON vehicles(plate_number);

-- PROCUREMENT
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON purchase_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_material ON purchase_order_items(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_grn_po ON goods_receipt_notes(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_grn_supplier ON goods_receipt_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_grn_status ON goods_receipt_notes(status);
CREATE INDEX IF NOT EXISTS idx_grn_created_by ON goods_receipt_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_grn_grn_number ON goods_receipt_notes(grn_number);
CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_material ON grn_items(raw_material_id);

-- SUPPLIER FINANCE
CREATE INDEX IF NOT EXISTS idx_supplier_payables_supplier ON supplier_payables(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_po ON supplier_payables(po_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_grn ON supplier_payables(grn_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_status ON supplier_payables(status);
CREATE INDEX IF NOT EXISTS idx_supplier_payables_due_date ON supplier_payables(due_date);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_payable ON supplier_payments(payable_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_created_by ON supplier_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(payment_date);

-- REQUISITIONS
CREATE INDEX IF NOT EXISTS idx_requisitions_created_by ON requisitions(created_by);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisition_items_requisition ON requisition_items(requisition_id);
CREATE INDEX IF NOT EXISTS idx_requisition_items_material ON requisition_items(raw_material_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_requested_by ON purchase_requisitions(requested_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_status ON purchase_requisitions(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_approved_by ON purchase_requisitions(approved_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requisitions_number ON purchase_requisitions(requisition_number);

-- NOTIFICATIONS
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- HR MODULE
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_leave_user ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_approved_by ON leave_requests(approved_by);
CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_is_posted ON payroll_records(is_posted_to_finance);
CREATE INDEX IF NOT EXISTS idx_payroll_created_by ON payroll_records(created_by);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_name ON payroll_periods(period_name);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);

-- LOGISTICS
CREATE INDEX IF NOT EXISTS idx_delivery_order ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_vehicle ON delivery_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_delivery_driver ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_delivery_scheduled ON delivery_assignments(scheduled_date);

-- EXPENSES
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_approved_by ON expenses(approved_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_is_active ON expenses(is_active);

-- MAINTENANCE
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_machine ON maintenance_reminders(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_status ON maintenance_reminders(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_reminders_due ON maintenance_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_machine ON maintenance_schedules(machine_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_technician ON maintenance_schedules(technician_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_status ON maintenance_schedules(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_schedules_date ON maintenance_schedules(scheduled_date);

-- APPROVAL SYSTEM
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_module ON approval_requests(module_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_time ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_module ON activity_log(module);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
