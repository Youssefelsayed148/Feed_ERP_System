import React, { useState, useEffect } from 'react';
import {
  DollarSign, AlertTriangle, CheckCircle, Clock,
  Plus, Trash2, Edit, Save, X, Calendar,
  CreditCard, Wallet, FileText, TrendingDown,
  TrendingUp, AlertCircle, ChevronDown, ChevronRight,
  Receipt, ArrowRightCircle, History, Flag
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { t } from '../utils/i18n';

// API Base
const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

// Helper functions
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const getDaysUntilDue = (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getStatusBadge = (status) => {
  const badges = {
    pending: { class: 'badge', label: t('common.statuses.pending') },
    partial: { class: 'badge badge-warning', label: t('finance.partial') },
    paid: { class: 'badge badge-success', label: t('common.statuses.paid') },
    overdue: { class: 'badge badge-danger', label: t('common.statuses.overdue') },
    cancelled: { class: 'badge', label: t('common.statuses.cancelled') }
  };
  return badges[status] || badges.pending;
};

const getLiabilityTypeLabel = (type) => {
  const labels = {
    previous_balance: t('clients.previousBalance'),
    invoice: t('common.invoice'),
    loan: t('finance.partial'),
    other: t('common.other')
  };
  return labels[type] || t('common.other');
};

const getLiabilityTypeIcon = (type) => {
  const icons = {
    previous_balance: History,
    invoice: FileText,
    loan: CreditCard,
    other: DollarSign
  };
  const Icon = icons[type] || DollarSign;
  return <Icon className="w-4 h-4" />;
};

const calculateProgress = (paid, total) => {
  if (!total || total === 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
};

// Summary Cards Component
const SummaryCards = ({ client, liabilities, expectedPayments, totalPaymentsReceived, overviewOverdueAmount, overviewTotalPending, overviewTotalAmount }) => {
  const totalLiabilities = liabilities.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalPaidLiabilities = liabilities.reduce((sum, l) => sum + (l.paidAmount || 0), 0);
  const totalPaid = totalPaymentsReceived !== undefined ? totalPaymentsReceived : totalPaidLiabilities;
  const outstandingBalance = overviewTotalPending !== undefined ? overviewTotalPending : liabilities
    .filter(l => l.status !== 'paid' && l.status !== 'cancelled')
    .reduce((sum, l) => sum + (l.remainingAmount || 0), 0);
  const overdueAmount = overviewOverdueAmount !== undefined ? overviewOverdueAmount : liabilities
    .filter(l => l.status !== 'paid' && l.status !== 'cancelled' && new Date(l.dueDate || l.due_date) < new Date())
    .reduce((sum, l) => sum + (l.remainingAmount || l.amount || 0), 0);
  const totalExpected = expectedPayments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  // Use overview totalAmount for first card when available (matches Overview tab)
  const displayAmount = overviewTotalAmount !== undefined ? overviewTotalAmount : totalLiabilities;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="stat-card bg-red-50 border-red-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label text-red-700">{t(overviewTotalAmount !== undefined ? 'orders.title' : 'clients.totalLiabilities')}</p>
            <p className="stat-value text-red-600">{formatCurrency(displayAmount)}</p>
          </div>
          <div className="stat-icon bg-red-100 text-red-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="stat-card bg-green-50 border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label text-green-700">{t('clients.totalPaid')}</p>
            <p className="stat-value text-green-600">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="stat-icon bg-green-100 text-green-600">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="stat-card bg-yellow-50 border-yellow-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label text-yellow-700">{t('clients.outstanding')}</p>
            <p className="stat-value text-yellow-600">{formatCurrency(outstandingBalance)}</p>
          </div>
          <div className="stat-icon bg-yellow-100 text-yellow-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="stat-card bg-orange-50 border-orange-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label text-orange-700">{t('common.statuses.overdue')}</p>
            <p className="stat-value text-orange-600">{formatCurrency(overdueAmount)}</p>
          </div>
          <div className="stat-icon bg-orange-100 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="stat-card bg-blue-50 border-blue-200 md:col-span-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="stat-label text-blue-700">{t('clients.expectedPayments')}</p>
            <p className="stat-value text-blue-600">{formatCurrency(totalExpected)}</p>
          </div>
          <div className="stat-icon bg-blue-100 text-blue-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Add Liability Modal
const AddLiabilityModal = ({ isOpen, onClose, onSave, client }) => {
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'previous_balance',
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: '',
        description: '',
        type: 'previous_balance',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        notes: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const liability = {
      amount: parseFloat(formData.amount),
      description: formData.description,
      type: formData.type,
      date: new Date(formData.date),
      dueDate: new Date(formData.dueDate),
      notes: formData.notes,
      status: 'pending',
      payments: [],
      invoices: []
    };
    onSave(liability);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{t('clients.addLiability')}</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Amount (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="form-input"
                  placeholder="Enter amount"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="form-select"
                >
                  <option value="previous_balance">Previous Balance</option>
                  <option value="invoice">Invoice</option>
                  <option value="loan">Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Due Date *</label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description *</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="form-input"
                  placeholder="Enter description"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="form-textarea"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-danger">
              {t('clients.addLiability')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Payment Modal
const AddPaymentModal = ({ isOpen, onClose, onSave, liability }) => {
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const remainingAmount = liability ? (liability.remainingAmount || 0) : 0;

  useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: remainingAmount > 0 ? Math.min(remainingAmount, 100000).toString() : '',
        method: 'cash',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
    }
  }, [isOpen, remainingAmount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payment = {
      amount: parseFloat(formData.amount),
      method: formData.method,
      reference: formData.reference,
      date: new Date(formData.date),
      notes: formData.notes
    };
    onSave(payment);
  };

  if (!isOpen || !liability) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Record Payment</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-600">Liability: {liability.description}</p>
              <p className="text-sm font-semibold">
                Total: {formatCurrency(liability.amount)} | 
                Remaining: {formatCurrency(remainingAmount)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Payment Amount (EGP) *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  max={remainingAmount}
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select
                  required
                  value={formData.method}
                  onChange={(e) => setFormData({...formData, method: e.target.value})}
                  className="form-select"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  Reference {formData.method === 'bank_transfer' ? '(Transaction ID)' : formData.method === 'cheque' ? '(Cheque #)' : ''}
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({...formData, reference: e.target.value})}
                  className="form-input"
                  placeholder="Reference number"
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="form-textarea"
                  rows={2}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-success">
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Add Expected Payment Modal
const AddExpectedPaymentModal = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    amount: '',
    expectedDate: '',
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        amount: '',
        expectedDate: '',
        description: ''
      });
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payment = {
      amount: parseFloat(formData.amount),
      expectedDate: new Date(formData.expectedDate),
      description: formData.description,
      status: 'pending'
    };
    onSave(payment);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 2000 }}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Add Expected Payment</h2>
          <button onClick={onClose} className="modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Expected Amount (EGP) *</label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Date *</label>
              <input
                type="date"
                required
                value={formData.expectedDate}
                onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="form-input"
                placeholder="e.g., Monthly installment"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Expected Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Liability Row Component
const LiabilityRow = ({ liability, onAddPayment, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const daysUntilDue = getDaysUntilDue(liability.dueDate);
  const progress = calculateProgress(liability.paidAmount, liability.amount);

  let dueBadge = null;
  if (liability.status === 'overdue') {
    dueBadge = <span className="badge badge-danger ml-2">Overdue</span>;
  } else if (daysUntilDue <= 7 && daysUntilDue > 0) {
    dueBadge = <span className="badge badge-warning ml-2">Due in {daysUntilDue} days</span>;
  } else if (daysUntilDue <= 0 && liability.status !== 'paid') {
    dueBadge = <span className="badge badge-danger ml-2">Due today</span>;
  }

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden ${liability.status === 'overdue' ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${liability.status === 'paid' ? 'bg-green-100 text-green-600' : liability.status === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {getLiabilityTypeIcon(liability.type)}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{liability.description}</p>
            <p className="text-sm text-gray-500">
              {getLiabilityTypeLabel(liability.type)} • {formatDate(liability.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{formatCurrency(liability.remainingAmount)}</p>
            <p className="text-xs text-gray-500">
              of {formatCurrency(liability.amount)}
            </p>
          </div>
          <span className={getStatusBadge(liability.status).class}>
            {getStatusBadge(liability.status).label}
          </span>
          {dueBadge}
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Payment Progress</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${progress === 100 ? 'bg-green-500' : progress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Paid: {formatCurrency(liability.paidAmount || 0)}</span>
              <span>Remaining: {formatCurrency(liability.remainingAmount || 0)}</span>
            </div>
          </div>

          {/* Payment History */}
          {liability.payments && liability.payments.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                {t('clients.paymentHistory')}
              </h4>
              <div className="table-container">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('common.amount')}</th>
                      <th>{t('common.method')}</th>
                      <th>{t('common.reference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liability.payments.map((payment, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(payment.date)}</td>
                        <td className="font-semibold text-green-600">{formatCurrency(payment.amount)}</td>
                        <td>
                          <span className="badge badge-primary capitalize">
                            {payment.method?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-sm text-gray-600">{payment.reference || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {liability.notes && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-1">{t('common.notes')}</h4>
              <p className="text-sm text-gray-600 bg-white p-2 rounded">{liability.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {liability.status !== 'paid' && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddPayment(liability); }}
                className="btn btn-sm btn-success"
              >
                <Wallet className="w-4 h-4 mr-1" />
                {t('clients.addPayment')}
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(liability._id); }}
              className="btn btn-sm btn-outline btn-danger"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t('common.delete')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Expected Payment Row Component
const ExpectedPaymentRow = ({ payment, onMarkReceived, onDelete }) => {
  const daysUntilExpected = getDaysUntilDue(payment.expectedDate);
  const isOverdue = daysUntilExpected < 0 && payment.status === 'pending';

  return (
    <div className={`border rounded-lg p-3 mb-2 flex items-center justify-between ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${payment.status === 'received' ? 'bg-green-100 text-green-600' : isOverdue ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          <Calendar className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{payment.description}</p>
          <p className="text-sm text-gray-500">
            Expected: {formatDate(payment.expectedDate)}
            {isOverdue && <span className="badge badge-danger ml-2">Overdue</span>}
            {!isOverdue && daysUntilExpected <= 7 && payment.status === 'pending' && (
              <span className="badge badge-warning ml-2">In {daysUntilExpected} days</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-semibold">{formatCurrency(payment.amount)}</span>
        <span className={getStatusBadge(payment.status).class}>
          {getStatusBadge(payment.status).label}
        </span>
        {payment.status === 'pending' && (
          <button
            onClick={() => onMarkReceived(payment._id)}
            className="btn btn-sm btn-success"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Mark Received
          </button>
        )}
        <button
          onClick={() => onDelete(payment._id)}
          className="btn btn-sm btn-outline"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Main ClientLiabilities Component
const ClientLiabilities = ({ client, onUpdate, totalPaymentsReceived, overviewOverdueAmount, overviewTotalPending, overviewTotalAmount }) => {
  const [liabilities, setLiabilities] = useState(client.liabilities || []);
  const [expectedPayments, setExpectedPayments] = useState(client.expectedPayments || []);
  const [activeTab, setActiveTab] = useState('liabilities');
  const [showAddLiabilityModal, setShowAddLiabilityModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [selectedLiability, setSelectedLiability] = useState(null);
  const [showAddExpectedModal, setShowAddExpectedModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');

  // Update liabilities when client changes
  useEffect(() => {
    setLiabilities(client.liabilities || []);
    setExpectedPayments(client.expectedPayments || []);
  }, [client]);

  // Auto-update status based on due dates
  useEffect(() => {
    const today = new Date();
    const updatedLiabilities = liabilities.map(liability => {
      if (liability.status === 'paid' || liability.status === 'cancelled') {
        return liability;
      }
      const dueDate = new Date(liability.dueDate);
      if (dueDate < today && liability.status !== 'overdue') {
        return { ...liability, status: 'overdue' };
      }
      return liability;
    });
    
    if (JSON.stringify(updatedLiabilities) !== JSON.stringify(liabilities)) {
      setLiabilities(updatedLiabilities);
    }
  }, [liabilities]);

  const handleAddLiability = async (liabilityData) => {
    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/liabilities`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...liabilityData,
          remainingAmount: liabilityData.amount,
          paidAmount: 0
        })
      });

      if (response.ok) {
        const newLiability = await response.json();
        setLiabilities([...liabilities, newLiability]);
        setShowAddLiabilityModal(false);
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        const newLiability = {
          ...liabilityData,
          _id: `liab-${Date.now()}`,
          remainingAmount: liabilityData.amount,
          paidAmount: 0,
          status: 'pending',
          payments: [],
          invoices: []
        };
        setLiabilities([...liabilities, newLiability]);
        setShowAddLiabilityModal(false);
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error adding liability:', error);
      // Demo mode fallback
      const newLiability = {
        ...liabilityData,
        _id: `liab-${Date.now()}`,
        remainingAmount: liabilityData.amount,
        paidAmount: 0,
        status: 'pending',
        payments: [],
        invoices: []
      };
      setLiabilities([...liabilities, newLiability]);
      setShowAddLiabilityModal(false);
      onUpdate && onUpdate();
    }
  };

  const handleAddPayment = async (liabilityId, payment) => {
    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/liabilities/${liabilityId}/payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payment)
      });

      if (response.ok) {
        const updatedLiability = await response.json();
        setLiabilities(liabilities.map(l => l._id === liabilityId ? updatedLiability : l));
        setShowAddPaymentModal(false);
        setSelectedLiability(null);
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        const updatedLiabilities = liabilities.map(l => {
          if (l._id === liabilityId) {
            const newPaidAmount = (l.paidAmount || 0) + payment.amount;
            const newRemaining = l.amount - newPaidAmount;
            let newStatus = l.status;
            if (newRemaining <= 0) {
              newStatus = 'paid';
            } else if (newPaidAmount > 0) {
              newStatus = 'partial';
            }
            return {
              ...l,
              paidAmount: newPaidAmount,
              remainingAmount: Math.max(0, newRemaining),
              status: newStatus,
              payments: [...(l.payments || []), payment]
            };
          }
          return l;
        });
        setLiabilities(updatedLiabilities);
        setShowAddPaymentModal(false);
        setSelectedLiability(null);
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      // Demo mode fallback
      const updatedLiabilities = liabilities.map(l => {
        if (l._id === liabilityId) {
          const newPaidAmount = (l.paidAmount || 0) + payment.amount;
          const newRemaining = l.amount - newPaidAmount;
          let newStatus = l.status;
          if (newRemaining <= 0) {
            newStatus = 'paid';
          } else if (newPaidAmount > 0) {
            newStatus = 'partial';
          }
          return {
            ...l,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, newRemaining),
            status: newStatus,
            payments: [...(l.payments || []), payment]
          };
        }
        return l;
      });
      setLiabilities(updatedLiabilities);
      setShowAddPaymentModal(false);
      setSelectedLiability(null);
      onUpdate && onUpdate();
    }
  };

  const handleDeleteLiability = async (liabilityId) => {
    if (!window.confirm('Are you sure you want to delete this liability?')) return;

    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/liabilities/${liabilityId}`, {
        method: 'DELETE',
        headers: headers()
      });

      if (response.ok) {
        setLiabilities(liabilities.filter(l => l._id !== liabilityId));
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        setLiabilities(liabilities.filter(l => l._id !== liabilityId));
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error deleting liability:', error);
      // Demo mode fallback
      setLiabilities(liabilities.filter(l => l._id !== liabilityId));
      onUpdate && onUpdate();
    }
  };

  const handleAddExpectedPayment = async (payment) => {
    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/expected-payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payment)
      });

      if (response.ok) {
        const newPayment = await response.json();
        setExpectedPayments([...expectedPayments, newPayment]);
        setShowAddExpectedModal(false);
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        const newPayment = {
          ...payment,
          _id: `exp-${Date.now()}`
        };
        setExpectedPayments([...expectedPayments, newPayment]);
        setShowAddExpectedModal(false);
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error adding expected payment:', error);
      // Demo mode fallback
      const newPayment = {
        ...payment,
        _id: `exp-${Date.now()}`
      };
      setExpectedPayments([...expectedPayments, newPayment]);
      setShowAddExpectedModal(false);
      onUpdate && onUpdate();
    }
  };

  const handleMarkExpectedReceived = async (paymentId) => {
    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/expected-payments/${paymentId}/mark-received`, {
        method: 'POST',
        headers: headers()
      });

      if (response.ok) {
        setExpectedPayments(expectedPayments.map(p =>
          p._id === paymentId ? { ...p, status: 'received' } : p
        ));
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        setExpectedPayments(expectedPayments.map(p =>
          p._id === paymentId ? { ...p, status: 'received' } : p
        ));
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error marking expected payment:', error);
      // Demo mode fallback
      setExpectedPayments(expectedPayments.map(p =>
        p._id === paymentId ? { ...p, status: 'received' } : p
      ));
      onUpdate && onUpdate();
    }
  };

  const handleDeleteExpectedPayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this expected payment?')) return;

    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/expected-payments/${paymentId}`, {
        method: 'DELETE',
        headers: headers()
      });

      if (response.ok) {
        setExpectedPayments(expectedPayments.filter(p => p._id !== paymentId));
        onUpdate && onUpdate();
      } else {
        // Fallback for demo mode
        setExpectedPayments(expectedPayments.filter(p => p._id !== paymentId));
        onUpdate && onUpdate();
      }
    } catch (error) {
      console.error('Error deleting expected payment:', error);
      // Demo mode fallback
      setExpectedPayments(expectedPayments.filter(p => p._id !== paymentId));
      onUpdate && onUpdate();
    }
  };

  const openAddPayment = (liability) => {
    setSelectedLiability(liability);
    setShowAddPaymentModal(true);
  };

  // Filter and sort liabilities
  const filteredLiabilities = liabilities.filter(l => {
    if (dateFilter === 'all') return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(l.dueDate);
    const daysUntilDue = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    switch (dateFilter) {
      case 'overdue': return due < today && (l.status !== 'paid' && l.status !== 'cancelled');
      case 'thisWeek': return daysUntilDue >= 0 && daysUntilDue <= 7;
      case 'thisMonth': return daysUntilDue >= 0 && daysUntilDue <= 30;
      case 'next30': return daysUntilDue >= 0 && daysUntilDue <= 30;
      default: return true;
    }
  });
  
  const sortedLiabilities = [...filteredLiabilities].sort((a, b) => {
    // Sort by status priority: overdue > pending > partial > paid
    const statusPriority = { overdue: 0, pending: 1, partial: 2, paid: 3 };
    const priorityDiff = (statusPriority[a.status] || 4) - (statusPriority[b.status] || 4);
    if (priorityDiff !== 0) return priorityDiff;
    // Then by due date
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  // Filter and sort expected payments
  const sortedExpectedPayments = [...expectedPayments].sort((a, b) => {
    const statusPriority = { pending: 0, overdue: 1, received: 2, cancelled: 3 };
    const priorityDiff = (statusPriority[a.status] || 4) - (statusPriority[b.status] || 4);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(a.expectedDate) - new Date(b.expectedDate);
  });

  return (
    <div>
      {/* Summary Cards */}
      <SummaryCards
        client={client}
        liabilities={liabilities}
        expectedPayments={expectedPayments}
        totalPaymentsReceived={totalPaymentsReceived}
        overviewOverdueAmount={overviewOverdueAmount}
        overviewTotalPending={overviewTotalPending}
        overviewTotalAmount={overviewTotalAmount}
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          onClick={() => setActiveTab('liabilities')}
          className={`px-4 py-2 font-medium ${activeTab === 'liabilities' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          {t('clients.liabilities')} ({liabilities.length})
        </button>
        <button
          onClick={() => setActiveTab('expected')}
          className={`px-4 py-2 font-medium ${activeTab === 'expected' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          {t('clients.expectedPayments')} ({expectedPayments.filter(p => p.status === 'pending').length})
        </button>
      </div>

      {/* Liabilities Tab */}
      {activeTab === 'liabilities' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t('clients.clientLiabilities')}</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddLiabilityModal(true)}
                className="btn btn-danger"
              >
                <Plus className="w-4 h-4 mr-1" />
                {t('clients.addLiability')}
              </button>
            </div>
          </div>

          {/* Date Filter Bar */}
          <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg border">
            <span className="text-sm text-gray-600 pt-1">{t('common.filterByDate')}:</span>
            {[['all', t('common.all')],['overdue', t('common.statuses.overdue')],['thisWeek', t('common.thisWeek')],['thisMonth', t('common.thisMonth')],['next30', t('common.next30Days')]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setDateFilter(k)}
                className={`px-3 py-1 rounded-full text-sm font-medium ${dateFilter === k ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-blue-50'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {sortedLiabilities.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('clients.noLiabilities')}</p>
              <button
                onClick={() => setShowAddLiabilityModal(true)}
                className="btn btn-outline mt-3"
              >
                {t('clients.addLiability')}
              </button>
            </div>
          ) : (
            <div>
              {sortedLiabilities.map(liability => (
                <LiabilityRow
                  key={liability._id}
                  liability={liability}
                  onAddPayment={openAddPayment}
                  onDelete={handleDeleteLiability}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expected Payments Tab */}
      {activeTab === 'expected' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Expected Payments</h3>
            <button
              onClick={() => setShowAddExpectedModal(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Expected Payment
            </button>
          </div>

          {sortedExpectedPayments.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No expected payments</p>
              <button
                onClick={() => setShowAddExpectedModal(true)}
                className="btn btn-outline mt-3"
              >
                Add Expected Payment
              </button>
            </div>
          ) : (
            <div>
              {sortedExpectedPayments.map(payment => (
                <ExpectedPaymentRow
                  key={payment._id}
                  payment={payment}
                  onMarkReceived={handleMarkExpectedReceived}
                  onDelete={handleDeleteExpectedPayment}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <AddLiabilityModal
        isOpen={showAddLiabilityModal}
        onClose={() => setShowAddLiabilityModal(false)}
        onSave={handleAddLiability}
        client={client}
      />

      <AddPaymentModal
        isOpen={showAddPaymentModal}
        onClose={() => { setShowAddPaymentModal(false); setSelectedLiability(null); }}
        onSave={(payment) => handleAddPayment(selectedLiability._id, payment)}
        liability={selectedLiability}
      />

      <AddExpectedPaymentModal
        isOpen={showAddExpectedModal}
        onClose={() => setShowAddExpectedModal(false)}
        onSave={handleAddExpectedPayment}
      />
    </div>
  );
};

export default ClientLiabilities;
