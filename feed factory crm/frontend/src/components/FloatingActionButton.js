import React, { useState } from 'react';
import { 
  Plus, 
  UserPlus, 
  FileText, 
  CreditCard, 
  ShoppingCart,
  X,
  Bell
} from 'lucide-react';
import { t } from '../utils/i18n';

/**
 * FloatingActionButton Component
 * Quick access buttons for Sales Reps and Managers
 * - Add Order
 * - Add Client
 * - Add Invoice
 * - Add Payment
 * - Add Reminder
 */

const FloatingActionButton = ({ 
  onAddOrder, 
  onAddClient, 
  onAddInvoice, 
  onAddPayment,
  onAddReminder,
  userRole 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const isManager = userRole === 'sales_manager' || userRole === 'admin' || userRole === 'owner';

  const actions = [
    {
      id: 'order',
      label: t('sales.newOrder'),
      icon: ShoppingCart,
      color: '#3b82f6',
      onClick: () => {
        onAddOrder?.();
        setIsOpen(false);
      },
      show: true
    },
    {
      id: 'client',
      label: t('common.newClient'),
      icon: UserPlus,
      color: '#10b981',
      onClick: () => {
        onAddClient?.();
        setIsOpen(false);
      },
      show: isManager // Only managers can add clients
    },
    {
      id: 'invoice',
      label: t('common.createInvoice'),
      icon: FileText,
      color: '#f59e0b',
      onClick: () => {
        onAddInvoice?.();
        setIsOpen(false);
      },
      show: isManager // Only managers can create invoices
    },
    {
      id: 'payment',
      label: t('common.recordPayment'),
      icon: CreditCard,
      color: '#8b5cf6',
      onClick: () => {
        onAddPayment?.();
        setIsOpen(false);
      },
      show: true
    },
    {
      id: 'reminder',
      label: t('common.addReminder'),
      icon: Bell,
      color: '#ec4899',
      onClick: () => {
        onAddReminder?.();
        setIsOpen(false);
      },
      show: true
    }
  ].filter(action => action.show);

  return (
    <div className="fab-container">
      {isOpen && (
        <div className="fab-actions">
          {actions.map((action, index) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className="fab-action-btn"
              style={{
                backgroundColor: action.color,
                animationDelay: `${index * 0.05}s`
              }}
              aria-label={action.label}
            >
              <action.icon size={20} color="white" />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fab-main-btn"
        style={{
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
          backgroundColor: isOpen ? '#ef4444' : '#3b82f6'
        }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X size={28} color="white" /> : <Plus size={28} color="white" />}
      </button>
    </div>
  );
};

export default FloatingActionButton;
