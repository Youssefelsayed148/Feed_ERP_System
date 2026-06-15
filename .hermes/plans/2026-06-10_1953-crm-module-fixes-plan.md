# CRM Module Fixes Plan

> Goal: Fix Legal tabs, Assets English, HR/Payroll, Delivery module, Employee/Payroll system.

## Module 1: Legal — English Tabs
- Scan Legal.js for English tab labels
- Add i18n keys for tabs
- Fix any hardcoded English text

## Module 2: Assets — English Text
- Scan Assets.js for hardcoded English
- Fix buttons, labels, tooltips

## Module 3: HR + Payroll — Fix Issues
- Scan HR.js for payroll tab issues (crash? missing data?)
- Fix payroll calculation/display
- Add payroll i18n keys if missing

## Module 4: Delivery — Rebuild/Repair
- Inspect Delivery.js for what's "ruined"
- Fix all hardcoded English, broken logic, missing t() calls

## Module 5: Employee Files + Doc Storage
- Add document storage location field (shelf/cabinet) for employees & clients
- HR employee management enhancement

## Module 6: Rebuild & Verify
- Build frontend
- Restart server
- Verify all fixes
