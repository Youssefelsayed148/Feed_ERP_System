import React, { useState } from 'react';
import { X, Bell, Calendar, MessageSquare, User, Check } from 'lucide-react';

const ReminderModal = ({ isOpen, onClose, onSubmit, clients, preselectedClient = null }) => {
  const [formData, setFormData] = useState({
    clientId: preselectedClient?.id || '',
    title: '',
    message: '',
    reminderDate: '',
    reminderType: 'follow_up'
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
        setFormData({ clientId: '', title: '', message: '', reminderDate: '', reminderType: 'follow_up' });
      }, 1500);
    } catch (error) {
      console.error('Error creating reminder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reminderTypes = [
    { value: 'payment', label: '💰 تحصيل دفعة', color: '#10b981' },
    { value: 'follow_up', label: '📞 متابعة هاتفية', color: '#3b82f6' },
    { value: 'order', label: '📦 متابعة طلب', color: '#f59e0b' },
    { value: 'visit', label: '🚗 زيارة عميل', color: '#8b5cf6' },
    { value: 'call', label: '📱 مكالمة مجدولة', color: '#ec4899' },
    { value: 'other', label: '📝 أخرى', color: '#6b7280' }
  ];

  return (
    <div className="modal-overlay-component" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-container-component">
        <div className="modal-header-component">
          <div className="modal-header-left">
            <Bell size={24} color="#ec4899" />
            <h2 className="modal-title-component">إضافة تذكير</h2>
          </div>
          <button onClick={onClose} className="modal-close-component" aria-label="إغلاق">
            <X size={24} />
          </button>
        </div>

        {success && (
          <div className="modal-success-message">
            <Check size={20} />
            <span>تم إنشاء التذكير بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body-component">
          <div className="modal-form-group">
            <label className="modal-label">
              العميل <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                required
                disabled={!!preselectedClient}
              >
                <option value="">اختر العميل</option>
                {clients?.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name_arabic} {client.name_english ? `(${client.name_english})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-form-group">
            <label className="modal-label">
              نوع التذكير <span className="required">*</span>
            </label>
            <div className="type-grid">
              {reminderTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({...formData, reminderType: type.value})}
                  className={`type-btn ${formData.reminderType === type.value ? 'active' : ''}`}
                  style={formData.reminderType === type.value ? { borderColor: type.color, backgroundColor: `${type.color}15`, color: type.color } : {}}
                >
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="modal-form-group">
            <label className="modal-label">
              العنوان <span className="required">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="form-input"
              placeholder="مثال: تحصيل دفعة فاتورة رقم 1234"
              required
            />
          </div>

          <div className="modal-form-group">
            <label className="modal-label">
              تاريخ ووقت التذكير <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input
                type="datetime-local"
                value={formData.reminderDate}
                onChange={(e) => setFormData({...formData, reminderDate: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="modal-form-group">
            <label className="modal-label">
              الرسالة <span className="optional">(اختياري)</span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              className="form-textarea"
              placeholder="ملاحظات إضافية حول هذا التذكير..."
              rows={3}
            />
          </div>

          <div className="modal-footer-component" style={{ margin: '24px -24px -24px', padding: '16px 24px' }}>
            <button type="button" onClick={onClose} className="modal-cancel-btn">
              إلغاء
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={isSubmitting || !formData.clientId || !formData.title || !formData.reminderDate}
            >
              {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء التذكير'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal;