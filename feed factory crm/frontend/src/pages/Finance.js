import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatCurrency, formatDate, formatNumber, getStatusLabel } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  DollarSign, FileText, CreditCard, TrendingUp, 
  Clock, AlertTriangle, Check, Plus, Search, Mail,
  Wallet, Activity, Inbox, CheckCircle, XCircle,
  Eye, Download, Send, RefreshCw, ArrowLeftRight, Receipt,
  Users, Briefcase
} from 'lucide-react';
import Payables from './Payables';
import Expenses from './Expenses';
import { payrollService } from '../services/api';

// CSS Classes used from index.css:
// - page-header, header-title
// - stats-grid, stat-card, stat-icon, stat-label, stat-value
// - data-grid, card, card-header, card-title
// - table-container, table
// - section-card
// - search-box, form-input
// - btn, btn-success, btn-outline, btn-sm
// - badge, badge-success, badge-warning, badge-danger, badge-info

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});


export default function Finance() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    const path = location.pathname;
    if (path.includes('/receivables')) return 'receivables';
    if (path.includes('/payables')) return 'payables';
    if (path.includes('/expenses')) return 'expenses';
    return 'dashboard';
  });

  // Sync active tab with URL path changes (e.g., /finance → /finance/receivables)
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/receivables')) setActiveTab('receivables');
    else if (path.includes('/payables')) setActiveTab('payables');
    else if (path.includes('/expenses')) setActiveTab('expenses');
  }, [location.pathname]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receivables, setReceivables] = useState({ aging: [], totals: {} });
  const [dashboard, setDashboard] = useState({});
  const [salaryExpenses, setSalaryExpenses] = useState([]);
  const [salaryPayables, setSalaryPayables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash',
    reference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    fetchData();
    fetchSalaryData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const [dashRes, invRes] = await Promise.all([
          fetch(`${API_URL}/finance/dashboard`, { headers: headers() }),
          fetch(`${API_URL}/finance/invoices`, { headers: headers() })
        ]);
        const dashData = dashRes.ok ? await dashRes.json() : {};
        const invData = invRes.ok ? await invRes.json() : { invoices: [] };
        setDashboard(dashData || {});
        setInvoices(Array.isArray(invData) ? invData : (invData.invoices || []));
      } else if (activeTab === 'invoices') {
        const res = await fetch(`${API_URL}/finance/invoices`, { headers: headers() });
        const data = res.ok ? await res.json() : { invoices: [] };
        setInvoices(Array.isArray(data) ? data : (data.invoices || []));
      } else if (activeTab === 'payments') {
        const res = await fetch(`${API_URL}/finance/payments`, { headers: headers() });
        const data = res.ok ? await res.json() : { payments: [] };
        setPayments(Array.isArray(data) ? data : (data.payments || []));
      } else if (activeTab === 'receivables') {
        const res = await fetch(`${API_URL}/finance/receivables`, { headers: headers() });
        const data = res.ok ? await res.json() : {};
        setReceivables(data || {});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setDashboard({});
      setInvoices([]);
      setPayments([]);
      setReceivables({});
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentForm({
      amount: invoice.remainingAmount || '',
      paymentMethod: 'cash',
      reference: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedInvoiceForPayment(null);
    setPaymentForm({
      amount: '',
      paymentMethod: 'cash',
      reference: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      alert(t('finance.validPaymentRequired'));
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/finance/payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          invoiceId: selectedInvoiceForPayment._id,
          amount: parseFloat(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference,
          paymentDate: paymentForm.paymentDate,
          notes: paymentForm.notes
        })
      });
      
      if (response.ok) {
        alert(t('finance.paymentRecorded'));
        closePaymentModal();
        fetchData(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.message || t('finance.paymentFailed'));
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert(t('finance.paymentFailed'));
    }
  };

  // Fetch salary data from payroll integration
  const fetchSalaryData = async () => {
    try {
      const result = await payrollService.getPayrolls({ status: 'posted' });
      const postedPayrolls = result.payrolls || [];
      
      // Create salary expenses from posted payrolls
      const expenses = postedPayrolls.map(p => ({
          _id: p.expenseId || `exp-${p._id}`,
          expenseNumber: `EXP-SAL-${p.month}`,
          category: 'salary',
          description: `Monthly Payroll - ${p.month}`,
          amount: p.totalNetSalary,
          date: p.postedAt || new Date(),
          status: 'pending'
        }));
        
        // Create salary payables from posted payrolls
        const payables = postedPayrolls.map(p => ({
          _id: p.payableId || `pay-${p._id}`,
          payableNumber: `PAY-SAL-${p.month}`,
          type: 'salary',
          month: p.month,
          amount: p.totalNetSalary,
          dueDate: new Date(new Date().setDate(new Date().getDate() + 5)),
          status: 'pending'
        }));
        
        setSalaryExpenses(expenses);
        setSalaryPayables(payables);
    } catch (error) {
      console.error('Error fetching salary data:', error);
      setSalaryExpenses([]);
      setSalaryPayables([]);
    }
  };

  const handleSendReminder = async (item) => {
    const client = item.client;
    const amount = item.amount;
    const days = item.days;
    const phone = item.phone || '';

    const message = `Dear ${client},\n\nThis is a friendly reminder regarding your account with us.\n\nOUTSTANDING BALANCE: EGP ${formatNumber(Number(amount || 0))}\nDAYS OVERDUE: ${days} {t('common.days')}\n\nPlease arrange payment at your earliest convenience to avoid any disruption in service.\n\nFor any questions, please contact our accounts department.\n\nThank you for your business.`;

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      const subject = encodeURIComponent(`Payment Reminder - Outstanding Balance: EGP ${formatNumber(Number(amount || 0))}`);
      const body = encodeURIComponent(message);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  };

  const paymentMethodAr = {
    'cash': 'نقدي', 'Cash': 'نقدي',
    'bank_transfer': 'تحويل بنكي', 'Bank_transfer': 'تحويل بنكي',
    'check': 'شيك', 'Check': 'شيك'
  };

  const categoryAr = {
    'Fuel': 'وقود', 'fuel': 'وقود',
    'Maintenance': 'صيانة', 'maintenance': 'صيانة',
    'Salaries': 'رواتب', 'salaries': 'رواتب',
    'Utilities': 'مرافق', 'utilities': 'مرافق',
    'Transport': 'نقل', 'transport': 'نقل',
    'Marketing': 'تسويق', 'marketing': 'تسويق',
    'Other': 'أخرى', 'other': 'أخرى'
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      paid: { color: 'success', label: t('common.statuses.paid') },
      pending: { color: 'warning', label: t('common.statuses.pending') },
      partial: { color: 'info', label: t('finance.partial') },
      overdue: { color: 'danger', label: t('common.statuses.overdue') },
      completed: { color: 'success', label: t('common.statuses.completed') },
      active: { color: 'success', label: 'نشط' },
      inactive: { color: 'secondary', label: 'غير نشط' },
      suspended: { color: 'danger', label: 'موقوف' }
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: status };
    return <span className={`badge badge-${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const tabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: <TrendingUp size={18} /> },
    { id: 'invoices', label: 'فواتير', icon: <FileText size={18} /> },
    { id: 'payments', label: 'مدفوعات', icon: <CreditCard size={18} /> },
    { id: 'receivables', label: 'مستحقات', icon: <Wallet size={18} /> },
    { id: 'payables', label: t('nav.payables'), icon: <ArrowLeftRight size={18} /> },
    { id: 'expenses', label: t('nav.expenses'), icon: <Receipt size={18} /> }
  ];

  return (
    <div className="finance-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">
          <DollarSign size={28} color="#059669" />
          <div>
            <h1>{t('finance.title')}</h1>
            <p>{t('finance.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="content-area">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.todayIncome')}</div>
                  <div className="stat-value">{formatCurrency(dashboard.todayIncome || 0)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <DollarSign size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.todayExpenses')}</div>
                  <div className="stat-value" style={{ color: '#dc2626' }}>{formatCurrency(dashboard.todayExpenses || 0)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.totalReceivables')}</div>
                  <div className="stat-value">{formatCurrency(dashboard.receivables || 0)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.overdueAmount')}</div>
                  <div className="stat-value">{formatCurrency(dashboard.overdue || 0)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.totalPayables')}</div>
                  <div className="stat-value">{formatCurrency(dashboard.totalPayables || 0)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('dashboard.netPosition')}</div>
                  <div className="stat-value">{formatCurrency((dashboard.totalReceivables || 0) - (dashboard.totalPayables || 0))}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                  <FileText size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.activeInvoices')}</div>
                  <div className="stat-value">{dashboard.invoiceCount || 0}</div>
                </div>
              </div>
            </div>

            {/* COMPREHENSIVE FINANCIAL SUMMARY */}
            <div className="card" style={{ marginBottom: '24px', background: '#f8fafc', border: '2px solid #3b82f6' }}>
              <div className="card-header" style={{ background: '#3b82f6', color: 'white' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={20} /> {t('finance.completeOverview')}
                </h3>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '12px', background: '#dbeafe', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.totalReceivables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#3b82f6' }}>
                      {formatCurrency(dashboard.totalReceivables || 0)}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.totalPayables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#ef4444' }}>
                      {formatCurrency(dashboard.totalPayables || 0)}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.overduePayables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#d97706' }}>
                      {formatCurrency(dashboard.overduePayables || 0)}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.todayIncome')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#16a34a' }}>
                      {formatCurrency(dashboard.todayIncome || 0)}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', textAlign: 'center', border: '2px solid #3b82f6' }}>
                  <div style={{ fontSize: '0.9em', color: '#64748b', fontWeight: 600 }}>{t('finance.netCashPosition')}</div>
                  <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>
                    {formatCurrency((dashboard.totalReceivables || 0) - (dashboard.totalPayables || 0))}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#6b7280' }}>
                    {t('finance.receivables')} ({formatNumber(Number(dashboard.totalReceivables || 0))}) - {t('finance.payables')} ({formatNumber(Number(dashboard.totalPayables || 0))})
                  </div>
                </div>
              </div>
            </div>

            {/* Expenses Summary Section */}
            {dashboard.expensesByCategory && dashboard.expensesByCategory.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #dc2626' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={18} color="#dc2626" /> 
                    المصروفات حسب الفئة
                  </h3>
                  <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '18px' }}>
                    {formatCurrency(dashboard.expensesByCategory.reduce((s, e) => s + (e.total || 0), 0))}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', padding: '16px' }}>
                  {dashboard.expensesByCategory.map((cat, i) => (
                    <div key={i} style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', textAlign: 'center', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '4px', textTransform: 'capitalize' }}>{cat.category || 'Uncategorized'}</div>
                      <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#dc2626' }}>
                        {formatCurrency(cat.total)}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#9ca3af' }}>{cat.count} {t('finance.entries')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* {t('expenses.title')} */}
            {dashboard.recentExpenses && dashboard.recentExpenses.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #ef4444' }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={18} color="#ef4444" /> 
                    {t('expenses.title')}
                  </h3>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('common.category')}</th>
                        <th>{t('common.description')}</th>
                        <th>{t('common.amount')}</th>
                        <th>{t('common.date')}</th>
                        <th>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.recentExpenses.slice(0, 8).map(exp => (
                        <tr key={exp.id}>
                          <td>
                            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>{exp.category || 'Other'}</span>
                          </td>
                          <td>{exp.description || 'N/A'}</td>
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(Number(exp.amount))}</td>
                          <td>{formatDate(exp.date)}</td>
                          <td>
                            <span className={`badge badge-${exp.status === 'approved' ? 'success' : 'warning'}`}>
                              {getStatusLabel(exp.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Salary Expenses Section */}
            {salaryExpenses.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #8b5cf6' }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={18} color="#8b5cf6" /> 
                    {t('finance.salaryExpenses')}
                  </h3>
                  <span style={{ fontWeight: 600, color: '#8b5cf6', fontSize: '18px' }}>
                    {formatCurrency(salaryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0))}
                  </span>
                </div>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>رقم المصروف</th>
                        <th>{t('common.description')}</th>
                        <th>{t('common.category')}</th>
                        <th>{t('common.amount')}</th>
                        <th>{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryExpenses.map(expense => (
                        <tr key={expense._id}>
                          <td style={{ fontWeight: 600 }}>{expense.expenseNumber}</td>
                          <td>{expense.description}</td>
                          <td>
                            <span className="badge badge-info">
                              <Briefcase size={12} /> {categoryAr[expense.category] || expense.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>
                            {formatCurrency(expense.amount)}
                          </td>
                          <td>
                            <span className={`badge badge-${expense.status === 'approved' ? 'success' : expense.status === 'paid' ? 'success' : 'warning'}`}>
                              {getStatusLabel(expense.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="data-grid">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><FileText size={18} style={{ marginRight: '8px' }} />{t('finance.invoices')}</h3>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>{t('common.client')}</th>
                      <th>{t('common.amount')}</th>
                      <th>{t('common.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv._id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td>{inv.client?.name}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(Number(inv.amount || 0))}</td>
                        <td>{getStatusBadge(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><Clock size={18} style={{ marginRight: '8px' }} /> {t('finance.upcomingDue')}</h3>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.client')}</th>
                      <th>{t('common.days')}</th>
                      <th>{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.aging.slice(0, 4).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{item.client}</td>
                        <td>
                          <span 
                            className={`badge ${item.days > 60 ? 'badge-danger' : item.days > 30 ? 'badge-warning' : 'badge-success'}`}
                            style={{ fontSize: '11px' }}
                          >
                            {item.days} {t('common.days')}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(Number(item.amount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVOICES TAB */}
        {activeTab === 'invoices' && (
          <div className="invoices-tab">
            <div className="section-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
              <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '400px' }}>
                <Search size={18} color="#64748b" />
                <input
                  type="text"
                  placeholder={t('finance.searchInvoices')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, marginBottom: 0 }}
                />
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم الفاتورة</th>
                    <th>{t('common.client')}</th>
                    <th>رقم الطلب</th>
                    <th>{t('common.amount')}</th>
                    <th>{t('common.statuses.paid')}</th>
                    <th>{t('common.balance')}</th>
                    <th>{t('orders.dueDate')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter(inv => !search || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) || inv.client?.name?.toLowerCase().includes(search.toLowerCase()))
                    .map(inv => (
                    <tr key={inv._id}>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                      <td>{inv.client?.name}</td>
                      <td>{inv.orderNumber}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(Number(inv.amount || 0))}</td>
                      <td style={{ color: '#059669', fontWeight: 500 }}>{formatCurrency(Number(inv.paidAmount || 0))}</td>
                      <td style={{ fontWeight: 600, color: inv.remainingAmount > 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(Number(inv.remainingAmount || 0))}
                      </td>
                      <td>{inv.dueDate ? formatDate(inv.dueDate) : '-'}</td>
                      <td>{getStatusBadge(inv.status)}</td>
                      <td>
                        {inv.status !== 'paid' && (
                          <button 
                            className="btn btn-success" 
                            onClick={() => openPaymentModal(inv)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <CreditCard size={16} /> تسجيل دفعة
                          </button>
                        )}
                        {inv.status === 'paid' && (
                          <span className="badge badge-success">{t('finance.paidInFull')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <div className="payments-tab">
            <div className="section-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
              <div className="search-box" style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '400px' }}>
                <Search size={18} color="#64748b" />
                <input
                  type="text"
                  placeholder="بحث في المدفوعات..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ flex: 1, marginBottom: 0 }}
                />
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم الدفعة</th>
                    <th>{t('common.client')}</th>
                    <th>{t('common.amount')}</th>
                    <th>{t('common.method')}</th>
                    <th>{t('common.reference')}</th>
                    <th>{t('common.date')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(pay => (
                    <tr key={pay._id}>
                      <td style={{ fontWeight: 600 }}>{pay.paymentNumber}</td>
                      <td>{pay.client?.name}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(Number(pay.amount || 0))}</td>
                      <td>{paymentMethodAr[pay.paymentMethod] || pay.paymentMethod}</td>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{pay.reference}</td>
                      <td>{formatDate(pay.paymentDate)}</td>
                      <td>{getStatusBadge(pay.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* RECEIVABLES TAB */}
        {activeTab === 'receivables' && (
          <div className="receivables-tab">
            <div className="stats-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="stat-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                  <CheckCircle size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.current')}</div>
                  <div className="stat-value" style={{ fontSize: '24px' }}>
                    {formatCurrency(Number(receivables.totals?.current || 0))}
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <Clock size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.days3160')}</div>
                  <div className="stat-value" style={{ fontSize: '24px' }}>
                    {formatCurrency(Number(receivables.totals?.['31-60'] || 0))}
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ background: '#fef3c7', padding: '16px' }}>
                <div>
                  <div className="stat-label">{t('finance.days6190')}</div>
                  <div className="stat-value" style={{ color: '#d97706' }}>
                    {formatCurrency(Number(receivables.totals?.['61-90'] || 0))}
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
                <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <XCircle size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.over90')}</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: '#dc2626' }}>
                    {formatCurrency(Number(receivables.totals?.['over-90'] || 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('finance.receivablesAging')}</h3>
                <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '16px' }}>
                  {t('common.total')}: {formatCurrency(Number(receivables.totals?.total || 0))}
                </span>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.client')}</th>
                      <th>{t('finance.outstandingAmount')}</th>
                      <th>{t('finance.daysOverdue')}</th>
                      <th>{t('common.status')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.aging.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{item.client}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(Number(item.amount || 0))}</td>
                        <td>
                          <span 
                            className={`badge ${item.days > 60 ? 'badge-danger' : item.days > 30 ? 'badge-warning' : 'badge-success'}`}
                            style={{ fontSize: '11px' }}
                          >
                            {item.days} {t('common.days')}
                          </span>
                        </td>
                        <td>{getStatusBadge(item.days > 90 ? 'overdue' : item.days > 30 ? 'pending' : 'pending')}</td>
                        <td>
                          <button 
                            className="btn btn-outline btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => handleSendReminder(item)}
                          >
                            <Mail size={14} /> {t('finance.sendReminder')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* PAYABLES TAB */}
        {activeTab === 'payables' && (
          <div className="payables-tab">
            <Payables />
          </div>
        )}

        {/* EXPENSES TAB */}
        {activeTab === 'expenses' && (
          <div className="expenses-tab">
            <Expenses />
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="modal-overlay" onClick={closePaymentModal}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '520px', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {/* Dark navy header */}
            <div style={{ background: '#1a2332', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: 700 }}>تسجيل دفعة</h3>
              <button onClick={closePaymentModal} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', width: '28px', height: '28px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={submitPayment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Info card */}
              {selectedInvoiceForPayment && (
                <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>الفاتورة</p>
                    <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '14px' }}>{selectedInvoiceForPayment.invoiceNumber}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>العميل</p>
                    <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '14px' }}>{selectedInvoiceForPayment.client?.name}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>الرصيد المتبقي</p>
                    <p style={{ fontWeight: 700, color: '#10b981', margin: 0, fontSize: '15px' }}>{formatCurrency(Number(selectedInvoiceForPayment.remainingAmount || 0))}</p>
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>
                  المبلغ المدفوع <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', height: '44px' }}
                  onFocusCapture={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onBlurCapture={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
                  <span style={{ background: '#f1f5f9', padding: '0 14px', display: 'flex', alignItems: 'center', color: '#64748b', fontWeight: 600, fontSize: '13px', borderLeft: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>EGP</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '0 12px', fontSize: '15px', fontWeight: 500, direction: 'ltr', textAlign: 'right', background: 'transparent' }}
                  />
                </div>
              </div>

              {/* Method */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>
                  طريقة الدفع <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  required
                  style={{ width: '100%', height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1e293b', background: 'white', direction: 'rtl', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                >
                  <option value="cash">نقدي</option>
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="cheque">شيك</option>
                  <option value="credit_card">بطاقة ائتمان</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>الرقم المرجعي</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="رقم العملية / رقم الشيك"
                  style={{ width: '100%', height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', direction: 'rtl' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>
                  تاريخ الدفع <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  required
                  style={{ width: '100%', height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 12px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', direction: 'ltr' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>ملاحظات</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows="3"
                  placeholder="ملاحظات اختيارية حول هذه الدفعة..."
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#1e293b', outline: 'none', resize: 'vertical', direction: 'rtl', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                <button type="button" onClick={closePaymentModal}
                  style={{ padding: '10px 20px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}>
                  إلغاء
                </button>
                <button type="submit"
                  style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ✓ تسجيل دفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}