import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { formatCurrency, formatNumber } from '../utils/formatters';
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
      alert('Please enter a valid payment amount');
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
        alert('Payment recorded successfully');
        closePaymentModal();
        fetchData(); // Refresh data
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment');
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

    const message = `Dear ${client},\n\nThis is a friendly reminder regarding your account with us.\n\nOUTSTANDING BALANCE: EGP ${Number(amount || 0).toLocaleString()}\nDAYS OVERDUE: ${days} days\n\nPlease arrange payment at your earliest convenience to avoid any disruption in service.\n\nFor any questions, please contact our accounts department.\n\nThank you for your business.`;

    if (phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
    } else {
      const subject = encodeURIComponent(`Payment Reminder - Outstanding Balance: EGP ${Number(amount || 0).toLocaleString()}`);
      const body = encodeURIComponent(message);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      paid: { color: 'success', label: 'Paid' },
      pending: { color: 'warning', label: 'معلق' },
      partial: { color: 'info', label: 'جزئي' },
      overdue: { color: 'danger', label: 'Overdue' },
      completed: { color: 'success', label: 'مكتمل' }
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
            <p>Track invoices, payments, and receivables</p>
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
                  <div className="stat-label">Today's Income</div>
                  <div className="stat-value">EGP {Number(dashboard.todayIncome || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <DollarSign size={24} />
                </div>
                <div>
                  <div className="stat-label">Today's Expenses</div>
                  <div className="stat-value" style={{ color: '#dc2626' }}>EGP {Number(dashboard.todayExpenses || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.totalReceivables')}</div>
                  <div className="stat-value">EGP {Number(dashboard.receivables || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.overdueAmount')}</div>
                  <div className="stat-value">EGP {Number(dashboard.overdue || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#dcfce7', color: '#16a34a' }}>
                  <Wallet size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('finance.totalPayables')}</div>
                  <div className="stat-value">EGP {Number(dashboard.totalPayables || 0).toLocaleString()}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}>
                  <TrendingUp size={24} />
                </div>
                <div>
                  <div className="stat-label">{t('dashboard.netPosition')}</div>
                  <div className="stat-value">EGP {Number((dashboard.totalReceivables || 0) - (dashboard.totalPayables || 0)).toLocaleString()}</div>
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
                  <DollarSign size={20} /> Complete Financial Overview
                </h3>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ padding: '12px', background: '#dbeafe', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.totalReceivables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#3b82f6' }}>
                      EGP {Number(dashboard.totalReceivables || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.totalPayables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#ef4444' }}>
                      EGP {Number(dashboard.totalPayables || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>{t('finance.overduePayables')}</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#d97706' }}>
                      EGP {Number(dashboard.overduePayables || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ padding: '12px', background: '#d1fae5', borderRadius: '6px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85em', color: '#64748b' }}>Today's Income</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 600, color: '#16a34a' }}>
                      EGP {Number(dashboard.todayIncome || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '16px', padding: '12px', background: '#eff6ff', borderRadius: '6px', textAlign: 'center', border: '2px solid #3b82f6' }}>
                  <div style={{ fontSize: '0.9em', color: '#64748b', fontWeight: 600 }}>{t('finance.netCashPosition')}</div>
                  <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>
                    EGP {Number((dashboard.totalReceivables || 0) - (dashboard.totalPayables || 0)).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#6b7280' }}>
                    Receivables ({Number(dashboard.totalReceivables || 0).toLocaleString()}) - Payables ({Number(dashboard.totalPayables || 0).toLocaleString()})
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
                    Expenses by Category
                  </h3>
                  <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '18px' }}>
                    EGP {dashboard.expensesByCategory.reduce((s, e) => s + (e.total || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', padding: '16px' }}>
                  {dashboard.expensesByCategory.map((cat, i) => (
                    <div key={i} style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', textAlign: 'center', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '0.8em', color: '#64748b', marginBottom: '4px', textTransform: 'capitalize' }}>{cat.category || 'Uncategorized'}</div>
                      <div style={{ fontSize: '1.2em', fontWeight: 700, color: '#dc2626' }}>
                        EGP {Number(cat.total).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.75em', color: '#9ca3af' }}>{cat.count} entries</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Expenses */}
            {dashboard.recentExpenses && dashboard.recentExpenses.length > 0 && (
              <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid #ef4444' }}>
                <div className="card-header">
                  <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Receipt size={18} color="#ef4444" /> 
                    Recent Expenses
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
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>EGP {Number(exp.amount).toLocaleString()}</td>
                          <td>{new Date(exp.date).toLocaleDateString()}</td>
                          <td>
                            <span className={`badge badge-${exp.status === 'approved' ? 'success' : 'warning'}`}>
                              {exp.status}
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
                    Salary Expenses (from Payroll)
                  </h3>
                  <span style={{ fontWeight: 600, color: '#8b5cf6', fontSize: '18px' }}>
                    EGP {salaryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()}
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
                              <Briefcase size={12} /> {expense.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: '#dc2626' }}>
                            EGP {expense.amount?.toLocaleString()}
                          </td>
                          <td>
                            <span className={`badge badge-${expense.status === 'approved' ? 'success' : expense.status === 'paid' ? 'success' : 'warning'}`}>
                              {expense.status}
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
                  <h3 className="card-title"><FileText size={18} style={{ marginRight: '8px' }} /> Recent Invoices</h3>
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
                    {invoices.slice(0, 5).map(inv => (
                      <tr key={inv._id}>
                        <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                        <td>{inv.client?.name}</td>
                        <td style={{ fontWeight: 600 }}>EGP {Number(inv.amount || 0)?.toLocaleString()}</td>
                        <td>{getStatusBadge(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><Clock size={18} style={{ marginRight: '8px' }} /> Upcoming Due Dates</h3>
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
                            {item.days} days
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#dc2626' }}>EGP {Number(item.amount || 0)?.toLocaleString()}</td>
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
                  placeholder="Search invoices..."
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
                      <td style={{ fontWeight: 600 }}>EGP {Number(inv.amount || 0)?.toLocaleString()}</td>
                      <td style={{ color: '#059669', fontWeight: 500 }}>EGP {Number(inv.paidAmount || 0)?.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: inv.remainingAmount > 0 ? '#dc2626' : '#059669' }}>
                        EGP {Number(inv.remainingAmount || 0)?.toLocaleString()}
                      </td>
                      <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                      <td>{getStatusBadge(inv.status)}</td>
                      <td>
                        {inv.status !== 'paid' && (
                          <button 
                            className="btn btn-success" 
                            onClick={() => openPaymentModal(inv)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <CreditCard size={16} /> Record Payment
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
                  placeholder="Search payments..."
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
                      <td style={{ fontWeight: 600 }}>EGP {Number(pay.amount || 0)?.toLocaleString()}</td>
                      <td style={{ textTransform: 'capitalize' }}>{pay.paymentMethod}</td>
                      <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{pay.reference}</td>
                      <td>{new Date(pay.paymentDate).toLocaleDateString()}</td>
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
                  <div className="stat-label">Current (0-30 days)</div>
                  <div className="stat-value" style={{ fontSize: '24px' }}>
                    EGP {Number(receivables.totals?.current || 0).toLocaleString()}
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
                    EGP {Number(receivables.totals?.['31-60'] || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ background: '#fef3c7', padding: '16px' }}>
                <div>
                  <div className="stat-label">{t('finance.days6190')}</div>
                  <div className="stat-value" style={{ color: '#d97706' }}>
                    EGP {Number(receivables.totals?.['61-90'] || 0).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
                <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  <XCircle size={24} />
                </div>
                <div>
                  <div className="stat-label">Over 90 days</div>
                  <div className="stat-value" style={{ fontSize: '24px', color: '#dc2626' }}>
                    EGP {Number(receivables.totals?.['over-90'] || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('finance.receivablesAging')}</h3>
                <span style={{ fontWeight: 600, color: '#dc2626', fontSize: '16px' }}>
                  Total: EGP {Number(receivables.totals?.total || 0).toLocaleString()}
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
                        <td style={{ fontWeight: 600 }}>EGP {Number(item.amount || 0)?.toLocaleString()}</td>
                        <td>
                          <span 
                            className={`badge ${item.days > 60 ? 'badge-danger' : item.days > 30 ? 'badge-warning' : 'badge-success'}`}
                            style={{ fontSize: '11px' }}
                          >
                            {item.days} days
                          </span>
                        </td>
                        <td>{getStatusBadge(item.days > 90 ? 'overdue' : item.days > 30 ? 'pending' : 'pending')}</td>
                        <td>
                          <button 
                            className="btn btn-outline btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => handleSendReminder(item)}
                          >
                            <Mail size={14} /> Send Reminder
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
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
          }}>
            <div className="modal-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                Record Payment
              </h3>
              <button 
                onClick={closePaymentModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            {selectedInvoiceForPayment && (
              <div style={{
                backgroundColor: '#f1f5f9',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b' }}>
                  Invoice: <strong>{selectedInvoiceForPayment.invoiceNumber}</strong>
                </p>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#64748b' }}>
                  Client: <strong>{selectedInvoiceForPayment.client?.name}</strong>
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  Remaining Balance: 
                  <strong style={{ color: '#dc2626' }}>
                    EGP {Number(selectedInvoiceForPayment.remainingAmount || 0)?.toLocaleString()}
                  </strong>
                </p>
              </div>
            )}

            <form onSubmit={submitPayment}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Payment Amount (EGP) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="form-input"
                  placeholder="Enter amount"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Payment Method *
                </label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="form-input"
                  required
                  style={{ width: '100%' }}
                >
                  <option value="cash">{t('common.cash')}</option>
                  <option value="bank_transfer">{t('common.bankTransfer')}</option>
                  <option value="cheque">{t('common.cheque')}</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Reference Number
                </label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="form-input"
                  placeholder="e.g., TRF-001, CHQ-123"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  className="form-input"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '14px', 
                  fontWeight: 500,
                  color: '#374151'
                }}>
                  Notes
                </label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="form-input"
                  placeholder="Additional notes about this payment..."
                  rows="3"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end' 
              }}>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={16} /> Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}