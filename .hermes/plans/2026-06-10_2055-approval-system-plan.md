# CRM Enhancement Plan — One By One

## Phase 1: Approval System Foundation (DB + Backend)
- Create `approval_settings` table (module_name, requires_approval boolean)
- Create `approval_requests` table (id, module, request_type, request_id, requester_id, status, created_at)
- Backend API: GET/PUT /api/settings/approvals
- Backend API: POST/GET /api/approvals

## Phase 2: Owner Settings UI
- Settings page: approval toggles per module (toggle on/off)
- Default: ALL modules require approval
- Owner can disable per module

## Phase 3: Approval Workflow in Modules
- Sales orders: pending_approval → approved/rejected flow
- Purchase orders: pending_approval → approved/rejected
- Payroll: HR creates → pending_approval → owner approves

## Phase 4: Notifications + Dashboard
- Pending approvals in sidebar bell
- Dashboard widget: pending approvals count
- Owner activity tracking panel (last actions by each user)

## Phase 5: New Roles
- Add to DB: customer_accountant, cashier, logistics_coordinator, purchasing_coordinator, quality_assistant
- Manager can create users with these roles

## Phase 6: Payroll Auto-Creation
- Monthly auto-generation from employee attendance

## Phase 7: Owner Activity Dashboard
- Real-time tracking panel
- Last action per user
- Module-wise activity feed
