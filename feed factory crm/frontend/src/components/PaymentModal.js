import React, { useState } from 'react';
import { X, CreditCard, DollarSign, Calendar, FileText, Check } from 'lucide-react';

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
        setFormData({ clientId: '', invoiceId: '', amount: '', method: 'cash', date: new Date().toISOString().split('T')[0], description: '' });
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
        <div className="modal-header-component">
          <div className="modal-header-left">
            <CreditCard size={24} color="#3b82f6" />
            <h2 className="modal-title-component">تسجيل دفعة</h2>
          </div>
          <button onClick={onClose} className="modal-close-component" aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        {success && (
          <div className="modal-success-message">
            <Check size={20} />
            <span>تم تسجيل الدفعة بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body-component">
          <div className="modal-form-group">
            <label className="modal-label">
              العميل <span className="required">*</span>
            </label>
            <select
              value={formData.clientId}
              onChange={(e) => setFormData({...formData, clientId: e.target.value, invoiceId: ''})}
              className="form-select"
              required
              disabled={!!preselectedClient}
            >
              <option value="">اختر العميل</option>
              {clients?.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name_arabic} {client.name_english ? `(${client.name_english})` : ''}
                  {client.due_amount > 0 ? ` - المستحق: ${parseFloat(client.due_amount).toLocaleString()} EGP` : ''}
                </option>
              ))}
            </select>
          </div>

          {formData.clientId && selectedClientInvoices.length > 0 && (
            <div className="modal-form-group">
              <label className="modal-label">
                تطبيق على فاتورة <span className="optional">(اختياري)</span>
              </label>
              <select
                value={formData.invoiceId}
                onChange={(e) => setFormData({...formData, invoiceId: e.target.value})}
                className="form-select"
              >
                <option value="">اختر الفاتورة (أو اتركها فارغة لدفعة عامة)</option>
                {selectedClientInvoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - الرصيد: {parseFloat(invoice.balance_due).toLocaleString()} EGP
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-form-group">
            <label className="modal-label">
              المبلغ <span className="required">*</span>
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

          <div className="modal-form-group">
            <label className="modal-label">
              طريقة الدفع <span className="required">*</span>
            </label>
            <div className="method-grid">
              {[
                { value: 'cash', label: '💵 نقدي' },
                { value: 'bank_transfer', label: '🏦 تحويل بنكي' },
                { value: 'check', label: '📝 شيك' },
                { value: 'credit_card', label: '💳 بطاقة ائتمان' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFormData({...formData, method: value})}
                  className={`method-btn ${formData.method === value ? 'active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-form-group">
            <label className="modal-label">
              تاريخ الدفع <span className="required">*</span>
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

          <div className="modal-form-group">
            <label className="modal-label">
              الوصف <span className="optional">(اختياري)</span>
            </label>
            <div className="input-with-icon">
              <FileText size={18} className="input-icon" />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="ملاحظات الدفع..."
              />
            </div>
          </div>

          <div className="modal-footer-component" style={{ margin: '24px -24px -24px', padding: '16px 24px' }}>
            <button type="button" onClick={onClose} className="modal-cancel-btn">
              إلغاء
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isSubmitting || !formData.clientId || !formData.amount}
            >
              {isSubmitting ? 'جاري التسجيل...' : 'تسجيل الدفعة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;