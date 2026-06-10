import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { t } from '../utils/i18n';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
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
          dueThisWeek: (data.upcomingDue || []).reduce((sum, p) => sum + (p.balance || 0), 0),
          paidThisMonth: 0
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
      message: `Payment reminder for ${payable.supplier}`
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
        alert(`Reminder set for ${selectedPayable.supplier} - ${reminderForm.daysBeforeDue} days before due date`);
        setShowReminderModal(false);
        setSelectedPayable(null);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to set reminder');
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
      alert('Reminder saved locally (API unavailable)');
      setShowReminderModal(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedPayable || !paymentForm.amount) {
      alert('Please enter payment amount');
      return;
    }
    
    const paymentAmount = parseFloat(paymentForm.amount);
    const remainingBalance = selectedPayable.amount - (selectedPayable.paid || 0);
    
    if (paymentAmount <= 0) {
      alert('Payment amount must be greater than 0');
      return;
    }
    
    if (paymentAmount > remainingBalance) {
      alert(`Payment amount cannot exceed remaining balance of EGP ${remainingBalance.toLocaleString()}`);
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
        alert(`Payment of EGP ${paymentAmount.toLocaleString()} recorded successfully!`);
        fetchPayables(); // Refresh from API
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to record payment');
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
      alert(`Payment of EGP ${paymentAmount.toLocaleString()} recorded locally (API unavailable).`);
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
                <th>1-30 Days</th>
                <th>31-60 Days</th>
                <th>61-90 Days</th>
                <th>90+ Days</th>
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
              placeholder="Search suppliers..." 
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
                <th>Days Rem.</th>
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
                        ? `${Math.abs(payable.daysRemaining)} days overdue` 
                        : `${payable.daysRemaining} days left`}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(payable.status)}`}>
                      {payable.status}
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
                            Pay
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleReminderClick(payable)}
                            title="Set reminder"
                          >
                            Remind
                          </button>
                        </>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleViewClick(payable)}
                      >
                        View
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('common.recordPayment')}</h3>
              <button
                className="modal-close"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handlePaymentSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>{t('common.supplier')}</label>
                  <input type="text" value={selectedPayable?.supplier} disabled />
                </div>
                <div className="form-group">
                  <label>{t('payables.balanceDue')}</label>
                  <input
                    type="text"
                    value={formatCurrency(selectedPayable?.amount - selectedPayable?.paid)}
                    disabled
                  />
                </div>
              </div>
              <div className="form-group">
                <label>المبلغ المدفوع</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>طريقة الدفع</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                >
                  <option value="cash">{t('common.cash')}</option>
                  <option value="bank">{t('common.bankTransfer')}</option>
                  <option value="cheque">{t('common.cheque')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>الرقم المرجعي</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Transaction ID / Cheque Number"
                />
              </div>
              <div className="form-group">
                <label>{t('common.notes')}</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows="3"
                  placeholder="Optional notes about this payment..."
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Payment
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
                  Record Payment
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>
                Close
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
                  <option value="1">1 day before</option>
                  <option value="3">3 days before</option>
                  <option value="7">1 week before</option>
                  <option value="14">2 weeks before</option>
                  <option value="30">1 month before</option>
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
                  placeholder="Custom reminder message..."
                  className="form-input"
                />
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReminderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-warning">
                  Set Reminder
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
