-- Approval System Tables for Al Kheir Feed Factory CRM
-- Run: PGPASSWORD=Theosirislabs1$ psql -h localhost -U postgres -d al_kheir_feed_factory -f approval_system.sql

-- 1. Approval Settings (per module toggle)
CREATE TABLE IF NOT EXISTS approval_settings (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) UNIQUE NOT NULL,
    requires_approval BOOLEAN DEFAULT true,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Approval Requests (pending approvals)
CREATE TABLE IF NOT EXISTS approval_requests (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) NOT NULL,
    request_type VARCHAR(50) NOT NULL, -- 'sales_order', 'purchase_order', 'payroll', 'expense', etc.
    request_id INTEGER NOT NULL, -- ID of the record needing approval
    requester_id INTEGER REFERENCES users(id),
    approver_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Activity Log (for owner dashboard tracking)
CREATE TABLE IF NOT EXISTS user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    module_name VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_module ON approval_requests(module_name);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_time ON user_activity_log(created_at);

-- Insert default settings (all modules require approval by default)
INSERT INTO approval_settings (module_name, requires_approval) VALUES
    ('sales_orders', true),
    ('purchase_orders', true),
    ('payroll', true),
    ('expenses', true),
    ('production', true),
    ('inventory_adjustments', true)
ON CONFLICT (module_name) DO NOTHING;

-- Add new role types to users table check constraint
-- Note: This only adds comment for documentation. The actual CHECK constraint would need ALTER TABLE.
COMMENT ON COLUMN users.role IS 'owner, admin, sales_manager, sales_rep, purchase_officer, production_manager, finance_manager, hr_manager, warehouse_manager, customer_accountant, cashier, logistics_coordinator, purchasing_coordinator, quality_assistant';
