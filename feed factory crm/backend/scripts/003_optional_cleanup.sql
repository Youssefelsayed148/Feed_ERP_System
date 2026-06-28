-- =====================================================================
-- Optional cleanup — Al-Khair Feed Factory CRM
-- =====================================================================
-- Run this AFTER 001 and 002, only if you want to remove the generic
-- placeholder users from the old 07_seed_data.sql (e.g.
-- "Sales Representative 1", "Production Manager") now that the real
-- named employees from the access doc are seeded instead.
--
-- SAFE TO SKIP if you'd rather keep both sets of logins around for now
-- — they won't conflict with each other (different emails).
-- =====================================================================

-- Remove the old generic placeholder accounts (NOT owner@al-kheir.com —
-- keep that one if you still use it for quick testing; it has the
-- correct 'owner' role already, just a generic name).
DELETE FROM users WHERE email IN (
  'admin@al-kheir.com',
  'sales.manager@al-kheir.com',
  'sales.rep1@al-kheir.com',
  'sales.rep2@al-kheir.com',
  'production.manager@al-kheir.com',
  'finance.manager@al-kheir.com',
  'purchase.officer@al-kheir.com',
  'hr.manager@al-kheir.com',
  'warehouse.manager@al-kheir.com',
  'quality.assistant@al-kheir.com'
);

-- The approval_settings table backed the old per-module ON/OFF toggle
-- (System 1), which has been removed from the application entirely —
-- approvals are now fully role-based (System 2). Nothing in the code
-- reads this table anymore. Safe to drop its seed data or the table
-- itself.
DELETE FROM approval_settings;
-- Uncomment to drop the table entirely if nothing else references it:
-- DROP TABLE IF EXISTS approval_settings;
