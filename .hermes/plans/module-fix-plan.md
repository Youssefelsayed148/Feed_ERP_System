# CRM Module Fix Plan

## Issues Found

### 1. Legal Module — NOT FUNCTIONAL
- legal_documents table has 0 records → no data shows
- Missing i18n keys (subtitle, search, "Onboarding" has English)
- "عملية Onboarding" mixed language
- User says "cannot review any client"

### 2. Assets Module — English DB Data
- Machine types: Mixer, Grinder, Pelletizer, Cooler, etc. → English
- Machine statuses: operational, maintenance → English
- Machine locations: Production Hall A/B → English
- Need getMachineTypeLabel(), getStatusLabel() mappings

### 3. Maintenance Module — Route Mismatch
- Route is /maintenance-reminders not /maintenance
- No data in maintenance_schedules table

### 4. Payroll Module — English UI
- Works at /hr/payroll with real data (2 periods, 14 employees)
- But all UI is English: "Create Payroll", "View", "Approve All", "Post to Finance"
- Missing payroll i18n keys
