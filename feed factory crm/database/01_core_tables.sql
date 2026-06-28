-- FILE 01: CORE ERP TABLES
-- Run first. Creates foundational tables with no dependencies.
-- =====================================================

-- ---------- 1. COMPANIES ----------
CREATE TABLE IF NOT EXISTS companies (
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

-- ---------- 2. USERS ----------
CREATE TABLE IF NOT EXISTS users (
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

-- ---------- 3. EMPLOYEES ----------
CREATE TABLE IF NOT EXISTS employees (
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

-- ---------- 4. ACCOUNTS (Chart of Accounts) ----------
-- payroll.js hardcodes account_id=1 (Cash) and account_id=8 (Salaries Expense).
-- IDs must match exactly because payroll.js uses literal integers.
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    parent_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- 5. FEED TYPES ----------
CREATE TABLE IF NOT EXISTS feed_types (
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

-- ---------- 6. RAW MATERIALS ----------
CREATE TABLE IF NOT EXISTS raw_materials (
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

-- ---------- 7. SUPPLIERS ----------
CREATE TABLE IF NOT EXISTS suppliers (
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

-- ---------- 8. SUPPLIER MATERIALS ----------
CREATE TABLE IF NOT EXISTS supplier_materials (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    raw_material_id INTEGER REFERENCES raw_materials(id) ON DELETE CASCADE,
    is_preferred BOOLEAN DEFAULT false,
    unit_price NUMERIC(10,2),
    lead_time_days INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, raw_material_id)
);

-- ---------- 9. CLIENTS ----------
CREATE TABLE IF NOT EXISTS clients (
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

-- ---------- 10. MACHINES ----------
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

-- ---------- 11. VEHICLES ----------
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
