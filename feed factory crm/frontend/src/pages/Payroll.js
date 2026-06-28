import { t } from '../utils/i18n';
import { formatCurrency, formatDate, getStatusLabel } from '../utils/formatters';
import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Calendar, Users, FileText, Download, Plus, 
  Eye, Edit, Trash2, CheckCircle, Clock, ArrowRight, 
  RefreshCw, AlertTriangle, X, ChevronLeft, Check,
  Briefcase, TrendingUp, TrendingDown, Wallet, Search,
  Filter, MoreVertical, Save, XCircle, ArrowLeftRight,
  User, Building, CreditCard, CalendarDays, Timer,
  AlertCircle, Play, ThumbsUp, Banknote
} from 'lucide-react';
import { payrollService, authService } from '../services/api';




// Timeline Component
const PayrollTimeline = ({ status, dueDate }) => {
  const steps = [
    { key: 'draft', label: 'مسودة', description: 'تم الإنشاء' },
    { key: 'processed', label: 'تمت المعالجة', description: 'تم الحساب' },
    { key: 'approved', label: 'معتمد', description: 'موافقة المدير' },
    { key: 'paid', label: 'تم الدفع', description: 'مكتمل' }
  ];

  const getStepStatus = (stepKey) => {
    const statusOrder = ['draft', 'processed', 'approved', 'paid'];
    const currentIndex = statusOrder.indexOf(status);
    const stepIndex = statusOrder.indexOf(stepKey);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getDueDateStatus = () => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `متأخر بـ ${Math.abs(diffDays)} يوم`, type: 'overdue' };
    if (diffDays === 0) return { text: 'مستحق اليوم', type: 'due-today' };
    if (diffDays <= 3) return { text: `متبقي ${diffDays} أيام`, type: 'urgent' };
    return { text: `متبقي ${diffDays} أيام`, type: 'normal' };
  };

  const dueDateInfo = getDueDateStatus();

  return (
    <div className="payroll-timeline-container">
      <div className="payroll-timeline">
        {steps.map((step, index) => {
          const stepStatus = getStepStatus(step.key);
          const isLast = index === steps.length - 1;
          
          return (
            <React.Fragment key={step.key}>
              <div className={`timeline-step ${stepStatus}`}>
                <div className={`timeline-dot ${step.key} ${stepStatus}`}>
                  {stepStatus === 'completed' && <Check size={10} />}
                  {stepStatus === 'active' && (
                    step.key === 'draft' ? <Clock size={10} /> :
                    step.key === 'processed' ? <RefreshCw size={10} /> :
                    step.key === 'approved' ? <ThumbsUp size={10} /> :
                    <Banknote size={10} />
                  )}
                </div>
                <div className="timeline-label">
                  <div className="timeline-title">{step.label}</div>
                  <div className="timeline-desc">{step.description}</div>
                </div>
              </div>
              {!isLast && (
                <div className={`timeline-line ${stepStatus === 'completed' ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {dueDate && dueDateInfo && (
        <div className={`due-date-badge ${dueDateInfo.type}`}>
          <CalendarDays size={14} />
          <span>تاريخ الاستحقاق: {formatDate(dueDate)}</span>
          <span className="due-date-countdown">({dueDateInfo.text})</span>
        </div>
      )}
    </div>
  );
};

const Payroll = () => {
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [postingToFinance, setPostingToFinance] = useState(false);
  const [approvingPayroll, setApprovingPayroll] = useState(false);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  
  // Form states
  const [newPayroll, setNewPayroll] = useState({
    month: new Date().toISOString().slice(0, 7),
    year: new Date().getFullYear(),
    notes: '',
    dueDate: ''
  });

  const user = authService.getCurrentUser();
  const canManagePayroll = ['owner', 'admin', 'hr_manager'].includes(user?.role);
  const canApprovePayroll = ['owner', 'admin', 'hr_manager', 'manager'].includes(user?.role);

  useEffect(() => {
    fetchPayrolls();
  }, []);

  const fetchPayrolls = async () => {
    setLoading(true);
    try {
      const result = await payrollService.getPayrolls();
      if (result.success) {
        setPayrolls(result.payrolls || []);
      }
    } catch (error) {
      console.error('Error fetching payrolls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayroll = async (e) => {
    e.preventDefault();
    try {
      // Calculate default due date (5th of next month)
      const [year, month] = newPayroll.month.split('-').map(Number);
      const dueDate = new Date(year, month, 5);
      
      const payrollData = {
        ...newPayroll,
        dueDate: dueDate.toISOString().split('T')[0]
      };
      
      const result = await payrollService.createPayroll(payrollData);
      if (result.success) {
        alert('Payroll created successfully!');
        setShowCreateModal(false);
        fetchPayrolls();
        setNewPayroll({
          month: new Date().toISOString().slice(0, 7),
          year: new Date().getFullYear(),
          notes: '',
          dueDate: ''
        });
      } else {
        alert(result.error || 'Failed to create payroll');
      }
    } catch (error) {
      console.error('Error creating payroll:', error);
      alert('Failed to create payroll');
    }
  };

  const handleProcessPayroll = async (payrollId) => {
    try {
      const result = await payrollService.processPayroll(payrollId);
      if (result.success) {
        alert('Payroll processed successfully!');
        fetchPayrolls();
        if (selectedPayroll?._id === payrollId) {
          setSelectedPayroll(result.payroll);
        }
      } else {
        alert(result.error || 'Failed to process payroll');
      }
    } catch (error) {
      console.error('Error processing payroll:', error);
      alert('Failed to process payroll');
    }
  };

  const handleApprovePayroll = async () => {
    if (!selectedPayroll) return;
    
    setApprovingPayroll(true);
    try {
      const result = await payrollService.approvePayroll(selectedPayroll._id);
      if (result.success) {
        alert('Payroll approved successfully!');
        setShowApproveModal(false);
        fetchPayrolls();
        const updatedPayroll = { 
          ...selectedPayroll, 
          status: 'approved', 
          approvedBy: user?.name || 'المستخدم الحالي',
          approvedAt: new Date().toISOString()
        };
        setSelectedPayroll(updatedPayroll);
      } else {
        alert(result.error || 'Failed to approve payroll');
      }
    } catch (error) {
      console.error('Error approving payroll:', error);
      alert('Failed to approve payroll');
    } finally {
      setApprovingPayroll(false);
    }
  };

  const handlePostToFinance = async () => {
    if (!selectedPayroll) return;
    
    setPostingToFinance(true);
    try {
      const result = await payrollService.postToFinance(selectedPayroll._id);
      if (result.success) {
        alert('Payroll posted to finance successfully!');
        setShowPostModal(false);
        fetchPayrolls();
        const updatedPayroll = { 
          ...selectedPayroll, 
          postedToFinance: true, 
          status: 'approved',
          expenseId: result.expenseId || `EXP-SAL-${selectedPayroll.month}`,
          payableId: result.payableId || `PAY-SAL-${selectedPayroll.month}`,
          postedAt: new Date().toISOString()
        };
        setSelectedPayroll(updatedPayroll);
      } else {
        alert(result.error || 'Failed to post to finance');
      }
    } catch (error) {
      console.error('Error posting to finance:', error);
      alert('Failed to post to finance');
    } finally {
      setPostingToFinance(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedPayroll) return;
    
    setMarkingAsPaid(true);
    try {
      const result = await payrollService.markAsPaid(selectedPayroll._id);
      if (result.success) {
        alert('Payroll marked as paid successfully!');
        setShowPayModal(false);
        fetchPayrolls();
        const updatedPayroll = { 
          ...selectedPayroll, 
          status: 'paid',
          paidAt: new Date().toISOString()
        };
        setSelectedPayroll(updatedPayroll);
      } else {
        alert(result.error || 'Failed to mark as paid');
      }
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid');
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const handleDeletePayroll = async () => {
    if (!selectedPayroll) return;
    
    try {
      const result = await payrollService.deletePayroll(selectedPayroll._id);
      if (result.success) {
        alert('Payroll deleted successfully!');
        setShowDeleteModal(false);
        setViewMode('list');
        fetchPayrolls();
      } else {
        alert(result.error || 'Failed to delete payroll');
      }
    } catch (error) {
      console.error('Error deleting payroll:', error);
      alert('Failed to delete payroll');
    }
  };

  const handleExportCSV = (payroll) => {
    const csv = [
      ['اسم الموظف', 'القسم', 'المسمى الوظيفي', t('payroll.baseSalary'), t('payroll.allowances'), t('payroll.deductions'), t('payroll.netSalary'), 'البنك', 'رقم الحساب'].join(','),
      ...payroll.employeePayrolls.map(ep => [
        ep.employeeName,
        ep.department,
        ep.designation,
        ep.basicSalary || 0,
        ep.totalAllowances || 0,
        ep.totalDeductions || 0,
        ep.netSalary || 0,
        ep.bankName || '',
        ep.bankAccount || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${payroll.month}.csv`;
    a.click();
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'badge-warning',
      processed: 'badge-info',
      approved: 'badge-primary',
      paid: 'badge-success'
    };
    return classes[status] || 'badge-secondary';
  };

  const getStatusIcon = (status) => {
    const icons = {
      draft: <Clock size={14} />,
      processed: <RefreshCw size={14} />,
      approved: <ThumbsUp size={14} />,
      paid: <Check size={14} />
    };
    return icons[status] || <Clock size={14} />;
  };

  // Filter payrolls
  const filteredPayrolls = payrolls.filter(p => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesSearch = !searchTerm || 
      p.month.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate totals
  const totalPayrollValue = payrolls.reduce((sum, p) => sum + (p.totalNetSalary || 0), 0);
  const totalDraft = payrolls.filter(p => p.status === 'draft').length;
  const totalProcessed = payrolls.filter(p => p.status === 'processed').length;
  const totalApproved = payrolls.filter(p => p.status === 'approved').length;
  const totalPosted = payrolls.filter(p => p.status === 'posted').length;
  const totalPaid = payrolls.filter(p => p.status === 'paid').length;
  const totalEmployees = payrolls.reduce((sum, p) => sum + (p.employeeCount || p.employeePayrolls?.length || 0), 0);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <RefreshCw size={32} className="spin" />
          <p>جاري تحميل بيانات الرواتب...</p>
        </div>
      </div>
    );
  }

  // LIST VIEW
  if (viewMode === 'list') {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>{t('payroll.title')}</h1>
            <p>{t('payroll.subtitlePayroll')}</p>
          </div>
          <div className="header-actions">
            {canManagePayroll && (
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={18} /> {t('payroll.createPayroll')}
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid payroll-stats">
          <div className="stat-card">
            <div className="stat-icon bg-purple text-purple">
              <DollarSign size={24} />
            </div>
            <div className="stat-value">{formatCurrency(totalPayrollValue)}</div>
            <div className="stat-label">{t('payroll.totalValue')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-blue text-blue">
              <Users size={24} />
            </div>
            <div className="stat-value">{totalEmployees}</div>
            <div className="stat-label">{t('payroll.totalEmployees')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-orange text-orange">
              <Clock size={24} />
            </div>
            <div className="stat-value">{totalDraft}</div>
            <div className="stat-label">{t('common.statuses.draft')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-blue-light text-blue">
              <RefreshCw size={24} />
            </div>
            <div className="stat-value">{totalProcessed}</div>
            <div className="stat-label">{t('payroll.processed')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-yellow text-yellow">
              <ThumbsUp size={24} />
            </div>
            <div className="stat-value">{totalApproved + totalPosted}</div>
            <div className="stat-label">{t('common.statuses.approved')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-value">{totalPaid}</div>
            <div className="stat-label">{t('common.statuses.paid')}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="card payroll-filters">
          <div className="filters-row">
            <div className="search-box">
              <Search size={18} color="#64748b" />
              <input
                type="text"
                placeholder={t('payroll.searchPayroll')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="filter-group">
              <Filter size={18} color="#64748b" />
              <select 
                className="form-select" 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">{t('common.allLabel')}</option>
                <option value="draft">{t('common.statuses.draft')}</option>
                <option value="processed">{t('payroll.processed')}</option>
                <option value="approved">{t('common.statuses.approved')}</option>
                <option value="paid">{t('common.statuses.paid')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payroll List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">فترات الرواتب</h3>
            <span className="text-muted">{filteredPayrolls.length} {t('payroll.payrollFound')}</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th>الموظفون</th>
                  <th>{t('orders.dueDate')}</th>
                  <th>صافي الراتب الإجمالي</th>
                  <th>{t('common.status')}</th>
                  <th>الحالة المالية</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map(payroll => (
                  <tr key={payroll._id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-sm bg-purple text-purple">
                          <Calendar size={14} />
                        </div>
                        <div className="employee-info">
                          <div className="employee-name">{payroll.month}</div>
                          <div className="employee-id">Year: {payroll.year}</div>
                        </div>
                      </div>
                    </td>
                    <td>{payroll.employeeCount || 0} {t('payroll.employees')}</td>
                    <td>
                      {payroll.dueDate ? (
                        <div className="due-date-cell">
                          <CalendarDays size={14} />
                          <span>{formatDate(payroll.dueDate)}</span>
                        </div>
                      ) : (
                        <span className="text-muted">غير محدد</span>
                      )}
                    </td>
                    <td className="net-salary font-bold">{formatCurrency(payroll.totalNetSalary || 0)}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(payroll.status)}`}>
                        {getStatusIcon(payroll.status)} {getStatusLabel(payroll.status)}
                      </span>
                    </td>
                    <td>
                      {payroll.postedToFinance ? (
                        <span className="badge badge-success">
                          <Check size={12} /> Posted
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <Clock size={12} /> {t('payroll.notPosted')}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={async () => {
                            try {
                              const full = await payrollService.getPayroll(payroll._id);
                              setSelectedPayroll(full.payroll || payroll);
                            } catch(e) {
                              setSelectedPayroll(payroll);
                            }
                            setViewMode('detail');
                          }}
                        >
                          <Eye size={14} /> {t('payroll.view')}
                        </button>
                        {payroll.status === 'draft' && canManagePayroll && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handleProcessPayroll(payroll._id)}
                          >
                            <RefreshCw size={14} /> معالجة
                          </button>
                        )}
                        {payroll.status === 'processed' && canApprovePayroll && (
                          <button 
                            className="btn btn-sm btn-warning" 
                            onClick={() => {
                              setSelectedPayroll(payroll);
                              setShowApproveModal(true);
                            }}
                          >
                            <ThumbsUp size={14} /> Approve
                          </button>
                        )}
                        {['draft', 'processed', 'approved'].includes(payroll.status) && !payroll.postedToFinance && canApprovePayroll && (
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={async () => {
                              if (window.confirm(`Approve ${payroll.month} payroll (${formatCurrency(payroll.totalNetSalary || 0)}) in one step?`)) {
                                try {
                                  const result = await payrollService.approveAllPayroll(payroll._id);
                                  if (result.success) {
                                    alert('Payroll fully approved!');
                                    fetchPayrolls();
                                  } else {
                                    alert(result.error || 'Failed to approve');
                                  }
                                } catch (e) {
                                  alert('Error: ' + e.message);
                                }
                              }
                            }}
                          >
                            <CheckCircle size={14} /> {t('payroll.approveAll')}
                          </button>
                        )}
                        {payroll.status === 'approved' && canManagePayroll && !payroll.postedToFinance && (
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={() => {
                              setSelectedPayroll(payroll);
                              setShowPostModal(true);
                            }}
                          >
                            <ArrowLeftRight size={14} /> {t('payroll.postToFinance')}
                          </button>
                        )}
                        {payroll.status === 'approved' && payroll.postedToFinance && canManagePayroll && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => {
                              setSelectedPayroll(payroll);
                              setShowPayModal(true);
                            }}
                          >
                            <Banknote size={14} /> Mark Paid
                          </button>
                        )}
                        {canManagePayroll && payroll.status === 'draft' && (
                          <button 
                            className="btn btn-sm btn-danger" 
                            onClick={() => {
                              setSelectedPayroll(payroll);
                              setShowDeleteModal(true);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Plus size={20} /> إنشاء فترة رواتب جديدة</h3>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleCreatePayroll}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>الشهر *</label>
                      <input
                        type="month"
                        className="form-input"
                        value={newPayroll.month}
                        onChange={(e) => {
                          const month = e.target.value;
                          const year = parseInt(month.split('-')[0]);
                          setNewPayroll({ ...newPayroll, month, year });
                        }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>السنة *</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newPayroll.year}
                        onChange={(e) => setNewPayroll({ ...newPayroll, year: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>تاريخ استحقاق الدفع</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newPayroll.dueDate}
                      onChange={(e) => setNewPayroll({ ...newPayroll, dueDate: e.target.value })}
                    />
                    <small className="form-help">Defaults to 5th of next month if not specified</small>
                  </div>
                  <div className="form-group">
                    <label>{t('common.notes')}</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={newPayroll.notes}
                      onChange={(e) => setNewPayroll({ ...newPayroll, notes: e.target.value })}
                      placeholder="Optional notes..."
                    />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                      إلغاء
                    </button>
                    <button type="submit" className="btn btn-primary">
                      إنشاء كشف الرواتب
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Approve Modal */}
        {showApproveModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><ThumbsUp size={20} /> اعتماد الرواتب</h3>
                <button className="modal-close" onClick={() => setShowApproveModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="approval-confirmation">
                  <div className="confirmation-header">
                    <ThumbsUp size={32} className="approval-icon" />
                    <h4>اعتماد الرواتب لشهر {selectedPayroll.month}؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">الشهر:</span>
                      <span className="value font-bold">{selectedPayroll.month}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">عدد الموظفين:</span>
                      <span className="value">{selectedPayroll.employeePayrolls?.length || 0}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">الراتب الأساسي:</span>
                      <span className="value">{formatCurrency(selectedPayroll.totalBasicSalary || 0)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">البدلات:</span>
                      <span className="value text-green">{formatCurrency(selectedPayroll.totalAllowances || 0)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">الخصومات:</span>
                      <span className="value text-red">{formatCurrency(selectedPayroll.totalDeductions || 0)}</span>
                    </div>
                    <div className="summary-row total-row">
                      <span className="label font-bold">صافي الراتب الإجمالي:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="approval-actions-list">
                    <h5>بعد الاعتماد:</h5>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>ستكون الرواتب جاهزة للترحيل للمالية</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>يمكن إنشاء سجلات المصروفات والمدفوعات</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>يمكن معالجة الدفع</span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowApproveModal(false)}
                      disabled={approvingPayroll}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-warning" 
                      onClick={handleApprovePayroll}
                      disabled={approvingPayroll}
                    >
                      {approvingPayroll ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post to Finance Modal */}
        {showPostModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><DollarSign size={20} /> {t('payroll.postToFinance')}</h3>
                <button className="modal-close" onClick={() => setShowPostModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="post-confirmation">
                  <div className="confirmation-header">
                    <AlertTriangle size={32} className="warning-icon" />
                    <h4>ترحيل الرواتب للمالية؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">الشهر:</span>
                      <span className="value font-bold">{selectedPayroll.month}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">عدد الموظفين:</span>
                      <span className="value">{selectedPayroll.employeePayrolls?.length || 0}</span>
                    </div>
                    <div className="summary-row total-row">
                      <span className="label font-bold">صافي الراتب الإجمالي:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="actions-preview">
                    <h5>سيتم إنشاء:</h5>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>سجل مصروفات (EXP-SAL-{selectedPayroll.month})</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>سجل مستحقات (PAY-SAL-{selectedPayroll.month})</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="action-icon" />
                      <span>تاريخ الاستحقاق: {selectedPayroll.dueDate ? formatDate(selectedPayroll.dueDate) : 'غير محدد'}</span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowPostModal(false)}
                      disabled={postingToFinance}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-success" 
                      onClick={handlePostToFinance}
                      disabled={postingToFinance}
                    >
                      {postingToFinance ? 'جاري الترحيل...' : 'تأكيد الترحيل للمالية'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mark as Paid Modal */}
        {showPayModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Banknote size={20} /> تسجيل كمدفوع</h3>
                <button className="modal-close" onClick={() => setShowPayModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="pay-confirmation">
                  <div className="confirmation-header">
                    <CheckCircle size={32} className="success-icon" />
                    <h4>تأكيد اكتمال الدفع؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">الشهر:</span>
                      <span className="value font-bold">{selectedPayroll.month}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">رقم المصروف:</span>
                      <span className="value font-mono">{selectedPayroll.expenseId}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">رقم المستحق:</span>
                      <span className="value font-mono">{selectedPayroll.payableId}</span>
                    </div>
                    <div className="summary-row total-row">
                      <span className="label font-bold">المبلغ المدفوع:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="payment-notice">
                    <AlertCircle size={16} />
                    <span>سيتم تسجيل جميع رواتب الموظفين كمدفوعة وإكمال دورة الرواتب.</span>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowPayModal(false)}
                      disabled={markingAsPaid}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleMarkAsPaid}
                      disabled={markingAsPaid}
                    >
                      {markingAsPaid ? 'جاري المعالجة...' : 'تأكيد اكتمال الدفع'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="text-danger"><Trash2 size={20} /> حذف كشف الرواتب</h3>
                <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <p>هل أنت متأكد من حذف كشف الرواتب لشهر <strong>{selectedPayroll.month}</strong>؟</p>
                <p className="text-muted">لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="form-actions">
                  <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>
                    إلغاء
                  </button>
                  <button className="btn btn-danger" onClick={handleDeletePayroll}>
                    حذف كشف الرواتب
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETAIL VIEW
  if (viewMode === 'detail' && selectedPayroll) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="header-left">
            <button className="btn btn-outline" onClick={() => setViewMode('list')}>
              <ChevronLeft size={18} /> {t('hr.backToList')}
            </button>
            <div className="header-title-section">
              <h1>{t('hr.payrollDetailsTitle')} - {selectedPayroll.month}</h1>
              <div className="header-meta">
                <span className={`badge ${getStatusBadgeClass(selectedPayroll.status)}`}>
                  {getStatusIcon(selectedPayroll.status)} {getStatusLabel(selectedPayroll.status)}
                </span>
                {selectedPayroll.dueDate && (
                  <span className="due-date-tag">
                    <CalendarDays size={14} />
                    Due: {formatDate(selectedPayroll.dueDate)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={() => handleExportCSV(selectedPayroll)}>
              <Download size={18} /> تصدير CSV
            </button>
            {selectedPayroll.status === 'processed' && canApprovePayroll && (
              <button 
                className="btn btn-warning" 
                onClick={() => setShowApproveModal(true)}
              >
                <ThumbsUp size={18} /> اعتماد
              </button>
            )}
            {selectedPayroll.status === 'approved' && canManagePayroll && !selectedPayroll.postedToFinance && (
              <button 
                className="btn btn-success" 
                onClick={() => setShowPostModal(true)}
              >
                <ArrowLeftRight size={18} /> ترحيل للمالية
              </button>
            )}
            {selectedPayroll.status === 'approved' && selectedPayroll.postedToFinance && canManagePayroll && (
              <button 
                className="btn btn-primary" 
                onClick={() => setShowPayModal(true)}
              >
                <Banknote size={18} /> تسجيل كمدفوع
              </button>
            )}
            {['draft', 'processed', 'approved'].includes(selectedPayroll.status) && !selectedPayroll.postedToFinance && canApprovePayroll && (
              <button 
                className="btn btn-success" 
                onClick={async () => {
                  if (window.confirm(`اعتماد ومعالجة وترحيل رواتب ${selectedPayroll.month} (${formatCurrency(selectedPayroll.totalNetSalary || 0)}) للمالية في خطوة واحدة؟`)) {
                    try {
                      const result = await payrollService.approveAllPayroll(selectedPayroll._id || selectedPayroll.id);
                      if (result.success) {
                        alert('تم اعتماد الرواتب وترحيلها للمالية بنجاح!');
                        fetchPayrolls();
                        const full = await payrollService.getPayroll(selectedPayroll._id || selectedPayroll.id);
                        setSelectedPayroll(full.payroll || result.payroll);
                      } else {
                        alert(result.error || 'فشل الاعتماد');
                      }
                    } catch (e) {
                      alert('خطأ: ' + e.message);
                    }
                  }
                }}
              >
                <CheckCircle size={18} /> اعتماد الكل
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="card timeline-card">
          <div className="card-header">
            <h3 className="card-title">{t('payroll.approvalWorkflow')}</h3>
          </div>
          <div className="card-body">
            <PayrollTimeline 
              status={selectedPayroll.status} 
              dueDate={selectedPayroll.dueDate}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-blue text-blue">
              <Users size={20} />
            </div>
            <div className="stat-value">{selectedPayroll.employeePayrolls?.length || 0}</div>
            <div className="stat-label">الموظفون</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-blue text-blue">
              <Briefcase size={20} />
            </div>
            <div className="stat-value">{formatCurrency(selectedPayroll.totalBasicSalary || 0)}</div>
            <div className="stat-label">إجمالي الرواتب الأساسية</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <TrendingUp size={20} />
            </div>
            <div className="stat-value">{formatCurrency(selectedPayroll.totalAllowances || 0)}</div>
            <div className="stat-label">إجمالي البدلات</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-red text-red">
              <TrendingDown size={20} />
            </div>
            <div className="stat-value">{formatCurrency(selectedPayroll.totalDeductions || 0)}</div>
            <div className="stat-label">إجمالي الخصومات</div>
          </div>
          <div className="stat-card stat-highlight">
            <div className="stat-icon bg-purple text-purple">
              <Wallet size={20} />
            </div>
            <div className="stat-value">{formatCurrency(selectedPayroll.totalNetSalary || 0)}</div>
            <div className="stat-label">صافي الراتب الإجمالي</div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('payroll.employeePayrolls')}</h3>
            <span className="text-muted">{selectedPayroll.employeePayrolls?.length || 0} employees</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('hr.employee')}</th>
                  <th>{t('hr.department')}</th>
                  <th>{t('payroll.baseSalary')}</th>
                  <th>{t('payroll.allowances')}</th>
                  <th>{t('payroll.deductions')}</th>
                  <th>{t('payroll.netSalary')}</th>
                  <th>{t('hr.bankDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedPayroll.employeePayrolls || []).map((ep, idx) => (
                  <PayrollEmployeeRow
                    key={ep._id || idx}
                    ep={ep}
                    payrollId={selectedPayroll._id || selectedPayroll.id}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <td colSpan="2" className="font-bold">الإجمالي</td>
                  <td className="font-bold">{formatCurrency(selectedPayroll.totalBasicSalary || 0)}</td>
                  <td className="font-bold">{formatCurrency(selectedPayroll.totalAllowances || 0)}</td>
                  <td className="font-bold text-red">{formatCurrency(selectedPayroll.totalDeductions || 0)}</td>
                  <td className="font-bold text-success">{formatCurrency(selectedPayroll.totalNetSalary || 0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Salary Breakdown Card */}
        {selectedPayroll.employeePayrolls?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">تفاصيل الراتب</h3>
            </div>
            <div className="card-body">
              <div className="salary-breakdown-grid">
                <div className="breakdown-section">
                  <h4>{t('payroll.allowanceStructure')}</h4>
                  <div className="breakdown-table-container">
                    <table className="breakdown-table">
                      <thead>
                        <tr>
                          <th>{t('hr.employee')}</th>
                          <th>سكن</th>
                          <th>مواصلات</th>
                          <th>{t('common.other')}</th>
                          <th>{t('common.total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPayroll.employeePayrolls.map((ep, idx) => (
                          <tr key={idx}>
                            <td>{ep.employeeName}</td>
                            <td>{formatCurrency(ep.allowances?.housing || 0)}</td>
                            <td>{formatCurrency(ep.allowances?.transport || 0)}</td>
                            <td>{formatCurrency(ep.allowances?.other || 0)}</td>
                            <td className="font-bold">{formatCurrency(ep.totalAllowances || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="breakdown-section">
                  <h4>{t('payroll.deductionStructure')}</h4>
                  <div className="breakdown-table-container">
                    <table className="breakdown-table">
                      <thead>
                        <tr>
                          <th>{t('hr.employee')}</th>
                          <th>الضريبة</th>
                          <th>التأمين</th>
                          <th>{t('common.other')}</th>
                          <th>{t('common.total')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPayroll.employeePayrolls.map((ep, idx) => (
                          <tr key={idx}>
                            <td>{ep.employeeName}</td>
                            <td>{formatCurrency(ep.deductions?.tax || 0)}</td>
                            <td>{formatCurrency(ep.deductions?.insurance || 0)}</td>
                            <td>{formatCurrency(ep.deductions?.other || 0)}</td>
                            <td className="font-bold text-red">{formatCurrency(ep.totalDeductions || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Approval History */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('payroll.approvalHistory')}</h3>
          </div>
          <div className="card-body">
            <div className="approval-history">
              <div className={`history-item ${selectedPayroll.createdAt ? 'completed' : ''}`}>
                <div className="history-icon">
                  <Plus size={16} />
                </div>
                <div className="history-content">
                  <div className="history-title">تم إنشاء كشف الرواتب</div>
                  <div className="history-meta">
                    {selectedPayroll.createdAt ? formatDate(selectedPayroll.createdAt) : '—'}
                  </div>
                </div>
              </div>
              
              <div className={`history-item ${selectedPayroll.processedAt ? 'completed' : ''}`}>
                <div className="history-icon">
                  <RefreshCw size={16} />
                </div>
                <div className="history-content">
                  <div className="history-title">تمت معالجة الرواتب</div>
                  <div className="history-meta">
                    {selectedPayroll.processedAt ? formatDate(selectedPayroll.processedAt) : 'معلق'}
                  </div>
                </div>
              </div>
              
              <div className={`history-item ${selectedPayroll.approvedAt ? 'completed' : ''}`}>
                <div className="history-icon">
                  <ThumbsUp size={16} />
                </div>
                <div className="history-content">
                  <div className="history-title">موافقة المدير</div>
                  <div className="history-meta">
                    {selectedPayroll.approvedAt 
                      ? `${formatDate(selectedPayroll.approvedAt)} — ${selectedPayroll.approvedBy}` 
                      : 'معلق'}
                  </div>
                </div>
              </div>
              
              <div className={`history-item ${selectedPayroll.postedToFinance ? 'completed' : ''}`}>
                <div className="history-icon">
                  <ArrowLeftRight size={16} />
                </div>
                <div className="history-content">
                  <div className="history-title">مرحّل للمالية</div>
                  <div className="history-meta">
                    {selectedPayroll.postedAt 
                      ? `${formatDate(selectedPayroll.postedAt)} — ${selectedPayroll.expenseId}` 
                      : 'معلق'}
                  </div>
                </div>
              </div>
              
              <div className={`history-item ${selectedPayroll.paidAt ? 'completed' : ''}`}>
                <div className="history-icon">
                  <Banknote size={16} />
                </div>
                <div className="history-content">
                  <div className="history-title">تم الدفع</div>
                  <div className="history-meta">
                    {selectedPayroll.paidAt ? formatDate(selectedPayroll.paidAt) : 'معلق'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Finance Integration Status */}
        {selectedPayroll.postedToFinance && (
          <div className="card finance-status-card">
            <div className="card-header">
              <h3 className="card-title finance-title">
                <CheckCircle size={18} /> Posted to Finance
              </h3>
            </div>
            <div className="card-body">
              <div className="finance-info-grid">
                <div className="info-row">
                  <span className="info-label">Expense Number:</span>
                  <span className="info-value font-mono">
                    {selectedPayroll.expenseId || `EXP-SAL-${selectedPayroll.month}`}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Payable Number:</span>
                  <span className="info-value font-mono">
                    {selectedPayroll.payableId || `PAY-SAL-${selectedPayroll.month}`}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Posted At:</span>
                  <span className="info-value">
                    {selectedPayroll.postedAt ? formatDate(selectedPayroll.postedAt) : 'N/A'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Amount:</span>
                  <span className="info-value text-success font-bold">
                    {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes Section */}
        {selectedPayroll.notes && (
          <div className="card notes-card">
            <div className="card-header">
              <h3 className="card-title">{t('common.notes')}</h3>
            </div>
            <div className="card-body">
              <p className="payroll-notes">{selectedPayroll.notes}</p>
            </div>
          </div>
        )}

        {/* Approve Modal for Detail View */}
        {showApproveModal && (
          <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><ThumbsUp size={20} /> اعتماد الرواتب</h3>
                <button className="modal-close" onClick={() => setShowApproveModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="approval-confirmation">
                  <div className="confirmation-header">
                    <ThumbsUp size={32} className="approval-icon" />
                    <h4>اعتماد الرواتب لشهر {selectedPayroll.month}؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">صافي الراتب الإجمالي:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowApproveModal(false)}
                      disabled={approvingPayroll}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-warning" 
                      onClick={handleApprovePayroll}
                      disabled={approvingPayroll}
                    >
                      {approvingPayroll ? 'جاري الاعتماد...' : 'تأكيد الاعتماد'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Post Modal for Detail View */}
        {showPostModal && (
          <div className="modal-overlay" onClick={() => setShowPostModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><DollarSign size={20} /> {t('payroll.postToFinance')}</h3>
                <button className="modal-close" onClick={() => setShowPostModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="post-confirmation">
                  <div className="confirmation-header">
                    <AlertTriangle size={32} className="warning-icon" />
                    <h4>ترحيل الرواتب للمالية؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">صافي الراتب الإجمالي:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowPostModal(false)}
                      disabled={postingToFinance}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-success" 
                      onClick={handlePostToFinance}
                      disabled={postingToFinance}
                    >
                      {postingToFinance ? 'جاري الترحيل...' : 'تأكيد الترحيل'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pay Modal for Detail View */}
        {showPayModal && (
          <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Banknote size={20} /> تسجيل كمدفوع</h3>
                <button className="modal-close" onClick={() => setShowPayModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="pay-confirmation">
                  <div className="confirmation-header">
                    <CheckCircle size={32} className="success-icon" />
                    <h4>تأكيد اكتمال الدفع؟</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">المبلغ:</span>
                      <span className="value text-success font-bold">
                        {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowPayModal(false)}
                      disabled={markingAsPaid}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-primary" 
                      onClick={handleMarkAsPaid}
                      disabled={markingAsPaid}
                    >
                      {markingAsPaid ? 'جاري المعالجة...' : 'تأكيد الدفع'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

const PayrollEmployeeRow = ({ ep, payrollId, formatCurrency }) => {
  const [editing, setEditing] = useState(false);
  const [basic, setBasic] = useState(ep.basicSalary || 0);
  const [allowances, setAllowances] = useState(ep.totalAllowances || ep.allowances || 0);
  const [deductions, setDeductions] = useState(ep.totalDeductions || ep.deductions || 0);
  const [saving, setSaving] = useState(false);

  const net = parseFloat(basic) + parseFloat(allowances) - parseFloat(deductions);
  const API_BASE = process.env.REACT_APP_API_URL || '/api';

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/payroll/${payrollId}/employees/${ep._id || ep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ basicSalary: basic, additions: allowances, deductions })
      });
      const data = await res.json();
      if (data.success) {
        await fetch(`${API_BASE}/payroll/${payrollId}/recalculate`, {
          method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        setEditing(false);
        window.location.reload();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td>
        <div className="employee-cell">
          <div className="avatar avatar-sm">{ep.employeeName?.charAt(0)}</div>
          <div className="employee-info">
            <div className="employee-name">{ep.employeeName}</div>
            <div className="employee-designation">{ep.designation || ep.department}</div>
          </div>
        </div>
      </td>
      <td><span className="dept-badge">{ep.department}</span></td>
      <td>
        {editing ? (
          <input type="number" className="form-input" style={{ width: '90px', padding: '4px 8px' }} value={basic} onChange={e => setBasic(e.target.value)} />
        ) : (
          formatCurrency(ep.basicSalary || 0)
        )}
      </td>
      <td>
        {editing ? (
          <input type="number" className="form-input" style={{ width: '90px', padding: '4px 8px' }} value={allowances} onChange={e => setAllowances(e.target.value)} />
        ) : (
          formatCurrency(ep.totalAllowances || ep.allowances || 0)
        )}
      </td>
      <td className="text-red">
        {editing ? (
          <input type="number" className="form-input" style={{ width: '90px', padding: '4px 8px' }} value={deductions} onChange={e => setDeductions(e.target.value)} />
        ) : (
          formatCurrency(ep.totalDeductions || ep.deductions || 0)
        )}
      </td>
      <td className="net-salary font-bold">
        {editing ? formatCurrency(net) : formatCurrency(ep.netSalary || 0)}
        {editing && <div style={{ fontSize: '10px', color: '#6b7280' }}>auto</div>}
      </td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '2px 8px', fontSize: '11px' }}>{saving ? '...' : 'حفظ'}</button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditing(false)} style={{ padding: '2px 8px', fontSize: '11px' }}>{t('common.cancel')}</button>
          </div>
        ) : (
          <button className="btn-icon btn-edit" onClick={() => { setBasic(ep.basicSalary || 0); setAllowances(ep.totalAllowances || ep.allowances || 0); setDeductions(ep.totalDeductions || ep.deductions || 0); setEditing(true); }} title={t('common.edit')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </td>
    </tr>
  );
};

export default Payroll;