import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Package, DollarSign, Truck, Factory,
  TrendingUp, AlertTriangle, CheckCircle,
  ShoppingCart, CreditCard, Calendar, RefreshCw, Eye, Box,
  Wrench, FileText,   ArrowRight, ClipboardList,
  Wallet, Receipt, FlaskConical,
  Activity, Clock
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { t } from '../utils/i18n';
import { authService } from '../services/api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
    fetchActivitySummary();
    fetchPendingApprovals();
  }, []);

  const fetchActivitySummary = async () => {
    try {
      const response = await fetch(`${API_URL}/approvals/activity/summary`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users?.length > 0) {
          const tbody = document.getElementById('owner-activity-body');
          if (tbody) {
            tbody.innerHTML = data.users.map(u => {
              const time = u.last_action_time ? new Date(u.last_action_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-';
              const date = u.last_action_time ? new Date(u.last_action_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
              return `<tr>
                <td><strong>${u.user_name}</strong></td>
                <td><span class="badge">${u.user_role}</span></td>
                <td>${u.action || '-'}</td>
                <td>${u.module_name || '-'}</td>
                <td>${u.details || '-'}</td>
                <td style="text-align:right;font-size:0.85em;color:#6b7280;white-space:nowrap">${time}<br/>${date}</td>
              </tr>`;
            }).join('');
          }
        }
      }
    } catch (e) {}
  };

  const fetchPendingApprovals = async () => {
    setApprovalsLoading(true);
    try {
      const res = await fetch(`${API_URL}/approvals/pending`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setPendingApprovals(data.requests || []);
      }
    } catch (e) {}
    setApprovalsLoading(false);
  };

  const handleApproveRequest = async (id) => {
    try {
      await fetch(`${API_URL}/approvals/approve`, {
        method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id })
      });
      fetchPendingApprovals();
    } catch (e) {}
  };

  const handleRejectRequest = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await fetch(`${API_URL}/approvals/reject`, {
        method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, reason })
      });
      fetchPendingApprovals();
    } catch (e) {}
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/dashboard`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setError(null);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(t('dashboard.failedLoad'));
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(t('dashboard.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      delivered: 'badge-success',
      completed: 'badge-success',
      paid: 'badge-success',
      active: 'badge-success',
      approved: 'badge-success',
      confirmed: 'badge-primary',
      in_progress: 'badge-primary',
      processing: 'badge-warning',
      pending: 'badge-warning',
      partial: 'badge-warning',
      draft: 'badge-secondary',
      overdue: 'badge-danger',
      cancelled: 'badge-danger'
    };
    return map[status] || 'badge-secondary';
  };

  const rawMaterialValue = stats?.materials
    ? stats.materials.reduce((sum, m) => {
        const stock = parseFloat(m?.current_stock) || 0;
        const price = parseFloat(m?.unit_price) || 0;
        return sum + (stock * price);
      }, 0)
    : 0;

  const recipeAvgCost = stats?.recipes?.length
    ? stats.recipes.reduce((sum, r) => sum + (parseFloat(r?.total_cost) || 0), 0) / stats.recipes.length
    : 0;

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-hero">
          <h1><Factory size={36} /> {t('dashboard.title')}</h1>
          <p>{t('dashboard.loadingRealtime')}</p>
        </div>
        <div className="stats-grid">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="stat-card" style={{ opacity: 0.5 }}>
              <div className="stat-value">--</div>
              <div className="stat-label">{t('common.loading')}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-hero">
          <h1><Factory size={36} /> {t('dashboard.title')}</h1>
        </div>
        <div className="alert alert-danger">
          <AlertTriangle size={20} /> {error}
          <button onClick={fetchDashboard} className="btn btn-primary" style={{ marginLeft: '15px' }}>
            <RefreshCw size={16} /> {t('dashboard.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-hero">
        <h1>
          <Factory size={36} />
          {t('dashboard.title')}
        </h1>
        <p>
          {t('dashboard.liveData', { clients: stats?.total_clients || 0, orders: stats?.total_orders || 0, recipes: stats?.total_recipes || 0 })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <Users size={24} />
          </div>
          <div className="stat-value">{stats?.total_clients || 0}</div>
          <div className="stat-label">{t('dashboard.totalClients')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#10b98120', color: '#10b981' }}>
            <ShoppingCart size={24} />
          </div>
          <div className="stat-value">{stats?.total_orders || 0}</div>
          <div className="stat-label">{t('dashboard.totalOrders')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
            <Package size={24} />
          </div>
          <div className="stat-value">{t('common.currency')} {Math.round(rawMaterialValue).toLocaleString()}</div>
          <div className="stat-label">{t('dashboard.rawMaterialsValue')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ef444420', color: '#ef4444' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-value">{t('common.currency')} {Math.round((stats?.total_revenue || 0) ).toLocaleString()}</div>
          <div className="stat-label">{t('dashboard.totalRevenue')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <Users size={24} />
          </div>
          <div className="stat-value">{stats?.total_employees || 0}</div>
          <div className="stat-label">{t('dashboard.activeEmployees')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#06b6d420', color: '#06b6d4' }}>
            <Truck size={24} />
          </div>
          <div className="stat-value">{stats?.pending_orders || 0}</div>
          <div className="stat-label">{t('dashboard.pendingOrders')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f9731620', color: '#f97316' }}>
            <ClipboardList size={24} />
          </div>
          <div className="stat-value">{stats?.pending_po_approvals || 0}</div>
          <div className="stat-label">{t('dashboard.pendingPO')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#84cc1620', color: '#84cc16' }}>
            <Wallet size={24} />
          </div>
          <div className="stat-value">{formatCurrency((stats?.total_payables || 0) )}</div>
          <div className="stat-label">{t('dashboard.totalLabel')} {t('dashboard.totalPayables')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>
            <TrendingUp size={24} />
          </div>
          <div className="stat-value">{formatCurrency((stats?.total_receivables || 0) )}</div>
          <div className="stat-label">{t('dashboard.totalLabel')} {t('dashboard.totalReceivables')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ec489920', color: '#ec4899' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="stat-value">{stats?.low_stock_count || 0}</div>
          <div className="stat-label">{t('dashboard.lowStock')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
            <Box size={24} />
          </div>
          <div className="stat-value">{(stats?.finished_goods_tons || 0).toFixed(1)} {t('common.tons')}</div>
          <div className="stat-label">{t('dashboard.finishedGoods')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#14b8a620', color: '#14b8a6' }}>
            <FlaskConical size={24} />
          </div>
          <div className="stat-value">{stats?.total_recipes || 0}</div>
          <div className="stat-label">{t('dashboard.feedRecipes')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#6366f120', color: '#6366f1' }}>
            <Wrench size={24} />
          </div>
          <div className="stat-value">{stats?.maintenance_overdue || 0}</div>
          <div className="stat-label">{t('dashboard.maintenance')}</div>
        </div>
      </div>

      {/* Business Modules Section */}
      <div className="data-grid">
        {/* Procurement KPIs */}
        <div className="section-card">
          <div className="data-table-header">
            <Package size={20} color="#f97316" />
            <h3>{t('dashboard.procurement')}</h3>
          </div>
          <div className="stats-list">
            <div className="stat-row">
              <span>{t('dashboard.pendingPO')}:</span>
              <strong>{stats?.pending_po_approvals || 0}</strong>
            </div>
            <div className="stat-row">
              <span>{t('dashboard.pendingGRN')}:</span>
              <strong>{stats?.pending_grn || 0}</strong>
            </div>
            <div className="stat-row">
              <span>{t('dashboard.lowStockAlerts')}:</span>
              <strong style={{ color: '#ef4444' }}>{stats?.low_stock_count || 0}</strong>
            </div>
            <div className="stat-row">
              <span>{t('dashboard.totalSuppliers')}:</span>
              <strong>{stats?.total_suppliers || 0}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/purchase-orders')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <FileText size={18} /> {t('dashboard.viewPurchaseOrders')}
          </button>
        </div>

        {/* Payables Summary */}
        <div className="section-card">
          <div className="data-table-header">
            <Wallet size={20} color="#84cc16" />
            <h3>{t('dashboard.payables')}</h3>
          </div>
          <div className="stats-list">
            <div className="stat-row">
              <span>{t('dashboard.totalPayables')}:</span>
              <strong>{formatCurrency((stats?.total_payables || 0) )}</strong>
            </div>
            <div className="stat-row">
              <span>{t('dashboard.overdue')}:</span>
              <strong style={{ color: '#ef4444' }}>{formatCurrency((stats?.overdue_payables || 0) )}</strong>
            </div>
            <div className="stat-row">
              <span>{t('dashboard.totalReceivables')}:</span>
              <strong>{formatCurrency((stats?.total_receivables || 0) )}</strong>
            </div>
            <div className="stat-row">
              <span>{t('common.overdueInvoices')}:</span>
              <strong>{stats?.overdue_invoices || 0}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/finance')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <Wallet size={18} /> {t('dashboard.viewFinance')}
          </button>
        </div>

        {/* Feed Recipes */}
        <div className="section-card">
          <div className="data-table-header">
            <FlaskConical size={20} color="#14b8a6" />
            <h3>{t('dashboard.feedRecipesSection')}</h3>
          </div>
          <div className="stats-list">
            <div className="stat-row">
              <span>{t('common.totalRecipes')}:</span>
              <strong>{stats?.total_recipes || 0}</strong>
            </div>
            <div className="stat-row">
              <span>{t('common.avgCost')}:</span>
              <strong>{formatCurrency(recipeAvgCost)}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/feed-recipes')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <FlaskConical size={18} /> {t('dashboard.viewRecipes')}
          </button>
        </div>

        {/* Expenses Summary */}
        <div className="section-card">
          <div className="data-table-header">
            <Receipt size={20} color="#8b5cf6" />
            <h3>{t('dashboard.expensesSummary')}</h3>
          </div>
          <div className="stats-list">
            <div className="stat-row" style={{ fontSize: '1.1em', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '10px' }}>
              <span>{t('common.totalThisMonth')}:</span>
              <strong style={{ color: '#3b82f6' }}>{formatCurrency((stats?.expenses_this_month || 0) )}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/finance/expenses')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <Receipt size={18} /> {t('dashboard.viewExpenses')}
          </button>
        </div>

        {/* Daily Orders */}
        <div className="section-card" style={{ gridColumn: 'span 2' }}>
          <div className="data-table-header">
            <ShoppingCart size={20} color="#f59e0b" />
            <h3>{t('dashboard.dailyOrders')}</h3>
          </div>
          {stats?.dailyOrders?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.orderNumber')}</th>
                  <th>{t('common.client')}</th>
                  <th>{t('common.createdBy')}</th>
                  <th>{t('common.items')}</th>
                  <th>{t('common.amount')}</th>
                  <th>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.dailyOrders.map(order => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{order.client_name}</td>
                    <td>{order.created_by_name || '-'}</td>
                    <td>{order.item_count || 0}</td>
                    <td>{formatCurrency(order.final_amount)}</td>
                    <td><span className={`badge ${order.status === 'delivered' ? 'badge-success' : order.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#6b7280', padding: '20px', textAlign: 'center' }}>{t('common.noOrdersToday')}</p>
          )}
          <button onClick={() => navigate('/orders')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <Eye size={18} /> {t('dashboard.viewAll')}
          </button>
        </div>

        {/* Pending Approvals Widget */}
        <div className="section-card">
          <div className="data-table-header">
            <ClipboardList size={20} color="#f59e0b" />
            <h3>{t('dashboard.pendingApprovals')}</h3>
          </div>
          {approvalsLoading ? (
            <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>{t('common.loading')}</p>
          ) : pendingApprovals.length > 0 ? (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {pendingApprovals.slice(0, 10).map(req => (
                <div key={req.id} style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '14px' }}>{req.module}</strong>
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>{req.notes || `${req.reference_type} #${req.reference_id}`}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>by {req.requested_by_name || req.requested_by}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-success" onClick={() => handleApproveRequest(req.id)} title={t('common.approve')}>✓</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRejectRequest(req.id)} title={t('common.reject')}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>{t('dashboard.noPendingApprovals')}</p>
          )}
        </div>

        {/* Credit Limit Clients */}
        {stats?.clientsWithCredit?.length > 0 && (
        <div className="section-card">
          <div className="data-table-header">
            <CreditCard size={20} color="#8b5cf6" />
            <h3>{t('dashboard.creditLimitClients')}</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.client')}</th>
                <th>{t('common.limit')}</th>
                <th>{t('common.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {stats.clientsWithCredit.map(client => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{formatCurrency(client.credit_limit)}</td>
                  <td>{formatCurrency(client.current_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* Cash Flow Overview */}
        <div className="section-card" style={{ gridColumn: 'span 2' }}>
          <div className="data-table-header">
            <TrendingUp size={20} color="#10b981" />
            <h3>{t('dashboard.cashFlow')}</h3>
          </div>
          <div className="cashflow-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '15px' }}>
            <div className="cashflow-item" style={{ textAlign: 'center', padding: '20px', background: '#10b98110', borderRadius: '8px' }}>
              <div style={{ fontSize: '2em', color: '#10b981' }}>+{formatCurrency((stats?.total_receivables || 0) )}</div>
              <div style={{ color: '#6b7280', marginTop: '5px' }}>{t('dashboard.totalReceivables')}</div>
            </div>
            <div className="cashflow-item" style={{ textAlign: 'center', padding: '20px', background: '#ef444410', borderRadius: '8px' }}>
              <div style={{ fontSize: '2em', color: '#ef4444' }}>-{formatCurrency((stats?.total_payables || 0) )}</div>
              <div style={{ color: '#6b7280', marginTop: '5px' }}>{t('dashboard.totalPayables')}</div>
            </div>
            <div className="cashflow-item" style={{ textAlign: 'center', padding: '20px', background: '#3b82f610', borderRadius: '8px', border: '2px solid #3b82f6' }}>
              <div style={{ fontSize: '2em', color: '#3b82f6', fontWeight: 'bold' }}>{formatCurrency(((stats?.total_receivables || 0) - (stats?.total_payables || 0)) )}</div>
              <div style={{ color: '#3b82f6', marginTop: '5px', fontWeight: 'bold' }}>{t('dashboard.netPosition')}</div>
            </div>
          </div>
        </div>

        {/* Maintenance Overview */}
        <div className="section-card">
          <div className="data-table-header">
            <Wrench size={20} color="#6366f1" />
            <h3>{t('dashboard.maintenance')}</h3>
          </div>
          <div className="stats-list">
            <div className="stat-row">
              <span style={{ color: '#ef4444' }}>{t('dashboard.overdue')}:</span>
              <strong style={{ color: '#ef4444' }}>{stats?.maintenance_overdue || 0}</strong>
            </div>
            <div className="stat-row">
              <span style={{ color: '#f59e0b' }}>{t('dashboard.dueThisWeek')}:</span>
              <strong style={{ color: '#f59e0b' }}>{stats?.maintenance_due_this_week || 0}</strong>
            </div>
            <div className="stat-row">
              <span style={{ color: '#10b981' }}>{t('dashboard.upcoming')}:</span>
              <strong style={{ color: '#10b981' }}>{stats?.maintenance_upcoming || 0}</strong>
            </div>
          </div>
          <button onClick={() => navigate('/assets')} className="btn btn-primary" style={{ marginTop: '15px', width: '100%' }}>
            <Wrench size={18} /> {t('dashboard.viewAssets')}
          </button>
        </div>
      </div>

      {/* Data Tables */}
      <div className="data-grid">
        {/* Clients Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <Users size={20} color="#3b82f6" />
            <h3>{t('dashboard.recentClients')}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.client')}</th>
                <th>{t('common.code')}</th>
                <th>{t('common.balance')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.clients || []).map(c => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.code}</td>
                  <td>{t('common.currency')} {Math.round(parseFloat(c.current_balance || 0)).toLocaleString()}</td>
                  <td><span className={getStatusBadge(c.status)}>{t('common.statuses.' + c.status)}</span></td>
                </tr>
              ))}
              {(!stats?.clients || stats.clients.length === 0) && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af' }}>{t('dashboard.noClientsFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Inventory Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <Package size={20} color="#f59e0b" />
            <h3>{t('dashboard.rawMaterials')}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.material')}</th>
                <th>{t('common.stock')}</th>
                <th>{t('common.value')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.materials || []).map(m => {
                const stock = parseFloat(m.current_stock || 0);
                const price = parseFloat(m.unit_price || 0);
                const minStock = parseFloat(m.min_stock_level || 0);
                const value = stock * price;
                const isLow = stock <= minStock;
                return (
                  <tr key={m.id} style={isLow ? { background: '#fef2f2' } : {}}>
                    <td>{m.name} {isLow && <span style={{ color: '#ef4444', fontSize: '0.8em' }}>⚠️ {t('common.low')}</span>}</td>
                    <td>{Math.round(stock).toLocaleString()} {t('common.kg')}</td>
                    <td>{t('common.currency')} {Math.round(value).toLocaleString()}</td>
                  </tr>
                );
              })}
              {(!stats?.materials || stats.materials.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af' }}>{t('dashboard.noMaterialsFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Orders Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <ShoppingCart size={20} color="#10b981" />
            <h3>{t('common.recentOrders')}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.orderNumber')}</th>
                <th>{t('common.amount')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.orders || []).map(o => (
                <tr key={o.id}>
                  <td>{o.order_number}</td>
                  <td>{t('common.currency')} {Math.round(parseFloat(o.final_amount || 0) ).toLocaleString()}</td>
                  <td><span className={getStatusBadge(o.status)}>{t('common.statuses.' + o.status)}</span></td>
                </tr>
              ))}
              {(!stats?.orders || stats.orders.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af' }}>{t('dashboard.noOrdersFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Production Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <Factory size={20} color="#8b5cf6" />
            <h3>{t('dashboard.productionOrders')}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.orderNumber')}</th>
                <th>{t('common.qtyKg')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.production || []).map(p => (
                <tr key={p.id}>
                  <td>{p.order_number}</td>
                  <td>{Math.round(parseFloat(p.quantity_kg || 0)).toLocaleString()}</td>
                  <td><span className={getStatusBadge(p.status)}>{t('common.statuses.' + p.status)}</span></td>
                </tr>
              ))}
              {(!stats?.production || stats.production.length === 0) && (
                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#9ca3af' }}>{t('dashboard.noProductionFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Invoices Table */}
        <div className="data-table-card">
          <div className="data-table-header">
            <DollarSign size={20} color="#ef4444" />
            <h3>{t('dashboard.recentInvoices')}</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.invoiceNumber')}</th>
                <th>{t('common.total')}</th>
                <th>{t('common.balance')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.invoices || []).map(i => {
                const total = parseFloat(i.amount || 0) ;
                const balance = parseFloat(i.balance_due || 0) ;
                return (
                  <tr key={i.id}>
                    <td>{i.invoice_number}</td>
                    <td>{t('common.currency')} {Math.round(total).toLocaleString()}</td>
                    <td>{balance === 0 ? t('common.paid') : `${t('common.currency')} ${Math.round(balance).toLocaleString()}`}</td>
                    <td><span className={getStatusBadge(i.status)}>{t('common.statuses.' + i.status)}</span></td>
                  </tr>
                );
              })}
              {(!stats?.invoices || stats.invoices.length === 0) && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af' }}>{t('dashboard.noInvoicesFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top 3 Suppliers We Owe */}
        <div className="data-table-card" style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(239,68,68,0.15)', border: 'none' }}>
          <div className="data-table-header" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', padding: '18px 24px' }}>
            <Wallet size={22} />
            <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>{t('dashboard.topSuppliersOwe')}</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.95em', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px' }}>{t('dashboard.totalLabel')}: {formatCurrency((stats?.total_payables || 0) )}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {(stats?.payables || []).slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: i < 2 ? '1px solid #fee2e2' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 700, fontSize: '0.85em' }}>{i + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95em' }}>{p.supplier_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{formatCurrency(parseFloat(p.balance || 0) )}</span>
                  <span className={getStatusBadge(p.status)} style={{ fontSize: '0.8em' }}>{p.status}</span>
                </div>
              </div>
            ))}
            {(!stats?.payables || stats.payables.length === 0) && (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px' }}>{t('dashboard.noOutstandingPayables')}</div>
            )}
          </div>
        </div>

        {/* Top Receivables - Clients Who Owe Us */}
        <div className="data-table-card" style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(59,130,246,0.15)', border: 'none' }}>
          <div className="data-table-header" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', padding: '18px 24px' }}>
            <TrendingUp size={22} />
            <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>{t('dashboard.clientsOweUs')}</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.95em', background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px' }}>{t('dashboard.totalLabel')}: {formatCurrency((stats?.total_receivables || 0) )}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {(stats?.clients || []).filter(c => parseFloat(c.current_balance || 0) > 0).slice(0, 3).map((c, i) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: i < 2 ? '1px solid #dbeafe' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: 700, fontSize: '0.85em' }}>{i + 1}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.95em' }}>{c.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>{formatCurrency(parseFloat(c.current_balance || 0) )}</span>
                  <span className={getStatusBadge(c.status)} style={{ fontSize: '0.8em' }}>{c.status}</span>
                </div>
              </div>
            ))}
            {(!stats?.clients || stats.clients.filter(c => parseFloat(c.current_balance || 0) > 0).length === 0) && (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: '30px' }}>{t('dashboard.noOutstandingReceivables')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="data-grid" style={{ marginTop: '20px' }}>
        <div className="data-table-card" style={{ gridColumn: 'span 2', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(139,92,246,0.12)', border: 'none' }}>
          <div className="data-table-header" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', padding: '18px 24px' }}>
            <Activity size={22} />
            <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>{t('dashboard.recentActivity')}</h3>
            <span style={{ marginLeft: 'auto', fontSize: '0.85em', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
              <Clock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
              {t('dashboard.realtimeActions')}
            </span>
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr style={{ background: '#f5f3ff' }}>
                  <th style={{ width: '50px' }}></th>
                  <th>{t('common.user')}</th>
                  <th>{t('common.action')}</th>
                  <th>{t('common.module')}</th>
                  <th>{t('common.description')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.time')}</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.activity || []).map((a, idx) => (
                  <tr key={a.id || idx} style={{ opacity: idx === 0 ? 1 : 0.7 - (idx * 0.03), fontSize: '0.95em' }}>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: a.module === 'sales' ? '#3b82f6' :
                                    a.module === 'purchase' ? '#f97316' :
                                    a.module === 'finance' ? '#10b981' :
                                    a.module === 'production' ? '#8b5cf6' :
                                    a.module === 'inventory' ? '#14b8a6' :
                                    a.module === 'hr' ? '#ec4899' : '#6b7280'
                      }}></span>
                    </td>
                    <td>
                      <strong>{a.userName || a.user_name || t('dashboard.system')}</strong>
                      <br />
                      <span style={{ fontSize: '0.8em', color: '#9ca3af' }}>{a.userRole || a.user_role || ''}</span>
                    </td>
                    <td><span className="badge" style={{ fontSize: '0.85em' }}>{a.action}</span></td>
                    <td style={{ textTransform: 'capitalize', fontSize: '0.9em' }}>{a.module || a.module_name || ''}</td>
                    <td style={{ maxWidth: '250px', fontSize: '0.9em' }}>{a.description || a.description_ar || ''}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9em' }}>
                      {a.amount ? formatCurrency((a.amount || 0) ) : '-'}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85em', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
                      <br />
                      {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}
                    </td>
                  </tr>
                ))}
                {(!stats?.activity || stats.activity.length === 0) && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af', padding: '30px' }}>{t('dashboard.noRecentActivity')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Owner Activity Tracker */}
      {['owner', 'admin'].includes(authService.getCurrentUser()?.role) && (
        <div className="data-grid" style={{ marginTop: '20px' }}>
          <div className="data-table-card" style={{ gridColumn: 'span 2', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(245,158,11,0.12)', border: 'none' }}>
            <div className="data-table-header" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', padding: '18px 24px' }}>
              <Activity size={22} />
              <h3 style={{ margin: 0, fontSize: '1.1em', fontWeight: 600 }}>Team Activity Tracker</h3>
              <span style={{ marginLeft: 'auto', fontSize: '0.85em', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '20px' }}>
                <RefreshCw size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                Last Actions
              </span>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }} id="owner-activity-panel">
              <table className="data-table">
                <thead>
                  <tr style={{ background: '#fffbeb' }}>
                    <th>User</th>
                    <th>Role</th>
                    <th>Last Action</th>
                    <th>Module</th>
                    <th>Details</th>
                    <th style={{ textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody id="owner-activity-body">
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af', padding: '20px' }}>Loading activity data...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '24px', padding: '20px', background: 'white', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <button onClick={() => navigate('/clients')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <Users size={18} /> {t('dashboard.manageClients')}
        </button>
        <button onClick={() => navigate('/orders')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <ShoppingCart size={18} /> {t('dashboard.viewOrders')}
        </button>
        <button onClick={() => navigate('/inventory')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(245,158,11,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <Package size={18} /> {t('dashboard.inventory')}
        </button>
        <button onClick={() => navigate('/purchase-orders')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(249,115,22,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <ClipboardList size={18} /> {t('dashboard.purchaseOrders')}
        </button>
        <button onClick={() => navigate('/feed-recipes')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #14b8a6, #0d9488)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(20,184,166,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <FlaskConical size={18} /> {t('dashboard.feedRecipesBtn')}
        </button>
        <button onClick={() => navigate('/finance')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <DollarSign size={18} /> {t('dashboard.finance')}
        </button>
        <button onClick={() => navigate('/finance/payables')} style={{ flex: '1 1 140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 20px', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg, #84cc16, #65a30d)', color: 'white', fontWeight: 600, fontSize: '0.9em', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(132,204,22,0.3)' }}
          onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
          <Wallet size={18} /> {t('dashboard.payablesBtn')}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
