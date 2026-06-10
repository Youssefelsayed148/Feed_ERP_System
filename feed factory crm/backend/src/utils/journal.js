const { query } = require('../config/database');

// Auto-generate journal entries from business transactions

async function generateJournalEntry({ date, description, referenceId, referenceType, totalAmount, lines, createdBy = 1 }) {
  try {
    // Generate entry number
    const entryNumResult = await query(
      "SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(entry_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 as next_num FROM journal_entries"
    );
    const entryNumber = 'JE-' + String(entryNumResult.rows[0].next_num).padStart(5, '0');

    // Create journal entry
    const entryResult = await query(
      `INSERT INTO journal_entries (entry_number, entry_date, date, description, reference_id, reference_type, total_amount, created_by)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [entryNumber, date, description, referenceId, referenceType, totalAmount, createdBy]
    );
    const entryId = entryResult.rows[0].id;

    // Create journal lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      await query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, line_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [entryId, line.accountId, line.debit || 0, line.credit || 0, line.description, i + 1]
      );
    }

    console.log(`[JOURNAL] Created ${entryNumber} for ${referenceType} #${referenceId}: ${description}`);
    return { entryId, entryNumber };
  } catch (error) {
    console.error('[JOURNAL] Failed to create entry:', error.message);
    return null;
  }
}

// Invoice created: Dr Accounts Receivable, Cr Sales Revenue
async function journalInvoiceCreated(invoice) {
  return generateJournalEntry({
    date: invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    description: `Sales Invoice ${invoice.invoice_number} - Client: ${invoice.client_name || ''}`,
    referenceId: invoice.id,
    referenceType: 'invoice',
    totalAmount: invoice.amount,
    lines: [
      { accountId: 2, debit: invoice.amount, credit: 0, description: 'Accounts Receivable from sale' },
      { accountId: 6, debit: 0, credit: invoice.amount, description: 'Sales Revenue' }
    ]
  });
}

// Payment received: Dr Cash, Cr Accounts Receivable
async function journalPaymentReceived(payment, clientName) {
  return generateJournalEntry({
    date: payment.date || new Date().toISOString().split('T')[0],
    description: `Payment received from ${clientName || 'client'} - ${payment.description || ''}`,
    referenceId: payment.id,
    referenceType: 'client_payment',
    totalAmount: payment.amount,
    lines: [
      { accountId: 1, debit: payment.amount, credit: 0, description: 'Cash/Bank received' },
      { accountId: 2, debit: 0, credit: payment.amount, description: 'Reduce Accounts Receivable' }
    ]
  });
}

// Payable created (PO approved): Dr Inventory/Raw Materials, Cr Accounts Payable
async function journalPayableCreated(payable, supplierName) {
  return generateJournalEntry({
    date: payable.due_date || new Date().toISOString().split('T')[0],
    description: `Purchase from ${supplierName || 'supplier'} - ${payable.invoice_number || ''}`,
    referenceId: payable.id,
    referenceType: 'payable',
    totalAmount: payable.amount,
    lines: [
      { accountId: 3, debit: payable.amount, credit: 0, description: 'Inventory/Raw Materials purchased' },
      { accountId: 4, debit: 0, credit: payable.amount, description: 'Accounts Payable' }
    ]
  });
}

// Supplier payment: Dr Accounts Payable, Cr Cash
async function journalSupplierPayment(payment, supplierName) {
  return generateJournalEntry({
    date: payment.payment_date || new Date().toISOString().split('T')[0],
    description: `Payment to ${supplierName || 'supplier'}`,
    referenceId: payment.id,
    referenceType: 'supplier_payment',
    totalAmount: payment.amount,
    lines: [
      { accountId: 4, debit: payment.amount, credit: 0, description: 'Reduce Accounts Payable' },
      { accountId: 1, debit: 0, credit: payment.amount, description: 'Cash/Bank paid out' }
    ]
  });
}

// Payroll posted: Dr Salaries Expense, Cr Cash (or Accrued Salaries)
async function journalPayrollPosted(payroll) {
  return generateJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: `Payroll - ${payroll.period_name || 'Monthly Payroll'}`,
    referenceId: payroll.id,
    referenceType: 'payroll',
    totalAmount: payroll.total_net_salary || payroll.total_amount,
    lines: [
      { accountId: 8, debit: payroll.total_net_salary || payroll.total_amount, credit: 0, description: 'Salaries and Wages Expense' },
      { accountId: 1, debit: 0, credit: payroll.total_net_salary || payroll.total_amount, description: 'Cash paid for salaries' }
    ]
  });
}

// Expense created: Dr Expense Account, Cr Cash
async function journalExpenseCreated(expense) {
  const accountMap = { salaries: 8, rent: 9, utilities: 10, maintenance: 7, transport: 7 };
  const expenseAccountId = accountMap[expense.category] || 7;
  return generateJournalEntry({
    date: expense.date || new Date().toISOString().split('T')[0],
    description: `${expense.category} expense - ${expense.description || ''}`,
    referenceId: expense.id,
    referenceType: 'expense',
    totalAmount: expense.amount,
    lines: [
      { accountId: expenseAccountId, debit: expense.amount, credit: 0, description: `${expense.category} expense` },
      { accountId: 1, debit: 0, credit: expense.amount, description: 'Cash paid' }
    ]
  });
}

// Production completed: Dr Inventory(FG), Cr Inventory(RM)
async function journalProductionCompleted(productionOrder) {
  return generateJournalEntry({
    date: productionOrder.completion_date || new Date().toISOString().split('T')[0],
    description: `Production ${productionOrder.order_number} completed`,
    referenceId: productionOrder.id,
    referenceType: 'production',
    totalAmount: productionOrder.actual_cost || 0,
    lines: [
      { accountId: 3, debit: productionOrder.actual_cost || 0, credit: 0, description: 'Finished Goods added to Inventory' },
      { accountId: 3, debit: 0, credit: productionOrder.actual_cost || 0, description: 'Raw Materials consumed' }
    ]
  });
}

module.exports = {
  generateJournalEntry,
  journalInvoiceCreated,
  journalPaymentReceived,
  journalPayableCreated,
  journalSupplierPayment,
  journalPayrollPosted,
  journalExpenseCreated,
  journalProductionCompleted
};
