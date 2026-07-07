import React, { useState, useEffect } from 'react';
import { t } from '../utils/i18n';
import { formatCurrency, formatDate } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, Filter, Phone, Mail, MapPin, 
  FileText, DollarSign, Clock, Edit, Trash2, 
  ChevronRight, X, Package, Truck, CreditCard, ShoppingCart,
  Wallet, AlertTriangle, CheckSquare, Camera, Receipt,
  TrendingDown
} from 'lucide-react';
import ClientLiabilities from '../components/ClientLiabilities';
import DocumentUpload from '../components/DocumentUpload';

// API Base
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const EGYPT_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر',
  'البحيرة', 'الفيوم', 'الغربية', 'الإسماعيلية', 'المنوفية',
  'المنيا', 'القليوبية', 'الوادي الجديد', 'السويس', 'أسوان',
  'أسيوط', 'بني سويف', 'بورسعيد', 'دمياط', 'الشرقية',
  'جنوب سيناء', 'كفر الشيخ', 'مطروح', 'الأقصر', 'قنا',
  'شمال سيناء', 'سوهاج'
];

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientStats, setClientStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    paymentMethod: 'cash',
    referenceNumber: '',
    notes: '',
    storageLocation: '',
    applyTo: 'auto',
    selectedInvoices: [],
    receiptPhoto: null
  });
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_english: '',
    name_arabic: '',
    phone: '',
    contactPerson: '',
    email: '',
    address: '',
    city: '',
    category: 'farm',
    paymentType: 'cash',
    creditPeriod: 0,
    creditLimit: 0,
    discount: 0,
    licenseNumber: '',
    avgConsumption: '',
    favoriteFeedType: '',
    notes: '',
    storageLocation: ''
  });
  const [feedTypes, setFeedTypes] = useState([]);
  const [createdClientId, setCreatedClientId] = useState(null);
  const [creationStep, setCreationStep] = useState('form'); // 'form' | 'documents' | 'done'
  const [formErrors, setFormErrors] = useState({});

  // Client detail tabs
  const [clientDetailTab, setClientDetailTab] = useState('overview');

  // Delete confirmation modal state
  const [clientDeleteTarget, setClientDeleteTarget] = useState(null);
  const [clientDeleteConfirmText, setClientDeleteConfirmText] = useState('');
  const [clientDeleteLoading, setClientDeleteLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = currentUser.role === 'owner';

  useEffect(() => {
    fetchStats();
    fetchFeedTypes();
  }, []);

  useEffect(() => {
    fetchClients();
  }, [search, category, status, page]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('type', category); // PostgreSQL uses 'type' not 'category'
      if (status) params.append('status', status);
      params.append('page', page);
      params.append('limit', 20);

      const response = await fetch(`${API_URL}/clients?${params}`, { headers: headers() });
      const data = await response.json();

      // PostgreSQL returns { clients: [], total, page, pages }
      let clientsData = data.clients || [];

      // Map PostgreSQL field names to component expectations
      clientsData = clientsData.map(c => ({
        ...c,
        _id: c.id,
        name: c.name_arabic || c.name_english || c.name,
        category: c.type || c.category, // PostgreSQL uses 'type'
        currentCredit: parseFloat(c.current_balance || 0),
        creditLimit: parseFloat(c.credit_limit || 0),
        creditPeriod: c.payment_terms ? parseInt(c.payment_terms.replace(/[^0-9]/g, '')) || 0 : 0,
        paymentType: c.payment_terms === 'cash' ? 'cash' : (c.payment_terms ? 'credit' : 'cash'),
        assignedTo: c.assigned_to || c.assignedTo || null
      }));

      setClients(clientsData);
      setTotalPages(data.pages || 1);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/clients/dashboard`, { headers: headers() });
      const data = await response.json();
      // Map PostgreSQL stats to component format
      const mappedStats = data?.total_clients ? {
        total: data.total_clients,
        byCategory: [
          { _id: 'wholesale', count: data.wholesale_count || 0 },
          { _id: 'retail', count: data.retail_count || 0 },
          { _id: 'farm', count: data.farm_count || 0 },
          { _id: 'distributor', count: data.distributor_count || 0 }
        ]
      } : null;
      setClientStats(mappedStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setClientStats(null);
    }
  };

  const fetchFeedTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/feed-types`, { headers: headers() });
      const data = await response.json();
      setFeedTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching feed types:', error);
      setFeedTypes([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name_arabic.trim()) errors.name_arabic = 'اسم العميل مطلوب';
    if (!formData.category) errors.category = 'فئة العميل مطلوبة';
    if (!formData.phone.trim()) errors.phone = 'رقم الهاتف مطلوب';
    if (!formData.address.trim()) errors.address = 'العنوان مطلوب';
    if (!formData.city.trim()) errors.city = 'المحافظة مطلوبة';
    if (!formData.contactPerson.trim()) errors.contactPerson = 'الشخص المسؤول مطلوب';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    try {
      // Build payload mapping frontend field names to backend expectations
      const payload = {
        name_english: formData.name_arabic,
        name_arabic: formData.name_arabic,
        type: formData.category, // Backend uses 'type' not 'category'
        payment_terms: formData.paymentType === 'cash' ? 'cash' : `${formData.creditPeriod} days`,
        credit_limit: formData.creditLimit,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        contact_person: formData.contactPerson,
        discount: formData.discount || 0,
        avg_consumption: formData.avgConsumption ? parseFloat(formData.avgConsumption) : 0,
        favorite_feed_type_id: formData.favoriteFeedType ? parseInt(formData.favoriteFeedType) : null,
        license_number: formData.licenseNumber,
        notes: formData.notes,
        storage_location: formData.storageLocation
      };
      const response = await fetch(`${API_URL}/clients`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setCreatedClientId(result.client?.id || result.client?._id);
        setCreationStep('documents');
        fetchClients();
        fetchStats();
      } else {
        alert(result.error || result.message || 'Failed to create client. Please check all required fields.');
      }
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Network error: Failed to create client. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      name_english: '',
      name_arabic: '',
      phone: '',
      contactPerson: '',
      email: '',
      address: '',
      city: '',
      category: 'farm',
      paymentType: 'cash',
      creditPeriod: 0,
      creditLimit: 0,
      discount: 0,
      licenseNumber: '',
      avgConsumption: '',
      favoriteFeedType: '',
      notes: '',
      storageLocation: ''
    });
    setCreatedClientId(null);
    setCreationStep('form');
  };

  const openClientDetail = async (client) => {
    try {
      const response = await fetch(`${API_URL}/clients/${client._id}/account`, { headers: headers() });
      const data = await response.json();
      
      if (data && data.client) {
        // Map backend fields to frontend expectations
        data.client._id = data.client.id || data.client._id;
        data.client.name = data.client.name_arabic || data.client.name_english || data.client.name;
        data.client.currentCredit = parseFloat(data.client.current_balance || 0);
        data.client.creditLimit = parseFloat(data.client.credit_limit || 0);
        data.client.paymentType = data.client.payment_terms === 'cash' ? 'cash' : (data.client.payment_terms ? 'credit' : 'cash');
        data.client.creditPeriod = data.client.payment_terms ? parseInt(data.client.payment_terms.replace(/[^0-9]/g, '')) || 0 : 0;
        data.client.discount = data.client.discount || 0;
        // Ensure liabilities and expectedPayments are arrays from the correct API fields
        data.client.liabilities = (data.liabilities || []).map(l => ({
          ...l,
          _id: l.id || l._id,
          amount: parseFloat(l.amount || 0),
          paidAmount: parseFloat(l.paid_amount || l.paidAmount || 0),
          remainingAmount: parseFloat(l.remaining_amount || l.remainingAmount || l.amount || 0),
          dueDate: l.due_date || l.dueDate,
          date: l.date || l.created_at
        }));
        data.client.expectedPayments = data.expectedPayments || [];
        // Map summary fields from snake_case to camelCase
        if (data.summary) {
          data.summary.totalOrders = parseInt(data.summary.totalOrders || data.summary.total_orders || 0);
          data.summary.totalAmount = parseFloat(data.summary.totalAmount || data.summary.total_amount || 0);
          data.summary.totalPaid = parseFloat(data.summary.totalPaid || data.summary.total_paid || 0);
          data.summary.totalPending = parseFloat(data.summary.totalPending || data.summary.total_pending || 0);
        }
        // Map invoice and payment IDs for selection
        if (data.pendingInvoices) {
          data.pendingInvoices = data.pendingInvoices.map(inv => ({...inv, _id: inv.id || inv._id}));
        }
        if (data.recentPayments) {
          data.recentPayments = data.recentPayments.map(p => ({...p, _id: p.id || p._id}));
        }
        setSelectedClient(data);
      } else {
        setSelectedClient({
          client: { ...client, _id: client._id || client.id, id: client.id || client._id, liabilities: [], expectedPayments: [] },
          summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalPending: 0 },
          pendingInvoices: []
        });
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
      setSelectedClient({
        client: { ...client, _id: client._id || client.id, id: client.id || client._id, liabilities: [], expectedPayments: [] },
        summary: { totalOrders: 0, totalAmount: 0, totalPaid: 0, totalPending: 0 },
        pendingInvoices: []
      });
    }
    setClientDetailTab('overview');
  };

  const closeClientDetail = () => {
    setSelectedClient(null);
    setClientDetailTab('overview');
  };

  const handleDeleteClient = async () => {
    if (!clientDeleteTarget) return;
    setClientDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/clients/${clientDeleteTarget._id || clientDeleteTarget.id}`, {
        method: 'DELETE',
        headers: headers()
      });
      if (res.ok) {
        setClientDeleteTarget(null);
        setClientDeleteConfirmText('');
        fetchClients();
        if (selectedClient && (selectedClient.client._id === clientDeleteTarget._id || selectedClient.client.id === clientDeleteTarget.id)) {
          closeClientDetail();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || err.message || 'فشل حذف العميل');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    } finally {
      setClientDeleteLoading(false);
    }
  };

  const getStatusBadgeClass = (clientStatus) => {
    const classes = {
      active: 'badge badge-success',
      inactive: 'badge',
      blocked: 'badge badge-danger',
      pending: 'badge badge-warning'
    };
    return classes[clientStatus] || classes.active;
  };

  const CREDIT_CLASS_LABELS = { regular: 'أجل منتظم', overdue: 'أجل متأخر', cash: 'كاش' };
  const CREDIT_CLASS_VARIANTS = { cash: 'badge-primary', regular: 'badge-warning', overdue: 'badge-danger' };
  const getCreditClassBadge = (creditClass) => (
    <span className={`badge ${CREDIT_CLASS_VARIANTS[creditClass] || 'badge-warning'}`}>
      {CREDIT_CLASS_LABELS[creditClass] || creditClass || '—'}
    </span>
  );

  // Role-based visibility check
  const canRecordPayment = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const allowedRoles = ['admin', 'finance', 'sales_manager', 'sales_rep', 'owner'];
    return allowedRoles.includes(user.role);
  };

  // Check if user can see payment button for specific client
  const canRecordPaymentForClient = (client) => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (['admin', 'finance', 'sales_manager', 'owner'].includes(user.role)) return true;
    if (user.role === 'sales_rep' && client.assignedTo === user._id) return true;
    return false;
  };

  // Open payment modal
  const openPaymentModal = async () => {
    if (!selectedClient) return;
    
    try {
      setPaymentLoading(true);
      const response = await fetch(`${API_URL}/clients/${selectedClient.client._id || selectedClient.client.id}/payment-summary`, { 
        headers: headers() 
      });
      const data = await response.json();
      
      if (data && data.client) {
        // Map invoice IDs for frontend selection
        if (data.pendingInvoices) {
          data.pendingInvoices = data.pendingInvoices.map(inv => ({...inv, _id: inv.id || inv._id}));
        }
        // Map client credit field
        data.client.currentCredit = parseFloat(data.client.current_balance || 0);
        data.client.creditLimit = parseFloat(data.client.credit_limit || 0);
        data.client._id = data.client._id || data.client.id;
        data.client.id = data.client.id || data.client._id;
        setPaymentSummary(data);
        setShowPaymentModal(true);
      } else {
        setPaymentSummary({
          client: selectedClient.client,
          totalReceivables: selectedClient.summary?.totalPending || 0,
          overdueAmount: 0,
          pendingInvoices: (selectedClient.pendingInvoices || []).map(inv => ({...inv, _id: inv.id || inv._id})),
          recentPayments: []
        });
        setShowPaymentModal(true);
      }
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      setPaymentSummary({
        client: selectedClient.client,
        totalReceivables: selectedClient.summary?.totalPending || 0,
        overdueAmount: 0,
        pendingInvoices: (selectedClient.pendingInvoices || []).map(inv => ({...inv, _id: inv.id || inv._id})),
        recentPayments: []
      });
      setShowPaymentModal(true);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Close payment modal
  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentData({
      amount: '',
      paymentMethod: 'cash',
      referenceNumber: '',
      notes: '',
    storageLocation: '',
      applyTo: 'auto',
      selectedInvoices: [],
      receiptPhoto: null
    });
    setSubmitSuccess(null);
  };

  // Handle invoice selection for payment
  const toggleInvoiceSelection = (invoiceId) => {
    setPaymentData(prev => {
      const selected = prev.selectedInvoices.includes(invoiceId)
        ? prev.selectedInvoices.filter(id => id !== invoiceId)
        : [...prev.selectedInvoices, invoiceId];
      return { ...prev, selectedInvoices: selected };
    });
  };

  // Calculate remaining amount after applying to selected invoices
  const calculateRemaining = () => {
    const amount = parseFloat(paymentData.amount) || 0;
    if (paymentData.applyTo === 'auto') return amount;
    
    const selectedTotal = paymentSummary?.pendingInvoices
      ?.filter(inv => paymentData.selectedInvoices.includes(inv._id))
      ?.reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0;
    
    return Math.max(0, amount - selectedTotal);
  };

  // Handle receipt photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentData(prev => ({ ...prev, receiptPhoto: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit payment
  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedClient || !paymentData.amount) return;
    
    try {
      setPaymentLoading(true);
      const clientId = selectedClient.client._id || selectedClient.client.id;
      
      const payload = {
        amount: parseFloat(paymentData.amount),
        date: new Date().toISOString().split('T')[0],
        paymentMethod: paymentData.paymentMethod,
        description: `Payment received - ${paymentData.referenceNumber || 'No reference'}`,
        notes: paymentData.notes,
      };
      
      const response = await fetch(`${API_URL}/clients/${clientId}/record-payment`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSubmitSuccess(result.receiptNumber);
        // Refresh client data
        setTimeout(() => {
          closePaymentModal();
          openClientDetail(selectedClient.client);
        }, 2000);
      } else {
        alert(result.error || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      alert('Failed to record payment: ' + (error.message || 'Unknown error'));
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('clients.title')}</h1>
          <p>{t('clients.subtitle')}</p>
        </div>
        <button 
          onClick={() => { setFormErrors({}); setShowModal(true); }}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5" />
          {t('clients.addClient')}
        </button>
      </div>

      {/* Stats Cards */}
      {clientStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="stat-label">{t('dashboard.totalClients')}</p>
                <p className="stat-value">{clientStats.total}</p>
              </div>
              <div className="stat-icon bg-blue-100 text-blue-600">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>
          {(clientStats.byCategory || []).map((cat) => (
            <div key={cat._id} className="stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="stat-label capitalize">{{farm: t('clients.farm'), wholesale: t('clients.wholesale'), distributor: t('clients.distributor'), retail: t('clients.retail'), dealer: t('clients.dealer')}[cat._id] || cat._id}</p>
                  <p className="stat-value">{cat.count}</p>
                </div>
                <div className={`stat-icon ${
                  cat._id === 'farm' ? 'bg-green-100 text-green-600' : 
                  cat._id === 'distributor' ? 'bg-purple-100 text-purple-600' : 
                  cat._id === 'wholesale' ? 'bg-blue-100 text-blue-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {cat._id === 'farm' && <Truck className="w-6 h-6" />}
                  {cat._id === 'distributor' && <Package className="w-6 h-6" />}
                  {cat._id === 'dealer' && <CreditCard className="w-6 h-6" />}
                  {cat._id === 'wholesale' && <Users className="w-6 h-6" />}
                  {cat._id === 'retail' && <ShoppingCart className="w-6 h-6" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="form-group flex-1 min-w-[200px] mb-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={t('common.searchClients')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="form-input pl-10"
              />
            </div>
          </div>
          <div className="form-group mb-0">
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="form-select"
            >
              <option value="">{t('clients.allCategories')}</option>
              <option value="farm">{t('clients.farm')}</option>
              <option value="distributor">{t('clients.distributor')}</option>
              <option value="dealer">{t('clients.dealer')}</option>
              <option value="wholesale">{t('clients.wholesale')}</option>
              <option value="retail">{t('clients.retail')}</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="form-select"
            >
              <option value="">{t('clients.allStatus')}</option>
              <option value="active">{t('common.statuses.active')}</option>
              <option value="inactive">{t('common.statuses.inactive')}</option>
              <option value="blocked">{t('clients.blocked')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Client List */}
      <div className="table-container">
        <table className="table" dir="rtl">
          <thead>
            <tr className="text-right">
              <th className="text-right">{t('clients.clientName')}</th>
              <th className="text-right">{t('clients.category')}</th>
              <th className="text-right">{t('common.contact')}</th>
              <th className="text-right">{t('clients.creditLimit')}</th>
              <th className="text-right">{t('clients.paymentTerms')}</th>
              <th className="text-right">الأقدمية</th>
              <th className="text-right">{t('common.status')}</th>
              <th className="text-right"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-4">{t('common.loading')}</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-4">{t('clients.noClients')}</td></tr>
            ) : (
              clients.map((client) => (
                <tr key={client._id}>
                  <td>
                    <div className="flex items-center justify-end">
                      <div className="ml-3 text-right">
                        <p className="font-medium text-gray-900">{client.name}</p>
                        <p className="text-sm text-gray-500">{client.code}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold ml-3">
                        {client.name?.charAt(0)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge capitalize">{{farm: t('clients.farm'), wholesale: t('clients.wholesale'), distributor: t('clients.distributor'), retail: t('clients.retail'), dealer: t('clients.dealer')}[client.category] || client.category}</span>
                    {client.product_focus === 'broiler' && <span className="badge badge-info ml-1">تسمين</span>}
                    {client.product_focus === 'layer' && <span className="badge badge-secondary ml-1">بياض</span>}
                  </td>
                  <td>
                    <p className="text-sm">{client.phone}</p>
                    <p className="text-sm text-gray-500">{client.city}</p>
                  </td>
                  <td>
                    {client.creditLimit > 0 ? (
                      <span className="font-medium">{formatCurrency(client.creditLimit)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td>
                    {getCreditClassBadge(client.credit_class)}
                    {client.discount > 0 && (
                      <span className="badge badge-warning ml-2">
                        {client.discount}% OFF
                      </span>
                    )}
                  </td>
                  <td>
                    {client.max_aging_days > 0 ? (
                      <span className="text-sm font-medium text-gray-700">{client.max_aging_days} يوم</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td>
                    <span className={getStatusBadgeClass(client.status)}>
                      {t('common.statuses.' + client.status) || client.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => openClientDetail(client)}
                        className="btn btn-sm btn-outline"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      {isOwner && (
                        <button
                          className="btn btn-danger btn-sm"
                          title="حذف"
                          onClick={() => {
                            setClientDeleteTarget(client);
                            setClientDeleteConfirmText('');
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && clients.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            السابق
          </button>
          <span className="text-sm text-gray-600">صفحة {page} من {totalPages}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            التالي
          </button>
        </div>
      )}

      {/* Add Client Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 24px',
              borderBottom: '1px solid #e5e7eb',
              background: '#fff'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
                  {creationStep === 'form' ? 'إضافة عميل جديد' :
                   creationStep === 'documents' ? 'رفع مستندات' : 'تم إنشاء العميل'}
                </h2>
                {creationStep === 'form' && (
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>أدخل بيانات العميل الجديد</p>
                )}
              </div>
              <button
                onClick={() => { setFormErrors({}); setShowModal(false); resetForm(); }}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {creationStep === 'form' && (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>

                  {/* SECTION 1: Basic Information */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f3f4f6',
                      marginBottom: '16px'
                    }}>
                      المعلومات الأساسية
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('clients.nameAr')} <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.name_arabic}
                          onChange={(e) => { setFormErrors({ ...formErrors, name_arabic: undefined }); setFormData({...formData, name_arabic: e.target.value, name: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.name_arabic ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.name_arabic ? '#ef4444' : '#e5e7eb'}
                          placeholder="اسم العميل بالعربية"
                        />
                        {formErrors.name_arabic && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.name_arabic}</small>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('common.category')} <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => { setFormErrors({ ...formErrors, category: undefined }); setFormData({...formData, category: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.category ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.category ? '#ef4444' : '#e5e7eb'}
                        >
                          <option value="farm">{t('clients.farm')}</option>
                          <option value="distributor">{t('clients.distributor')}</option>
                          <option value="dealer">{t('clients.dealer')}</option>
                          <option value="wholesale">{t('clients.wholesale')}</option>
                          <option value="retail">{t('clients.retail')}</option>
                        </select>
                        {formErrors.category && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.category}</small>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('clients.license')}
                        </label>
                        <input
                          type="text"
                          value={formData.licenseNumber}
                          onChange={(e) => setFormData({...formData, licenseNumber: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder={t('clients.commercialReg')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Contact Details */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f3f4f6',
                      marginBottom: '16px'
                    }}>
                      تفاصيل الاتصال
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('common.phone')} <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => { setFormErrors({ ...formErrors, phone: undefined }); setFormData({...formData, phone: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.phone ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.phone ? '#ef4444' : '#e5e7eb'}
                          placeholder="رقم الهاتف"
                        />
                        {formErrors.phone && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.phone}</small>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('common.email')}
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder="email@example.com"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('clients.contactPerson')} <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.contactPerson}
                          onChange={(e) => { setFormErrors({ ...formErrors, contactPerson: undefined }); setFormData({...formData, contactPerson: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.contactPerson ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.contactPerson ? '#ef4444' : '#e5e7eb'}
                          placeholder="الشخص المسؤول"
                        />
                        {formErrors.contactPerson && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.contactPerson}</small>}
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          المحافظة <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <select
                          value={formData.city || ''}
                          onChange={(e) => { setFormErrors({ ...formErrors, city: undefined }); setFormData({...formData, city: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.city ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.city ? '#ef4444' : '#e5e7eb'}
                        >
                          <option value="">اختر المحافظة</option>
                          {EGYPT_GOVERNORATES.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        {formErrors.city && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.city}</small>}
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('clients.address')} <span style={{ color: '#ef4444', marginRight: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => { setFormErrors({ ...formErrors, address: undefined }); setFormData({...formData, address: e.target.value}); }}
                          style={{
                            width: '100%', padding: '10px 14px', border: formErrors.address ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = formErrors.address ? '#ef4444' : '#e5e7eb'}
                          placeholder="العنوان الكامل"
                        />
                        {formErrors.address && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{formErrors.address}</small>}
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Payment Terms */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f3f4f6',
                      marginBottom: '16px'
                    }}>
                      شروط الدفع
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          نوع الدفع
                        </label>
                        <select
                          value={formData.paymentType}
                          onChange={(e) => setFormData({...formData, paymentType: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        >
                          <option value="cash">{t('common.cash')}</option>
                          <option value="credit">{t('common.credit')}</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          فترة الائتمان (أيام)
                        </label>
                        <select
                          value={formData.creditPeriod}
                          onChange={(e) => setFormData({...formData, creditPeriod: parseInt(e.target.value)})}
                          disabled={formData.paymentType !== 'credit'}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white',
                            opacity: formData.paymentType !== 'credit' ? 0.6 : 1
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        >
                          <option value={0}>بدون ائتمان</option>
                          <option value={7}>7 Days</option>
                          <option value={15}>15 Days</option>
                          <option value={30}>30 Days</option>
                          <option value={45}>45 Days</option>
                          <option value={60}>60 Days</option>
                          <option value={90}>90 Days</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          حد الائتمان
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({...formData, creditLimit: parseInt(e.target.value) || 0})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder="0"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          خصم % <small style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>(خصم دائم)</small>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={formData.discount || 0}
                          onChange={(e) => setFormData({...formData, discount: parseFloat(e.target.value) || 0})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder="0-100%"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: Sales Information */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #f3f4f6',
                      marginBottom: '16px'
                    }}>
                      معلومات المبيعات
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          نوع العلف المفضل
                        </label>
                        <select
                          value={formData.favoriteFeedType}
                          onChange={(e) => setFormData({...formData, favoriteFeedType: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                        >
                          <option key="placeholder-ft" value="">-- اختر --</option>
                          {feedTypes.map((ft, index) => (
                            <option key={`feedtype-option-${index}`} value={ft.id}>
                              {ft.name_english} / {ft.name_arabic}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          متوسط الاستهلاك الشهري <small style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>(طن/كجم)</small>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={formData.avgConsumption}
                          onChange={(e) => setFormData({...formData, avgConsumption: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder="مثال 50"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          {t('common.storageLocation')}
                        </label>
                        <input
                          type="text"
                          value={formData.storageLocation || ''}
                          onChange={(e) => setFormData({...formData, storageLocation: e.target.value})}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder={t('clients.storagePlaceholder')}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                          ملاحظات إضافية
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({...formData, notes: e.target.value})}
                          rows={3}
                          style={{
                            width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                            borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', resize: 'vertical'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                          onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                          placeholder={t('clients.additionalInfo')}
                        />
                      </div>
                    </div>
                  </div>

                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 24px',
                  borderTop: '1px solid #e5e7eb',
                  background: 'white'
                }}>
                  <button
                    type="button"
                    onClick={() => { setFormErrors({}); setShowModal(false); resetForm(); }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      background: 'white',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#10b981',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={18} /> إضافة عميل
                  </button>
                </div>
              </form>
            )}

            {creationStep === 'documents' && createdClientId && (
              <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckSquare className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">تم إنشاء العميل بنجاح!</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    يمكنك الآن رفع المستندات (العقود، التراخيص، إلخ)
                  </p>
                </div>
                <DocumentUpload
                  entityType="client"
                  entityId={createdClientId}
                  allowUpload={true}
                  useLegal={true}
                />
              </div>
            )}

            {creationStep === 'documents' && (
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn btn-success"
                >
                  تم
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClient && (
        <div className="modal-overlay">
          <div className="modal modal-large modal-wide" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedClient.client.name}</h2>
                <p className="text-gray-600 text-sm">الكود: {selectedClient.client.code}</p>
              </div>
              <button onClick={closeClientDetail} className="modal-close">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 border-b px-6 bg-gray-50">
              <button
                onClick={() => setClientDetailTab('overview')}
                className={`px-4 py-3 font-medium text-sm flex items-center gap-2 ${clientDetailTab === 'overview' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <FileText className="w-4 h-4" />
                نظرة عامة
              </button>
              <button
                onClick={() => setClientDetailTab('liabilities')}
                className={`px-4 py-3 font-medium text-sm flex items-center gap-2 ${clientDetailTab === 'liabilities' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <TrendingDown className="w-4 h-4" />
                الخصومات
                {selectedClient.client.liabilities?.filter(l => l.status === 'overdue').length > 0 && (
                  <span className="badge badge-danger text-xs">
                    {selectedClient.client.liabilities.filter(l => l.status === 'overdue').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setClientDetailTab('documents')}
                className={`px-4 py-3 font-medium text-sm flex items-center gap-2 ${clientDetailTab === 'documents' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <FileText className="w-4 h-4" />
                المستندات
              </button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              {clientDetailTab === 'overview' && (<>
              {/* Payment Summary Card */}
              {canRecordPayment() && (
                <div className="card mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">ملخص الدفع</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-gray-600">إجمالي المستحقات</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatCurrency(selectedClient.summary.totalPending || 0)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        {t('common.statuses.overdue')}
                      </p>
                      <p className="text-xl font-bold text-red-600">
                        {formatCurrency((selectedClient.pendingInvoices || []).filter(i => i.status !== 'paid' && new Date(i.due_date) < new Date()).reduce((sum, i) => sum + parseFloat(i.balance_due || i.remainingAmount || 0), 0) || 0)}
                      </p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm">
                      <p className="text-sm text-gray-600 flex items-center gap-1">
                        <Clock className="w-4 h-4 text-orange-500" />
                        عمر المديونية
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {(() => {
                          const oldest = Math.max(0, ...(selectedClient.client.liabilities || [])
                            .filter(l => l.status === 'pending')
                            .map(l => parseInt(l.aging_days) || 0));
                          return oldest > 0 ? `أقدم مستحق: ${oldest} يوم` : '—';
                        })()}
                      </p>
                    </div>
                  </div>
                  {canRecordPaymentForClient(selectedClient.client) && (
                    <button 
                      onClick={openPaymentModal}
                      className="btn btn-success w-full flex items-center justify-center gap-2"
                    >
                      <Wallet className="w-5 h-5" />
                      تسجيل دفعة
                    </button>
                  )}
                </div>
              )}

              {/* Account Summary */}
              <div className="stats-grid mb-6">
                <div className="stat-card bg-blue-50">
                  <p className="stat-label">{t('orders.totalOrders')}</p>
                  <p className="stat-value">{selectedClient.summary.totalOrders}</p>
                </div>
                <div className="stat-card bg-green-50">
                  <p className="stat-label">{t('orders.title')}</p>
                  <p className="stat-value">{formatCurrency(selectedClient.summary.totalAmount)}</p>
                </div>
                <div className="stat-card bg-yellow-50">
                  <p className="stat-label">{t('common.statuses.paid')}</p>
                  <p className="stat-value">{formatCurrency(selectedClient.summary.totalPaid)}</p>
                </div>
                <div className="stat-card bg-red-50">
                  <p className="stat-label">{t('common.statuses.pending')}</p>
                  <p className="stat-value">{formatCurrency(selectedClient.summary.totalPending)}</p>
                </div>
              </div>

              {/* Payment Terms */}
              <div className="card mb-6">
                <h3 className="card-title">شروط الدفع</h3>
                <div className="flex gap-4 flex-wrap">
                  {getCreditClassBadge(selectedClient.client.credit_class)}
                  {selectedClient.client.creditLimit > 0 && (
                    <span className="badge">
                      الحد: {selectedClient.client.creditLimit}
                    </span>
                  )}
                  {selectedClient.client.discount > 0 && (
                    <span className="badge badge-warning">
                      Discount: {selectedClient.client.discount}%
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="card mb-6">
                <h3 className="card-title">معلومات الاتصال</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">الهاتف</p>
                    <p className="font-medium">{selectedClient.client.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">النوع</p>
                    <p className="font-medium capitalize">{{farm: t('clients.farm'), wholesale: t('clients.wholesale'), distributor: t('clients.distributor'), retail: t('clients.retail'), dealer: t('clients.dealer')}[selectedClient.client.type] || selectedClient.client.type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">المحافظة</p>
                    <p className="font-medium">{selectedClient.client.city || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">العنوان</p>
                    <p className="font-medium">{selectedClient.client.address || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Recent Payments */}
              {selectedClient.recentPayments?.length > 0 && (
                <div className="card">
                  <h3 className="card-title flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    آخر المدفوعات
                  </h3>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t('common.date')}</th>
                          <th>{t('common.amount')}</th>
                          <th>{t('common.method')}</th>
                          <th>استلم بواسطة</th>
                          <th>رقم الإيصال</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClient.recentPayments.map((payment) => (
                          <tr key={payment._id}>
                            <td>{formatDate(payment.date)}</td>
                            <td className="font-semibold text-green-600">{formatCurrency(payment.amount || 0)}</td>
                            <td>
                              <span className="badge badge-primary capitalize">
                                {payment.method?.replace('_', ' ')}
                              </span>
                            </td>
                            <td>{payment.receivedBy}</td>
                            <td className="text-sm text-gray-600">{payment.receiptNumber}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>)}

              {clientDetailTab === 'liabilities' && (
                <ClientLiabilities
                  client={selectedClient.client}
                  totalPaymentsReceived={selectedClient.summary?.totalPaid}
                  overviewTotalPending={selectedClient.summary?.totalPending}
                  overviewTotalAmount={selectedClient.summary?.totalAmount}
                  overviewOverdueAmount={(selectedClient.pendingInvoices || []).filter(i => i.status !== 'paid' && new Date(i.due_date) < new Date()).reduce((sum, i) => sum + parseFloat(i.balance_due || i.remainingAmount || 0), 0)}
                  onUpdate={() => {
                    // Refresh client data after liabilities update
                    openClientDetail(selectedClient.client);
                  }}
                />
              )}

              {clientDetailTab === 'documents' && (
                <DocumentUpload
                  entityType="client"
                  entityId={selectedClient.client.id}
                  allowUpload={true}
                  useLegal={true}
                />
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {isOwner && (
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setClientDeleteTarget(selectedClient.client);
                    setClientDeleteConfirmText('');
                  }}
                >
                  <Trash2 size={16} /> حذف
                </button>
              )}
              <div style={{ flex: 1 }}></div>
              <button className="btn btn-outline" onClick={closeClientDetail}>إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSummary && (
        <div className="modal-overlay">
          <div className="modal modal-large modal-wide">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">تسجيل دفعة - {paymentSummary.client.name}</h2>
                <p className="text-gray-600 text-sm">الكود: {paymentSummary.client.code}</p>
              </div>
              <button onClick={closePaymentModal} className="modal-close">
                <X className="w-6 h-6" />
              </button>
            </div>

            {submitSuccess ? (
              <div className="modal-body text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckSquare className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">تم تسجيل الدفعة بنجاح!</h3>
                <p className="text-gray-600 mb-4">رقم الإيصال: {submitSuccess}</p>
                <p className="text-sm text-gray-500">جارٍ الإغلاق...</p>
              </div>
            ) : (
            <form onSubmit={submitPayment} style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0}}>
              <div className="modal-body" style={{overflowY: 'auto', maxHeight: 'calc(90vh - 140px)'}}>
                  {/* Amount Input */}
                  <div className="form-group mb-4">
                    <label className="form-label">{t("common.currency")} *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={paymentData.amount}
                      onChange={(e) => setPaymentData({...paymentData, amount: e.target.value})}
                      className="form-input text-lg"
                      placeholder="أدخل المبلغ"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {formatCurrency(paymentSummary.totalReceivables || 0)}
                    </p>
                  </div>

                  {/* Payment Method */}
                  <div className="form-group mb-4">
                    <label className="form-label">Payment Method *</label>
                    <div className="flex gap-4">
                      {['cash', 'bank_transfer', 'cheque'].map((method) => (
                        <label key={method} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method}
                            checked={paymentData.paymentMethod === method}
                            onChange={(e) => setPaymentData({...paymentData, paymentMethod: e.target.value})}
                            className="form-radio"
                          />
                          <span className="capitalize">{method.replace('_', ' ')}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Apply To */}
                  <div className="form-group mb-4">
                    <label className="form-label">{t('clients.applyPayment')}</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="applyTo"
                          value="auto"
                          checked={paymentData.applyTo === 'auto'}
                          onChange={(e) => setPaymentData({...paymentData, applyTo: e.target.value, selectedInvoices: []})}
                          className="form-radio"
                        />
                        <span>Auto-apply to oldest invoices (default)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="applyTo"
                          value="specific"
                          checked={paymentData.applyTo === 'specific'}
                          onChange={(e) => setPaymentData({...paymentData, applyTo: e.target.value})}
                          className="form-radio"
                        />
                        <span>اختر فواتير محددة</span>
                      </label>
                    </div>
                  </div>

                  {/* Select Invoices Table */}
                  {paymentData.applyTo === 'specific' && paymentSummary.pendingInvoices?.length > 0 && (
                    <div className="form-group mb-4">
                      <label className="form-label">اختر الفواتير</label>
                      <div className="table-container max-h-48 overflow-y-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>اختيار</th>
                              <th>رقم الفاتورة</th>
                              <th>{t('common.balance')}</th>
                              <th>{t('orders.dueDate')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentSummary.pendingInvoices.map((inv) => (
                              <tr key={inv._id}>
                                <td>
                                  <input 
                                    type="checkbox" 
                                    className="form-checkbox"
                                    checked={paymentData.selectedInvoices.includes(inv._id)}
                                    onChange={() => toggleInvoiceSelection(inv._id)}
                                  />
                                </td>
                                <td>{inv.invoiceNumber}</td>
                                <td>{formatCurrency(inv.balance || 0)}</td>
                                <td>{formatDate(inv.dueDate)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {paymentData.selectedInvoices.length > 0 && (
                        <p className="text-sm text-gray-600 mt-2">
                          {t("common.remainingAfterSelection")}: {formatCurrency(calculateRemaining() || 0)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reference Number */}
                  {paymentData.paymentMethod !== 'cash' && (
                    <div className="form-group mb-4">
                      <label className="form-label">
                        Reference Number {paymentData.paymentMethod === 'bank_transfer' ? '(Transaction ID)' : '(Cheque Number)'} *
                      </label>
                      <input
                        type="text"
                        required={paymentData.paymentMethod !== 'cash'}
                        value={paymentData.referenceNumber}
                        onChange={(e) => setPaymentData({...paymentData, referenceNumber: e.target.value})}
                        className="form-input"
                        placeholder={paymentData.paymentMethod === 'bank_transfer' ? 'Enter transaction ID' : 'Enter cheque number'}
                      />
                    </div>
                  )}

                  {/* Receipt Photo */}
                  <div className="form-group mb-4">
                    <label className="form-label flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      صورة الإيصال (اختياري)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="form-input"
                    />
                    {paymentData.receiptPhoto && (
                      <div className="mt-2">
                        <img 
                          src={paymentData.receiptPhoto} 
                          alt="Receipt preview" 
                          className="w-32 h-32 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="form-group mb-4">
                    <label className="form-label">{t('common.notes')}</label>
                    <textarea
                      value={paymentData.notes}
                      onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                      className="form-textarea"
                      rows={3}
                      placeholder={t('common.additionalNotes')}
                    />
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold mb-2">ملخص الدفع</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Total Payment:</span>
                        <span className="font-semibold">{formatCurrency(parseFloat(paymentData.amount || 0))}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Applied to:</span>
                        <span>{paymentData.applyTo === 'auto' ? 'Auto-apply to oldest' : `${paymentData.selectedInvoices.length} invoice(s)`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Remaining Credit:</span>
                        <span className="font-semibold">
                          {formatCurrency(Math.max(0, (paymentSummary.client.currentCredit || 0) - parseFloat(paymentData.amount || 0)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    onClick={closePaymentModal}
                    className="btn btn-outline"
                    disabled={paymentLoading}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={paymentLoading || !paymentData.amount}
                  >
                    {paymentLoading ? 'جارٍ المعالجة...' : 'إرسال الدفعة'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Client Delete Confirmation Modal */}
      {clientDeleteTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={(e) => e.target === e.currentTarget && setClientDeleteTarget(null)}>
          <div className="modal modal-large" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">حذف عميل</h2>
              <button className="modal-close" onClick={() => { setClientDeleteTarget(null); setClientDeleteConfirmText(''); }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                لحذف هذا العميل نهائياً، اكتب اسمه بالكامل:<br />
                <strong style={{ fontSize: '1.1rem', display: 'block', marginTop: '8px' }}>{clientDeleteTarget.name_arabic || clientDeleteTarget.name}</strong>
              </p>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={clientDeleteConfirmText}
                  onChange={(e) => setClientDeleteConfirmText(e.target.value)}
                  placeholder="اكتب الاسم هنا..."
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setClientDeleteTarget(null); setClientDeleteConfirmText(''); }}>إلغاء</button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteClient}
                disabled={clientDeleteLoading || clientDeleteConfirmText.trim() !== (clientDeleteTarget.name_arabic || clientDeleteTarget.name || '').trim()}
              >
                {clientDeleteLoading ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
