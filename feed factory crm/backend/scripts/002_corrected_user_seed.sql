-- =====================================================================
-- Corrected user seed — Al-Khair Feed Factory CRM
-- Source: Employee Access & Permissions doc v2.0 (Section B + D)
-- =====================================================================
-- PREREQUISITE: run 001_fix_users_roles_and_permissions.sql FIRST.
-- This will fail with a constraint violation otherwise.
--
-- Password for all users below: password123
-- bcrypt hash (reused from existing system convention):
--   $2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O
--
-- NOTE: the access doc (Section D.4) recommends a separate initial
-- password "changeme123" with forced reset on first login for new
-- hires. This seed uses password123 for all 26 to match the existing
-- owner/admin convention already in use. Swap the hash below if you
-- want changeme123 instead — just generate a new bcrypt hash for it.
--
-- Run from Windows PowerShell against al_kheir_feed_factory (Postgres
-- runs on Windows, not WSL).
-- =====================================================================

INSERT INTO users (email, password_hash, name, role, phone, department, module_permissions, is_active) VALUES

-- ===== 1. General Management =====
('m.abdelsamad@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mamdouh Mohamed Abdelsamad', 'owner', NULL, 'General Management', '{}', true),
('a.mekawy@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Abdelrahman Mamdouh Mekawy', 'admin', NULL, 'General Management', '{}', true),

-- ===== 2. Purchasing Department =====
('m.salah@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Salah El-Din Abdelrahman', 'purchasing_mgr', NULL, 'Purchasing', ARRAY['dashboard','suppliers','purchase_orders','grn','inventory','feed_recipes'], true),

-- ===== 3. Production Department =====
('m.ibrahim@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Abdullah Mahmoud Ibrahim', 'production_mgr', NULL, 'Production', ARRAY['dashboard','inventory','feed_recipes','production','orders','assets'], true),
('m.ibrahim2@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mahmoud Ibrahim Mohamed Ibrahim', 'production_asst', NULL, 'Production', ARRAY['dashboard','production','inventory','feed_recipes'], true),

-- ===== 4. Inventory (dual role — same person as Purchasing Mgr m.salah, see note in doc) =====
-- Skipped as a separate user: this is the SAME login as m.salah@alkheirfeed.com above
-- (dual role, doc explicitly notes "same person as #3"). Do not insert twice.

-- ===== 5. Sales Department =====
('m.elhetta@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mahmoud Adel Mahmoud El-Hetta', 'sales_manager', NULL, 'Sales', ARRAY['dashboard','sales','clients','orders','inventory','receivables','delivery'], true),
('i.mostafa@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ibrahim Shaaban Mostafa', 'sales_rep', NULL, 'Sales', ARRAY['dashboard','sales','clients','orders','inventory'], true),
('m.kamal@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Moaz Mostafa Kamal', 'sales_rep', NULL, 'Sales', ARRAY['dashboard','sales','clients','orders','inventory'], true),
('m.anani@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mahmoud Abdelrahman Anani', 'sales_rep', NULL, 'Sales', ARRAY['dashboard','sales','clients','orders','inventory'], true),

-- ===== Delivery Driver (Sales-adjacent in doc ordering) =====
('a.ahmed@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ashraf Mohamed Ahmed', 'driver', NULL, 'Logistics', ARRAY['delivery'], true),

-- ===== 6. Finance Department =====
('a.tawfik@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ahmed Mamdouh Abdelmoneim Tawfik', 'finance_manager', NULL, 'Finance', ARRAY['dashboard','finance','receivables','payables','expenses','accounting','clients','suppliers','orders','sales','payroll'], true),
('h.mahmoud@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Hani Ezzat Mohamed Mahmoud', 'accountant', NULL, 'Finance/HR', ARRAY['dashboard','payables','receivables','accounting','hr','payroll'], true),
('a.salem@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ahmed Hamdy Mohamed Salem', 'accountant', NULL, 'Finance', ARRAY['receivables','clients','orders','sales','accounting'], true),
-- Cost Accountant — to be assigned per doc, seeded as placeholder so the role exists for testing
('tbd@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Cost Accountant (TBD)', 'cost_accountant', NULL, 'Finance', ARRAY['accounting','production','feed_recipes','inventory'], true),

-- ===== 7. Maintenance Department =====
('m.abdelhady@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Abdelmoneim Abdelhady', 'maintenance_mgr', NULL, 'Maintenance', ARRAY['dashboard','assets','production'], true),
('m.abdelmoaty@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mostafa Mahmoud Abdelmoaty', 'maintenance_tech', NULL, 'Maintenance', ARRAY['assets'], true),
('s.abdullah@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Sherif Mohamed Abdullah', 'maintenance_tech', NULL, 'Maintenance', ARRAY['assets'], true),

-- ===== 8. Legal Department =====
('m.ali@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Gamal El-Sayed Ali', 'legal_mgr', NULL, 'Legal', ARRAY['legal','dashboard'], true),
('a.mohamed@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ahmed Abdullah Mohamed', 'legal_officer', NULL, 'Legal', ARRAY['legal'], true),
('h.abdullah@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Hassan Abdelftah Mohamed Abdullah', 'legal_officer', NULL, 'Legal', ARRAY['legal'], true),

-- ===== 9. IT / Admin =====
('m.elshafei@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Ahmed Mohamed Youssef El-Shafei', 'admin', NULL, 'Information Technology', '{}', true),

-- ===== 10. Delivery Foreman / Logistics =====
('m.geilan@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Geilan', 'logistics_coordinator', NULL, 'Logistics', ARRAY['dashboard','delivery'], true),
('r.abdelmajid@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Ramadan Ahmed Abdelhady Abdelmajid', 'driver', NULL, 'Logistics', ARRAY['delivery'], true),
('m.mohamed@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Moataz El-Sayed Hassan Mohamed', 'driver', NULL, 'Logistics', ARRAY['delivery'], true),
('a.hasabou@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Abdelrahman El-Sayed Ali Hasabou', 'driver', NULL, 'Logistics', ARRAY['delivery'], true),
('m.hassan@alkheirfeed.com', '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O', 'Mohamed Saeed Eid Ali Hassan', 'driver', NULL, 'Logistics', ARRAY['delivery'], true)

ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  module_permissions = EXCLUDED.module_permissions,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================================
-- Total: 26 distinct logins covering all named employees in the doc.
-- The m.salah@alkheirfeed.com row above already includes the combined
-- permission set for both Purchasing Manager and Inventory Manager
-- duties (doc explicitly notes this is one person, dual role — see
-- Section B.4, "same person as #3"). No separate row was created for
-- the Inventory department listing to avoid a duplicate/conflicting
-- login for the same human.
--
-- NOT included from the old 07_seed_data.sql (these were generic
-- placeholder logins, not real employees — remove them if present):
--   admin@al-kheir.com, sales.manager@al-kheir.com, sales.rep1/2@...,
--   production.manager@..., finance.manager@..., purchase.officer@...,
--   hr.manager@... (invalid role), warehouse.manager@... (invalid role),
--   quality.assistant@... (invalid role)
--
-- The original owner@al-kheir.com login is superseded by
-- m.abdelsamad@alkheirfeed.com above (same role, real name, per doc).
-- If you want to KEEP owner@al-kheir.com as a working login too (e.g.
-- because existing bookmarks/tests use it), leave the old seed's owner
-- row in place — it won't conflict since it's a different email.
-- =====================================================================
