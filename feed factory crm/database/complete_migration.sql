-- Al Kheir Feed Factory - Complete Database Migration
-- Run this file to execute all migrations in order
-- Command: psql -U postgres -d al_kheir_feed_factory -f complete_migration.sql

\echo 'Starting Al Kheir Feed Factory Database Migration...'
\echo '=============================================='

-- Step 1: Create Schema
\echo 'Step 1: Creating database schema...'
\i schema.sql

-- Step 2: Insert Feed Types, Pricing, and Raw Materials
\echo 'Step 2: Inserting feed types, pricing, and raw materials...'
\i 01_seed_data.sql

-- Step 3: Insert Recipes Part 1 (Recipes 1-8)
\echo 'Step 3: Inserting recipes 1-8 with ingredients...'
\i 02_recipes_part1.sql

-- Step 4: Insert Recipes Part 2 (Recipes 9-16)
\echo 'Step 4: Inserting recipes 9-16 with ingredients...'
\i 03_recipes_part2.sql

-- Step 5: Insert Clients and Suppliers
\echo 'Step 5: Inserting clients, suppliers, and financial data...'
\i 04_clients_suppliers.sql

\echo '=============================================='
\echo 'Migration completed successfully!'
\echo ''
\echo 'Database Summary:'
\echo '- Feed Types: 16'
\echo '- Pricing Records: 48 (16 types x 3 sizes)'
\echo '- Raw Materials: 25 ingredients'
\echo '- Recipes: 16 complete recipes'
\echo '- Recipe Items: 400+ ingredient combinations'
\echo '- Clients: 10 (4 original + 6 additional)'
\echo '- Suppliers: 8'
\echo ''
\echo 'Verification Queries:'

SELECT 'Feed Types' as table_name, COUNT(*) as count FROM feed_types
UNION ALL
SELECT 'Feed Pricing', COUNT(*) FROM feed_pricing
UNION ALL
SELECT 'Raw Materials', COUNT(*) FROM raw_materials
UNION ALL
SELECT 'Recipes', COUNT(*) FROM feed_recipes
UNION ALL
SELECT 'Recipe Items', COUNT(*) FROM feed_recipe_items
UNION ALL
SELECT 'Clients', COUNT(*) FROM clients
UNION ALL
SELECT 'Client Liabilities', COUNT(*) FROM client_liabilities
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers;

\echo ''
\echo 'Database is ready for use!'
