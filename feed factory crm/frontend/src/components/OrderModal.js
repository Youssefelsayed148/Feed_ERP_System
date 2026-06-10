import React, { useState } from 'react';
import { X, Truck, Plus, RefreshCw, Send } from 'lucide-react';

// Multi-Material Purchase Order Modal
const OrderFromSupplierModal = ({ supplier, rawMaterials, onClose, onSubmit }) => {
  // Get supplier's materials with full details (match by material code like "RM001")
  const supplierMaterials = (supplier.materials || supplier.materialsSupplied || [])?.map(matCode => {
    const material = rawMaterials.find(rm => rm.code === matCode || rm._id === matCode || String(rm._id) === String(matCode));
    return material;
  }).filter(Boolean) || [];

  // State for order lines - each line is { material, quantity, unitPrice, total }
  const [orderLines, setOrderLines] = useState([
    { material: null, quantity: '', unitPrice: '', total: 0 }
  ]);
  
  const [formData, setFormData] = useState({
    deliveryDate: '',
    notes: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add new line
  const addLine = () => {
    setOrderLines([...orderLines, { material: null, quantity: '', unitPrice: '', total: 0 }]);
  };
  
  // Remove line
  const removeLine = (index) => {
    if (orderLines.length > 1) {
      setOrderLines(orderLines.filter((_, i) => i !== index));
    }
  };
  
  // Update line
  const updateLine = (index, field, value) => {
    const newLines = [...orderLines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // Calculate total
    if (field === 'quantity' || field === 'unitPrice' || field === 'material') {
      const qty = parseFloat(newLines[index].quantity) || 0;
      const price = parseFloat(newLines[index].unitPrice) || 0;
      newLines[index].total = qty * price;
    }
    
    setOrderLines(newLines);
  };
  
  // Calculate grand total
  const subtotal = orderLines.reduce((sum, line) => sum + (line.total || 0), 0);
  const vat = subtotal * 0.14;
  const grandTotal = subtotal + vat;
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out empty lines
    const validLines = orderLines.filter(line => line.material && line.quantity && line.unitPrice);
    
    if (validLines.length === 0) {
      alert('Please add at least one material with quantity and price');
      return;
    }
    
    setIsSubmitting(true);
    
    const orderData = {
      supplierId: supplier._id,
      items: validLines.map(line => ({
        material: line.material._id || line.material.id,
        materialName: line.material.name_arabic || line.material.name || line.material.name_english || line.material.code,
        quantity: parseFloat(line.quantity),
        unit: line.material.unit,
        unitPrice: parseFloat(line.unitPrice),
        total: line.total
      })),
      subtotal: subtotal,
      vatRate: 14,
      vatAmount: 0,
      total: subtotal,
      deliveryDate: formData.deliveryDate,
      notes: formData.notes,
      status: 'pending',
      currency: 'EGP'
    };
    
    await onSubmit(orderData);
    setIsSubmitting(false);
    onClose();
  };
  
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-large order-modal">
        <div className="modal-header">
          <h2 className="modal-title">Create Purchase Order - {supplier.name}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Supplier Info */}
            <div className="order-supplier-info">
              <div className="order-supplier-name">
                <Truck size={16} />
                {supplier.name}
              </div>
              <div className="order-supplier-meta">
                {(supplier.materials || supplier.materialsSupplied || []).length} materials available
              </div>
            </div>
            
            {/* Order Lines Table */}
            <div style={{ marginBottom: '20px' }}>
              <div className="order-lines-header">
                <div>Material</div>
                <div>Quantity</div>
                <div>Unit Price</div>
                <div>Total</div>
                <div></div>
              </div>
              
              {orderLines.map((line, index) => (
                <div key={index} className="order-line">
                  {/* Material Select */}
                  <select
                    className="form-input"
                    value={line.material?.code || line.material?._id || ''}
                    onChange={(e) => {
                      const mat = supplierMaterials.find(m => m.code === e.target.value || m._id === e.target.value);
                      updateLine(index, 'material', mat);
                      // Auto-fill unit price
                      if (mat) {
                        updateLine(index, 'unitPrice', mat.unitPrice || mat.unit_price || 0);
                      }
                    }}
                    required
                  >
                    <option value="">Select material...</option>
                    {supplierMaterials.map(mat => (
                      <option key={mat.code || mat._id} value={mat.code || mat._id}>
                        {mat.name_arabic || mat.name || mat.name_english || mat.code} - {(mat.unit_price || mat.unitPrice || 0).toFixed(2)} EGP/{mat.unit || 'kg'}
                      </option>
                    ))}
                  </select>
                  
                  {/* Quantity */}
                  <input
                    type="number"
                    className="form-input"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    min="0.01"
                    step="0.01"
                    placeholder="Qty"
                    required
                  />
                  
                  {/* Unit Price */}
                  <input
                    type="number"
                    className="form-input"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    required
                  />
                  
                  {/* Total */}
                  <div className="order-line-total">
                    {line.total.toLocaleString()} EGP
                  </div>
                  
                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="order-line-remove"
                    disabled={orderLines.length === 1}
                    title="Remove line"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              
              {/* Add Line Button */}
              <button
                type="button"
                onClick={addLine}
                className="add-line-btn"
              >
                <Plus size={18} />
                Add Another Material
              </button>
            </div>
            
            {/* Totals */}
            <div className="order-totals-box">
              <div className="order-total-row">
                <span>Subtotal:</span>
                <span>{subtotal.toLocaleString()} EGP</span>
              </div>
              <div className="order-total-row">
                <span>VAT (14%):</span>
                <span>{vat.toLocaleString()} EGP</span>
              </div>
              <div className="order-total-row grand-total">
                <span>Grand Total:</span>
                <span>{grandTotal.toLocaleString()} EGP</span>
              </div>
            </div>
            
            {/* Delivery Date */}
            <div className="form-group">
              <label className="form-label">Required Delivery Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.deliveryDate}
                onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            
            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special requirements, delivery instructions, etc..."
                rows="3"
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-success"
              disabled={isSubmitting || orderLines.filter(l => l.material && l.quantity).length === 0}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="loading-spin" style={{ marginRight: '8px', display: 'inline' }} />
                  Creating...
                </>
              ) : (
                <>
                  <Send size={16} style={{ marginRight: '8px', display: 'inline' }} />
                  Create Purchase Order ({orderLines.filter(l => l.material && l.quantity).length} items)
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderFromSupplierModal;
