import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  Users, ShoppingCart, FileText, CreditCard, Bell, TrendingUp,
  DollarSign, Package, Search, Phone, MapPin, AlertTriangle,
  CheckCircle, Clock, Calendar, MessageSquare, Plus, X,
  ChevronRight, TrendingDown, Star, Filter, ArrowUpRight
} from 'lucide-react';
import { salesService, authService, feedTypesService } from '../services/api';
import PaymentModal from '../components/PaymentModal';
import ReminderModal from '../components/ReminderModal';

const SalesRep = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientDetail, setShowClientDetail] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showInvoiceRequestModal, setShowInvoiceRequestModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [feedTypes, setFeedTypes] = useState([]);
  const [orderItems, setOrderItems] = useState([{ feedTypeId: '', packageSize: 50, quantity: 1, unitPrice: 0 }]);
  const [orderClientId, setOrderClientId] = useState('');
  const [orderDeliveryDate, setOrderDeliveryDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [redFlags, setRedFlags] = useState([]);
  const [patterns, setPatterns] = useState({});

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, clientsRes, ordersRes, invoicesRes, remindersRes, flagsRes, patternsRes, feedTypesRes] = await Promise.all([
        salesService.getDashboardStats(),
        salesService.getMyClients(),
        salesService.getOrders(),
        salesService.getInvoices(),
        salesService.getReminders(),
        salesService.getRedFlags?.().catch(() => ({ success: false, redFlags: [] })),
        salesService.getClientPatterns?.().catch(() => ({ success: false, patterns: {} })),
        feedTypesService.getFeedTypes().catch(() => ({ success: false, feedTypes: [] }))
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (clientsRes.success) setClients(clientsRes.clients);
      if (ordersRes.success) setOrders(ordersRes.orders);
      if (invoicesRes.success) setInvoices(invoicesRes.invoices);
      if (remindersRes.success) setReminders(remindersRes.reminders);
      if (flagsRes.success) setRedFlags(flagsRes.redFlags || []);
      if (patternsRes.success) setPatterns(patternsRes.patterns || {});
      if (feedTypesRes.success) setFeedTypes(feedTypesRes.feedTypes || []);
    } catch (error) {
      console.error('Error fetching sales rep data:', error);
    } finally {
      setLoading(false);
    }
  };

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
      if (result.success) fetchAllData();
      return result;
    } catch (error) {
      console.error('Payment submission error:', error);
      return { success: false, error: error.message };
    }
  };

  const handleReminderSubmit = async (formData) => {
    try {
      const result = await salesService.createReminder({
        clientId: parseInt(formData.clientId),
        title: formData.title,
        message: formData.message,
        reminderDate: formData.reminderDate,
        reminderType: formData.reminderType
      });
      if (result.success) fetchAllData();
      return result;
    } catch (error) {
      console.error('Reminder submission error:', error);
      return { success: false, error: error.message };
    }
  };

  const handleInvoiceRequest = async (formData) => {
    try {
      // Create a reminder for the manager to create an invoice
      const result = await salesService.createReminder({
        clientId: parseInt(formData.clientId),
        title: `Invoice Request: ${formData.orderNumber}`,
        message: `Sales rep ${user?.name} requested invoice for order ${formData.orderNumber}. Amount: ${formData.amount} EGP. Notes: ${formData.notes || ''}`,
        reminderDate: new Date().toISOString(),
        reminderType: 'other'
      });
      if (result.success) {
        fetchAllData();
        setShowInvoiceRequestModal(false);
      }
      return result;
    } catch (error) {
      console.error('Invoice request error:', error);
      return { success: false, error: error.message };
    }
  };

  const handleCreateOrder = async () => {
    const items = orderItems
      .filter(item => item.feedTypeId && item.quantity > 0)
      .map(item => ({
        feedTypeId: parseInt(item.feedTypeId),
        packageSize: parseInt(item.packageSize),
        quantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.unitPrice)
      }));

    if (items.length === 0) {
      return { success: false, error: 'Please add at least one item' };
    }

    setOrderSubmitting(true);
    const result = await salesService.createOrder({
      clientId: parseInt(orderClientId),
      items,
      deliveryDate: orderDeliveryDate,
      notes: orderNotes
    });
    setOrderSubmitting(false);

    if (result.success) {
      fetchAllData();
      setShowCreateOrderModal(false);
      setOrderItems([{ feedTypeId: '', packageSize: 50, quantity: 1, unitPrice: 0 }]);
      setOrderClientId('');
      setOrderDeliveryDate('');
      setOrderNotes('');
    }
    return result;
  };

  const filteredClients = clients.filter(c =>
    c.name_arabic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name_english?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getClientOrders = (clientId) => orders.filter(o => o.client_id === clientId || o.clientId === clientId);
  const getClientInvoices = (clientId) => invoices.filter(i => i.client_id === clientId || i.clientId === clientId);
  const getClientPattern = (clientId) => patterns[clientId] || null;

  const getPaymentStatusColor = (client) => {
    const balance = parseFloat(client.current_balance || 0);
    const creditLimit = parseFloat(client.credit_limit || 0);
    if (balance >= creditLimit * 0.9) return '#ef4444';
    if (balance >= creditLimit * 0.7) return '#f59e0b';
    return '#10b981';
  };

  const getPaymentStatusLabel = (client) => {
    const balance = parseFloat(client.current_balance || 0);
    const creditLimit = parseFloat(client.credit_limit || 0);
    if (balance >= creditLimit * 0.9) return 'Critical';
    if (balance >= creditLimit * 0.7) return 'Warning';
    return 'Healthy';
  };

  // Render Dashboard
  const renderDashboard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard title={t('sales.myClients')} value={stats?.totalClients || clients.length} icon={Users} color="#3b82f6" />
        <StatCard title={t('sales.myOrders')} value={stats?.totalOrders || orders.length} icon={ShoppingCart} color="#10b981" />
        <StatCard title={t('common.totalDue')} value={`ج.م ${((stats?.totalDue || 0) ).toLocaleString()}`} icon={DollarSign} color="#ef4444" />
        <StatCard title={t('sales.upcomingReminders')} value={stats?.upcomingReminders || reminders.filter(r => r.status === 'pending').length} icon={Bell} color="#8b5cf6" />
      </div>

      {/* Red Flags */}
      {redFlags.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
            <AlertTriangle size={20} /> Red Flags / تنبيهات عاجلة ({redFlags.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {redFlags.slice(0, 5).map((flag, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'white', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: flag.severity === 'critical' ? '#ef4444' : '#f59e0b' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{flag.clientName}</span>
                  <span style={{ color: '#6b7280', marginLeft: '8px' }}>{flag.message}</span>
                </div>
                <button
                  onClick={() => {
                    const client = clients.find(c => c.id === flag.clientId);
                    if (client) { setSelectedClient(client); setShowClientDetail(true); }
                  }}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}
                >
                  عرض
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Clients */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={20} /> My Clients / عملائي
          </h3>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '250px' }}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filteredClients.map(client => {
            const clientOrders = getClientOrders(client.id);
            const clientInvoices = getClientInvoices(client.id);
            const pattern = getClientPattern(client.id);
            const statusColor = getPaymentStatusColor(client);
            const statusLabel = getPaymentStatusLabel(client);
            const dueAmount = parseFloat(client.current_balance || 0);

            return (
              <div key={client.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{client.name_arabic}</h4>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{client.code} | {client.city || 'No city'}</span>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500, background: statusColor + '15', color: statusColor }}>
                    {statusLabel}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ background: '#f9fafb', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{t('sales.dueAmount')}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: dueAmount > 0 ? '#ef4444' : '#10b981' }}>
                        {formatCurrency(dueAmount )}
                    </div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{t('orders.title')}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{clientOrders.length}</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{t('finance.invoices')}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{clientInvoices.length}</div>
                  </div>
                  <div style={{ background: '#f9fafb', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{t('sales.paymentTerms')}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{client.payment_terms || 'N/A'}</div>
                  </div>
                </div>

                {pattern && (
                  <div style={{ background: '#eff6ff', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' }}>
                    <Star size={14} style={{ color: '#3b82f6', verticalAlign: 'middle', marginRight: '4px' }} />
                    Usually orders: <strong>{pattern.usualFeedType}</strong> ({pattern.avgQuantity} units)
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setSelectedClient(client); setShowPaymentModal(true); }}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#dbeafe', color: '#1d4ed8', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <CreditCard size={14} /> Payment
                  </button>
                  <button
                    onClick={() => { setSelectedClient(client); setShowReminderModal(true); }}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#fce7f3', color: '#be185d', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Bell size={14} /> Reminder
                  </button>
                  <button
                    onClick={() => { setSelectedClient(client); setShowClientDetail(true); }}
                    style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#f3f4f6', color: '#374151', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <ChevronRight size={14} /> Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Render Orders
  const renderOrders = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ShoppingCart size={20} /> My Orders
        </h3>
        <button
          onClick={() => { setSelectedClient(null); setShowCreateOrderModal(true); }}
          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} /> New Order
        </button>
      </div>
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          <ShoppingCart size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p>{t('sales.noOrders')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map(order => (
            <div key={order.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{order.order_number}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {order.client_name} | {order.status}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(order.final_amount || 0) )}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : ''}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render Reminders
  const renderReminders = () => (
    <div>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Bell size={20} /> My Reminders
      </h3>
      {reminders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          <Bell size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
          <p>{t('sales.noReminders')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {reminders.map(reminder => (
            <div key={reminder.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{reminder.title}</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  {reminder.client_name} | {reminder.reminder_type}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', background: reminder.status === 'pending' ? '#fef3c7' : '#d1fae5', color: reminder.status === 'pending' ? '#92400e' : '#065f46' }}>
                  {reminder.status}
                </span>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  {new Date(reminder.reminder_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Client Detail Modal
  const renderClientDetail = () => {
    if (!selectedClient) return null;
    const clientOrders = getClientOrders(selectedClient.id);
    const clientInvoices = getClientInvoices(selectedClient.id);
    const pattern = getClientPattern(selectedClient.id);

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ margin: 0 }}>{selectedClient.name_arabic}</h2>
            <button onClick={() => setShowClientDetail(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('common.code')}</div><div style={{ fontWeight: 600 }}>{selectedClient.code}</div></div>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('common.city')}</div><div style={{ fontWeight: 600 }}>{selectedClient.city || 'N/A'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('common.phone')}</div><div style={{ fontWeight: 600 }}>{selectedClient.phone || 'N/A'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('sales.paymentTerms')}</div><div style={{ fontWeight: 600 }}>{selectedClient.payment_terms || 'N/A'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('clients.creditLimit')}</div><div style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(selectedClient.credit_limit || 0) )}</div></div>
              <div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t('clients.currentBalance')}</div><div style={{ fontWeight: 600, color: parseFloat(selectedClient.current_balance || 0) > 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(parseFloat(selectedClient.current_balance || 0) )}</div></div>
              <div style={{ fontSize: '13px' }}>Average order value: <strong>{formatCurrency((pattern.avgOrderValue || 0) )}</strong></div>
                <div style={{ fontSize: '13px' }}>Last order: <strong>{pattern.lastOrderDate ? new Date(pattern.lastOrderDate).toLocaleDateString() : 'N/A'}</strong></div>
              </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button onClick={() => { setShowClientDetail(false); setShowPaymentModal(true); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CreditCard size={16} /> Record Payment
              </button>
              <button onClick={() => { setShowClientDetail(false); setShowReminderModal(true); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#ec4899', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Bell size={16} /> Add Reminder
              </button>
              <button onClick={() => { setShowClientDetail(false); setShowInvoiceRequestModal(true); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <FileText size={16} /> Request Invoice
              </button>
            </div>

            <h4 style={{ margin: '0 0 12px 0' }}>Recent Orders ({clientOrders.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {clientOrders.length > 0 ? clientOrders.slice(0, 5).map(order => (
                <div key={order.id} style={{ padding: '10px', background: '#f9fafb', borderRadius: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{order.order_number}</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(order.final_amount || 0) )}</span>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>{t('sales.noRecentOrders')}</div>
              )}
          </div>
          </div>
        </div>
      </div>
    );
  };

  // Invoice Request Modal
  const renderInvoiceRequestModal = () => {
    if (!showInvoiceRequestModal) return null;
    const clientOrders = selectedClient ? getClientOrders(selectedClient.id).filter(o => o.status === 'delivered' || o.status === 'approved') : [];

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={24} color="#f59e0b" /> Request Invoice</h2>
            <button onClick={() => setShowInvoiceRequestModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            handleInvoiceRequest({
              clientId: selectedClient?.id,
              orderNumber: formData.get('orderNumber'),
              amount: formData.get('amount'),
              notes: formData.get('notes')
            });
          }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('common.client')}</label>
              <input type="text" value={selectedClient?.name_arabic || ''} disabled style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f3f4f6' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('orders.order')} <span style={{ color: '#ef4444' }}>*</span></label>
              <select name="orderNumber" required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <option value="">اختر الطلب</option>
                {clientOrders.map(o => (
                  <option key={o.id} value={o.order_number}>{o.order_number} - {formatCurrency(parseFloat(o.final_amount || 0) )}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Amount ({t('common.currency')}) <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="number"
                name="amount"
                required
                min="0.01"
                step="0.01"
                placeholder="Enter invoice amount"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('common.notes')}</label>
              <textarea name="notes" rows={3} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} placeholder="Any special instructions..." />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setShowInvoiceRequestModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button type="submit" style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontWeight: 500 }}>إرسال الطلب</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Create Order Modal
  const renderCreateOrderModal = () => {
    if (!showCreateOrderModal) return null;

    const addItem = () => {
      setOrderItems([...orderItems, { feedTypeId: '', packageSize: 50, quantity: 1, unitPrice: 0 }]);
    };

    const removeItem = (index) => {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const updateItem = (index, field, value) => {
      const newItems = [...orderItems];
      newItems[index][field] = value;
      setOrderItems(newItems);
    };

    const onSubmit = async (e) => {
      e.preventDefault();
      const result = await handleCreateOrder();
      if (!result.success) {
        alert(result.error || 'Failed to create order');
      }
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Plus size={24} color="#3b82f6" /> New Order</h2>
            <button onClick={() => setShowCreateOrderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
          </div>
          <form onSubmit={onSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>Client *</label>
              <select value={orderClientId} onChange={(e) => setOrderClientId(e.target.value)} required style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <option value="">اختر العميل</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name_arabic} ({c.code})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('orders.deliveryDate')}</label>
                <input type="date" value={orderDeliveryDate} onChange={(e) => setOrderDeliveryDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{t('common.notes')}</label>
                <input type="text" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Optional notes..." style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' }} />
              </div>
            </div>

            <h4 style={{ margin: '0 0 12px 0' }}>عناصر الطلب</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {orderItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'center', background: '#f9fafb', padding: '10px', borderRadius: '8px' }}>
                  <select value={item.feedTypeId} onChange={(e) => updateItem(index, 'feedTypeId', e.target.value)} required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value="">اختر العلف</option>
                    {feedTypes.map(ft => (
                      <option key={ft.id} value={ft.id}>{ft.name_arabic || ft.name}</option>
                    ))}
                  </select>
                  <select value={item.packageSize} onChange={(e) => updateItem(index, 'packageSize', e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                    <option value={50}>50kg</option>
                    <option value={25}>25kg</option>
                    <option value={10}>10kg</option>
                  </select>
                  <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} placeholder="Bags" required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} placeholder="Price/bag" required style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                  {orderItems.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={18} /></button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} style={{ marginBottom: '16px', padding: '8px 16px', borderRadius: '8px', border: '1px dashed #3b82f6', background: 'white', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> Add Item
            </button>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setShowCreateOrderModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button type="submit" disabled={orderSubmitting} style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
                {orderSubmitting ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Users size={28} color="#3b82f6" />
          Sales Rep Portal / بوابة مندوب المبيعات
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>Welcome back, {user?.name || 'Sales Rep'}</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '1px' }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'orders', label: t('sales.myOrders'), icon: ShoppingCart },
          { id: 'reminders', label: 'Reminders', icon: Bell }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab.id ? '#eff6ff' : 'transparent',
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'orders' && renderOrders()}
      {activeTab === 'reminders' && renderReminders()}

      {/* Modals */}
      {showClientDetail && renderClientDetail()}
      {renderInvoiceRequestModal()}
      {renderCreateOrderModal()}

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePaymentSubmit}
        clients={selectedClient ? [selectedClient] : clients}
        preselectedClient={selectedClient}
        invoices={invoices}
      />

      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSubmit={handleReminderSubmit}
        clients={selectedClient ? [selectedClient] : clients}
        preselectedClient={selectedClient}
      />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: '13px', color: '#6b7280' }}>{title}</div>
    </div>
  </div>
);

export default SalesRep;
