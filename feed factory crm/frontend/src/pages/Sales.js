import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  ShoppingCart, 
  FileText, 
  CreditCard,
  Bell,
  TrendingUp,
  DollarSign,
  Package,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  Plus,
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  X
} from 'lucide-react';
import { formatCurrency, formatDate, formatNumber, getStatusLabel } from '../utils/formatters';
import { salesService, authService } from '../services/api';
import FloatingActionButton from '../components/FloatingActionButton';
import PaymentModal from '../components/PaymentModal';
import ReminderModal from '../components/ReminderModal';
import OrderDetailModal from '../components/OrderDetailModal';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');
const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

/**
 * Sales Module - Complete Implementation
 * Features:
 * - Role-based access (Sales Manager vs Sales Rep)
 * - Client management with assignment
 * - Order management with approval workflow
 * - Invoice management
 * - Payment recording linked to client files
 * - Reminder system
 * - Dashboard statistics
 * - Floating Action Buttons for quick actions
 */

const Sales = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const isManager = user?.role === 'sales_manager' || user?.role === 'admin' || user?.role === 'owner';

  // State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [invoiceReminders, setInvoiceReminders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showClientDetailModal, setShowClientDetailModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetailData, setClientDetailData] = useState(null);
  const [clientModalAllowedTabs, setClientModalAllowedTabs] = useState(null);

  // Order Detail State
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailItems, setOrderDetailItems] = useState([]);

  // Manager filters
  const [filterCity, setFilterCity] = useState('');
  const [filterMinDue, setFilterMinDue] = useState('');
  const [filterMaxDue, setFilterMaxDue] = useState('');
  const [filterMinQty, setFilterMinQty] = useState('');
  const [filterPaymentTerms, setFilterPaymentTerms] = useState('');
  const [filterHasOverdue, setFilterHasOverdue] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [redFlags, setRedFlags] = useState([]);
  const [patterns, setPatterns] = useState({});
  
  // Fetch data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch dashboard stats
      const statsRes = await salesService.getDashboardStats();
      if (statsRes.success) setStats(statsRes.stats);

      // Fetch clients (role-based)
      const clientsRes = await salesService.getMyClients();
      if (clientsRes.success) setClients(clientsRes.clients);

      // Fetch orders
      const ordersRes = await salesService.getOrders();
      if (ordersRes.success) setOrders(ordersRes.orders);

      // Fetch invoices
      const invoicesRes = await salesService.getInvoices();
      if (invoicesRes.success) setInvoices(invoicesRes.invoices);

      // Fetch reminders
      const remindersRes = await salesService.getReminders();
      if (remindersRes.success) setReminders(remindersRes.reminders);

      // Fetch invoice payment reminders
      try {
        const invRemRes = await fetch(`${API_URL}/reminders/invoices`, { headers: headers() });
        if (invRemRes.ok) {
          const data = await invRemRes.json();
          setInvoiceReminders(data.reminders?.flatMap(r => r.invoices) || []);
        }
      } catch (e) {}

      // Fetch red flags and patterns (manager only)
      if (isManager) {
        try {
          const flagsRes = await salesService.getRedFlags();
          if (flagsRes.success) setRedFlags(flagsRes.redFlags || []);
        } catch (e) { console.log('Red flags not available'); }
        try {
          const patternsRes = await salesService.getClientPatterns();
          if (patternsRes.success) setPatterns(patternsRes.patterns || {});
        } catch (e) { console.log('Patterns not available'); }
      }
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (formData) => {
    try {
      const result = await salesService.recordPayment({
        clientId: parseInt(formData.clientId),
        invoiceId: formData.invoiceId ? parseInt(formData.invoiceId) : null,
        amount: parseFloat(formData.amount),
        method: formData.method,
        date: formData.date,
        description: formData.description
      });
      
      if (result.success) {
        fetchAllData();
      }
      return result;
    } catch (error) {
      console.error('Payment submission error:', error);
      return { success: false, error: error.message };
    }
  };

  // Handle reminder submission
  const handleReminderSubmit = async (formData) => {
    try {
      const result = await salesService.createReminder({
        clientId: parseInt(formData.clientId),
        title: formData.title,
        message: formData.message,
        reminderDate: formData.reminderDate,
        reminderType: formData.reminderType
      });
      
      if (result.success) {
        fetchAllData();
      }
      return result;
    } catch (error) {
      console.error('Reminder submission error:', error);
      return { success: false, error: error.message };
    }
  };

  // View client details
  const viewClientDetails = async (client) => {
    setClientModalAllowedTabs(null);
    setSelectedClient(client);
    setShowClientDetailModal(true);
    
    try {
      const result = await salesService.getClientFullDetails(client.id);
      if (result.success) {
        setClientDetailData(result);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
    }
  };

  // Open client detail modal from approval card (overview + liabilities tabs only)
  const openClientDetailModal = async (clientId) => {
    setClientModalAllowedTabs(['overview', 'invoices']);
    setClientDetailData(null);
    try {
      const res = await fetch(`${API_URL}/clients/${clientId}`, { headers: headers() });
      const data = await res.json();
      const clientData = data.client || clients.find(c => String(c.id) === String(clientId) || String(c._id) === String(clientId));
      if (clientData) {
        setSelectedClient(clientData);
        setShowClientDetailModal(true);
        const result = await salesService.getClientFullDetails(clientId);
        if (result.success) setClientDetailData(result);
      }
    } catch (error) {
      console.error('Error fetching client for modal:', error);
      const localClient = clients.find(c => String(c.id) === String(clientId) || String(c._id) === String(clientId));
      if (localClient) {
        setSelectedClient(localClient);
        setShowClientDetailModal(true);
      }
    }
  };

  // Approve order (Manager only) — routes through the generic two-stage approval workflow
  const approveOrder = async (orderId) => {
    try {
      const pendingRes = await fetch(`${API_URL}/approvals/pending`, { headers: headers() });
      const pendingData = await pendingRes.json();
      const match = (pendingData.requests || []).find(r => r.module_name === 'sales_orders' && r.request_id === orderId);
      if (!match) {
        alert('لا يوجد طلب موافقة معلق يمكنك اعتماده لهذا الطلب من هنا');
        return;
      }
      const response = await fetch(`${API_URL}/approvals/${match.id}/approve`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({})
      });
      const result = await response.json();
      if (result.success) {
        fetchAllData();
      } else {
        alert(result.error || 'Failed to approve order');
      }
    } catch (error) {
      console.error('Error approving order:', error);
      alert(t('sales.errorApprove') + ': ' + (error.message || t('sales.unknownError')));
    }
  };

  // Reject order (Manager only)
  const rejectOrder = async (orderId, reason) => {
    try {
      const pendingRes = await fetch(`${API_URL}/approvals/pending`, { headers: headers() });
      const pendingData = await pendingRes.json();
      const match = (pendingData.requests || []).find(r => r.module_name === 'sales_orders' && r.request_id === orderId);
      if (!match) {
        alert('لا يوجد طلب موافقة معلق يمكن رفضه لهذا الطلب من هنا');
        return;
      }
      const response = await fetch(`${API_URL}/approvals/${match.id}/reject`, {
        method: 'PUT', headers: headers(), body: JSON.stringify({ notes: reason })
      });
      const result = await response.json();
      if (result.success) {
        fetchAllData();
      }
    } catch (error) {
      console.error('Error rejecting order:', error);
    }
  };

  // View order details
  const viewOrderDetails = async (order) => {
    setSelectedOrder(order);
    setOrderDetailItems([]);
    setShowOrderDetail(true);
    try {
      const res = await fetch(`${API_URL}/sales/orders/${order.id}/items`, { headers: headers() });
      const data = await res.json();
      if (data.success) setOrderDetailItems(data.items || []);
    } catch (e) { console.log('Could not fetch order items'); }
  };

  // Filter data
  const filteredClients = clients.filter(c => {
    const matchesSearch =
      c.name_arabic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.name_english?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (isManager) {
      if (filterCity && !c.city?.toLowerCase().includes(filterCity.toLowerCase())) return false;
      const due = parseFloat(c.due_amount || c.current_balance || 0);
      if (filterMinDue && due < parseFloat(filterMinDue)) return false;
      if (filterMaxDue && due > parseFloat(filterMaxDue)) return false;
      if (filterPaymentTerms && !c.payment_terms?.toLowerCase().includes(filterPaymentTerms.toLowerCase())) return false;
      if (filterHasOverdue && parseFloat(c.overdue_count || 0) === 0) return false;
      const qty = parseFloat(c.total_quantity || 0);
      if (filterMinQty && qty < parseFloat(filterMinQty)) return false;
    }

    return true;
  });

  const pendingOrders = orders.filter(o => o.status === 'pending_approval');
  const activeOrders = orders.filter(o => ['approved', 'confirmed', 'processing', 'ready_for_delivery', 'in_transit'].includes(o.status));

  // Render Dashboard Tab
  const renderDashboard = () => (
    <div style={styles.dashboard}>
      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <StatCard 
          title={isManager ? t('dashboard.totalClients') : t('nav.clients')}
          value={stats?.totalClients || clients.length || 0} 
          icon={Users} 
          color="#3b82f6"
          trend={isManager ? t('sales.fullAccess') : t('sales.assignedToYou')}
        />
        <StatCard 
          title={t('common.activeOrders')} 
          value={stats?.activeOrders || activeOrders.length || 0} 
          icon={ShoppingCart} 
          color="#f59e0b"
          trend={`${stats?.deliveredOrders || 0} ${t('sales.delivered')}`}
        />
        <StatCard 
          title={t('dashboard.totalRevenue')} 
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign} 
          color="#10b981"
        />
        <StatCard 
          title={t('common.amountDue')} 
          value={formatCurrency(stats?.totalDue || 0)}
          icon={CreditCard} 
          color="#ef4444"
          trend={`${stats?.unpaidInvoices || 0} ${t('common.overdueInvoices')}`}
        />
      </div>

      {isManager && stats?.pendingApprovals > 0 && (
      <div style={styles.approvalAlert}>
        <AlertCircle size={20} color="#f59e0b" />
        <span>{t('common.ordersPendingApproval') || `${stats.pendingApprovals} ${t('sales.ordersPendingApproval')}`}</span>
        <button onClick={() => setActiveTab('orders')} style={styles.viewBtn}>{t('sales.view')}</button>
      </div>
      )}

      {/* Quick Actions */}
      <div style={styles.quickActions}>
        <h3 style={styles.sectionTitle}>{t('sales.quickActions')}</h3>
        <div style={styles.actionGrid}>
          <QuickActionCard 
            title={t('sales.newOrder')} 
            icon={ShoppingCart} 
            color="#3b82f6"
            onClick={() => navigate('/orders')}
          />
          <QuickActionCard 
            title={t('common.recordPayment')} 
            icon={CreditCard} 
            color="#8b5cf6"
            onClick={() => setShowPaymentModal(true)}
          />
          <QuickActionCard 
            title={t('common.addReminder')} 
            icon={Bell} 
            color="#ec4899"
            onClick={() => setShowReminderModal(true)}
          />
          {isManager && (
            <>
              <QuickActionCard 
                title={t('common.newClient')} 
                icon={Users} 
                color="#10b981"
                onClick={() => navigate('/clients')}
              />
              <QuickActionCard
                title={t('common.createInvoice')}
                icon={FileText}
                color="#f59e0b"
                onClick={() => setShowInvoiceModal(true)}
              />
            </>
          )}
        </div>
      </div>

      {/* Red Flags (Manager Only) */}
      {isManager && redFlags.length > 0 && (
        <div style={{ ...styles.section, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
          <div style={styles.sectionHeader}>
            <h3 style={{ ...styles.sectionTitle, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> {t('sales.redFlags')} ({redFlags.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {redFlags.slice(0, 5).map((flag, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: flag.severity === 'critical' ? '#ef4444' : flag.severity === 'high' ? '#f97316' : '#f59e0b' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{flag.client_name}</span>
                  <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '13px' }}>{flag.message}</span>
                  {flag.total_due > 0 && <span style={{ color: '#ef4444', marginLeft: '8px', fontSize: '13px' }}>{t('sales.due')}: {formatCurrency(parseFloat(flag.total_due))}</span>}
                </div>
                <button
                  onClick={() => { const client = clients.find(c => c.id === flag.client_id); if (client) viewClientDetails(client); }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}
                >
                  {t('sales.view')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{t('sales.recentOrders')}</h3>
          <button onClick={() => setActiveTab('orders')} style={styles.seeAllBtn}>
            {t('common.seeAll')} <ChevronRight size={16} />
          </button>
        </div>
        <div style={styles.ordersList}>
          {orders.map(order => (
            <OrderCard key={order.id} order={order} onClick={() => viewOrderDetails(order)} />
          ))}
          {orders.length === 0 && (
            <div style={styles.emptyState}>{t('sales.noOrders')}</div>
          )}
        </div>
      </div>

      {/* Upcoming Reminders */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>{t('sales.upcomingReminders')}</h3>
          <button onClick={() => setActiveTab('reminders')} style={styles.seeAllBtn}>
            {t('common.seeAll')} <ChevronRight size={16} />
          </button>
        </div>
        <div style={styles.remindersList}>
          {reminders.filter(r => r.status === 'pending').slice(0, 5).map(reminder => (
            <ReminderCard key={reminder.id} reminder={reminder} />
          ))}
          {reminders.filter(r => r.status === 'pending').length === 0 && (
            <div style={styles.emptyState}>{t('sales.noPendingReminders')}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Clients Tab
  const renderClients = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>
          {isManager ? t('sales.allClients') : t('sales.myClients')}
          <span style={styles.countBadge}>{filteredClients.length}</span>
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={styles.searchBox}>
            <Search size={18} color="#9ca3af" />
            <input
              type="text"
              placeholder={t('common.searchClients')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
          {isManager && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: showFilters ? '#eff6ff' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Filter size={16} /> {t('common.filter')}
            </button>
          )}
        </div>
      </div>

      {/* Manager Filters */}
      {isManager && showFilters && (
        <div style={{ background: '#f9fafb', padding: '16px', borderRadius: '12px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{t('sales.city')}</label>
            <input type="text" placeholder={t('sales.filterByCity')} value={filterCity} onChange={(e) => setFilterCity(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{t('sales.minDue')} (EGP)</label>
            <input type="number" placeholder="0" value={filterMinDue} onChange={(e) => setFilterMinDue(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{t('sales.maxDue')} (EGP)</label>
            <input type="number" placeholder={t('common.any')} value={filterMaxDue} onChange={(e) => setFilterMaxDue(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{t('sales.minQuantity')}</label>
            <input type="number" placeholder="0" value={filterMinQty} onChange={(e) => setFilterMinQty(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>{t('sales.paymentTerms')}</label>
            <input type="text" placeholder={t('sales.eG30Days')} value={filterPaymentTerms} onChange={(e) => setFilterPaymentTerms(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', padding: '8px', background: 'white', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <input type="checkbox" checked={filterHasOverdue} onChange={(e) => setFilterHasOverdue(e.target.checked)} />
              {t('sales.hasOverdue')}
            </label>
            <button
              onClick={() => { setFilterCity(''); setFilterMinDue(''); setFilterMaxDue(''); setFilterMinQty(''); setFilterPaymentTerms(''); setFilterHasOverdue(false); }}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '13px' }}
            >
              {t('common.clear') || t('sales.clear')}
            </button>
          </div>
        </div>
      )}

      <div style={styles.clientsGrid}>
        {filteredClients.map(client => (
          <ClientCard 
            key={client.id} 
            client={client} 
            onClick={() => viewClientDetails(client)}
          />
        ))}
      </div>
      
      {filteredClients.length === 0 && (
        <div style={styles.emptyStateFull}>
          <Users size={48} color="#d1d5db" />
          <p>{t('sales.noClients')}</p>
          {isManager && (
            <button onClick={() => navigate('/clients')} style={styles.addBtn}>
              <Plus size={16} /> {t('sales.addClient')}
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Render Orders Tab
  const renderOrders = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>
          {t('sales.tabs.orders')}
          <span style={styles.countBadge}>{orders.length}</span>
        </h2>
      </div>

      {/* بانتظار الاعتمادs Section (Manager Only) */}
      {isManager && pendingOrders.length > 0 && (
        <div style={styles.pendingSection}>
          <h3 style={styles.subSectionTitle}>{t('sales.pendingApproval')} ({pendingOrders.length})</h3>
          {pendingOrders.map(order => (
            <OrderApprovalCard
              key={order.id}
              order={order}
              onApprove={() => approveOrder(order.id)}
              onReject={(reason) => rejectOrder(order.id, reason)}
              onViewClient={() => openClientDetailModal(order.client_id || order.clientId)}
            />
          ))}
        </div>
      )}

      {/* Active Orders */}
      <div style={styles.ordersSection}>
        <h3 style={styles.subSectionTitle}>{t('sales.activeOrders')}</h3>
          {activeOrders.map(order => (
            <OrderCard key={order.id} order={order} detailed onClick={() => viewOrderDetails(order)} />
          ))}
          {activeOrders.length === 0 && <div style={styles.emptyState}>{t('sales.noActiveOrders')}</div>}
      </div>
    </div>
  );

  // Render Invoices Tab
  const renderInvoices = () => (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>{t('sales.tabs.invoices')}</h2>
      </div>
      <div style={styles.invoicesList}>
        {invoices.map(invoice => (
          <InvoiceCard key={invoice.id} invoice={invoice} />
        ))}
        {invoices.length === 0 && <div style={styles.emptyState}>{t('sales.noInvoices')}</div>}
      </div>
    </div>
  );

  // Main Render
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>{t('nav.sales')}</h1>
          <p style={styles.pageSubtitle}>
            {isManager ? t('sales.managerDashboard') : t('sales.repDashboard')}
          </p>
        </div>
        <div style={styles.userInfo}>
          <span style={styles.userName}>{user?.name}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'dashboard', label: t('sales.tabs.dashboard'), icon: TrendingUp },
          { id: 'clients', label: t('sales.tabs.clients'), icon: Users },
          { id: 'orders', label: t('sales.tabs.orders'), icon: ShoppingCart },
          { id: 'invoices', label: t('sales.tabs.invoices'), icon: FileText },
          { id: 'reminders', label: t('sales.tabs.reminders'), icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : {})
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {loading ? (
          <div style={styles.loading}>
            <RefreshCw size={32} className="spin" />
            <p>{t('common.loading')}</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'clients' && renderClients()}
            {activeTab === 'orders' && renderOrders()}
            {activeTab === 'invoices' && renderInvoices()}
            {activeTab === 'reminders' && (
              <div style={styles.tabContent}>
                <h2 style={styles.tabTitle}>{t('sales.tabs.reminders')}</h2>
                <div style={styles.sectionTitle}>{t('sales.paymentReminders')}</div>
                {invoiceReminders.length > 0 ? (
                  <div style={styles.remindersList}>
                    {invoiceReminders.map((inv, i) => (
                      <div key={i} style={{ padding: '12px', margin: '8px 0', background: inv.reminder_type === 'overdue' ? '#fef2f2' : inv.reminder_type === 'due_today' ? '#fffbeb' : '#f0fdf4', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{inv.client_name}</strong> - {inv.invoice_number}
                            <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>
                              {formatCurrency(parseFloat(inv.amount || 0))} | الاستحقاق: {formatDate(inv.due_date)} | {inv.days_until_due !== null ? (inv.days_until_due > 0 ? `${inv.days_until_due} يوم` : inv.days_until_due === 0 ? 'اليوم' : `${Math.abs(inv.days_until_due)} يوم تأخير`) : ''}
                            </p>
                          </div>
                          <button className="btn btn-sm" onClick={() => {
                            const msg = `السلام عليكم ${inv.client_name}، فاتورة ${inv.invoice_number} for ${formatCurrency(parseFloat(inv.amount || 0))} تستحق في ${formatDate(inv.due_date)}. نرجو ترتيب السداد.`;
                            window.open(`https://wa.me/${inv.client_phone || ''}?text=${encodeURIComponent(msg)}`, '_blank');
                          }} style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', cursor: 'pointer' }}>
                            <MessageCircle size={14} /> WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#6b7280', padding: '12px' }}>{t('sales.noUpcomingReminders')}</p>
                )}
                <div style={{ ...styles.sectionTitle, marginTop: '16px' }}>{t('common.reminders')}</div>
                <div style={styles.remindersList}>
                  {reminders.map(reminder => (
                    <ReminderCard key={reminder.id} reminder={reminder} detailed />
                  ))}
                  {reminders.length === 0 && <div style={styles.emptyState}>{t('sales.noReminders')}</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        userRole={user?.role}
        onAddOrder={() => navigate('/orders')}
        onAddClient={isManager ? () => navigate('/clients') : null}
        onAddInvoice={isManager ? () => setShowInvoiceModal(true) : null}
        onAddPayment={() => setShowPaymentModal(true)}
        onAddReminder={() => setShowReminderModal(true)}
      />

      {/* Modals */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePaymentSubmit}
        clients={clients}
        invoices={invoices}
        preselectedClient={selectedClient}
      />

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSubmit={handleReminderSubmit}
        clients={clients}
        preselectedClient={selectedClient}
      />

      {/* Invoice Creation Modal */}
      {showInvoiceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={24} color="#f59e0b" />
                <h2 style={{ margin: 0 }}>{t('sales.createInvoice')}</h2>
              </div>
              <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const orderId = formData.get('orderId');
              const dueDate = formData.get('dueDate');
              const notes = formData.get('notes');
              try {
                const result = await salesService.createInvoice({ orderId: parseInt(orderId), dueDate, notes });
                if (result.success) {
                  fetchAllData();
                  setShowInvoiceModal(false);
                } else {
                  alert(result.error || t('sales.failedCreateInvoice'));
                }
              } catch (err) {
                alert(t('sales.errorCreateInvoice') + ': ' + err.message);
              }
            }} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('sales.order')} <span style={{ color: '#ef4444' }}>*</span></label>
                <select name="orderId" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}>
                  <option value="">{t('sales.selectApprovedOrder')}</option>
                  {orders.filter(o => ['approved', 'confirmed', 'delivered'].includes(o.status) && !invoices.some(i => i.order_id === o.id)).map(o => (
                    <option key={o.id} value={o.id}>{o.order_number} - {o.client_name} - {formatCurrency(parseFloat(o.final_amount || 0) )}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('sales.dueDate')} <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="date" name="dueDate" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('sales.notes')}</label>
                <textarea name="notes" rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }} placeholder={t('sales.optionalNotes')} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setShowInvoiceModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontSize: '14px' }}>{t('common.cancel')}</button>
                <button type="submit" style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>{t('sales.createInvoice')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetail && selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          items={orderDetailItems}
          onClose={() => setShowOrderDetail(false)}
          onApprove={(id) => { approveOrder(id); setShowOrderDetail(false); }}
          onReject={(id) => { const reason = prompt(t('sales.reasonRejection') + ':'); if (reason) { rejectOrder(id, reason); setShowOrderDetail(false); } }}
          isManager={isManager}
        />
      )}

      {/* Client Detail Modal */}
      {showClientDetailModal && selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          detailData={clientDetailData}
          allowedTabs={clientModalAllowedTabs}
          onClose={() => {
            setShowClientDetailModal(false);
            setSelectedClient(null);
            setClientDetailData(null);
            setClientModalAllowedTabs(null);
          }}
          onAddOrder={() => navigate('/orders')}
          onAddPayment={() => setShowPaymentModal(true)}
          onAddReminder={() => setShowReminderModal(true)}
          onViewOrder={(order) => viewOrderDetails(order)}
          isManager={isManager}
        />
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

// Sub-components

const StatCard = ({ title, value, icon: Icon, color, trend }) => (
  <div style={styles.statCard}>
    <div style={{...styles.statIcon, backgroundColor: `${color}20`}}>
      <Icon size={24} color={color} />
    </div>
    <div style={styles.statInfo}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statTitle}>{title}</span>
      {trend && <span style={styles.statTrend}>{trend}</span>}
    </div>
  </div>
);

const QuickActionCard = ({ title, icon: Icon, color, onClick }) => (
  <button onClick={onClick} style={{...styles.quickActionCard, borderColor: color}}>
    <Icon size={24} color={color} />
    <span style={styles.quickActionTitle}>{title}</span>
  </button>
);

const ClientCard = ({ client, onClick }) => (
  <div onClick={onClick} style={styles.clientCard}>
    <div style={styles.clientHeader}>
      <div style={styles.clientAvatar}>
        {client.name_arabic?.charAt(0) || 'C'}
      </div>
      <div style={styles.clientInfo}>
        <h4 style={styles.clientName}>{client.name_arabic}</h4>
        <span style={styles.clientCode}>{client.code}</span>
      </div>
      <span style={{...styles.clientType, backgroundColor: getTypeColor(client.type)}}>
        {client.type}
      </span>
    </div>
    
    <div style={styles.clientStats}>
      <div style={styles.clientStat}>
        <span style={styles.statLabel}>{t('sales.dueAmount')}</span>
        <span style={{...styles.statValue, color: client.due_amount > 0 ? '#ef4444' : '#10b981'}}>
          {formatCurrency(parseFloat(client.due_amount || 0) )}
        </span>
      </div>
      <div style={styles.clientStat}>
        <span style={styles.statLabel}>{t('orders.title')}</span>
        <span style={styles.statValue}>{client.total_orders || 0}</span>
      </div>
    </div>
    
    {client.phone && (
      <div style={styles.clientContact}>
        <Phone size={14} />
        <span>{client.phone}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const url = `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم')}`;
            window.open(url, '_blank');
          }}
          style={styles.whatsappBtn}
          title="Send WhatsApp"
        >
          <MessageCircle size={14} />
        </button>
      </div>
    )}
  </div>
);

const OrderCard = ({ order, detailed, onClick }) => (
  <div onClick={onClick} className={onClick ? 'sales-order-card' : ''} style={{...styles.orderCard, cursor: onClick ? 'pointer' : 'default'}}>
    <div style={styles.orderHeader}>
      <div>
        <span style={styles.orderNumber}>{order.order_number}</span>
        <span style={styles.orderClient}>{order.client_name}</span>
      </div>
      <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
        <OrderStatusBadge status={order.status} />
        {order.payment_status && <PaymentStatusBadge status={order.payment_status} />}
      </div>
    </div>
    <div style={styles.orderDetails}>
      <span style={styles.orderAmount}>{formatCurrency(parseFloat(order.final_amount || order.total_amount || 0) )}</span>
      <span style={styles.orderDate}>{formatDate(order.created_at)}</span>
    </div>
    {(detailed || order.item_count) && (
      <div style={styles.orderItems}>{order.item_count || order.items?.length || 0} عناصر</div>
    )}
  </div>
);

const OrderApprovalCard = ({ order, onApprove, onReject, onViewClient }) => {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const formatDeliveryDate = (date) => {
    if (!date) return 'غير محدد';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'غير محدد';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getFeedTypeName = (item) => {
    return item.feed_type_name || item.feedTypeName || item.feed_type_id || item.feedTypeId || '—';
  };

  const getBags = (item) => {
    const qtyKg = parseFloat(item.quantity_tons || item.quantityTons || item.quantity || 0) * 1000;
    const pkg = parseInt(item.package_size || item.packageSize || 50);
    if (!qtyKg || !pkg) return 0;
    return Math.ceil(qtyKg / pkg);
  };

  return (
    <div style={styles.approvalCard}>
      <div style={styles.approvalInfo}>
        <span style={styles.approvalOrder}>{order.order_number}</span>
        <button
          onClick={onViewClient}
          style={{ background: 'none', border: 'none', color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', padding: 0, flex: 1, textAlign: 'right' }}
        >
          {order.client_name}
        </button>
        <span style={styles.approvalAmount}>{formatCurrency(parseFloat(order.final_amount || order.total_amount || 0) )}</span>
      </div>

      {/* Delivery Date */}
      <div style={{ marginBottom: '10px', fontSize: '13px', color: '#374151' }}>
        <span style={{ fontWeight: 600 }}>تاريخ التسليم: </span>
        <span>{formatDeliveryDate(order.delivery_date || order.deliveryDate)}</span>
      </div>

      {/* Items List */}
      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>العناصر المطلوبة:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {order.items.map((item, idx) => {
              const qtyTons = parseFloat(item.quantity_tons || item.quantityTons || item.quantity || 0);
              const pkgSize = parseInt(item.package_size || item.packageSize || 50);
              const bags = getBags(item);
              return (
                <div key={idx} style={{ fontSize: '13px', color: '#4b5563', paddingRight: '12px' }}>
                  • {getFeedTypeName(item)} — {qtyTons} طن × {pkgSize} كجم = {bags} كيس
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showRejectReason ? (
        <div style={styles.rejectForm}>
          <input
            type="text"
            placeholder="سبب الرفض"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={styles.rejectInput}
          />
          <div style={styles.rejectActions}>
            <button onClick={() => setShowRejectReason(false)} style={styles.cancelBtn}>{t('common.cancel')}</button>
            <button
              onClick={() => { onReject(rejectReason); setShowRejectReason(false); }}
              style={styles.confirmRejectBtn}
              disabled={!rejectReason}
            >
              تأكيد الرفض
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.approvalActions}>
          <button onClick={() => setShowRejectReason(true)} style={styles.rejectBtn}>
            <XCircle size={16} /> رفض
          </button>
          <button onClick={onApprove} style={styles.approveBtn}>
            <CheckCircle size={16} /> موافقة
          </button>
        </div>
      )}
    </div>
  );
};

const InvoiceCard = ({ invoice }) => (
  <div style={styles.invoiceCard}>
    <div style={styles.invoiceHeader}>
      <span style={styles.invoiceNumber}>{invoice.invoice_number}</span>
      <InvoiceStatusBadge status={invoice.status} />
    </div>
    <div style={styles.invoiceDetails}>
      <span style={styles.invoiceClient}>{invoice.client_name}</span>
      <span style={styles.invoiceAmount}>{formatCurrency(parseFloat(invoice.amount || 0) )}</span>
    </div>
    <div style={styles.invoiceBalance}>
      الرصيد المستحق: <strong>{formatCurrency(parseFloat(invoice.balance_due || 0) )}</strong>
    </div>
    <div style={{ marginTop: '8px' }}>
      <button className="btn btn-sm" onClick={() => {
        const msg = `Invoice ${invoice.invoice_number}: ${formatCurrency(parseFloat(invoice.amount || 0))} - Due: ${formatDate(invoice.due_date)}`;
        window.open(`https://wa.me/${invoice.client_phone || ''}?text=${encodeURIComponent(msg)}`, '_blank');
      }} style={{ background: '#25D366', color: 'white', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer' }}>
        <MessageCircle size={14} style={{ marginRight: '4px' }} /> واتساب
      </button>
    </div>
  </div>
);

const ReminderCard = ({ reminder, detailed }) => (
  <div style={styles.reminderCard}>
    <div style={styles.reminderHeader}>
      <Bell size={16} color={getReminderTypeColor(reminder.reminder_type)} />
      <span style={styles.reminderTitle}>{reminder.title}</span>
      <ReminderStatusBadge status={reminder.status} />
    </div>
    <div style={styles.reminderDetails}>
      <span style={styles.reminderClient}>{reminder.client_name}</span>
      <span style={styles.reminderDate}>
        {formatNumber(new Date(reminder.reminder_date))}
      </span>
    </div>
    {detailed && reminder.message && (
      <p style={styles.reminderMessage}>{reminder.message}</p>
    )}
  </div>
);

const ClientDetailModal = ({ client, detailData, onClose, onAddOrder, onAddPayment, onAddReminder, onViewOrder, isManager, allowedTabs }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const isLoading = !detailData;
  
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.clientDetailModal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>{client.name_arabic}</h2>
          <button onClick={onClose} style={styles.closeBtn}><X size={24} /></button>
        </div>
        
        {/* Loading State */}
        {isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <RefreshCw size={32} className="spin" />
            <p style={{ marginTop: '12px' }}>جاري تحميل بيانات العميل...</p>
          </div>
        )}
        
        {/* Client Summary */}
        {!isLoading && (
        <>
        <div style={styles.clientSummary}>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>{t('sales.dueAmount')}</span>
            <span style={{...styles.summaryValue, color: '#ef4444'}}>
              {formatCurrency(parseFloat(detailData?.financialSummary?.total_due || 0) )}
            </span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>{t('orders.totalOrders')}</span>
            <span style={styles.summaryValue}>{detailData?.orders?.length || 0}</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={styles.summaryLabel}>{t('common.status')}</span>
            <span style={styles.summaryValue}>{getStatusLabel(client.status)}</span>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div style={styles.clientActions}>
          <button onClick={onAddOrder} style={styles.actionBtn}>
            <ShoppingCart size={16} /> طلب جديد
          </button>
          <button onClick={onAddPayment} style={styles.actionBtn}>
            <CreditCard size={16} /> تسجيل دفعة
          </button>
          <button onClick={onAddReminder} style={styles.actionBtn}>
            <Bell size={16} /> إضافة تذكير
          </button>
        </div>
        
        {/* Tabs */}
        <div style={styles.detailTabs}>
          {(['overview', 'orders', 'invoices', 'payments', 'reminders']
            .filter(tab => !allowedTabs || allowedTabs.includes(tab))).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{...styles.detailTab, ...(activeTab === tab ? styles.detailTabActive : {})}}
            >
              {({'overview':'نظرة عامة','orders':'الطلبات','invoices':'الخصومات','payments':'المدفوعات','reminders':'التذكيرات'}[tab] || tab)}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div style={styles.detailContent}>
          {activeTab === 'overview' && (
            <div style={styles.overviewTab}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>الكود:</span>
                <span style={styles.infoValue}>{client.code}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>النوع:</span>
                <span style={styles.infoValue}>{client.type}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>الهاتف:</span>
                <span style={styles.infoValue}>{client.phone || 'غير متاح'}</span>
                {client.phone && (
                  <button
                    onClick={() => {
                      const url = `https://wa.me/${client.phone.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم')}`;
                      window.open(url, '_blank');
                    }}
                    style={styles.whatsappBtn}
                    title="Send WhatsApp"
                  >
                    <MessageCircle size={16} />
                  </button>
                )}
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>البريد الإلكتروني:</span>
                <span style={styles.infoValue}>{client.email || 'غير متاح'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>العنوان:</span>
                <span style={styles.infoValue}>{client.address || 'غير متاح'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>حد الائتمان:</span>
                <span style={styles.infoValue}>{formatCurrency(parseFloat(client.credit_limit || 0) )}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>شروط الدفع:</span>
                <span style={styles.infoValue}>{client.payment_terms || 'غير متاح'}</span>
              </div>
              {client.assigned_to_name && (
                <div style={styles.infoRow}>
                  <span style={styles.infoLabel}>مسند إلى:</span>
                  <span style={styles.infoValue}>{client.assigned_to_name}</span>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'orders' && (
            <div style={styles.listTab}>
              {detailData?.orders?.map(order => (
                <OrderCard key={order.id} order={order} onClick={() => onViewOrder && onViewOrder(order)} />
              )) || <p>{t('sales.noOrders')}</p>}
            </div>
          )}
          
          {activeTab === 'invoices' && (
            <div style={styles.listTab}>
              {detailData?.invoices?.map(invoice => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              )) || <p>{t('sales.noInvoices')}</p>}
            </div>
          )}
          
          {activeTab === 'payments' && (
            <div style={styles.listTab}>
              {detailData?.payments?.map(payment => (
                  <div key={payment.id} style={styles.paymentRow}>
                    <span>{formatDate(payment.date)}</span>
                    <span>{formatCurrency(parseFloat(payment.amount) )}</span>
                  <span style={{textTransform: 'capitalize'}}>{payment.method}</span>
                </div>
              )) || <p>{t('sales.noPayments')}</p>}
            </div>
          )}
          
          {activeTab === 'reminders' && (
            <div style={styles.listTab}>
              {detailData?.reminders?.map(reminder => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              )) || <p>{t('sales.noReminders')}</p>}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
};

const OrderStatusBadge = ({ status }) => {
  const colors = {
    pending_approval: '#f59e0b',
    approved: '#3b82f6',
    confirmed: '#10b981',
    processing: '#8b5cf6',
    ready_for_delivery: '#0ea5e9',
    in_transit: '#6366f1',
    delivered: '#10b981',
    rejected: '#ef4444',
    cancelled: '#6b7280'
  };
  const labels = {
    pending_approval: t('common.statuses.pending_approval'),
    approved: t('common.statuses.approved'),
    confirmed: t('common.statuses.confirmed'),
    processing: t('common.statuses.processing'),
    ready_for_delivery: t('orders.readyForDelivery'),
    in_transit: t('orders.in_transit'),
    delivered: t('common.statuses.delivered'),
    rejected: t('common.statuses.cancelled'),
    cancelled: t('common.statuses.cancelled')
  };

  return (
    <span style={{...styles.statusBadge, backgroundColor: `${colors[status] || '#6b7280'}20`, color: colors[status] || '#6b7280'}}>
      {labels[status] || status}
    </span>
  );
};

const InvoiceStatusBadge = ({ status }) => {
  const colors = {
    pending: '#f59e0b',
    partial: '#3b82f6',
    paid: '#10b981',
    overdue: '#ef4444',
    cancelled: '#6b7280'
  };
  
  return (
    <span style={{...styles.statusBadge, backgroundColor: `${colors[status] || '#6b7280'}20`, color: colors[status] || '#6b7280'}}>
      {getStatusLabel(status)}
    </span>
  );
};

const PaymentStatusBadge = ({ status }) => {
  const colors = {
    pending: '#f59e0b',
    partial: '#3b82f6',
    paid: '#10b981',
    overdue: '#ef4444',
    cancelled: '#6b7280'
  };
  
  return (
    <span style={{...styles.statusBadge, backgroundColor: `${colors[status] || '#6b7280'}20`, color: colors[status] || '#6b7280'}}>
      {getStatusLabel(status)}
    </span>
  );
};

const ReminderStatusBadge = ({ status }) => {
  const colors = {
    pending: '#f59e0b',
    sent: '#3b82f6',
    completed: '#10b981',
    cancelled: '#6b7280'
  };
  
  return (
    <span style={{...styles.statusBadge, backgroundColor: `${colors[status] || '#6b7280'}20`, color: colors[status] || '#6b7280'}}>
      {getStatusLabel(status)}
    </span>
  );
};

// Helper functions
const getTypeColor = (type) => {
  const colors = {
    wholesale: '#dbeafe',
    retail: '#d1fae5',
    distributor: '#fef3c7',
    farm: '#fce7f3'
  };
  return colors[type] || '#f3f4f6';
};

const getReminderTypeColor = (type) => {
  const colors = {
    payment: '#10b981',
    follow_up: '#3b82f6',
    order: '#f59e0b',
    visit: '#8b5cf6',
    call: '#ec4899',
    other: '#6b7280'
  };
  return colors[type] || '#6b7280';
};

// Styles
const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
    margin: 0
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '4px'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  roleBadge: {
    padding: '6px 12px',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'capitalize'
  },
  userName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '12px'
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    backgroundColor: '#eff6ff',
    color: '#1d4ed8'
  },
  content: {
    minHeight: '400px'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#6b7280'
  },
  dashboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  statIcon: {
    padding: '12px',
    borderRadius: '10px'
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827'
  },
  statTitle: {
    fontSize: '14px',
    color: '#6b7280'
  },
  statTrend: {
    fontSize: '12px',
    color: '#10b981',
    marginTop: '4px'
  },
  approvalAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    backgroundColor: '#fef3c7',
    borderRadius: '10px',
    color: '#92400e'
  },
  viewBtn: {
    marginLeft: 'auto',
    padding: '6px 12px',
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500
  },
  quickActions: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 16px 0'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px'
  },
  quickActionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: 'white',
    border: '2px solid',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  quickActionTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151'
  },
  section: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  seeAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '13px',
    cursor: 'pointer'
  },
  ordersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  orderCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px'
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  orderNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827'
  },
  orderClient: {
    fontSize: '13px',
    color: '#6b7280',
    marginLeft: '8px'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'capitalize'
  },
  orderDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  orderAmount: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827'
  },
  orderDate: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  orderItems: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px'
  },
  remindersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  reminderCard: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  reminderHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  reminderTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
    flex: 1
  },
  reminderDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6b7280'
  },
  reminderMessage: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid #e5e7eb'
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center',
    color: '#9ca3af'
  },
  tabContent: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  tabTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  countBadge: {
    padding: '4px 10px',
    backgroundColor: '#e5e7eb',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    width: '300px'
  },
  searchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: '14px',
    width: '100%'
  },
  clientsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px'
  },
  clientCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white'
  },
  clientHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  clientAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 600
  },
  clientInfo: {
    flex: 1
  },
  clientName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#111827',
    margin: 0
  },
  clientCode: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  clientType: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 500,
    textTransform: 'capitalize'
  },
  clientStats: {
    display: 'flex',
    gap: '24px',
    marginBottom: '12px'
  },
  clientStat: {
    display: 'flex',
    flexDirection: 'column'
  },
  statLabel: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  clientContact: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#6b7280'
  },
  whatsappBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#25D366',
    color: '#fff',
    cursor: 'pointer',
    marginLeft: '4px',
    flexShrink: 0
  },
  emptyStateFull: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    color: '#9ca3af',
    gap: '16px'
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500
  },
  pendingSection: {
    marginBottom: '24px'
  },
  subSectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '12px'
  },
  ordersSection: {
    marginBottom: '24px'
  },
  approvalCard: {
    padding: '16px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: '10px',
    marginBottom: '12px'
  },
  approvalInfo: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '12px'
  },
  approvalOrder: {
    fontWeight: 600,
    color: '#111827'
  },
  approvalClient: {
    color: '#6b7280',
    flex: 1
  },
  approvalAmount: {
    fontWeight: 600,
    color: '#111827'
  },
  approvalActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  approveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  rejectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'white',
    color: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  rejectForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  rejectInput: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px'
  },
  rejectActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  cancelBtn: {
    padding: '6px 12px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  confirmRejectBtn: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  invoicesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  invoiceCard: {
    padding: '16px',
    border: '1px solid #e5e7eb',
    borderRadius: '10px'
  },
  invoiceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  invoiceNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827'
  },
  invoiceDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  invoiceClient: {
    fontSize: '13px',
    color: '#6b7280'
  },
  invoiceAmount: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827'
  },
  invoiceBalance: {
    fontSize: '13px',
    color: '#6b7280',
    paddingTop: '8px',
    borderTop: '1px solid #e5e7eb'
  },
  modalOverlay: {
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
  },
  clientDetailModal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#6b7280'
  },
  clientSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '16px',
    padding: '20px 24px',
    backgroundColor: '#f9fafb'
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '4px'
  },
  summaryValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827'
  },
  clientActions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500
  },
  detailTabs: {
    display: 'flex',
    gap: '4px',
    padding: '0 24px',
    borderBottom: '1px solid #e5e7eb'
  },
  detailTab: {
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  detailTabActive: {
    color: '#1d4ed8',
    borderBottomColor: '#1d4ed8'
  },
  detailContent: {
    padding: '20px 24px'
  },
  overviewTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid #f3f4f6'
  },
  infoLabel: {
    fontSize: '14px',
    color: '#6b7280'
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827'
  },
  listTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  paymentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    fontSize: '14px'
  }
};

export default Sales;