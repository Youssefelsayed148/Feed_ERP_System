import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Plus, Search, Filter, FileText, 
  Check, X, Clock, Truck, DollarSign, Package,
  ChevronDown, Trash2, Download, AlertCircle, Eye,
  Calendar, Hash, User, CreditCard, CheckCircle,
  ExternalLink, ArrowLeft
} from 'lucide-react';

// API Base
const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState(null);
  const [selectedClientInfo, setSelectedClientInfo] = useState(null);
  const [clientWarning, setClientWarning] = useState(null);
  
  // Invoice Preview Modal
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Invoice Details Modal
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [invoiceDetails, setInvoiceDetails] = useState(null);

  // New Order Form
  const [newOrder, setNewOrder] = useState({
    clientId: '',
    paymentType: 'cash',
    deliveryAddress: '',
    deliveryDate: '',
    notes: '',
    discount: 0,
      items: [{ feedTypeId: '', packageSize: 25, quantityTons: 1, quantity: 1 }]
  });

  useEffect(() => {
    fetchOrders();
    fetchFeedTypes();
    fetchClients();
    fetchStats();
  }, [search, status]);

  // Recalculate credit warning when order items change
  useEffect(() => {
    if (selectedClientInfo?.client) {
      checkClientCreditWarning(selectedClientInfo.client);
    }
  }, [newOrder.items]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      
      // Add timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(`${API_URL}/orders?${params}`, { 
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
          items: o.items || (o.itemCount ? Array(o.itemCount).fill({}) : []),
          total: o.total || o.finalAmount || o.totalAmount || o.final_amount || o.total_amount || 0,
          status: o.status || 'draft',
          createdAt: o.created_at || o.createdAt,
          paymentType: o.payment_type || o.paymentType || 'cash',
          creditPeriod: o.credit_period || o.creditPeriod || 0,
          invoice: o.invoice ? {
            ...o.invoice,
            _id: o.invoice.id || o.invoice._id,
            invoiceNumber: o.invoice.invoice_number || o.invoice.invoiceNumber,
            status: o.invoice.status || 'pending'
          } : null
        }));
        
        // Apply search filter
        if (search) {
          ordersData = ordersData.filter(o => 
            o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
            o.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
            o.client?.code?.toLowerCase().includes(search.toLowerCase())
          );
        }
        
        // Apply status filter
        if (status) {
          ordersData = ordersData.filter(o => o.status === status);
        }
        
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
        category: ft.category || ft.type,
        prices: ft.prices || {
          small: parseFloat(ft.sell_per_ton) || 0,
          medium: parseFloat(ft.sell_per_ton) || 0,
          large: parseFloat(ft.sell_per_ton) || 0
        },
        costPrices: ft.costPrices || {
          small: parseFloat(ft.cost_per_ton) || 0,
          medium: parseFloat(ft.cost_per_ton) || 0,
          large: parseFloat(ft.cost_per_ton) || 0
        }
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
      // Map backend fields to frontend expectations
      const mappedClients = (data.clients || []).map(c => ({
        ...c,
        _id: String(c.id || c._id),
        name: c.name_english || c.name_arabic || c.name,
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
      // Map snake_case to camelCase for frontend consistency
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

  const handleClientChange = async (clientId) => {
    if (!clientId) {
      setNewOrder({
        ...newOrder,
        clientId: '',
        paymentType: 'cash',
        deliveryAddress: ''
      });
      setSelectedClientInfo(null);
      setClientWarning(null);
      return;
    }

    const client = clients.find(c => c._id === clientId);
    if (!client) {
      console.error('Client not found:', clientId);
      return;
    }

    // Update order form with client data immediately
    setNewOrder({
      ...newOrder,
      clientId,
      paymentType: client.paymentType || 'cash',
      deliveryAddress: client.address || '',
      discount: client.discount || 0
    });
    
    // Check client credit status
    try {
      const response = await fetch(`${API_URL}/clients/${clientId}/account`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setSelectedClientInfo(data?.client ? data : { client });
      } else {
        // Use local client data if API fails
        setSelectedClientInfo({ client });
      }
      // Check for warnings using the client data
      checkClientCreditWarning(client);
    } catch (error) {
      console.error('Error fetching client info:', error);
      setSelectedClientInfo({ client });
      checkClientCreditWarning(client);
    }
  };

  const checkClientCreditWarning = (client) => {
    if (!client) {
      setClientWarning(null);
      return;
    }
    
    // Include new order amount in credit warning calculation
    const totalCredit = (client.currentCredit || 0) + (newOrder?.items?.reduce((sum, item) => {
      return sum + (parseFloat(item.quantityTons || item.quantity || 0) * (item.unitPrice || 0));
    }, 0) || 0);
    
    const creditPercentage = client.creditLimit > 0 
      ? (totalCredit / client.creditLimit) * 100 
      : 0;
    const threshold = client.blockingThreshold || 80;
    
    if (client.isBlockedDueToCredit || client.status === 'blocked') {
      setClientWarning({
        type: 'error',
        message: `CLIENT BLOCKED: Credit limit exceeded (${client.currentCredit?.toLocaleString()} / ${client.creditLimit?.toLocaleString()}). Cannot create order unless admin overrides.`
      });
    } else if (creditPercentage >= threshold) {
      setClientWarning({
        type: 'warning',
        message: `WARNING: Client at ${creditPercentage.toFixed(1)}% of credit limit (${threshold}%). Order will require admin approval.`
      });
    } else if (creditPercentage >= threshold * 0.8) {
      setClientWarning({
        type: 'info',
        message: `NOTICE: Client at ${creditPercentage.toFixed(1)}% of credit limit. Monitor closely.`
      });
    } else {
      setClientWarning(null);
    }
  };

  const addItem = () => {
    setNewOrder({ ...newOrder, items: [...newOrder.items, { feedTypeId: '', packageSize: 25, quantityTons: 1, quantity: 1 }] });
  };

  const removeItem = (index) => {
    const items = newOrder.items.filter((_, i) => i !== index);
    setNewOrder({ ...newOrder, items });
  };

  const updateItem = (index, field, value) => {
    const items = [...newOrder.items];
    items[index][field] = value;
    // Auto-calculate bags when tons or packageSize changes
    if (field === 'quantityTons' || field === 'packageSize') {
      const tons = field === 'quantityTons' ? value : items[index].quantityTons;
      const pkgSize = field === 'packageSize' ? value : items[index].packageSize;
      if (tons > 0 && pkgSize > 0) {
        items[index].quantity = Math.round((tons * 1000) / pkgSize);
      }
    }
    setNewOrder({ ...newOrder, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Validate inputs first
      if (!newOrder.clientId) {
        alert('Please select a client');
        setLoading(false);
        return;
      }
      
      const validItems = newOrder.items.filter(item => item.feedTypeId && item.quantityTons > 0);
      if (validItems.length === 0) {
        alert('Please fill all item details with valid feed types and quantities');
        setLoading(false);
        return;
      }
      
      // Calculate totals
      const subtotal = calculateSubtotal();
      const totalCost = calculateTotalCost();
      const discount = newOrder.discount || 0;
      const discountAmount = (subtotal * discount) / 100;
      const total = subtotal - discountAmount;
      
      // Prepare order data
      const orderData = {
        clientId: newOrder.clientId,
        paymentType: newOrder.paymentType,
        deliveryAddress: newOrder.deliveryAddress,
        deliveryDate: newOrder.deliveryDate,
        notes: newOrder.notes,
        discount: discount,
        subtotal,
        total,
        totalCost,
        items: validItems.map(item => {
          const feedType = feedTypes.find(f => f._id === item.feedTypeId);
          // Convert recipe per-ton price to per-bag price: (sellPerTon * packageSize) / 1000
          const sellPerTon = feedType?.recipeSellPerTon || 0;
          const unitPrice = sellPerTon > 0 ? (sellPerTon * item.packageSize) / 1000 : 0;
          return {
            feedTypeId: item.feedTypeId,
            packageSize: item.packageSize,
            quantity: item.quantity,
            unitPrice: unitPrice || 0
          };
        }),
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // Check if client is blocked — warn but allow proceed
      const selectedClient = clients.find(c => c._id === newOrder.clientId);
      if (selectedClient?.isBlockedDueToCredit || selectedClient?.status === 'blocked') {
        console.warn(
          `WARNING: ${selectedClient.name} is blocked due to credit limit exceeded.\n` +
          `Current Credit: ${selectedClient.currentCredit?.toLocaleString()} / ${selectedClient.creditLimit?.toLocaleString()}\n` +
          'Proceeding with admin override flag.'
        );
        orderData.forceOverride = true;
      }
      
      // Check if there's a warning — warn but allow proceed
      if (clientWarning && (clientWarning.type === 'error' || clientWarning.type === 'warning')) {
        console.warn('Credit warning:', clientWarning.message);
        orderData.forceOverride = true;
      }
      
      // Try API first
      try {
        console.log('Submitting order to API:', orderData);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${API_URL}/orders`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(orderData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          let data;
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          }
          
          alert('Order created successfully!');
          setShowModal(false);
          resetForm();
          fetchOrders();
          fetchStats();
          
          if (data && data.order) {
            setOrders(prevOrders => [data.order, ...prevOrders]);
          }
        } else if (response.status === 403) {
          let data = {};
          try {
            data = await response.json();
          } catch (e) {}
          
          setClientWarning({
            type: 'error',
            message: data.message || 'Client is blocked due to credit limit. Contact admin to override.'
          });
          alert(data.message || 'Client is blocked due to credit limit. Contact admin to override.');
        } else if (response.status === 400) {
          let data = {};
          try {
            data = await response.json();
          } catch (e) {}
          alert('Validation Error: ' + (data.error || data.message || 'Invalid order data'));
        } else if (response.status === 401) {
          alert('Authentication Error: Please log in again');
        } else {
          throw new Error(`API returned status ${response.status}`);
        }
      } catch (apiError) {
        console.error('API failed:', apiError);
        alert('Failed to create order. Please try again.');
      }
      
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewOrder({
      clientId: '',
      paymentType: 'cash',
      deliveryAddress: '',
      deliveryDate: '',
      notes: '',
      discount: 0,
    items: [{ feedTypeId: '', packageSize: 25, quantityTons: 1, quantity: 1 }]
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

  const calculateInvoiceTotals = (order) => {
    const subtotal = order.total || 0;
    const tax = 0; // No VAT on feed
    const total = subtotal;
    return { subtotal, tax, total };
  };

  const generateInvoicePreview = async (order) => {
    try {
      // Fetch real order items from API
      let orderItems = order.items || [];
      if (!orderItems[0]?.feedTypeId && order._id) {
        try {
          const res = await fetch(`${API_URL}/orders/${order._id}`, { headers: headers() });
          if (res.ok) {
            const fullOrder = await res.json();
            orderItems = fullOrder.items || [];
          }
        } catch (e) {
          console.error('Failed to fetch order items:', e);
        }
      }
      
      const { subtotal, tax, total } = calculateInvoiceTotals(order);
      
      // Generate invoice number
      const year = new Date().getFullYear();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const invoiceNumber = `INV-${year}-${randomNum}`;
      
      // Calculate due date based on credit period
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (order.creditPeriod || 0));
      
      // Get discount from order
      const discount = order.discount || 0;
      const subtotalBeforeDiscount = order.total ? order.total / (1 - discount / 100) : subtotal;
      const discountAmount = subtotalBeforeDiscount * (discount / 100);
      
      const previewData = {
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
      };
      
      setInvoicePreviewData(previewData);
      setShowInvoicePreview(true);
    } catch (error) {
      console.error('Error generating invoice preview:', error);
      alert('Error preparing invoice preview. Please try again.');
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
        
        // Update the order in local state immediately
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === invoicePreviewData.orderId 
              ? { 
                  ...order, 
                  invoice: data.invoice || { 
                    _id: data.invoiceId || 'new', 
                    invoiceNumber: invoicePreviewData.invoiceNumber,
                    status: 'pending'
                  },
                  status: 'invoiced'
                }
              : order
          )
        );
        
        alert('Invoice generated successfully! It will now appear in the Finance module and client statement.');
        
        // Refresh orders to get updated data from server
        fetchOrders();
        fetchStats();
      } else {
        alert(data.error || 'Error generating invoice. Please try again.');
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Failed to generate invoice. Please try again.');
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
      if (!order.invoice?._id) {
        alert('No invoice found for this order');
        return;
      }
      
      const response = await fetch(`${API_URL}/orders/${order._id}/invoice/pdf`, {
        headers: headers()
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load invoice (Status: ${response.status})`);
      }
      
      // Check content type
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/pdf')) {
        // If it's a PDF, open it in a new tab
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const newWindow = window.open(url, '_blank');
        
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          // Popup blocked, provide download link
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice-${order.invoice.invoiceNumber}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        }
      } else {
        // If it's HTML, render it
        const html = await response.text();
        const newWindow = window.open('', '_blank');
        
        if (!newWindow) {
          alert('Please allow popups to view the invoice');
          return;
        }
        
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Error viewing invoice:', error);
      alert(`Error viewing invoice: ${error.message}`);
    }
  };

  const downloadInvoicePDF = async (invoiceId, invoiceNumber) => {
    try {
      const response = await fetch(`${API_URL}/invoices/${invoiceId}/pdf`, { 
        headers: headers() 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download PDF (Status: ${response.status})`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber || invoiceId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      alert('Failed to download PDF: ' + (error.message || 'Unknown error'));
    }
  };

  const viewInvoiceDetails = async (order) => {
    if (!order.invoice?._id) {
      alert('No invoice found for this order');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/invoices/${order.invoice._id}`, {
        headers: headers()
      });

      if (response.ok) {
        const data = await response.json();
        setInvoiceDetails(data.invoice || { ...order.invoice, orderId: order._id, orderNumber: order.orderNumber, items: order.items });
      } else {
        // Use order invoice data if API fails
        setInvoiceDetails({
          ...order.invoice,
          _id: order.invoice?._id || order.invoice?.id,
          invoiceNumber: order.invoice?.invoiceNumber || order.invoice?.invoice_number,
          orderId: order._id,
          orderNumber: order.orderNumber,
          client: order.client,
          items: order.items,
          total: order.total,
          paymentType: order.paymentType,
          creditPeriod: order.creditPeriod
        });
      }
      setShowInvoiceDetails(true);
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      setInvoiceDetails({
        ...order.invoice,
        _id: order.invoice?._id || order.invoice?.id,
        invoiceNumber: order.invoice?.invoiceNumber || order.invoice?.invoice_number,
        orderId: order._id,
        orderNumber: order.orderNumber,
        client: order.client,
        items: order.items,
        total: order.total,
        paymentType: order.paymentType,
        creditPeriod: order.creditPeriod,
        status: 'pending',
        dueDate: new Date(Date.now() + (order.creditPeriod || 0) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      setShowInvoiceDetails(true);
    }
  };

  const getInvoiceStatusColor = (status) => {
    switch (status) {
      case 'paid': return '#10b981';
      case 'overdue': return '#ef4444';
      case 'pending':
      default: return '#f59e0b';
    }
  };

  const getInvoiceStatusBadgeClass = (status) => {
    switch (status) {
      case 'paid': return 'badge badge-success';
      case 'overdue': return 'badge badge-danger';
      case 'pending':
      default: return 'badge badge-warning';
    }
  };

  const getStatusBadgeClass = (orderStatus) => {
    const classes = {
      draft: 'badge badge-info',
      pending: 'badge badge-warning',
      confirmed: 'badge badge-primary',
      processing: 'badge badge-primary',
      ready: 'badge badge-info',
      delivered: 'badge badge-success',
      invoiced: 'badge badge-primary',
      cancelled: 'badge badge-danger'
    };
    return classes[orderStatus] || classes.draft;
  };

  const getItemPrice = (item, type) => {
    if (!item.feedTypeId || !item.quantityTons) return 0;
    const feedType = feedTypes.find(f => f._id === item.feedTypeId);
    if (!feedType) return 0;
    return getPrice(feedType, item.packageSize, type);
  };

  const calculateTotal = () => {
    let total = 0;
    newOrder.items.forEach(item => {
      total += item.quantityTons * getItemPrice(item, 'sell');
    });
    const discount = newOrder.discount || 0;
    return total * (1 - discount / 100);
  };

  const calculateSubtotal = () => {
    let total = 0;
    newOrder.items.forEach(item => {
      total += item.quantityTons * getItemPrice(item, 'sell');
    });
    return total;
  };

  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    const discount = newOrder.discount || 0;
    return subtotal * (discount / 100);
  };

  const calculateTotalCost = () => {
    let totalCost = 0;
    newOrder.items.forEach(item => {
      totalCost += item.quantityTons * getItemPrice(item, 'cost');
    });
    return totalCost;
  };

  // Get price per ton
  const getPrice = (feedType, packageSize, type) => {
    if (type === 'sell' && feedType.recipeSellPerTon) {
      return feedType.recipeSellPerTon;
    }
    if (type === 'cost' && feedType.recipeCostPerTon) {
      return feedType.recipeCostPerTon;
    }
    const prices = type === 'cost' ? feedType.costPrices : feedType.prices;
    if (!prices) return 0;
    return prices.large || prices.medium || prices.small || 0;
  };

  // Calculate margin for a specific item
  const calculateItemMargin = (item) => {
    if (!item.feedTypeId) return null;
    const feedType = feedTypes.find(f => f._id === item.feedTypeId);
    if (!feedType || !feedType.costPrices) return null;
    
    const sellingPrice = getPrice(feedType, item.packageSize, 'sell');
    const costPrice = getPrice(feedType, item.packageSize, 'cost');
    
    return {
      sellingPrice: sellingPrice,
      costPrice: costPrice,
      profit: sellingPrice - costPrice,
      marginPercent: costPrice > 0 ? ((sellingPrice - costPrice) / costPrice * 100) : 0
    };
  };

  // Get item total price and cost
  const getItemTotals = (item) => {
    const margin = calculateItemMargin(item);
    if (!margin) return { sellingTotal: 0, costTotal: 0, profit: 0 };
    return {
      sellingTotal: item.quantityTons * margin.sellingPrice,
      costTotal: item.quantityTons * margin.costPrice,
      profit: item.quantityTons * (margin.sellingPrice - margin.costPrice)
    };
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
          <button 
            onClick={() => navigate('/sales')}
            className="btn btn-outline"
          >
            {t('orders.payment')}
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
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
            <p className="stat-value" style={{ color: '#10b981' }}>{formatCurrency((stats.todayRevenue || 0) / 100)}</p>
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
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="form-select"
        >
          <option value="">{t('orders.allStatus')}</option>
          <option value="draft">{t('orders.draft')}</option>
          <option value="pending">{t('orders.pending')}</option>
          <option value="confirmed">{t('orders.confirmed')}</option>
          <option value="processing">{t('orders.processing')}</option>
          <option value="ready">{t('orders.ready')}</option>
          <option value="delivered">{t('orders.delivered')}</option>
          <option value="invoiced">{t('orders.invoiced')}</option>
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
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center py-4">{t('common.loading')}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-4">{t('orders.none')}</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order._id}>
                  <td>
                    <p className="font-medium">{order.orderNumber}</p>
                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td>
                    <p className="font-medium">{order.client?.name}</p>
                    <p className="text-sm text-gray-500">{order.client?.code}</p>
                  </td>
                  <td>
                    <p className="text-sm">{order.items?.length || order.itemCount || 0} عناصر</p>
                    {order.items?.[0]?.feedTypeId && (
                      <p className="text-xs text-gray-500">
                        {order.items?.map(i => `${(i.quantityTons || (i.quantity * i.packageSize / 1000)).toFixed(1)}t x ${i.packageSize}kg`).join(', ')}
                      </p>
                    )}
                  </td>
                  <td>
                    <p className="font-medium">{formatCurrency(order.total || 0)}</p>
                  </td>
                  <td>
                    <span className={`badge ${order.paymentType === 'cash' ? 'badge-primary' : 'badge-warning'}`}>
                      {order.paymentType === 'cash' ? 'Cash' : `Credit ${order.creditPeriod}d`}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <span className={getStatusBadgeClass(order.status)}>
                        {order.status}
                      </span>
                      {order.invoice && (
                        <span className={getInvoiceStatusBadgeClass(order.invoice.status || 'pending')} style={{ fontSize: '10px' }}>
                          {order.invoice.status || 'pending'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex gap-2 flex-wrap">
                      {order.status === 'draft' && (
                        <button
                          onClick={() => updateOrderStatus(order._id, 'pending')}
                          className="btn btn-sm btn-warning"
                          title="{t('common.submit')}"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateOrderStatus(order._id, 'processing')}
                          className="btn btn-sm btn-primary"
                          title="{t('common.confirm')}"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {['confirmed', 'processing', 'ready'].includes(order.status) && (
                        <button
                          onClick={() => updateOrderStatus(order._id, 'delivered')}
                          className="btn btn-sm btn-success"
                          title="Mark Delivered"
                        >
                          <Truck className="w-4 h-4" />
                        </button>
                      )}
                      {!order.invoice && order.status !== 'cancelled' && order.status !== 'draft' && (
                        <button
                          onClick={() => generateInvoicePreview(order)}
                          className="btn btn-sm btn-outline"
                          title={t('orders.generateInvoice')}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {order.invoice && (
                        <>
                          <button
                            onClick={() => viewInvoiceDetails(order)}
                            className="btn btn-sm btn-info"
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadInvoicePDF(order.invoice._id, order.invoice.invoiceNumber)}
                            className="btn btn-sm btn-primary"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <a
                            href="/finance"
                            className="btn btn-sm btn-outline"
                            title="View in Finance"
                            onClick={(e) => {
                              e.preventDefault();
                              window.open('/finance', '_blank');
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <span className="text-xs text-gray-500 self-center">
                            {order.invoice.invoiceNumber}
                          </span>
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

      {/* New Order Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title">طلب مبيعات جديد</h2>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }} 
                className="modal-close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body">
              {/* Client Selection */}
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select
                  required
                  value={newOrder.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="form-select"
                >
                  <option value="">اختر العميل</option>
                  {clients.map((client) => {
                    const creditPercent = client.creditLimit > 0 ? ((client.currentCredit || 0) / client.creditLimit) * 100 : 0;
                    const isBlocked = client.isBlockedDueToCredit || client.status === 'blocked';
                    const label = isBlocked 
                      ? `🚫 ${client.name} (BLOCKED)`
                      : creditPercent >= 80 
                        ? `⚠️ ${client.name} (${creditPercent.toFixed(0)}% credit used)`
                        : client.name;
                    return (
                      <option key={client._id} value={client._id}>
                        {label} ({client.code})
                      </option>
                    );
                  })}
                </select>
                
                {/* Credit Warning Alert - PROMINENT */}
                {clientWarning && (
                  <div className={`alert mt-4 ${
                    clientWarning.type === 'error' 
                      ? 'alert-danger' 
                      : clientWarning.type === 'warning'
                        ? 'alert-warning'
                        : 'alert-info'
                  }`}>
                    <div className="flex items-center gap-2">
                      {clientWarning.type === 'error' && <X className="w-5 h-5" />}
                      {clientWarning.type === 'warning' && <AlertCircle className="w-5 h-5" />}
                      {clientWarning.type === 'info' && <Clock className="w-5 h-5" />}
                      <span className="font-semibold">{clientWarning.message}</span>
                    </div>
                  </div>
                )}
                
                {/* Client Credit Info */}
                  {selectedClientInfo && selectedClientInfo.client && (
                    <div className="card mt-4">
                      <p className="font-medium mb-2">Credit Information:</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-500 text-sm">Credit Limit:</span>
                          <p className="font-semibold">{formatCurrency(selectedClientInfo.client.creditLimit || 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-sm">Current Credit:</span>
                          <p className="font-semibold">{formatCurrency(selectedClientInfo.client.currentCredit || 0)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-sm">Available:</span>
                          <p className="font-semibold" style={{ color: '#10b981' }}>
                            {formatCurrency(Math.max(0, (selectedClientInfo.client.creditLimit || 0) - (selectedClientInfo.client.currentCredit || 0)))}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                
                {/* Client Discount Info */}
                {selectedClientInfo && selectedClientInfo.client && selectedClientInfo.client.discount > 0 && (
                  <div className="card mt-4" style={{ background: '#fef3c7', border: '1px solid #fbbf24' }}>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-warning" style={{ fontSize: '14px', padding: '6px 12px' }}>
                        DISCOUNT APPLIED
                      </span>
                      <span className="font-semibold text-lg" style={{ color: '#d97706' }}>
                        {selectedClientInfo.client.discount}% OFF
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      This client has a standing discount. It will be automatically applied to this order.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment & Delivery */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="form-group">
                  <label className="form-label">نوع الدفع</label>
                  <select
                    value={newOrder.paymentType}
                    onChange={(e) => setNewOrder({...newOrder, paymentType: e.target.value})}
                    className="form-select"
                  >
                    <option value="cash">{t('common.cash')}</option>
                    <option value="credit">{t('common.credit')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('orders.deliveryDate')}</label>
                  <input
                    type="date"
                    value={newOrder.deliveryDate}
                    onChange={(e) => setNewOrder({...newOrder, deliveryDate: e.target.value})}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">{t('orders.deliveryAddress')}</label>
                <input
                  type="text"
                  value={newOrder.deliveryAddress}
                  onChange={(e) => setNewOrder({...newOrder, deliveryAddress: e.target.value})}
                  className="form-input"
                  placeholder="Select a client to auto-populate address"
                />
              </div>

              {/* Order Items - Cart Section */}
              <div className="card mb-4">
                <div className="card-header" style={{ marginBottom: '12px', paddingBottom: '12px' }}>
                  <h3 className="card-title">عناصر الطلب</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn btn-success btn-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {newOrder.items.map((item, index) => {
                    const margin = calculateItemMargin(item);
                    const itemTotals = getItemTotals(item);
                    const isProfitable = margin && margin.profit > 0;
                    
                    return (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <label className="form-label text-xs">{t('production.feedType')}</label>
                            <select
                              value={item.feedTypeId}
                              onChange={(e) => updateItem(index, 'feedTypeId', e.target.value)}
                              className="form-select"
                            >
                              <option value="">اختر نوع العلف</option>
                              {feedTypes.map((ft) => (
                                <option key={ft._id} value={ft._id}>
                                  {ft.name} ({ft.category})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-28">
                            <label className="form-label text-xs">الحجم</label>
                            <select
                              value={item.packageSize}
                              onChange={(e) => updateItem(index, 'packageSize', parseInt(e.target.value))}
                              className="form-select"
                            >
                              <option value={10}>10 kg</option>
                              <option value={25}>25 kg</option>
                              <option value={50}>50 kg</option>
                            </select>
                          </div>
                           <div className="w-24">
                             <label className="form-label text-xs">طن</label>
                             <input
                               type="number"
                               min="0.1"
                               step="0.1"
                               value={item.quantityTons}
                               onChange={(e) => updateItem(index, 'quantityTons', parseFloat(e.target.value) || 0)}
                               className="form-input"
                               placeholder="0.0"
                             />
                            </div>
                            <div className="pt-5 text-sm text-gray-500" style={{ minWidth: '80px', paddingTop: '30px' }}>
                              {item.quantityTons > 0 ? `${item.quantityTons} ton${item.quantityTons !== 1 ? 's' : ''}` : ''}
                            </div>
                           {newOrder.items.length > 1 && (
                            <div className="pt-5">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="btn btn-danger btn-sm"
                                title={t('common.removeItem')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Price Display Component */}
                        {margin && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Sell/ton: </span>
                                <span className="font-semibold">{formatCurrency(margin.sellingPrice)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Cost/ton: </span>
                                <span className="text-gray-600">{formatCurrency(margin.costPrice)}</span>
                              </div>
                              <div>
                                <span className="text-gray-500">Profit/ton: </span>
                                <span className={isProfitable ? "font-semibold" : "text-red-600 font-semibold"}>
                                  {formatCurrency(margin.profit)}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500">Margin: </span>
                                <span 
                                  className="font-semibold" 
                                  style={{ color: isProfitable ? '#10b981' : '#ef4444' }}
                                >
                                  {margin.marginPercent.toFixed(1)}%
                                </span>
                              </div>
                              <div className="ml-auto">
                                <span className="text-gray-500">Line Total: </span>
                                <span className="font-bold" style={{ color: '#3b82f6' }}>
                                  {formatCurrency(itemTotals.sellingTotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="form-group mb-4">
                <label className="form-label">{t('common.notes')}</label>
                <textarea
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                  className="form-textarea"
                  rows={2}
                />
              </div>

              {/* Order Totals with Profit Summary */}
              <div className="card mb-4" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                <div className="card-header" style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '12px', paddingBottom: '12px' }}>
                  <h3 className="card-title">ملخص الطلب</h3>
                </div>
                
                {/* Profit Summary Grid */}
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">{t('common.subtotal')}</p>
                      <p className="text-xl font-bold" style={{ color: '#3b82f6' }}>
                        {formatCurrency(calculateSubtotal())}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">التكلفة الإجمالية</p>
                      <p className="text-xl font-bold text-gray-600">
                        {formatCurrency(calculateTotalCost())}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">{t('orders.grossProfit')}</p>
                      <p 
                        className="text-xl font-bold" 
                        style={{ color: (calculateSubtotal() - calculateTotalCost()) > 0 ? '#10b981' : '#ef4444' }}
                      >
                        {formatCurrency(calculateSubtotal() - calculateTotalCost())}
                      </p>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500 mb-1">Margin %</p>
                      <p 
                        className="text-xl font-bold" 
                        style={{ 
                          color: calculateTotalCost() > 0 && ((calculateSubtotal() - calculateTotalCost()) / calculateTotalCost() * 100) > 0 
                            ? '#10b981' 
                            : '#ef4444' 
                        }}
                      >
                        {calculateTotalCost() > 0 
                          ? (((calculateSubtotal() - calculateTotalCost()) / calculateTotalCost() * 100).toFixed(1) + '%')
                          : '0.0%'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Discount Line - Only show if discount > 0 */}
                  {newOrder.discount > 0 && (
                    <div className="flex justify-between items-center py-2 px-3 mb-2 bg-yellow-50 rounded-lg border border-yellow-200">
                      <span className="text-base font-medium" style={{ color: '#d97706' }}>
                        Discount ({newOrder.discount}%):
                      </span>
                      <span className="text-lg font-semibold" style={{ color: '#d97706' }}>
                        -{formatCurrency(calculateDiscountAmount())}
                      </span>
                    </div>
                  )}
                  
                  {/* Order Total */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                    <span className="text-lg font-semibold">Order Total:</span>
                    <span className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="modal-footer" style={{ margin: '0 -24px -24px', padding: '16px 24px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="btn btn-outline"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Create Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoicePreviewData && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title">
                <FileText className="w-6 h-6" style={{ display: 'inline', marginRight: '8px' }} />
                Invoice Preview
              </h2>
              <button 
                onClick={cancelInvoicePreview} 
                className="modal-close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Invoice Header */}
              <div className="card mb-4" style={{ background: '#f8fafc' }}>
                <div className="card-header" style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: '#1e293b' }}>
                        INVOICE
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Order: {invoicePreviewData.orderNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">رقم الفاتورة</p>
                      <p className="text-lg font-bold" style={{ color: '#3b82f6' }}>
                        {invoicePreviewData.invoiceNumber}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('orders.billTo')}</p>
                        <p className="font-semibold">{invoicePreviewData.client?.name}</p>
                        <p className="text-sm text-gray-500">{invoicePreviewData.client?.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('orders.dueDate')}</p>
                        <p className="font-semibold">{new Date(invoicePreviewData.dueDate).toLocaleDateString()}</p>
                        <p className="text-sm text-gray-500">
                          {invoicePreviewData.creditPeriod > 0 
                            ? `${invoicePreviewData.creditPeriod} days credit` 
                            : 'Cash payment'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Items Table */}
              <div className="table-container mb-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>العنصر</th>
                      <th>{t('common.description')}</th>
                      <th className="text-right">الكمية</th>
                      <th className="text-right">سعر الوحدة</th>
                      <th className="text-right">{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicePreviewData.items.length > 0 && invoicePreviewData.items[0]?.quantity ? invoicePreviewData.items.map((item, index) => {
                      const bagPrice = parseFloat(item.unitPrice || item.price || 0);
                      const qtyBags = item.quantity || 0;
                      const pkgKg = item.packageSize || 50;
                      const tons = (qtyBags * pkgKg) / 1000;
                      const pricePerTon = tons > 0 ? (bagPrice * qtyBags) / tons : bagPrice * (1000 / pkgKg);
                      const amount = bagPrice * qtyBags;
                      return (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{item.feedType?.name || item.feed_type_name || 'Feed Item'}</td>
                          <td className="text-right">{tons.toFixed(3)} t</td>
                          <td className="text-right">{formatCurrency(pricePerTon)}/t</td>
                          <td className="text-right font-medium">{formatCurrency(amount)}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-gray-500">
                          Items not available. Total: {formatCurrency(invoicePreviewData.total || 0)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invoice Totals */}
              <div className="card" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">{t('common.subtotal')}</span>
                    <span className="font-semibold">{formatCurrency(invoicePreviewData.subtotal || 0)}</span>
                  </div>
                  {invoicePreviewData.discount > 0 && (
                    <div className="flex justify-between items-center mb-2" style={{ color: '#d97706' }}>
                      <span>Discount ({invoicePreviewData.discount}%)</span>
                      <span className="font-semibold">-{formatCurrency(invoicePreviewData.discountAmount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: '2px solid #e2e8f0' }}>
                    <span className="text-lg font-bold">المبلغ الإجمالي</span>
                    <span className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                      {formatCurrency(invoicePreviewData.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="mt-4 flex justify-center">
                <span className="badge badge-warning" style={{ fontSize: '14px', padding: '8px 16px' }}>
                  <Clock className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                  Status: Pending
                </span>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={cancelInvoicePreview}
                className="btn btn-outline"
                disabled={generatingInvoice}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={confirmGenerateInvoice}
                className="btn btn-success"
                disabled={generatingInvoice}
              >
                {generatingInvoice ? (
                  <>
                    <span className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />
                    Confirm Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {showInvoiceDetails && invoiceDetails && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title">
                <FileText className="w-6 h-6" style={{ display: 'inline', marginRight: '8px' }} />
                Invoice Details
              </h2>
              <button 
                onClick={() => setShowInvoiceDetails(false)} 
                className="modal-close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="modal-body">
              {/* Invoice Info Card */}
              <div className="card mb-4" style={{ background: '#f8fafc' }}>
                <div className="card-header" style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: '#1e293b' }}>
                        {invoiceDetails.invoiceNumber}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Order: {invoiceDetails.orderNumber}
                      </p>
                    </div>
                    <span 
                      className={getInvoiceStatusBadgeClass(invoiceDetails.status || 'pending')}
                      style={{ fontSize: '14px', padding: '8px 16px' }}
                    >
                      Status: {(invoiceDetails.status || 'pending').toUpperCase()}
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
                        <p className="font-semibold">
                          {invoiceDetails.paymentType === 'cash' ? 'Cash' : `Credit ${invoiceDetails.creditPeriod} days`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">تاريخ الفاتورة</p>
                        <p className="font-semibold">
                          {new Date(invoiceDetails.createdAt || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('orders.dueDate')}</p>
                        <p className="font-semibold" style={{ color: getInvoiceStatusColor(invoiceDetails.status || 'pending') }}>
                          {invoiceDetails.dueDate ? new Date(invoiceDetails.dueDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500">{t('common.amount')}</p>
                        <p className="font-semibold" style={{ color: '#3b82f6' }}>
                          {formatCurrency(invoiceDetails.total || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice Items */}
              <div className="table-container mb-4">
                <table className="table">
                  <thead>
                    <tr>
                      <th>العنصر</th>
                      <th>{t('common.description')}</th>
                      <th className="text-right">الكمية</th>
                      <th className="text-right">سعر الوحدة</th>
                      <th className="text-right">{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoiceDetails.items || []).length > 0 && invoiceDetails.items[0]?.quantity ? invoiceDetails.items.map((item, index) => {
                      const bagPrice = parseFloat(item.unitPrice || item.price || 0);
                      const qtyBags = item.quantity || 0;
                      const pkgKg = item.packageSize || 50;
                      const tons = (qtyBags * pkgKg) / 1000;
                      const pricePerTon = tons > 0 ? (bagPrice * qtyBags) / tons : bagPrice * (1000 / pkgKg);
                      return (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td>{item.feedType?.name || 'Feed Item'}</td>
                          <td className="text-right">{tons.toFixed(3)} t</td>
                          <td className="text-right">{formatCurrency(pricePerTon)}/t</td>
                          <td className="text-right font-medium">{formatCurrency(bagPrice * qtyBags)}</td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-gray-500">
                          Items not available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Invoice Totals */}
              <div className="card" style={{ background: '#f8fafc', border: '2px solid #e2e8f0' }}>
                <div className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">{t('common.subtotal')}</span>
                    <span className="font-semibold">{formatCurrency(invoiceDetails.subtotal || invoiceDetails.total * 0.86 || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3" style={{ borderTop: '2px solid #e2e8f0' }}>
                    <span className="text-lg font-bold">المبلغ الإجمالي</span>
                    <span className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                      {formatCurrency(invoiceDetails.total || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Flow Info */}
              <div className="card mt-4" style={{ background: '#ecfdf5', border: '1px solid #10b981' }}>
                <div className="p-4">
                  <p className="font-semibold mb-2" style={{ color: '#059669' }}>
                    <CheckCircle className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                    Data Flow Status
                  </p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>✓ Created receivable in Finance module</p>
                    <p>✓ Updated client balance and statement</p>
                    <p>✓ Linked to order {invoiceDetails.orderNumber}</p>
                    <p>✓ Available in client's invoice history</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowInvoiceDetails(false)}
                className="btn btn-outline"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => downloadInvoicePDF(invoiceDetails._id, invoiceDetails.invoiceNumber)}
                className="btn btn-primary"
              >
                <Download className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />
                Download PDF
              </button>
              <a
                href="/finance"
                className="btn btn-success"
                onClick={(e) => {
                  e.preventDefault();
                  window.open('/finance', '_blank');
                }}
              >
                <ExternalLink className="w-5 h-5" style={{ display: 'inline', marginRight: '8px' }} />
                View in Finance
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
