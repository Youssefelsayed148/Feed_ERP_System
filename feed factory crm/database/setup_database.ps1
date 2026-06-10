-- Al Kheir Feed Factory - Database Setup for Windows PowerShell
-- Run these commands in PowerShell to set up the database

# Step 1: Create the database
Write-Host "Creating database 'al_kheir_feed_factory'..." -ForegroundColor Green
$env:PGPASSWORD = "Theosirislabs1$"
& psql -U postgres -c "CREATE DATABASE al_kheir_feed_factory;" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database created successfully!" -ForegroundColor Green
} else {
    Write-Host "Database may already exist or there was an error. Continuing..." -ForegroundColor Yellow
}

# Step 2: Change to database directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

Write-Host "`nRunning database migrations..." -ForegroundColor Green

# Step 3: Run schema
Write-Host "Step 1/5: Creating schema..." -ForegroundColor Cyan
& psql -U postgres -d al_kheir_feed_factory -f "schema.sql" -q
if ($LASTEXITCODE -ne 0) { Write-Host "Error in schema.sql" -ForegroundColor Red; exit 1 }

# Step 4: Run seed data
Write-Host "Step 2/5: Inserting feed types and raw materials..." -ForegroundColor Cyan
& psql -U postgres -d al_kheir_feed_factory -f "01_seed_data.sql" -q
if ($LASTEXITCODE -ne 0) { Write-Host "Error in 01_seed_data.sql" -ForegroundColor Red; exit 1 }

# Step 5: Run recipes part 1
Write-Host "Step 3/5: Inserting recipes 1-8..." -ForegroundColor Cyan
& psql -U postgres -d al_kheir_feed_factory -f "02_recipes_part1.sql" -q
if ($LASTEXITCODE -ne 0) { Write-Host "Error in 02_recipes_part1.sql" -ForegroundColor Red; exit 1 }

# Step 6: Run recipes part 2
Write-Host "Step 4/5: Inserting recipes 9-16..." -ForegroundColor Cyan
& psql -U postgres -d al_kheir_feed_factory -f "03_recipes_part2.sql" -q
if ($LASTEXITCODE -ne 0) { Write-Host "Error in 03_recipes_part2.sql" -ForegroundColor Red; exit 1 }

# Step 7: Run clients and suppliers
Write-Host "Step 5/5: Inserting clients and suppliers..." -ForegroundColor Cyan
& psql -U postgres -d al_kheir_feed_factory -f "04_clients_suppliers.sql" -q
if ($LASTEXITCODE -ne 0) { Write-Host "Error in 04_clients_suppliers.sql" -ForegroundColor Red; exit 1 }

# Step 8: Verify installation
Write-Host "`nVerifying installation..." -ForegroundColor Green
& psql -U postgres -d al_kheir_feed_factory -c "
SELECT 'Feed Types' as table_name, COUNT(*) as count FROM feed_types
UNION ALL SELECT 'Feed Pricing', COUNT(*) FROM feed_pricing
UNION ALL SELECT 'Raw Materials', COUNT(*) FROM raw_materials
UNION ALL SELECT 'Recipes', COUNT(*) FROM feed_recipes
UNION ALL SELECT 'Recipe Items', COUNT(*) FROM feed_recipe_items
UNION ALL SELECT 'Clients', COUNT(*) FROM clients
UNION ALL SELECT 'Client Liabilities', COUNT(*) FROM client_liabilities
UNION ALL SELECT 'Suppliers', COUNT(*) FROM suppliers;
"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Database setup completed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Database: al_kheir_feed_factory" -ForegroundColor White
Write-Host "User: postgres" -ForegroundColor White
Write-Host "Password: [hidden]" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green

# Clear password from environment
$env:PGPASSWORD = ""
