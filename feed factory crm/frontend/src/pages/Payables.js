import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate, formatNumber, getStatusLabel } from '../utils/formatters';
import { t } from '../utils/i18n';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const Payables = () => {
  const [payables, setPayables] = useState([]);
  const [stats, setStats] = useState({
    totalPayables: 0,
    overdueAmount: 0,
    dueThisWeek: 0,
    paidThisMonth: 0
  });
  const [aging, setAging] = useState({
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'bank',
    reference: '',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderForm, setReminderForm] = useState({
    daysBeforeDue: 7,
    reminderType: 'dashboard',
    message: ''
  });

  useEffect(() => {
    fetchPayables();
    fetchStats();
    fetchAging();
  }, []);

  const fetchPayables = async () => {
    try {
      const response = await fetch(`${API_URL}/payables`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        const payablesArray = data.payables || [];
        setPayables(payablesArray.map(p => ({
          id: p.id,
          supplier: p.supplierName || p.supplier,
          poReference: p.poNumber || p.poId || '-',
          amount: (p.amount || 0),
          paid: (p.paidAmount || 0),
          dueDate: p.dueDate,
          daysRemaining: p.daysRemaining,
          creditDays: p.creditDays || 30,
          paymentTerms: p.paymentTerms || 'آجل',
          status: p.status
        })));
      } else {
        setPayables([]);
      }
    } catch (error) {
      console.error('Error fetching payables:', error);
      setPayables([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/payables/dashboard`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalPayables: (data.totalOutstanding || 0),
          overdueAmount: (data.overdueAmount || 0),
          dueThisWeek: (data.dueThisWeek || 0),
          paidThisMonth: (data.paidThisMonth || 0)
        });
      } else {
        setStats({ totalPayables: 0, overdueAmount: 0, dueThisWeek: 0, paidThisMonth: 0 });
      }
    } catch (error) {
      console.error('Error fetching payables stats:', error);
      setStats({ totalPayables: 0, overdueAmount: 0, dueThisWeek: 0, paidThisMonth: 0 });
    }
  };

  const fetchAging = async () => {
    try {
      const response = await fetch(`${API_URL}/payables`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        const buckets = data.agingBuckets || {};
        setAging({
          current: (buckets.current || 0),
          days1to30: (buckets['1-30'] || 0),
          days31to60: (buckets['31-60'] || 0),
          days61to90: (buckets['61-90'] || 0),
          days90plus: (buckets['90+'] || 0)
        });
      } else {
        setAging({ current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 });
      }
    } catch (error) {
      console.error('Error fetching payables aging:', error);
      setAging({ current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 });
    }
  };

  const getDaysOutstanding = (dueDate) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'badge-success';
      case 'partial': return 'badge-warning';
      case 'pending': return 'badge-info';
      case 'overdue': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const handlePaymentClick = (payable) => {
    setSelectedPayable(payable);
    setPaymentForm({
      amount: payable.amount - (payable.paid || 0),
      method: 'bank',
      reference: '',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handleViewClick = (payable) => {
    setSelectedPayable(payable);
    setShowViewModal(true);
  };

  const handleReminderClick = (payable) => {
    setSelectedPayable(payable);
    setReminderForm({
      daysBeforeDue: 7,
      reminderType: 'dashboard',
      message: `${t('payables.reminderSetFor')} ${payable.supplier}`
    });
    setShowReminderModal(true);
  };

  const handleReminderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPayable) return;
    
    try {
      const response = await fetch(`${API_URL}/payables/${selectedPayable.id}/reminders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          daysBeforeDue: parseInt(reminderForm.daysBeforeDue),
          reminderType: reminderForm.reminderType,
          message: reminderForm.message
        })
      });
      
      if (response.ok) {
        alert(t('payables.reminderSetFor') + ' ' + selectedPayable.supplier + ' - ' + reminderForm.daysBeforeDue + ' ' + t('payables.daysBeforeDue'));
        setShowReminderModal(false);
        setSelectedPayable(null);
      } else {
        const error = await response.json();
        alert(error.message || t('payables.failedSetReminder'));
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
      alert(t('payables.reminderSavedLocally'));
      setShowReminderModal(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPayable || !paymentForm.amount) {
      alert(t('payables.paymentAmountRequired'));
      return;
    }
    
    const paymentAmount = parseFloat(paymentForm.amount);
    const remainingBalance = selectedPayable.amount - (selectedPayable.paid || 0);
    
    if (paymentAmount <= 0) {
      alert(t('payables.amountGreaterThanZero'));
      return;
    }
    
    if (paymentAmount > remainingBalance) {
      alert(t('payables.amountExceedsBalance') + ' EGP ' + formatNumber(remainingBalance));
      return;
    }
    
    try {
      // Call API to record payment
      const response = await fetch(`${API_URL}/payables/${selectedPayable.id}/pay`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          amount: paymentAmount,
          method: paymentForm.method,
          reference: paymentForm.reference,
          notes: paymentForm.notes,
          date: new Date().toISOString().split('T')[0]
        })
      });
      
      if (response.ok) {
        alert(t('payables.paymentRecorded') + ' EGP ' + formatNumber(paymentAmount) + ' ' + t('payables.successfully'));
        fetchPayables(); // Refresh from API
      } else {
        const error = await response.json();
        alert(error.message || t('payables.paymentFailed'));
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      // Fallback: update local state
      const updatedPayables = payables.map(p => {
        if (p.id === selectedPayable.id) {
          const newPaid = (p.paid || 0) + paymentAmount;
          const newBalance = p.amount - newPaid;
          return {
            ...p,
            paid: newPaid,
            balance: newBalance,
            status: newBalance <= 0 ? 'paid' : 'partial',
            payments: [
              ...(p.payments || []),
              {
                date: new Date().toISOString().split('T')[0],
                amount: paymentAmount,
                method: paymentForm.method,
                reference: paymentForm.reference,
                notes: paymentForm.notes
              }
            ]
          };
        }
        return p;
      });
      setPayables(updatedPayables);
      alert(t('payables.paymentRecorded') + ' EGP ' + formatNumber(paymentAmount) + ' ' + t('payables.paymentRecordedLocally'));
    }
    
    setShowPaymentModal(false);
    setSelectedPayable(null);
    setPaymentForm({ amount: '', method: 'bank', reference: '', notes: '' });
  };

  return (
    <div className="payables-container">
      <div className="page-header">
        <h1>{t('payables.title')}</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('finance.totalPayables')}</div>
          <div className="stat-value">{formatCurrency(stats.totalPayables)}</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-label">{t('finance.overdueAmount')}</div>
          <div className="stat-value">{formatCurrency(stats.overdueAmount)}</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-label">{t('dashboard.dueThisWeek')}</div>
          <div className="stat-value">{formatCurrency(stats.dueThisWeek)}</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-label">{t('finance.paidThisMonth')}</div>
          <div className="stat-value">{formatCurrency(stats.paidThisMonth)}</div>
        </div>
      </div>

      <div className="section-card">
        <h2>{t('finance.agingReport')}</h2>
        <div className="aging-table-container">
          <table className="aging-table">
            <thead>
              <tr>
                <th>{t('finance.current')}</th>
                <th>1-30 يوم</th>
                <th>31-60 يوم</th>
                <th>61-90 يوم</th>
                <th>+90 يوم</th>
                <th>{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="amount-cell aging-current">{formatCurrency(aging.current)}</td>
                <td className="amount-cell aging-30">{formatCurrency(aging.days1to30)}</td>
                <td className="amount-cell aging-60">{formatCurrency(aging.days31to60)}</td>
                <td className="amount-cell aging-90">{formatCurrency(aging.days61to90)}</td>
                <td className="amount-cell aging-90plus">{formatCurrency(aging.days90plus)}</td>
                <td className="amount-cell total">{formatCurrency(
                  aging.current + aging.days1to30 + aging.days31to60 + aging.days61to90 + aging.days90plus
                )}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <h2>{t('payables.list')}</h2>
          <div className="filter-controls">
            <input 
              type="text" 
              placeholder={t('common.searchSuppliers')} 
              className="search-input" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">{t('common.allLabel')}</option>
              <option value="pending">{t('common.statuses.pending')}</option>
              <option value="partial">{t('finance.partial')}</option>
              <option value="paid">{t('common.statuses.paid')}</option>
              <option value="overdue">{t('common.statuses.overdue')}</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.supplier')}</th>
                <th>{t('payables.poRef')}</th>
                <th className="amount-cell">{t('common.amount')}</th>
                <th className="amount-cell">{t('common.statuses.paid')}</th>
                <th className="amount-cell">{t('common.balance')}</th>
                <th>{t('payables.creditTerms')}</th>
                <th>{t('orders.dueDate')}</th>
                <th>الأيام المتبقية</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {payables
                .filter(p => {
                  const matchesSearch = !searchTerm || 
                    p.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.poReference?.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesStatus = !statusFilter || p.status === statusFilter;
                  return matchesSearch && matchesStatus;
                })
                .map((payable) => (
                <tr key={payable.id}>
                  <td>{payable.supplier}</td>
                  <td>{payable.poReference}</td>
                  <td className="amount-cell">{formatCurrency(payable.amount)}</td>
                  <td className="amount-cell">{formatCurrency(payable.paid)}</td>
                  <td className="amount-cell">{formatCurrency(payable.amount - payable.paid)}</td>
                  <td>
                    <span className="badge badge-info" style={{ fontSize: '11px' }}>
                      {payable.paymentTerms} ({payable.creditDays}d)
                    </span>
                  </td>
                  <td>{formatDate(payable.dueDate)}</td>
                  <td>
                    <span 
                      className={`badge ${
                        payable.daysRemaining < 0 ? 'badge-danger' : 
                        payable.daysRemaining <= 7 ? 'badge-warning' : 
                        'badge-success'
                      }`}
                      style={{ fontSize: '11px' }}
                    >
                      {payable.daysRemaining < 0
                        ? `متأخر ${Math.abs(payable.daysRemaining)} يوم`
                        : `متبقي ${payable.daysRemaining} يوم`}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(payable.status)}`}>
                      {getStatusLabel(payable.status)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {payable.status !== 'paid' && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePaymentClick(payable)}
                          >
                            دفع
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleReminderClick(payable)}
                            title="تعيين تذكير"
                          >
                            تذكير
                          </button>
                        </>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewClick(payable)}
                      >
                        عرض
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '520px', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            {/* Dark navy header */}
            <div style={{ background: '#1a2332', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px', fontWeight: 700 }}>تسجيل دفعة</h3>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', width: '28px', height: '28px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={handlePaymentSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Read-only info card */}
              <div style={{ background: '#f8f9fa', borderRadius: '8px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>{t('common.supplier')}</p>
                  <p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: '15px' }}>{selectedPayable?.supplier}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>{t('payables.balanceDue')}</p>
                  <p style={{ fontWeight: 700, color: '#10b981', margin: 0, fontSize: '15px' }}>{formatCurrency(selectedPayable?.amount - selectedPayable?.paid)}</p>
                </div>
              </div>

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
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    required min="0" step="0.01"
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
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  style={{ width: '100%', height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1e293b', background: 'white', direction: 'rtl', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                >
                  <option value="cash">{t('common.cash')}</option>
                  <option value="bank">{t('common.bankTransfer')}</option>
                  <option value="cheque">{t('common.cheque')}</option>
                </select>
              </div>

              {/* Reference */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>الرقم المرجعي</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder={t('payables.transactionId')}
                  style={{ width: '100%', height: '44px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1e293b', outline: 'none', boxSizing: 'border-box', direction: 'rtl' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: '#374151', fontSize: '14px', marginBottom: '6px' }}>{t('common.notes')}</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows="3"
                  placeholder={t('payables.paymentNotes')}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: '#1e293b', outline: 'none', resize: 'vertical', direction: 'rtl', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={(e) => e.target.style.borderColor = '#10b981'}
                  onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setShowPaymentModal(false)}
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

      {/* View Payable Details Modal */}
      {showViewModal && selectedPayable && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تفاصيل الدفع</h3>
              <button
                className="modal-close"
                onClick={() => setShowViewModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('common.supplier')}</label>
                  <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{selectedPayable.supplier}</div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('payables.poRef')}</label>
                  <div style={{ fontWeight: 600 }}>{selectedPayable.poReference}</div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>المبلغ الإجمالي</label>
                  <div style={{ fontWeight: 600, color: '#3b82f6' }}>{formatCurrency(selectedPayable.amount)}</div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('finance.paidAmount')}</label>
                  <div style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(selectedPayable.paid || 0)}</div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('common.balance')}</label>
                  <div style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(selectedPayable.amount - (selectedPayable.paid || 0))}</div>
                </div>
                <div>
                  <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('orders.dueDate')}</label>
                  <div style={{ fontWeight: 600 }}>{formatDate(selectedPayable.dueDate)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('common.status')}</label>
                <div>
                  <span className={`badge ${getStatusBadgeClass(selectedPayable.status)}`}>
                    {selectedPayable.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {selectedPayable.payments && selectedPayable.payments.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '12px', color: '#1e293b' }}>سجل المدفوعات</h4>
                  <table className="data-table" style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>{t('common.date')}</th>
                        <th className="amount-cell">{t('common.amount')}</th>
                        <th>{t('common.method')}</th>
                        <th>{t('common.reference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPayable.payments.map((payment, idx) => (
                        <tr key={idx}>
                          <td>{payment.date}</td>
                          <td className="amount-cell" style={{ color: '#10b981' }}>
                            {formatCurrency(payment.amount)}
                          </td>
                          <td>{payment.method}</td>
                          <td>{payment.reference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedPayable.status !== 'paid' && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowViewModal(false);
                    handlePaymentClick(selectedPayable);
                  }}
                >
                  تسجيل دفعة
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && selectedPayable && (
        <div className="modal-overlay" onClick={() => setShowReminderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تعيين تذكير</h3>
              <button
                className="modal-close"
                onClick={() => setShowReminderModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleReminderSubmit} className="modal-form">
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px' }}>
                <label style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('common.supplier')}</label>
                <div style={{ fontWeight: 600 }}>{selectedPayable.supplier}</div>
                <label style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '8px', display: 'block' }}>{t('orders.dueDate')}</label>
                <div style={{ fontWeight: 600 }}>{formatDate(selectedPayable.dueDate)}</div>
                <label style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '8px', display: 'block' }}>{t('common.balance')}</label>
                <div style={{ fontWeight: 600, color: '#ef4444' }}>
                  {formatCurrency(selectedPayable.amount - selectedPayable.paid)}
                </div>
              </div>
              
              <div className="form-group">
                <label>تذكيري قبل (عدد الأيام قبل الاستحقاق)</label>
                <select
                  value={reminderForm.daysBeforeDue}
                  onChange={(e) => setReminderForm({ ...reminderForm, daysBeforeDue: e.target.value })}
                  className="form-input"
                >
                  <option value="1">{t('common.days', { n: 1 })}</option>
                  <option value="3">{t('common.days', { n: 3 })}</option>
                  <option value="7">{t('common.days', { n: 7 })}</option>
                  <option value="14">{t('common.days', { n: 14 })}</option>
                  <option value="30">{t('common.days', { n: 30 })}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>نوع التذكير</label>
                <select
                  value={reminderForm.reminderType}
                  onChange={(e) => setReminderForm({ ...reminderForm, reminderType: e.target.value })}
                  className="form-input"
                >
                  <option value="dashboard">{t('payables.dashboardAlert')}</option>
                  <option value="email">{t('common.email')}</option>
                  <option value="sms">رسالة نصية</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>الرسالة (اختياري)</label>
                <textarea
                  value={reminderForm.message}
                  onChange={(e) => setReminderForm({ ...reminderForm, message: e.target.value })}
                  rows="2"
                  placeholder={t('payables.reminderMessage')}
                  className="form-input"
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-warning">
                  {t('payables.setReminderBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payables;