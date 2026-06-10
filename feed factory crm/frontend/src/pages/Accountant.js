import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft,
  Calendar, Download, Filter, Search, ChevronRight, Plus, AlertTriangle,
  Factory, ShoppingCart, CreditCard, Users, Package, Activity
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const formatMoney = (amount) => {
  const val = parseFloat(amount || 0);
  return `ج.م ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatMoneyRaw = (amount) => {
  const val = parseFloat(amount || 0);
  return `ج.م ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const moduleColors = {
  invoice: '#3b82f6',
  client_payment: '#10b981',
  payable: '#f97316',
  supplier_payment: '#ef4444',
  production: '#8b5cf6',
  payroll: '#ec4899',
  expense: '#f59e0b',
  equity: '#14b8a6',
  sales: '#3b82f6',
  purchase: '#f97316',
  finance: '#10b981'
};

const moduleLabels = {
  invoice: 'فاتورة مبيعات',
  client_payment: 'دفعة عميل',
  payable: 'Purchase / Payable',
  supplier_payment: 'دفعة مورد',
  production: 'إنتاج',
  payroll: 'رواتب',
  expense: 'مصروف',
  equity: 'حقوق ملكية',
  sales: 'مبيعات',
  purchase: 'مشتريات'
};

const Accountant = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [accounts, setAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load ALL accounting data from APIs
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [accountsRes, balancesRes, journalRes] = await Promise.all([
          fetch(`${API_URL}/finance/accounts`, { headers: headers() }).then(r => r.json()),
          fetch(`${API_URL}/finance/account-balances`, { headers: headers() }).then(r => r.json()),
          fetch(`${API_URL}/finance/journal-entries`, { headers: headers() }).then(r => r.json())
        ]);

        // Merge accounts with balances
        let mergedAccounts = [];
        if (accountsRes.success && accountsRes.accounts?.length > 0) {
          const balanceMap = {};
          if (balancesRes.success && balancesRes.accounts?.length > 0) {
            for (const b of balancesRes.accounts) balanceMap[b.id] = b;
          }
          mergedAccounts = accountsRes.accounts.map(a => {
            const bal = balanceMap[a.id] || {};
            return {
              id: a.id,
              code: a.account_code || '',
              name: a.name || '',
              type: a.type || '',
              category: a.category || '',
              balance: bal.balance || 0,
              totalDebit: bal.totalDebit || 0,
              totalCredit: bal.totalCredit || 0
            };
          });
          setAccounts(mergedAccounts);
        }

        if (journalRes.success && journalRes.entries?.length > 0) {
          setJournalEntries(journalRes.entries);
        }

        setError(null);
      } catch (err) {
        console.error('Error loading accounting data:', err);
        setError('Failed to load accounting data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate real totals from journal-driven account balances
  const totals = (() => {
    const assets = accounts.filter(a => a.type === 'asset').reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const liabilities = accounts.filter(a => a.type === 'liability').reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const equity = accounts.filter(a => a.type === 'equity').reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const revenue = accounts.filter(a => a.type === 'revenue').reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const expenses = accounts.filter(a => a.type === 'expense').reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    const netIncome = revenue - expenses;
    const totalEquity = equity + netIncome;
    const expectedAssets = liabilities + totalEquity;
    const diff = Math.abs(assets - expectedAssets);
    return { assets, liabilities, equity, totalEquity, revenue, expenses, netIncome, accountingEquation: diff < 0.01, difference: diff };
  })();

  // Filtered journal entries
  const filteredEntries = searchTerm
    ? journalEntries.filter(e =>
        (e.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.entry_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.reference_type || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : journalEntries;

  // General ledger for selected account
  const ledgerLines = selectedAccount
    ? journalEntries.flatMap(e =>
        (e.entries || []).filter(l => l.account === selectedAccount.id || l.account_id === selectedAccount.id)
          .map(l => ({ ...l, entryNumber: e.entry_number, date: e.date, description: e.description, referenceType: e.reference_type }))
      ).sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];

  // Module summaries
  const moduleSummary = (() => {
    const byType = {};
    for (const e of journalEntries) {
      const type = e.reference_type || 'other';
      if (!byType[type]) byType[type] = { count: 0, total: 0 };
      byType[type].count++;
      byType[type].total += parseFloat(e.total_amount || e.total || 0);
    }
    return byType;
  })();

  const getTypeColor = (type) => moduleColors[type] || '#6b7280';

  const getTypeLabel = (type) => moduleLabels[type] || type;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">Loading accounting data from all modules...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1><BookOpen size={28} style={{ marginRight: '12px', verticalAlign: 'middle' }} />{t('nav.accounting')}</h1>
          <p>Real-time financial reflection of all business activities — Sales, Purchases, Production, Payroll, Expenses</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {/* Connection Banner */}
      <div className="section-card" style={{ background: '#f0fdf4', border: '1px solid #86efac', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Factory size={20} color="#8b5cf6" />
            <strong>{t('production.title')}</strong> → Inventory
          </div>
          <ArrowRightLeft size={16} color="#64748b" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={20} color="#f97316" />
            <strong>Purchases</strong> → Inventory + Payables
          </div>
          <ArrowRightLeft size={16} color="#64748b" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} color="#3b82f6" />
            <strong>Sales</strong> → Revenue + Receivables
          </div>
          <ArrowRightLeft size={16} color="#64748b" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="#ec4899" />
            <strong>Payroll</strong> → Salaries Expense
          </div>
          <ArrowRightLeft size={16} color="#64748b" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} color="#10b981" />
            <strong>Payments</strong> → Cash + AR/AP
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview & Connections', icon: TrendingUp },
          { id: 'accounts', label: 'دليل الحسابات', icon: BookOpen },
          { id: 'journal', label: 'قيد اليومية', icon: ArrowRightLeft },
          { id: 'ledger', label: 'دفتر الأستاذ', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#64748b',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 500
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== OVERVIEW TAB ====== */}
      {activeTab === 'overview' && (
        <div>
          {/* Key Metrics */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}><TrendingUp size={24} /></div>
              <div className="stat-value">{formatMoneyRaw(totals.assets)}</div>
              <div className="stat-label">{t('accounting.totalAssets')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#ef444420', color: '#ef4444' }}><TrendingDown size={24} /></div>
              <div className="stat-value">{formatMoneyRaw(totals.liabilities)}</div>
              <div className="stat-label">{t('accounting.totalLiabilities')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}><DollarSign size={24} /></div>
              <div className="stat-value">{formatMoneyRaw(totals.totalEquity)}</div>
              <div className="stat-label">{t('accounting.totalEquity')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}><TrendingUp size={24} /></div>
              <div className="stat-value">{formatMoneyRaw(totals.revenue)}</div>
              <div className="stat-label">{t('accounting.revenue')}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}><TrendingDown size={24} /></div>
              <div className="stat-value">{formatMoneyRaw(totals.expenses)}</div>
              <div className="stat-label">{t('accounting.expenses')}</div>
            </div>
            <div className="stat-card" style={{ border: totals.netIncome >= 0 ? '2px solid #10b981' : '2px solid #ef4444', background: totals.netIncome >= 0 ? '#f0fdf4' : '#fef2f2' }}>
              <div className="stat-icon" style={{ background: totals.netIncome >= 0 ? '#10b98120' : '#ef444420', color: totals.netIncome >= 0 ? '#10b981' : '#ef4444' }}><DollarSign size={24} /></div>
              <div className="stat-value" style={{ color: totals.netIncome >= 0 ? '#10b981' : '#ef4444' }}>{formatMoneyRaw(totals.netIncome)}</div>
              <div className="stat-label">{t('accounting.netIncome')}</div>
            </div>
          </div>

          {/* Accounting Equation */}
          <div className="section-card" style={{ marginTop: '24px', background: totals.accountingEquation ? '#f0fdf4' : '#fef2f2', border: totals.accountingEquation ? '1px solid #86efac' : '1px solid #fecaca' }}>
            <h3 style={{ marginBottom: '16px' }}>{t('accounting.equation')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 600, gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: '#3b82f6' }}>{t('accounting.assets')}</span>
              <span>{formatMoneyRaw(totals.assets)}</span>
              <span>=</span>
              <span style={{ color: '#ef4444' }}>{t('accounting.liabilities')}</span>
              <span>{formatMoneyRaw(totals.liabilities)}</span>
              <span>+</span>
              <span style={{ color: '#10b981' }}>{t('accounting.equity')}</span>
              <span>{formatMoneyRaw(totals.totalEquity)}</span>
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px', color: totals.accountingEquation ? '#10b981' : '#ef4444', fontWeight: 500 }}>
              {totals.accountingEquation ? 'Balanced' : `Difference: ${formatMoneyRaw(totals.difference)}`}
            </div>
          </div>

          {/* Module Connection Summary */}
          <div className="section-card" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}><Activity size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Business Activity → Accounting Impact</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {Object.entries(moduleSummary).map(([type, data]) => (
                <div key={type} style={{ padding: '16px', borderRadius: '8px', background: `${getTypeColor(type)}10`, border: `1px solid ${getTypeColor(type)}30` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ color: getTypeColor(type) }}>{getTypeLabel(type)}</strong>
                    <span style={{ fontSize: '0.85em', color: '#6b7280' }}>{data.count} entries</span>
                  </div>
                  <div style={{ fontSize: '1.2em', fontWeight: 600 }}>{formatMoneyRaw(data.total)}</div>
                  <div style={{ fontSize: '0.85em', color: '#6b7280', marginTop: '4px' }}>
                    {type === 'invoice' && 'Dr Accounts Receivable / Cr Sales Revenue'}
                    {type === 'client_payment' && 'Dr Cash / Cr Accounts Receivable'}
                    {type === 'payable' && 'Dr Inventory / Cr Accounts Payable'}
                    {type === 'supplier_payment' && 'Dr Accounts Payable / Cr Cash'}
                    {type === 'production' && 'Dr Inventory (FG) / Cr Inventory (RM)'}
                    {type === 'payroll' && 'Dr Salaries Expense / Cr Cash'}
                    {type === 'expense' && 'Dr Expense / Cr Cash'}
                    {type === 'equity' && 'Dr Cash / Cr Owner Equity'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Journal Entries */}
          <div className="section-card" style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '16px' }}>Recent Journal Entries</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {journalEntries.slice(0, 5).map(entry => (
                <div key={entry.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${getTypeColor(entry.reference_type)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong>{entry.entry_number}</strong>
                    <span style={{ fontSize: '0.85em', color: '#6b7280' }}>{entry.date ? new Date(entry.date).toLocaleDateString() : ''}</span>
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#374151' }}>{entry.description}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.85em' }}>
                    <span style={{ color: getTypeColor(entry.reference_type) }}>{getTypeLabel(entry.reference_type)}</span>
                    <strong>{formatMoneyRaw(entry.total_amount)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ====== CHART OF ACCOUNTS TAB ====== */}
      {activeTab === 'accounts' && (
        <div>
          <div className="section-card">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Filter size={20} color="#64748b" />
              <span style={{ fontWeight: 500 }}>Chart of Accounts — Balances computed from {journalEntries.length} journal entries</span>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.code')}</th>
                  <th>{t('accounting.accountName')}</th>
                  <th>{t('common.type')}</th>
                  <th style={{ textAlign: 'right' }}>{t('accounting.debits')}</th>
                  <th style={{ textAlign: 'right' }}>{t('accounting.credits')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(account => (
                  <tr key={account.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedAccount(account); setActiveTab('ledger'); }}>
                    <td><strong>{account.code}</strong></td>
                    <td>{account.name}</td>
                    <td>
                      <span style={{
                        color: account.type === 'asset' ? '#3b82f6' : account.type === 'liability' ? '#ef4444' : account.type === 'equity' ? '#10b981' : account.type === 'revenue' ? '#8b5cf6' : '#f59e0b',
                        fontWeight: 500, textTransform: 'capitalize'
                      }}>{account.type}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatMoneyRaw(account.totalDebit)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatMoneyRaw(account.totalCredit)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: parseFloat(account.balance) >= 0 ? '#1e293b' : '#ef4444' }}>
                      {formatMoneyRaw(Math.abs(account.balance))}
                      {parseFloat(account.balance) < 0 && ' (Dr)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trial Balance */}
          <div className="section-card" style={{ marginTop: '24px' }}>
            <h3>Trial Balance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ color: '#3b82f6', fontSize: '1.3em', fontWeight: 600 }}>{formatMoneyRaw(accounts.reduce((s, a) => s + (parseFloat(a.totalDebit) || 0), 0))}</div>
                <div style={{ color: '#6b7280', fontSize: '0.9em', marginTop: '4px' }}>Total Debits</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ color: '#10b981', fontSize: '1.3em', fontWeight: 600 }}>{formatMoneyRaw(accounts.reduce((s, a) => s + (parseFloat(a.totalCredit) || 0), 0))}</div>
                <div style={{ color: '#6b7280', fontSize: '0.9em', marginTop: '4px' }}>Total Credits</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                <div style={{ color: totals.accountingEquation ? '#10b981' : '#ef4444', fontSize: '1.3em', fontWeight: 600 }}>{totals.accountingEquation ? 'Balanced' : 'Unbalanced'}</div>
                <div style={{ color: '#6b7280', fontSize: '0.9em', marginTop: '4px' }}>{t('common.status')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== JOURNAL ENTRIES TAB ====== */}
      {activeTab === 'journal' && (
        <div>
          <div className="section-card">
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="Search entries by description, number, or module..."
                className="form-input"
                style={{ flex: 1 }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="btn btn-outline"><Search size={18} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredEntries.map(entry => (
              <div key={entry.id} className="section-card" style={{ marginBottom: 0, borderLeft: `4px solid ${getTypeColor(entry.reference_type)}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{entry.date ? new Date(entry.date).toLocaleDateString() : ''}</span>
                      <span style={{ fontSize: '0.8em', padding: '2px 8px', borderRadius: '4px', background: `${getTypeColor(entry.reference_type)}20`, color: getTypeColor(entry.reference_type), fontWeight: 500 }}>
                        {getTypeLabel(entry.reference_type)}
                      </span>
                    </div>
                    <h4 style={{ margin: '8px 0 4px' }}>{entry.description}</h4>
                    <span style={{ color: '#3b82f6', fontSize: '0.85rem' }}>{entry.entry_number}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{formatMoneyRaw(entry.total_amount || entry.total)}</div>
                  </div>
                </div>
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ color: '#64748b' }}>
                      <th style={{ textAlign: 'left' }}>{t('accounting.account')}</th>
                      <th style={{ textAlign: 'right' }}>{t('common.debit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('common.credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(entry.entries || []).map((line, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '6px 0' }}>
                          <div style={{ fontWeight: 500 }}>{line.accountName || line.account_name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Acct #{line.account || line.account_id}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {parseFloat(line.debit) > 0 && formatMoneyRaw(line.debit)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                          {parseFloat(line.credit) > 0 && formatMoneyRaw(line.credit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {filteredEntries.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No journal entries found</div>
            )}
          </div>
        </div>
      )}

      {/* ====== GENERAL LEDGER TAB ====== */}
      {activeTab === 'ledger' && (
        <div>
          <div className="section-card">
            <h3 style={{ marginBottom: '12px' }}>{t('accounting.generalLedger')}</h3>
            <p style={{ color: '#6b7280', marginBottom: '12px' }}>Click an account in Chart of Accounts to view its transaction history</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {accounts.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccount(a)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: selectedAccount?.id === a.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    background: selectedAccount?.id === a.id ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    fontSize: '0.9em'
                  }}
                >
                  {a.code} — {a.name}
                </button>
              ))}
            </div>
          </div>

          {selectedAccount && (
            <div className="section-card" style={{ marginTop: '20px' }}>
              <h3 style={{ marginBottom: '16px' }}>
                {selectedAccount.code} — {selectedAccount.name}
                <span style={{ marginLeft: '12px', fontSize: '0.85em', color: '#6b7280' }}>
                  Current Balance: <strong>{formatMoneyRaw(selectedAccount.balance)}</strong>
                </span>
              </h3>

              {ledgerLines.length > 0 ? (
                <table style={{ width: '100%', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>{t('common.date')}</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>{t('accounting.entry')}</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>{t('common.description')}</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>{t('accounting.module')}</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>{t('common.debit')}</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>{t('common.credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerLines.map((line, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px' }}>{line.date ? new Date(line.date).toLocaleDateString() : ''}</td>
                        <td style={{ padding: '8px' }}><strong>{line.entryNumber}</strong></td>
                        <td style={{ padding: '8px' }}>{line.description}</td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ fontSize: '0.8em', padding: '2px 6px', borderRadius: '4px', background: `${getTypeColor(line.referenceType)}20`, color: getTypeColor(line.referenceType) }}>
                            {getTypeLabel(line.referenceType)}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#3b82f6' }}>
                          {parseFloat(line.debit) > 0 ? formatMoneyRaw(line.debit) : ''}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>
                          {parseFloat(line.credit) > 0 ? formatMoneyRaw(line.credit) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
                  No transactions found for this account yet
                </div>
              )}
            </div>
          )}

          {!selectedAccount && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              Select an account above to view its general ledger
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Accountant;
