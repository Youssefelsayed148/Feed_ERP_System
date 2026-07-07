-- 008_delivery_otp_items.sql
-- Adds:
--   otp_attempts column to delivery_assignments (for brute-force protection)
--   delivery_item_confirmations table (per-item delivered/rejected qty recording)

ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS otp_attempts INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS delivery_item_confirmations (
    id SERIAL PRIMARY KEY,
    delivery_assignment_id INTEGER NOT NULL REFERENCES delivery_assignments(id) ON DELETE CASCADE,
    item_name VARCHAR(255),
    ordered_qty DECIMAL(10,2) DEFAULT 0,
    delivered_qty DECIMAL(10,2) DEFAULT 0,
    rejected_qty DECIMAL(10,2) DEFAULT 0,
    rejection_reason TEXT,
    condition VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_item_conf_delivery ON delivery_item_confirmations(delivery_assignment_id);
