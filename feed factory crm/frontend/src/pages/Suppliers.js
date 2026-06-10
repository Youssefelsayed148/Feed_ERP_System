import React, { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Plus, Search, Star, TrendingUp, Truck, Package, 
  Edit2, Trash2, X, Check, AlertCircle, Building2,
  Phone, Mail, MessageCircle, DollarSign, BarChart3,
  ChevronDown, ChevronUp, MoreVertical, Filter, RefreshCw,
  FileText, WhatsApp, Send, Clock, CheckCircle2
} from 'lucide-react';
import { 
  feedInventoryService, 
  suppliersService, 
  purchaseOrdersService,
  payablesService 
} from '../services/api';
import OrderFromSupplierModal from '../components/OrderModal';
import DocumentUpload from '../components/DocumentUpload';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

// Raw materials are fetched from inventory API dynamically

// Star Rating Component
const StarRating = ({ rating, size = 16, interactive = false, onChange }) => {
  const [hoverRating, setHoverRating] = useState(0);
  
  const handleClick = (value) => {
    if (interactive && onChange) {
      onChange(value);
    }
  };
  
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= (hoverRating || rating) ? '#ffc107' : 'none'}
          color={star <= (hoverRating || rating) ? '#ffc107' : '#ddd'}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
          onMouseEnter={() => interactive && setHoverRating(star)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          onClick={() => handleClick(star)}
        />
      ))}
    </div>
  );
};

// Performance Badge Component
const PerformanceBadge = ({ value, type }) => {
  let color, icon;
  
  if (type === 'delivery') {
    if (value >= 90) { color = '#22c55e'; icon = <CheckCircle2 size={14} />; }
    else if (value >= 75) { color = '#f59e0b'; icon = <Clock size={14} />; }
    else { color = '#ef4444'; icon = <AlertCircle size={14} />; }
  } else {
    if (value >= 4.5) { color = '#22c55e'; }
    else if (value >= 3.5) { color = '#f59e0b'; }
    else { color = '#ef4444'; }
  }
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      backgroundColor: `${color}20`,
      color: color
    }}>
      {icon}
      {type === 'delivery' ? `${value}%` : value.toFixed(1)}
    </span>
  );
};

// Materials Multi-Select Component
const MaterialsMultiSelect = ({ 
  availableMaterials, 
  selectedMaterials, 
  onChange, 
  onAdd, 
  onRemove 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const filteredSuggestions = availableMaterials.filter(
    m => m.name.toLowerCase().includes(inputValue.toLowerCase()) && 
         !selectedMaterials.includes(m.name)
  );
  
  const handleAdd = () => {
    if (inputValue.trim() && !selectedMaterials.includes(inputValue.trim())) {
      onAdd(inputValue.trim());
      setInputValue('');
      setShowSuggestions(false);
    }
  };
  
  const handleSuggestionClick = (materialName) => {
    onAdd(materialName);
    setInputValue('');
    setShowSuggestions(false);
  };
  
  return (
    <div className="form-group">
      <label className="form-label">{t('suppliers.materialsSupplied')}</label>
      
      {/* Input with suggestions */}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            className="form-input"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Type to search materials..."
            style={{ flex: 1 }}
          />
          <button 
            type="button" 
            className="btn btn-success"
            onClick={handleAdd}
            disabled={!inputValue.trim()}
          >
            <Plus size={18} />
          </button>
        </div>
        
        {/* Suggestions dropdown */}
        {showSuggestions && inputValue && filteredSuggestions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
            zIndex: 1100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {filteredSuggestions.map((material) => (
              <div
                key={material._id}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onClick={() => handleSuggestionClick(material.name)}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
              >
                <Package size={16} style={{ color: '#6b7280' }} />
                <div>
                  <div style={{ fontWeight: 500 }}>{material.name}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>{material.code}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Selected materials tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {selectedMaterials.map((material, idx) => (
          <span key={idx} style={{ 
            background: '#e3f2fd', 
            color: '#1976d2', 
            padding: '6px 12px', 
            borderRadius: '16px', 
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}>
            <Package size={14} />
            {material}
            <button 
              type="button"
              onClick={() => onRemove(material)}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: '#1976d2',
                fontSize: '18px',
                lineHeight: 1,
                padding: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <X size={16} />
            </button>
          </span>
        ))}
        {selectedMaterials.length === 0 && (
          <span style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic' }}>
            No materials selected
          </span>
        )}
      </div>
    </div>
  );
};

// Supplier Form Modal
const SupplierFormModal = ({ 
  supplier, 
  availableMaterials, 
  onSave, 
  onClose,
  isLoading 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    bankName: '',
    bankAccount: '',
    materials: [],
    rating: 0,
    onTimeDelivery: 0,
    qualityRating: 0,
    status: 'active',
    address: '',
    taxId: '',
    paymentTerms: 'Net 30',
    leadTime: 1,
    notes: ''
  });
  
  useEffect(() => {
    if (supplier) {
      setFormData({ ...formData, ...supplier });
    }
  }, [supplier]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const addMaterial = (material) => {
    if (!formData.materials.includes(material)) {
      setFormData({ ...formData, materials: [...formData.materials, material] });
    }
  };
  
  const removeMaterial = (material) => {
    setFormData({ 
      ...formData, 
      materials: formData.materials.filter(m => m !== material) 
    });
  };
  
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-large" style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {supplier ? 'Edit Supplier' : 'Add New Supplier'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '60vh', overflow: 'auto' }}>
            {/* Basic Information */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Basic Information
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Supplier Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Enter supplier name"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">{t('suppliers.code')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., SUP-001"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('suppliers.contactPerson')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Primary contact name"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">{t('suppliers.phone')}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={16} style={{ color: '#6b7280' }} />
                    <input
                      type="tel"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+255 XXX XXX XXX"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    <MessageCircle size={16} style={{ display: 'inline', marginRight: '4px', color: '#25D366' }} />
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="+255 XXX XXX XXX"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">
                  <Mail size={16} style={{ display: 'inline', marginRight: '4px' }} />
                  Email
                </label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="supplier@email.com"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('common.address')}</label>
                <textarea
                  className="form-textarea"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full address"
                  rows="2"
                />
              </div>
            </div>
            
            {/* Banking Information */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Banking & Tax Information
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">{t('suppliers.bankName')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g., CRDB Bank"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">{t('suppliers.bankAccountNumber')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    placeholder="Account number"
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Tax ID (TIN)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    placeholder="TIN number"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Payment Terms</label>
                  <select
                    className="form-select"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  >
                    <option value="Cash on Delivery">{t('suppliers.cashOnDelivery')}</option>
                    <option value="Net 15">Net 15 (15 days)</option>
                    <option value="Net 30">Net 30 (30 days)</option>
                    <option value="Net 45">Net 45 (45 days)</option>
                    <option value="Net 60">Net 60 (60 days)</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Materials Supplied */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Materials & Services
              </h4>
              
              <MaterialsMultiSelect
                availableMaterials={availableMaterials}
                selectedMaterials={formData.materials}
                onChange={(materials) => setFormData({ ...formData, materials })}
                onAdd={addMaterial}
                onRemove={removeMaterial}
              />
              
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Lead Time (days)</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="30"
                  value={formData.leadTime}
                  onChange={(e) => setFormData({ ...formData, leadTime: parseInt(e.target.value) || 1 })}
                />
                <small className="form-help">{t('suppliers.avgDays')}</small>
              </div>
            </div>
            
            {/* Performance Metrics */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Performance Metrics
              </h4>
              
              <div className="form-group">
                <label className="form-label">Overall Rating</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <StarRating 
                    rating={formData.rating} 
                    size={24} 
                    interactive={true}
                    onChange={(rating) => setFormData({ ...formData, rating })}
                  />
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    {formData.rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">On-Time Delivery Rate (%)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="100"
                    value={formData.onTimeDelivery}
                    onChange={(e) => setFormData({ ...formData, onTimeDelivery: parseInt(e.target.value) || 0 })}
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Quality Rating</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
                    <StarRating 
                      rating={formData.qualityRating} 
                      size={20} 
                      interactive={true}
                      onChange={(qualityRating) => setFormData({ ...formData, qualityRating })}
                    />
                    <span style={{ fontSize: '14px', color: '#6b7280' }}>
                      {formData.qualityRating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status & Notes */}
            <div>
              <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Status & Notes
              </h4>
              
              <div className="form-group">
                <label className="form-label">{t('common.status')}</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="active">{t('common.statuses.active')}</option>
                  <option value="inactive">{t('common.statuses.inactive')}</option>
                  <option value="blacklisted">{t('suppliers.blacklisted')}</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this supplier..."
                  rows="3"
                />
              </div>
            </div>
          </div>
          
          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '8px', display: 'inline' }} />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={16} style={{ marginRight: '8px', display: 'inline' }} />
                  {supplier ? 'Update Supplier' : 'Create Supplier'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Supplier Detail Modal
const SupplierDetailModal = ({ supplier, rawMaterials, onClose, onEdit, onOrder, onDelete }) => {
  if (!supplier) return null;
  
  // Find materials supplied by this supplier (match by material code)
  const suppliedMaterials = rawMaterials.filter(rm => 
    supplier.materials.includes(rm.code)
  );
  
  // Find low stock materials (API fields: current_stock, min_stock_level)
  const lowStockMaterials = suppliedMaterials.filter(rm => 
    parseFloat(rm.current_stock || 0) <= parseFloat(rm.min_stock_level || 0)
  );
  
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-large" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: '#e3f2fd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={24} color="#1976d2" />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0 }}>{supplier.name}</h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                {supplier.code} • {supplier.contactPerson}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          {/* Status Badge */}
          <div style={{ marginBottom: '20px' }}>
            <span style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              backgroundColor: supplier.status === 'active' ? '#dcfce7' : supplier.status === 'inactive' ? '#f3f4f6' : '#fee2e2',
              color: supplier.status === 'active' ? '#166534' : supplier.status === 'inactive' ? '#6b7280' : '#991b1b'
            }}>
              {supplier.status}
            </span>
          </div>
          
          {/* Quick Stats */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '16px',
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                {supplier.rating.toFixed(1)}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Rating</div>
              <StarRating rating={supplier.rating} size={12} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
                {supplier.onTimeDelivery}%
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>On-Time</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                {supplier.totalOrders}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Orders</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                EGP {(supplier.totalSpend / 1000000).toFixed(1)}M
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Spend</div>
            </div>
          </div>
          
          {/* Contact Information */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '14px', fontWeight: 600 }}>
              Contact Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {supplier.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} style={{ color: '#6b7280' }} />
                  <span>{supplier.phone}</span>
                </div>
              )}
              {supplier.whatsapp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageCircle size={16} style={{ color: '#25D366' }} />
                  <span>{supplier.whatsapp}</span>
                </div>
              )}
              {supplier.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Mail size={16} style={{ color: '#6b7280' }} />
                  <span>{supplier.email}</span>
                </div>
              )}
              {supplier.address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', gridColumn: 'span 2' }}>
                  <span style={{ color: '#6b7280' }}>📍</span>
                  <span>{supplier.address}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Banking Information */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '14px', fontWeight: 600 }}>
              Banking & Payment
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Bank:</span>
                <div>{supplier.bankName || 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Account:</span>
                <div>{supplier.bankAccount || 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Tax ID:</span>
                <div>{supplier.taxId || 'N/A'}</div>
              </div>
              <div>
                <span style={{ color: '#6b7280', fontSize: '12px' }}>Payment Terms:</span>
                <div>{supplier.paymentTerms || 'N/A'}</div>
              </div>
            </div>
          </div>
          
          {/* Materials Supplied */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} />
              Materials Supplied ({suppliedMaterials.length})
            </h4>
            
            {lowStockMaterials.length > 0 && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fef3c7', 
                borderRadius: '6px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '14px', color: '#92400e' }}>
                  <strong>{lowStockMaterials.length} materials</strong> from this supplier are running low on stock
                </span>
              </div>
            )}
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {suppliedMaterials.map((material) => (
                <div
                  key={material.id || material._id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    backgroundColor: parseFloat(material.current_stock || 0) <= parseFloat(material.min_stock_level || 0) ? '#fef3c7' : 'white',
                    minWidth: '200px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500 }}>{material.name_arabic || material.name_english || material.name || material.code}</span>
                    {parseFloat(material.current_stock || 0) <= parseFloat(material.min_stock_level || 0) && (
                      <AlertCircle size={14} style={{ color: '#f59e0b' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Stock: {parseFloat(material.current_stock || 0).toLocaleString()} {material.unit || 'kg'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    Min: {parseFloat(material.min_stock_level || 0).toLocaleString()} {material.unit || 'kg'}
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ marginTop: '8px', width: '100%' }}
                    onClick={() => onOrder(supplier)}
                  >
                    <Truck size={14} style={{ marginRight: '4px', display: 'inline' }} />
                    Order Now
                  </button>
                </div>
              ))}
              {suppliedMaterials.length === 0 && (
                <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                  No materials linked to this supplier
                </span>
              )}
            </div>
          </div>
          
          {/* Performance History */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} />
              Performance History
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>On-Time Delivery</div>
                <PerformanceBadge value={supplier.onTimeDelivery} type="delivery" />
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                  {supplier.onTimeDelivery >= 90 ? 'Excellent' : supplier.onTimeDelivery >= 75 ? 'Good' : 'Needs Improvement'}
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Quality Rating</div>
                <PerformanceBadge value={supplier.qualityRating} type="quality" />
                <div style={{ marginTop: '8px' }}>
                  <StarRating rating={supplier.qualityRating} size={14} />
                </div>
              </div>
            </div>
            
            {supplier.lastOrderDate && (
              <div style={{ marginTop: '12px', fontSize: '14px', color: '#6b7280' }}>
                <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Last Order: {new Date(supplier.lastOrderDate).toLocaleDateString()}
              </div>
            )}
          </div>
          
          {/* Documents */}
          <DocumentUpload
            entityType="supplier"
            entityId={supplier.id || supplier._id}
            allowUpload={true}
          />

          {/* Notes */}
          {supplier.notes && (
            <div>
              <h4 style={{ marginBottom: '12px', color: '#374151', fontSize: '14px', fontWeight: 600 }}>
                Notes
              </h4>
              <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '6px', fontSize: '14px' }}>
                {supplier.notes}
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            type="button" 
            className="btn btn-danger"
            onClick={() => onDelete(supplier)}
          >
            <Trash2 size={16} style={{ marginRight: '8px', display: 'inline' }} />
            Delete
          </button>
          <div style={{ flex: 1 }}></div>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={onClose}
          >
            Close
          </button>
          <button 
            type="button" 
            className="btn btn-primary"
            onClick={() => onEdit(supplier)}
          >
            <Edit2 size={16} style={{ marginRight: '8px', display: 'inline' }} />
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Suppliers Component
const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'view'
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [orderModalData, setOrderModalData] = useState(null);
  const [notification, setNotification] = useState(null);
  
  // New state variables for supplier editing
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    materials: [],
    bankName: '',
    bankAccount: '',
    paymentTerms: '',
    notes: ''
  });
  
  // Fetch suppliers and raw materials
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Try to fetch from API
      const [suppliersRes, materialsRes] = await Promise.all([
        fetch(`${API_URL}/suppliers`, { headers: headers() }),
        fetch(`${API_URL}/inventory/raw-materials`, { headers: headers() })
      ]);
      
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        const raw = suppliersData.data || suppliersData || [];
        const mapped = raw.map(s => ({
          _id: s.id,
          id: s.id,
          name: s.name,
          code: s.code,
          contactPerson: s.contactPerson || s.contact_person || '',
          phone: s.phone,
          whatsapp: s.whatsapp || s.phone || '',
          email: s.email || '',
          address: s.address || '',
          materials: s.materialsSupplied || s.materials_supplied || [],
          paymentTerms: s.paymentTerms || s.payment_terms || '',
          rating: s.performanceRating || s.performance_rating || 3,
          performanceRating: s.performanceRating || s.performance_rating || 3,
          onTimeDelivery: 85,
          qualityRating: 4,
          totalOrders: 0,
          totalSpend: 0,
          status: s.is_active !== false ? 'active' : 'inactive',
          taxId: '',
          bankName: '',
          bankAccount: '',
          leadTime: 7,
          notes: '',
          lastOrderDate: null
        }));
        setSuppliers(mapped);
      } else {
        setSuppliers([]);
      }
      
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        const materials = materialsData.materials || materialsData || [];
        setRawMaterials(materials);
      } else {
        setRawMaterials([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setSuppliers([]);
      setRawMaterials([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Filter and sort suppliers
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.materials?.some(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'orders':
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      case 'spend':
        return (b.totalSpend || 0) - (a.totalSpend || 0);
      case 'delivery':
        return b.onTimeDelivery - a.onTimeDelivery;
      default:
        return a.name.localeCompare(b.name);
    }
  });
  
  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };
  
  // Edit modal functions
  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name || '',
      code: supplier.code || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      whatsapp: supplier.whatsapp || supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      materials: supplier.materials || [],
      bankName: supplier.bankName || '',
      bankAccount: supplier.bankAccount || '',
      paymentTerms: supplier.paymentTerms || '',
      notes: supplier.notes || ''
    });
    setShowModal(true);
  };

  const openCreateSupplierModal = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      code: '',
      contactPerson: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      materials: [],
      bankName: '',
      bankAccount: '',
      paymentTerms: '',
      notes: ''
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      code: '',
      contactPerson: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      materials: [],
      bankName: '',
      bankAccount: '',
      paymentTerms: '',
      notes: ''
    });
  };

  // Material management functions
  const addMaterial = () => {
    setSupplierForm({
      ...supplierForm,
      materials: [...supplierForm.materials, '']
    });
  };

  const updateMaterial = (index, value) => {
    const newMaterials = [...supplierForm.materials];
    newMaterials[index] = value;
    setSupplierForm({ ...supplierForm, materials: newMaterials });
  };

  const removeMaterial = (index) => {
    const newMaterials = supplierForm.materials.filter((_, i) => i !== index);
    setSupplierForm({ ...supplierForm, materials: newMaterials });
  };

  // Handle save supplier (updated version)
  const handleSaveSupplierForm = async () => {
    try {
      // Validate
      if (!supplierForm.name || !supplierForm.code) {
        alert('Name and Code are required');
        return;
      }
      
      const supplierData = {
        ...supplierForm,
        _id: editingSupplier?._id || 'sup_' + Date.now(),
        status: 'active',
        updatedAt: new Date().toISOString()
      };
      
      // Try API
      if (editingSupplier) {
        // Update existing
        const response = await fetch(`${API_URL}/suppliers/${editingSupplier._id}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(supplierData)
        });
        
        if (response.ok) {
          const updated = await response.json();
          setSuppliers(suppliers.map(s => s._id === updated._id ? updated : s));
          showNotification('Supplier updated successfully');
        } else {
          // Demo mode
          setSuppliers(suppliers.map(s => s._id === editingSupplier._id ? supplierData : s));
          showNotification('Supplier updated successfully');
        }
      } else {
        // Create new
        const response = await fetch(`${API_URL}/suppliers`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(supplierData)
        });
        
        if (response.ok) {
          const created = await response.json();
          setSuppliers([...suppliers, created]);
          showNotification('Supplier created successfully');
        } else {
          // Demo mode
          setSuppliers([...suppliers, supplierData]);
          showNotification('Supplier created successfully');
        }
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving supplier:', error);
      alert('Failed to save supplier');
    }
  };

  // Handle delete supplier (updated version)
  const handleDeleteSupplierById = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: headers()
      });
      
      if (response.ok) {
        setSuppliers(suppliers.filter(s => s._id !== supplierId));
        showNotification('Supplier deleted successfully');
      } else {
        setSuppliers(suppliers.filter(s => s._id !== supplierId));
        showNotification('Supplier deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      setSuppliers(suppliers.filter(s => s._id !== supplierId));
      showNotification('Supplier deleted successfully');
    }
  };
  
  // Handle save supplier
  const handleSaveSupplier = async (formData) => {
    try {
      if (modalMode === 'edit' && selectedSupplier) {
        // Update existing supplier
        const response = await fetch(`${API_URL}/suppliers/${selectedSupplier._id}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          const updated = await response.json();
          setSuppliers(suppliers.map(s => s._id === selectedSupplier._id ? updated : s));
          showNotification('Supplier updated successfully');
        } else {
          // Fallback to local update
          setSuppliers(suppliers.map(s => s._id === selectedSupplier._id ? { ...formData, _id: s._id } : s));
          showNotification('Supplier updated successfully');
        }
      } else {
        // Create new supplier
        const response = await fetch(`${API_URL}/suppliers`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          const created = await response.json();
          setSuppliers([...suppliers, created]);
          showNotification('Supplier created successfully');
        } else {
          // Fallback to local creation
          const newSupplier = { ...formData, _id: `new-${Date.now()}`, totalOrders: 0, totalSpend: 0 };
          setSuppliers([...suppliers, newSupplier]);
          showNotification('Supplier created successfully');
        }
      }
      
      setShowModal(false);
      setSelectedSupplier(null);
    } catch (error) {
      console.error('Error saving supplier:', error);
      showNotification('Error saving supplier', 'error');
    }
  };
  
  // Handle delete supplier
  const handleDeleteSupplier = async (supplier) => {
    if (!window.confirm(`Are you sure you want to delete ${supplier.name}?`)) return;
    
    try {
      const response = await fetch(`${API_URL}/suppliers/${supplier._id}`, {
        method: 'DELETE',
        headers: headers()
      });
      
      if (response.ok) {
        setSuppliers(suppliers.filter(s => s._id !== supplier._id));
        showNotification('Supplier deleted successfully');
      } else {
        setSuppliers(suppliers.filter(s => s._id !== supplier._id));
          showNotification('Supplier deleted successfully');
      }
      
      setShowModal(false);
      setSelectedSupplier(null);
    } catch (error) {
      console.error('Error deleting supplier:', error);
      showNotification('Error deleting supplier', 'error');
    }
  };
  
  // Handle create order with multiple items
  const handleCreateOrder = async (orderData) => {
    try {
      // Create PO with multiple items
      const poResponse = await fetch(`${API_URL}/purchase-orders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          supplierId: orderData.supplierId,
          items: orderData.items.map(item => ({
            material: item.material._id,
            materialName: item.materialName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            total: item.total
          })),
          subtotal: orderData.subtotal,
          vatRate: 14,
          vatAmount: 0,
          total: orderData.subtotal,
          deliveryDate: orderData.deliveryDate,
          status: 'pending',
          notes: orderData.notes,
          currency: 'EGP'
        })
      });
      
      if (poResponse.ok) {
        const result = await poResponse.json();
        showNotification(`Purchase order ${result.data?.poNumber || 'created'} successfully with ${orderData.items.length} materials`);
        
        // Refresh data
        fetchData();
        
        // Send WhatsApp notification
        const supplier = suppliers.find(s => s._id === orderData.supplierId);
        if (supplier?.whatsapp) {
          const itemsList = orderData.items.map(item => 
            `- ${item.materialName}: ${item.quantity} ${item.unit} x ${item.unitPrice} EGP = ${item.total.toLocaleString()} EGP`
          ).join('\n');
          
          const message = `New Purchase Order from Al Kheir Feed Factory\n\nPO Number: ${result.data?.poNumber || 'New'}\n\nItems:\n${itemsList}\n\nSubtotal: ${orderData.subtotal.toLocaleString()} EGP\nVAT (14%): ${orderData.vatAmount.toLocaleString()} EGP\nGrand Total: ${orderData.total.toLocaleString()} EGP\n\nDelivery Date: ${orderData.deliveryDate}`;
          
          const url = `https://wa.me/${supplier.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
        }
      } else {
        showNotification('Failed to create purchase order', 'error');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      showNotification('Error creating purchase order: ' + error.message, 'error');
    }
  };
  
  // Open create modal
  const openCreateModal = () => {
    setModalMode('create');
    setSelectedSupplier(null);
    setShowModal(true);
  };
  
  // Open view modal
  const openViewModal = (supplier) => {
    setModalMode('view');
    setSelectedSupplier(supplier);
    setShowModal(true);
  };
  
  // Open order modal - now opens with supplier and all their materials
  const openOrderModal = (supplier) => {
    setOrderModalData({ supplier });
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', color: '#166534' };
      case 'inactive': return { bg: '#f3f4f6', color: '#6b7280' };
      case 'blacklisted': return { bg: '#fee2e2', color: '#991b1b' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };
  
  return (
    <div className="page-container">
      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          padding: '16px 24px',
          borderRadius: '8px',
          backgroundColor: notification.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: notification.type === 'error' ? '#991b1b' : '#166534',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          {notification.message}
        </div>
      )}
      
      {/* Page Header */}
      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0 }}>{t('nav.suppliers')}</h1>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280' }}>
              Manage suppliers, materials, and performance metrics
            </p>
          </div>
          <button className="btn btn-primary" onClick={openCreateSupplierModal}>
            <Plus size={18} style={{ marginRight: '8px', display: 'inline' }} />
            Add Supplier
          </button>
        </div>
        
        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
              {suppliers.length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{t('dashboard.totalSuppliers')}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>
              {suppliers.filter(s => s.status === 'active').length}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>{t('common.statuses.active')}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
              {suppliers.reduce((sum, s) => sum + (s.totalOrders || 0), 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Orders</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
              EGP {(suppliers.reduce((sum, s) => sum + (s.totalSpend || 0), 0) / 1000000).toFixed(1)}M
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Spend</div>
          </div>
        </div>
        
        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              type="text"
              placeholder="Search suppliers, materials..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>
          
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="all">{t('common.allLabel')}</option>
            <option value="active">{t('common.statuses.active')}</option>
            <option value="inactive">{t('common.statuses.inactive')}</option>
            <option value="blacklisted">{t('suppliers.blacklisted')}</option>
          </select>
          
          <select
            className="form-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: '150px' }}
          >
            <option value="name">Sort by Name</option>
            <option value="rating">Sort by Rating</option>
            <option value="orders">Sort by Orders</option>
            <option value="spend">Sort by Spend</option>
            <option value="delivery">Sort by Delivery</option>
          </select>
        </div>
      </div>
      
      {/* Suppliers Table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('common.supplier')}</th>
              <th>Materials</th>
              <th>Performance</th>
              <th>Orders</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                  <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#6b7280' }} />
                  <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading suppliers...</p>
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                  <Building2 size={48} style={{ color: '#d1d5db', marginBottom: '12px' }} />
                  <p style={{ color: '#6b7280' }}>No suppliers found</p>
                  <button className="btn btn-primary" onClick={openCreateSupplierModal} style={{ marginTop: '12px' }}>
                    Add Your First Supplier
                  </button>
                </td>
              </tr>
            ) : (
              filteredSuppliers.map((supplier) => (
                <tr key={supplier._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        backgroundColor: '#e3f2fd',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        color: '#1976d2'
                      }}>
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500 }}>{supplier.name}</div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {supplier.code} • {supplier.contactPerson}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {supplier.materials?.slice(0, 3).map((material, idx) => (
                        <span key={idx} style={{ 
                          background: '#e3f2fd', 
                          color: '#1976d2', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '11px' 
                        }}>
                          {material}
                        </span>
                      ))}
                      {supplier.materials?.length > 3 && (
                        <span style={{ 
                          background: '#f3f4f6', 
                          color: '#6b7280', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '11px' 
                        }}>
                          +{supplier.materials.length - 3} more
                        </span>
                      )}
                      {(!supplier.materials || supplier.materials.length === 0) && (
                        <span style={{ color: '#9ca3af', fontSize: '12px', fontStyle: 'italic' }}>
                          No materials
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <StarRating rating={supplier.rating} size={12} />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>
                          {supplier.rating?.toFixed(1)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{ color: '#22c55e' }}>
                          {supplier.onTimeDelivery}% on-time
                        </span>
                        <span style={{ color: '#6b7280' }}>•</span>
                        <span style={{ color: '#3b82f6' }}>
                          Q: {supplier.qualityRating?.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 500 }}>
                        {supplier.totalOrders || 0} orders
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        EGP {((supplier.totalSpend || 0) / 1000000).toFixed(1)}M
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'capitalize',
                      backgroundColor: getStatusColor(supplier.status).bg,
                      color: getStatusColor(supplier.status).color
                    }}>
                      {supplier.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-sm"
                        onClick={() => openViewModal(supplier)}
                        title="View Details"
                      >
                        View
                      </button>
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => openEditModal(supplier)}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteSupplierById(supplier._id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* New Simplified Edit Modal */}
      {showModal && modalMode !== 'view' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3>{editingSupplier ? t('common.edit') + ' ' + t('suppliers.title') : t('suppliers.addSupplier')}</h3>
              <button onClick={closeModal} className="modal-close"><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflow: 'auto' }}>
              <form onSubmit={(e) => { e.preventDefault(); handleSaveSupplierForm(); }}>
                {/* Basic Information */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Basic Information
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Supplier Name *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={supplierForm.name}
                        onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                        placeholder="Enter supplier name"
                        required
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Supplier Code *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={supplierForm.code}
                        onChange={(e) => setSupplierForm({ ...supplierForm, code: e.target.value })}
                        placeholder="e.g., SUP-001"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">{t('suppliers.contactPerson')}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={supplierForm.contactPerson}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contactPerson: e.target.value })}
                      placeholder="Primary contact name"
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">{t('common.phone')}</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={supplierForm.phone}
                        onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                        placeholder="+255 XXX XXX XXX"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">{t('suppliers.whatsapp')}</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={supplierForm.whatsapp || ''}
                        onChange={(e) => setSupplierForm({ ...supplierForm, whatsapp: e.target.value })}
                        placeholder="+255 XXX XXX XXX"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">{t('common.email')}</label>
                    <input
                      type="email"
                      className="form-input"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">{t('common.address')}</label>
                    <textarea
                      className="form-textarea"
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      placeholder="Full address"
                      rows="2"
                    />
                  </div>
                </div>
                
                {/* Materials Section */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <Package size={16} style={{ display: 'inline', marginRight: '8px' }} />
                    Materials Supplied
                  </h4>
                  
                  <div className="form-group">
                    {supplierForm.materials.map((material, index) => (
                      <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <select
                          className="form-select flex-1"
                          value={material}
                          onChange={(e) => updateMaterial(index, e.target.value)}
                        >
                          <option value="">Select a material...</option>
                          {rawMaterials.map((mat) => (
                            <option key={mat.id || mat._id || mat.code} value={mat.code || mat.name_arabic || mat.name}>{mat.name_arabic || mat.name_english || mat.name || mat.code} ({mat.code})</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => removeMaterial(index)}
                          className="btn btn-danger"
                          title="Remove material"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    
                    {supplierForm.materials.length === 0 && (
                      <p style={{ color: '#9ca3af', fontSize: '14px', fontStyle: 'italic', marginBottom: '12px' }}>
                        No materials added yet. Click below to add materials.
                      </p>
                    )}
                    
                    <button 
                      type="button"
                      onClick={addMaterial} 
                      className="btn btn-secondary"
                      style={{ marginTop: '8px' }}
                    >
                      <Plus size={16} style={{ marginRight: '4px', display: 'inline' }} /> Add Material
                    </button>
                  </div>
                </div>
                
                {/* Banking & Payment */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Banking & Payment
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">{t('suppliers.bankName')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={supplierForm.bankName}
                        onChange={(e) => setSupplierForm({ ...supplierForm, bankName: e.target.value })}
                        placeholder="e.g., CRDB Bank"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">{t('hr.bankAccount')}</label>
                      <input
                        type="text"
                        className="form-input"
                        value={supplierForm.bankAccount}
                        onChange={(e) => setSupplierForm({ ...supplierForm, bankAccount: e.target.value })}
                        placeholder="Account number"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Payment Terms</label>
                    <select
                      className="form-select"
                      value={supplierForm.paymentTerms}
                      onChange={(e) => setSupplierForm({ ...supplierForm, paymentTerms: e.target.value })}
                    >
                      <option value="">Select payment terms...</option>
                      <option value="Cash on Delivery">{t('suppliers.cashOnDelivery')}</option>
                      <option value="Net 15">Net 15 (15 days)</option>
                      <option value="Net 30">Net 30 (30 days)</option>
                      <option value="Net 45">Net 45 (45 days)</option>
                      <option value="Net 60">Net 60 (60 days)</option>
                    </select>
                  </div>
                </div>
                
                {/* Notes */}
                <div>
                  <h4 style={{ marginBottom: '16px', color: '#374151', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Notes
                  </h4>
                  
                  <div className="form-group">
                    <textarea
                      className="form-textarea"
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                      placeholder="Additional notes about this supplier..."
                      rows="3"
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button onClick={closeModal} className="btn btn-secondary">{t('common.cancel')}</button>
              <button onClick={handleSaveSupplierForm} className="btn btn-primary">
                <Check size={16} style={{ marginRight: '8px', display: 'inline' }} />
                {editingSupplier ? 'Update Supplier' : 'Create Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showModal && modalMode === 'view' && selectedSupplier && (
        <SupplierDetailModal
          supplier={selectedSupplier}
          rawMaterials={rawMaterials}
          onClose={() => { setShowModal(false); setSelectedSupplier(null); }}
          onEdit={(supplier) => { openEditModal(supplier); }}
          onOrder={openOrderModal}
          onDelete={handleDeleteSupplier}
        />
      )}
      
      {orderModalData && (
        <OrderFromSupplierModal
          supplier={orderModalData.supplier}
          rawMaterials={rawMaterials}
          onClose={() => setOrderModalData(null)}
          onSubmit={handleCreateOrder}
        />
      )}
    </div>
  );
};

export default Suppliers;