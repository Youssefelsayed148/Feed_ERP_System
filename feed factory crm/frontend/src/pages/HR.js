import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Calendar, DollarSign, TrendingUp, Clock, CheckCircle, 
  XCircle, AlertCircle, MapPin, Phone, Mail, CreditCard, Shield,
  Target, Award, FileText, Download, ChevronRight, X, Save, Eye,
  Building, Briefcase, Wallet, Plane, Thermometer, Coffee, Edit, Trash2,
  Fingerprint, Check, Ban, BriefcaseIcon, UsersIcon, Star, BarChart3, Trophy,
  PieChart, Activity, Zap, TrendingDown, Medal, Crown, ArrowRight, RefreshCw,
  Plus, Info, AlertTriangle, CheckSquare
} from 'lucide-react';
import { hrService, authService, employeeRatingService, payrollService } from '../services/api';
import { formatCurrency } from './Settings';

const HR = () => {
  const [activeTab, setActiveTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [salesStats, setSalesStats] = useState(null);
  const [selectedEmployeeRatings, setSelectedEmployeeRatings] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [performanceView, setPerformanceView] = useState('ratings'); // 'ratings', 'leaderboard', 'stats'
  const [selectedPeriod, setSelectedPeriod] = useState('2025-Q1');
  const [ratingForm, setRatingForm] = useState({
    period: '2025-Q1',
    periodType: 'quarterly',
    salesMetrics: {
      ordersCreated: 0,
      ordersApproved: 0,
      totalSalesValue: 0,
      targetAchievement: 0,
      newClientsAcquired: 0,
      clientRetentionRate: 0,
      collectionEfficiency: 0
    },
    generalMetrics: {
      attendanceRate: 0,
      punctualityScore: 3,
      taskCompletionRate: 0,
      qualityScore: 3,
      teamworkScore: 3,
      initiativeScore: 3
    },
    managerRating: {
      overallRating: 3,
      comments: ''
    },
    selfRating: {
      overallRating: 3,
      comments: '',
      goals: []
    },
    targets: { leads: 0, sales: 0, revenue: 0 },
    achievements: { leads: 0, sales: 0, revenue: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState({
    employees: false,
    attendance: false,
    leaves: false,
    payroll: false,
    performance: false
  });
  const [showModal, setShowModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [departmentFilter, setDepartmentFilter] = useState('');
  
  const [newEmployee, setNewEmployee] = useState({
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
    address: '', city: '', country: '', nationality: '',
    department: '', designation: '', joinDate: '', salary: '',
    bankName: '', bankAccount: '', iban: '',
    emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
    leaveBalance: { annual: 21, sick: 10, unpaid: 0 }
  });

  const [newLeave, setNewLeave] = useState({
    employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: ''
  });
  
  const [newDoc, setNewDoc] = useState({
    name: '', type: 'other', fileName: '', fileUrl: '', expiryDate: '', notes: ''
  });

  // Payroll Management State
  const [payrollPeriods, setPayrollPeriods] = useState([]);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showPostToFinanceModal, setShowPostToFinanceModal] = useState(false);
  const [showPayrollDetailModal, setShowPayrollDetailModal] = useState(false);
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [newPayroll, setNewPayroll] = useState({
    month: new Date().toISOString().slice(0, 7),
    year: new Date().getFullYear(),
    notes: ''
  });

  const user = authService.getCurrentUser();

  // Normalize employee data from new API to match component expectations
  const normalizeEmployee = (emp) => {
    if (!emp) return emp;
    const nameParts = (emp.name || '').split(' ');
    return {
      ...emp,
      id: emp.id,
      _id: emp.id,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      designation: emp.position || emp.title || '',
      email: emp.email || emp.user_email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      status: emp.status || 'active',
      salary: emp.salary || '',
      joinDate: emp.joinDate || '',
      leaveBalance: emp.leaveBalance || { annual: 21, sick: 10, unpaid: 0 },
      avatar: emp.avatar || '',
      bankName: emp.bankName || '',
      bankAccount: emp.bankAccount || '',
      iban: emp.iban || '',
    };
  };

  const canManageEmployees = ['owner', 'admin'].includes(user?.role);
  const canApproveLeave = ['owner', 'admin', 'sales_director', 'branch_manager'].includes(user?.role);
  const canViewPerformance = ['owner', 'admin', 'sales_director', 'branch_manager'].includes(user?.role);
  const canProcessPayroll = ['owner', 'admin'].includes(user?.role);
  const canCheckIn = true;

  // Initial data load
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload data when tab changes
  useEffect(() => {
    if (!dataLoaded[activeTab]) {
      fetchDataForTab(activeTab);
    }
  }, [activeTab, selectedMonth, departmentFilter]);

  // Fetch employee documents when employee is selected
  useEffect(() => {
    if (selectedEmployee?.id) {
      fetchEmployeeDocuments(selectedEmployee.id);
    }
  }, [selectedEmployee?.id]);

  const fetchEmployeeDocuments = async (employeeId) => {
    try {
      const result = await hrService.getDocuments(employeeId);
      setSelectedEmployeeDocs(result.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setSelectedEmployeeDocs(selectedEmployee?.documents || []);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selectedEmployee?.id) return;

    try {
      let result;
      if (newDoc._uploadFile) {
        result = await hrService.uploadDocumentFile(selectedEmployee.id, newDoc._uploadFile, newDoc);
      } else {
        result = await hrService.uploadDocument(selectedEmployee.id, newDoc);
      }
      if (result.success) {
        setSelectedEmployeeDocs([...selectedEmployeeDocs, result.document]);
        setNewDoc({ name: '', type: 'other', fileName: '', fileUrl: '', expiryDate: '', notes: '' });
        setShowDocModal(false);
        alert('Document uploaded successfully');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Error uploading document');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await hrService.deleteDocument(selectedEmployee.id, docId);
      setSelectedEmployeeDocs(selectedEmployeeDocs.filter(d => d._id !== docId));
      alert('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleVerifyDocument = async (docId, status) => {
    try {
      await hrService.verifyDocument(selectedEmployee.id, docId, status, '');
      fetchEmployeeDocuments(selectedEmployee.id);
      alert(`Document ${status}`);
    } catch (error) {
      console.error('Error verifying document:', error);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load employees first (needed for other tabs)
      const empResult = await hrService.getAllEmployees();
      const empData = empResult?.employees || [];
      const emps = Array.isArray(empData) ? empData.map(normalizeEmployee) : [];
      setEmployees(departmentFilter ? emps.filter(e => e.department === departmentFilter) : emps);
      setDataLoaded(prev => ({ ...prev, employees: true }));

      // Load other data in parallel
      await Promise.all([
        fetchAttendance(),
        fetchLeaves(),
        fetchPayroll(),
        fetchPerformance()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      // Set empty data on error
      setEmployees([]);
      setAttendance([]);
      setLeaves([]);
      setPayroll([]);
      setPerformance([]);
      setDataLoaded({
        employees: true,
        attendance: true,
        leaves: true,
        payroll: true,
        performance: true
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDataForTab = async (tab) => {
    setLoading(true);
    try {
      switch(tab) {
        case 'employees':
          await fetchEmployees();
          break;
        case 'attendance':
          await fetchAttendance();
          break;
        case 'leaves':
          await fetchLeaves();
          break;
        case 'payroll':
          await fetchPayroll();
          await fetchPayrollPeriods();
          break;
        case 'performance':
          await fetchPerformance();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${tab} data:`, error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const result = await hrService.getAllEmployees();
      const empData = result?.employees || [];
      const emps = Array.isArray(empData) ? empData.map(normalizeEmployee) : [];
      setEmployees(departmentFilter ? emps.filter(e => e.department === departmentFilter) : emps);
      setDataLoaded(prev => ({ ...prev, employees: true }));
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
      setDataLoaded(prev => ({ ...prev, employees: true }));
    }
  };

  const fetchAttendance = async () => {
    try {
      const result = await hrService.getAttendance({ month: selectedMonth });
      const attData = result?.attendance || [];
      setAttendance(Array.isArray(attData) ? attData : []);
      setDataLoaded(prev => ({ ...prev, attendance: true }));
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
      setDataLoaded(prev => ({ ...prev, attendance: true }));
    }
  };

  const fetchLeaves = async () => {
    try {
      const result = await hrService.getLeaves({ status: 'pending' });
      const leaveData = result?.leaves || [];
      setLeaves(Array.isArray(leaveData) ? leaveData : []);
      setDataLoaded(prev => ({ ...prev, leaves: true }));
    } catch (error) {
      console.error('Error fetching leaves:', error);
      setLeaves([]);
      setDataLoaded(prev => ({ ...prev, leaves: true }));
    }
  };

  const fetchPayroll = async () => {
    try {
      const result = await hrService.getPayroll({ month: selectedMonth });
      const payrollData = result?.payroll || [];
      setPayroll(Array.isArray(payrollData) ? payrollData : []);
      setDataLoaded(prev => ({ ...prev, payroll: true }));
    } catch (error) {
      console.error('Error fetching payroll:', error);
      setPayroll([]);
      setDataLoaded(prev => ({ ...prev, payroll: true }));
    }
  };

  const fetchPerformance = async () => {
    try {
      const result = await hrService.getPerformance();
      const perfData = result?.performance || [];
      setPerformance(Array.isArray(perfData) ? perfData : []);
      setDataLoaded(prev => ({ ...prev, performance: true }));
    } catch (error) {
      console.error('Error fetching performance:', error);
      setPerformance([]);
      setDataLoaded(prev => ({ ...prev, performance: true }));
    }
  };

  const departments = ['Management', 'Production', 'Transport', 'Finance', 'Sales', 'Legal', 'Maintenance', 'Services', 'Warehouse'];
  const designations = ['Branch Manager', 'Sales Director', 'Team Lead', 'Senior Agent', 'Agent', 'Marketing Manager', 'Admin Officer', 'Finance Manager', 'Developer', 'HR Manager'];

  const getDepartmentStats = () => {
    const stats = {};
    const currentEmployees = employees;
    departments.forEach(dept => {
      const deptEmployees = currentEmployees.filter(e => e.department === dept);
      stats[dept] = {
        count: deptEmployees.length,
        active: deptEmployees.filter(e => e.status === 'active').length,
        totalSalary: deptEmployees.reduce((sum, e) => sum + parseFloat(e.salary || 0), 0)
      };
    });
    return stats;
  };

  const departmentStats = getDepartmentStats();

  const handleCheckIn = async () => {
    try {
      const result = await hrService.checkIn({ checkIn: new Date().toISOString() });
      alert('Check-in recorded successfully!');
      fetchAttendance();
    } catch (error) {
      console.error('Error checking in:', error);
      alert('Error recording check-in. Please try again.');
    }
  };

  const handleCheckOut = async () => {
    try {
      const todayAttendance = attendance.find(a => a.employeeId === user?._id);
      if (todayAttendance) {
        await hrService.checkOut({ checkOut: new Date().toISOString(), attendanceId: todayAttendance._id });
        alert('Check-out recorded successfully!');
        fetchAttendance();
      }
    } catch (error) {
      console.error('Error checking out:', error);
      alert('Error recording check-out. Please try again.');
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await hrService.createEmployee(newEmployee);
      setShowEmployeeModal(false);
      setNewEmployee({
        firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
        address: '', city: '', country: '', nationality: '',
        department: '', designation: '', joinDate: '', salary: '',
        bankName: '', bankAccount: '', iban: '',
        emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
        leaveBalance: { annual: 21, sick: 10, unpaid: 0 }
      });
      fetchEmployees();
    } catch (error) {
      console.error('Error adding employee:', error);
      alert('Error adding employee. Please try again.');
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await hrService.applyLeave(newLeave);
      setShowLeaveModal(false);
      setNewLeave({ employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (error) {
      console.error('Error applying leave:', error);
      alert('Error applying leave. Please try again.');
    }
  };

  const handleApproveLeave = async (leaveId) => {
    try {
      await hrService.approveLeave(leaveId);
      setLeaves(leaves.map(l => l._id === leaveId ? { ...l, status: 'approved' } : l));
    } catch (error) {
      setLeaves(leaves.map(l => l._id === leaveId ? { ...l, status: 'approved' } : l));
    }
  };

  const handleRejectLeave = async (leaveId) => {
    try {
      await hrService.rejectLeave(leaveId);
      setLeaves(leaves.map(l => l._id === leaveId ? { ...l, status: 'rejected' } : l));
    } catch (error) {
      setLeaves(leaves.map(l => l._id === leaveId ? { ...l, status: 'rejected' } : l));
    }
  };

  const handleExportPayroll = () => {
    const csv = [
      [t('hr.employee'), t('payroll.baseSalary'), t('payroll.allowances'), t('payroll.deductions'), t('payroll.netSalary'), t('common.status')].join(','),
      ...payroll.map(p => [
        `${p.employee?.firstName} ${p.employee?.lastName}`,
        p.basicSalary,
        p.allowances,
        p.deductions,
        p.netSalary,
        p.status
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${selectedMonth}.csv`;
    a.click();
  };

  const handleViewSalarySlip = (payrollRecord) => {
    alert(`Salary Slip for ${payrollRecord.employee?.firstName} ${payrollRecord.employee?.lastName}\n\nBasic Salary: ${formatCurrency(payrollRecord.basicSalary)}\nAllowances: ${formatCurrency(payrollRecord.allowances)}\nDeductions: ${formatCurrency(payrollRecord.deductions)}\nNet Salary: ${formatCurrency(payrollRecord.netSalary)}\n\nMonth: ${payrollRecord.month}`);
  };

  // Enhanced Payroll Functions
  const fetchPayrollPeriods = async () => {
    try {
      const result = await payrollService.getPayrolls();
      if (result.payrolls?.length > 0) {
        setPayrollPeriods(result.payrolls);
      } else {
        setPayrollPeriods([]);
      }
    } catch (error) {
      console.error('Error fetching payroll periods:', error);
      setPayrollPeriods([]);
    }
  };

  const handleCreatePayroll = async (e) => {
    e.preventDefault();
    try {
      setPayrollLoading(true);
      const result = await payrollService.createPayroll(newPayroll);
      if (result.success) {
        alert(`Payroll created successfully for ${newPayroll.month}`);
        setShowPayrollModal(false);
        fetchPayrollPeriods();
        setNewPayroll({
          month: new Date().toISOString().slice(0, 7),
          year: new Date().getFullYear(),
          notes: ''
        });
      } else {
        alert(result.error || 'Failed to create payroll');
      }
    } catch (error) {
      console.error('Error creating payroll:', error);
      alert('Error creating payroll');
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleProcessPayrollPeriod = async (payrollId) => {
    try {
      setPayrollLoading(true);
      const result = await payrollService.processPayroll(payrollId);
      if (result.success) {
        alert('Payroll processed successfully!');
        fetchPayrollPeriods();
        if (selectedPayroll?._id === payrollId) {
          setSelectedPayroll(result.payroll);
        }
      } else {
        alert(result.error || 'Failed to process payroll');
      }
    } catch (error) {
      console.error('Error processing payroll:', error);
      alert('Error processing payroll. Please try again.');
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleOpenPostToFinanceModal = async (payroll) => {
    try {
      setSelectedPayroll(payroll);
      const result = await payrollService.getSummary(payroll._id);
      if (result.success) {
        setPayrollSummary(result.summary);
      } else {
        setPayrollSummary({
          period: payroll.month,
          totalEmployees: payroll.employeePayrolls?.length || 0,
          totals: {
            netSalary: payroll.totalNetSalary || 0
          },
          canPostToFinance: payroll.status === 'processed',
          alreadyPosted: payroll.postedToFinance
        });
      }
      setShowPostToFinanceModal(true);
    } catch (error) {
      console.error('Error fetching payroll summary:', error);
      setPayrollSummary({
        period: payroll.month,
        totalEmployees: payroll.employeePayrolls?.length || 0,
        totals: { netSalary: payroll.totalNetSalary || 0 },
        canPostToFinance: payroll.status === 'processed',
        alreadyPosted: payroll.postedToFinance
      });
      setShowPostToFinanceModal(true);
    }
  };

  const handlePostToFinance = async () => {
    if (!selectedPayroll) return;
    
    try {
      setPayrollLoading(true);
      const result = await payrollService.postToFinance(selectedPayroll._id);
      if (result.success) {
        alert('Payroll posted to finance successfully!\n\nExpense and Payable records created.');
        setShowPostToFinanceModal(false);
        fetchPayrollPeriods();
        setSelectedPayroll(result.payroll);
      } else {
        alert(result.error || 'Failed to post to finance');
      }
    } catch (error) {
      console.error('Error posting to finance:', error);
      alert('Error posting to finance. Please try again.');
    } finally {
      setPayrollLoading(false);
    }
  };

  const handleViewPayrollDetail = async (payroll) => {
    try {
      setSelectedPayroll(payroll);
      const result = await payrollService.getPayroll(payroll._id);
      if (result.success) {
        setSelectedPayroll(result.payroll);
      }
      setShowPayrollDetailModal(true);
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      setShowPayrollDetailModal(true);
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      draft: 'badge-warning',
      processed: 'badge-info',
      posted: 'badge-success',
      paid: 'badge-success'
    };
    return classes[status] || 'badge-secondary';
  };

  const getStatusIcon = (status) => {
    const icons = {
      draft: <Clock size={14} />,
      processed: <CheckCircle size={14} />,
      posted: <CheckSquare size={14} />,
      paid: <Check size={14} />
    };
    return icons[status] || <Clock size={14} />;
  };

  const getStatusColor = (status) => {
    const colors = {
      present: '#22c55e', absent: '#ef4444', late: '#f59e0b',
      approved: '#22c55e', pending: '#f59e0b', rejected: '#ef4444',
      active: '#22c55e', inactive: '#6b7280', 
      draft: '#f59e0b', processed: '#3b82f6', posted: '#22c55e', paid: '#16a34a'
    };
    return colors[status] || '#6b7280';
  };

  const getLeaveTypeIcon = (type) => {
    const icons = { annual: <Plane size={16} />, sick: <Thermometer size={16} />, unpaid: <Coffee size={16} /> };
    return icons[type] || <Calendar size={16} />;
  };

  const getDepartmentLabel = (dept) => {
    const labels = {
      Management: 'الإدارة',
      Production: 'الإنتاج',
      Transport: 'النقل',
      Finance: 'المالية',
      Sales: 'المبيعات',
      Legal: 'الشؤون القانونية',
      Maintenance: 'الصيانة',
      Services: 'الخدمات',
      Warehouse: 'المخازن'
    };
    return labels[dept] || dept || '-';
  };

  const tabs = [
    { id: 'employees', label: t('hr.employees'), icon: <Users size={18} /> },
    { id: 'attendance', label: t('hr.attendance'), icon: <Clock size={18} /> },
    { id: 'leaves', label: t('common.leaves'), icon: <Calendar size={18} /> },
    { id: 'payroll', label: t('nav.payroll'), icon: <DollarSign size={18} /> },
    { id: 'performance', label: t('common.performance'), icon: <TrendingUp size={18} /> },
  ];

  const renderEmployees = () => {
    const displayEmployees = employees;
    const displayLeaves = leaves;
    
    return (
      <div className="tab-content">
        <div className="page-header">
          <div>
            <h2>{t('hr.employeeManagement')}</h2>
            <p className="page-subtitle">{t('hr.teamSubtitle')}</p>
          </div>
          <div className="header-actions">
            <select 
              className="form-select header-select" 
              value={departmentFilter} 
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">{t('common.all')} {t('hr.departments')}</option>
              {departments.map(d => <option key={d} value={d}>{getDepartmentLabel(d)}</option>)}
            </select>
            {canManageEmployees && (
              <button className="btn btn-primary" onClick={() => setShowEmployeeModal(true)}>
                <UserPlus size={18} /> {t('hr.addEmployee')}
              </button>
            )}
          </div>
        </div>

        {/* Department Stats Cards */}
        <div className="dept-grid">
          {departments.map(dept => {
            const stats = departmentStats[dept] || { count: 0, active: 0, totalSalary: 0 };
            const deptStyles = {
              'management': { bg: 'bg-blue', color: 'text-blue', icon: Shield },
              'finance': { bg: 'bg-green', color: 'text-green', icon: Wallet },
              'sales': { bg: 'bg-pink', color: 'text-pink', icon: UsersIcon },
              'production': { bg: 'bg-amber', color: 'text-amber', icon: Zap },
              'logistics': { bg: 'bg-orange', color: 'text-orange', icon: MapPin },
              'operations': { bg: 'bg-purple', color: 'text-purple', icon: Activity },
              'legal': { bg: 'bg-red', color: 'text-red', icon: Shield },
              'maintenance': { bg: 'bg-gray', color: 'text-gray', icon: RefreshCw },
              'inventory': { bg: 'bg-orange', color: 'text-orange', icon: Briefcase },
              'it': { bg: 'bg-purple', color: 'text-purple', icon: BriefcaseIcon }
            };
            const style = deptStyles[dept] || { bg: 'bg-gray', color: 'text-gray', icon: Building };
            const IconComponent = style.icon;
            const isActive = departmentFilter === dept;
            
            return (
              <div 
                key={dept} 
                onClick={() => setDepartmentFilter(isActive ? '' : dept)}
                className={`dept-card ${isActive ? 'dept-card-active' : ''}`}
                data-dept={dept.toLowerCase()}
              >
                <div className="dept-header">
                  <div className={`dept-icon ${style.bg} ${style.color}`}>
                    <IconComponent size={20} />
                  </div>
                  <div className="dept-info">
                    <div className="dept-name">{getDepartmentLabel(dept)}</div>
                    <div className="dept-count">{stats.count} موظف</div>
                  </div>
                </div>
                <div className="dept-stats">
                  <span>{stats.active} {t('hr.active')}</span>
                  <span>{formatCurrency(stats.totalSalary)}{t('hr.perMonth')}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-blue text-blue">
              <Users size={24} />
            </div>
            <div className="stat-value">{displayEmployees.length}</div>
            <div className="stat-label">{t('dashboard.activeEmployees')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-value">{displayEmployees.filter(e => e.status === 'active').length}</div>
            <div className="stat-label">{t('dashboard.activeEmployees')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-orange text-orange">
              <Building size={24} />
            </div>
            <div className="stat-value">{new Set(displayEmployees.map(e => e.department)).size}</div>
            <div className="stat-label">{t('hr.departments')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-purple text-purple">
              <Calendar size={24} />
            </div>
            <div className="stat-value">{displayLeaves.filter(l => l.status === 'pending').length}</div>
            <div className="stat-label">{t('hr.pendingLeaves')}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">{t('hr.employeeDirectory')}</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('hr.employee')}</th>
                  <th>{t('hr.department')}</th>
                  <th>{t('hr.designation')}</th>
                  <th>{t('common.contact')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {displayEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-md">
                          {emp.avatar || (emp.firstName?.[0] || '') + (emp.lastName?.[0] || '')}
                        </div>
                        <div className="employee-info">
                          <div className="employee-name">{emp.firstName} {emp.lastName}</div>
                          <div className="employee-id">ID: {emp.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="dept-badge">
                        {getDepartmentLabel(emp.department)}
                      </span>
                    </td>
                    <td>{emp.designation}</td>
                    <td>
                      <div className="contact-info">
                        <div className="contact-row">
                          <Mail size={12} /> {emp.email}
                        </div>
                        <div className="contact-row">
                          <Phone size={12} /> {emp.phone}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${emp.status === 'active' ? 'success' : emp.status === 'inactive' ? 'danger' : 'warning'}`}>
                        {t('common.statuses.' + emp.status) || emp.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedEmployee(emp)}>
                        <Eye size={16} /> {t('common.view')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendance = () => {
    const today = new Date().toISOString().slice(0, 10);
    const displayAttendance = attendance;
    const todayAttendance = displayAttendance.filter(a => a.date === today);
    const myAttendance = todayAttendance.find(a => a.employeeId === user?._id);
    const displayEmployees = employees;

    return (
      <div className="tab-content">
        <div className="page-header">
          <div>
            <h2>{t('hr.attendanceManagement')}</h2>
            <p className="page-subtitle">تتبع حضور وانصراف الموظفين</p>
          </div>
          <div className="header-actions">
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-input month-input"
            />
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-value">{todayAttendance.filter(a => a.status === 'present').length}</div>
            <div className="stat-label">الحضور اليوم</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-orange text-orange">
              <Clock size={24} />
            </div>
            <div className="stat-value">{todayAttendance.filter(a => a.status === 'late').length}</div>
            <div className="stat-label">متأخري الحضور</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-red text-red">
              <XCircle size={24} />
            </div>
            <div className="stat-value">{todayAttendance.filter(a => a.status === 'absent').length}</div>
            <div className="stat-label">{t('hr.absent')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-purple text-purple">
              <Clock size={24} />
            </div>
            <div className="stat-value">{displayEmployees.length}</div>
            <div className="stat-label">{t('dashboard.activeEmployees')}</div>
          </div>
        </div>

        {canCheckIn && (
          <div className={`card attendance-card ${myAttendance ? 'attendance-checked-in' : 'attendance-pending'}`}>
            <div className="attendance-status">
              <div>
                <h3>{t('hr.todaysAttendance')}</h3>
                <p className="attendance-message">
                  {myAttendance 
                    ? `Checked in at ${myAttendance.checkIn} - ${myAttendance.checkOut ? `Checked out at ${myAttendance.checkOut}` : 'Not checked out yet'}`
                    : 'You have not checked in yet'
                  }
                </p>
              </div>
              <div className="attendance-actions">
                {!myAttendance && (
                  <button className="btn btn-primary" onClick={handleCheckIn}>
                    <Fingerprint size={18} /> Check In
                  </button>
                )}
                {myAttendance && !myAttendance.checkOut && (
                  <button className="btn btn-secondary" onClick={handleCheckOut}>
                    <Fingerprint size={18} /> Check Out
                  </button>
                )}
                {myAttendance && myAttendance.checkOut && (
                  <span className="badge badge-success attendance-complete">
                    <CheckCircle size={18} /> Completed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Daily Attendance - {today}</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('hr.employee')}</th>
                  <th>{t('hr.checkIn')}</th>
                  <th>{t('hr.checkOut')}</th>
                  <th>ساعات العمل</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance.map(att => (
                  <tr key={att._id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-sm">
                          {att.employee?.avatar || att.employee?.firstName?.[0] || ''}
                        </div>
                        <span className="employee-name">{att.employee?.firstName} {att.employee?.lastName}</span>
                      </div>
                    </td>
                    <td>{att.checkIn || '-'}</td>
                    <td>{att.checkOut || '-'}</td>
                    <td>{att.workingHours || 0} hrs</td>
                    <td>
                      <span className={`badge badge-${att.status === 'present' ? 'success' : att.status === 'absent' ? 'danger' : 'warning'}`}>
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderLeaves = () => {
    const displayLeaves = leaves;
    const displayEmployees = employees;
    
    return (
      <div className="tab-content">
        <div className="page-header">
          <div>
            <h2>إدارة الإجازات</h2>
            <p className="page-subtitle">إدارة طلبات الإجازات والأرصدة</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowLeaveModal(true)}>
            <Calendar size={18} /> Request Leave
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-orange text-orange">
              <Clock size={24} />
            </div>
            <div className="stat-value">{displayLeaves.filter(l => l.status === 'pending').length}</div>
            <div className="stat-label">الطلبات المعلقة</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <CheckCircle size={24} />
            </div>
            <div className="stat-value">{displayLeaves.filter(l => l.status === 'approved').length}</div>
            <div className="stat-label">{t('common.statuses.approved')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-red text-red">
              <XCircle size={24} />
            </div>
            <div className="stat-value">{displayLeaves.filter(l => l.status === 'rejected').length}</div>
            <div className="stat-label">{t('common.statuses.cancelled')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-purple text-purple">
              <Plane size={24} />
            </div>
            <div className="stat-value">{displayEmployees.reduce((sum, e) => sum + (e.leaveBalance?.annual || 0), 0)}</div>
            <div className="stat-label">إجمالي الإجازات السنوية</div>
          </div>
        </div>

        {canApproveLeave && displayLeaves.filter(l => l.status === 'pending').length > 0 && (
          <div className="card pending-leaves-card">
            <div className="card-header">
              <h3 className="card-title">طلبات إجازة معلقة</h3>
            </div>
            <div className="pending-leaves-list">
              {displayLeaves.filter(l => l.status === 'pending').map(leave => (
                <div key={leave._id} className="pending-leave-item">
                  <div className="leave-info">
                    <div className="leave-icon">
                      {getLeaveTypeIcon(leave.leaveType)}
                    </div>
                    <div className="leave-details">
                      <div className="leave-employee">{leave.employee?.firstName} {leave.employee?.lastName}</div>
                      <div className="leave-dates">
                        {leave.startDate} to {leave.endDate} ({leave.leaveType} leave)
                      </div>
                      <div className="leave-reason">Reason: {leave.reason}</div>
                    </div>
                  </div>
                  <div className="leave-actions">
                    <button className="btn btn-sm btn-primary" onClick={() => handleApproveLeave(leave._id)}>
                      <Check size={16} /> Approve
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRejectLeave(leave._id)}>
                      <Ban size={16} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">سجل الإجازات</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('hr.employee')}</th>
                  <th>نوع الإجازة</th>
                  <th>{t('common.startDate')}</th>
                  <th>{t('common.endDate')}</th>
                  <th>السبب</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {displayLeaves.map(leave => (
                  <tr key={leave._id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-sm">
                          {leave.employee?.firstName?.[0]}{leave.employee?.lastName?.[0]}
                        </div>
                        <span className="employee-name">{leave.employee?.firstName} {leave.employee?.lastName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="leave-type">
                        {getLeaveTypeIcon(leave.leaveType)} {leave.leaveType}
                      </div>
                    </td>
                    <td>{leave.startDate}</td>
                    <td>{leave.endDate}</td>
                    <td className="text-truncate" style={{ maxWidth: '200px' }}>{leave.reason}</td>
                    <td>
                      <span className={`badge badge-${leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {leave.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderPayroll = () => {
    const displayPayrollPeriods = payrollPeriods;

    // Calculate statistics
    const totalDraft = displayPayrollPeriods.filter(p => p.status === 'draft').length;
    const totalProcessed = displayPayrollPeriods.filter(p => p.status === 'processed').length;
    const totalPosted = displayPayrollPeriods.filter(p => p.status === 'posted').length;
    const totalPaid = displayPayrollPeriods.filter(p => p.status === 'paid').length;
    
    return (
      <div className="tab-content">
        <div className="page-header">
          <div>
            <h2>إدارة الرواتب</h2>
            <p className="page-subtitle">معالجة فترات الرواتب وترحيلها للمالية</p>
          </div>
          <div className="header-actions">
            {canProcessPayroll && (
              <button className="btn btn-primary" onClick={() => setShowPayrollModal(true)}>
                <Plus size={18} /> Create Payroll
              </button>
            )}
          </div>
        </div>

        {/* Status Workflow */}
        <div className="card workflow-card" style={{ marginBottom: '20px' }}>
          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="step-icon"><Clock size={18} /></div>
              <div className="step-label">{t('common.statuses.draft')}</div>
              <div className="step-count">{totalDraft}</div>
            </div>
            <div className="workflow-arrow"><ArrowRight size={16} /></div>
            <div className="workflow-step">
              <div className="step-icon"><RefreshCw size={18} /></div>
              <div className="step-label">تمت المعالجة</div>
              <div className="step-count">{totalProcessed}</div>
            </div>
            <div className="workflow-arrow"><ArrowRight size={16} /></div>
            <div className="workflow-step">
              <div className="step-icon"><CheckCircle size={18} /></div>
              <div className="step-label">مرحل</div>
              <div className="step-count">{totalPosted}</div>
            </div>
            <div className="workflow-arrow"><ArrowRight size={16} /></div>
            <div className="workflow-step">
              <div className="step-icon"><Check size={18} /></div>
              <div className="step-label">{t('common.statuses.paid')}</div>
              <div className="step-count">{totalPaid}</div>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon bg-green text-green">
              <Wallet size={24} />
            </div>
            <div className="stat-value">
              {formatCurrency(displayPayrollPeriods.reduce((sum, p) => sum + (p.totalNetSalary || 0), 0))}
            </div>
            <div className="stat-label">إجمالي قيمة الرواتب</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-blue text-blue">
              <FileText size={24} />
            </div>
            <div className="stat-value">{displayPayrollPeriods.length}</div>
            <div className="stat-label">فترات الرواتب</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-purple text-purple">
              <Users size={24} />
            </div>
            <div className="stat-value">
              {displayPayrollPeriods.reduce((sum, p) => sum + (p.employeePayrolls?.length || 0), 0)}
            </div>
            <div className="stat-label">{t('dashboard.activeEmployees')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon bg-orange text-orange">
              <CheckCircle size={24} />
            </div>
            <div className="stat-value">{totalProcessed}</div>
            <div className="stat-label">جاهز للترحيل</div>
          </div>
        </div>

        {/* Payroll Periods List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">فترات الرواتب</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th>{t('dashboard.activeEmployees')}</th>
                  <th>صافي الراتب الإجمالي</th>
                  <th>{t('common.status')}</th>
                  <th>الحالة المالية</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {displayPayrollPeriods.map(p => (
                  <tr key={p._id}>
                    <td>
                      <div className="employee-cell">
                        <div className="avatar avatar-sm bg-purple text-purple">
                          <Calendar size={14} />
                        </div>
                        <div className="employee-info">
                          <div className="employee-name">{p.month}</div>
                          <div className="employee-id">{p.year}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.employeePayrolls?.length || 0} موظف</td>
                    <td className="net-salary">{formatCurrency(p.totalNetSalary || 0)}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(p.status)}`}>
                        {getStatusIcon(p.status)} {p.status}
                      </span>
                    </td>
                    <td>
                      {p.postedToFinance ? (
                        <span className="badge badge-success">
                          <Check size={12} /> Posted
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          <Clock size={12} /> Not Posted
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={() => handleViewPayrollDetail(p)}
                        >
                          <Eye size={14} /> {t('common.view')}
                        </button>
                        {p.status === 'draft' && canProcessPayroll && (
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handleProcessPayrollPeriod(p._id)}
                            disabled={payrollLoading}
                          >
                            <RefreshCw size={14} /> Process
                          </button>
                        )}
                        {p.status === 'processed' && canProcessPayroll && !p.postedToFinance && (
                          <button 
                            className="btn btn-sm btn-success" 
                            onClick={() => handleOpenPostToFinanceModal(p)}
                            disabled={payrollLoading}
                          >
                            <DollarSign size={14} /> Post to Finance
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

        {/* Create Payroll Modal */}
        {showPayrollModal && (
          <div className="modal-overlay" onClick={() => setShowPayrollModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Create New Payroll Period</h3>
                <button className="modal-close" onClick={() => setShowPayrollModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleCreatePayroll}>
                  <div className="form-group">
                    <label>Month</label>
                    <input
                      type="month"
                      className="form-input"
                      value={newPayroll.month}
                      onChange={(e) => setNewPayroll({ ...newPayroll, month: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Year</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newPayroll.year}
                      onChange={(e) => setNewPayroll({ ...newPayroll, year: parseInt(e.target.value) })}
                      required
                    />
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
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPayrollModal(false)}>
                      إلغاء
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={payrollLoading}>
                      {payrollLoading ? 'Creating...' : 'Create Payroll'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Post to Finance Modal */}
        {showPostToFinanceModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowPostToFinanceModal(false)}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><DollarSign size={20} /> Post Payroll to Finance</h3>
                <button className="modal-close" onClick={() => setShowPostToFinanceModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                <div className="post-confirmation">
                  <div className="confirmation-header">
                    <AlertTriangle size={32} className="text-warning" />
                    <h4>Are you sure you want to post this payroll to Finance?</h4>
                  </div>
                  
                  <div className="payroll-summary-box">
                    <div className="summary-row">
                      <span className="label">Month:</span>
                      <span className="value">{selectedPayroll.month}</span>
                    </div>
                    <div className="summary-row">
                      <span className="label">Total Employees:</span>
                      <span className="value">{payrollSummary?.totalEmployees || selectedPayroll.employeePayrolls?.length || 0}</span>
                    </div>
                    <div className="summary-row highlight">
                      <span className="label">Total Net Salary:</span>
                      <span className="value text-success">
                        {formatCurrency(payrollSummary?.totals?.netSalary || selectedPayroll.totalNetSalary || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="actions-preview">
                    <h5>This will create:</h5>
                    <div className="action-item">
                      <CheckCircle size={16} className="text-success" />
                      <span>Expense record in Finance (EXP-SAL-{selectedPayroll.month})</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="text-success" />
                      <span>Payable record (Salary Payable - PAY-SAL-{selectedPayroll.month})</span>
                    </div>
                    <div className="action-item">
                      <CheckCircle size={16} className="text-success" />
                      <span>Due date: {new Date(new Date().setDate(new Date().getDate() + 5)).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setShowPostToFinanceModal(false)}
                      disabled={payrollLoading}
                    >
                      إلغاء
                    </button>
                    <button 
                      className="btn btn-success" 
                      onClick={handlePostToFinance}
                      disabled={payrollLoading || payrollSummary?.alreadyPosted}
                    >
                      {payrollLoading ? 'Posting...' : payrollSummary?.alreadyPosted ? 'Already Posted' : 'Confirm Post to Finance'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payroll Detail Modal */}
        {showPayrollDetailModal && selectedPayroll && (
          <div className="modal-overlay" onClick={() => setShowPayrollDetailModal(false)}>
            <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Payroll Details - {selectedPayroll.month}</h3>
                <button className="modal-close" onClick={() => setShowPayrollDetailModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body">
                {/* Summary Cards */}
                <div className="stats-grid" style={{ marginBottom: '24px' }}>
                  <div className="stat-card">
                    <div className="stat-icon bg-blue text-blue">
                      <DollarSign size={20} />
                    </div>
                    <div className="stat-value">
                      {formatCurrency(selectedPayroll.totalBasicSalary || 
                        selectedPayroll.employeePayrolls?.reduce((sum, ep) => sum + (ep.basicSalary || 0), 0) || 0)}
                    </div>
                    <div className="stat-label">إجمالي الرواتب الأساسية</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-green text-green">
                      <TrendingUp size={20} />
                    </div>
                    <div className="stat-value">
                      {formatCurrency(selectedPayroll.totalAllowances || 
                        selectedPayroll.employeePayrolls?.reduce((sum, ep) => sum + (ep.totalAllowances || 0), 0) || 0)}
                    </div>
                    <div className="stat-label">إجمالي البدلات</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-red text-red">
                      <TrendingDown size={20} />
                    </div>
                    <div className="stat-value">
                      {formatCurrency(selectedPayroll.totalDeductions || 
                        selectedPayroll.employeePayrolls?.reduce((sum, ep) => sum + (ep.totalDeductions || 0), 0) || 0)}
                    </div>
                    <div className="stat-label">إجمالي الخصومات</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon bg-purple text-purple">
                      <Wallet size={20} />
                    </div>
                    <div className="stat-value">
                      {formatCurrency(selectedPayroll.totalNetSalary || 0)}
                    </div>
                    <div className="stat-label">Total Net Salary (EGP)</div>
                  </div>
                </div>

                {/* Bulk Update Panel */}
                <div className="card" style={{ marginBottom: '16px', background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="card-header" style={{ paddingBottom: '8px' }}>
                    <h3 className="card-title" style={{ fontSize: '14px', color: '#92400e' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', verticalAlign: 'middle' }}><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Bulk Update — Apply to All Employees
                    </h3>
                  </div>
                  <div className="card-body" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <select id="bulkField" className="form-select" style={{ width: '140px' }}>
                        <option value="basic_salary">{t('hr.basicSalary')}</option>
                        <option value="additions">{t('payroll.allowances')}</option>
                        <option value="deductions">{t('hr.deductions')}</option>
                      </select>
                      <select id="bulkType" className="form-select" style={{ width: '120px' }}>
                        <option value="fixed">+ Fixed Amount</option>
                        <option value="percentage">+ Percentage %</option>
                      </select>
                      <input type="number" id="bulkValue" className="form-input" placeholder="Value" style={{ width: '100px' }} />
                      <button className="btn btn-sm btn-warning" onClick={async () => {
                        const field = document.getElementById('bulkField').value;
                        const type = document.getElementById('bulkType').value;
                        const val = document.getElementById('bulkValue').value;
                        if (!val || parseFloat(val) <= 0) { alert('Enter a value'); return; }
                        if (!window.confirm(`Apply ${type === 'fixed' ? '+' : '+'}${val}${type === 'percentage' ? '%' : ' EGP'} to ${field} for all employees?`)) return;
                        try {
                          const token = localStorage.getItem('token');
                          const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/payroll/${selectedPayroll._id || selectedPayroll.id}/bulk-update`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ increaseType: type, increaseValue: parseFloat(val), field })
                          });
                          const data = await res.json();
                          if (data.success) {
                            document.getElementById('bulkValue').value = '';
                            const pp = payrollService;
                            const r = await pp.getPayroll(selectedPayroll._id || selectedPayroll.id);
                            if (r.success) setSelectedPayroll(r.payroll);
                          } else {
                            alert(data.error || 'Failed');
                          }
                        } catch(e) { alert('Error: ' + e.message); }
                      }}>{t('common.apply')}</button>
                    </div>
                  </div>
                </div>

                {/* Employee Table */}
                <div className="card">
                  <div className="card-header">
                    <h3 className="card-title">{t('hr.employeePayrolls')}</h3>
                  </div>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t('hr.employee')}</th>
                          <th>{t('hr.department')}</th>
                          <th>Basic</th>
                          <th>{t('payroll.allowances')}</th>
                          <th>{t('hr.deductions')}</th>
                          <th>Net Salary</th>
                          <th>{t('hr.bankAccount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedPayroll.employeePayrolls || []).map((ep, idx) => (
                          <PayrollEmployeeRow
                            key={ep._id || idx}
                            ep={ep}
                            payrollId={selectedPayroll._id || selectedPayroll.id}
                            formatCurrency={formatCurrency}
                            getDepartmentLabel={getDepartmentLabel}
                            onUpdate={() => {
                              const pp = payrollService;
                              pp.getPayroll(selectedPayroll._id || selectedPayroll.id).then(r => {
                                if (r.success) setSelectedPayroll(r.payroll);
                              });
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Finance Integration Status */}
                {selectedPayroll.postedToFinance && (
                  <div className="card" style={{ marginTop: '24px', background: '#f0fdf4' }}>
                    <div className="card-header">
                      <h3 className="card-title text-success">
                        <CheckCircle size={18} /> Posted to Finance
                      </h3>
                    </div>
                    <div className="card-body">
                      <div className="finance-info">
                        <div className="info-row">
                          <span>Expense ID:</span>
                          <span className="font-mono">{selectedPayroll.expenseId || 'EXP-SAL-' + selectedPayroll.month}</span>
                        </div>
                        <div className="info-row">
                          <span>Payable ID:</span>
                          <span className="font-mono">{selectedPayroll.payableId || 'PAY-SAL-' + selectedPayroll.month}</span>
                        </div>
                        <div className="info-row">
                          <span>Posted At:</span>
                          <span>{selectedPayroll.postedAt ? new Date(selectedPayroll.postedAt).toLocaleString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPerformance = () => {
    const displayRatings = ratings;
    const displayLeaderboard = leaderboard;
    const displayStats = salesStats || {
      totalSalesStaff: 0,
      ratedStaff: 0,
      unratedStaff: 0,
      averageScore: 0,
      gradeDistribution: { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0 },
      topPerformer: null,
      needsImprovement: [],
      departmentAverages: {}
    };
    
    // Helper functions
    const getGradeColor = (grade) => {
      switch(grade) {
        case 'A+': return '#22c55e';
        case 'A': return '#16a34a';
        case 'B+': return '#3b82f6';
        case 'B': return '#60a5fa';
        case 'C+': return '#f59e0b';
        case 'C': return '#f97316';
        case 'D': return '#ef4444';
        default: return '#6b7280';
      }
    };
    
    const getGradeBgColor = (grade) => {
      switch(grade) {
        case 'A+': return 'bg-green-100';
        case 'A': return 'bg-green-50';
        case 'B+': return 'bg-blue-100';
        case 'B': return 'bg-blue-50';
        case 'C+': return 'bg-orange-100';
        case 'C': return 'bg-orange-50';
        case 'D': return 'bg-red-100';
        default: return 'bg-gray-100';
      }
    };
    
    const getScoreColor = (score) => {
      if (score >= 90) return '#22c55e';
      if (score >= 80) return '#16a34a';
      if (score >= 70) return '#3b82f6';
      if (score >= 60) return '#60a5fa';
      if (score >= 50) return '#f59e0b';
      if (score >= 40) return '#f97316';
      return '#ef4444';
    };
    
    const getScoreLabel = (score) => {
      if (score >= 90) return 'Excellent';
      if (score >= 80) return 'Very Good';
      if (score >= 70) return 'Good';
      if (score >= 60) return 'Average';
      if (score >= 50) return 'Below Average';
      if (score >= 40) return 'Needs Improvement';
      return 'Poor';
    };
    
    const handleOpenRatingModal = (rating = null) => {
      if (rating) {
        setRatingForm({
          period: rating.period,
          periodType: rating.periodType,
          salesMetrics: rating.salesMetrics || {},
          generalMetrics: rating.generalMetrics || {},
          managerRating: rating.managerRating || { overallRating: 3, comments: '' },
          selfRating: rating.selfRating || { overallRating: 3, comments: '', goals: [] },
          targets: rating.targets || { leads: 0, sales: 0, revenue: 0 },
          achievements: rating.achievements || { leads: 0, sales: 0, revenue: 0 }
        });
        setSelectedEmployeeRatings(rating);
      } else {
        setRatingForm({
          period: selectedPeriod,
          periodType: 'quarterly',
          salesMetrics: {
            ordersCreated: 0, ordersApproved: 0, totalSalesValue: 0,
            targetAchievement: 0, newClientsAcquired: 0,
            clientRetentionRate: 0, collectionEfficiency: 0
          },
          generalMetrics: {
            attendanceRate: 0, punctualityScore: 3, taskCompletionRate: 0,
            qualityScore: 3, teamworkScore: 3, initiativeScore: 3
          },
          managerRating: { overallRating: 3, comments: '' },
          selfRating: { overallRating: 3, comments: '', goals: [] },
          targets: { leads: 0, sales: 0, revenue: 0 },
          achievements: { leads: 0, sales: 0, revenue: 0 }
        });
        setSelectedEmployeeRatings(null);
      }
      setShowRatingModal(true);
    };
    
    const handleSaveRating = async (e) => {
      e.preventDefault();
      try {
        const employeeId = selectedEmployeeRatings?.employee?.id || selectedEmployee?.id;
        if (!employeeId) {
          alert('Please select an employee first');
          return;
        }
        
        if (selectedEmployeeRatings) {
          await employeeRatingService.updateRating(employeeId, selectedEmployeeRatings._id, ratingForm);
        } else {
          await employeeRatingService.createRating(employeeId, ratingForm);
        }
        
        setShowRatingModal(false);
        alert('Rating saved successfully');
        // Refresh data
        const result = await employeeRatingService.getEmployeeRatings(employeeId);
        setRatings(result.ratings || []);
      } catch (error) {
        console.error('Error saving rating:', error);
        alert('Error saving rating');
      }
    };
    
    const renderRatingCards = () => (
      <div className="ratings-grid">
        {displayRatings.map((rating) => (
          <div key={rating._id} className="rating-card">
            <div className="rating-card-header">
              <div className="employee-cell">
                <div className="avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${getGradeColor(rating.grade)}20, ${getGradeColor(rating.grade)}40)` }}>
                  {rating.employee?.avatar || `${rating.employee?.firstName?.[0]}${rating.employee?.lastName?.[0]}`}
                </div>
                <div className="employee-info">
                  <div className="employee-name">{rating.employee?.firstName} {rating.employee?.lastName}</div>
                  <div className="employee-designation">{rating.employee?.designation}</div>
                  <div className="period-badge">{rating.period}</div>
                </div>
              </div>
              <div className="grade-display" style={{ backgroundColor: getGradeColor(rating.grade), color: 'white' }}>
                {rating.grade}
              </div>
            </div>
            
            <div className="score-section">
              <div className="score-circle" style={{ 
                background: `conic-gradient(${getScoreColor(rating.overallScore)} ${rating.overallScore}%, #e5e7eb 0%)`,
                border: `3px solid ${getScoreColor(rating.overallScore)}`
              }}>
                <div className="score-value">{rating.overallScore}</div>
              </div>
              <div className="score-label">{getScoreLabel(rating.overallScore)}</div>
            </div>
            
            {/* Sales Metrics (for sales staff) */}
            {rating.employee?.department === 'sales' && rating.salesMetrics && (
              <div className="metrics-section">
                <h4 className="section-title"><TrendingUp size={16} /> Sales Metrics</h4>
                <div className="metrics-grid">
                  <div className="metric-item">
                    <div className="metric-label-sm">{t('nav.orders')}</div>
                    <div className="metric-value-sm">{rating.salesMetrics.ordersApproved}/{rating.salesMetrics.ordersCreated}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label-sm">Sales Value</div>
                    <div className="metric-value-sm">{formatCurrency(rating.salesMetrics.totalSalesValue)}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label-sm">Target %</div>
                    <div className={`metric-value-sm ${rating.salesMetrics.targetAchievement >= 100 ? 'text-green' : 'text-orange'}`}>
                      {rating.salesMetrics.targetAchievement}%
                    </div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label-sm">New Clients</div>
                    <div className="metric-value-sm">{rating.salesMetrics.newClientsAcquired}</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label-sm">Retention</div>
                    <div className="metric-value-sm">{rating.salesMetrics.clientRetentionRate}%</div>
                  </div>
                  <div className="metric-item">
                    <div className="metric-label-sm">Collection</div>
                    <div className="metric-value-sm">{rating.salesMetrics.collectionEfficiency}%</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* General Metrics */}
            <div className="metrics-section">
              <h4 className="section-title"><Activity size={16} /> General Metrics</h4>
              <div className="metrics-grid">
                <div className="metric-item">
                  <div className="metric-label-sm">{t('hr.attendance')}</div>
                  <div className="metric-value-sm">{rating.generalMetrics?.attendanceRate}%</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label-sm">Tasks Done</div>
                  <div className="metric-value-sm">{rating.generalMetrics?.taskCompletionRate}%</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label-sm">Quality</div>
                  <div className="metric-value-sm">{rating.generalMetrics?.qualityScore}/5</div>
                </div>
                <div className="metric-item">
                  <div className="metric-label-sm">Teamwork</div>
                  <div className="metric-value-sm">{rating.generalMetrics?.teamworkScore}/5</div>
                </div>
              </div>
            </div>
            
            {/* Manager Rating */}
            {rating.managerRating && (
              <div className="manager-rating-section">
                <h4 className="section-title"><Star size={16} /> Manager Assessment</h4>
                <div className="manager-rating-display">
                  <div className="stars-display">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={16} 
                        className={star <= rating.managerRating.overallRating ? 'star-filled' : 'star-empty'}
                        fill={star <= rating.managerRating.overallRating ? '#fbbf24' : 'none'}
                        stroke={star <= rating.managerRating.overallRating ? '#fbbf24' : '#d1d5db'}
                      />
                    ))}
                  </div>
                  <div className="manager-comment">"{rating.managerRating.comments}"</div>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="rating-actions">
              <button className="btn btn-sm btn-outline" onClick={() => handleOpenRatingModal(rating)}>
                <Edit size={14} /> Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    );
    
    const renderLeaderboard = () => (
      <div className="leaderboard-container">
        <div className="leaderboard-header">
          <Trophy size={32} className="trophy-icon" />
          <h3>Sales Team Leaderboard</h3>
          <p>Top performers based on overall score</p>
        </div>
        
        <div className="leaderboard-podium">
          {displayLeaderboard.slice(0, 3).map((entry, index) => {
            const position = index + 1;
            const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
            const rankIcons = [<Crown size={24} />, <Medal size={24} />, <Award size={24} />];
            
            return (
              <div key={entry.employeeId} className={`podium-item podium-${position}`}>
                <div className="podium-rank" style={{ backgroundColor: medalColors[index] }}>
                  {rankIcons[index]}
                </div>
                <div className="podium-avatar avatar-xl" style={{ background: `linear-gradient(135deg, ${getGradeColor(entry.grade)}30, ${getGradeColor(entry.grade)}60)` }}>
                  {entry.avatar}
                </div>
                <div className="podium-name">{entry.firstName} {entry.lastName}</div>
                <div className="podium-score">{entry.overallScore} pts</div>
                <div className="podium-grade" style={{ backgroundColor: getGradeColor(entry.grade), color: 'white' }}>
                  {entry.grade}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>{t('hr.employee')}</th>
                <th>{t('hr.department')}</th>
                <th>Score</th>
                <th>{t('hr.grade')}</th>
              </tr>
            </thead>
            <tbody>
              {displayLeaderboard.map((entry) => (
                <tr key={entry.employeeId}>
                  <td>
                    <div className={`rank-badge ${entry.rank <= 3 ? 'rank-top' : ''}`}>
                      #{entry.rank}
                    </div>
                  </td>
                  <td>
                    <div className="employee-cell">
                      <div className="avatar avatar-sm" style={{ background: `linear-gradient(135deg, ${getGradeColor(entry.grade)}20, ${getGradeColor(entry.grade)}40)` }}>
                        {entry.avatar}
                      </div>
                      <div className="employee-info">
                        <div className="employee-name">{entry.firstName} {entry.lastName}</div>
                        <div className="employee-designation">{entry.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td>{getDepartmentLabel(entry.department)}</td>
                  <td>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: `${entry.overallScore}%`, backgroundColor: getGradeColor(entry.grade) }} />
                      <span>{entry.overallScore}</span>
                    </div>
                  </td>
                  <td>
                    <span className="grade-badge" style={{ backgroundColor: getGradeColor(entry.grade), color: 'white' }}>
                      {entry.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
    
    const renderStats = () => (
      <div className="stats-view">
        <div className="stats-overview">
          <div className="stat-card-large">
            <div className="stat-icon-large bg-blue">
              <Users size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-value-large">{displayStats.totalSalesStaff}</div>
              <div className="stat-label-large">Total Sales Staff</div>
            </div>
          </div>
          <div className="stat-card-large">
            <div className="stat-icon-large bg-green">
              <CheckCircle size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-value-large">{displayStats.ratedStaff}</div>
              <div className="stat-label-large">Rated Staff</div>
            </div>
          </div>
          <div className="stat-card-large">
            <div className="stat-icon-large bg-purple">
              <BarChart3 size={32} />
            </div>
            <div className="stat-info">
              <div className="stat-value-large">{displayStats.averageScore}</div>
              <div className="stat-label-large">{t('hr.averageScore')}</div>
            </div>
          </div>
        </div>
        
        <div className="stats-details-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><PieChart size={18} /> Grade Distribution</h3>
            </div>
            <div className="grade-distribution">
              {Object.entries(displayStats.gradeDistribution).map(([grade, count]) => (
                <div key={grade} className="grade-bar-item">
                  <div className="grade-label" style={{ color: getGradeColor(grade) }}>{grade}</div>
                  <div className="grade-bar-container">
                    <div 
                      className="grade-bar-fill" 
                      style={{ 
                        width: `${(count / displayStats.ratedStaff) * 100}%`,
                        backgroundColor: getGradeColor(grade)
                      }} 
                    />
                  </div>
                  <div className="grade-count">{count}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><Trophy size={18} /> Top Performer</h3>
            </div>
            {displayStats.topPerformer ? (
              <div className="top-performer-card">
                <div className="performer-avatar avatar-lg" style={{ background: `linear-gradient(135deg, ${getGradeColor(displayStats.topPerformer.grade)}30, ${getGradeColor(displayStats.topPerformer.grade)}60)` }}>
                  {displayStats.topPerformer.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="performer-info">
                  <div className="performer-name">{displayStats.topPerformer.name}</div>
                  <div className="performer-dept">{getDepartmentLabel(displayStats.topPerformer.department)}</div>
                  <div className="performer-score">
                    <span className="score-value">{displayStats.topPerformer.score}</span>
                    <span className="grade-badge" style={{ backgroundColor: getGradeColor(displayStats.topPerformer.grade), color: 'white' }}>
                      {displayStats.topPerformer.grade}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="no-data">No top performer data available</div>
            )}
          </div>
        </div>
      </div>
    );
    
    const renderRatingModal = () => (
      <div className="modal-overlay" onClick={() => setShowRatingModal(false)}>
        <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedEmployeeRatings ? 'Edit Rating' : 'New Rating'}</h2>
            <button className="btn btn-icon" onClick={() => setShowRatingModal(false)}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSaveRating} className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>الفترة</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={ratingForm.period}
                  onChange={(e) => setRatingForm({...ratingForm, period: e.target.value})}
                  placeholder="e.g., 2025-Q1"
                />
              </div>
              <div className="form-group">
                <label>Period Type</label>
                <select 
                  className="form-input" 
                  value={ratingForm.periodType}
                  onChange={(e) => setRatingForm({...ratingForm, periodType: e.target.value})}
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">{t('hr.annual')}</option>
                </select>
              </div>
            </div>
            
            {/* Sales Metrics */}
            <div className="form-section">
              <h4><TrendingUp size={18} /> Sales Metrics</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Orders Created</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.ordersCreated}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, ordersCreated: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>Orders Approved</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.ordersApproved}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, ordersApproved: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>Sales Value</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.totalSalesValue}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, totalSalesValue: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Achievement %</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.targetAchievement}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, targetAchievement: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>New Clients</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.newClientsAcquired}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, newClientsAcquired: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>Retention Rate %</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.salesMetrics.clientRetentionRate}
                    onChange={(e) => setRatingForm({...ratingForm, salesMetrics: {...ratingForm.salesMetrics, clientRetentionRate: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
            </div>
            
            {/* General Metrics */}
            <div className="form-section">
              <h4><Activity size={18} /> General Metrics</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Attendance Rate %</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.generalMetrics.attendanceRate}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, attendanceRate: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>Punctuality (1-5)</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    className="form-input" 
                    value={ratingForm.generalMetrics.punctualityScore}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, punctualityScore: parseInt(e.target.value) || 1}})}
                  />
                </div>
                <div className="form-group">
                  <label>Task Completion %</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.generalMetrics.taskCompletionRate}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, taskCompletionRate: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Quality Score (1-5)</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    className="form-input" 
                    value={ratingForm.generalMetrics.qualityScore}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, qualityScore: parseInt(e.target.value) || 1}})}
                  />
                </div>
                <div className="form-group">
                  <label>Teamwork (1-5)</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    className="form-input" 
                    value={ratingForm.generalMetrics.teamworkScore}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, teamworkScore: parseInt(e.target.value) || 1}})}
                  />
                </div>
                <div className="form-group">
                  <label>Initiative (1-5)</label>
                  <input 
                    type="number" 
                    min="1" max="5"
                    className="form-input" 
                    value={ratingForm.generalMetrics.initiativeScore}
                    onChange={(e) => setRatingForm({...ratingForm, generalMetrics: {...ratingForm.generalMetrics, initiativeScore: parseInt(e.target.value) || 1}})}
                  />
                </div>
              </div>
            </div>
            
            {/* Manager Rating */}
            <div className="form-section">
              <h4><Star size={18} /> Manager Assessment</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Overall Rating (1-5)</label>
                  <input 
                    type="number" 
                    min="1" max="5" step="0.1"
                    className="form-input" 
                    value={ratingForm.managerRating.overallRating}
                    onChange={(e) => setRatingForm({...ratingForm, managerRating: {...ratingForm.managerRating, overallRating: parseFloat(e.target.value) || 1}})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>{t('common.comments')}</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={ratingForm.managerRating.comments}
                  onChange={(e) => setRatingForm({...ratingForm, managerRating: {...ratingForm.managerRating, comments: e.target.value}})}
                  placeholder="Enter your assessment and feedback..."
                />
              </div>
            </div>
            
            {/* Targets & Achievements */}
            <div className="form-section">
              <h4><Target size={18} /> Targets vs Achievements</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Leads</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.targets.leads}
                    onChange={(e) => setRatingForm({...ratingForm, targets: {...ratingForm.targets, leads: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('hr.achievedLeads')}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.achievements.leads}
                    onChange={(e) => setRatingForm({...ratingForm, achievements: {...ratingForm.achievements, leads: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Sales</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.targets.sales}
                    onChange={(e) => setRatingForm({...ratingForm, targets: {...ratingForm.targets, sales: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('hr.achievedSales')}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.achievements.sales}
                    onChange={(e) => setRatingForm({...ratingForm, achievements: {...ratingForm.achievements, sales: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target Revenue</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.targets.revenue}
                    onChange={(e) => setRatingForm({...ratingForm, targets: {...ratingForm.targets, revenue: parseInt(e.target.value) || 0}})}
                  />
                </div>
                <div className="form-group">
                  <label>{t('hr.achievedRevenue')}</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    value={ratingForm.achievements.revenue}
                    onChange={(e) => setRatingForm({...ratingForm, achievements: {...ratingForm.achievements, revenue: parseInt(e.target.value) || 0}})}
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setShowRatingModal(false)}>
                إلغاء
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={18} /> Save Rating
              </button>
            </div>
          </form>
        </div>
      </div>
    );
    
    return (
      <div className="tab-content">
        <div className="page-header">
          <div>
            <h2>Employee Performance & Ratings</h2>
            <p className="page-subtitle">Comprehensive employee rating system with sales metrics</p>
          </div>
          <div className="header-actions">
            {canViewPerformance && (
              <button className="btn btn-primary" onClick={() => handleOpenRatingModal()}>
                <Star size={18} /> New Rating
              </button>
            )}
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${performanceView === 'ratings' ? 'active' : ''}`}
            onClick={() => setPerformanceView('ratings')}
          >
            <BarChart3 size={16} /> Ratings
          </button>
          <button 
            className={`toggle-btn ${performanceView === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setPerformanceView('leaderboard')}
          >
            <Trophy size={16} /> Leaderboard
          </button>
          <button 
            className={`toggle-btn ${performanceView === 'stats' ? 'active' : ''}`}
            onClick={() => setPerformanceView('stats')}
          >
            <PieChart size={16} /> Statistics
          </button>
        </div>
        
        {/* Rating Summary Cards */}
        {performanceView === 'ratings' && (
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-icon bg-green">
                <TrendingUp size={24} />
              </div>
              <div className="summary-info">
                <div className="summary-value">
                  {(displayRatings.reduce((sum, r) => sum + r.overallScore, 0) / displayRatings.length || 0).toFixed(0)}
                </div>
                <div className="summary-label">{t('hr.avgScore')}</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon bg-blue">
                <Star size={24} />
              </div>
              <div className="summary-info">
                <div className="summary-value">{displayRatings.filter(r => r.grade === 'A' || r.grade === 'A+').length}</div>
                <div className="summary-label">Top Performers</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon bg-orange">
                <Zap size={24} />
              </div>
              <div className="summary-info">
                <div className="summary-value">
                  {Math.round(displayRatings.reduce((sum, r) => sum + (r.salesMetrics?.targetAchievement || 0), 0) / displayRatings.length || 0)}%
                </div>
                <div className="summary-label">{t('hr.avgTarget')}</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon bg-purple">
                <TrendingDown size={24} />
              </div>
              <div className="summary-info">
                <div className="summary-value">{displayRatings.filter(r => r.grade === 'C' || r.grade === 'D').length}</div>
                <div className="summary-label">Needs Improvement</div>
              </div>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="performance-content">
          {performanceView === 'ratings' && renderRatingCards()}
          {performanceView === 'leaderboard' && renderLeaderboard()}
          {performanceView === 'stats' && renderStats()}
        </div>
        
        {/* Rating Modal */}
        {showRatingModal && renderRatingModal()}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('nav.hr')}</h1>
          <p className="page-subtitle">{t('hr.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tab-button ${activeTab === tab.id ? 'tab-active' : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && !dataLoaded[activeTab] ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          {activeTab === 'employees' && renderEmployees()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'leaves' && renderLeaves()}
          {activeTab === 'payroll' && renderPayroll()}
          {activeTab === 'performance' && renderPerformance()}
        </>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{t('hr.addNewEmployee')}</h2>
              <button className="modal-close" onClick={() => setShowEmployeeModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddEmployee} className="modal-body">
              {/* Personal Information */}
              <div className="form-section" style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>المعلومات الشخصية</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input type="text" className="form-input" required value={newEmployee.firstName} onChange={(e) => setNewEmployee({...newEmployee, firstName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input type="text" className="form-input" required value={newEmployee.lastName} onChange={(e) => setNewEmployee({...newEmployee, lastName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-input" required value={newEmployee.email} onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input type="tel" className="form-input" required value={newEmployee.phone} onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('hr.dateOfBirth')}</label>
                    <input type="date" className="form-input" value={newEmployee.dateOfBirth} onChange={(e) => setNewEmployee({...newEmployee, dateOfBirth: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nationality</label>
                    <input type="text" className="form-input" value={newEmployee.nationality} onChange={(e) => setNewEmployee({...newEmployee, nationality: e.target.value})} placeholder="e.g., Egyptian" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.address')}</label>
                    <input type="text" className="form-input" value={newEmployee.address} onChange={(e) => setNewEmployee({...newEmployee, address: e.target.value})} placeholder="Street address" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.city')}</label>
                    <input type="text" className="form-input" value={newEmployee.city} onChange={(e) => setNewEmployee({...newEmployee, city: e.target.value})} placeholder="City" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.country')}</label>
                    <input type="text" className="form-input" value={newEmployee.country} onChange={(e) => setNewEmployee({...newEmployee, country: e.target.value})} placeholder="Country" />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="form-section" style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>Employment Details</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-select" required value={newEmployee.department} onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}>
                      <option value="">Select Department</option>
                      {departments.map(d => <option key={d} value={d}>{getDepartmentLabel(d)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation *</label>
                    <select className="form-select" required value={newEmployee.designation} onChange={(e) => setNewEmployee({...newEmployee, designation: e.target.value})}>
                      <option value="">Select Designation</option>
                      {designations.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Join Date *</label>
                    <input type="date" className="form-input" required value={newEmployee.joinDate} onChange={(e) => setNewEmployee({...newEmployee, joinDate: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Salary (EGP) *</label>
                    <input type="number" className="form-input" required value={newEmployee.salary} onChange={(e) => setNewEmployee({...newEmployee, salary: e.target.value})} placeholder="Monthly salary" />
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="form-section" style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>{t('hr.bankDetails')}</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">{t('hr.bankName')}</label>
                    <input type="text" className="form-input" value={newEmployee.bankName} onChange={(e) => setNewEmployee({...newEmployee, bankName: e.target.value})} placeholder="e.g., CBE" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('hr.accountNumber')}</label>
                    <input type="text" className="form-input" value={newEmployee.bankAccount} onChange={(e) => setNewEmployee({...newEmployee, bankAccount: e.target.value})} placeholder="Bank account number" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">IBAN</label>
                    <input type="text" className="form-input" value={newEmployee.iban} onChange={(e) => setNewEmployee({...newEmployee, iban: e.target.value})} placeholder="رقم IBAN" />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="form-section" style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>{t('hr.emergencyContact')}</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input type="text" className="form-input" value={newEmployee.emergencyContactName} onChange={(e) => setNewEmployee({...newEmployee, emergencyContactName: e.target.value})} placeholder="Emergency contact name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input type="tel" className="form-input" value={newEmployee.emergencyContactPhone} onChange={(e) => setNewEmployee({...newEmployee, emergencyContactPhone: e.target.value})} placeholder="Emergency contact phone" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <input type="text" className="form-input" value={newEmployee.emergencyContactRelation} onChange={(e) => setNewEmployee({...newEmployee, emergencyContactRelation: e.target.value})} placeholder="e.g., Spouse, Parent" />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEmployeeModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('hr.addEmployee')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Request Leave</h2>
              <button className="modal-close" onClick={() => setShowLeaveModal(false)}>✕</button>
            </div>
            <form onSubmit={handleApplyLeave} className="modal-body">
              <div className="form-group">
                <label className="form-label">Employee *</label>
                <select className="form-select" required value={newLeave.employeeId} onChange={(e) => setNewLeave({...newLeave, employeeId: e.target.value})}>
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Leave Type *</label>
                <select className="form-select" required value={newLeave.leaveType} onChange={(e) => setNewLeave({...newLeave, leaveType: e.target.value})}>
                  <option value="annual">{t('hr.annualLeave')}</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="form-input" required value={newLeave.startDate} onChange={(e) => setNewLeave({...newLeave, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input type="date" className="form-input" required value={newLeave.endDate} onChange={(e) => setNewLeave({...newLeave, endDate: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">السبب</label>
                <textarea className="form-input" rows="3" value={newLeave.reason} onChange={(e) => setNewLeave({...newLeave, reason: e.target.value})} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowLeaveModal(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocModal && selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Upload Document for {selectedEmployee.name || selectedEmployee.firstName + ' ' + selectedEmployee.lastName}</h2>
              <button className="modal-close" onClick={() => { setShowDocModal(false); setNewDoc({ name: '', type: 'other', fileName: '', fileUrl: '', expiryDate: '', notes: '' }); }}>✕</button>
            </div>
            <form onSubmit={handleUploadDocument} className="modal-body">
              <div className="form-group">
                <label className="form-label">Upload File *</label>
                <input type="file" className="form-input" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) setNewDoc(prev => ({ ...prev, _uploadFile: file, fileName: file.name }));
                }} />
                <small className="form-help">Upload contract, ID, or any employee document (PDF, image, etc.)</small>
              </div>
              <div className="form-group">
                <label className="form-label">Document Name *</label>
                <input type="text" className="form-input" required value={newDoc.name} onChange={(e) => setNewDoc({...newDoc, name: e.target.value})} placeholder="e.g., Employment Contract, ID Card" />
              </div>
              <div className="form-group">
                <label className="form-label">Document Type *</label>
                <select className="form-select" required value={newDoc.type} onChange={(e) => setNewDoc({...newDoc, type: e.target.value})}>
                  <option value="contract">Contract / عقد عمل</option>
                  <option value="id">ID Card / بطاقة شخصية</option>
                  <option value="passport">Passport / جواز سفر</option>
                  <option value="certificate">Certificate / شهادة</option>
                  <option value="medical">Medical Record / كشف طبي</option>
                  <option value="other">Other / أخرى</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">تاريخ الانتهاء</label>
                <input type="date" className="form-input" value={newDoc.expiryDate} onChange={(e) => setNewDoc({...newDoc, expiryDate: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea className="form-input" rows="2" value={newDoc.notes} onChange={(e) => setNewDoc({...newDoc, notes: e.target.value})} placeholder="Optional notes..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => { setShowDocModal(false); setNewDoc({ name: '', type: 'other', fileName: '', fileUrl: '', expiryDate: '', notes: '' }); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">
                  {newDoc._uploadFile ? 'Upload File' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{t('hr.employeeDetails')}</h2>
              <button className="modal-close" onClick={() => setSelectedEmployee(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="employee-profile-header">
                <div className="avatar avatar-xl">
                  {selectedEmployee.avatar || selectedEmployee.firstName?.[0] + selectedEmployee.lastName?.[0]}
                </div>
                <div className="employee-profile-info">
                  <div className="employee-name">{selectedEmployee.firstName} {selectedEmployee.lastName}</div>
                  <div className="employee-designation">{selectedEmployee.designation}</div>
                  <div className="employee-department">{getDepartmentLabel(selectedEmployee.department)}</div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">{t('common.email')}</label>
                  <div>{selectedEmployee.email}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.phone')}</label>
                  <div>{selectedEmployee.phone}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Join Date</label>
                  <div>{selectedEmployee.joinDate}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('hr.salary')}</label>
                  <div>{formatCurrency(selectedEmployee.salary)}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.status')}</label>
                  <div>
                    <span className={`badge badge-${selectedEmployee.status === 'active' ? 'success' : 'danger'}`}>
                      {selectedEmployee.status}
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Leave Balance</label>
                  <div>Annual: {selectedEmployee.leaveBalance?.annual || 0} days</div>
                </div>
              </div>

              {selectedEmployee.bankName && (
                <div className="bank-details">
                  <div className="section-title">{t('hr.bankDetails')}</div>
                  <div className="bank-info">
                    <div>Bank: {selectedEmployee.bankName}</div>
                    <div>Account: {selectedEmployee.bankAccount}</div>
                    <div>IBAN: {selectedEmployee.iban}</div>
                  </div>
                </div>
              )}

              {/* Documents Section */}
              <div className="bank-details" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>{t('common.documents')}</div>
                  <button className="btn btn-sm btn-primary" onClick={() => setShowDocModal(true)}>
                    <Plus size={14} /> Upload Document
                  </button>
                </div>
                {selectedEmployeeDocs.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '0.9rem', padding: '12px 0' }}>No documents uploaded yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedEmployeeDocs.map(doc => (
                      <div key={doc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <FileText size={18} style={{ color: '#3b82f6' }} />
                          <div>
                            <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{doc.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{doc.type} {doc.expiryDate && `• Expires: ${doc.expiryDate}`}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {doc.canDownload && (
                            <a href={hrService.downloadDocument(selectedEmployee.id, doc._id)} target="_blank" rel="noopener noreferrer" className="btn-icon btn-view" title="Download" style={{ textDecoration: 'none' }}>
                              <Eye size={16} />
                            </a>
                          )}
                          {doc.status !== 'verified' && (
                            <button className="btn-icon btn-edit" onClick={() => handleVerifyDocument(doc._id, 'verified')} title="Verify">
                              <Check size={16} />
                            </button>
                          )}
                          <button className="btn-icon btn-delete" onClick={() => handleDeleteDocument(doc._id)} title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedEmployee(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Page Layout */
        .page-container { padding: 24px; }
        
        /* Header Actions */
        .header-actions { display: flex; gap: 12px; align-items: center; }
        .header-select { width: 180px; }
        .month-input { width: 150px; }
        
        /* Tab Navigation */
        .tab-navigation {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 8px;
        }
        
        .tab-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          border: none;
          background: transparent;
          color: #64748b;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 400;
          transition: all 0.2s;
        }
        
        .tab-button:hover {
          background: #f1f5f9;
          color: #475569;
        }
        
        .tab-active {
          background: #3b82f6;
          color: white;
          font-weight: 500;
        }
        
        .tab-active:hover {
          background: #2563eb;
          color: white;
        }
        
        /* Tab Content */
        .tab-content { animation: fadeIn 0.3s ease; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Department Grid */
        .dept-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .dept-card {
          padding: 16px;
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        
        .dept-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .dept-card-active[data-dept="management"] { border-color: #2563eb; }
        .dept-card-active[data-dept="finance"] { border-color: #059669; }
        .dept-card-active[data-dept="sales"] { border-color: #db2777; }
        .dept-card-active[data-dept="production"] { border-color: #d97706; }
        .dept-card-active[data-dept="logistics"] { border-color: #ea580c; }
        .dept-card-active[data-dept="operations"] { border-color: #4f46e5; }
        .dept-card-active[data-dept="legal"] { border-color: #dc2626; }
        .dept-card-active[data-dept="maintenance"] { border-color: #64748b; }
        .dept-card-active[data-dept="inventory"] { border-color: #d97706; }
        .dept-card-active[data-dept="it"] { border-color: #9333ea; }
        
        .dept-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .dept-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .dept-info { flex: 1; }
        
        .dept-name {
          font-weight: 600;
          color: #1e293b;
        }
        
        .dept-count {
          font-size: 0.8rem;
          color: #64748b;
        }
        
        .dept-stats {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: #64748b;
        }
        
        /* Background Colors for Stat Icons */
        .bg-blue { background: #dbeafe; }
        .bg-green { background: #d1fae5; }
        .bg-orange { background: #fef3c7; }
        .bg-purple { background: #e0e7ff; }
        .bg-red { background: #fee2e2; }
        .bg-pink { background: #fce7f3; }
        .bg-amber { background: #fed7aa; }
        .bg-gray { background: #f1f5f9; }
        
        /* Text Colors */
        .text-blue { color: #2563eb; }
        .text-green { color: #059669; }
        .text-orange { color: #d97706; }
        .text-purple { color: #4f46e5; }
        .text-red { color: #dc2626; }
        .text-pink { color: #db2777; }
        .text-amber { color: #ea580c; }
        .text-gray { color: #64748b; }
        
        /* Avatar Styles */
        .avatar {
          border-radius: 50%;
          background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .avatar-sm { width: 36px; height: 36px; font-size: 0.75rem; }
        .avatar-md { width: 40px; height: 40px; font-size: 0.85rem; }
        .avatar-lg { width: 48px; height: 48px; font-size: 1rem; }
        .avatar-xl { width: 80px; height: 80px; font-size: 1.5rem; }
        
        /* Employee Cell */
        .employee-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .employee-info { display: flex; flex-direction: column; }
        
        .employee-name {
          font-weight: 500;
          color: #1e293b;
        }
        
        .employee-id {
          font-size: 0.8rem;
          color: #64748b;
        }
        
        .employee-designation {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .employee-department {
          color: #64748b;
          font-size: 0.9rem;
        }
        
        /* Department Badge */
        .dept-badge {
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          background: #f1f5f9;
          color: #475569;
          display: inline-block;
        }
        
        /* Contact Info */
        .contact-info { font-size: 0.85rem; }
        
        .contact-row {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .contact-row:first-child { margin-bottom: 2px; }
        
        /* Attendance Card */
        .attendance-card { margin-top: 20px; }
        
        .attendance-checked-in { background: #f0fdf4; }
        
        .attendance-pending { background: #fef3c7; }
        
        .attendance-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px;
        }
        
        .attendance-status h3 { margin-bottom: 8px; }
        
        .attendance-message {
          color: #64748b;
          font-size: 0.9rem;
          margin: 0;
        }
        
        .attendance-actions {
          display: flex;
          gap: 12px;
        }
        
        .attendance-complete {
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        /* Pending Leaves */
        .pending-leaves-card {
          margin-top: 20px;
          background: #fef3c7;
        }
        
        .pending-leaves-list {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .pending-leave-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        
        .leave-info {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .leave-icon {
          padding: 8px;
          background: #e0e7ff;
          border-radius: 8px;
          color: #4f46e5;
        }
        
        .leave-details { flex: 1; }
        
        .leave-employee {
          font-weight: 500;
          color: #1e293b;
        }
        
        .leave-dates {
          font-size: 0.85rem;
          color: #64748b;
        }
        
        .leave-reason {
          font-size: 0.8rem;
          color: #64748b;
          margin-top: 4px;
        }
        
        .leave-actions {
          display: flex;
          gap: 8px;
        }
        
        .leave-type {
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: capitalize;
        }
        
        /* Payroll */
        .net-salary {
          font-weight: 600;
          color: #059669;
        }
        
        /* Performance */
        .performance-list {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .performance-card {
          padding: 20px;
          background: #f8fafc;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        
        .performance-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        
        .rating-display { text-align: right; }
        
        .rating-value {
          font-size: 2rem;
          font-weight: 700;
        }
        
        .rating-high { color: #059669; }
        .rating-medium { color: #d97706; }
        .rating-low { color: #dc2626; }
        
        .rating-label {
          font-size: 0.8rem;
          color: #64748b;
        }
        
        .performance-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 16px;
        }
        
        .metric-card {
          padding: 12px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        
        .metric-label {
          font-size: 0.8rem;
          color: #64748b;
          margin-bottom: 4px;
        }
        
        .metric-value {
          font-weight: 600;
          color: #1e293b;
        }
        
        .metric-target {
          font-size: 0.75rem;
          color: #64748b;
        }
        
        .progress-bar {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          margin-top: 8px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #2980b9;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        
        .progress-green { background: #059669; }
        
        .performance-comments {
          padding: 12px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        
        .comments-label {
          font-size: 0.8rem;
          color: #64748b;
          margin-bottom: 4px;
        }
        
        .comments-text {
          font-style: italic;
          color: #475569;
        }
        
        .reviewer-info {
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 8px;
        }
        
        /* Employee Profile in Modal */
        .employee-profile-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .employee-profile-info { flex: 1; }
        
        /* Bank Details */
        .bank-details {
          margin-top: 20px;
          padding: 16px;
          background: #f8fafc;
          border-radius: 8px;
        }
        
        .bank-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          font-size: 0.9rem;
        }
        
        /* Form Grid */
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        
        /* Utility Classes */
        .text-truncate {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        /* Loading */
        .loading-container {
          display: flex;
          justify-content: center;
          padding: 60px;
        }
        
        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Section Title */
        .section-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: #1e293b;
        }
        
        /* Rating System Styles */
        .view-toggle {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          padding: 4px;
          background: #f1f5f9;
          border-radius: 8px;
          width: fit-content;
        }
        
        .toggle-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          color: #64748b;
          transition: all 0.2s;
        }
        
        .toggle-btn:hover {
          background: rgba(255,255,255,0.5);
        }
        
        .toggle-btn.active {
          background: white;
          color: #1e293b;
          font-weight: 500;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .summary-card {
          background: white;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .summary-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .summary-icon.bg-green { background: #dcfce7; color: #16a34a; }
        .summary-icon.bg-blue { background: #dbeafe; color: #2563eb; }
        .summary-icon.bg-orange { background: #ffedd5; color: #ea580c; }
        .summary-icon.bg-purple { background: #f3e8ff; color: #9333ea; }
        
        .summary-info { flex: 1; }
        
        .summary-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
        }
        
        .summary-label {
          font-size: 0.85rem;
          color: #64748b;
        }
        
        /* Ratings Grid */
        .ratings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 20px;
        }
        
        .rating-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0;
        }
        
        .rating-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        
        .grade-display {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
        }
        
        .score-section {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .score-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .score-circle::before {
          content: '';
          position: absolute;
          width: 60px;
          height: 60px;
          background: white;
          border-radius: 50%;
        }
        
        .score-value {
          position: relative;
          font-size: 1.25rem;
          font-weight: 700;
          z-index: 1;
        }
        
        .score-label {
          font-size: 0.9rem;
          color: #64748b;
        }
        
        .period-badge {
          display: inline-block;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #64748b;
          margin-top: 4px;
        }
        
        .metrics-section {
          margin-bottom: 16px;
        }
        
        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        
        .metric-item {
          background: #f8fafc;
          padding: 10px;
          border-radius: 8px;
        }
        
        .metric-label-sm {
          font-size: 0.75rem;
          color: #64748b;
          margin-bottom: 4px;
        }
        
        .metric-value-sm {
          font-size: 0.95rem;
          font-weight: 600;
          color: #1e293b;
        }
        
        .text-green { color: #16a34a; }
        .text-orange { color: #ea580c; }
        
        .manager-rating-section {
          background: #fefce8;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        
        .stars-display {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }
        
        .star-filled { color: #fbbf24; }
        .star-empty { color: #d1d5db; }
        
        .manager-comment {
          font-size: 0.85rem;
          color: #475569;
          font-style: italic;
        }
        
        .rating-actions {
          display: flex;
          gap: 8px;
        }
        
        /* Leaderboard Styles */
        .leaderboard-container {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .leaderboard-header {
          text-align: center;
          margin-bottom: 32px;
        }
        
        .leaderboard-header h3 {
          font-size: 1.5rem;
          color: #1e293b;
          margin-bottom: 4px;
        }
        
        .leaderboard-header p {
          color: #64748b;
        }
        
        .trophy-icon {
          color: #fbbf24;
          margin-bottom: 12px;
        }
        
        .leaderboard-podium {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 40px;
        }
        
        .podium-item {
          text-align: center;
          padding: 20px;
          border-radius: 16px;
          background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        }
        
        .podium-1 { order: 2; transform: scale(1.1); }
        .podium-2 { order: 1; }
        .podium-3 { order: 3; }
        
        .podium-rank {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          color: white;
        }
        
        .podium-avatar {
          margin-bottom: 12px;
        }
        
        .podium-name {
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 4px;
        }
        
        .podium-score {
          font-size: 1.1rem;
          font-weight: 700;
          color: #3b82f6;
          margin-bottom: 8px;
        }
        
        .podium-grade {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        .leaderboard-table-container {
          overflow-x: auto;
        }
        
        .leaderboard-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .leaderboard-table th {
          text-align: left;
          padding: 12px;
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .leaderboard-table td {
          padding: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .rank-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #64748b;
        }
        
        .rank-badge.rank-top {
          background: #fef3c7;
          color: #d97706;
        }
        
        .score-bar {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .score-fill {
          height: 8px;
          border-radius: 4px;
          min-width: 20px;
        }
        
        .grade-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        
        /* Stats View Styles */
        .stats-overview {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }
        
        .stat-card-large {
          background: white;
          border-radius: 16px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .stat-icon-large {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .stat-icon-large.bg-blue { background: #dbeafe; color: #2563eb; }
        .stat-icon-large.bg-green { background: #dcfce7; color: #16a34a; }
        .stat-icon-large.bg-purple { background: #f3e8ff; color: #9333ea; }
        
        .stat-value-large {
          font-size: 2rem;
          font-weight: 700;
          color: #1e293b;
        }
        
        .stat-label-large {
          font-size: 0.9rem;
          color: #64748b;
        }
        
        .stats-details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        
        .grade-distribution {
          padding: 16px 0;
        }
        
        .grade-bar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .grade-label {
          width: 32px;
          font-weight: 600;
          font-size: 0.9rem;
        }
        
        .grade-bar-container {
          flex: 1;
          height: 24px;
          background: #f1f5f9;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .grade-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }
        
        .grade-count {
          width: 28px;
          text-align: right;
          font-weight: 600;
          color: #64748b;
        }
        
        .top-performer-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #fef9c3, #fef3c7);
          border-radius: 12px;
          margin-top: 12px;
        }
        
        .performer-info {
          flex: 1;
        }
        
        .performer-name {
          font-weight: 600;
          color: #1e293b;
          font-size: 1.1rem;
        }
        
        .performer-dept {
          font-size: 0.9rem;
          color: #64748b;
          margin-top: 2px;
        }
        
        .performer-score {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
        }
        
        .performer-score .score-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #d97706;
        }
        
        /* Form Section */
        .form-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .form-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 16px;
        }
        
        .no-data {
          text-align: center;
          padding: 24px;
          color: #64748b;
        }
        
        @media (max-width: 1024px) {
          .ratings-grid {
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          }
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          .stats-overview {
            grid-template-columns: repeat(2, 1fr);
          }
          .stats-details-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .summary-cards {
            grid-template-columns: 1fr;
          }
          .stats-overview {
            grid-template-columns: 1fr;
          }
          .leaderboard-podium {
            flex-direction: column;
            align-items: center;
          }
          .podium-1, .podium-2, .podium-3 {
            order: unset;
            transform: none;
          }
          .view-toggle {
            width: 100%;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

const PayrollEmployeeRow = ({ ep, payrollId, formatCurrency, getDepartmentLabel, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [basic, setBasic] = useState(ep.basicSalary || 0);
  const [allowances, setAllowances] = useState(ep.totalAllowances || ep.allowances || 0);
  const [deductions, setDeductions] = useState(ep.totalDeductions || ep.deductions || 0);
  const [saving, setSaving] = useState(false);

  const net = parseFloat(basic) + parseFloat(allowances) - parseFloat(deductions);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/payroll/${payrollId}/employees/${ep._id || ep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ basicSalary: basic, additions: allowances, deductions })
      });
      const data = await res.json();
      if (data.success) {
        // Then recalculate totals
        await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/payroll/${payrollId}/recalculate`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setEditing(false);
        if (onUpdate) onUpdate();
      } else {
        alert(data.error || 'Failed to save');
      }
    } catch (e) {
      alert('Error saving: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr>
      <td>
        <div className="employee-cell">
          <div className="avatar avatar-sm">{ep.employeeName?.charAt(0)}</div>
          <span className="employee-name">{ep.employeeName}</span>
        </div>
      </td>
      <td><span className="dept-badge">{getDepartmentLabel(ep.department)}</span></td>
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
            <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '2px 8px', fontSize: '11px' }}>
              {saving ? '...' : 'Save'}
            </button>
            <button className="btn btn-sm btn-outline" onClick={() => setEditing(false)} style={{ padding: '2px 8px', fontSize: '11px' }}>
              إلغاء
            </button>
          </div>
        ) : (
          <button className="btn-icon btn-edit" onClick={() => { setBasic(ep.basicSalary || 0); setAllowances(ep.totalAllowances || ep.allowances || 0); setDeductions(ep.totalDeductions || ep.deductions || 0); setEditing(true); }} title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        )}
      </td>
    </tr>
  );
};

export default HR;
