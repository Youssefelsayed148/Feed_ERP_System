-- FILE 02: SALES + PRODUCTION + FINANCE CORE
-- Run after File 01. Tables depend on File 01 tables.
-- =====================================================

-- ---------- 1. FEED PRICING ----------
CREATE TABLE IF NOT EXISTS feed_pricing (
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

-- ---------- 2. FEED RECIPES ----------
CREATE TABLE IF NOT EXISTS feed_recipes (
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

-- ---------- 3. FEED RECIPE ITEMS ----------
CREATE TABLE IF NOT EXISTS feed_recipe_items (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES feed_recipes(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10,4) NOT NULL,
    percentage DECIMAL(5,2),
    unit_cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, raw_material_id)
);

-- ---------- 4. CLIENT LIABILITIES ----------
CREATE TABLE IF NOT EXISTS client_liabilities (
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

-- ---------- 5. CLIENT EXPECTED PAYMENTS ----------
CREATE TABLE IF NOT EXISTS client_expected_payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    expected_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'overdue')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 6. CLIENT PAYMENT HISTORY ----------
CREATE TABLE IF NOT EXISTS client_payment_history (
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

-- ---------- 7. SALES ORDERS ----------
CREATE TABLE IF NOT EXISTS sales_orders (
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

-- ---------- 8. SALES ORDER ITEMS ----------
CREATE TABLE IF NOT EXISTS sales_order_items (
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

-- ---------- 9. INVOICES ----------
CREATE TABLE IF NOT EXISTS invoices (
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

-- ---------- 10. INVOICE ITEMS ----------
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 11. REMINDERS ----------
CREATE TABLE IF NOT EXISTS reminders (
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

-- ---------- 12. PRODUCTION ORDERS ----------
CREATE TABLE IF NOT EXISTS production_orders (
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

-- ---------- 13. PRODUCTION ORDER ITEMS ----------
CREATE TABLE IF NOT EXISTS production_order_items (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER REFERENCES production_orders(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE SET NULL,
    planned_quantity DECIMAL(10,4) NOT NULL,
    actual_quantity DECIMAL(10,4),
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 14. FINISHED GOODS ----------
CREATE TABLE IF NOT EXISTS finished_goods (
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

-- ---------- 15. INVENTORY TRANSACTIONS ----------
CREATE TABLE IF NOT EXISTS inventory_transactions (
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

-- ---------- 16. JOURNAL ENTRIES ----------
CREATE TABLE IF NOT EXISTS journal_entries (
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

-- ---------- 17. JOURNAL ENTRY LINES ----------
CREATE TABLE IF NOT EXISTS journal_entry_lines (
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
