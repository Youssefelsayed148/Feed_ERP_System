import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import {
  Factory, Plus, Search, Play, CheckCircle, Clock, AlertCircle,
  Package, TrendingUp, DollarSign, ChevronRight, ArrowRight, X, ChefHat,
  TrendingDown, ShoppingCart
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
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
    scheduledDate: '',
    priority: 'medium',
    notes: ''
  });
  const [feedTypes, setFeedTypes] = useState([]);
  const [message, setMessage] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [creatingFromSuggestion, setCreatingFromSuggestion] = useState(null);
  const [suggestionPackageSize, setSuggestionPackageSize] = useState(50);

  // Fetch real production orders and suggestions from API
  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, suggestionsRes] = await Promise.all([
        fetch(`${API_URL}/production/production-orders`, { headers: headers() }),
        fetch(`${API_URL}/production/low-stock-suggestions`, { headers: headers() })
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        const realOrders = data.orders || data;
        if (realOrders && realOrders.length > 0) {
          const mapped = realOrders.map(o => ({
            _id: o.id,
            id: o.id,
            productionNumber: o.order_number || o.productionNumber,
            feedType: { name: o.feed_name_english || o.feed_name_arabic || o.feedType?.name || 'Unknown' },
            recipe: { name: o.feed_name_english || 'Unknown', costPer1000kg: o.actual_cost || 0 },
            quantityKg: parseFloat(o.quantity_kg) || 1000,
            quantityTons: (parseFloat(o.quantity_kg) || 1000) / 1000,
            packageSize: o.package_size || 50,
            numberOfBags: o.number_of_أكياس || Math.round((parseFloat(o.quantity_kg) || 1000) / (o.package_size || 50)),
            batchSize: parseFloat(o.quantity_kg) || 1000,
            status: o.status,
            priority: 'medium',
            scheduledDate: o.production_date || new Date().toISOString().split('T')[0],
            startDate: o.created_at,
            completionDate: o.completion_date,
            materialsStatus: o.status === 'completed' ? 'consumed' : 'ready',
            totalCost: parseFloat(o.actual_cost) || 0,
            notes: o.notes || ''
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
      draft: 'Draft',
      approved: 'Approved',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
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
    total: orders.length,
    pending: orders.filter(o => o.status === 'draft').length,
    approved: orders.filter(o => o.status === 'approved').length,
    inProgress: orders.filter(o => o.status === 'in_progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
    totalCost: orders.reduce((sum, o) => sum + (o.totalCost || 0), 0),
    totalTons: orders.reduce((sum, o) => sum + (o.quantityTons || 0), 0)
  };

  // Handle creating new production order manually
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!formData.feedTypeId || !formData.batchSize) {
      setMessage({ type: 'error', text: 'Feed type and batch size are required' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
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
        setShowModal(false);
        setFormData({
          feedTypeId: '',
          batchSize: '',
          packageSize: '50',
          scheduledDate: '',
          priority: 'medium',
          notes: ''
        });
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
        setMessage({ type: 'success', text: `Production ${order.productionNumber} completed! Finished goods added to inventory.` });
        await fetchData();
        return true;
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to complete production' });
        return false;
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      return false;
    } finally {
      setTimeout(() => setMessage(null), 3000);
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
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
          <div className="stat-value">{stats.totalTons.toLocaleString()} طن</div>
          <div className="stat-label">{t('production.totalTons')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ef444420', color: '#ef4444' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-value">ج.م {Math.round(stats.totalCost).toLocaleString()}</div>
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
              <option value={50}>{t('production.bag50')}</option>
              <option value={25}>{t('production.bag25')}</option>
              <option value={10}>{t('production.bag10')}</option>
            </select>
            <button className="btn btn-sm btn-outline" onClick={() => setShowSuggestions(!showSuggestions)}>
              {showSuggestions ? 'Hide' : 'Show'} Suggestions
            </button>
          </div>
        </div>
        {showSuggestions && (
          <div>
            {suggestions.filter(s => s.stock_status !== 'normal').length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '24px' }}>
                All feed types have sufficient inventory.
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
                        {s.stock_status === 'critical' ? 'CRITICAL' : 'LOW'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px' }}>
                      Current Inventory: <strong>{(parseFloat(s.current_inventory_kg) / 1000).toLocaleString()} طن</strong> ({parseFloat(s.current_inventory_kg).toLocaleString()} kg)
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                      Recipe Cost: ج.م {Math.round(parseFloat(s.recipe_cost_per_1000kg) / 100).toLocaleString()} / ton
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
                      {creatingFromSuggestion === s.feed_type_id ? 'Creating...' : (
                        <><ShoppingCart size={14} style={{ marginRight: '4px' }} /> Create Production Order</>
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
              Clear Filter
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
              <th>{t('common.quantity')}</th>
              <th>{t('common.cost')}</th>
              <th>{t('common.status')}</th>
              <th>{t('production.scheduled')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="text-center">{t('common.loading')}</td></tr>
            ) : filteredOrders.length === 0 ? (
              <tr><td colSpan="7" className="text-center">{t('production.none')}</td></tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order._id}>
                  <td><strong>{order.productionNumber}</strong></td>
                  <td>{order.feedType?.name}</td>
                  <td>
                    <div><strong>{order.quantityTons} طن</strong></div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {order.numberOfBags} x {order.packageSize}كجم
                    </div>
                  </td>
                  <td>ج.م {Math.round(order.totalCost).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td>{new Date(order.scheduledDate).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {order.status === 'approved' && (
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartProduction(order)}
                        >
                          <Play size={14} /> Start
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleCompleteProduction(order)}
                        >
                          <CheckCircle size={14} /> Complete
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
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create {t('production.newOrder')}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Feed Type *</label>
                  <select
                    className="form-select"
                    value={formData.feedTypeId}
                    onChange={(e) => setFormData({ ...formData, feedTypeId: e.target.value })}
                    required
                  >
                    <option value="">{t('production.selectFeedType')}</option>
                    {feedTypes.map(ft => (
                      <option key={ft.id} value={ft.id}>{ft.name_english || ft.name_arabic}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch Size (kg) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.batchSize}
                    onChange={(e) => setFormData({ ...formData, batchSize: e.target.value })}
                    placeholder="e.g., 1000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">حجم العبوة (كجم)</label>
                  <select
                    className="form-select"
                    value={formData.packageSize}
                    onChange={(e) => setFormData({ ...formData, packageSize: e.target.value })}
                  >
                    <option value="50">50 كجم</option>
                    <option value="25">25 كجم</option>
                    <option value="10">10 كجم</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('production.productionDate')}</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.notes')}</label>
                  <textarea
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Order
                </button>
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
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Order Number:</td>
                        <td style={{ padding: '8px 0', fontWeight: 600 }}>{selectedOrder.productionNumber}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Feed Type:</td>
                        <td style={{ padding: '8px 0' }}>{selectedOrder.feedType?.name}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Quantity:</td>
                        <td style={{ padding: '8px 0' }}>
                          <strong>{selectedOrder.quantityTons} طن</strong>
                          <span style={{ color: '#64748b', marginLeft: '8px' }}>
                            ({selectedOrder.numberOfBags} x {selectedOrder.packageSize}كجم)
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Total Cost:</td>
                        <td style={{ padding: '8px 0', fontWeight: 600, color: '#3b82f6' }}>
                          ج.م {Math.round(selectedOrder.totalCost).toLocaleString()}
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
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Status:</td>
                        <td style={{ padding: '8px 0' }}>
                          <span className={`badge ${getStatusColor(selectedOrder.status)}`}>
                            {getStatusLabel(selectedOrder.status)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 0', color: '#64748b' }}>Scheduled:</td>
                        <td style={{ padding: '8px 0' }}>{new Date(selectedOrder.scheduledDate).toLocaleDateString()}</td>
                      </tr>
                      {selectedOrder.startDate && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>Started:</td>
                          <td style={{ padding: '8px 0' }}>{new Date(selectedOrder.startDate).toLocaleDateString()}</td>
                        </tr>
                      )}
                      {selectedOrder.completionDate && (
                        <tr>
                          <td style={{ padding: '8px 0', color: '#64748b' }}>Completed:</td>
                          <td style={{ padding: '8px 0' }}>{new Date(selectedOrder.completionDate).toLocaleDateString()}</td>
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
                {selectedOrder.status === 'approved' && (
                  <button
                    className="btn btn-primary"
                    onClick={async () => {
                      const success = await handleStartProduction(selectedOrder);
                      if (success) setShowDetailModal(false);
                    }}
                  >
                    <Play size={18} /> Start Production
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
                    <CheckCircle size={18} /> Complete Production
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
