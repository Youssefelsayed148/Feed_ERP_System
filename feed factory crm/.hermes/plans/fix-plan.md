# Al-Khair Factory CRM - Finalization Fix Plan

## Current State Analysis

### Issues Found:

**1. i18n.js EN section has Arabic values** (Critical)
- Both `en` and `ar` sections contain Arabic text
- Switching to English mode still shows Arabic — no proper English translations exist

**2. Hardcoded English strings in pages** (High - shows English when it shouldn't)
- **Inventory.js**: "Unit Cost (EGP per kg) *", "Add Stock", "Transfer Stock", "Quantity *", "Unit *", "kg"/"ton" options, "Stock added successfully!", "Adding Stock...", "Transferring...", "No finished goods in inventory", "Package" header, "Output" header, EGP formatting
- **Finance.js**: "Search invoices...", "Paid"/"Overdue" status labels, "days" in aging, "Payment recorded successfully"
- **FeedRecipes.js**: Bilingual labels "Recipe Name / اسم الوصفة", "Feed Type / نوع العلف", "Used X times", "Loading recipes..."
- **Clients.js**: "Total Payment:" label
- **Other pages**: Various English alerts and placeholders

**3. Finance module navigation** 
- `/finance` route correctly opens Finance component with 'dashboard' tab
- Sidebar has separate `/finance/receivables` item which opens same component but forces 'receivables' tab

**4. "name.cat" / raw key display** 
- Some API data fields display raw values instead of translated labels (category names)

---

## Fix Plan (Phased)

### Phase 1: Fix hardcoded English in Inventory.js
- Replace English labels/headers/buttons with t() calls
- Add any missing i18n keys
- Fix EGP formatting to use formatCurrency()

### Phase 2: Fix hardcoded English in Finance.js
- Replace English status labels with t() calls
- Fix search placeholders
- Fix alert messages

### Phase 3: Fix hardcoded English in FeedRecipes.js
- Replace bilingual labels with t() calls
- Fix "Used X times" text
- Fix loading text

### Phase 4: Fix remaining English in other pages
- Clients.js, Delivery.js, Expenses.js, etc.

### Phase 5: Rebuild & verify
- npm run build
- Start frontend on :3000
- Browser test all modules
