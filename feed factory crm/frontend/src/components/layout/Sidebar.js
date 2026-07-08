import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Scale, Settings, LogOut, ChevronRight,
  ShoppingCart, Package, ClipboardList, Truck, Factory, FileText,
  DollarSign, CreditCard, TrendingUp, BookOpen, UserCheck, Clock,
  Shield, AlertTriangle, Building, Menu, X, ChevronDown, Wrench,
  Receipt, BarChart3, UserPlus, FileCheck, Gavel, HardDrive, Globe,
  ChefHat, Wallet, MessageCircle, Bot, Bell, Calendar, ArrowRight, CheckCircle,
  AlertCircle, Check, UserCircle, ClipboardCheck
} from 'lucide-react';
import { t } from '../../utils/i18n';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { authService, notificationsService } from '../../services/api';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');
const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = authService.getCurrentUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const dropdownRef = useRef(null);

  const companyLogo = localStorage.getItem('companyLogo') || 'https://sandybrown-ant-159541.hostingersite.com/wp-content/uploads/2025/12/شركة-الخير-للأعلاف-1-02.png';

  useEffect(() => {
    fetchUnreadCount();
    fetchPendingApprovals();
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchPendingApprovals();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/unread-count`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch (e) {}
  };

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`${API_URL}/approvals/pending`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setPendingApprovals(data.count || 0);
        setApprovalRequests(data.requests || []);
      }
    } catch (e) {}
  };

  const toggleDropdown = async () => {
    const next = !showDropdown;
    setShowDropdown(next);
    if (next) {
      try {
        const response = await fetch(`${API_URL}/notifications`, { headers: headers() });
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (e) {}
    }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_URL}/notifications/read-all`, { method: 'PUT', headers: headers() });
      setUnreadCount(0);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  const markRead = async (id) => {
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, { method: 'PUT', headers: headers() });
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (e) {}
  };

  const getModulePath = (notification) => {
    const map = {
      procurement: '/purchase-orders',
      sales: '/sales',
      inventory: '/inventory',
      production: '/production',
      finance: '/finance'
    };
    return map[notification.module] || '/dashboard';
  };

  const getNotificationIcon = (type) => {
    if (type.includes('pending_approval') || type.includes('approval')) return AlertCircle;
    if (type.includes('approved')) return Check;
    return Bell;
  };

  const getNotificationColor = (type) => {
    if (type.includes('pending_approval') || type.includes('approval')) return '#f59e0b';
    if (type.includes('approved')) return '#10b981';
    return '#3b82f6';
  };

  const getMenuItems = () => {
    const role = user?.role;
    const modulePermissions = user?.modulePermissions || [];
    
    const isSalesRep = role === 'sales_rep';
    const isSalesManager = role === 'sales_manager' || role === 'admin' || role === 'owner';

    const salesItems = [
      isSalesRep
        ? { path: '/sales-rep', icon: ShoppingCart, label: 'My Sales' }
        : { path: '/sales', icon: ShoppingCart, label: t('nav.sales') },
      { path: '/clients', icon: Users, label: t('nav.clients') },
      { path: '/orders', icon: ClipboardList, label: t('nav.orders') },
    ];
    
    const purchasingItems = [
      { path: '/suppliers', icon: UserCircle, label: t('nav.suppliers') },
      { path: '/purchase-orders', icon: FileText, label: t('nav.purchaseOrders') },
      { path: '/grn', icon: CheckCircle, label: t('nav.grn') },
    ];
    
    const productionItems = [
      { path: '/inventory', icon: Package, label: t('nav.inventory') },
      { path: '/feed-recipes', icon: ChefHat, label: t('nav.feedRecipes') },
      { path: '/production', icon: Factory, label: t('nav.production') },
    ];
    
    const financeItems = [
      { path: '/finance', icon: DollarSign, label: t('nav.finance') },
      { path: '/finance/receivables', icon: CreditCard, label: t('nav.receivables') },
      { path: '/finance/payables', icon: Wallet, label: t('nav.payables') },
      { path: '/finance/expenses', icon: Receipt, label: t('nav.expenses') },
      { path: '/accountant', icon: BookOpen, label: t('nav.accounting') },
    ];
    
    const adminItems = [
      { path: '/legal', icon: Scale, label: t('nav.legal') },
      { path: '/assets', icon: Wrench, label: t('nav.assets') },
      { path: '/hr', icon: UserCheck, label: t('nav.hr') },
      { path: '/delivery', icon: Truck, label: t('nav.delivery') },
    ];
    
    const settingsItems = [
      { path: '/settings', icon: Settings, label: t('nav.settings') },
    ];

    const hasModulePermission = (module) => {
      if (role === 'admin' || role === 'owner' || role === 'ceo') return true;
      // finance_manager gets hr and payroll access per permissions doc
      if (role === 'finance_manager' && (module === 'hr' || module === 'payroll')) return true;
      return modulePermissions.includes(module);
    };
    
    let menuItems = [];
    
    if (role === 'admin' || role === 'owner' || role === 'ceo') {
      menuItems.push({ path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard'), module: 'dashboard' });
    }
    
    if (hasModulePermission('sales') || hasModulePermission('clients') || hasModulePermission('orders')) {
      if (hasModulePermission('sales')) {
        menuItems.push({ path: '/sales', icon: ShoppingCart, label: t('nav.sales'), module: 'sales' });
      }
      if (hasModulePermission('clients')) {
        menuItems.push({ path: '/clients', icon: Users, label: t('nav.clients'), module: 'clients' });
      }
      if (hasModulePermission('orders')) {
        menuItems.push({ path: '/orders', icon: ClipboardList, label: t('nav.orders'), module: 'orders' });
      }
    }
    
    if (hasModulePermission('suppliers') || hasModulePermission('purchase_orders') || hasModulePermission('grn')) {
      if (hasModulePermission('suppliers')) {
        menuItems.push({ path: '/suppliers', icon: UserCircle, label: t('nav.suppliers'), module: 'suppliers' });
      }
      if (hasModulePermission('purchase_orders')) {
        menuItems.push({ path: '/purchase-orders', icon: FileText, label: t('nav.purchaseOrders'), module: 'purchase_orders' });
      }
      if (hasModulePermission('grn')) {
        menuItems.push({ path: '/grn', icon: CheckCircle, label: t('nav.grn'), module: 'grn' });
      }
    }
    
    if (hasModulePermission('inventory') || hasModulePermission('feed_recipes') || hasModulePermission('production')) {
      if (hasModulePermission('inventory')) {
        menuItems.push({ path: '/inventory', icon: Package, label: t('nav.inventory'), module: 'inventory' });
      }
      if (hasModulePermission('feed_recipes')) {
        menuItems.push({ path: '/feed-recipes', icon: ChefHat, label: t('nav.feedRecipes'), module: 'feed_recipes' });
      }
      if (hasModulePermission('production')) {
        menuItems.push({ path: '/production', icon: Factory, label: t('nav.production'), module: 'production' });
      }
    }
    
    if (hasModulePermission('finance') || hasModulePermission('receivables') || hasModulePermission('payables') || hasModulePermission('expenses') || hasModulePermission('accounting')) {
      if (hasModulePermission('finance')) {
        menuItems.push({ path: '/finance', icon: DollarSign, label: t('nav.finance'), module: 'finance' });
      }
      if (hasModulePermission('receivables')) {
        menuItems.push({ path: '/finance/receivables', icon: CreditCard, label: t('nav.receivables'), module: 'receivables' });
      }
      if (hasModulePermission('payables')) {
        menuItems.push({ path: '/finance/payables', icon: Wallet, label: t('nav.payables'), module: 'payables' });
      }
      if (hasModulePermission('expenses')) {
        menuItems.push({ path: '/finance/expenses', icon: Receipt, label: t('nav.expenses'), module: 'expenses' });
      }
      if (hasModulePermission('accounting')) {
        menuItems.push({ path: '/accountant', icon: BookOpen, label: t('nav.accounting'), module: 'accounting' });
      }
    }
    
    if (hasModulePermission('legal')) {
      menuItems.push({ path: '/legal', icon: Scale, label: t('nav.legal'), module: 'legal' });
    }
    if (hasModulePermission('assets')) {
      menuItems.push({ path: '/assets', icon: Wrench, label: t('nav.assets'), module: 'assets' });
      menuItems.push({ path: '/maintenance-reminders', icon: Calendar, label: t('nav.maintenance'), module: 'assets' });
    }
    if (hasModulePermission('hr')) {
      menuItems.push({ path: '/hr', icon: UserCheck, label: t('nav.hr'), module: 'hr' });
    }
    if (hasModulePermission('payroll')) {
      menuItems.push({ path: '/hr/payroll', icon: DollarSign, label: t('nav.payroll'), module: 'payroll' });
    }
    if (hasModulePermission('delivery')) {
      menuItems.push({ path: '/delivery', icon: Truck, label: t('nav.delivery'), module: 'delivery' });
    }

    // Approvals visible to ALL authenticated users — each sees only their relevant tabs
    menuItems.push({ path: '/approvals', icon: ClipboardCheck, label: t('nav.approvals'), module: 'approvals' });
    
    if (role === 'admin' || role === 'owner' || role === 'ceo') {
      menuItems.push({ path: '/settings', icon: Settings, label: t('nav.settings'), module: 'settings' });
    }

    return menuItems;
  };

  const menuItems = getMenuItems();

  const handleLogout = () => {
    authService.logout();
    dispatch(logout());
    window.location.href = '/login';
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('common.seconds');
    if (mins < 60) return t('common.minutes', { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('common.hours', { n: hours });
    return t('common.days', { n: Math.floor(hours / 24) });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img 
          src={companyLogo} 
          alt="شركة الخير للأعلاف" 
          className="sidebar-logo"
          style={{ height: '45px', maxWidth: '100%', objectFit: 'contain' }}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <span className="sidebar-brand" style={{ display: 'none' }}>شركة الخير للأعلاف</span>
        <div className="notification-bell" onClick={toggleDropdown} style={{ position: 'relative', cursor: 'pointer', marginLeft: 'auto', padding: '4px' }}>
          <Bell size={20} color={unreadCount > 0 ? '#f59e0b' : '#6b7280'} />
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#ef4444', color: 'white', fontSize: '10px',
              borderRadius: '50%', width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700
            }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
        {pendingApprovals > 0 && (
          <div onClick={() => navigate('/approvals')} style={{ position: 'relative', cursor: 'pointer', padding: '4px', marginLeft: '4px' }}>
            <AlertCircle size={20} color="#f59e0b" />
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              background: '#f59e0b', color: 'white', fontSize: '10px',
              borderRadius: '50%', width: '18px', height: '18px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700
            }}>{pendingApprovals > 99 ? '99+' : pendingApprovals}</span>
          </div>
        )}
        {showDropdown && (
          <div ref={dropdownRef} style={{
            position: 'fixed', top: '60px', left: '220px', width: '380px',
            maxHeight: '480px', background: 'white', borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{t('common.notifications')}</h4>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', padding: '2px 6px' }}>
                    {t('common.markAllRead')}
                  </button>
                )}
                <button onClick={() => setShowDropdown(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                  <X size={16} color="#6b7280" />
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
                  <Bell size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                  <div>{t('common.noNotifications')}</div>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = getNotificationIcon(n.type);
                  const color = getNotificationColor(n.type);
                  return (
                    <Link
                      key={n.id}
                      to={getModulePath(n)}
                      onClick={() => { markRead(n.id); setShowDropdown(false); }}
                      style={{
                        display: 'flex', gap: '12px', padding: '12px 16px',
                        textDecoration: 'none', color: 'inherit',
                        borderBottom: '1px solid #f3f4f6',
                        background: n.is_read ? 'white' : 'linear-gradient(135deg, #f0f9ff 0%, white 100%)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'white' : 'linear-gradient(135deg, #f0f9ff 0%, white 100%)'}
                    >
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: `${color}15`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Icon size={16} color={color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: n.is_read ? 400 : 600, color: '#111827', marginBottom: '2px' }}>{n.title}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>{timeAgo(n.created_at)}</div>
                      </div>
                      <ArrowRight size={14} color="#d1d5db" style={{ alignSelf: 'center', flexShrink: 0 }} />
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
              {isActive && <ChevronRight size={16} className="nav-arrow" />}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.firstName} {user?.lastName}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;