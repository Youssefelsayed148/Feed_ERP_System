import React, { useState, useEffect } from 'react';
import { 
  Bell, AlertTriangle, FileText, TrendingDown, 
  ArrowRight, Package, CheckCircle2, Clock
} from 'lucide-react';
import { t } from '../utils/i18n';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

// Demo data for development
const demoLowStockMaterials = [
  { _id: 'rm1', name: 'Yellow Corn (Maize)', code: 'RM-CORN-001', quantity: 2500, minimumStock: 5000, unit: 'kg', reorderLevel: 8000 },
  { _id: 'rm2', name: 'Soybean Meal', code: 'RM-SBM-001', quantity: 1500, minimumStock: 3000, unit: 'kg', reorderLevel: 5000 }
];

const demoPendingPRs = [
  { _id: 'pr1', prNumber: 'PR-2024-001', material: { name: 'Yellow Corn (Maize)', code: 'RM-CORN-001' }, quantity: 10000, priority: 'high', createdAt: '2024-01-15T10:00:00Z' },
  { _id: 'pr2', prNumber: 'PR-2024-002', material: { name: 'Soybean Meal', code: 'RM-SBM-001' }, quantity: 6000, priority: 'high', createdAt: '2024-01-15T10:05:00Z' }
];

// Low Stock Alert Item
const LowStockAlertItem = ({ material, onAction }) => {
  const stockPercentage = (material.quantity / material.minimumStock) * 100;
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      borderRadius: '8px',
      backgroundColor: '#fef3c7',
      border: '1px solid #fed7aa',
      marginBottom: '8px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: '#fbbf24',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <TrendingDown size={20} color="white" />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
          {material.name}
        </div>
        <div style={{ fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertTriangle size={12} />
          {t('autoPO.stockLevel', { pct: stockPercentage.toFixed(0) })} ({material.quantity.toLocaleString()} / {material.minimumStock.toLocaleString()} {material.unit})
        </div>
        <div style={{ 
          height: '4px', 
          backgroundColor: '#fed7aa', 
          borderRadius: '2px',
          marginTop: '6px',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(stockPercentage, 100)}%`,
            backgroundColor: stockPercentage < 50 ? '#dc2626' : '#f59e0b',
            borderRadius: '2px'
          }} />
        </div>
      </div>
      
      <button 
        onClick={() => onAction(material)}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#f59e0b',
          color: 'white',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <FileText size={14} />
        {t('autoPO.createPR')}
      </button>
    </div>
  );
};

// Pending PR Item
const PendingPRItem = ({ pr, onAction }) => {
  const getPriorityColor = () => {
    switch (pr.priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#f59e0b';
      default: return '#6b7280';
    }
  };
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      borderRadius: '8px',
      backgroundColor: '#dbeafe',
      border: '1px solid #bfdbfe',
      marginBottom: '8px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: '#3b82f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <FileText size={20} color="white" />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>
          {pr.prNumber}
        </div>
        <div style={{ fontSize: '12px', color: '#1e40af' }}>
          <Package size={12} style={{ display: 'inline', marginRight: '4px' }} />
          {pr.material.name} • {pr.quantity.toLocaleString()} {t('autoPO.units')}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
          <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
          Created {new Date(pr.createdAt).toLocaleString()}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          backgroundColor: getPriorityColor() + '20',
          color: getPriorityColor()
        }}>
          {pr.priority}
        </span>
        <button 
          onClick={() => onAction(pr)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#3b82f6',
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {t('autoPO.review')}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

// Main Dashboard Widget
const AutoPODashboardWidget = ({ onNavigate }) => {
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [pendingPRs, setPendingPRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  
  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch low stock materials
      const materialsRes = await fetch(`${API_URL}/inventory/raw-materials/low-stock`, { headers: headers() });
      if (materialsRes.ok) {
        const data = await materialsRes.json();
        setLowStockMaterials(data.materials || data || demoLowStockMaterials);
      } else {
        setLowStockMaterials(demoLowStockMaterials);
      }
      
      // Fetch pending PRs
      const prsRes = await fetch(`${API_URL}/purchase-requisitions?status=pending`, { headers: headers() });
      if (prsRes.ok) {
        const data = await prsRes.json();
        setPendingPRs(data.data || data || demoPendingPRs);
      } else {
        setPendingPRs(demoPendingPRs);
      }
    } catch (error) {
      console.error('Error fetching Auto-PO data:', error);
      setLowStockMaterials(demoLowStockMaterials);
      setPendingPRs(demoPendingPRs);
    } finally {
      setLoading(false);
    }
  };
  
  const totalAlerts = lowStockMaterials.length + pendingPRs.length;
  
  const handleCreatePR = (material) => {
    // Navigate to Auto-PO with material pre-selected
    onNavigate('auto-po', { action: 'create-pr', materialId: material._id });
  };
  
  const handleReviewPR = (pr) => {
    // Navigate to Auto-PO with PR pre-selected
    onNavigate('auto-po', { action: 'review-pr', prId: pr._id });
  };
  
  const handleViewAll = () => {
    onNavigate('auto-po');
  };
  
  if (loading) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            border: '2px solid #e5e7eb', 
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          {t('autoPO.loading')}
        </div>
      </div>
    );
  }
  
  if (totalAlerts === 0) {
    return (
      <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={20} style={{ color: '#22c55e' }} />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{t('autoPO.system')}</h3>
          </div>
          <CheckCircle2 size={20} style={{ color: '#22c55e' }} />
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <CheckCircle2 size={32} style={{ color: '#22c55e', marginBottom: '8px' }} />
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              {t('autoPO.allClear')}
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleViewAll}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: 'white',
            color: '#6b7280',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {t('autoPO.viewDashboard')}
          <ArrowRight size={14} />
        </button>
      </div>
    );
  }
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: totalAlerts > 0 ? '#fef3c7' : '#dcfce7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bell size={18} style={{ color: totalAlerts > 0 ? '#f59e0b' : '#22c55e' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>{t('autoPO.alerts')}</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
              {t('autoPO.requireAttention', { n: totalAlerts })}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              padding: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              borderRadius: '4px',
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Content */}
      {!collapsed && (
        <div>
          {/* Low Stock Alerts */}
          {lowStockMaterials.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#92400e'
              }}>
                <AlertTriangle size={14} />
                {t('autoPO.lowStockAlerts')} ({lowStockMaterials.length})
              </div>
              
              {lowStockMaterials.slice(0, 3).map(material => (
                <LowStockAlertItem 
                  key={material._id}
                  material={material}
                  onAction={handleCreatePR}
                />
              ))}
              
              {lowStockMaterials.length > 3 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px',
                  fontSize: '12px',
                  color: '#92400e'
                }}>
                  {t('autoPO.moreLowStock', { n: lowStockMaterials.length - 3 })}
                </div>
              )}
            </div>
          )}
          
          {/* Pending PRs */}
          {pendingPRs.length > 0 && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#1e40af'
              }}>
                <FileText size={14} />
                {t('autoPO.pendingApprovals')} ({pendingPRs.length})
              </div>
              
              {pendingPRs.slice(0, 3).map(pr => (
                <PendingPRItem 
                  key={pr._id}
                  pr={pr}
                  onAction={handleReviewPR}
                />
              ))}
              
              {pendingPRs.length > 3 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '8px',
                  fontSize: '12px',
                  color: '#1e40af'
                }}>
                  {t('autoPO.morePending', { n: pendingPRs.length - 3 })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Footer */}
      <button 
        onClick={handleViewAll}
        style={{
          width: '100%',
          marginTop: collapsed ? '0' : '12px',
          padding: '10px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          backgroundColor: 'white',
          color: '#3b82f6',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px'
        }}
      >
        View Auto-PO Dashboard
        <ArrowRight size={14} />
      </button>
    </div>
  );
};

export default AutoPODashboardWidget;