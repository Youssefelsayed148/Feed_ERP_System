-- Migration 006: Two-stage approval system
-- Adds stage column and updates status CHECK constraint

-- Step 1: Drop existing CHECK constraint
ALTER TABLE approval_requests DROP CONSTRAINT IF EXISTS approval_requests_status_check;

-- Step 2: Add stage column
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS stage VARCHAR(20) DEFAULT 'manager_review';

-- Step 3: Add new CHECK constraints
ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE approval_requests ADD CONSTRAINT approval_requests_stage_check 
  CHECK (stage IN ('manager_review', 'owner_review'));

-- Step 4: Add manager_id column to track who did manager approval
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS manager_notes TEXT;

-- Step 5: Index on stage for fast queue queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_stage ON approval_requests(stage);
CREATE INDEX IF NOT EXISTS idx_approval_requests_stage_status ON approval_requests(stage, status);