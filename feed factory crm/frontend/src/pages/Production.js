import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { t, getLang } from '../utils/i18n';
import {
  Factory, Plus, Search, Play, CheckCircle, Clock, AlertCircle,
  Package, TrendingUp, DollarSign, ChevronRight, ArrowRight, X, ChefHat,
  TrendingDown, ShoppingCart, Truck
} from 'lucide-react';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const Production = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [formData, setFormData] = useState({
    feedTypeId: '',
    batchSize: '',
    packageSize: '50',
    scheduledDate: new Date().toISOString().split('T')[0],
    priority: 'medium',
    notes: '',
    salesOrderId: ''
  });
  const [tons, setTons] = useState('');
  const [salesOrders, setSalesOrders] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [message, setMessage] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creatingFromSuggestion, setCreatingFromSuggestion] = useState(null);
  const [suggestionPackageSize, setSuggestionPackageSize] = useState(50);
  const [productionStats, setProductionStats] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Fetch real production orders and suggestions from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, suggestionsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/production/production-orders?limit=9999`, { headers: headers() }),
        fetch(`${API_URL}/production/low-stock-suggestions`, { headers: headers() }),
        fetch(`${API_URL}/production/stats`, { headers: headers() })
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const list = Array.isArray(data) ? data : (data.orders ?? []);
        if (list.length > 0) {
          const mapped = list.map(o => ({
            _id: o.id,
            id: o.id,
            productionNumber: o.order_number || o.productionNumber,
            feedType: { name: getLang() === 'ar' ? (o.feed_name_arabic || o.feed_name_english) : (o.feed_name_arabic || o.feed_name_english) || 'غير معروف' },
            recipe: { name: getLang() === 'ar' ? (o.feed_name_arabic || o.feed_name_english) : (o.feed_name_arabic || o.feed_name_english) || 'غير معروف', costPer1000kg: o.actual_cost || 0 },
            quantityKg: parseFloat(o.quantity_kg) || 1000,
            quantityTons: (parseFloat(o.quantity_kg) || 1000) / 1000,
            packageSize: o.package_size || 50,
            numberOfBags: o.number_of_bags || Math.round((parseFloat(o.quantity_kg) || 1000) / (o.package_size || 50)),
            batchSize: parseFloat(o.quantity_kg) || 1000,
            status: o.status,
            priority: 'medium',
            scheduledDate: o.production_date || new Date().toISOString().split('T')[0],
            startDate: o.created_at,
            completionDate: o.completion_date,
            materialsStatus: o.status === 'completed' ? 'consumed' : 'ready',
            totalCost: parseFloat(o.actual_cost) || 0,
            notes: o.notes || '',
            salesOrderNumber: o.sales_order_number || null,
            salesOrderId: o.sales_order_id || null,
            clientName: o.client_name || null
          }));
          setOrders(mapped);
        } else {
          setOrders([]);
        }
      }

      if (suggestionsRes.ok) {
        const data = await suggestionsRes.json();
        setSuggestions(data.suggestions || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setProductionStats(data);
      }
    } catch (error) {
      console.error('Error fetching production data:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchFeedTypes();
  }, []);

  const fetchFeedTypes = async () => {
    try {
      const res = await fetch(`${API_URL}/feed-types`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setFeedTypes(data);
      }
    } catch (error) {
      console.error('Error fetching feed types:', error);
    }
  };

  const fetchSalesOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/sales/orders?status=processing&limit=999`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setSalesOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      setSalesOrders([]);
    }
  };

  // Recalculate kg from tons whenever tons or package size changes
  useEffect(() => {
    const t = parseFloat(tons) || 0;
    const kg = Math.round(t * 1000);
    setFormData(prev => ({ ...prev, batchSize: kg > 0 ? String(kg) : '' }));
  }, [tons]);

  // Recalculate tons from kg whenever batchSize changes externally
  useEffect(() => {
    const kg = parseFloat(formData.batchSize) || 0;
    if (kg > 0) {
      setTons(String(kg / 1000));
    }
  }, [formData.batchSize]);

  useEffect(() => {
    if (showModal) {
      fetchSalesOrders();
    }
  }, [showModal]);

  const getStatusColor = (status) => {
    const colors = {
      draft: 'badge-warning',
      approved: 'badge-info',
      in_progress: 'badge-primary',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return colors[status] || 'badge';
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'مسودة',
      approved: 'معتمد',
      in_progress: 'قيد التنفيذ',
      completed: 'مكتمل',
      cancelled: 'ملغي',
    };
    return labels[status] || status;
  };

  const getStockStatusStyle = (status) => {
    switch (status) {
      case 'critical': return { background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' };
      case 'low': return { background: '#fff3e0', color: '#ef6c00', border: '1px solid #ffcc80' };
      default: return { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' };
    }
  };

  const stats = {
    total: productionStats?.total_count ?? orders.length,
    pending: productionStats?.draft_count ?? orders.filter(o => o.status === 'draft' || o.status === 'pending_approval').length,
    approved: productionStats?.approved_count ?? orders.filter(o => o.status === 'approved').length,
    inProgress: productionStats?.in_progress_count ?? orders.filter(o => o.status === 'in_progress').length,
    completed: productionStats?.completed_count ?? orders.filter(o => o.status === 'completed').length,
    totalCost: productionStats?.total_production_cost ?? orders.reduce((sum, o) => sum + (o.totalCost || 0), 0),
    totalTons: (productionStats?.total_produced_kg ?? orders.reduce((sum, o) => sum + (o.quantityKg || 0), 0)) / 1000
  };

  // Handle creating new production order manually
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.feedTypeId) errors.feedTypeId = 'اختر نوع العلف';
    if (!formData.batchSize || parseFloat(formData.batchSize) <= 0) errors.batchSize = 'الكمية يجب أن تكون أكبر من صفر';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    try {
      const response = await fetch(`${API_URL}/production/production-orders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          feed_type_id: formData.feedTypeId,
          quantity_kg: parseFloat(formData.batchSize),
          package_size: parseInt(formData.packageSize) || 50,
          production_date: formData.scheduledDate || new Date().toISOString().split('T')[0],
          notes: formData.notes
        })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Production order ${data.order?.order_number} created successfully!` });
        setFormErrors({});
        setShowModal(false);
        setFormData({
          feedTypeId: '',
          batchSize: '',
          packageSize: '50',
          scheduledDate: new Date().toISOString().split('T')[0],
          priority: 'medium',
          notes: '',
          salesOrderId: ''
        });
        setTons('');
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create production order' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  // Handle creating production order from low-stock suggestion
  const handleCreateFromSuggestion = async (suggestion) => {
    setCreatingFromSuggestion(suggestion.feed_type_id);
    try {
      const طن = suggestion.stock_status === 'critical' ? 5 : 2; // 5 طن for critical, 2 for low
      const response = await fetch(`${API_URL}/production/create-from-suggestion`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          feed_type_id: suggestion.feed_type_id,
          quantity_طن: طن,
          package_size: suggestionPackageSize,
          auto_create_po: true,
          notes: `Auto-created for low stock: ${suggestion.feed_name_arabic}`
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        let msg = `Production order ${data.productionOrder.order_number} created (${طن} طن, ${data.productionOrder.number_of_أكياس} أكياس of ${suggestionPackageSize}kg).`;
        if (data.shortages && data.shortages.length > 0) {
          msg += ` ${data.shortages.length} material shortages detected.`;
        }
        if (data.createdPOs && data.createdPOs.length > 0) {
          msg += ` ${data.createdPOs.length} purchase orders auto-created.`;
        }
        setMessage({ type: 'success', text: msg });
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create production order' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setCreatingFromSuggestion(null);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Handle starting production via API
  const handleStartProduction = async (order) => {
    if (!order.id) {
      setMessage({ type: 'error', text: 'Order ID missing' });
      return false;
    }
    try {
      const response = await fetch(`${API_URL}/production/production-orders/${order.id}/start`, {
        method: 'PUT',
        headers: headers()
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Production ${order.productionNumber} started!` });
        await fetchData();
        return true;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start production' });
        return false;
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Handle completing production via API
  const handleCompleteProduction = async (order) => {
    if (!order.id) {
      setMessage({ type: 'error', text: 'Order ID missing' });
      return false;
    }
    try {
      const response = await fetch(`${API_URL}/production/production-orders/${order.id}/complete`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ actual_quantity_kg: order.batchSize })
      });
      const data = await response.json();
      if (response.ok) {
        let msg = `تم إكمال أمر الإنتاج ${order.productionNumber}! تمت إضافة البضائع الجاهزة إلى المخزون.`;
        if (data.sales_order_updated) {
          msg += ' تم تحديث طلب المبيعات — جاهز للتسليم.';
        }
        setMessage({ type: 'success', text: msg });
        await fetchData();
        return true;
      } else {
        setMessage({ type: 'error', text: 'فشل إكمال أمر الإنتاج: ' + (data.error || '') });
        return false;
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Handle sending linked sales order to delivery
  const handleSendToDelivery = async (order) => {
    if (!order.salesOrderId) {
      setMessage({ type: 'error', text: 'لا يوجد طلب مبيعات مرتبط' });
      return false;
    }
    try {
      const response = await fetch(`${API_URL}/orders/${order.salesOrderId}/send-to-delivery`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'تم إرسال الطلب للتوصيل بنجاح' });
        await fetchData();
        return true;
      } else {
        setMessage({ type: 'error', text: 'فشل الإرسال: ' + (data.error || '') });
        return false;
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Handle viewing order details
  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  // Filter orders
  const filteredOrders = statusFilter
    ? orders.filter(o => o.status === statusFilter)
    : orders;

  return (
    <div className="page-container">
      {/* Message Banner */}
      {message && (
        <div style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1><Factory size={28} style={{ marginRight: '12px', verticalAlign: 'middle' }} />{t('nav.production')}</h1>
          <p>{t('production.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setFormErrors({}); setShowModal(true); }}>
          <Plus size={18} /> {t('production.newOrder')}
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <Package size={24} />
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">{t('orders.totalOrders')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">{t('orders.draft')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <Play size={24} />
          </div>
          <div className="stat-value">{stats.inProgress}</div>
          <div className="stat-label">{t('production.inProgress')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}>
            <CheckCircle size={24} />
          </div>
          <div className="stat-value">{stats.completed}</div>
          <div className="stat-label">{t('production.completed')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <Package size={24} />
          </div>
          <div className="stat-value">{formatNumber(stats.totalTons)} طن</div>
          <div className="stat-label">{t('production.totalTons')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ef444420', color: '#ef4444' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-value">{formatCurrency(formatNumber(Math.round(stats.totalCost)))}</div>
          <div className="stat-label">{t('production.totalCost')}</div>
        </div>
      </div>

      {/* {t('production.lowStockSuggestions')} Panel */}
      <div className="section-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={20} color="#ef4444" />
            {t('production.lowStockSuggestions')}
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '140px' }}
              value={suggestionPackageSize}
              onChange={(e) => setSuggestionPackageSize(parseInt(e.target.value))}
            >
              <option value={10}>{t('production.bag10')}</option>
              <option value={25}>{t('production.bag25')}</option>
              <option value={50}>{t('production.bag50')}</option>
            </select>
            <button className="btn btn-sm btn-outline" onClick={() => setShowSuggestions(!showSuggestions)}>
              {showSuggestions ? t('common.hide') : t('production.showSuggestions')}
            </button>
          </div>
        </div>
        {showSuggestions && (
          <div>
              {suggestions.filter(s => s.stock_status !== 'normal').length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                جميع أنواع العلف لديها مخزون كافٍ.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {suggestions.filter(s => s.stock_status !== 'normal').map(s => (
                  <div key={s.feed_type_id} style={{
                    padding: '16px',
                    borderRadius: '8px',
                    ...getStockStatusStyle(s.stock_status),
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{s.feed_name_arabic}</strong>
                      <span style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: 'rgba(0,0,0,0.1)',
                        fontWeight: 600
                      }}>
                        {s.stock_status === 'critical' ? 'حرج' : 'منخفض'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      المخزون الحالي: <strong>{formatNumber((parseFloat(s.current_inventory_kg) / 1000))} طن</strong> ({formatNumber(parseFloat(s.current_inventory_kg))} كجم)
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                      تكلفة الوصفة: {formatCurrency(formatNumber(Math.round(parseFloat(s.recipe_cost_per_1000kg) / 100)))} / طن
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{
                        marginTop: '8px',
                        background: s.stock_status === 'critical' ? '#c62828' : '#ef6c00',
                        color: 'white',
                        border: 'none'
                      }}
                      onClick={() => handleCreateFromSuggestion(s)}
                      disabled={creatingFromSuggestion === s.feed_type_id}
                    >
                      {creatingFromSuggestion === s.feed_type_id ? t('common.creating') : (
                        <><ShoppingCart size={14} style={{ marginRight: '4px' }} /> {t('production.createOrder')}</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="section-card">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '200px' }}
          >
            <option value="">{t('common.allLabel')}</option>
            <option value="draft">{t('orders.draft')}</option>
            <option value="approved">{t('production.approved')}</option>
            <option value="in_progress">{t('production.inProgress')}</option>
            <option value="completed">{t('production.completed')}</option>
          </select>
          {statusFilter && (
              <button className="btn btn-sm btn-outline" onClick={() => setStatusFilter('')}>
              مسح الفلتر
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>{t('production.feedType')}</th>
              <th>طلب المبيعات</th>
              <th>العميل</th>
              <th>{t('common.quantity')}</th>
              <th>{t('common.status')}</th>
              <th>{t('production.scheduled')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="text-center">{t('common.loading')}</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan="9" className="text-center">{t('production.none')}</td></tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order._id}>
                  <td><strong>{order.productionNumber}</strong></td>
                  <td>{order.feedType?.name}</td>
                  <td>{order.salesOrderNumber || '-'}</td>
                  <td>{order.clientName || '-'}</td>
                  <td>
                    <div><strong>{order.quantityTons} طن</strong></div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {order.numberOfBags} x {order.packageSize}كجم
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td>{formatDate(order.scheduledDate)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {order.status === 'draft' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartProduction(order)}
                        >
                          <Play size={14} /> بدء الإنتاج
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCompleteProduction(order)}
                        >
                          <CheckCircle size={14} /> جاهز للتسليم
                        </button>
                      )}
                      {order.status === 'completed' && order.salesOrderId && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSendToDelivery(order)}
                        >
                          <Truck size={14} /> إرسال للتوصيل
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleViewOrder(order)}
                      >
                        عرض
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div className="action-bar">
        <button onClick={() => navigate('/feed-recipes')} className="btn btn-primary">
          <ArrowRight size={18} /> {t('production.viewRecipes')}
        </button>
        <button onClick={() => navigate('/inventory')} className="btn btn-secondary">
          <Package size={18} /> {t('production.checkInventory')}
        </button>
      </div>

      {/* Create Production Order Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header" style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '10px', background: '#dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb'
                }}>
                  <Factory size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                    إنشاء أمر إنتاج جديد
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                    تحديد تفاصيل دفعة الإنتاج
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* LEFT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Feed Type */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        نوع العلف <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <select
                        className="form-select"
                        style={{ minHeight: '42px' }}
                        value={formData.feedTypeId}
                        onChange={(e) => setFormData({ ...formData, feedTypeId: e.target.value })}
                        required
                      >
                        <option key="placeholder-ft" value="">اختر نوع العلف</option>
                        {feedTypes.map((ft, index) => (
                          <option key={`feedtype-option-${index}`} value={ft.id}>
                            {ft.name_arabic || ft.name_english}{ft.code ? ` — ${ft.code}` : ''}
                          </option>
                        ))}
                      </select>
                      {formErrors.feedTypeId && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.feedTypeId}</small>}
                    </div>

                    {/* Quantity: tons + kg */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        الكمية المطلوبة <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            className="form-input"
                            style={{ textAlign: 'center', fontWeight: 600, fontSize: '1rem' }}
                            value={tons}
                            onChange={(e) => setTons(e.target.value)}
                            placeholder="طن"
                            required
                          />
                          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>طن</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="form-input" style={{
                            background: '#f1f5f9', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontWeight: 600, color: '#475569', minHeight: '42px'
                          }}>
                            {formData.batchSize ? formatNumber(parseFloat(formData.batchSize)) : '—'}
                          </div>
                          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>كجم</div>
                        </div>
                      </div>
                      {formData.batchSize && formData.packageSize && (
                        <div style={{
                          marginTop: '8px', padding: '8px 12px', background: '#f0fdf4',
                          borderRadius: '8px', fontSize: '0.85rem', color: '#166534', fontWeight: 500,
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                           <Package size={14} />
                          {formatNumber(Math.ceil(parseFloat(formData.batchSize || 0) / parseInt(formData.packageSize || 50)))} كيس
                          <span style={{ color: '#86efac' }}>×</span>
                          {formData.packageSize} كجم
                        </div>
                      )}
                      {formErrors.batchSize && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.batchSize}</small>}
                    </div>

                    {/* Package Size Buttons */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">حجم العبوة</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['10', '25', '50'].map(size => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setFormData({ ...formData, packageSize: size })}
                            style={{
                              flex: 1,
                              padding: '10px 0',
                              borderRadius: '8px',
                              border: formData.packageSize === size ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                              background: formData.packageSize === size ? '#eff6ff' : '#ffffff',
                              color: formData.packageSize === size ? '#1d4ed8' : '#475569',
                              fontWeight: formData.packageSize === size ? 700 : 500,
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              transition: 'all 0.15s'
                            }}
                          >
                            {size} كجم
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Production Date */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">تاريخ بدء الإنتاج</label>
                      <input
                        type="date"
                        className="form-input"
                        style={{ minHeight: '42px' }}
                        value={formData.scheduledDate}
                        onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      />
                    </div>

                    {/* Sales Order Link */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">ربط بطلب مبيعات (اختياري)</label>
                      <select
                        className="form-select"
                        style={{ minHeight: '42px' }}
                        value={formData.salesOrderId}
                        onChange={(e) => {
                          const soId = e.target.value;
                          setFormData(prev => ({ ...prev, salesOrderId: soId }));
                          if (soId) {
                            const so = salesOrders.find(o => String(o.id) === soId || String(o._id) === soId);
                            if (so) {
                              // Auto-fill feed type if order has items with a matching feed type
                              const firstItem = so.items?.[0];
                              if (firstItem?.feed_type_id || firstItem?.feedTypeId) {
                                setFormData(prev => ({
                                  ...prev,
                                  feedTypeId: String(firstItem.feed_type_id || firstItem.feedTypeId),
                                  salesOrderId: soId
                                }));
                              }
                              // Auto-fill quantity from first item
                              const qtyTons = firstItem?.quantity_tons || (firstItem?.quantity && firstItem?.package_size ? (firstItem.quantity * firstItem.package_size) / 1000 : 0);
                              if (qtyTons > 0) {
                                setTons(String(qtyTons));
                              }
                              if (firstItem?.package_size || firstItem?.packageSize) {
                                setFormData(prev => ({
                                  ...prev,
                                  packageSize: String(firstItem.package_size || firstItem.packageSize)
                                }));
                              }
                            }
                          }
                        }}
                      >
                        <option value="">— بدون ربط —</option>
                        {salesOrders.map((so, index) => (
                          <option key={`salesorder-option-${index}`} value={so.id || so._id}>
                            {so.order_number || so.orderNumber} — {so.client?.name || so.client_name}
                          </option>
                        ))}
                      </select>
                      {salesOrders.length === 0 && (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                          لا توجد طلبات مبيعات قيد المعالجة حالياً
                        </p>
                      )}
                    </div>

                    {/* Priority */}
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">الأولوية</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { value: 'low', label: 'منخفضة', color: '#10b981' },
                          { value: 'medium', label: 'متوسطة', color: '#f59e0b' },
                          { value: 'high', label: 'عالية', color: '#ef4444' }
                        ].map(p => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, priority: p.value })}
                            style={{
                              flex: 1,
                              padding: '8px 0',
                              borderRadius: '8px',
                              border: formData.priority === p.value ? `2px solid ${p.color}` : '1px solid #e2e8f0',
                              background: formData.priority === p.value ? `${p.color}15` : '#ffffff',
                              color: formData.priority === p.value ? p.color : '#475569',
                              fontWeight: formData.priority === p.value ? 700 : 500,
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              transition: 'all 0.15s'
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes — full width */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">ملاحظات</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                    placeholder="أي ملاحظات إضافية حول أمر الإنتاج..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
                {/* Summary line */}
                {formData.batchSize && formData.packageSize && (
                  <div style={{
                    padding: '10px 14px',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    fontSize: '0.9rem',
                    color: '#1e40af',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    justifyContent: 'center'
                  }}>
                    <Factory size={16} />
                    سيتم إنتاج {formatNumber(parseFloat(formData.batchSize) / 1000, { decimals: 2 })} طن
                    = {formatNumber(Math.ceil(parseFloat(formData.batchSize || 0) / parseInt(formData.packageSize || 50)))} كيس
                    × {formData.packageSize} كجم
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setFormErrors({}); setShowModal(false); }}>
                    إلغاء
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Factory size={18} />
                    إنشاء أمر الإنتاج
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('production.orderDetails')}</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>{t('production.orderInfo')}</h3>
                  <table style={{ width: '100%', fontSize: '0.9rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>رقم الطلب:</td>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{selectedOrder.productionNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>نوع العلف:</td>
                        <td style={{ padding: '8px 0' }}>{selectedOrder.feedType?.name}</td>
                      </tr>
                      {selectedOrder.salesOrderNumber && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>طلب المبيعات:</td>
                          <td style={{ padding: '8px 0', fontWeight: 600 }}>{selectedOrder.salesOrderNumber}</td>
                        </tr>
                      )}
                      {selectedOrder.clientName && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>العميل:</td>
                          <td style={{ padding: '8px 0' }}>{selectedOrder.clientName}</td>
                        </tr>
                      )}
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>الكمية:</td>
                        <td style={{ padding: '8px 0' }}>
                          <strong>{selectedOrder.quantityTons} طن</strong>
                          <span style={{ color: '#64748b', marginLeft: '8px' }}>
                            ({selectedOrder.numberOfBags} × {selectedOrder.packageSize}كجم)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>التكلفة الإجمالية:</td>
                        <td style={{ padding: '8px 0', fontWeight: 600, color: '#3b82f6' }}>
                          {formatCurrency(formatNumber(Math.round(selectedOrder.totalCost)))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 style={{ marginBottom: '16px', color: '#1e293b' }}>{t('production.statusDates')}</h3>
                  <table style={{ width: '100%', fontSize: '0.9rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>الحالة:</td>
                        <td style={{ padding: '8px 0' }}>
                          <span className={`badge ${getStatusColor(selectedOrder.status)}`}>
                            {getStatusLabel(selectedOrder.status)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>المجدول:</td>
                        <td style={{ padding: '8px 0' }}>{formatDate(selectedOrder.scheduledDate)}</td>
                      </tr>
                      {selectedOrder.startDate && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>تاريخ البدء:</td>
                          <td style={{ padding: '8px 0' }}>{formatDate(selectedOrder.startDate)}</td>
                        </tr>
                      )}
                      {selectedOrder.completionDate && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>{t('production.completed')}:</td>
                          <td style={{ padding: '8px 0' }}>{formatDate(selectedOrder.completionDate)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedOrder.notes && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ marginBottom: '8px', color: '#1e293b' }}>{t('common.notes')}</h3>
                  <p style={{ color: '#64748b', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                {selectedOrder.status === 'draft' && (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      const success = await handleStartProduction(selectedOrder);
                      if (success) setShowDetailModal(false);
                    }}
                  >
                    <Play size={18} /> بدء الإنتاج
                  </button>
                )}
                {selectedOrder.status === 'in_progress' && (
                  <button
                    className="btn btn-success"
                    onClick={async () => {
                      const success = await handleCompleteProduction(selectedOrder);
                      if (success) setShowDetailModal(false);
                    }}
                  >
                    <CheckCircle size={18} /> جاهز للتسليم
                  </button>
                )}
                {selectedOrder.status === 'completed' && selectedOrder.salesOrderId && (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      const success = await handleSendToDelivery(selectedOrder);
                      if (success) setShowDetailModal(false);
                    }}
                  >
                    <Truck size={18} /> إرسال للتوصيل
                  </button>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;
