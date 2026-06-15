# CRM Bilingual Enhancement Plan

> **Goal:** Make the Desktop/factory-crm CRM fully bilingual (English + Arabic) with working language switching, all `EGP` → `formatCurrency()`, and all missing i18n keys added.

**Current state:**
- **Foundation done** ✅ — i18n exports (setLang/isRTL), index.js init, Layout.js, Login lang toggle, Settings lang toggle
- **Sidebar done** ✅ — notification strings translated
- **Dashboard done** ✅ — reviewed, good t() coverage
- **Remaining:** 70+ EGP instances across 12 pages, 4 pages missing formatCurrency import, ~60 missing i18n keys

---

## Task 1: Add `formatCurrency` to pages missing it

**Files:** `Accountant.js`, `Clients.js`, `GRN.js`, `Legal.js`, `Suppliers.js`

Add `import { formatCurrency } from '../utils/formatters';` to each file.

## Task 2: Fix EGP → formatCurrency() — Part 1 (Sales/Client modules)

**Files:** `Clients.js` (9 EGP), `SalesRep.js` (2 EGP), `Suppliers.js` (6 EGP)

Replace hardcoded `EGP ${...}` with `formatCurrency(...)`.

## Task 3: Fix EGP → formatCurrency() — Part 2 (Finance modules)

**Files:** `Finance.js` (18 EGP), `Payables.js` (3 EGP), `Expenses.js` (1 EGP)

Replace hardcoded `EGP ${...}` with `formatCurrency(...)`.

## Task 4: Fix EGP → formatCurrency() — Part 3 (Operations modules)

**Files:** `Inventory.js` (7 EGP), `PurchaseOrders.js` (8 EGP), `Assets.js` (2 EGP), `MaintenanceReminders.js` (1 EGP), `HR.js` (3 EGP), `Settings.js` (7 EGP)

Replace hardcoded `EGP ${...}` with `formatCurrency(...)`.

## Task 5: Add missing i18n keys

**Files:** `i18n.js`

Add ~60 keys that are referenced in page `t()` calls but not defined in translations. Scan each page file for `t('...')` patterns and cross-reference with i18n.js.

## Task 6: Rebuild & verify

Rebuild frontend, restart server, verify all pages load without errors.
