-- ============================================================
-- EMERGENCY FIX: Update all user password hashes to valid bcrypt
-- Run this against an existing database where login fails with
-- "Invalid credentials" due to placeholder or invalid hashes.
-- ============================================================

-- Step 1: Show current hashes that are broken
SELECT id, email, LEFT(password_hash, 30) as hash_preview, LENGTH(password_hash) as hash_len
FROM users
WHERE password_hash NOT LIKE '$2a$%' 
   AND password_hash NOT LIKE '$2b$%'
   AND password_hash NOT LIKE '$2y$%'
   OR LENGTH(password_hash) < 50;

-- Step 2: Fix ALL users to use the verified bcrypt hash of "password123"
-- This hash was generated with bcryptjs (cost 12) and verified:
-- $2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O
UPDATE users
SET password_hash = '$2a$12$5kJU6SWAksRW7w.Nd67t6.h0WC.bQ2BGNJEQQZQxz/6klI.rwpm4O'
WHERE password_hash NOT LIKE '$2a$%'
   AND password_hash NOT LIKE '$2b$%'
   AND password_hash NOT LIKE '$2y$%'
   OR LENGTH(password_hash) < 50;

-- Step 3: Verify fix
SELECT id, email, LEFT(password_hash, 30) as hash_preview, LENGTH(password_hash) as hash_len
FROM users;
