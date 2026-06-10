import React, { useState, useEffect, useMemo } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { t } from '../utils/i18n';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingExpenseId, setRejectingExpenseId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [editingExpense, setEditingExpense] = useState(null);

  const [formData, setFormData] = useState({
    category: 'utilities',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    receipt: null,
    notes: ''
  });

  const categories = [
    { value: 'salary', label: 'Salary & Wages', color: '#3498db' },
    { value: 'rent', label: 'Rent', color: '#9b59b6' },
    { value: 'utilities', label: 'مرافق', color: '#e74c3c' },
    { value: 'maintenance', label: t('nav.maintenance'), color: '#f39c12' },
    { value: 'fuel', label: 'Fuel', color: '#27ae60' },
    { value: 'raw_materials', label: 'مواد خام', color: '#1abc9c' },
    { value: 'packaging', label: 'تغليف', color: '#34495e' },
    { value: 'marketing', label: 'تسويق', color: '#e67e22' },
    { value: 'transportation', label: 'نقل', color: '#16a085' },
    { value: 'other', label: 'أخرى', color: '#95a5a6' }
  ];

  const paymentMethods = ['cash', 'bank', 'cheque', 'credit_card'];

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [expenses]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchExpenses = async () => {
    try {
      const response = await fetch(`${API_URL}/expenses`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        const expensesArray = data.expenses || [];
        setExpenses(expensesArray);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      setExpenses([]);
    }
  };

  const fetchStats = () => {
    const categoryStats = {};
    categories.forEach(cat => {
      categoryStats[cat.value] = {
        label: cat.label,
        amount: 0,
        color: cat.color,
        count: 0
      };
    });

    expenses.forEach(expense => {
      if (expense.status === 'approved' && categoryStats[expense.category]) {
        categoryStats[expense.category].amount += expense.amount;
        categoryStats[expense.category].count += 1;
      }
    });

    const monthlyStats = {};
    expenses.forEach(expense => {
      const month = expense.date.substring(0, 7);
      if (!monthlyStats[month]) {
        monthlyStats[month] = { amount: 0, count: 0 };
      }
      if (expense.status === 'approved') {
        monthlyStats[month].amount += expense.amount;
        monthlyStats[month].count += 1;
      }
    });

    const pendingCount = expenses.filter(e => e.status === 'pending').length;
    const totalApproved = expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0);

    setStats({
      category: categoryStats,
      monthly: monthlyStats,
      pendingCount,
      totalApproved,
      totalExpenses: expenses.length
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = 'Amount must be greater than 0';
    if (!formData.date) errors.date = 'Date is required';
    if (formData.receipt && formData.receipt.size > 5 * 1024 * 1024) {
      errors.receipt = 'File size must be less than 5MB';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: null });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors({ ...formErrors, receipt: 'File size must be less than 5MB' });
        return;
      }
      setIsUploading(true);
      setUploadProgress(0);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      setFormData({ ...formData, receipt: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const expenseData = {
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount),
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      notes: formData.notes
    };

    try {
      if (editingExpense) {
        const response = await fetch(`${API_URL}/expenses/${editingExpense._id || editingExpense.id}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(expenseData)
        });
        
        if (response.ok) {
          setSuccessMessage('Expense updated successfully!');
          fetchExpenses();
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to update expense');
        }
        setEditingExpense(null);
      } else {
        const response = await fetch(`${API_URL}/expenses`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(expenseData)
        });
        
        if (response.ok) {
          setSuccessMessage('Expense created successfully!');
          fetchExpenses();
        } else {
          const error = await response.json();
          alert(error.message || 'Failed to create expense');
        }
      }
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Failed to save expense. Please try again.');
    }

    setShowForm(false);
    setFormData({
      category: 'utilities',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      receipt: null,
      notes: ''
    });
    setFormErrors({});
    setUploadProgress(0);
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`${API_URL}/expenses/${id}/approve`, {
        method: 'PUT',
        headers: headers()
      });
      
      if (response.ok) {
        setSuccessMessage('Expense approved successfully!');
        fetchExpenses();
        if (selectedExpense && (selectedExpense._id === id || selectedExpense.id === id)) {
          setSelectedExpense({ ...selectedExpense, status: 'approved', approvedBy: 'Current User' });
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to approve expense');
      }
    } catch (error) {
      console.error('Error approving expense:', error);
      alert('Failed to approve expense. Please try again.');
    }
  };

  const handleRejectClick = (id) => {
    setRejectingExpenseId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) {
      return;
    }
    try {
      const response = await fetch(`${API_URL}/expenses/${rejectingExpenseId}/reject`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ reason: rejectReason })
      });
      
      if (response.ok) {
        setSuccessMessage('Expense rejected successfully!');
        fetchExpenses();
        if (selectedExpense && (selectedExpense._id === rejectingExpenseId || selectedExpense.id === rejectingExpenseId)) {
          setSelectedExpense({ ...selectedExpense, status: 'rejected', rejectReason, approvedBy: null });
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reject expense');
      }
    } catch (error) {
      console.error('Error rejecting expense:', error);
      alert('Failed to reject expense. Please try again.');
    }
    setShowRejectModal(false);
    setRejectingExpenseId(null);
    setRejectReason('');
  };

  const handleView = (expense) => {
    setSelectedExpense(expense);
    setShowDetailModal(true);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      paymentMethod: expense.paymentMethod,
      receipt: null,
      notes: expense.notes || ''
    });
    setShowForm(true);
    setShowDetailModal(false);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedExpense(null);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedExpenses(filteredExpenses.map(e => e.id));
    } else {
      setSelectedExpenses([]);
    }
  };

  const handleSelectExpense = (id) => {
    if (selectedExpenses.includes(id)) {
      setSelectedExpenses(selectedExpenses.filter(eid => eid !== id));
    } else {
      setSelectedExpenses([...selectedExpenses, id]);
    }
  };

  const handleBulkApprove = async () => {
    try {
      const pendingIds = selectedExpenses.filter(id => {
        const exp = expenses.find(e => e._id === id || e.id === id);
        return exp && exp.status === 'pending';
      });
      
      await Promise.all(pendingIds.map(id => 
        fetch(`${API_URL}/expenses/${id}/approve`, {
          method: 'PUT',
          headers: headers()
        })
      ));
      
      setSuccessMessage(`${pendingIds.length} expenses approved!`);
      fetchExpenses();
    } catch (error) {
      console.error('Error bulk approving:', error);
      alert('Failed to approve some expenses. Please try again.');
    }
    setSelectedExpenses([]);
  };

  const handleBulkReject = async () => {
    const reason = prompt('Enter rejection reason for all selected expenses:');
    if (!reason) return;
    
    try {
      const pendingIds = selectedExpenses.filter(id => {
        const exp = expenses.find(e => e._id === id || e.id === id);
        return exp && exp.status === 'pending';
      });
      
      await Promise.all(pendingIds.map(id => 
        fetch(`${API_URL}/expenses/${id}/reject`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ reason })
        })
      ));
      
      setSuccessMessage(`${pendingIds.length} expenses rejected!`);
      fetchExpenses();
    } catch (error) {
      console.error('Error bulk rejecting:', error);
      alert('Failed to reject some expenses. Please try again.');
    }
    setSelectedExpenses([]);
  };

  const exportToCSV = (data = filteredExpenses) => {
    const headers = ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Status', 'Approved By'];
    const rows = data.map(exp => [
      exp.date,
      getCategoryLabel(exp.category),
      exp.description,
      exp.amount,
      exp.paymentMethod,
      exp.status,
      exp.approvedBy || '-'
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSuccessMessage(`Exported ${data.length} expenses to CSV!`);
  };

  const exportToPDF = () => {
    const printContent = `
      <html>
        <head>
          <title>{t('expenses.report')}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .status-approved { color: green; }
            .status-pending { color: orange; }
            .status-rejected { color: red; }
          </style>
        </head>
        <body>
          <h1>Expense Report - ${new Date().toLocaleDateString()}</h1>
          <p>Total Expenses: ${filteredExpenses.length}</p>
          <p>Total Amount: ${formatCurrency(filteredExpenses.reduce((sum, e) => sum + e.amount, 0))}</p>
          <table>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.category')}</th>
                <th>{t('common.description')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              ${filteredExpenses.map(exp => `
                <tr>
                  <td>${formatDate(exp.date)}</td>
                  <td>${getCategoryLabel(exp.category)}</td>
                  <td>${exp.description}</td>
                  <td>${formatCurrency(exp.amount)}</td>
                  <td class="status-${exp.status}">${exp.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
    setSuccessMessage('PDF export opened in print dialog!');
  };

  const exportToExcel = () => {
    const categoryData = {};
    categories.forEach(cat => {
      categoryData[cat.label] = expenses.filter(e => e.category === cat.value && e.status === 'approved');
    });

    const monthlyData = {};
    expenses.forEach(expense => {
      const month = expense.date.substring(0, 7);
      if (!monthlyData[month]) monthlyData[month] = [];
      if (expense.status === 'approved') monthlyData[month].push(expense);
    });

    let excelContent = 'EXPENSE REPORT\n\n';
    
    excelContent += 'SUMMARY\n';
    excelContent += `Total Expenses,${expenses.length}\n`;
    excelContent += `Total Approved,${formatCurrency(stats.totalApproved || 0)}\n`;
    excelContent += `Pending Approvals,${stats.pendingCount || 0}\n\n`;

    excelContent += 'BY CATEGORY\n';
    excelContent += 'Category,Amount,Count\n';
    categories.forEach(cat => {
      const stat = stats.category?.[cat.value];
      if (stat && stat.amount > 0) {
        excelContent += `${stat.label},${stat.amount},${stat.count}\n`;
      }
    });
    excelContent += '\n';

    excelContent += 'ALL EXPENSES\n';
    excelContent += 'Date,Category,Description,Amount,Payment Method,Status,Approved By\n';
    filteredExpenses.forEach(exp => {
      excelContent += `${exp.date},${getCategoryLabel(exp.category)},${exp.description},${exp.amount},${exp.paymentMethod},${exp.status},${exp.approvedBy || '-'}\n`;
    });

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_report_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSuccessMessage('Excel report exported successfully!');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  const getCategoryLabel = (value) => {
    const cat = categories.find(c => c.value === value);
    return cat ? cat.label : value;
  };

  const getCategoryColor = (value) => {
    const cat = categories.find(c => c.value === value);
    return cat ? cat.color : '#95a5a6';
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (filterStatus && expense.status !== filterStatus) return false;
      if (filterCategory && expense.category !== filterCategory) return false;
      return true;
    });
  }, [expenses, filterStatus, filterCategory]);

  const monthlyTrends = useMemo(() => {
    const trends = {};
    expenses.forEach(expense => {
      const month = expense.date.substring(0, 7);
      if (!trends[month]) trends[month] = { approved: 0, pending: 0, rejected: 0, total: 0 };
      trends[month][expense.status] += expense.amount;
      trends[month].total += expense.amount;
    });
    return Object.entries(trends).sort().slice(-6);
  }, [expenses]);

  const isAllSelected = filteredExpenses.length > 0 && selectedExpenses.length === filteredExpenses.length;
  const isIndeterminate = selectedExpenses.length > 0 && selectedExpenses.length < filteredExpenses.length;
  const hasPendingSelected = selectedExpenses.some(id => {
    const exp = expenses.find(e => e.id === id);
    return exp && exp.status === 'pending';
  });

  return (
    <div className="expenses-container">
      {successMessage && (
        <div className="alert alert-success notification-toast" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          backgroundColor: '#27ae60',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          {successMessage}
        </div>
      )}

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h1>{t('expenses.title')}</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div className="export-dropdown" style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const menu = document.getElementById('exportMenu');
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
              }}
            >
              Export
            </button>
            <div id="exportMenu" style={{
              display: 'none',
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1100,
              minWidth: '150px',
              overflow: 'hidden'
            }}>
              <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, border: 'none', borderBottom: '1px solid #eee' }} onClick={() => { exportToCSV(); document.getElementById('exportMenu').style.display = 'none'; }}>
                Export as CSV
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, border: 'none', borderBottom: '1px solid #eee' }} onClick={() => { exportToPDF(); document.getElementById('exportMenu').style.display = 'none'; }}>
                Export as PDF
              </button>
              <button className="btn" style={{ width: '100%', justifyContent: 'flex-start', borderRadius: 0, border: 'none' }} onClick={() => { exportToExcel(); document.getElementById('exportMenu').style.display = 'none'; }}>
                Export as Excel
              </button>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingExpense(null); }}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </button>
        </div>
      </div>

      <div className="stats-overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        <div className="stat-card" style={{ backgroundColor: '#3498db', color: 'white', padding: '20px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.9 }}>Total Expenses</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{stats.totalExpenses || 0}</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#27ae60', color: 'white', padding: '20px', borderRadius: '8px' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.9 }}>Total Approved</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{formatCurrency(stats.totalApproved || 0)}</div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#f39c12', color: 'white', padding: '20px', borderRadius: '8px', position: 'relative' }}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.9 }}>{t('common.statuses.pending_approval')}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>{stats.pendingCount || 0}</div>
          {stats.pendingCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              backgroundColor: '#e74c3c',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px'
            }}>
              {stats.pendingCount}
            </span>
          )}
        </div>
      </div>

      {monthlyTrends.length > 0 && (
        <div className="section-card" style={{ marginBottom: '20px' }}>
          <h3>Monthly Trends (Last 6 Months)</h3>
          <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', padding: '10px 0' }}>
            {monthlyTrends.map(([month, data]) => (
              <div key={month} style={{
                minWidth: '150px',
                padding: '15px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                borderLeft: '4px solid #3498db'
              }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>{month}</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#27ae60' }}>
                  {formatCurrency(data.approved)}
                </div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
                  Pending: {formatCurrency(data.pending)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid category-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
        {categories.map(cat => {
          const stat = stats.category?.[cat.value];
          if (!stat || stat.amount === 0) return null;
          return (
            <div key={cat.value} className="stat-card" style={{ borderLeft: `4px solid ${cat.color}`, padding: '15px', backgroundColor: 'white', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div className="stat-label" style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{stat.label}</div>
              <div className="stat-value" style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '5px' }}>{formatCurrency(stat.amount)}</div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>{stat.count} expenses</div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="section-card form-card" style={{ marginBottom: '20px' }}>
          <h2>{editingExpense ? 'Edit Expense' : 'New Expense'}</h2>
          <form onSubmit={handleSubmit} className="expense-form">
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div className="form-group">
                <label>Category *</label>
                <select name="category" value={formData.category} onChange={handleInputChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (EGP) *</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  required
                  step="0.01"
                  min="0.01"
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: formErrors.amount ? '1px solid #e74c3c' : '1px solid #ddd' }}
                />
                {formErrors.amount && <small style={{ color: '#e74c3c', fontSize: '12px' }}>{formErrors.amount}</small>}
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>Description *</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter expense description"
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: formErrors.description ? '1px solid #e74c3c' : '1px solid #ddd' }}
              />
              {formErrors.description && <small style={{ color: '#e74c3c', fontSize: '12px' }}>{formErrors.description}</small>}
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px' }}>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: formErrors.date ? '1px solid #e74c3c' : '1px solid #ddd' }}
                />
                {formErrors.date && <small style={{ color: '#e74c3c', fontSize: '12px' }}>{formErrors.date}</small>}
              </div>
              <div className="form-group">
                <label>Payment Method *</label>
                <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInputChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  {paymentMethods.map(method => (
                    <option key={method} value={method}>
                      {method.replace('_', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>Receipt Upload</label>
              <input 
                type="file" 
                name="receipt" 
                onChange={handleFileChange} 
                accept=".pdf,.jpg,.jpeg,.png" 
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
              <small className="form-hint" style={{ color: '#666', fontSize: '12px' }}>Accepted formats: PDF, JPG, PNG (max 5MB)</small>
              {formErrors.receipt && <small style={{ color: '#e74c3c', fontSize: '12px', display: 'block' }}>{formErrors.receipt}</small>}
              {isUploading && (
                <div style={{ marginTop: '10px' }}>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e0e0e0', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${uploadProgress}%`,
                      height: '100%',
                      backgroundColor: '#3498db',
                      transition: 'width 0.1s ease'
                    }}></div>
                  </div>
                  <small style={{ color: '#666', fontSize: '11px' }}>{uploadProgress}% uploaded</small>
                </div>
              )}
              {formData.receipt && !isUploading && (
                <div style={{ marginTop: '5px', fontSize: '12px', color: '#27ae60' }}>
                  Selected: {formData.receipt.name}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginTop: '15px' }}>
              <label>{t('common.notes')}</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                placeholder="Additional notes..."
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', resize: 'vertical' }}
              />
            </div>
            <div className="form-actions" style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingExpense(null); setFormErrors({}); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingExpense ? 'Update Expense' : 'Submit Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="section-card">
        <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
          <h2>{t('expenses.list')}</h2>
          <div className="filter-controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">{t('expenses.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">{t('common.allLabel')}</option>
              <option value="pending">{t('common.statuses.pending')}</option>
              <option value="approved">{t('common.statuses.approved')}</option>
              <option value="rejected">{t('common.statuses.cancelled')}</option>
            </select>
          </div>
        </div>

        {selectedExpenses.length > 0 && (
          <div className="bulk-actions" style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '4px', 
            marginBottom: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <span style={{ fontWeight: 'bold' }}>{selectedExpenses.length} expense(s) selected</span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {hasPendingSelected && (
                <>
                  <button className="btn btn-success btn-sm" onClick={handleBulkApprove}>{t('expenses.bulkApprove')}</button>
                  <button className="btn btn-danger btn-sm" onClick={handleBulkReject}>{t('expenses.bulkReject')}</button>
                </>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(expenses.filter(e => selectedExpenses.includes(e._id || e.id)))}>
                Export Selected
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExpenses([])}>{t('expenses.clearSelection')}</button>
            </div>
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{t('common.date')}</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{t('common.category')}</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{t('common.description')}</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #dee2e6' }}>{t('common.amount')}</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Payment Method</th>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>{t('common.status')}</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Receipt</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => {
                const expenseId = expense._id || expense.id;
                return (
                <tr key={expenseId} style={{ borderBottom: '1px solid #dee2e6' }}>
                  <td style={{ padding: '12px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedExpenses.includes(expenseId)}
                      onChange={() => handleSelectExpense(expenseId)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '12px' }}>{formatDate(expense.date)}</td>
                  <td style={{ padding: '12px' }}>
                    <span className="category-tag" style={{ 
                      backgroundColor: getCategoryColor(expense.category),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {getCategoryLabel(expense.category)}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{expense.description}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(expense.amount)}</td>
                  <td style={{ padding: '12px', textTransform: 'capitalize' }}>{(expense.paymentMethod || 'cash').replace('_', ' ')}</td>
                  <td style={{ padding: '12px' }}>
                    <span className={`badge ${getStatusBadgeClass(expense.status)}`} style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      textTransform: 'capitalize',
                      backgroundColor: expense.status === 'approved' ? '#27ae60' : expense.status === 'rejected' ? '#e74c3c' : '#f39c12',
                      color: 'white'
                    }}>
                      {expense.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {expense.receiptUrl ? (
                      <button 
                        onClick={() => handleView(expense)} 
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3498db',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        View
                      </button>
                    ) : (
                      <span style={{ color: '#999' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {expense.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleApprove(expenseId)}
                            style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRejectClick(expenseId)}
                            style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => handleView(expense)}
                        style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              No expenses found matching the selected filters.
            </div>
          )}
        </div>
      </div>

      {showDetailModal && selectedExpense && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }} onClick={handleCloseModal}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h2 style={{ margin: 0 }}>{t('expenses.details')}</h2>
              <button 
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.category')}</label>
                  <div style={{ 
                    marginTop: '5px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: getCategoryColor(selectedExpense.category)
                  }}>
                    {getCategoryLabel(selectedExpense.category)}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.amount')}</label>
                  <div style={{ marginTop: '5px', fontSize: '20px', fontWeight: 'bold', color: '#27ae60' }}>
                    {formatCurrency(selectedExpense.amount)}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.date')}</label>
                  <div style={{ marginTop: '5px', fontSize: '16px' }}>
                    {formatDate(selectedExpense.date)}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Payment Method</label>
                  <div style={{ marginTop: '5px', fontSize: '16px', textTransform: 'capitalize' }}>
                    {selectedExpense.paymentMethod?.replace('_', ' ') || 'N/A'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.description')}</label>
                <div style={{ marginTop: '5px', fontSize: '16px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  {selectedExpense.description}
                </div>
              </div>

              {selectedExpense.notes && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.notes')}</label>
                  <div style={{ marginTop: '5px', fontSize: '14px', color: '#666', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    {selectedExpense.notes}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('common.status')}</label>
                  <div style={{ marginTop: '5px' }}>
                    <span className={`badge ${getStatusBadgeClass(selectedExpense.status)}`} style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '14px',
                      textTransform: 'capitalize',
                      backgroundColor: selectedExpense.status === 'approved' ? '#27ae60' : selectedExpense.status === 'rejected' ? '#e74c3c' : '#f39c12',
                      color: 'white'
                    }}>
                      {selectedExpense.status}
                    </span>
                  </div>
                </div>
                {selectedExpense.approvedBy && (
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{t('expenses.approvedBy')}</label>
                    <div style={{ marginTop: '5px', fontSize: '16px' }}>
                      {selectedExpense.approvedBy}
                    </div>
                  </div>
                )}
                {selectedExpense.rejectReason && (
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>Rejection Reason</label>
                    <div style={{ marginTop: '5px', fontSize: '14px', color: '#e74c3c' }}>
                      {selectedExpense.rejectReason}
                    </div>
                  </div>
                )}
              </div>

              {selectedExpense.receiptUrl && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }}>Receipt</label>
                  <div style={{ 
                    border: '1px solid #ddd', 
                    borderRadius: '4px', 
                    padding: '10px',
                    backgroundColor: '#f8f9fa'
                  }}>
                    {selectedExpense.receiptUrl.match(/\.(jpg|jpeg|png)$/i) ? (
                      <img 
                        src={selectedExpense.receiptUrl} 
                        alt="Receipt" 
                        style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '0 auto' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '10px' }}>📄</div>
                        <div>PDF Receipt</div>
                        <a 
                          href={selectedExpense.receiptUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            marginTop: '10px',
                            padding: '8px 16px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            textDecoration: 'none',
                            borderRadius: '4px'
                          }}
                        >
                          Open Receipt
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button 
                onClick={handleCloseModal}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              <button 
                onClick={() => handleEdit(selectedExpense)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Edit
              </button>
              {selectedExpense.status === 'pending' && (
                <>
                  <button 
                    onClick={() => { handleApprove(selectedExpense._id || selectedExpense.id); handleCloseModal(); }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => { handleRejectClick(selectedExpense._id || selectedExpense.id); handleCloseModal(); }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }} onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{
              padding: '20px',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h3 style={{ margin: 0, color: '#e74c3c' }}>Reject Expense</h3>
            </div>
            <div className="modal-body" style={{ padding: '20px' }}>
              <p style={{ marginBottom: '15px' }}>Please provide a reason for rejecting this expense:</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows="4"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  resize: 'vertical'
                }}
                autoFocus
              />
              {!rejectReason.trim() && (
                <small style={{ color: '#e74c3c', fontSize: '12px' }}>Rejection reason is required</small>
              )}
            </div>
            <div className="modal-footer" style={{
              padding: '20px',
              borderTop: '1px solid #e0e0e0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button 
                onClick={() => setShowRejectModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: rejectReason.trim() ? '#e74c3c' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: rejectReason.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
