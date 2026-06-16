# Al-Khair Feed Factory CRM — Final Documentation

## System Overview
- **Backend:** Express.js + PostgreSQL (72 tables)
- **Frontend:** React (CRA) served from `frontend/build/`
- **i18n:** 81 keys balanced (EN/AR)
- **Servers:** Frontend `:3000`, Backend `:5000`

## Running Servers
```bash
# Backend
cd ~/Desktop/factory\ crm/feed-factory-crm-20260421-fixed/feed\ factory\ crm/backend
node server.js

# Frontend (build + serve)
cd ~/Desktop/factory\ crm/feed-factory-crm-20260421-fixed/feed\ factory\ crm/frontend
npm run build
node server.js
```

## Module Status

| # | Module | Route | Status | Key Data |
|---|--------|-------|:------:|----------|
| 1 | Dashboard | `/dashboard` | ✅ | 13 clients, 17 orders, ج.م 174K expenses, daily orders, credit clients |
| 2 | Sales | `/sales` | ✅ | 16 orders, ج.م 10.7M revenue, quick actions, alerts |
| 3 | Clients | `/clients` | ✅ | 13 clients, CRUD, credit limits, categories |
| 4 | Orders | `/orders` | ✅ | 17 orders, create invoice, payment tracking |
| 5 | Suppliers | `/suppliers` | ✅ | 10 suppliers, ج.م 999K spend, action buttons bilingual |
| 6 | Purchase Orders | `/purchase-orders` | ✅ | 6 POs, auto-pricing, WhatsApp, PDF bilingual, approval |
| 7 | GRN | `/grn` | ✅ | Receipt notes, quantity tracking, approved/rejected |
| 8 | Inventory | `/inventory` | ✅ | 25 materials, categories bilingual, row click → movements |
| 9 | Feed Recipes | `/feed-recipes` | ✅ | 16 recipes, ingredient tracking |
| 10 | Production | `/production` | ✅ | Production orders, auto from sales, finished goods |
| 11 | Finance | `/finance` | ✅ | Invoices, payables, expenses, overview |
| 12 | Payables | `/finance/payables` | ✅ | Supplier payments |
| 13 | Payments | `/finance/payments` | ✅ | Payment records |
| 14 | Expenses | `/finance/expenses` | ✅ | 8 expenses, 10 categories bilingual, approve/reject |
| 15 | Accountant | `/finance/accountant` | ✅ | Ledger, journal entries |
| 16 | Legal | `/legal` | ✅ | 13 documents, verify/reject workflow |
| 17 | Assets | `/assets` | ✅ | 8 machines, types/statuses translated, maintenance |
| 18 | Maintenance | `/maintenance-reminders` | ✅ | Reminders, scheduling |
| 19 | HR | `/hr` | ✅ | 22 employees, positions Arabic, attendance |
| 20 | Payroll | `/hr/payroll` | ✅ | 2 periods, auto-creation from attendance |
| 21 | Delivery | `/delivery` | ✅ | 4 vehicles, driver/supervisor views |
| 22 | Settings | `/settings` | ✅ | 9 tabs bilingual, approval toggles |

## Key Workflows

### Order → Production → Delivery
```
Sales Order (approved) 
  → Auto-creates Production Order (draft)
  → Auto-creates Invoice
Production Order (completed) 
  → Auto-deducts raw materials
  → Adds to finished goods
  → Auto-creates Delivery Assignment
Delivery (assigned) 
  → Driver accepts
  → Picks up → In-transit → Arrives → Confirms
  → OTP verification, photo, signature
```

### Purchase Order Flow
```
Supplier selected → Material auto-prices from supplier price
Items editable (quantity, unit price auto-calculates)
WhatsApp share ✓
PDF download (bilingual - EN/AR) ✓
Submit for approval → Approve → GRN
```

### Approval System
- 6 modules toggleable: Sales, PO, Payroll, Expenses, Production, Inventory
- Approval requests created on submit
- Owner/manager approves/rejects
- Activity logged

## Known Issues
1. `title="{t('...')}"` pattern fixed system-wide (23 files) — buttons now show translated text
2. GRN column name mismatch fixed — quantities now save/display correctly
3. Inventory click → movements modal added
4. Inventory status "normal" now translated via `getStockStatusLabel()`
5. Inventory categories mapped via `getCategoryLabel()`
6. All console errors resolved (0 across all modules)
7. PO PDF now bilingual via `${t('...')}` calls

## Credentials
- **Login:** owner@al-kheir.com / password123
- **Database:** PostgreSQL `al_kheir_feed_factory`
- **VPS:** SSH u981100778@45.84.204.152:65002

## Project Path
`~/Desktop/factory crm/feed-factory-crm-20260421-fixed/feed factory crm/`
