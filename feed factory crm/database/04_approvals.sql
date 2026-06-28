-- FILE 04: APPROVAL SYSTEM + ACTIVITY LOGGING
-- Run after File 03. Standalone operational tables.
-- =====================================================

-- ---------- 1. APPROVAL SETTINGS ----------
CREATE TABLE IF NOT EXISTS approval_settings (
    id SERIAL PRIMARY KEY,
    module_name VARCHAR(50) UNIQUE NOT NULL,
    requires_approval BOOLEAN DEFAULT true,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 2. APPROVAL REQUESTS ----------
CREATE TABLE IF NOT EXISTS approval_requests (
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

-- ---------- 3. USER ACTIVITY LOG ----------
CREATE TABLE IF NOT EXISTS user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    module_name VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 4. ACTIVITY LOG ----------
CREATE TABLE IF NOT EXISTS activity_log (
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