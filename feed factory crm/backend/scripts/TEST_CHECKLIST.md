# Al-Khair CRM — Role-Based End-to-End Test Checklist

Run this after deploying the migration + corrected seed. Login with each
account below (password: `password123` for all). For each role, work
through its checklist top to bottom. Check ✅ only after confirming —
don't assume.

---

## How to read each test

- **Sidebar check** — confirm exactly the modules listed appear, and
  nothing else (no extra modules a role shouldn't see).
- **Direct URL check** — type the forbidden route straight into the
  address bar. It must redirect to `/dashboard`, not render the page.
  This is the part informal clicking-around won't catch.
- **Action check** — tied to a specific bug we fixed this session.

---

## 1. owner — m.abdelsamad@alkheirfeed.com

- [ ] Sidebar shows **all 23 modules** including Settings
- [ ] `/settings` → renders, all 6 tabs visible (no Approval Settings tab — removed)
- [ ] إدارة المستخدمين tab → can see, add, edit, deactivate any user
- [ ] Can approve/reject **any** pending request regardless of module (universal approver)
- [ ] UI is Arabic-only — no language toggle anywhere (Login screen or Settings)
- [ ] Numbers display as `1,234.00 EGP` — no `1.2K`/`1.5M` abbreviation anywhere

---

## 2. admin — a.mekawy@alkheirfeed.com or m.elshafei@alkheirfeed.com

- [ ] Sidebar shows all 23 modules, same as owner
- [ ] `/settings` → renders, can manage users
- [ ] Can approve/reject any pending request (universal approver, same as owner)

---

## 3. purchasing_mgr — m.salah@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Suppliers, Purchase Orders, GRN, Inventory, Feed Recipes — **and nothing else**
- [ ] Direct URL to `/hr/payroll` → redirects to dashboard
- [ ] Direct URL to `/settings` → redirects to dashboard
- [ ] Create a draft Purchase Order → appears correctly
- [ ] Click **Approve** on own/another draft PO → succeeds (was broken: `authorize()` array-vs-spread bug + wrong role name `purchase_officer`)
- [ ] Click **Reject** on a draft PO → succeeds (same bug, was missing `authenticate` entirely)
- [ ] Approval queue (`/api/approvals/pending`) shows only `purchase_orders` module requests, not other departments'

---

## 4. production_mgr — m.ibrahim@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Inventory, Feed Recipes, Production, Orders, Assets, Maintenance — **and nothing else**
- [ ] Direct URL to `/finance` → redirects to dashboard
- [ ] Create a production order → appears in list (was unauthenticated before — confirm it now requires login at minimum)
- [ ] Click **Approve** on a production order → succeeds (was wrong role name `production_manager`)
- [ ] Click **Start** on an approved production order → succeeds (same wrong-role-name bug)
- [ ] Click **Complete** on an in-progress order → succeeds (same bug)
- [ ] Click **Cancel** on a production order → succeeds (was missing role gate entirely)

---

## 5. production_asst — m.ibrahim2@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Production, Inventory, Feed Recipes — **and nothing else**
- [ ] Can create a production order
- [ ] **Cannot** approve/start/complete a production order (button should be hidden or backend 403 if forced)

---

## 6. sales_manager — m.elhetta@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Sales, Clients, Orders, Inventory, Receivables, Delivery — **and nothing else**
- [ ] Direct URL to `/hr` → redirects to dashboard
- [ ] Full Sales page view (Manager Dashboard, all clients, red flags) — not the Sales Rep limited view
- [ ] Approval queue shows only `sales_orders`/`clients` module requests

---

## 7. sales_rep — i.mostafa@alkheirfeed.com (or m.kamal / m.anani)

- [ ] Sidebar shows: Dashboard, Sales (rendered as **Sales Rep View**, not full Sales), Clients, Orders, Inventory — **and nothing else**
- [ ] `/sales` route shows limited "My Sales" view, not manager dashboard
- [ ] Direct URL to `/sales-rep` → renders correctly (their actual route)
- [ ] Direct URL to `/suppliers` → redirects to dashboard
- [ ] Direct URL to `/settings` → redirects to dashboard
- [ ] Cannot see other reps' orders/clients
- [ ] No approve/reject buttons visible anywhere

---

## 8. finance_manager — a.tawfik@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Finance, Receivables, Payables, Expenses, Accounting, Clients, Suppliers, Orders, Sales, Payroll — **and nothing else**
- [ ] **Payroll module — this is the big one, most fixes landed here:**
  - [ ] Create a payroll period → succeeds (was open to any authenticated user)
  - [ ] Click **Process** on a draft payroll → succeeds
  - [ ] Click **Approve** on a processed payroll → succeeds (was missing `authorize()` entirely)
  - [ ] Click **Post to Finance** → succeeds, creates Expense + Payable records (was missing `authorize()` entirely)
  - [ ] Payroll stat cards show correct counts including a **Posted** payroll (was showing 0 — `formatCurrency`/status-counter bug)
  - [ ] Click **Mark as Paid** → succeeds
  - [ ] Click **Delete** on a draft payroll → succeeds
- [ ] Create an expense → triggers an approval request correctly (was broken: `module` vs `module_name` column mismatch made expense approvals invisible to the queue)
- [ ] Approve own/another pending expense → succeeds
- [ ] Approval queue shows `expenses` AND `payroll` module requests together

---

## 9. accountant — h.mahmoud@alkheirfeed.com (Finance/HR dual)

- [ ] Sidebar shows: Payables, Receivables, Accounting, HR, Payroll — **and nothing else** (no Dashboard per doc — verify if this looks wrong, flag it)
- [ ] Can **view** payroll data (HR data assist) but **cannot** approve/post payroll
- [ ] `/hr/payroll` → renders, but Approve/Post buttons should be hidden or 403 if clicked

## 9b. accountant — a.salem@alkheirfeed.com (Sales/Receivables dual)

- [ ] Sidebar shows: Receivables, Clients, Orders, Sales, Accounting — **and nothing else**

---

## 10. cost_accountant — tbd@alkheirfeed.com

- [ ] Sidebar shows: Accounting, Production, Feed Recipes, Inventory — **and nothing else**
- [ ] No approval rights anywhere

---

## 11. maintenance_mgr — m.abdelhady@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Assets, Maintenance (both appear together — single `assets` permission), Production — **and nothing else**
- [ ] Can schedule maintenance, approve maintenance requests
- [ ] **Add Machine** → succeeds without crashing (was: NOT NULL constraint on `name_english`, camelCase/snake_case mismatch)
- [ ] **Add Vehicle** → succeeds without crashing (was: NOT NULL constraint on `plate_number`)
- [ ] Open "جدولة صيانة جديدة" from Maintenance tab directly (not via Assets tab first) → machine dropdown is populated, not empty (was: machines only loaded when Assets tab was active)

## 11b. maintenance_tech — m.abdelmoaty@alkheirfeed.com or s.abdullah@alkheirfeed.com

- [ ] Sidebar shows: Assets only
- [ ] Can create/update maintenance records, cannot approve

---

## 12. legal_mgr — m.ali@alkheirfeed.com

- [ ] Sidebar shows: Legal, Dashboard — **and nothing else**
- [ ] Can verify/reject legal documents
- [ ] Click **Sign** on a contract → succeeds (was wrong role name `manager` — fixed to `legal_mgr`)

## 12b. legal_officer — a.mohamed@alkheirfeed.com or h.abdullah@alkheirfeed.com

- [ ] Sidebar shows: Legal only
- [ ] Can create/update documents, cannot verify/approve

---

## 13. logistics_coordinator — m.geilan@alkheirfeed.com

- [ ] Sidebar shows: Dashboard, Delivery — **and nothing else**
- [ ] Delivery page shows **Foreman/Supervisor view** — assign deliveries, manage vehicles
- [ ] Vehicles tab loads correctly (was: `/vehicles` and `/vehicles/stats` shadowed by `/:id` route — 404'd before fix)
- [ ] `/delivery/drivers/available` populates correctly when assigning (was: route didn't exist at all)

---

## 14. driver — a.ahmed@alkheirfeed.com (or r.abdelmajid / m.mohamed / a.hasabou / m.hassan)

- [ ] Sidebar shows: Delivery only
- [ ] Delivery page shows **Driver view** — only their own assigned deliveries
- [ ] Cannot see other drivers' deliveries or assign anything

---

## Cross-cutting checks (any role)

- [ ] **No raw translation keys visible anywhere** (e.g. `HR.EMPLOYEEPAYROLLS`, `settings.2faDesc`, `payroll.totalNet`) — confirm in Arabic mode specifically, since `en`/`ar` blocks were previously 96% duplicated and ~86 keys never had real Arabic
- [ ] **No English-only UI chrome** — buttons, labels, stat cards, empty states all in Arabic (spot-check Assets, Delivery, Payroll, Settings tabs especially — these had the most English-only entries)
- [ ] **Login screen has no language toggle** (removed)
- [ ] **Settings has no language toggle, no Approval Settings tab** (both removed)
- [ ] **All currency displays show full numbers** — `1,234,567.00 EGP`, never `1.2M` or `15K`
- [ ] Attempt self-registration via any exposed signup flow (if one exists in the UI) — confirm it does **not** allow selecting a role; new accounts always come in as `sales_rep` regardless of what's submitted (was: arbitrary role from request body — anyone could create an `owner` account)
- [ ] As a non-admin role, attempt to hit `POST /api/users` directly (e.g. via browser devtools) → should 403 (admin/owner only)

---

## If anything fails

Note: (1) the role you were logged in as, (2) the exact action/URL,
(3) what happened vs. what should have happened per this checklist.
That's enough for a quick fix — no need to re-diagnose from scratch.
