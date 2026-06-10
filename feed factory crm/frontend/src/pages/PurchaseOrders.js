import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const PurchaseOrders = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [supplierMaterials, setSupplierMaterials] = useState([]);
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedPOItems, setSelectedPOItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formData, setFormData] = useState({
    supplierId: '',
    deliveryDate: '',
    notes: ''
  });

  useEffect(() => {
    fetchPurchaseOrders();
    fetchSuppliers();
    fetchLowStockMaterials();
  }, []);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/purchase-orders`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        const pos = data.purchaseOrders || data.data || [];
        setPurchaseOrders(Array.isArray(pos) ? pos : []);
      } else {
        setPurchaseOrders([]);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      setPurchaseOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetch(`${API_URL}/suppliers`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        const sups = data.suppliers || data.data || [];
        setSuppliers(Array.isArray(sups) ? sups : []);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      setSuppliers([]);
    }
  };

  const fetchLowStockMaterials = async () => {
    try {
      const response = await fetch(`${API_URL}/inventory/raw-materials/low-stock`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setLowStockMaterials(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching low stock materials:', error);
    }
  };

  const fetchSupplierMaterials = async (supplierId) => {
    try {
      const response = await fetch(`${API_URL}/suppliers/${supplierId}/materials`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setSupplierMaterials(data.materials || []);
        setMaterials(data.materials || []);
      }
    } catch (error) {
      console.error('Error fetching supplier materials:', error);
    }
  };

  const handleSupplierChange = (value) => {
    setFormData({ ...formData, supplierId: value });
    setCartItems([]);
    setMaterials([]);
    setSupplierMaterials([]);
    if (value) {
      fetchSupplierMaterials(value);
    }
  };

  const handleLowStockCheck = (m, checked) => {
    if (checked) {
      const prefSupplier = m.preferred_supplier;
      const supplierId = prefSupplier?.id?.toString() || '';
      // Auto-select supplier
      setFormData(prev => ({ ...prev, supplierId }));
      setCartItems([{
        material: m.id.toString(),
        materialName: m.name_arabic || m.name,
        quantity: Math.ceil(m.quantity_to_order || 0).toString(),
        unit: 'kg',
        unitPrice: (prefSupplier?.unit_price || m.unit_price || 0).toString(),
        total: Math.ceil(m.quantity_to_order || 0) * (prefSupplier?.unit_price || m.unit_price || 0)
      }]);
      // Fetch supplier materials for dropdown
      if (supplierId) fetchSupplierMaterials(supplierId);
    } else {
      setCartItems([]);
    }
  };

  const stats = {
    pendingApproval: purchaseOrders.filter(po => po.status === 'pending_approval').length,
    totalPOs: purchaseOrders.length,
    monthSpend: purchaseOrders
      .filter(po => po.status !== 'draft')
      .reduce((sum, po) => sum + parseFloat(po.total_amount || 0) + parseFloat(po.vat_amount || 0), 0)
  };

  const openCreateModal = () => {
    setFormData({ supplierId: '', deliveryDate: '', notes: '' });
    setCartItems([]);
    setSelectedPO(null);
    setShowModal(true);
  };

  const openViewModal = async (po) => {
    setSelectedPO(po);
    setSelectedPOItems([]);
    setShowModal(true);
    try {
      const response = await fetch(`${API_URL}/purchase-orders/${po.id}`, { headers: headers() });
      if (response.ok) {
        const data = await response.json();
        setSelectedPOItems(data.items || []);
        setSelectedPO(data);
      }
    } catch (e) {
      console.error('Error fetching PO details:', e);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPO(null);
    setSelectedPOItems([]);
    setCartItems([]);
    setFormData({ supplierId: '', deliveryDate: '', notes: '' });
  };

  const addCartItem = () => {
    setCartItems([...cartItems, { material: '', quantity: '', unit: 'kg', unitPrice: '', total: 0 }]);
  };

  const updateCartItem = (index, field, value) => {
    const updated = [...cartItems];
    updated[index][field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = Number(updated[index].quantity) * Number(updated[index].unitPrice) || 0;
    }
    setCartItems(updated);
  };

  const removeCartItem = (index) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
    const vat = subtotal * 0.14;
    return { subtotal, vat, total: subtotal + vat };
  };

  const handleCreatePO = async () => {
    if (!formData.supplierId || cartItems.length === 0) return;
    
    const { subtotal, vat } = calculateTotals();
    const supplier = suppliers.find(s => s._id === formData.supplierId || s.id === Number(formData.supplierId));
    
    const newPO = {
      supplierId: formData.supplierId,
      items: cartItems.map(item => ({
        material: item.material,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        total: item.total
      })),
      subtotal,
      vatRate: 14,
      vatAmount: vat,
      total: subtotal + vat,
      deliveryDate: formData.deliveryDate,
      notes: formData.notes,
      status: 'pending_approval',
      currency: 'EGP'
    };
    
    try {
      const response = await fetch(`${API_URL}/purchase-orders`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(newPO)
      });
      
      if (response.ok) {
        const result = await response.json();
        alert('Purchase order created and submitted for approval!');
        fetchPurchaseOrders();
        closeModal();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create purchase order');
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create purchase order. Please try again.');
    }
  };

  const submitForApproval = async (poId) => {
    try {
      const response = await fetch(`${API_URL}/purchase-orders/${poId}/submit`, {
        method: 'PUT',
        headers: headers()
      });
      if (response.ok) {
        alert('PO submitted for approval!');
        fetchPurchaseOrders();
      } else {
        const response2 = await fetch(`${API_URL}/purchase-orders`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({ id: poId, status: 'pending_approval' })
        });
        if (response2.ok) {
          alert('PO submitted for approval!');
          fetchPurchaseOrders();
        } else {
          const err = await response2.json();
          alert(err.error || 'Failed to submit PO');
        }
      }
    } catch (error) {
      console.error('Error submitting PO:', error);
      alert('Failed to submit PO');
    }
  };

  const approvePO = async (poId) => {
    try {
      const response = await fetch(`${API_URL}/purchase-orders/${poId}/approve`, {
        method: 'PUT',
        headers: headers()
      });
      if (response.ok) {
        alert('Purchase order approved!');
        fetchPurchaseOrders();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to approve PO');
      }
    } catch (error) {
      console.error('Error approving PO:', error);
      alert('Failed to approve PO');
    }
  };

  const cancelPO = async (poId) => {
    try {
      const response = await fetch(`${API_URL}/purchase-orders/${poId}/cancel`, {
        method: 'PUT',
        headers: headers()
      });
      if (response.ok) {
        alert('Purchase order cancelled');
        fetchPurchaseOrders();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to cancel PO');
      }
    } catch (error) {
      console.error('Error cancelling PO:', error);
      alert('Failed to cancel PO');
    }
  };

  const sendWhatsApp = (po) => {
    const supplierName = po.supplier_name || 'Supplier';
    const total = parseFloat(po.total_amount || 0) + parseFloat(po.vat_amount || 0);
    const message = `Purchase Order: ${po.po_number || po.id}\nSupplier: ${supplierName}\nTotal: EGP ${total.toLocaleString()}\nDelivery: ${po.expected_date || po.delivery_date || 'N/A'}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const downloadPOAsPDF = (po) => {
    const items = (po.items || []).map(item => `
      <tr>
        <td>${item.raw_material_name || item.material || '-'}</td>
        <td>${item.quantity || 0} ${item.unit || 'kg'}</td>
        <td>EGP ${parseFloat(item.unit_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
        <td>EGP ${parseFloat(item.total_cost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
      </tr>
    `).join('');

    const printContent = `
      <html>
        <head>
          <title>Purchase Order ${po.po_number || po.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            h1 { color: #1565c0; border-bottom: 2px solid #1565c0; padding-bottom: 10px; }
            .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
            .header div { margin-bottom: 8px; }
            .label { color: #666; font-size: 12px; text-transform: uppercase; }
            .value { font-weight: 600; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; padding: 16px; background: #f5f5f5; border-radius: 4px; }
            .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
          </style>
        </head>
        <body>
          <h1>{t('po.title')}</h1>
          <div class="header">
            <div>
              <div class="label">{t('po.number')}</div>
              <div class="value">${po.po_number || po.id}</div>
            </div>
            <div>
              <div class="label">{t('common.date')}</div>
              <div class="value">${po.created_at ? new Date(po.created_at).toLocaleDateString('en-GB') : '-'}</div>
            </div>
            <div>
              <div class="label">{t('common.status')}</div>
              <div class="value" style="text-transform: capitalize;">${(po.status || 'draft').replace(/_/g, ' ')}</div>
            </div>
          </div>
          <div class="header">
            <div>
              <div class="label">{t('common.supplier')}</div>
              <div class="value">${po.supplier_name || po.supplier?.name || '-'}</div>
            </div>
            <div>
              <div class="label">{t('po.expectedDelivery')}</div>
              <div class="value">${po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GB') : '-'}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('common.material')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('po.unitCost')}</th>
                <th>{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              ${items || `<tr><td colspan="4" style="text-align:center;">{t('po.noItems')}</td></tr>`}
            </tbody>
          </table>
          <div class="total">
            Grand Total (inc. VAT): EGP ${(parseFloat(po.total_amount || 0) + parseFloat(po.vat_amount || 0)).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
          ${po.notes ? `<div style="margin-top: 24px; padding: 12px; background: #f9f9f9; border-radius: 4px;"><div class="label">{t('common.notes')}</div><div>${po.notes}</div></div>` : ''}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status) => {
    const colors = {
      draft: { bg: '#f5f5f5', color: '#616161' },
      pending_approval: { bg: '#fff3e0', color: '#ef6c00' },
      approved: { bg: '#e3f2fd', color: '#1565c0' },
      ordered: { bg: '#e8f5e9', color: '#2e7d32' },
      received: { bg: '#f3e5f5', color: '#6a1b9a' },
      completed: { bg: '#e8f5e9', color: '#2e7d32' },
      cancelled: { bg: '#fce4ec', color: '#c62828' }
    };
    return colors[status] || colors.draft;
  };

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = !searchTerm || 
      (po.po_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (po.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSupplierName = (po) => {
    if (po.supplier_name) return po.supplier_name;
    if (po.supplier?.name) return po.supplier.name;
    const sup = suppliers.find(s => s._id === po.supplier_id || s.id === po.supplier_id);
    return sup?.name || 'Unknown';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{t('nav.purchaseOrders')}</h1>
        <button className="btn btn-primary" onClick={openCreateModal}>
          {t('po.create')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff3e0', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#ef6c00', fontSize: '14px' }}>{t('po.pendingApproval')}</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ef6c00' }}>{stats.pendingApproval}</div>
        </div>
        <div style={{ background: '#e3f2fd', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#1565c0', fontSize: '14px' }}>{t('po.total')}</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1565c0' }}>{stats.totalPOs}</div>
        </div>
        <div style={{ background: '#e8f5e9', padding: '20px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>{t('finance.thisMonth')}</h3>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2e7d32' }}>{stats.monthSpend.toLocaleString()}</div>
        </div>
      </div>

      <div className="section-card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={t('po.searchPlaceholder')}
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '250px' }}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('common.allLabel')}</option>
            <option value="draft">{t('common.statuses.draft')}</option>
            <option value="pending_approval">{t('po.pendingApproval')}</option>
            <option value="approved">{t('common.statuses.approved')}</option>
            <option value="ordered">{t('po.ordered')}</option>
            <option value="received">{t('po.received')}</option>
          </select>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>{t('po.number')}</th>
              <th>{t('common.supplier')}</th>
              <th>{t('common.items')}</th>
              <th>{t('common.total')}</th>
              <th>{t('po.deliveryDate')}</th>
              <th>{t('common.status')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="loading" style={{ margin: '0 auto' }}></div>
                  <p style={{ marginTop: '12px', color: '#6b7280' }}>Loading purchase orders...</p>
                </td>
              </tr>
            ) : filteredPOs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  No purchase orders found
                </td>
              </tr>
            ) : (
              filteredPOs.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                  <td>{po.supplier_name || getSupplierName(po)}</td>
                  <td>{po.item_count || 0} {t('common.items')}</td>
                  {{egp: t('common.currency'), usd: 'USD'}[po.currency] || 'ج.م'} {(parseFloat(po.total_amount || 0) + parseFloat(po.vat_amount || 0)).toLocaleString()}
                  <td>{po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GB') : '-'}</td>
                  <td>
                    <span style={{
                      background: getStatusBadge(po.status).bg,
                      color: getStatusBadge(po.status).color,
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {po.status ? t('common.statuses.' + po.status.replace(/-/g, '_')) || po.status.replace(/_/g, ' ') : t('common.statuses.draft')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn btn-sm" onClick={() => openViewModal(po)}>{t('common.view')}</button>
                      <button className="btn btn-sm" onClick={() => downloadPOAsPDF(po)} title={t('po.printPDF')}>{t('common.pdf')}</button>
                      <button className="btn btn-sm" onClick={() => sendWhatsApp(po)} title={t('po.shareWhatsApp')}>{t('common.whatsapp')}</button>
                      
                      {po.status === 'draft' && (
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => submitForApproval(po.id)}
                        >
                          {t('po.submitApproval')}
                        </button>
                      )}
                      
                      {po.status === 'pending_approval' && (
                        <>
                          <button 
                            className="btn btn-success btn-sm" 
                            onClick={() => approvePO(po.id)}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => cancelPO(po.id)}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      
                      {po.status === 'approved' && (
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={() => approvePO(po.id)}
                          disabled
                          style={{ opacity: 0.6 }}
                        >
                          Approved
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

      {showModal && !selectedPO && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
          }}>
            <h2>{t('po.create')}</h2>

            <div className="form-group">
              <label className="form-label">Supplier *</label>
              <select
                className="form-input"
                value={formData.supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
              >
                <option value="">Select Supplier</option>
                {suppliers.map(s => (
                  <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {lowStockMaterials.length > 0 && !formData.supplierId && (
              <div className="form-group" style={{ marginBottom: '16px', padding: '16px', background: '#fff8e1', borderRadius: '8px', border: '1px solid #ffc107' }}>
                <label className="form-label" style={{ color: '#e65100', fontSize: '1.1em' }}>
                  ⚠️ Low Stock Materials — Click to auto-fill order with preferred supplier:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  {lowStockMaterials.map(m => {
                    const prefSup = m.preferred_supplier;
                    return (
                      <label key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                        background: 'white', borderRadius: '8px', border: '1px solid #ffc107',
                        cursor: 'pointer', fontSize: '0.9em', userSelect: 'none', minWidth: '200px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                      }}>
                        <input
                          type="checkbox"
                          checked={cartItems.some(i => i.material === m.id.toString())}
                          onChange={(e) => handleLowStockCheck(m, e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{m.name_arabic || m.name_english}</div>
                          <div style={{ fontSize: '0.8em', color: '#666' }}>
                            Stock: {m.current_stock} | Need: {Math.ceil(m.quantity_to_order || 0)} {m.unit || 'kg'}
                          </div>
                          {prefSup && (
                            <div style={{ fontSize: '0.8em', color: '#1565c0' }}>
                              Supplier: {prefSup.name} @ {formatCurrency(prefSup.unit_price)}/kg
                            </div>
                          )}
                          {!prefSup && (
                            <div style={{ fontSize: '0.8em', color: '#e65100' }}>{t('po.noSupplier')}</div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {formData.supplierId && supplierMaterials.filter(m => parseFloat(m.current_stock) <= parseFloat(m.reorder_level)).length > 0 && (
              <div className="form-group" style={{ marginBottom: '16px', padding: '12px', background: '#e8f5e9', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
                <label className="form-label" style={{ color: '#2e7d32' }}>More low stock from this supplier:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {supplierMaterials.filter(m => parseFloat(m.current_stock) <= parseFloat(m.reorder_level)).map(m => (
                    <label key={m.id || m.code} style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                      background: 'white', borderRadius: '20px', border: '1px solid #a5d6a7',
                      cursor: 'pointer', fontSize: '0.9em', userSelect: 'none'
                    }}>
                      <input
                        type="checkbox"
                        checked={cartItems.some(i => i.material === (m.id?.toString() || m.code))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCartItems([...cartItems, {
                              material: m.id?.toString() || m.code,
                              quantity: Math.max(m.reorder_level - m.current_stock, 0).toString(),
                              unit: 'kg',
                              unitPrice: m.unit_price?.toString() || '0',
                              total: Math.max(m.reorder_level - m.current_stock, 0) * (parseFloat(m.unit_price) || 0)
                            }]);
                          } else {
                            setCartItems(cartItems.filter(i => i.material !== (m.id?.toString() || m.code)));
                          }
                        }}
                      />
                      <span>{m.name_arabic || m.name_english}</span>
                      <span style={{ fontSize: '0.8em', color: '#2e7d32' }}>(stock: {m.current_stock})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t('common.items')}</label>
              {cartItems.map((item, index) => (
                <div key={index} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'auto 2fr 1fr 1fr 1fr 1fr auto', 
                  gap: '8px',
                  marginBottom: '8px',
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  alignItems: 'center'
                }}>
                  <input
                    type="checkbox"
                    checked={true}
                    onChange={() => removeCartItem(index)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <select
                    className="form-input"
                    value={item.material}
                    onChange={(e) => updateCartItem(index, 'material', e.target.value)}
                    style={{ fontSize: '0.9em' }}
                  >
                    <option value="">-- Select Material --</option>
                    {materials.map(m => (
                      <option key={m.id || m.code} value={m.id || m.code} style={{
                        background: (parseFloat(m.current_stock) <= parseFloat(m.reorder_level)) ? '#fff3cd' : 'white'
                      }}>
                        {m.name_arabic || m.name} {(parseFloat(m.current_stock) <= parseFloat(m.reorder_level)) ? '⚠️' : ''}
                        {' '}(stock: {m.current_stock} {m.unit || 'kg'})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Qty"
                    className="form-input"
                    value={item.quantity}
                    onChange={(e) => updateCartItem(index, 'quantity', e.target.value)}
                  />
                  <select
                    className="form-input"
                    value={item.unit}
                    onChange={(e) => updateCartItem(index, 'unit', e.target.value)}
                  >
                    <option value="kg">kg</option>
                    <option value="bag">bag</option>
                    <option value="ton">ton</option>
                    <option value="ltr">ltr</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Price"
                    className="form-input"
                    value={item.unitPrice}
                    onChange={(e) => updateCartItem(index, 'unitPrice', e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontWeight: 600, fontSize: '0.95em', color: '#1565c0', padding: '0 8px' }}>
                    {item.total ? `ج.م ${(item.total).toLocaleString()}` : '-'}
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-sm" 
                    onClick={() => removeCartItem(index)}
                    style={{ color: '#d32f2f' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-primary" onClick={addCartItem}>
                + Add Item
              </button>
            </div>

            {cartItems.length > 0 && (
              <div style={{ 
                background: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Subtotal:</span>
                  <span>EGP {calculateTotals().subtotal.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>VAT (14%):</span>
                  <span>EGP {calculateTotals().vat.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
                  <span>Total:</span>
                  <span>EGP {calculateTotals().total.toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Delivery Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.notes')}</label>
              <textarea
                className="form-input"
                rows="3"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn" onClick={closeModal}>{t('common.cancel')}</button>
              <button 
                type="button" 
                className="btn btn-success" 
                onClick={handleCreatePO}
                disabled={!formData.supplierId || cartItems.length === 0}
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedPO && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>{selectedPO.po_number}</h2>
              <span style={{
                background: getStatusBadge(selectedPO.status).bg,
                color: getStatusBadge(selectedPO.status).color,
                padding: '6px 16px',
                borderRadius: '16px',
                fontSize: '14px',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {selectedPO.status ? selectedPO.status.replace(/_/g, ' ') : 'Draft'}
              </span>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px' }}>Supplier Information</h4>
              <p><strong>Name:</strong> {selectedPO.supplier_name || getSupplierName(selectedPO)}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '12px' }}>{t('common.items')}</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('common.material')}</th>
                    <th>{t('common.quantity')}</th>
                    <th>Unit Price</th>
                    <th>{t('common.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPOItems.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: '#9ca3af' }}>
                        No item details available
                      </td>
                    </tr>
                  ) : (
                    selectedPOItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.raw_material_name || item.material || '-'}</td>
                        <td>{formatNumber(item.quantity)} kg</td>
                        <td>{formatCurrency(parseFloat(item.unit_cost))}</td>
                        <td>{formatCurrency(parseFloat(item.total_cost))}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>

              <div style={{ 
                background: '#f5f5f5', 
                padding: '16px', 
                borderRadius: '4px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px' }}>
                  <span>Subtotal (excl. VAT):</span>
                  <span>{formatCurrency(parseFloat(selectedPO.total_amount))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '14px', color: '#6b7280' }}>
                  <span>VAT (14%):</span>
                  <span>{formatCurrency(parseFloat(selectedPO.vat_amount || 0))}</span>
                </div>
                <div style={{ borderTop: '1px solid #ddd', margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px' }}>
                  <span>Grand Total:</span>
                  <span>{formatCurrency(parseFloat(selectedPO.total_amount || 0) + parseFloat(selectedPO.vat_amount || 0))}</span>
                </div>
              </div>

              <p><strong>Delivery Date:</strong> {selectedPO.expected_date ? new Date(selectedPO.expected_date).toLocaleDateString('en-GB') : 'N/A'}</p>
            {selectedPO.notes && (
              <p style={{ marginTop: '8px' }}><strong>Notes:</strong> {selectedPO.notes}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn" onClick={() => downloadPOAsPDF(selectedPO)}>{t('common.pdf')}</button>
              <button type="button" className="btn" onClick={() => sendWhatsApp(selectedPO)}>{t('common.whatsapp')}</button>
              {selectedPO.status === 'pending_approval' && (
                <>
                  <button type="button" className="btn btn-success" onClick={() => { approvePO(selectedPO.id); closeModal(); }}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => { cancelPO(selectedPO.id); closeModal(); }}>
                    Reject
                  </button>
                </>
              )}
              <button type="button" className="btn" onClick={closeModal}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
