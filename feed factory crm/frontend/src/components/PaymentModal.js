import React, { useState } from 'react';
import { X, CreditCard, DollarSign, Calendar, FileText, Check } from 'lucide-react';

/**
 * PaymentModal Component
 * Records payments for clients - linked to client file
 * Accessible from client detail view or FAB
 */

const PaymentModal = ({ isOpen, onClose, onSubmit, clients, preselectedClient = null, invoices = [] }) => {
  const [formData, setFormData] = useState({
    clientId: preselectedClient?.id || '',
    invoiceId: '',
    amount: '',
    method: 'cash',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSubmit(formData);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        // Reset form
        setFormData({
          clientId: '',
          invoiceId: '',
          amount: '',
          method: 'cash',
          date: new Date().toISOString().split('T')[0],
          description: ''
        });
      }, 1500);
    } catch (error) {
      console.error('Error recording payment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedClientInvoices = invoices.filter(inv => 
    inv.client_id === parseInt(formData.clientId) && inv.status !== 'paid'
  );

  return (
    <div className="modal-overlay-component" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-container-component">
        {/* Header */}
        <div className="modal-header-component">
          <div className="modal-header-left">
            <CreditCard size={24} color="#3b82f6" />
            <h2 className="modal-title-component">Record Payment</h2>
          </div>
          <button onClick={onClose} className="modal-close-component" aria-label="Close">
            <X size={24} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="modal-success-message">
            <Check size={20} />
            <span>Payment recorded successfully!</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body-component">
          {/* Client Selection */}
          <div className="modal-form-group">
            <label className="modal-label">
              Client <span className="required">*</span>
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({...formData, clientId: e.target.value, invoiceId: ''})}
              className="form-select"
              required
              disabled={!!preselectedClient}
            >
              <option value="">Select Client</option>
              {clients?.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name_arabic} {client.name_english ? `(${client.name_english})` : ''}
                  {client.due_amount > 0 ? ` - Due: ${parseFloat(client.due_amount).toLocaleString()} EGP` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Selection (Optional) */}
          {formData.clientId && selectedClientInvoices.length > 0 && (
            <div className="modal-form-group">
              <label className="modal-label">
                Apply to Invoice <span className="optional">(Optional)</span>
              </label>
              <select
                value={formData.invoiceId}
                onChange={(e) => setFormData({...formData, invoiceId: e.target.value})}
                className="form-select"
              >
                <option value="">Select Invoice (or leave blank for general payment)</option>
                {selectedClientInvoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - Balance: {parseFloat(invoice.balance_due).toLocaleString()} EGP
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div className="modal-form-group">
            <label className="modal-label">
              Amount <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <DollarSign size={18} className="input-icon" />
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
              />
              <span className="input-currency">EGP</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="modal-form-group">
            <label className="modal-label">
              Payment Method <span className="required">*</span>
            </label>
            <div className="method-grid">
              {['cash', 'bank_transfer', 'check', 'credit_card'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setFormData({...formData, method})}
                  className={`method-btn ${formData.method === method ? 'active' : ''}`}
                >
                  {method === 'cash' && '💵 Cash'}
                  {method === 'bank_transfer' && '🏦 Bank Transfer'}
                  {method === 'check' && '📝 Check'}
                  {method === 'credit_card' && '💳 Credit Card'}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="modal-form-group">
            <label className="modal-label">
              Payment Date <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="modal-form-group">
            <label className="modal-label">
              Description <span className="optional">(Optional)</span>
            </label>
            <div className="input-with-icon">
              <FileText size={18} className="input-icon" />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Payment notes..."
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="modal-footer-component" style={{ margin: '24px -24px -24px', padding: '16px 24px' }}>
            <button type="button" onClick={onClose} className="modal-cancel-btn">
              Cancel
            </button>
            <button 
              type="submit" 
              className="modal-submit-btn"
              disabled={isSubmitting || !formData.clientId || !formData.amount}
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
