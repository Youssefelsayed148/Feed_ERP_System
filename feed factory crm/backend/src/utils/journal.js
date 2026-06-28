const { query } = require('../config/database');

// Auto-generate journal entries from business transactions
//
// CONFIRMED ACCOUNTS TABLE (al_kheir_feed_factory):
// 1  النقدية                    asset
// 2  حسابات القبض               asset
// 3  مخزون - مواد خام           asset
// 4  مخزون - منتجات تامة        asset
// 5  حسابات الدفع               liability
// 6  حقوق الملكية               equity
// 7  إيرادات المبيعات            revenue
// 8  مصروفات الرواتب والأجور     expense
// 9  تكلفة البضاعة المباعة       expense
// 10 مصروفات أخرى               expense

async function generateJournalEntry({ date, description, referenceId, referenceType, totalAmount, lines, createdBy = 1 }) {
  try {
    const entryNumResult = await query(
      "SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace(entry_number, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 as next_num FROM journal_entries"
    );
    const entryNumber = 'JE-' + String(entryNumResult.rows[0].next_num).padStart(5, '0');

    const entryResult = await query(
      `INSERT INTO journal_entries (entry_number, date, description, reference_id, reference_type, total_amount, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [entryNumber, date, description, referenceId, referenceType, totalAmount, createdBy]
    );
    const entryId = entryResult.rows[0].id;

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

// Invoice created: Dr حسابات القبض (2), Cr إيرادات المبيعات (7)
async function journalInvoiceCreated(invoice) {
  return generateJournalEntry({
    date: invoice.created_at ? new Date(invoice.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    description: `فاتورة مبيعات ${invoice.invoice_number} - العميل: ${invoice.client_name || ''}`,
    referenceId: invoice.id,
    referenceType: 'invoice',
    totalAmount: invoice.amount,
    lines: [
      { accountId: 2, debit: invoice.amount, credit: 0,           description: 'حسابات القبض - من المبيعات' },
      { accountId: 7, debit: 0,              credit: invoice.amount, description: 'إيرادات المبيعات' }
    ]
  });
}

// Payment received: Dr النقدية (1), Cr حسابات القبض (2)
async function journalPaymentReceived(payment, clientName) {
  return generateJournalEntry({
    date: payment.date || new Date().toISOString().split('T')[0],
    description: `تسجيل دفعة - تحصيل من ${clientName || 'عميل'}`,
    referenceId: payment.id,
    referenceType: 'client_payment',
    totalAmount: payment.amount,
    lines: [
      { accountId: 1, debit: payment.amount, credit: 0,            description: 'نقدية مقبوضة' },
      { accountId: 2, debit: 0,              credit: payment.amount, description: 'تسوية حسابات القبض' }
    ]
  });
}

// GRN approved / Payable created: Dr مخزون مواد خام (3), Cr حسابات الدفع (5)
async function journalPayableCreated(payable, supplierName) {
  return generateJournalEntry({
    date: payable.due_date || new Date().toISOString().split('T')[0],
    description: `شراء من ${supplierName || 'مورد'} - ${payable.invoice_number || ''}`,
    referenceId: payable.id,
    referenceType: 'payable',
    totalAmount: payable.amount,
    lines: [
      { accountId: 3, debit: payable.amount, credit: 0,            description: 'مخزون مواد خام مشتراة' },
      { accountId: 5, debit: 0,              credit: payable.amount, description: 'حسابات الدفع للمورد' }
    ]
  });
}

// Supplier payment: Dr حسابات الدفع (5), Cr النقدية (1)
async function journalSupplierPayment(payment, supplierName) {
  return generateJournalEntry({
    date: payment.payment_date || new Date().toISOString().split('T')[0],
    description: `دفع للمورد ${supplierName || ''}`,
    referenceId: payment.id,
    referenceType: 'supplier_payment',
    totalAmount: payment.amount,
    lines: [
      { accountId: 5, debit: payment.amount, credit: 0,            description: 'تسوية حسابات الدفع' },
      { accountId: 1, debit: 0,              credit: payment.amount, description: 'نقدية مدفوعة للمورد' }
    ]
  });
}

// Payroll posted: Dr مصروفات الرواتب (8), Cr النقدية (1)
async function journalPayrollPosted(payroll) {
  return generateJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: `رواتب - ${payroll.period_name || 'كشف الرواتب الشهري'}`,
    referenceId: payroll.id,
    referenceType: 'payroll',
    totalAmount: payroll.total_net_salary || payroll.total_amount,
    lines: [
      { accountId: 8, debit: payroll.total_net_salary || payroll.total_amount, credit: 0, description: 'مصروفات الرواتب والأجور' },
      { accountId: 1, debit: 0, credit: payroll.total_net_salary || payroll.total_amount, description: 'نقدية مدفوعة للرواتب' }
    ]
  });
}

const categoryAr = {
  'Fuel': 'وقود', 'fuel': 'وقود',
  'Maintenance': 'صيانة', 'maintenance': 'صيانة',
  'Salaries': 'رواتب', 'salaries': 'رواتب',
  'Utilities': 'مرافق', 'utilities': 'مرافق',
  'Transport': 'نقل', 'transport': 'نقل',
  'Marketing': 'تسويق', 'marketing': 'تسويق',
  'Other': 'أخرى', 'other': 'أخرى'
};

// Expense created: Dr expense account, Cr النقدية (1)
// salaries→8, COGS→9, everything else→10
async function journalExpenseCreated(expense) {
  const accountMap = {
    salaries:    8,  // مصروفات الرواتب
    payroll:     8,
    cogs:        9,  // تكلفة البضاعة المباعة
    cost:        9,
    maintenance: 10,
    rent:        10,
    utilities:   10,
    transport:   10,
    marketing:   10,
    admin:       10,
    legal:       10,
    other:       10
  };
  const expenseAccountId = accountMap[expense.category?.toLowerCase()] || 10;
  return generateJournalEntry({
    date: expense.date || new Date().toISOString().split('T')[0],
    description: `مصروف ${categoryAr[expense.category] || expense.category} - ${expense.description || ''}`,
    referenceId: expense.id,
    referenceType: 'expense',
    totalAmount: expense.amount,
    lines: [
      { accountId: expenseAccountId, debit: expense.amount, credit: 0,            description: `مصروف ${categoryAr[expense.category] || expense.category}` },
      { accountId: 1,                debit: 0,              credit: expense.amount, description: 'نقدية مدفوعة' }
    ]
  });
}

// Sales order approved: Dr حسابات القبض (2), Cr إيرادات المبيعات (7)
async function journalSalesOrderApproved(order) {
  const clientRes = await query(
    `SELECT COALESCE(NULLIF(name_arabic, ''), name_english) as name FROM clients WHERE id = $1`,
    [order.client_id]
  ).catch(() => ({ rows: [] }));
  const clientName = clientRes.rows[0]?.name || '';
  const amount = parseFloat(order.final_amount || 0);
  return generateJournalEntry({
    date: new Date().toISOString().split('T')[0],
    description: `مبيعات - ${clientName} - ${order.order_number}`,
    referenceId: order.id,
    referenceType: 'sales_order',
    totalAmount: amount,
    lines: [
      { accountId: 2, debit: amount, credit: 0,      description: 'حسابات القبض - مبيعات' },
      { accountId: 7, debit: 0,      credit: amount, description: 'إيرادات المبيعات' }
    ],
    createdBy: order.created_by || 1
  });
}

// Production completed: Dr مخزون منتجات تامة (4), Cr مخزون مواد خام (3)
async function journalProductionCompleted(productionOrder) {
  return generateJournalEntry({
    date: productionOrder.completion_date || new Date().toISOString().split('T')[0],
    description: `إنتاج ${productionOrder.order_number} مكتمل`,
    referenceId: productionOrder.id,
    referenceType: 'production',
    totalAmount: productionOrder.actual_cost || 0,
    lines: [
      { accountId: 4, debit: productionOrder.actual_cost || 0, credit: 0,                           description: 'مخزون منتجات تامة' },
      { accountId: 3, debit: 0,                                credit: productionOrder.actual_cost || 0, description: 'مواد خام مستهلكة' }
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
  journalSalesOrderApproved,
  journalProductionCompleted
};