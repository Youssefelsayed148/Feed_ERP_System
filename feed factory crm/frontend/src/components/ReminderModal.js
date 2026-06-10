import React, { useState } from 'react';
import { X, Bell, Calendar, MessageSquare, User, Check } from 'lucide-react';

/**
 * ReminderModal Component
 * Create reminders for clients - linked to client file
 * Sales reps can set reminders for follow-ups, payments, etc.
 */

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
        // Reset form
        setFormData({
          clientId: '',
          title: '',
          message: '',
          reminderDate: '',
          reminderType: 'follow_up'
        });
      }, 1500);
    } catch (error) {
      console.error('Error creating reminder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reminderTypes = [
    { value: 'payment', label: '💰 Payment Collection', color: '#10b981' },
    { value: 'follow_up', label: '📞 Follow-up Call', color: '#3b82f6' },
    { value: 'order', label: '📦 Order Follow-up', color: '#f59e0b' },
    { value: 'visit', label: '🚗 Client Visit', color: '#8b5cf6' },
    { value: 'call', label: '📱 Scheduled Call', color: '#ec4899' },
    { value: 'other', label: '📝 Other', color: '#6b7280' }
  ];

  return (
    <div className="modal-overlay-component" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-container-component">
        {/* Header */}
        <div className="modal-header-component">
          <div className="modal-header-left">
            <Bell size={24} color="#ec4899" />
            <h2 className="modal-title-component">Add Reminder</h2>
          </div>
          <button onClick={onClose} className="modal-close-component" aria-label="Close">
            <X size={24} />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="modal-success-message">
            <Check size={20} />
            <span>Reminder created successfully!</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="modal-body-component">
          {/* Client Selection */}
          <div className="modal-form-group">
            <label className="modal-label">
              Client <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <select
                value={formData.clientId}
                onChange={(e) => setFormData({...formData, clientId: e.target.value})}
                required
                disabled={!!preselectedClient}
              >
                <option value="">Select Client</option>
                {clients?.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name_arabic} {client.name_english ? `(${client.name_english})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reminder Type */}
          <div className="modal-form-group">
            <label className="modal-label">
              Reminder Type <span className="required">*</span>
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

          {/* Title */}
          <div className="modal-form-group">
            <label className="modal-label">
              Title <span className="required">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="form-input"
              placeholder="e.g., Collect payment for Invoice #1234"
              required
            />
          </div>

          {/* Reminder Date */}
          <div className="modal-form-group">
            <label className="modal-label">
              Reminder Date & Time <span className="required">*</span>
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

          {/* Message */}
          <div className="modal-form-group">
            <label className="modal-label">
              Message <span className="optional">(Optional)</span>
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              className="form-textarea"
              placeholder="Additional notes about this reminder..."
              rows={3}
            />
          </div>

          {/* Submit Buttons */}
          <div className="modal-footer-component" style={{ margin: '24px -24px -24px', padding: '16px 24px' }}>
            <button type="button" onClick={onClose} className="modal-cancel-btn">
              Cancel
            </button>
            <button 
              type="submit" 
              className="modal-submit-btn"
              disabled={isSubmitting || !formData.clientId || !formData.title || !formData.reminderDate}
            >
              {isSubmitting ? 'Creating...' : 'Create Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal;
