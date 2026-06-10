-- Al Kheir Feed Factory - PostgreSQL Database Schema
-- Created: March 31, 2026
-- Phase 1: Database Setup

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS production_order_items CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS feed_recipe_items CASCADE;
DROP TABLE IF EXISTS feed_recipes CASCADE;
DROP TABLE IF EXISTS feed_pricing CASCADE;
DROP TABLE IF EXISTS feed_types CASCADE;
DROP TABLE IF EXISTS raw_materials CASCADE;
DROP TABLE IF EXISTS client_payment_history CASCADE;
DROP TABLE IF EXISTS client_expected_payments CASCADE;
DROP TABLE IF EXISTS client_liabilities CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- ============================================
-- CORE TABLES
-- ============================================

-- 1. Feed Types (Product Catalog)
CREATE TABLE feed_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200) NOT NULL,
    protein_percentage VARCHAR(10),
    category VARCHAR(50) NOT NULL, -- poultry, cattle, etc.
    sub_category VARCHAR(50), -- starter, grower, finisher, layer_production, etc.
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Feed Pricing (by package size)
CREATE TABLE feed_pricing (
    id SERIAL PRIMARY KEY,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE CASCADE,
    package_size INTEGER NOT NULL CHECK (package_size IN (10, 25, 50)),
    unit VARCHAR(10) DEFAULT 'kg',
    cost_price DECIMAL(12,2) NOT NULL,
    selling_price_7 DECIMAL(12,2) NOT NULL, -- 7% margin
    selling_price_75 DECIMAL(12,2) NOT NULL, -- 7.5% margin
    selling_price_8 DECIMAL(12,2) NOT NULL, -- 8% margin
    max_price DECIMAL(12,2) NOT NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_type_id, package_size)
);

-- 3. Raw Materials (Ingredients)
CREATE TABLE raw_materials (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL, -- grain, protein, additive, enzyme, medication, packaging
    unit VARCHAR(20) DEFAULT 'kg',
    unit_price DECIMAL(10,2) NOT NULL,
    min_stock_level DECIMAL(10,2) DEFAULT 1000, -- minimum stock in kg
    reorder_level DECIMAL(10,2) DEFAULT 2000, -- reorder point in kg
    current_stock DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Feed Recipes (Recipe Header)
CREATE TABLE feed_recipes (
    id SERIAL PRIMARY KEY,
    feed_type_id INTEGER REFERENCES feed_types(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    name VARCHAR(200),
    total_quantity_kg DECIMAL(10,2) DEFAULT 1000, -- per 1000kg (1 ton)
    total_cost DECIMAL(12,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feed_type_id, version)
);

-- 5. Feed Recipe Items (Ingredients per Recipe)
CREATE TABLE feed_recipe_items (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER REFERENCES feed_recipes(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    quantity_kg DECIMAL(10,4) NOT NULL, -- quantity per 1000kg feed
    percentage DECIMAL(5,2), -- percentage of total
    unit_cost DECIMAL(10,2), -- cost at time of recipe creation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recipe_id, raw_material_id)
);

-- ============================================
-- CLIENT MANAGEMENT
-- ============================================

-- 6. Clients
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_arabic VARCHAR(200) NOT NULL,
    name_english VARCHAR(200),
    type VARCHAR(50) NOT NULL CHECK (type IN ('wholesale', 'retail', 'distributor', 'farm')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    payment_terms VARCHAR(50), -- 'cash', '7 days', '15 days', '30 days', '45 days'
    current_balance DECIMAL(12,2) DEFAULT 0,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Client Liabilities (Outstanding Balances)
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

-- 8. Client Expected Payments
CREATE TABLE client_expected_payments (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    expected_date DATE NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'overdue')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Client Payment History
CREATE TABLE client_payment_history (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    method VARCHAR(50) CHECK (method IN ('cash', 'bank_transfer', 'check', 'credit_card')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- SUPPLIERS & INVENTORY
-- ============================================

-- 10. Suppliers
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    materials_supplied TEXT[], -- array of material IDs or names
    payment_terms VARCHAR(50),
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Inventory Transactions (Stock Movements)
CREATE TABLE inventory_transactions (
    id SERIAL PRIMARY KEY,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'production', 'adjustment', 'return')),
    quantity DECIMAL(10,2) NOT NULL, -- positive for in, negative for out
    unit_price DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    reference_id INTEGER, -- reference to purchase order, production order, etc.
    reference_type VARCHAR(50), -- 'purchase_order', 'production_order', etc.
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PRODUCTION
-- ============================================

-- 12. Production Orders
CREATE TABLE production_orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    feed_type_id INTEGER REFERENCES feed_types(id),
    recipe_id INTEGER REFERENCES feed_recipes(id),
    quantity_kg DECIMAL(10,2) NOT NULL, -- total kg to produce
    batch_number VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed', 'cancelled')),
    production_date DATE,
    completion_date DATE,
    actual_cost DECIMAL(12,2),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Production Order Items (Materials Consumed)
CREATE TABLE production_order_items (
    id SERIAL PRIMARY KEY,
    production_order_id INTEGER REFERENCES production_orders(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id),
    planned_quantity DECIMAL(10,4) NOT NULL,
    actual_quantity DECIMAL(10,4),
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_feed_pricing_feed_type ON feed_pricing(feed_type_id);
CREATE INDEX idx_recipe_items_recipe ON feed_recipe_items(recipe_id);
CREATE INDEX idx_recipe_items_material ON feed_recipe_items(raw_material_id);
CREATE INDEX idx_clients_type ON clients(type);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_client_liabilities_client ON client_liabilities(client_id);
CREATE INDEX idx_client_liabilities_status ON client_liabilities(status);
CREATE INDEX idx_inventory_transactions_material ON inventory_transactions(raw_material_id);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(created_at);
CREATE INDEX idx_production_orders_status ON production_orders(status);
CREATE INDEX idx_production_orders_feed_type ON production_orders(feed_type_id);

-- ============================================
-- TRIGGER FOR UPDATING TIMESTAMPS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_feed_types_updated_at BEFORE UPDATE ON feed_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_pricing_updated_at BEFORE UPDATE ON feed_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_raw_materials_updated_at BEFORE UPDATE ON raw_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_recipes_updated_at BEFORE UPDATE ON feed_recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_production_orders_updated_at BEFORE UPDATE ON production_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schema creation complete
SELECT 'Schema created successfully' as status;
