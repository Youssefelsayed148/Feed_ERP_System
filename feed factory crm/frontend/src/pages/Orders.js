import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { authService, salesService } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Plus, Search, Filter, FileText, 
  Check, X, Clock, Truck, DollarSign, Package,
  ChevronDown, Trash2, Download, AlertCircle, Eye,
  Calendar, Hash, User, CreditCard, CheckCircle,
  ExternalLink, ArrowLeft, TrendingDown, Wallet, AlertTriangle, Receipt
} from 'lucide-react';
import ClientLiabilities from '../components/ClientLiabilities';
import DocumentUpload from '../components/DocumentUpload';

// API Base
const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export default function Orders() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const canSendToDelivery = ['admin', 'owner', 'sales_manager'].includes(currentUser?.role);
  const canApproveOrders = ['sales_manager', 'admin', 'owner'].includes(currentUser?.role);
  const canConfirmOrders = ['sales_manager', 'admin', 'owner'].includes(currentUser?.role);
  const isSalesRep = currentUser?.role === 'sales_rep';
  const [orders, setOrders] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [stats, setStats] = useState(null);
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [clientWarning, setClientWarning] = useState(null);
  const [orderErrors, setOrderErrors] = useState({});
  
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [clientDetailTab, setClientDetailTab] = useState('overview');
  const [clientDetailLoading, setClientDetailLoading] = useState(false);

  // New Order Form — input in tons, auto-calculate bags
  const [newOrder, setNewOrder] = useState({
    clientId: '',
    paymentType: 'cash',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryDate: '',
    notes: '',
    discount: 0,
    items: [{ feedTypeId: '', packageSize: 50, quantityTons: 0.5 }]
  });

  useEffect(() => {
    fetchOrders();
    fetchFeedTypes();
    fetchClients();
    fetchStats();
  }, [search, status]);

  useEffect(() => {
    if (selectedClientInfo?.client) {
      checkClientCreditWarning(selectedClientInfo.client);
    }
  }, [newOrder.items]);

  
  // Inject CSS for wide dropdown options
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .feed-type-select option {
        white-space: nowrap;
        overflow: visible;
        max-width: none !important;
        width: auto !important;
        min-width: 400px;
        padding: 8px 12px;
        font-size: 14px;
      }
      .feed-type-select {
        min-width: 100%;
      }
      .feed-type-select optgroup,
      .feed-type-select select {
        width: auto;
        min-width: 100%;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      params.append('limit', '9999');
      params.append('page', '1');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${API_URL}/sales/orders?${params}`, { 
        headers: headers(),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        const data = await response.json();
        let ordersData = (data.orders || []).map(o => ({
          ...o,
          _id: o.id || o._id,
          orderNumber: o.order_number || o.orderNumber,
          client: o.client || { name: o.client_name || o.clientName, code: o.client_code || o.clientCode },
          clientId: o.client_id || o.clientId,
          items: o.items || (o.itemCount ? Array(o.itemCount).fill({}) : []),
          total: o.final_amount || o.finalAmount || o.total_amount || o.totalAmount || 0,
          status: o.status || 'draft',
          createdAt: o.created_at || o.createdAt,
          deliveryDate: o.delivery_date || o.deliveryDate,
          paymentType: o.client_payment_terms === 'cash' ? 'cash' : 'credit',
          creditPeriod: o.client_payment_terms ? (parseInt(o.client_payment_terms.match(/\d+/)?.[0]) || 0) : 0,
          invoice: o.invoice_id ? {
            _id: o.invoice_id,
            invoiceNumber: o.invoice_number,
            status: o.invoice_status || 'pending',
            amount: o.invoice_amount || 0
          } : null
        }));
        if (search) {
          ordersData = ordersData.filter(o => 
            o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
            o.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
            o.client?.code?.toLowerCase().includes(search.toLowerCase())
          );
        }
        if (status) {
          ordersData = ordersData.filter(o => o.status === status);
        }
        // Deduplicate in case backend JOIN returns duplicate rows
        ordersData = Object.values(
          ordersData.reduce((acc, o) => { acc[o._id] = o; return acc; }, {})
        );
        setOrders(ordersData);
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/feed-types`, { headers: headers() });
      const data = await response.json();
      const mappedFeedTypes = (data || []).map(ft => ({
        ...ft,
        _id: String(ft.id || ft._id),
        name: ft.name_arabic || ft.name_english || ft.name,
        // pricing: [ { package_size: 10, price_per_ton: 16192 }, ... ]
        pricing: ft.pricing || []
      }));
      setFeedTypes(mappedFeedTypes);
    } catch (error) {
      console.error('Error fetching feed types:', error);
      setFeedTypes([]);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch(`${API_URL}/clients`, { headers: headers() });
      const data = await response.json();
      const mappedClients = (data.clients || []).map(c => ({
        ...c,
        _id: String(c.id || c._id),
        name: c.name_arabic || c.name_english || c.name,
        paymentType: c.payment_type || (c.payment_terms === 'cash' ? 'cash' : 'credit'),
        address: c.address || '',
        discount: c.discount || 0,
        currentCredit: c.current_balance || c.currentCredit || 0,
        creditLimit: c.credit_limit || c.creditLimit || 0,
        isBlockedDueToCredit: c.is_blocked_due_to_credit || c.isBlockedDueToCredit || false,
        blockingThreshold: c.blocking_threshold || c.blockingThreshold || 80,
        status: c.status || 'active'
      }));
      setClients(mappedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/orders/stats`, { headers: headers() });
      const data = await response.json();
      setStats({
        total: data.total || data.total_orders || 0,
        todayOrders: data.todayOrders || data.today_orders || 0,
        todayRevenue: data.totalRevenue || data.todayRevenue || 0,
        byStatus: data.byStatus || data.by_status || []
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({});
    }
  };

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setShowOrderDetail(true);
  };

  const openClientDetail = async (clientId) => {
    if (!clientId) return;
    setClientDetailLoading(true);
    setClientDetailTab('overview');
    try {
      const response = await fetch(`${API_URL}/clients/${clientId}/account`, { headers: headers() });
      const data = await response.json();
      if (data && data.client) {
        data.client._id = data.client.id || data.client._id;
        data.client.name = data.client.name_arabic || data.client.name_english || data.client.name;
        data.client.currentCredit = parseFloat(data.client.current_balance || 0);
        data.client.creditLimit = parseFloat(data.client.credit_limit || 0);
        data.client.paymentType = data.client.payment_terms === 'cash' ? 'cash' : (data.client.payment_terms ? 'credit' : 'cash');
        data.client.creditPeriod = data.client.payment_terms ? parseInt(data.client.payment_terms.replace(/[^0-9]/g, '')) || 0 : 0;
        data.client.discount = data.client.discount || 0;
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
        if (data.summary) {
          data.summary.totalOrders = parseInt(data.summary.totalOrders || data.summary.total_orders || 0);
          data.summary.totalAmount = parseFloat(data.summary.totalAmount || data.summary.total_amount || 0);
          data.summary.totalPaid = parseFloat(data.summary.totalPaid || data.summary.total_paid || 0);
          data.summary.totalPending = parseFloat(data.summary.totalPending || data.summary.total_pending || 0);
        }
        if (data.pendingInvoices) {
          data.pendingInvoices = data.pendingInvoices.map(inv => ({...inv, _id: inv.id || inv._id}));
        }
        if (data.recentPayments) {
          data.recentPayments = data.recentPayments.map(p => ({...p, _id: p.id || p._id}));
        }
        setSelectedClientDetail(data);
      }
    } catch (error) {
      console.error('Error fetching client details:', error);
    } finally {
      setClientDetailLoading(false);
    }
  };

  const handleClientChange = async (clientId) => {
    if (!clientId) {
      setNewOrder(prev => ({ ...prev, clientId: '', paymentType: 'cash', deliveryAddress: '', deliveryCity: '' }));
      setSelectedClientInfo(null);
      setClientWarning(null);
      return;
    }
    const client = clients.find(c => c._id === clientId);
    if (!client) return;
    setNewOrder(prev => ({
      ...prev,
      clientId,
      paymentType: client.paymentType || 'cash',
      discount: client.discount || 0
    }));
    try {
      const response = await fetch(`${API_URL}/clients/${clientId}/account`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setSelectedClientInfo(data?.client ? data : { client });
        if (data?.client) {
          setNewOrder(prev => ({
            ...prev,
            deliveryAddress: data.client.address || '',
            deliveryCity: data.client.city || ''
          }));
        }
      } else {
        setSelectedClientInfo({ client });
      }
      checkClientCreditWarning(client);
    } catch (error) {
      setSelectedClientInfo({ client });
      checkClientCreditWarning(client);
    }
  };

  const checkClientCreditWarning = (client) => {
    if (!client) { setClientWarning(null); return; }
    const totalCredit = (client.currentCredit || 0) + (newOrder?.items?.reduce((sum, item) => {
      return sum + getLineTotal(item);
    }, 0) || 0);
    const creditPercentage = client.creditLimit > 0 ? (totalCredit / client.creditLimit) * 100 : 0;
    const threshold = client.blockingThreshold || 80;
    if (client.isBlockedDueToCredit || client.status === 'blocked') {
      setClientWarning({ type: 'error', message: `العميل محظور: تجاوز حد الائتمان (${formatNumber(client.currentCredit ?? 0)} / ${formatNumber(client.creditLimit ?? 0)})` });
    } else if (creditPercentage >= threshold) {
      setClientWarning({ type: 'warning', message: `تحذير: العميل عند ${creditPercentage.toFixed(1)}% من حد الائتمان` });
    } else if (creditPercentage >= threshold * 0.8) {
      setClientWarning({ type: 'info', message: `ملاحظة: العميل عند ${creditPercentage.toFixed(1)}% من حد الائتمان` });
    } else {
      setClientWarning(null);
    }
  };

  const addItem = () => {
    setNewOrder({ ...newOrder, items: [...newOrder.items, { feedTypeId: '', packageSize: 50, quantityTons: 0.5 }] });
  };

  const removeItem = (index) => {
    const items = newOrder.items.filter((_, i) => i !== index);
    setNewOrder({ ...newOrder, items });
  };

  const updateItem = (index, field, value) => {
    const items = [...newOrder.items];
    items[index][field] = value;
    setNewOrder({ ...newOrder, items });
  };

  // Get price per ton from pricing array for selected package size
  const getItemPricePerTon = (item) => {
    if (!item.feedTypeId || !item.packageSize) return 0;
    const feedType = feedTypes.find(f => f._id === item.feedTypeId);
    if (!feedType?.pricing) return 0;
    const pkg = feedType.pricing.find(p => p.package_size === parseInt(item.packageSize));
    return pkg ? parseFloat(pkg.price_per_ton) || 0 : 0;
  };

  // Auto-calculate number of bags from tons and package size
  const getBagsCount = (item) => {
    const tons = parseFloat(item.quantityTons) || 0;
    const pkg = parseInt(item.packageSize) || 50;
    if (tons <= 0 || pkg <= 0) return 0;
    return Math.ceil((tons * 1000) / pkg);
  };

  // Get line total = tons × price per ton
  const getLineTotal = (item) => {
    const tons = parseFloat(item.quantityTons) || 0;
    const pricePerTon = getItemPricePerTon(item);
    return tons * pricePerTon;
  };

  const calculateSubtotal = () => {
    return newOrder.items.reduce((sum, item) => sum + getLineTotal(item), 0);
  };

  const calculateTotal = () => {
    // No discount applied for now
    return calculateSubtotal();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!newOrder.clientId) errors.clientId = 'اختر العميل';
    if (!newOrder.deliveryDate) errors.deliveryDate = 'تاريخ التسليم مطلوب';
    if (!newOrder.deliveryAddress.trim()) errors.deliveryAddress = 'عنوان التسليم مطلوب';
    if (!newOrder.deliveryCity.trim()) errors.deliveryCity = 'المحافظة مطلوبة';
    const validItems = newOrder.items.filter(item => item.feedTypeId && parseFloat(item.quantityTons) > 0);
    if (validItems.length === 0) errors.items = 'أضف عنصراً واحداً على الأقل';
    if (Object.keys(errors).length > 0) { setOrderErrors(errors); return; }
    setOrderErrors({});
    setLoading(true);
    try {
      const subtotal = calculateSubtotal();
      const total = calculateTotal();

      const orderData = {
        clientId: newOrder.clientId,
        paymentType: newOrder.paymentType,
        deliveryAddress: newOrder.deliveryAddress,
        deliveryDate: newOrder.deliveryDate,
        notes: newOrder.notes,
        discount: 0,
        subtotal,
        total,
        items: validItems.map(item => ({
          feedTypeId: item.feedTypeId,
          packageSize: item.packageSize,
          quantityTons: parseFloat(item.quantityTons),
          pricePerTon: getItemPricePerTon(item)
        })),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const selectedClient = clients.find(c => c._id === newOrder.clientId);
      if (selectedClient?.isBlockedDueToCredit || selectedClient?.status === 'blocked') {
        orderData.forceOverride = true;
      }
      if (clientWarning && (clientWarning.type === 'error' || clientWarning.type === 'warning')) {
        orderData.forceOverride = true;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${API_URL}/sales/orders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(orderData),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        alert('تم إنشاء الطلب بنجاح!');
        setOrderErrors({});
        setShowModal(false);
        resetForm();
        fetchOrders();
        fetchStats();
        if (data && data.order) {
          setOrders(prevOrders => [data.order, ...prevOrders]);
        }
      } else if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        setClientWarning({ type: 'error', message: data.message || 'العميل محظور بسبب تجاوز حد الائتمان' });
        alert(data.message || 'العميل محظور بسبب تجاوز حد الائتمان');
      } else if (response.status === 400) {
        const data = await response.json().catch(() => ({}));
        alert('خطأ في البيانات: ' + (data.error || data.message || 'بيانات غير صحيحة'));
      } else if (response.status === 401) {
        alert('خطأ في المصادقة: يرجى تسجيل الدخول مجدداً');
      } else {
        alert('فشل إنشاء الطلب. يرجى المحاولة مرة أخرى.');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      alert('فشل إنشاء الطلب: ' + (error.message || 'خطأ غير معروف'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewOrder({
      clientId: '',
      paymentType: 'cash',
      deliveryAddress: '',
      deliveryCity: '',
      deliveryDate: '',
      notes: '',
      discount: 0,
      items: [{ feedTypeId: '', packageSize: 50, quantityTons: 0.5 }]
    });
    setSelectedClientInfo(null);
    setClientWarning(null);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: newStatus })
      });
      fetchOrders();
      fetchStats();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const sendOrderToDelivery = async (orderId) => {
    try {
      const response = await fetch(`${API_URL}/orders/${orderId}/send-to-delivery`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({})
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'فشل إرسال الطلب للتوصيل');
        return;
      }
      fetchOrders();
      fetchStats();
    } catch (error) {
      alert('فشل إرسال الطلب للتوصيل');
    }
  };

  const calculateInvoiceTotals = (order) => {
    const subtotal = order.total || 0;
    return { subtotal, tax: 0, total: subtotal };
  };

  const generateInvoicePreview = async (order) => {
    try {
      let orderItems = order.items || [];
      if (!orderItems[0]?.feedTypeId && order._id) {
        try {
          const res = await fetch(`${API_URL}/orders/${order._id}`, { headers: headers() });
          if (res.ok) {
            const fullOrder = await res.json();
            orderItems = fullOrder.items || [];
          }
        } catch (e) {}
      }
      const { subtotal, tax, total } = calculateInvoiceTotals(order);
      const year = new Date().getFullYear();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const invoiceNumber = `INV-${year}-${randomNum}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (order.creditPeriod || 0));
      const discount = order.discount || 0;
      const subtotalBeforeDiscount = order.total ? order.total / (1 - discount / 100) : subtotal;
      const discountAmount = subtotalBeforeDiscount * (discount / 100);
      setInvoicePreviewData({
        orderId: order._id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        client: order.client,
        items: orderItems,
        subtotal: subtotalBeforeDiscount,
        discount,
        discountAmount,
        tax,
        total,
        dueDate: dueDate.toISOString().split('T')[0],
        paymentType: order.paymentType,
        creditPeriod: order.creditPeriod,
        status: 'pending'
      });
      setShowInvoicePreview(true);
    } catch (error) {
      alert('خطأ في إعداد معاينة الفاتورة. يرجى المحاولة مرة أخرى.');
    }
  };

  const confirmGenerateInvoice = async () => {
    if (!invoicePreviewData) return;
    try {
      setGeneratingInvoice(true);
      const response = await fetch(`${API_URL}/orders/${invoicePreviewData.orderId}/invoice`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          invoiceNumber: invoicePreviewData.invoiceNumber,
          dueDate: invoicePreviewData.dueDate,
          subtotal: invoicePreviewData.subtotal,
          tax: invoicePreviewData.tax,
          total: invoicePreviewData.total
        })
      });
      const data = await response.json();
      if (response.ok) {
        setShowInvoicePreview(false);
        setInvoicePreviewData(null);
        const invoiceData = data.invoice || {
          _id: data.id || data.invoiceId || 'existing',
          invoiceNumber: data.invoiceNumber || invoicePreviewData.invoiceNumber,
          status: data.status || 'pending'
        };
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === invoicePreviewData.orderId ? { ...order, invoice: invoiceData } : order
          )
        );
        if (data.alreadyExisted) {
          alert(`الفاتورة ${data.invoiceNumber} موجودة بالفعل لهذا الطلب.`);
        } else {
          alert('تم إنشاء الفاتورة بنجاح!');
        }
        fetchOrders();
        fetchStats();
      } else {
        alert(data.error || 'خطأ في إنشاء الفاتورة. يرجى المحاولة مرة أخرى.');
      }
    } catch (error) {
      alert('فشل إنشاء الفاتورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const cancelInvoicePreview = () => {
    setShowInvoicePreview(false);
    setInvoicePreviewData(null);
  };

  const viewInvoicePDF = async (order) => {
    try {
      if (!order.invoice?._id) { alert('لا توجد فاتورة لهذا الطلب'); return; }
      const response = await fetch(`${API_URL}/orders/${order._id}/invoice/pdf`, { headers: headers() });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `فشل تحميل الفاتورة (الحالة: ${response.status})`);
      }
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice-${order.invoice.invoiceNumber}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        }
      } else {
        const html = await response.text();
        const newWindow = window.open('', '_blank');
        if (!newWindow) { alert('يرجى السماح بالنوافذ المنبثقة لعرض الفاتورة'); return; }
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (error) {
      alert(`خطأ في عرض الفاتورة: ${error.message}`);
    }
  };

  const downloadInvoicePDF = async (invoiceId, invoiceNumber) => {
    try {
      const response = await fetch(`${API_URL}/invoices/${invoiceId}/pdf`, { headers: headers() });
      if (!response.ok) throw new Error(`فشل تنزيل PDF (الحالة: ${response.status})`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber || invoiceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('فشل تنزيل PDF: ' + (error.message || 'خطأ غير معروف'));
    }
  };

  const viewInvoiceDetails = async (order) => {
    if (!order.invoice?._id && !order.invoice?.id) { alert('لا توجد فاتورة لهذا الطلب'); return; }
    let orderItems = order.items || [];
    try {
      const orderRes = await fetch(`${API_URL}/orders/${order._id}`, { headers: headers() });
      if (orderRes.ok) {
        const fullOrder = await orderRes.json();
        orderItems = fullOrder.items || [];
      }
    } catch (e) {}
    const invoiceId = order.invoice?._id || order.invoice?.id;
    setInvoiceDetails({
      ...order.invoice,
      _id: invoiceId,
      invoiceNumber: order.invoice?.invoiceNumber || order.invoice?.invoice_number,
      orderId: order._id,
      orderNumber: order.orderNumber,
      client: order.client,
      items: orderItems,
      total: order.invoice?.amount || order.total,
      subtotal: order.invoice?.amount || order.total,
      amount: order.invoice?.amount || order.total,
      paymentType: order.paymentType,
      creditPeriod: order.creditPeriod
    });
    setShowInvoiceDetails(true);
  };

  const getInvoiceStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'overdue': return '#ef4444';
      default: return '#f59e0b';
    }
  };

  const getInvoiceStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'badge badge-success';
      case 'overdue': return 'badge badge-danger';
      default: return 'badge badge-warning';
    }
  };

  const getStatusBadgeClass = (orderStatus) => {
    const classes = {
      draft: 'badge badge-info', pending: 'badge badge-warning',
      pending_approval: 'badge badge-warning', confirmed: 'badge badge-primary',
      approved: 'badge badge-success', processing: 'badge badge-warning',
      ready: 'badge badge-info', ready_for_delivery: 'badge badge-info',
      delivered: 'badge badge-success', invoiced: 'badge badge-primary',
      cancelled: 'badge badge-danger', paid: 'badge badge-success',
      completed: 'badge badge-success', overdue: 'badge badge-danger',
    };
    return classes[orderStatus] || 'badge badge-info';
  };

  const getStatusLabel = (orderStatus) => {
    const labels = {
      draft: t('common.statuses.draft'), pending: t('common.statuses.pending'),
      pending_approval: t('common.statuses.pending_approval'), confirmed: t('common.statuses.confirmed'),
      approved: t('common.statuses.approved'), processing: t('common.statuses.processing'),
      ready: t('common.statuses.ready'), ready_for_delivery: t('orders.readyForDelivery'),
      delivered: t('common.statuses.delivered'), invoiced: t('common.statuses.invoiced'),
      cancelled: t('common.statuses.cancelled'), paid: t('common.statuses.paid'),
      completed: t('common.statuses.completed'), overdue: t('common.statuses.overdue'),
    };
    return labels[orderStatus] || orderStatus;
  };

  const canRecordPayment = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const allowedRoles = ['admin', 'finance', 'sales_manager', 'sales_rep', 'owner'];
    return allowedRoles.includes(user.role);
  };

  const canRecordPaymentForClient = (client) => {
    return false;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ padding: '8px' }}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1>{t('orders.title')}</h1>
            <p>{t('orders.subtitle')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/sales')} className="btn btn-outline">
            {t('orders.payment')}
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <Plus className="w-5 h-5" />
            {t('sales.newOrder')}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid mb-6">
          <div className="stat-card">
            <p className="stat-label">{t('orders.totalOrders')}</p>
            <p className="stat-value">{stats.total}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">{t('orders.today')}</p>
            <p className="stat-value">{stats.todayOrders}</p>
          </div>
          <div className="stat-card">
            <p className="stat-label">{t('orders.revenue')}</p>
            <p className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(stats.todayRevenue || 0)}</p>
          </div>
          {(stats.byStatus || []).map((s) => (
            <div key={s._id} className="stat-card">
              <p className="stat-label capitalize">{s._id}</p>
              <p className="stat-value">{s.count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="action-bar mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={t('orders.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select">
          <option value="">{t('orders.allStatus')}</option>
          <option value="pending_approval">{t('common.statuses.pending_approval')}</option>
          <option value="processing">{t('orders.processing')}</option>
          <option value="ready_for_delivery">{t('orders.readyForDelivery')}</option>
          <option value="ready">{t('orders.ready')}</option>
          <option value="in_transit">{t('orders.in_transit') || 'في الطريق'}</option>
          <option value="delivered">{t('orders.delivered')}</option>
          <option value="cancelled">{t('orders.cancelled')}</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>{t('common.client')}</th>
              <th>{t('common.items')}</th>
              <th>{t('common.total')}</th>
              <th>{t('orders.payment')}</th>
              <th>تاريخ التسليم</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" className="text-center py-4">{t('common.loading')}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-4">{t('orders.none')}</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                  </td>
                  <td>
                    <div onClick={() => openClientDetail(order.clientId || order.client_id)} style={{ cursor: 'pointer' }}>
                      <p className="font-medium" style={{ color: '#2563eb' }}>{order.client?.name}</p>
                      <p className="text-sm text-gray-500">{order.client?.code}</p>
                    </div>
                  </td>
                  <td>
                    {order.items && order.items.length > 0 ? (
                      <div>
                        {order.items.map((item, idx) => {
                          const name = item.feed_type_name || item.feedType?.name || item.feedTypeName || item.name || '';
                          const qtyBags = item.quantity || 0;
                          const pkg = item.package_size || item.packageSize || 0;
                          const tons = item.quantity_tons || (qtyBags * pkg) / 1000;
                          return (
                            <div key={`${order._id}-${idx}`} style={{ marginBottom: idx < order.items.length - 1 ? '6px' : 0 }}>
                              <p className="text-xs text-gray-500" style={{ fontSize: '13px', color: '#111827' }}>
                                {name ? `${name} × ${formatNumber(tons, 1)} طن / ${pkg}كجم` : `${formatNumber(tons, 1)} طن / ${pkg}كجم`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">{order.itemCount || 0} عناصر</p>
                    )}
                  </td>
                  <td>
                    <p className="font-medium">{formatCurrency(order.total || 0)}</p>
                  </td>
                  <td>
                    <span className={`badge ${order.paymentType === 'cash' ? 'badge-primary' : 'badge-warning'}`}>
                      {order.paymentType === 'cash' ? 'نقدي' : `آجل ${order.creditPeriod}ي`}
                    </span>
                  </td>
                  <td>
                    <p className="text-sm text-gray-500">{order.deliveryDate ? formatDate(order.deliveryDate) : '—'}</p>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={getStatusBadgeClass(order.status)}>{getStatusLabel(order.status)}</span>
                      {order.invoice && (
                        <span className={getInvoiceStatusBadgeClass(order.invoice.status || 'pending')} style={{ fontSize: '10px' }}>
                          فاتورة: {order.invoice.invoiceNumber || (order.invoice.status || 'pending')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2 flex-wrap">
                      {/* مراجعة — للمدير فقط عند انتظار الاعتماد */}
                      {order.status === 'pending_approval' && canApproveOrders && (
                        <button onClick={() => openOrderDetail(order)} className="btn btn-sm btn-warning">
                          مراجعة
                        </button>
                      )}
                      {/* بانتظار الاعتماد — للمندوب فقط، بدون إجراء */}
                      {order.status === 'pending_approval' && isSalesRep && (
                        <span style={{ fontSize: '12px', padding: '4px 10px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '8px', fontWeight: 500 }}>
                          بانتظار الاعتماد
                        </span>
                      )}
                      {/* جاهز للتسليم — للمدير فقط */}
                      {order.status === 'processing' && canConfirmOrders && (
                        <button onClick={() => updateOrderStatus(order._id, 'ready_for_delivery')} className="btn btn-sm btn-primary">
                          جاهز للتسليم
                        </button>
                      )}
                      {/* إرسال للتوصيل — للمدير والمالك */}
                      {order.status === 'ready_for_delivery' && canSendToDelivery && (
                        <button onClick={() => sendOrderToDelivery(order._id)} className="btn btn-sm btn-success">
                          إرسال للتوصيل
                        </button>
                      )}
                      {/* عرض الفاتورة أو إنشاؤها */}
                      {!order.invoice && order.status !== 'cancelled' && order.status !== 'draft' && canApproveOrders && (
                        <button onClick={() => generateInvoicePreview(order)} className="btn btn-sm btn-outline">
                          فاتورة
                        </button>
                      )}
                      {order.invoice && (
                        <>
                          <button onClick={() => viewInvoiceDetails(order)} className="btn btn-sm btn-info" title="عرض تفاصيل الفاتورة">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => downloadInvoicePDF(order.invoice._id, order.invoice.invoiceNumber)} className="btn btn-sm btn-primary" title="تنزيل PDF">
                            <Download className="w-4 h-4" />
                          </button>
                          <a href="/finance" className="btn btn-sm btn-outline" title="عرض في المالية"
                            onClick={(e) => { e.preventDefault(); window.open('/finance', '_blank'); }}>
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <span className="text-xs text-gray-500 self-center">{order.invoice.invoiceNumber}</span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ===== NEW ORDER MODAL ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setOrderErrors({}); setShowModal(false); resetForm(); } }}>
          <div className="modal modal-large" style={{ maxWidth: '750px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', background: '#dbeafe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={20} color="#2563eb" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>طلب مبيعات جديد</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>أنشئ طلب جديد للعميل</p>
                </div>
              </div>
              <button 
                onClick={() => { setOrderErrors({}); setShowModal(false); resetForm(); }}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <form id="newOrderForm" onSubmit={handleSubmit}>
                {/* Section 1: معلومات الطلب */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                    معلومات الطلب
                  </div>

                  {/* العميل — full width */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                      العميل <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select 
                      value={newOrder.clientId} 
                      onChange={(e) => { setOrderErrors({ ...orderErrors, clientId: undefined }); handleClientChange(e.target.value); }}
                      style={{ width: '100%', padding: '10px 14px', border: orderErrors.clientId ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white' }}
                      onFocus={(e) => { if (!orderErrors.clientId) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; } }}
                      onBlur={(e) => { e.target.style.borderColor = orderErrors.clientId ? '#ef4444' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="">اختر العميل</option>
                      {clients.map((client) => {
                        const creditPercent = client.creditLimit > 0 ? ((client.currentCredit || 0) / client.creditLimit) * 100 : 0;
                        const isBlocked = client.isBlockedDueToCredit || client.status === 'blocked';
                        const label = isBlocked 
                          ? `🚫 ${client.name} (محظور)`
                          : creditPercent >= 80 
                            ? `⚠️ ${client.name} (${creditPercent.toFixed(0)}% ائتمان)`
                            : client.name;
                        return <option key={client._id} value={client._id}>{label} ({client.code})</option>;
                      })}
                    </select>
                    {orderErrors.clientId && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{orderErrors.clientId}</small>}
                  </div>

                  {clientWarning && (
                    <div className={`alert mt-4 ${clientWarning.type === 'error' ? 'alert-danger' : clientWarning.type === 'warning' ? 'alert-warning' : 'alert-info'}`} style={{ marginBottom: '16px' }}>
                      <div className="flex items-center gap-2">
                        {clientWarning.type === 'error' && <X className="w-5 h-5" />}
                        {clientWarning.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                        {clientWarning.type === 'info' && <Clock className="w-5 h-5" />}
                        <span className="font-semibold">{clientWarning.message}</span>
                      </div>
                    </div>
                  )}

                  {selectedClientInfo?.client &&
                   selectedClientInfo.client.payment_terms !== 'cash' &&
                   parseFloat(selectedClientInfo.client.credit_limit || selectedClientInfo.client.creditLimit || 0) > 0 && (
                    <div className="card mt-4" style={{ marginBottom: '16px' }}>
                      <p className="font-medium mb-2">معلومات الائتمان:</p>
                      {(() => {
                        const cl = selectedClientInfo.client;
                        const limit = parseFloat(cl.credit_limit || cl.creditLimit || 0);
                        const used = parseFloat(cl.current_balance || cl.currentCredit || 0);
                        const available = Math.max(0, limit - used);
                        const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
                        return (
                          <div className="grid grid-cols-3 gap-4">
                            <div><span className="text-gray-500 text-sm">حد الائتمان:</span><p className="font-semibold">{formatCurrency(limit)}</p></div>
                            <div><span className="text-gray-500 text-sm">المستخدم ({pct}%):</span><p className="font-semibold">{formatCurrency(used)}</p></div>
                            <div><span className="text-gray-500 text-sm">المتاح:</span><p className="font-semibold" style={{ color: available > 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(available)}</p></div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {selectedClientInfo?.client?.discount > 0 && (
                    <div className="card mt-4" style={{ background: '#fef3c7', border: '1px solid #fbbf24', marginBottom: '16px' }}>
                      <div className="flex items-center gap-2">
                        <span className="badge badge-warning" style={{ fontSize: '14px', padding: '6px 12px' }}>خصم مطبق</span>
                        <span className="font-semibold text-lg" style={{ color: '#d97706' }}>{selectedClientInfo.client.discount}% خصم</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">هذا العميل لديه خصم ثابت سيُطبق تلقائياً على هذا الطلب.</p>
                      {selectedClientInfo.client.credit_limit > 0 && (
                        <div style={{ marginTop: 8, color: '#374151', fontSize: 14 }}>
                          حد الائتمان: <strong>{parseFloat(selectedClientInfo.client.credit_limit).toLocaleString()} EGP</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 2-col: نوع الدفع | تاريخ التسليم */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                        نوع الدفع
                      </label>
                      <select 
                        value={newOrder.paymentType} 
                        onChange={(e) => setNewOrder({...newOrder, paymentType: e.target.value})}
                        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white' }}
                        onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                        onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      >
                        <option value="cash">{t('common.cash')}</option>
                        <option value="credit">{t('common.credit')}</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                        {t('orders.deliveryDate')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input 
                        type="date" 
                        value={newOrder.deliveryDate} 
                        onChange={(e) => { setOrderErrors({ ...orderErrors, deliveryDate: undefined }); setNewOrder({...newOrder, deliveryDate: e.target.value}); }}
                        style={{ width: '100%', padding: '10px 14px', border: orderErrors.deliveryDate ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none' }}
                        onFocus={(e) => { if (!orderErrors.deliveryDate) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; } }}
                        onBlur={(e) => { e.target.style.borderColor = orderErrors.deliveryDate ? '#ef4444' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      />
                      {orderErrors.deliveryDate && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{orderErrors.deliveryDate}</small>}
                    </div>
                  </div>

                  {/* 2-col: عنوان التسليم | المحافظة */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                        {t('orders.deliveryAddress')} <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input 
                        type="text" 
                        value={newOrder.deliveryAddress} 
                        onChange={(e) => { setOrderErrors({ ...orderErrors, deliveryAddress: undefined }); setNewOrder({...newOrder, deliveryAddress: e.target.value}); }}
                        placeholder="اختر عميلاً لتعبئة العنوان تلقائياً"
                        style={{ width: '100%', padding: '10px 14px', border: orderErrors.deliveryAddress ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none' }}
                        onFocus={(e) => { if (!orderErrors.deliveryAddress) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; } }}
                        onBlur={(e) => { e.target.style.borderColor = orderErrors.deliveryAddress ? '#ef4444' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      />
                      {orderErrors.deliveryAddress && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{orderErrors.deliveryAddress}</small>}
                    </div>
                    <div>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                        المحافظة <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input 
                        type="text" 
                        value={newOrder.deliveryCity} 
                        onChange={(e) => { setOrderErrors({ ...orderErrors, deliveryCity: undefined }); setNewOrder({...newOrder, deliveryCity: e.target.value}); }}
                        placeholder="اختر عميلاً لتعبئة المحافظة تلقائياً"
                        style={{ width: '100%', padding: '10px 14px', border: orderErrors.deliveryCity ? '1.5px solid #ef4444' : '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none' }}
                        onFocus={(e) => { if (!orderErrors.deliveryCity) { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; } }}
                        onBlur={(e) => { e.target.style.borderColor = orderErrors.deliveryCity ? '#ef4444' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                      />
                      {orderErrors.deliveryCity && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{orderErrors.deliveryCity}</small>}
                    </div>
                  </div>
                </div>

                {/* Section 2: عناصر الطلب */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>عناصر الطلب</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af', textTransform: 'none', letterSpacing: 'normal' }}>
                      {newOrder.items.length} منتج
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {newOrder.items.map((item, index) => {
                      const pricePerTon = getItemPricePerTon(item);
                      const bagsCount = getBagsCount(item);
                      const lineTotal = getLineTotal(item);

                      return (
                        <div key={index} style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', position: 'relative' }}>
                          {/* Sub-row 1: حذف | نوع العلف | الكمية | حجم الكيس */}
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                            {/* Remove button */}
                            {newOrder.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                title={t('common.removeItem')}
                                style={{ flexShrink: 0, width: '40px', height: '42px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <X size={16} />
                              </button>
                            )}

                            {/* نوع العلف — wide enough for full Arabic names */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>نوع العلف</label>
                              <select
                                value={item.feedTypeId}
                                onChange={(e) => updateItem(index, 'feedTypeId', e.target.value)}
                                className="feed-type-select"
                                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', background: 'white' }}
                                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                              >
                                <option key="placeholder-ft" value="">اختر نوع العلف</option>
                                {feedTypes.map((ft, ftIdx) => (
                                  <option key={`feedtype-option-${ftIdx}`} value={ft._id}>
                                    {ft.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* الكمية (طن) */}
                            <div style={{ width: '110px', flexShrink: 0 }}>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>الكمية (طن)</label>
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={item.quantityTons}
                                onChange={(e) => updateItem(index, 'quantityTons', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', textAlign: 'center' }}
                                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                                onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                              />
                            </div>

                            {/* حجم الكيس */}
                            <div style={{ flexShrink: 0 }}>
                              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>حجم الكيس</label>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap', height: '42px' }}>
                                {[10, 25, 50].map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => updateItem(index, 'packageSize', size)}
                                    style={{
                                      padding: '8px 12px',
                                      fontSize: '12px',
                                      borderRadius: '20px',
                                      border: item.packageSize === size ? '1.5px solid #3b82f6' : '1.5px solid #e5e7eb',
                                      background: item.packageSize === size ? '#eff6ff' : 'white',
                                      color: item.packageSize === size ? '#3b82f6' : '#6b7280',
                                      fontWeight: item.packageSize === size ? 600 : 400,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {size} كجم
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Sub-row 2 (muted): سعر الطن | عدد الأكياس | الإجمالي */}
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '32px', marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>سعر الطن</span>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>{pricePerTon > 0 ? formatCurrency(pricePerTon) : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>عدد الأكياس</span>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569' }}>{bagsCount > 0 ? `${bagsCount} كيس` : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto', alignItems: 'flex-end' }}>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#9ca3af' }}>الإجمالي</span>
                              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>{formatCurrency(lineTotal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* + إضافة منتج button */}
                  <button 
                    type="button" 
                    onClick={addItem}
                    style={{ width: '100%', marginTop: '12px', padding: '12px', border: '2px dashed #3b82f6', borderRadius: '8px', background: 'transparent', color: '#3b82f6', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Plus size={18} /> إضافة منتج
                  </button>
                  {orderErrors.items && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', display: 'block' }}>{orderErrors.items}</small>}
                </div>

                {/* Section 3: ملخص الطلب */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px', marginBottom: '16px' }}>
                    ملخص الطلب
                  </div>

                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>المجموع الجزئي</span>
                      <span style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>إجمالي الطلب</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                      {t('common.notes')}
                    </label>
                    <textarea 
                      value={newOrder.notes} 
                      onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})} 
                      rows={2}
                      style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', direction: 'rtl', outline: 'none', resize: 'vertical' }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: 'white' }}>
              <button 
                type="button" 
                onClick={() => { setOrderErrors({}); setShowModal(false); resetForm(); }}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <span style={{ fontSize: '13px', color: '#9ca3af' }}>
                {newOrder.items.length} منتج مضاف
              </span>
              <button 
                type="submit"
                form="newOrderForm"
                disabled={loading}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (<><span className="animate-spin" style={{ display: 'inline-block' }}>⏳</span>جاري الإنشاء...</>) : (<><Check size={18} /> إنشاء الطلب</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoicePreviewData && (
        <div className="modal-overlay">
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Header — dark navy */}
            <div style={{ background: '#1a2332', borderRadius: '12px 12px 0 0', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 700, margin: 0 }}>فاتورة</h2>
                <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>مصنع الخير للأعلاف</p>
              </div>
              <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>رقم الفاتورة:</span>
                  <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '15px' }}>{invoicePreviewData.invoiceNumber}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>الطلب:</span>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{invoicePreviewData.orderNumber}</span>
                </div>
                <button onClick={cancelInvoicePreview} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: 'white', padding: '4px 8px', cursor: 'pointer', marginTop: '4px' }}><X size={16} /></button>
              </div>
            </div>

            {/* Client & Due Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ padding: '16px 24px', borderLeft: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>الفاتورة باسم</p>
                <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '2px' }}>{invoicePreviewData.client?.name}</p>
                <p style={{ fontSize: '13px', color: '#64748b' }}>{invoicePreviewData.client?.code}</p>
              </div>
              <div style={{ padding: '16px 24px' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>تاريخ الاستحقاق</p>
                <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '2px' }}>{formatDate(invoicePreviewData.dueDate)}</p>
                <p style={{ fontSize: '13px', color: '#64748b' }}>{invoicePreviewData.creditPeriod > 0 ? `${invoicePreviewData.creditPeriod} يوم آجل` : 'نقدي'}</p>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0', width: '36px' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>البيان</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>الكمية</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>حجم الكيس</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>عدد الأكياس</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>سعر الطن</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', borderBottom: '2px solid #e2e8f0' }}>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoicePreviewData.items.length > 0 && invoicePreviewData.items[0]?.quantity
                    ? invoicePreviewData.items.map((item, index) => {
                        const pkg = item.packageSize || item.package_size || 0;
                        const qtyBags = item.quantity || 0;
                        const qtyTons = (qtyBags * pkg) / 1000;
                        const pricePerTon = parseFloat(item.unitPrice || item.unit_price || 0);
                        const totalPrice = parseFloat(item.totalPrice || item.total_price || 0);
                        const feedName = feedTypes.find(f => f._id === String(item.feedTypeId || item.feed_type_id))?.name
                          || item.feedType?.name_arabic || item.feed_type_name_ar || item.feed_type_name || 'علف';
                        return (
                          <tr key={index} style={{ background: index % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8' }}>{index + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1e293b' }}>{feedName}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{formatNumber(qtyTons, 1)} طن</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{pkg} كجم</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#475569' }}>{qtyBags} كيس</td>
                            <td style={{ padding: '10px 12px', textAlign: 'left', color: '#475569' }}>{formatCurrency(pricePerTon)}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#1e293b' }}>{formatCurrency(totalPrice)}</td>
                          </tr>
                        );
                      })
                    : <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>الإجمالي: {formatCurrency(invoicePreviewData.total || 0)}</td></tr>
                  }
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ padding: '16px 24px', borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px', marginBottom: '8px' }}>
                <span style={{ color: '#64748b', fontSize: '14px' }}>المجموع الجزئي</span>
                <span style={{ fontWeight: 600, fontSize: '14px', minWidth: '120px', textAlign: 'left' }}>{formatCurrency(invoicePreviewData.subtotal || 0)}</span>
              </div>
              {invoicePreviewData.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px', marginBottom: '8px' }}>
                  <span style={{ color: '#d97706', fontSize: '14px' }}>خصم ({invoicePreviewData.discount}%)</span>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: '#d97706', minWidth: '120px', textAlign: 'left' }}>-{formatCurrency(invoicePreviewData.discountAmount || 0)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '32px', paddingTop: '10px', borderTop: '2px solid #d1fae5', marginTop: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b' }}>المبلغ الإجمالي</span>
                <span style={{ fontWeight: 800, fontSize: '20px', color: '#10b981', minWidth: '120px', textAlign: 'left' }}>{formatCurrency(invoicePreviewData.total || 0)}</span>
              </div>
            </div>

            {/* Status + Actions */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 12px 12px' }}>
              <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '20px', padding: '6px 14px', fontSize: '13px', fontWeight: 600 }}>
                <Clock size={13} style={{ display: 'inline', marginLeft: '4px' }} /> بانتظار الدفع
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={cancelInvoicePreview} disabled={generatingInvoice}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 500, cursor: 'pointer', fontSize: '14px' }}>
                  إلغاء
                </button>
                <button type="button" onClick={confirmGenerateInvoice} disabled={generatingInvoice}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: generatingInvoice ? '#6ee7b7' : '#10b981', color: 'white', fontWeight: 600, cursor: generatingInvoice ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {generatingInvoice
                    ? <><span style={{ display: 'inline-block' }}>⏳</span> جارٍ الإنشاء...</>
                    : <><CheckCircle size={16} /> تأكيد الإنشاء</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetails && invoiceDetails && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title"><FileText className="w-6 h-6" style={{ display: 'inline', marginRight: '8px' }} />تفاصيل الفاتورة</h2>
              <button onClick={() => setShowInvoiceDetails(false)} className="modal-close"><X className="w-6 h-6" /></button>
            </div>
            <div className="modal-body">
              <div className="card mb-4" style={{ background: '#f8fafc' }}>
                <div className="card-header" style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: '#1e293b' }}>{invoiceDetails.invoiceNumber}</h3>
                      <p className="text-sm text-gray-500 mt-1">الطلب: {invoiceDetails.orderNumber}</p>
                    </div>
                    <span className={getInvoiceStatusBadgeClass(invoiceDetails.status || 'pending')} style={{ fontSize: '14px', padding: '8px 16px' }}>
                      {({'paid':'مدفوع','overdue':'متأخر','pending':'معلق'}[invoiceDetails.status] || invoiceDetails.status || 'معلق').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('orders.billTo')}</p>
                        <p className="font-semibold">{invoiceDetails.client?.name}</p>
                        <p className="text-sm text-gray-500">{invoiceDetails.client?.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">شروط الدفع</p>
                        <p className="font-semibold">{invoiceDetails.paymentType === 'cash' ? 'نقدي' : `آجل ${invoiceDetails.creditPeriod} يوم`}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">تاريخ الفاتورة</p>
                        <p className="font-semibold">{formatDate(invoiceDetails.createdAt || Date.now())}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('orders.dueDate')}</p>
                        <p className="font-semibold" style={{ color: getInvoiceStatusColor(invoiceDetails.status || 'pending') }}>
                          {invoiceDetails.dueDate ? formatDate(invoiceDetails.dueDate) : 'غير محدد'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('common.amount')}</p>
                        <p className="font-semibold" style={{ color: '#3b82f6' }}>{formatCurrency(invoiceDetails.total || 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-container mb-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>البيان</th>
                      <th className="text-center">الكمية</th>
                      <th className="text-center">حجم الكيس</th>
                      <th className="text-center">عدد الأكياس</th>
                      <th className="text-right">سعر الطن</th>
                      <th className="text-right">{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceDetails.items || []).length > 0 && invoiceDetails.items[0]?.quantity
                      ? invoiceDetails.items.map((item, index) => {
                          const pkg = item.packageSize || item.package_size || 0;
                          const qtyBags = item.quantity || 0;
                          const qtyTons = (qtyBags * pkg) / 1000;
                          const pricePerTon = parseFloat(item.unitPrice || item.unit_price || 0);
                          const totalPrice = parseFloat(item.totalPrice || item.total_price || 0);
                          const feedName = feedTypes.find(f => f._id === String(item.feedTypeId || item.feed_type_id))?.name
                            || item.feedType?.name_arabic || item.feed_type_name_ar || item.feed_type_name || 'علف';
                          return (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{feedName}</td>
                              <td className="text-center">{formatNumber(qtyTons, 1)} طن</td>
                              <td className="text-center">{pkg} كجم</td>
                              <td className="text-center">{qtyBags} كيس</td>
                              <td className="text-right">{formatCurrency(pricePerTon)}</td>
                              <td className="text-right font-medium">{formatCurrency(totalPrice)}</td>
                            </tr>
                          );
                        })
                      : <tr><td colSpan="7" className="text-center py-4 text-gray-500">البيانات غير متاحة</td></tr>
                    }
                  </tbody>
                </table>
              </div>

              <div className="card" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">{t('common.subtotal')}</span>
                    <span className="font-semibold">{formatCurrency(invoiceDetails.subtotal || invoiceDetails.amount || invoiceDetails.total || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: '2px solid #e2e8f0' }}>
                    <span className="text-lg font-bold">المبلغ الإجمالي</span>
                    <span className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{formatCurrency(invoiceDetails.total || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="card mt-4" style={{ background: '#ecfdf5', border: '1px solid #10b981' }}>
                <div className="p-4">
                  <p className="font-semibold mb-2" style={{ color: '#059669' }}>
                    <CheckCircle className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} /> حالة تدفق البيانات
                  </p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>✓ تم إنشاء مستحق في وحدة المالية</p>
                    <p>✓ تم تحديث رصيد العميل وكشف الحساب</p>
                    <p>✓ مرتبط بالطلب {invoiceDetails.orderNumber}</p>
                    <p>✓ متاح في سجل فواتير العميل</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowInvoiceDetails(false)} className="btn btn-outline">إغلاق</button>
              <button type="button" onClick={() => downloadInvoicePDF(invoiceDetails._id, invoiceDetails.invoiceNumber)} className="btn btn-primary">
                <Download className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />تنزيل PDF
              </button>
              <a href="/finance" className="btn btn-success"
                onClick={(e) => { e.preventDefault(); window.open('/finance', '_blank'); }}>
                <ExternalLink className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />عرض في المالية
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail / Review Modal */}
      {showOrderDetail && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">تفاصيل الطلب</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedOrder.orderNumber}</p>
              </div>
              <button onClick={() => setShowOrderDetail(false)} className="modal-close">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="modal-body">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">العميل</p>
                  <p className="font-semibold">{selectedOrder.client?.name}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.client?.code}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">تاريخ الطلب</p>
                  <p className="font-semibold">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">نوع الدفع</p>
                  <p className="font-semibold">{selectedOrder.paymentType === 'cash' ? 'نقدي' : `آجل ${selectedOrder.creditPeriod} يوم`}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">تاريخ التسليم</p>
                  <p className="font-semibold">{selectedOrder.deliveryDate ? formatDate(selectedOrder.deliveryDate) : '—'}</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">الحالة</p>
                <span className={getStatusBadgeClass(selectedOrder.status)}>{getStatusLabel(selectedOrder.status)}</span>
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="table-container mb-4">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>المنتج</th>
                        <th className="text-center">حجم الكيس</th>
                        <th className="text-center">الكمية</th>
                        <th className="text-right">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, idx) => {
                        const name = item.feed_type_name || item.feedType?.name || item.feedTypeName || item.name || '';
                        const qtyBags = item.quantity || 0;
                        const pkg = item.package_size || item.packageSize || 0;
                        const tons = item.quantity_tons || (qtyBags * pkg) / 1000;
                        return (
                          <tr key={idx}>
                            <td>{name || 'علف'}</td>
                            <td className="text-center">{pkg} كجم</td>
                            <td className="text-center">{formatNumber(tons, 1)} طن</td>
                            <td className="text-right">{formatCurrency(item.totalPrice || item.total_price || 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                <span className="text-lg font-semibold">إجمالي الطلب:</span>
                <span className="text-xl font-bold" style={{ color: '#3b82f6' }}>{formatCurrency(selectedOrder.total || 0)}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setShowOrderDetail(false)} className="btn btn-outline">إغلاق</button>
              {selectedOrder.status === 'pending_approval' && canApproveOrders && (
                <>
                  <button
                    type="button"
                    onClick={() => { updateOrderStatus(selectedOrder._id, 'cancelled'); setShowOrderDetail(false); }}
                    className="btn btn-danger"
                  >
                    رفض
                  </button>
                  <button
                    type="button"
                    onClick={() => { updateOrderStatus(selectedOrder._id, 'processing'); setShowOrderDetail(false); }}
                    className="btn btn-success"
                  >
                    اعتماد
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClientDetail && (
        <div className="modal-overlay">
          <div className="modal modal-large modal-wide" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{selectedClientDetail.client.name}</h2>
                <p className="text-gray-600 text-sm">الكود: {selectedClientDetail.client.code}</p>
              </div>
              <button onClick={() => setSelectedClientDetail(null)} className="modal-close">
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
                {selectedClientDetail.client.liabilities?.filter(l => l.status === 'overdue').length > 0 && (
                  <span className="badge badge-danger text-xs">
                    {selectedClientDetail.client.liabilities.filter(l => l.status === 'overdue').length}
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
              {clientDetailLoading ? (
                <div className="text-center py-8">جاري التحميل...</div>
              ) : (
                <>
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
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-sm text-gray-600">إجمالي المستحقات</p>
                          <p className="text-xl font-bold text-gray-900">
                            {formatCurrency(selectedClientDetail.summary.totalPending || 0)}
                          </p>
                        </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm">
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            {t('common.statuses.overdue')}
                          </p>
                          <p className="text-xl font-bold text-red-600">
                            {formatCurrency((selectedClientDetail.pendingInvoices || []).filter(i => i.status !== 'paid' && new Date(i.due_date) < new Date()).reduce((sum, i) => sum + parseFloat(i.balance_due || i.remainingAmount || 0), 0) || 0)}
                          </p>
                        </div>
                      </div>
                      {canRecordPaymentForClient(selectedClientDetail.client) && (
                        <button 
                          onClick={() => {}}
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
                      <p className="stat-value">{selectedClientDetail.summary.totalOrders}</p>
                    </div>
                    <div className="stat-card bg-green-50">
                      <p className="stat-label">{t('orders.title')}</p>
                      <p className="stat-value">{formatCurrency(selectedClientDetail.summary.totalAmount)}</p>
                    </div>
                    <div className="stat-card bg-yellow-50">
                      <p className="stat-label">{t('common.statuses.paid')}</p>
                      <p className="stat-value">{formatCurrency(selectedClientDetail.summary.totalPaid)}</p>
                    </div>
                    <div className="stat-card bg-red-50">
                      <p className="stat-label">{t('common.statuses.pending')}</p>
                      <p className="stat-value">{formatCurrency(selectedClientDetail.summary.totalPending)}</p>
                    </div>
                  </div>

                  {/* Payment Terms */}
                  <div className="card mb-6">
                    <h3 className="card-title">شروط الدفع</h3>
                    <div className="flex gap-4 flex-wrap">
                      <span className={`badge ${selectedClientDetail.client.paymentType === 'cash' ? 'badge-primary' : 'badge-warning'}`}>
                        {selectedClientDetail.client.paymentType === 'cash' ? 'نقدي' : `ائتمان ${selectedClientDetail.client.creditPeriod} يوم`}
                      </span>
                      {selectedClientDetail.client.creditLimit > 0 && (
                        <span className="badge">
                          الحد: {selectedClientDetail.client.creditLimit}
                        </span>
                      )}
                      {selectedClientDetail.client.discount > 0 && (
                        <span className="badge badge-warning">
                          خصم: {selectedClientDetail.client.discount}%
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
                        <p className="font-medium">{selectedClientDetail.client.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">النوع</p>
                        <p className="font-medium capitalize">{{farm: t('clients.farm'), wholesale: t('clients.wholesale'), distributor: t('clients.distributor'), retail: t('clients.retail'), dealer: t('clients.dealer')}[selectedClientDetail.client.type] || selectedClientDetail.client.type || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">المحافظة</p>
                        <p className="font-medium">{selectedClientDetail.client.city || '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">العنوان</p>
                        <p className="font-medium">{selectedClientDetail.client.address || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Payments */}
                  {selectedClientDetail.recentPayments?.length > 0 && (
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
                            {selectedClientDetail.recentPayments.map((payment) => (
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
                      client={selectedClientDetail.client}
                      totalPaymentsReceived={selectedClientDetail.summary?.totalPaid}
                      overviewTotalPending={selectedClientDetail.summary?.totalPending}
                      overviewTotalAmount={selectedClientDetail.summary?.totalAmount}
                      overviewOverdueAmount={(selectedClientDetail.pendingInvoices || []).filter(i => i.status !== 'paid' && new Date(i.due_date) < new Date()).reduce((sum, i) => sum + parseFloat(i.balance_due || i.remainingAmount || 0), 0)}
                      onUpdate={() => {
                        openClientDetail(selectedClientDetail.client._id || selectedClientDetail.client.id);
                      }}
                    />
                  )}

                  {clientDetailTab === 'documents' && (
                    <DocumentUpload
                      entityType="client"
                      entityId={selectedClientDetail.client.id}
                      allowUpload={true}
                      useLegal={true}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}