-- ============================================================
-- BACKFILL: Create journal entries for already-approved GRNs
-- and supplier payments that were missed due to the entry_date bug.
-- Run once in pgAdmin. Safe to run — checks for duplicates first.
-- ============================================================

-- 1. Insert journal entries for approved GRNs (via their supplier_payables)
-- Dr مخزون مواد خام (3), Cr حسابات الدفع (5)
INSERT INTO journal_entries (entry_number, date, description, reference_id, reference_type, total_amount, created_by)
SELECT
  'JE-BACKFILL-' || sp.id,
  COALESCE(sp.created_at::date, CURRENT_DATE),
  'شراء مواد خام - ' || COALESCE(s.name, 'مورد') || ' (استرجاع)',
  sp.id,
  'payable',
  sp.amount,
  1
FROM supplier_payables sp
LEFT JOIN suppliers s ON sp.supplier_id = s.id
WHERE sp.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'payable' AND je.reference_id = sp.id
  );

-- 2. Insert journal lines for the entries just created
INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
SELECT je.id, 3, je.total_amount, 0, 'مخزون مواد خام مشتراة', 1
FROM journal_entries je
WHERE je.reference_type = 'payable'
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id
  );

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
SELECT je.id, 5, 0, je.total_amount, 'حسابات الدفع للمورد', 2
FROM journal_entries je
WHERE je.reference_type = 'payable'
  AND (SELECT COUNT(*) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) = 1;

-- 3. Insert journal entries for approved sales invoices
-- Dr حسابات القبض (2), Cr إيرادات المبيعات (7)
INSERT INTO journal_entries (entry_number, date, description, reference_id, reference_type, total_amount, created_by)
SELECT
  'JE-BACKFILL-INV-' || inv.id,
  COALESCE(inv.created_at::date, CURRENT_DATE),
  'فاتورة مبيعات ' || inv.invoice_number || ' (استرجاع)',
  inv.id,
  'invoice',
  inv.amount,
  1
FROM invoices inv
WHERE inv.amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE je.reference_type = 'invoice' AND je.reference_id = inv.id
  );

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
SELECT je.id, 2, je.total_amount, 0, 'حسابات القبض من المبيعات', 1
FROM journal_entries je
WHERE je.reference_type = 'invoice'
  AND NOT EXISTS (SELECT 1 FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id);

INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
SELECT je.id, 7, 0, je.total_amount, 'إيرادات المبيعات', 2
FROM journal_entries je
WHERE je.reference_type = 'invoice'
  AND (SELECT COUNT(*) FROM journal_entry_lines jel WHERE jel.journal_entry_id = je.id) = 1;

-- 4. Verify results
SELECT reference_type, COUNT(*) as entries_created, SUM(total_amount) as total_value
FROM journal_entries
GROUP BY reference_type
ORDER BY reference_type;