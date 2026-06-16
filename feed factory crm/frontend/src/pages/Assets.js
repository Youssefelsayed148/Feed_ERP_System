import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Wrench, Plus, AlertTriangle, Check, X, Play,
  Clock, DollarSign, Settings, Truck, Calendar,
  History, Bell, User, ChevronDown, ChevronUp,
  FileText, Upload, Filter, Search, RefreshCw
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export default function Assets() {
  const [activeTab, setActiveTab] = useState('machines'); // 'machines', 'vehicles', 'maintenance'
  const [machines, setMachines] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [machineForm, setMachineForm] = useState({
    code: '', name: '', type: '', model: '', manufacturer: '', serialNumber: '',
    purchaseDate: '', purchaseCost: '', location: '', status: 'operational', notes: ''
  });
  const [vehicleForm, setVehicleForm] = useState({
    code: '', name: '', type: '', plateNumber: '', model: '', make: '',
    capacityKg: '', driverId: '', status: 'available', notes: ''
  });
  const [expandedRows, setExpandedRows] = useState({});

  // New Schedule Maintenance Form State
  const [scheduleMaintenanceForm, setScheduleMaintenanceForm] = useState({
    assetType: 'machine',
    assetId: '',
    maintenanceType: 'preventive',
    title: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    estimatedCost: '',
    assignedTechnician: '',
    priority: 'medium',
    estimatedHours: '',
    isRecurring: false,
    recurringInterval: '',
    recurringUnit: 'months',
    partsRequired: ''
  });

  // Maintenance Schedule Form State (for machine schedule setup)
  const [scheduleForm, setScheduleForm] = useState({
    type: 'hours_based',
    intervalValue: '',
    intervalUnit: 'hours',
    lastMaintenanceDate: '',
    lastMaintenanceHours: '',
    reminderDaysBefore: 7,
    notifyUsers: [],
    emailEnabled: false,
    whatsappEnabled: false
  });

  // Record Maintenance Form State
  const [recordForm, setRecordForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'preventive',
    description: '',
    cost: '',
    hoursSpent: '',
    partsReplaced: '',
    performedBy: ''
  });

  useEffect(() => {
    fetchData();
    fetchMaintenanceAlerts();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'machines') {
        const [machRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/assets/machines`, { headers: headers() }),
          fetch(`${API_URL}/assets/machines/stats`, { headers: headers() })
        ]);
        const data = await machRes.json();
        const statsData = await statsRes.json();
        const machinesData = data.machines || data || [];
        setMachines(Array.isArray(machinesData) ? machinesData : []);
        setStats(statsData || {});
      } else if (activeTab === 'vehicles') {
        const [vehRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/assets/vehicles`, { headers: headers() }),
          fetch(`${API_URL}/assets/vehicles/stats`, { headers: headers() })
        ]);
        const data = await vehRes.json();
        const statsData = await statsRes.json();
        const vehiclesData = data.vehicles || data || [];
        setVehicles(Array.isArray(vehiclesData) ? vehiclesData : []);
        setStats(statsData || {});
      } else {
        const [maintRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/assets/maintenance`, { headers: headers() }),
          fetch(`${API_URL}/assets/maintenance/stats`, { headers: headers() })
        ]);
        const data = await maintRes.json();
        const statsData = await statsRes.json();
        const maintenanceData = data.maintenance || data.records || data || [];
        setMaintenance(Array.isArray(maintenanceData) ? maintenanceData : []);
        setStats(statsData || {});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (activeTab === 'machines') {
        setMachines([]);
        setStats({});
      } else if (activeTab === 'vehicles') {
        setVehicles([]);
        setStats({});
      } else {
        setMaintenance([]);
        setStats({});
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/maintenance-reminders/reminders/due`, { headers: headers() });
      const data = await response.json();
      const reminders = data.reminders || [];
      setMaintenanceAlerts({
        overdue: reminders.filter(r => r.status === 'overdue').length,
        dueThisWeek: reminders.filter(r => r.status === 'pending' && r.due_date).length,
        upcoming: reminders.filter(r => r.status === 'pending').length
      });
    } catch (error) {
      console.error('Error fetching maintenance alerts:', error);
      setMaintenanceAlerts({ overdue: 0, dueThisWeek: 0, upcoming: 0 });
    }
  };

  const handleOpenScheduleMaintenance = () => {
    setScheduleMaintenanceForm({
      assetType: 'machine',
      assetId: '',
      maintenanceType: 'preventive',
      title: '',
      description: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '09:00',
      estimatedCost: '',
      assignedTechnician: '',
      priority: 'medium',
      estimatedHours: '',
      isRecurring: false,
      recurringInterval: '',
      recurringUnit: 'months',
      partsRequired: ''
    });
    setShowScheduleModal(true);
  };

  const handleSubmitScheduleMaintenance = async () => {
    try {
      const scheduledDateTime = new Date(`${scheduleMaintenanceForm.scheduledDate}T${scheduleMaintenanceForm.scheduledTime}`);
      
      const payload = {
        ...scheduleMaintenanceForm,
        scheduledDate: scheduledDateTime.toISOString(),
        partsRequired: scheduleMaintenanceForm.partsRequired.split(',').map(p => p.trim()).filter(p => p)
      };

      const response = await fetch(`${API_URL}/maintenance-reminders/check-reminders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (data.success) {
        setShowScheduleModal(false);
        fetchData();
        fetchMaintenanceAlerts();
        alert('Maintenance scheduled successfully');
      } else {
        alert(data.message || 'Failed to schedule maintenance');
      }
    } catch (error) {
      console.error('Error scheduling maintenance:', error);
      alert('Error scheduling maintenance. Please try again.');
    }
  };

  const handleScheduleMaintenanceSetup = async () => {
    try {
      const response = await fetch(`${API_URL}/maintenance-reminders/machines/${selectedMachine._id}/schedule-maintenance`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(scheduleForm)
      });
      const data = await response.json();
      if (data.success) {
        setShowScheduleModal(false);
        fetchData();
        fetchMaintenanceAlerts();
        alert('Maintenance schedule updated successfully');
      } else {
        alert(data.message || 'Failed to update schedule');
      }
    } catch (error) {
      console.error('Error scheduling maintenance:', error);
      alert('Error scheduling maintenance. Please try again.');
    }
  };

  const handleRecordMaintenance = async () => {
    try {
      const formData = {
        ...recordForm,
        partsReplaced: recordForm.partsReplaced.split(',').map(p => p.trim()).filter(p => p)
      };
      
      const response = await fetch(`${API_URL}/maintenance-reminders/machines/${selectedMachine._id}/record-maintenance`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      if (data.success) {
        setShowRecordModal(false);
        fetchData();
        fetchMaintenanceAlerts();
        alert('Maintenance recorded successfully');
      } else {
        alert(data.message || 'Failed to record maintenance');
      }
    } catch (error) {
      console.error('Error recording maintenance:', error);
      alert('Error recording maintenance. Please try again.');
    }
  };

  const toggleRowExpand = (machineId) => {
    setExpandedRows(prev => ({
      ...prev,
      [machineId]: !prev[machineId]
    }));
  };

  const getMachineStatusColor = (status) => {
    const colors = {
      active: 'badge-success',
      under_maintenance: 'badge-warning',
      broken: 'badge-danger',
      out_of_service: 'badge-secondary'
    };
    return colors[status] || 'badge-secondary';
  };

  const getMaintenanceStatusColor = (status) => {
    const colors = {
      scheduled: 'badge-info',
      in_progress: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-danger'
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

  const isOverdue = (date) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  const isDueSoon = (date) => {
    if (!date) return false;
    const daysUntil = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  };

  const getDaysRemaining = (date) => {
    if (!date) return null;
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const getTypeLabel = (type) => {
    const labels = { 'Mixer': t('assets.mixer'), 'Grinder': t('assets.grinder'), 'Pelletizer': t('assets.pelletizer'), 'Cooler': t('assets.cooler'), 'Packaging': t('assets.packaging'), 'Utility': t('assets.utility'), 'Material Handling': t('assets.materialHandling'), 'Feeder': t('assets.feeder') };
    return labels[type] || type;
  };

  const getMachineStatusLabel = (status) => {
    const labels = { 'operational': t('assets.operational'), 'maintenance': t('assets.underMaintenance'), 'idle': t('assets.idle'), 'broken': t('assets.broken') };
    return labels[status] || status;
  };

  const handleViewReminders = () => {
    window.location.href = '/maintenance-reminders';
  };

  const handleSaveMachine = async () => {
    if (!machineForm.code || !machineForm.name) { alert('Code and Name are required'); return; }
    try {
      const body = editingMachine ? { ...machineForm, id: editingMachine.id } : machineForm;
      const url = editingMachine ? `${API_URL}/assets/machines/${editingMachine.id}` : `${API_URL}/assets/machines`;
      const method = editingMachine ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      setShowMachineModal(false);
      setEditingMachine(null);
      fetchData();
    } catch (err) { alert('Error saving machine: ' + err.message); }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.code || !vehicleForm.name) { alert('Code and Name are required'); return; }
    try {
      const body = editingVehicle ? { ...vehicleForm, id: editingVehicle.id } : vehicleForm;
      const url = editingVehicle ? `${API_URL}/assets/vehicles/${editingVehicle.id}` : `${API_URL}/assets/vehicles`;
      const method = editingVehicle ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      setShowVehicleModal(false);
      setEditingVehicle(null);
      fetchData();
    } catch (err) { alert('Error saving vehicle: ' + err.message); }
  };

  const handleEditMachine = (machine) => {
    setMachineForm({
      code: machine.code || '', name: machine.name || '', type: machine.type || '',
      model: machine.model || '', manufacturer: machine.manufacturer || '',
      serialNumber: machine.serialNumber || '', purchaseDate: machine.purchaseDate || '',
      purchaseCost: machine.purchaseCost || '', location: machine.location || '',
      status: machine.status || 'operational', notes: machine.notes || ''
    });
    setEditingMachine(machine);
    setShowMachineModal(true);
  };

  const handleEditVehicle = (vehicle) => {
    setVehicleForm({
      code: vehicle.code || '', name: vehicle.name || '', type: vehicle.type || '',
      plateNumber: vehicle.plateNumber || '', model: vehicle.model || '',
      make: vehicle.make || '', capacityKg: vehicle.capacityKg || '',
      driverId: vehicle.driverId || '', status: vehicle.status || 'available',
      notes: vehicle.notes || ''
    });
    setEditingVehicle(vehicle);
    setShowVehicleModal(true);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('assets.title')}</h1>
          <p>إدارة الآلات والمركبات وجداول الصيانة</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => { setShowMachineModal(true); setEditingMachine(null); }}>
            <Plus className="w-4 h-4" /> {t('assets.addMachine')}
          </button>
          <button className="btn btn-primary" onClick={() => { setShowVehicleModal(true); setEditingVehicle(null); }}>
            <Plus className="w-4 h-4" /> {t('assets.addVehicle')}
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleOpenScheduleMaintenance}
          >
            <Plus className="w-4 h-4" />
            جدولة صيانة
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleViewReminders}
          >
            <Bell className="w-4 h-4" />
            عرض التذكيرات
          </button>
        </div>
      </div>

      {/* Maintenance Alerts Banner */}
      {(maintenanceAlerts.overdue > 0 || maintenanceAlerts.dueThisWeek > 0 || maintenanceAlerts.upcoming > 0) && (
        <div className="alert-banner" style={{ 
          background: maintenanceAlerts.overdue > 0 ? '#fef2f2' : maintenanceAlerts.dueThisWeek > 0 ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${maintenanceAlerts.overdue > 0 ? '#fee2e2' : maintenanceAlerts.dueThisWeek > 0 ? '#fef3c7' : '#bbf7d0'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Wrench className="w-5 h-5" style={{ color: maintenanceAlerts.overdue > 0 ? '#ef4444' : maintenanceAlerts.dueThisWeek > 0 ? '#f59e0b' : '#10b981' }} />
            <strong style={{ color: maintenanceAlerts.overdue > 0 ? '#dc2626' : maintenanceAlerts.dueThisWeek > 0 ? '#d97706' : '#059669' }}>
              تنبيهات الصيانة
            </strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '28px' }}>
            {maintenanceAlerts.overdue > 0 && (
              <div style={{ color: '#dc2626' }}>
                Overdue: {maintenanceAlerts.overdue} items
              </div>
            )}
            {maintenanceAlerts.dueThisWeek > 0 && (
              <div style={{ color: '#d97706' }}>
                Due This Week: {maintenanceAlerts.dueThisWeek} items
              </div>
            )}
            {maintenanceAlerts.upcoming > 0 && (
              <div style={{ color: '#059669' }}>
                Upcoming: {maintenanceAlerts.upcoming} items
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', paddingLeft: '28px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleViewReminders}
            >
              عرض الكل
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="action-bar" style={{ marginBottom: '24px', marginTop: '0' }}>
        <button
          onClick={() => setActiveTab('machines')}
          className={`btn ${activeTab === 'machines' ? 'btn-primary' : ''}`}
        >
          <Wrench className="w-4 h-4" />
          الآلات
        </button>
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`btn ${activeTab === 'vehicles' ? 'btn-primary' : ''}`}
        >
          <Truck className="w-4 h-4" />
          المركبات
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`btn ${activeTab === 'maintenance' ? 'btn-primary' : ''}`}
        >
          <Settings className="w-4 h-4" />
          سجلات الصيانة
        </button>
      </div>

      {/* Stats */}
      {stats && activeTab === 'machines' && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">{t('assets.totalMachines')}</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('common.statuses.active')}</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{stats.active}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('assets.underMaintenance')}</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.maintenance}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('common.statuses.overdue')}</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{maintenanceAlerts.overdue}</span>
          </div>
        </div>
      )}

      {stats && activeTab === 'vehicles' && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">إجمالي المركبات</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('common.statuses.active')}</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{stats.active}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('assets.underMaintenance')}</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.maintenance}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('assets.outOfService')}</span>
            <span className="stat-value" style={{ color: '#ef4444' }}>{stats.broken}</span>
          </div>
        </div>
      )}

      {stats && activeTab === 'maintenance' && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">إجمالي السجلات</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('production.scheduled')}</span>
            <span className="stat-value" style={{ color: '#3b82f6' }}>{stats.scheduled}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('production.inProgress')}</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.inProgress}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">تكلفة هذا الشهر</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(stats.monthlyCost || 0)}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="table-container">
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
            <div className="loading" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '16px', color: '#64748b' }}>{t('common.loading')}</p>
          </div>
        ) : activeTab === 'machines' ? (
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>آلة</th>
                <th>{t('common.type')}</th>
                <th>{t('assets.location')}</th>
                <th>{t('common.hours')}</th>
                <th>الصيانة القادمة</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {machines.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>لا توجد آلات</td></tr>
              ) : machines.map((mach) => (
                <React.Fragment key={mach._id}>
                  <tr>
                    <td>
                      <button 
                        className="btn-icon" 
                        onClick={() => toggleRowExpand(mach._id)}
                        style={{ padding: '4px' }}
                      >
                        {expandedRows[mach._id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                    <td>
                      <strong>{mach.name}</strong>
                      <br />
                      <small style={{ color: '#64748b' }}>{mach.code}</small>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{getTypeLabel(mach.type)}</td>
                    <td>{mach.location || '-'}</td>
                    <td>{mach.totalHours}</td>
                    <td>
                      {mach.nextServiceDate ? (
                        <div>
                          <div>{new Date(mach.nextServiceDate).toLocaleDateString()}</div>
                          {isOverdue(mach.nextServiceDate) && (
                            <span className="badge badge-danger" style={{ fontSize: '0.7em' }}>
                              {Math.abs(getDaysRemaining(mach.nextServiceDate))} days overdue
                            </span>
                          )}
                          {isDueSoon(mach.nextServiceDate) && !isOverdue(mach.nextServiceDate) && (
                            <span className="badge badge-warning" style={{ fontSize: '0.7em' }}>
                              Due in {getDaysRemaining(mach.nextServiceDate)} days
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <span className={`badge ${getMachineStatusColor(mach.status)}`}>
                        {getMachineStatusLabel(mach.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.85em' }}
                          onClick={() => { setSelectedMachine(mach); setShowScheduleModal(true); }}
                        >
                          <Calendar className="w-3 h-3" /> جدولة
                        </button>
                        <button 
                          className="btn btn-success" 
                          style={{ padding: '6px 12px', fontSize: '0.85em' }}
                          onClick={() => { setSelectedMachine(mach); setShowRecordModal(true); }}
                        >
                          <Check className="w-3 h-3" /> تسجيل
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.85em' }}
                          onClick={() => { setSelectedMachine(mach); setShowHistoryModal(true); }}
                        >
                          <History className="w-3 h-3" /> السجل
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRows[mach._id] && (
                    <tr>
                      <td colSpan="8" style={{ background: '#f8fafc', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                          <div className="card">
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9em' }}>جدول الصيانة</h4>
                            {mach.maintenanceSchedule ? (
                              <div style={{ fontSize: '0.85em' }}>
                                <div><strong>{t('assets.maintenanceType')}:</strong> {mach.maintenanceSchedule.type?.replace('_', ' ')}</div>
                                <div><strong>{t('assets.intervalValue')}:</strong> {mach.maintenanceSchedule.intervalValue} {mach.maintenanceSchedule.intervalUnit}</div>
                                <div><strong>{t('assets.lastMaintenanceDate')}:</strong> {mach.maintenanceSchedule.lastMaintenanceDate ? new Date(mach.maintenanceSchedule.lastMaintenanceDate).toLocaleDateString() : '-'}</div>
                                <div><strong>{t('assets.nextService')}:</strong> {mach.maintenanceSchedule.nextMaintenanceDate ? new Date(mach.maintenanceSchedule.nextMaintenanceDate).toLocaleDateString() : '-'}</div>
                                <div><strong>{t('assets.reminders')}:</strong> {mach.maintenanceSchedule.reminderDaysBefore || 7} {t('common.days')} {t('assets.before')}</div>
                              </div>
                            ) : (
                              <div style={{ color: '#64748b', fontSize: '0.85em' }}>لم يتم تعيين جدول</div>
                            )}
                          </div>
                          <div className="card">
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9em' }}>إعدادات التذكيرات</h4>
                            {mach.reminders ? (
                              <div style={{ fontSize: '0.85em' }}>
                                <div><strong>{t('common.enabled')}:</strong> {mach.reminders.enabled ? t('common.yes') : t('common.no')}</div>
                                <div><strong>{t('common.email')}:</strong> {mach.reminders.emailEnabled ? t('common.yes') : t('common.no')}</div>
                                <div><strong>{t('common.whatsapp')}:</strong> {mach.reminders.whatsappEnabled ? t('common.yes') : t('common.no')}</div>
                                <div><strong>{t('assets.notifyUsers')}:</strong> {mach.reminders.notifyUsers?.length || 0} {t('common.users')}</div>
                              </div>
                            ) : (
                              <div style={{ color: '#64748b', fontSize: '0.85em' }}>{t('assets.defaultSettings')}</div>
                            )}
                          </div>
                          <div className="card">
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9em' }}>آخر الصيانات</h4>
                            {mach.maintenanceHistory && mach.maintenanceHistory.length > 0 ? (
                              <div style={{ fontSize: '0.85em' }}>
                                <div><strong>{t('common.last')}:</strong> {new Date(mach.maintenanceHistory[mach.maintenanceHistory.length - 1].date).toLocaleDateString()}</div>
                                <div><strong>{t('common.type')}:</strong> {mach.maintenanceHistory[mach.maintenanceHistory.length - 1].type}</div>
                                <div><strong>{t('common.cost')}:</strong> {formatCurrency(mach.maintenanceHistory[mach.maintenanceHistory.length - 1].cost)}</div>
                              </div>
                            ) : (
                              <div style={{ color: '#64748b', fontSize: '0.85em' }}>لا يوجد سجل صيانة</div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'vehicles' ? (
          <table className="table">
            <thead>
              <tr>
                <th>مركبة</th>
                <th>{t('common.type')}</th>
                <th>رقم اللوحة</th>
                <th>إجمالي الكيلومترات</th>
                <th>الصيانة القادمة</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>لا توجد مركبات</td></tr>
              ) : vehicles.map((veh) => (
                <tr key={veh._id}>
                  <td>
                    <strong>{veh.name}</strong>
                    <br />
                    <small style={{ color: '#64748b' }}>{veh.code}</small>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{veh.type}</td>
                  <td>{veh.plateNumber}</td>
                  <td>{veh.totalKm?.toLocaleString() || 0} km</td>
                  <td>
                    {veh.nextServiceDate ? (
                      <div>
                        <div>{new Date(veh.nextServiceDate).toLocaleDateString()}</div>
                        {isOverdue(veh.nextServiceDate) && (
                          <span className="badge badge-danger" style={{ fontSize: '0.7em' }}>
                            {Math.abs(getDaysRemaining(veh.nextServiceDate))} days overdue
                          </span>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    <span className={`badge ${getMachineStatusColor(veh.status)}`}>
                      {veh.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '0.85em' }}
                        onClick={() => { setSelectedMachine(veh); setShowScheduleModal(true); }}
                      >
                        <Calendar className="w-3 h-3" /> جدولة
                      </button>
                      <button 
                        className="btn btn-success" 
                        style={{ padding: '6px 12px', fontSize: '0.85em' }}
                        onClick={() => { setSelectedMachine(veh); setShowRecordModal(true); }}
                      >
                        <Check className="w-3 h-3" /> تسجيل
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>رقم السجل</th>
                <th>العنوان</th>
                <th>{t('assets.asset')}</th>
                <th>{t('common.type')}</th>
                <th>{t('common.cost')}</th>
                <th>{t('production.scheduled')}</th>
                <th>{t('maintenance.priority')}</th>
                <th>{t('common.status')}</th>
                <th>الفني</th>
              </tr>
            </thead>
            <tbody>
              {maintenance.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '48px' }}>لا توجد سجلات صيانة</td></tr>
              ) : maintenance.map((rec) => (
                <tr key={rec._id}>
                  <td><strong>{rec.recordNumber}</strong></td>
                  <td>{rec.title}</td>
                  <td>
                    {rec.asset ? rec.asset.name : '-'}
                  </td>
                  <td>
                    <span className={`badge ${getMaintenanceTypeColor(rec.maintenanceType)}`}>
                      {rec.maintenanceType}
                    </span>
                  </td>
                  <td>{formatCurrency(rec.totalCost || 0)}</td>
                  <td>
                    {rec.scheduledDate ? new Date(rec.scheduledDate).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <span className={`badge ${getPriorityColor(rec.priority)}`}>
                      {rec.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getMaintenanceStatusColor(rec.status)}`}>
                      {rec.status}
                    </span>
                  </td>
                  <td>{rec.assignedTechnician || 'غير معين'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule Maintenance Modal - New Maintenance Task */}
      {showScheduleModal && !selectedMachine && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('assets.scheduleNewMaintenance')}</h2>
              <button className="modal-close" onClick={() => setShowScheduleModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>{t('assets.assetType')} *</label>
                  <select 
                    className="form-select"
                    value={scheduleMaintenanceForm.assetType}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, assetType: e.target.value, assetId: ''})}
                  >
                    <option value="machine">آلة</option>
                    <option value="vehicle">مركبة</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('assets.selectAsset')} *</label>
                  <select 
                    className="form-select"
                    value={scheduleMaintenanceForm.assetId}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, assetId: e.target.value})}
                  >
                    <option value="">-- Select {scheduleMaintenanceForm.assetType === 'machine' ? 'آلة' : 'مركبة'} --</option>
                    {scheduleMaintenanceForm.assetType === 'machine' ? (
                      machines.map(m => <option key={m._id} value={m._id}>{m.name} ({m.code})</option>)
                    ) : (
                      vehicles.map(v => <option key={v._id} value={v._id}>{v.name} ({v.plateNumber})</option>)
                    )}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('assets.maintenanceType')} *</label>
                  <select 
                    className="form-select"
                    value={scheduleMaintenanceForm.maintenanceType}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, maintenanceType: e.target.value})}
                  >
                    <option value="preventive">{t('assets.preventive')}</option>
                    <option value="corrective">{t('assets.corrective')}</option>
                    <option value="emergency">{t('assets.emergency')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('assets.priority')} *</label>
                  <select 
                    className="form-select"
                    value={scheduleMaintenanceForm.priority}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, priority: e.target.value})}
                  >
                    <option value="low">{t('common.low')}</option>
                    <option value="medium">{t('common.medium')}</option>
                    <option value="high">{t('common.high')}</option>
                    <option value="critical">{t('common.critical')}</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>{t('assets.title')} *</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="e.g., Regular Oil Change"
                  value={scheduleMaintenanceForm.title}
                  onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, title: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>{t('common.description')}</label>
                <textarea 
                  className="form-textarea" 
                  rows="3"
                  placeholder={t('assets.describeWork')}
                  value={scheduleMaintenanceForm.description}
                  onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, description: e.target.value})}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('assets.scheduledDate')} *</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={scheduleMaintenanceForm.scheduledDate}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, scheduledDate: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('assets.scheduledTime')} *</label>
                  <input 
                    type="time" 
                    className="form-input"
                    value={scheduleMaintenanceForm.scheduledTime}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, scheduledTime: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Estimated {t("common.currency")} *</label>
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="0.00"
                    value={scheduleMaintenanceForm.estimatedCost}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, estimatedCost: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('assets.estimatedHours')} *</label>
                  <input 
                    type="number" 
                    className="form-input"
                    placeholder="0"
                    value={scheduleMaintenanceForm.estimatedHours}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, estimatedHours: e.target.value})}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('assets.assignedTech')} *</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="اسم الفني"
                  value={scheduleMaintenanceForm.assignedTechnician}
                  onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, assignedTechnician: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>{t('assets.partsRequired')}</label>
                <input 
                  type="text" 
                  className="form-input"
                  placeholder="e.g., Oil Filter, Air Filter, Spark Plugs"
                  value={scheduleMaintenanceForm.partsRequired}
                  onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, partsRequired: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={scheduleMaintenanceForm.isRecurring}
                    onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, isRecurring: e.target.checked})}
                  />
                  جدول متكرر
                </label>
              </div>

              {scheduleMaintenanceForm.isRecurring && (
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('assets.repeatEvery')}</label>
                    <input 
                      type="number" 
                      className="form-input"
                      placeholder="1"
                      value={scheduleMaintenanceForm.recurringInterval}
                      onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, recurringInterval: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t('assets.unit')}</label>
                    <select 
                      className="form-select"
                      value={scheduleMaintenanceForm.recurringUnit}
                      onChange={(e) => setScheduleMaintenanceForm({...scheduleMaintenanceForm, recurringUnit: e.target.value})}
                    >
                      <option value="days">{t('common.days')}</option>
                      <option value="weeks">{t('assets.weeks')}</option>
                      <option value="months">أشهر</option>
                      <option value="years">{t('assets.years')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>{t('common.cancel')}</button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmitScheduleMaintenance}
                disabled={!scheduleMaintenanceForm.assetId || !scheduleMaintenanceForm.title || !scheduleMaintenanceForm.scheduledDate || !scheduleMaintenanceForm.scheduledTime || !scheduleMaintenanceForm.estimatedCost || !scheduleMaintenanceForm.estimatedHours || !scheduleMaintenanceForm.assignedTechnician}
              >
                جدولة صيانة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Maintenance Setup Modal - Machine Schedule Setup */}
      {showScheduleModal && selectedMachine && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('assets.setupMaintenanceSchedule')}</h2>
              <button className="modal-close" onClick={() => setShowScheduleModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>آلة</label>
                <input type="text" value={selectedMachine?.name || ''} disabled className="form-input" />
              </div>
              <div className="form-group">
                <label>{t('assets.scheduleType')} *</label>
                <select 
                  className="form-select" 
                  value={scheduleForm.type}
                  onChange={(e) => setScheduleForm({...scheduleForm, type: e.target.value})}
                >
                  <option value="hours_based">{t('assets.hoursBased')}</option>
                  <option value="time_based">{t('assets.timeBased')}</option>
                  <option value="usage_based">{t('assets.usageBased')}</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('assets.intervalValue')} *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g., 500"
                    value={scheduleForm.intervalValue}
                    onChange={(e) => setScheduleForm({...scheduleForm, intervalValue: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('assets.intervalUnit')} *</label>
                  <select 
                    className="form-select"
                    value={scheduleForm.intervalUnit}
                    onChange={(e) => setScheduleForm({...scheduleForm, intervalUnit: e.target.value})}
                  >
                    <option value="hours">{t('common.hours')}</option>
                    <option value="days">{t('common.days')}</option>
                    <option value="weeks">{t('assets.weeks')}</option>
                    <option value="months">أشهر</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('assets.lastMaintenanceDate')}</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={scheduleForm.lastMaintenanceDate}
                    onChange={(e) => setScheduleForm({...scheduleForm, lastMaintenanceDate: e.target.value})}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>{t('assets.lastMaintenanceHours')}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="ساعات التشغيل عند آخر صيانة"
                    value={scheduleForm.lastMaintenanceHours}
                    onChange={(e) => setScheduleForm({...scheduleForm, lastMaintenanceHours: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('assets.sendReminder')}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  min="1"
                  max="30"
                  value={scheduleForm.reminderDaysBefore}
                  onChange={(e) => setScheduleForm({...scheduleForm, reminderDaysBefore: parseInt(e.target.value) || 7})}
                />
              </div>
              <div className="form-group">
                <label>{t('assets.notificationSettings')}</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={scheduleForm.emailEnabled}
                      onChange={(e) => setScheduleForm({...scheduleForm, emailEnabled: e.target.checked})}
                    />
                    البريد
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="checkbox" 
                      checked={scheduleForm.whatsappEnabled}
                      onChange={(e) => setScheduleForm({...scheduleForm, whatsappEnabled: e.target.checked})}
                    />
                    واتساب
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleScheduleMaintenanceSetup}>{t('assets.saveSchedule')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Record Maintenance Modal */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('assets.recordMaintenance')}</h2>
              <button className="modal-close" onClick={() => setShowRecordModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('assets.asset')}</label>
                <input type="text" value={selectedMachine?.name || ''} disabled className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input 
                    type="date" 
                    className="form-input"
                    value={recordForm.date}
                    onChange={(e) => setRecordForm({...recordForm, date: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('assets.maintenanceType')} *</label>
                  <select 
                    className="form-select"
                    value={recordForm.type}
                    onChange={(e) => setRecordForm({...recordForm, type: e.target.value})}
                  >
                    <option value="preventive">{t('assets.preventive')}</option>
                    <option value="corrective">{t('assets.corrective')}</option>
                    <option value="emergency">{t('assets.emergency')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  className="form-textarea" 
                  rows="3"
                  placeholder={t('assets.describeWorkDone')}
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({...recordForm, description: e.target.value})}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t("common.currency")} *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00"
                    value={recordForm.cost}
                    onChange={(e) => setRecordForm({...recordForm, cost: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label>Hours Spent *</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0"
                    value={recordForm.hoursSpent}
                    onChange={(e) => setRecordForm({...recordForm, hoursSpent: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Parts Replaced (comma-separated)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Bearings, Seals, Oil Filter"
                  value={recordForm.partsReplaced}
                  onChange={(e) => setRecordForm({...recordForm, partsReplaced: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Performed By *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="اسم الفني أو الفريق"
                  value={recordForm.performedBy}
                  onChange={(e) => setRecordForm({...recordForm, performedBy: e.target.value})}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRecordModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-success" onClick={handleRecordMaintenance}>{t('assets.recordMaintenance')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance History Modal */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('assets.maintenanceHistory')} - {selectedMachine?.name}</h2>
              <button className="modal-close" onClick={() => setShowHistoryModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-body">
              {selectedMachine?.maintenanceHistory && selectedMachine.maintenanceHistory.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('common.type')}</th>
                      <th>{t('common.description')}</th>
                      <th>{t('common.cost')}</th>
                      <th>{t('common.hours')}</th>
                      <th>Parts</th>
                      <th>{t('assets.nextDue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMachine.maintenanceHistory.map((record, idx) => (
                      <tr key={idx}>
                        <td>{new Date(record.date).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${getMaintenanceTypeColor(record.type)}`}>
                            {record.type}
                          </span>
                        </td>
                        <td>{record.description}</td>
                        <td>{formatCurrency(record.cost)}</td>
                        <td>{record.hoursSpent}h</td>
                        <td>{record.partsReplaced?.join(', ') || '-'}</td>
                        <td>{record.nextDue ? new Date(record.nextDue).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                  <History className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#9ca3af' }} />
                  <p>{t('assets.noMaintenanceHistory')}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Machine Modal */}
      {showMachineModal && (
        <div className="modal-overlay" onClick={() => { setShowMachineModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingMachine ? t('assets.editMachine') : t('assets.addMachine')}</h2>
              <button className="modal-close" onClick={() => setShowMachineModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>{t('common.code')} *</label><input className="form-input" value={machineForm.code} onChange={e => setMachineForm({...machineForm, code: e.target.value})} placeholder="MCH-010" /></div>
                <div className="form-group"><label>{t('common.name')} *</label><input className="form-input" value={machineForm.name} onChange={e => setMachineForm({...machineForm, name: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('common.type')}</label><input className="form-input" value={machineForm.type} onChange={e => setMachineForm({...machineForm, type: e.target.value})} /></div>
                <div className="form-group"><label>{t('assets.model')}</label><input className="form-input" value={machineForm.model} onChange={e => setMachineForm({...machineForm, model: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('assets.manufacturer')}</label><input className="form-input" value={machineForm.manufacturer} onChange={e => setMachineForm({...machineForm, manufacturer: e.target.value})} /></div>
                <div className="form-group"><label>{t('assets.serialNumber')}</label><input className="form-input" value={machineForm.serialNumber} onChange={e => setMachineForm({...machineForm, serialNumber: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('assets.purchaseDate')}</label><input type="date" className="form-input" value={machineForm.purchaseDate} onChange={e => setMachineForm({...machineForm, purchaseDate: e.target.value})} /></div>
                <div className="form-group"><label>{t('assets.purchaseCost')}</label><input type="number" className="form-input" value={machineForm.purchaseCost} onChange={e => setMachineForm({...machineForm, purchaseCost: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('assets.location')}</label><input className="form-input" value={machineForm.location} onChange={e => setMachineForm({...machineForm, location: e.target.value})} /></div>
                <div className="form-group"><label>{t('common.status')}</label>
                  <select className="form-select" value={machineForm.status} onChange={e => setMachineForm({...machineForm, status: e.target.value})}>
                    <option value="operational">{t('assets.operational')}</option>
                    <option value="maintenance">{t('assets.underMaintenance')}</option>
                    <option value="idle">{t('assets.idle')}</option>
                    <option value="broken">{t('assets.broken')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>{t('common.notes')}</label><textarea className="form-textarea" rows="2" value={machineForm.notes} onChange={e => setMachineForm({...machineForm, notes: e.target.value})} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMachineModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSaveMachine}>{editingMachine ? t('common.save') : t('assets.addMachine')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div className="modal-overlay" onClick={() => { setShowVehicleModal(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingVehicle ? t('assets.editVehicle') : t('assets.addVehicle')}</h2>
              <button className="modal-close" onClick={() => setShowVehicleModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>{t('common.code')} *</label><input className="form-input" value={vehicleForm.code} onChange={e => setVehicleForm({...vehicleForm, code: e.target.value})} placeholder="VEH-001" /></div>
                <div className="form-group"><label>{t('common.name')} *</label><input className="form-input" value={vehicleForm.name} onChange={e => setVehicleForm({...vehicleForm, name: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('common.type')}</label><input className="form-input" value={vehicleForm.type} onChange={e => setVehicleForm({...vehicleForm, type: e.target.value})} /></div>
                <div className="form-group"><label>{t('assets.plateNumber')}</label><input className="form-input" value={vehicleForm.plateNumber} onChange={e => setVehicleForm({...vehicleForm, plateNumber: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('assets.manufacturer')}</label><input className="form-input" value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})} /></div>
                <div className="form-group"><label>{t('assets.model')}</label><input className="form-input" value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>{t('assets.capacityKg')}</label><input type="number" className="form-input" value={vehicleForm.capacityKg} onChange={e => setVehicleForm({...vehicleForm, capacityKg: e.target.value})} /></div>
                <div className="form-group"><label>{t('common.status')}</label>
                  <select className="form-select" value={vehicleForm.status} onChange={e => setVehicleForm({...vehicleForm, status: e.target.value})}>
                    <option value="available">{t('common.available')}</option>
                    <option value="in_use">{t('assets.inUse')}</option>
                    <option value="maintenance">{t('assets.underMaintenance')}</option>
                    <option value="retired">Retired</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label>{t('common.notes')}</label><textarea className="form-textarea" rows="2" value={vehicleForm.notes} onChange={e => setVehicleForm({...vehicleForm, notes: e.target.value})} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowVehicleModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSaveVehicle}>{editingVehicle ? t('common.save') : t('assets.addVehicle')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
