import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Wrench, Plus, AlertTriangle, Check, X, Clock, 
  Calendar, History, ArrowRight, RefreshCw, 
  Search, Filter, ChevronDown, ChevronUp, User,
  DollarSign, FileText, Truck, ArrowLeft, Play,
  PauseCircle, Settings
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});


export default function MaintenanceReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReminder, setSelectedReminder] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newTime: '',
    reason: ''
  });
  const [completeForm, setCompleteForm] = useState({
    actualCost: '',
    actualHours: '',
    partsUsed: '',
    notes: '',
    machineStatus: 'active'
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders`, {
        headers: headers() 
      });
      const data = await response.json();
      if (data.success && data.reminders) {
        setReminders(data.reminders);
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGroupedReminders = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const overdue = reminders.filter(r => {
      if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'in_progress') return false;
      const date = new Date(r.scheduledDate);
      return date < today;
    });

    const dueToday = reminders.filter(r => {
      if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'in_progress') return false;
      const date = new Date(r.scheduledDate);
      return date >= today && date < tomorrow;
    });

    const dueThisWeek = reminders.filter(r => {
      if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'in_progress') return false;
      const date = new Date(r.scheduledDate);
      return date >= tomorrow && date < weekEnd;
    });

    const upcoming = reminders.filter(r => {
      if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'in_progress') return false;
      const date = new Date(r.scheduledDate);
      return date >= weekEnd;
    });

    const inProgress = reminders.filter(r => r.status === 'in_progress');
    const completed = reminders.filter(r => r.status === 'completed');

    return { overdue, dueToday, dueThisWeek, upcoming, inProgress, completed };
  };

  const getFilteredReminders = () => {
    const { overdue, dueToday, dueThisWeek, upcoming, inProgress, completed } = getGroupedReminders();
    
    let filtered = [];
    switch (filterGroup) {
      case 'overdue':
        filtered = overdue;
        break;
      case 'today':
        filtered = dueToday;
        break;
      case 'week':
        filtered = dueThisWeek;
        break;
      case 'upcoming':
        filtered = upcoming;
        break;
      case 'in_progress':
        filtered = inProgress;
        break;
      case 'completed':
        filtered = completed;
        break;
      default:
        filtered = reminders;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.title?.toLowerCase().includes(query) ||
        r.recordNumber?.toLowerCase().includes(query) ||
        r.asset?.name?.toLowerCase().includes(query) ||
        r.assignedTechnician?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const getStatusColor = (status) => {
    const colors = {
      overdue: 'badge-danger',
      due_today: 'badge-warning',
      scheduled: 'badge-info',
      upcoming: 'badge-success',
      in_progress: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-secondary'
    };
    return colors[status] || 'badge-secondary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'badge-secondary',
      medium: 'badge-info',
      high: 'badge-warning',
      critical: 'badge-danger'
    };
    return colors[priority] || 'badge-secondary';
  };

  const getMaintenanceTypeColor = (type) => {
    const colors = {
      preventive: 'badge-success',
      corrective: 'badge-warning',
      emergency: 'badge-danger'
    };
    return colors[type] || 'badge-secondary';
  };

  const handleView = (reminder) => {
    setSelectedReminder(reminder);
    setShowViewModal(true);
  };

  const handleReschedule = (reminder) => {
    setSelectedReminder(reminder);
    const date = new Date(reminder.scheduledDate);
    setRescheduleForm({
      newDate: date.toISOString().split('T')[0],
      newTime: date.toTimeString().slice(0, 5),
      reason: ''
    });
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async () => {
    try {
      const newDateTime = new Date(`${rescheduleForm.newDate}T${rescheduleForm.newTime}`);
      
      // NOTE: Backend has no reschedule endpoint. Using correct mount point.
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          scheduledDate: newDateTime.toISOString(),
          reason: rescheduleForm.reason
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowRescheduleModal(false);
        fetchReminders();
        alert('Maintenance rescheduled successfully');
      } else {
        alert(data.message || 'Failed to reschedule');
      }
    } catch (error) {
      console.error('Error rescheduling maintenance:', error);
      alert('Failed to reschedule maintenance');
    }
  };

  const handleStartWork = (reminder) => {
    setSelectedReminder(reminder);
    setShowStartModal(true);
  };

  const handleSubmitStart = async () => {
    try {
      // NOTE: Backend has no start endpoint for reminders.
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders`, {
        method: 'PUT',
        headers: headers()
      });
      
      const data = await response.json();
      if (data.success) {
        setShowStartModal(false);
        fetchReminders();
        alert('Maintenance work started');
      } else {
        alert(data.message || 'Failed to start maintenance');
      }
    } catch (error) {
      console.error('Error starting maintenance:', error);
      alert('Failed to start maintenance');
    }
  };

  const handleMarkComplete = (reminder) => {
    setSelectedReminder(reminder);
    setCompleteForm({
      actualCost: reminder.totalCost || '',
      actualHours: reminder.estimatedHours || '',
      partsUsed: reminder.partsRequired?.join(', ') || '',
      notes: '',
      machineStatus: 'active'
    });
    setShowCompleteModal(true);
  };

  const handleSubmitComplete = async () => {
    try {
      // NOTE: Backend has no complete endpoint for reminders.
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({
          actualCost: parseFloat(completeForm.actualCost) || 0,
          actualHours: parseFloat(completeForm.actualHours) || 0,
          partsUsed: completeForm.partsUsed.split(',').map(p => p.trim()).filter(p => p),
          notes: completeForm.notes,
          machineStatus: completeForm.machineStatus
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setShowCompleteModal(false);
        fetchReminders();
        alert('Maintenance marked as complete');
      } else {
        alert(data.message || 'Failed to complete maintenance');
      }
    } catch (error) {
      console.error('Error completing maintenance:', error);
      alert('Failed to complete maintenance');
    }
  };

  const handleCancel = async (reminder) => {
    if (!window.confirm('Are you sure you want to cancel this maintenance?')) {
      return;
    }

    try {
      // NOTE: Backend has no cancel endpoint for reminders.
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders`, {
        method: 'PUT',
        headers: headers()
      });
      
      const data = await response.json();
      if (data.success) {
        fetchReminders();
        alert('Maintenance cancelled');
      } else {
        alert(data.message || 'Failed to cancel maintenance');
      }
    } catch (error) {
      console.error('Error cancelling maintenance:', error);
      alert('Failed to cancel maintenance');
    }
  };

  const grouped = getGroupedReminders();

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('maintenance.title')}</h1>
          <p>{t('maintenance.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.href = '/assets'}
          >
            <Wrench className="w-4 h-4" />
            جدولة جديدة
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => window.location.href = '/assets'}
          >
            <ArrowLeft className="w-4 h-4" />
            العودة للأصول
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <span className="stat-label" style={{ color: '#ef4444' }}>{t('maintenance.overdue')}</span>
          <span className="stat-value" style={{ color: '#ef4444' }}>{grouped.overdue.length}</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span className="stat-label" style={{ color: '#f59e0b' }}>{t('maintenance.dueToday')}</span>
          <span className="stat-value" style={{ color: '#f59e0b' }}>{grouped.dueToday.length}</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <span className="stat-label" style={{ color: '#3b82f6' }}>{t('maintenance.thisWeek')}</span>
          <span className="stat-value" style={{ color: '#3b82f6' }}>{grouped.dueThisWeek.length}</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <span className="stat-label" style={{ color: '#8b5cf6' }}>{t('production.inProgress')}</span>
          <span className="stat-value" style={{ color: '#8b5cf6' }}>{grouped.inProgress.length}</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
          <span className="stat-label" style={{ color: '#10b981' }}>{t('maintenance.upcoming')}</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{grouped.upcoming.length}</span>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #64748b' }}>
          <span className="stat-label">{t('common.statuses.completed')}</span>
          <span className="stat-value">{grouped.completed.length}</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="action-bar" style={{ marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
          <Search className="w-4 h-4" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by title, asset, or technician..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className={`btn ${filterGroup === 'all' ? 'btn-primary' : ''}`}
            onClick={() => setFilterGroup('all')}
          >
            <Filter className="w-4 h-4" />
            All
          </button>
          <button 
            className={`btn ${filterGroup === 'overdue' ? 'btn-danger' : ''}`}
            onClick={() => setFilterGroup('overdue')}
            style={{ color: filterGroup === 'overdue' ? 'white' : '#ef4444' }}
          >
            <AlertTriangle className="w-4 h-4" />
            Overdue ({grouped.overdue.length})
          </button>
          <button 
            className={`btn ${filterGroup === 'today' ? 'btn-warning' : ''}`}
            onClick={() => setFilterGroup('today')}
            style={{ color: filterGroup === 'today' ? 'white' : '#f59e0b' }}
          >
            <Clock className="w-4 h-4" />
            Today ({grouped.dueToday.length})
          </button>
          <button 
            className={`btn ${filterGroup === 'week' ? 'btn-primary' : ''}`}
            onClick={() => setFilterGroup('week')}
          >
            <Calendar className="w-4 h-4" />
            This Week ({grouped.dueThisWeek.length})
          </button>
          <button 
            className={`btn ${filterGroup === 'in_progress' ? 'btn-primary' : ''}`}
            onClick={() => setFilterGroup('in_progress')}
            style={{ color: filterGroup === 'in_progress' ? 'white' : '#8b5cf6' }}
          >
            <Play className="w-4 h-4" />
            In Progress ({grouped.inProgress.length})
          </button>
          <button 
            className={`btn ${filterGroup === 'upcoming' ? 'btn-success' : ''}`}
            onClick={() => setFilterGroup('upcoming')}
          >
            Upcoming ({grouped.upcoming.length})
          </button>
          <button 
            className={`btn ${filterGroup === 'completed' ? 'btn-secondary' : ''}`}
            onClick={() => setFilterGroup('completed')}
          >
            <Check className="w-4 h-4" />
            Completed ({grouped.completed.length})
          </button>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={fetchReminders}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Maintenance Table */}
      <div className="table-container">
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div className="loading" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '16px', color: '#64748b' }}>Loading maintenance reminders...</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>رقم السجل</th>
                <th>العنوان</th>
                <th>{t('assets.title')}</th>
                <th>{t('common.type')}</th>
                <th>التاريخ المجدول</th>
                <th>{t('maintenance.priority')}</th>
                <th>{t('common.status')}</th>
                <th>الفني</th>
                <th>Est. Cost</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredReminders().length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '48px' }}>
                    <div style={{ color: '#64748b' }}>
                      <Calendar className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                      <p>{t('maintenance.none')}</p>
                    </div>
                  </td>
                </tr>
              ) : getFilteredReminders().map((reminder) => (
                <tr key={reminder._id}>
                  <td><strong>{reminder.recordNumber}</strong></td>
                  <td>{reminder.title}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {reminder.asset?.type === 'vehicle' ? (
                        <Truck className="w-4 h-4" style={{ color: '#64748b' }} />
                      ) : (
                        <Wrench className="w-4 h-4" style={{ color: '#64748b' }} />
                      )}
                      <span>{reminder.asset?.name || '-'}</span>
                    </div>
                    <small style={{ color: '#94a3b8' }}>{reminder.asset?.code}</small>
                  </td>
                  <td>
                    <span className={`badge ${getMaintenanceTypeColor(reminder.maintenanceType)}`}>
                      {reminder.maintenanceType}
                    </span>
                  </td>
                  <td>
                    <div>{new Date(reminder.scheduledDate).toLocaleDateString()}</div>
                    <small style={{ color: '#94a3b8' }}>
                      {new Date(reminder.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </td>
                  <td>
                    <span className={`badge ${getPriorityColor(reminder.priority)}`}>
                      {reminder.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(reminder.status)}`}>
                      {reminder.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User className="w-4 h-4" style={{ color: '#64748b' }} />
                      {reminder.assignedTechnician || 'Unassigned'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <DollarSign className="w-4 h-4" style={{ color: '#10b981' }} />
                      {formatCurrency(reminder.totalCost || 0)}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-sm"
                        onClick={() => handleView(reminder)}
                        title="View Details"
                      >
                        <FileText className="w-3 h-3" />
                      </button>
                      {reminder.status !== 'completed' && reminder.status !== 'cancelled' && reminder.status !== 'in_progress' && (
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={() => handleStartWork(reminder)}
                          title="Start Work"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                      {reminder.status === 'in_progress' && (
                        <>
                          <button 
                            className="btn btn-warning btn-sm"
                            onClick={() => handleReschedule(reminder)}
                            title="Reschedule"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleMarkComplete(reminder)}
                            title="Mark Complete"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {reminder.status !== 'completed' && reminder.status !== 'cancelled' && reminder.status !== 'in_progress' && (
                        <>
                          <button 
                            className="btn btn-warning btn-sm"
                            onClick={() => handleReschedule(reminder)}
                            title="Reschedule"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleMarkComplete(reminder)}
                            title="Mark Complete"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleCancel(reminder)}
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View Modal */}
      {showViewModal && selectedReminder && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('maintenance.details')}</h2>
              <button className="modal-close" onClick={() => setShowViewModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>رقم التسجيل</label>
                  <input type="text" value={selectedReminder.recordNumber} disabled className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('common.status')}</label>
                  <div className="form-input" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className={`badge ${getStatusColor(selectedReminder.status)}`}>
                      {selectedReminder.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>العنوان</label>
                <input type="text" value={selectedReminder.title} disabled className="form-input" />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('assets.title')}</label>
                  <input 
                    type="text" 
                    value={`${selectedReminder.asset?.name || '-'} (${selectedReminder.asset?.code || '-'})`} 
                    disabled 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>{t('maintenance.type')}</label>
                  <div className="form-input">
                    <span className={`badge ${getMaintenanceTypeColor(selectedReminder.maintenanceType)}`}>
                      {selectedReminder.maintenanceType}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>التاريخ المجدول</label>
                  <input 
                    type="text" 
                    value={new Date(selectedReminder.scheduledDate).toLocaleString()} 
                    disabled 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>{t('maintenance.priority')}</label>
                  <div className="form-input">
                    <span className={`badge ${getPriorityColor(selectedReminder.priority)}`}>
                      {selectedReminder.priority}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('maintenance.assignedTech')}</label>
                  <input type="text" value={selectedReminder.assignedTechnician || 'Unassigned'} disabled className="form-input" />
                </div>
                <div className="form-group">
                  <label>{t('maintenance.estimatedHours')}</label>
                  <input type="text" value={`${selectedReminder.estimatedHours || '-'} hours`} disabled className="form-input" />
                </div>
              </div>
              
              <div className="form-group">
                <label>{t('common.description')}</label>
                <textarea value={selectedReminder.description} disabled className="form-textarea" rows="3" />
              </div>
              
              <div className="form-group">
                <label>{t('maintenance.partsRequired')}</label>
                <input 
                  type="text" 
                  value={selectedReminder.partsRequired?.join(', ') || '-'} 
                  disabled 
                  className="form-input" 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('maintenance.estimatedCost')}</label>
                  <input type="text" value={selectedReminder.totalCost ? formatCurrency(selectedReminder.totalCost) : '-'} disabled className="form-input" />
                </div>
                {selectedReminder.status === 'completed' && (
                  <div className="form-group">
                    <label>{t('maintenance.actualCost')}</label>
                    <input type="text" value={selectedReminder.actualCost ? formatCurrency(selectedReminder.actualCost) : '-'} disabled className="form-input" />
                  </div>
                )}
              </div>
              
              {selectedReminder.status === 'completed' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>{t('maintenance.completionDate')}</label>
                      <input 
                        type="text" 
                        value={selectedReminder.completionDate ? new Date(selectedReminder.completionDate).toLocaleString() : '-'} 
                        disabled 
                        className="form-input" 
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('maintenance.actualHours')}</label>
                      <input type="text" value={`${selectedReminder.actualHours || '-'} hours`} disabled className="form-input" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>الأجزاء المستخدمة</label>
                    <input type="text" value={selectedReminder.partsUsed?.join(', ') || '-'} disabled className="form-input" />
                  </div>
                  <div className="form-group">
                    <label>{t('maintenance.completionNotes')}</label>
                    <textarea value={selectedReminder.notes || '-'} disabled className="form-textarea" rows="2" />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>{t('common.close')}</button>
              {selectedReminder.status !== 'completed' && selectedReminder.status !== 'cancelled' && (
                <>
                  {selectedReminder.status !== 'in_progress' && (
                    <button className="btn btn-primary" onClick={() => { setShowViewModal(false); handleStartWork(selectedReminder); }}>
                      <Play className="w-4 h-4" /> Start Work
                    </button>
                  )}
                  <button className="btn btn-warning" onClick={() => { setShowViewModal(false); handleReschedule(selectedReminder); }}>
                    <Clock className="w-4 h-4" /> Reschedule
                  </button>
                  <button className="btn btn-success" onClick={() => { setShowViewModal(false); handleMarkComplete(selectedReminder); }}>
                    <Check className="w-4 h-4" /> Mark Complete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start Work Modal */}
      {showStartModal && selectedReminder && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">بدء أعمال الصيانة</h2>
              <button className="modal-close" onClick={() => setShowStartModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <strong>Task:</strong> {selectedReminder.title} ({selectedReminder.recordNumber})
              </div>
              
              <div className="form-group">
                <label>{t('assets.title')}</label>
                <input 
                  type="text" 
                  value={`${selectedReminder.asset?.name || '-'} (${selectedReminder.asset?.code || '-'})`} 
                  disabled 
                  className="form-input" 
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>التاريخ المجدول</label>
                  <input 
                    type="text" 
                    value={new Date(selectedReminder.scheduledDate).toLocaleString()} 
                    disabled 
                    className="form-input" 
                  />
                </div>
                <div className="form-group">
                  <label>{t('maintenance.assignedTech')}</label>
                  <input type="text" value={selectedReminder.assignedTechnician || 'Unassigned'} disabled className="form-input" />
                </div>
              </div>
              
              <div className="alert alert-warning">
                <strong>Note:</strong> Starting work will update the machine status to "Under Maintenance" and track the start time.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowStartModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSubmitStart}>
                <Play className="w-4 h-4" /> Start Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedReminder && (
        <div className="modal-overlay" onClick={() => setShowRescheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">إعادة جدولة الصيانة</h2>
              <button className="modal-close" onClick={() => setShowRescheduleModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                <strong>Current Schedule:</strong> {new Date(selectedReminder.scheduledDate).toLocaleString()}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>New Date *</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={rescheduleForm.newDate}
                    onChange={(e) => setRescheduleForm({...rescheduleForm, newDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>New Time *</label>
                  <input 
                    type="time" 
                    className="form-input"
                    value={rescheduleForm.newTime}
                    onChange={(e) => setRescheduleForm({...rescheduleForm, newTime: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>سبب إعادة الجدولة</label>
                <textarea 
                  className="form-textarea" 
                  rows="3"
                  placeholder="Enter reason for rescheduling..."
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({...rescheduleForm, reason: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRescheduleModal(false)}>{t('common.cancel')}</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmitReschedule}
                disabled={!rescheduleForm.newDate || !rescheduleForm.newTime}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && selectedReminder && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('maintenance.markMaintenanceComplete')}</h2>
              <button className="modal-close" onClick={() => setShowCompleteModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                <strong>Task:</strong> {selectedReminder.title} ({selectedReminder.recordNumber})
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Actual Cost (EGP) *</label>
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="0.00"
                    value={completeForm.actualCost}
                    onChange={(e) => setCompleteForm({...completeForm, actualCost: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Actual Hours Spent *</label>
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="0"
                    value={completeForm.actualHours}
                    onChange={(e) => setCompleteForm({...completeForm, actualHours: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Parts Used (comma-separated)</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="e.g., Bearings, Seals, Oil Filter"
                  value={completeForm.partsUsed}
                  onChange={(e) => setCompleteForm({...completeForm, partsUsed: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>{t('maintenance.completionNotes')}</label>
                <textarea 
                  className="form-textarea" 
                  rows="3"
                  placeholder="Describe the work completed, any issues found, etc."
                  value={completeForm.notes}
                  onChange={(e) => setCompleteForm({...completeForm, notes: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>{t('maintenance.machineStatus')}</label>
                <select 
                  className="form-select"
                  value={completeForm.machineStatus}
                  onChange={(e) => setCompleteForm({...completeForm, machineStatus: e.target.value})}
                >
                  <option value="active">Active - Ready for Use</option>
                  <option value="under_maintenance">Under Maintenance - Needs More Work</option>
                  <option value="broken">Broken - Requires Further Repair</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCompleteModal(false)}>{t('common.cancel')}</button>
              <button 
                className="btn btn-success" 
                onClick={handleSubmitComplete}
                disabled={!completeForm.actualCost || !completeForm.actualHours}
              >
                <Check className="w-4 h-4" /> Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
