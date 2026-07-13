import React from 'react';
import { X, Package, Calendar, User, Hash, DollarSign, Percent, Truck, FileText, AlertCircle } from 'lucide-react';
import { getStatusLabel } from '../utils/formatters';

const statusColors = {
  pending_approval: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  approved: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  confirmed: { bg: '#f0fdf4', text: '#047857', border: '#bbf7d0' },
  processing: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  in_transit: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  delivered: { bg: '#f0fdf4', text: '#047857', border: '#bbf7d0' },
  rejected: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  cancelled: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' }
};

export default function OrderDetailModal({ order, items, onClose, onApprove, onReject, isManager }) {
  if (!order) return null;
  const colors = statusColors[order.status] || statusColors.cancelled;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: '20px'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="#1d4ed8" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>{order.order_number}</h2>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#6b7280' }}>{order.client_name || order.client_name_en}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              padding: '4px 14px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
              background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
              textTransform: 'capitalize'
            }}>
              {({'pending_approval':'بانتظار الاعتماد','approved':'معتمد','confirmed':'مؤكد','processing':'قيد التنفيذ','in_transit':'في الطريق','delivered':'تم التسليم','rejected':'مرفوض','cancelled':'ملغي'}[order.status] || order.status?.replace(/_/g, ' '))}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}>
              <X size={22} color="#6b7280" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {/* Info Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
            background: '#f8fafc', borderRadius: '12px', padding: '16px', marginBottom: '20px'
          }}>
            <InfoRow icon={Hash} label="رقم الطلب" value={order.order_number} />
            <InfoRow icon={User} label="أنشئ بواسطة" value={order.created_by_name || 'غير متاح'} />
            <InfoRow icon={Calendar} label="تاريخ الإنشاء" value={new Date(order.created_at).toLocaleString()} />
            <InfoRow icon={Calendar} label="تاريخ التسليم" value={order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'غير محدد'} />
            <InfoRow icon={DollarSign} label="حالة الدفع" value={order.payment_status ? getStatusLabel(order.payment_status) : 'غير متاح'} />
            <InfoRow icon={User} label="اعتمد بواسطة" value={order.approved_by_name || 'غير متاح'} />
          </div>

          {/* Order Items */}
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={16} /> عناصر الطلب
          </h3>
          <div style={{ borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>نوع العلف</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>التعبئة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>الكمية</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>سعر الوحدة</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e5e7eb' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(items || []).map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>
                      {item.feed_type_name_ar || item.feed_type_name || `علف #${item.feed_type_id}`}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#6b7280' }}>{item.package_size}kg</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{parseFloat(item.unit_price || 0).toLocaleString()} EGP</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>{parseFloat(item.total_price || 0).toLocaleString()} EGP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary */}
          <div style={{
            background: '#f9fafb', borderRadius: '12px', padding: '16px',
            border: '1px solid #e5e7eb', marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', margin: '0 0 12px' }}>الملخص المالي</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span style={{ color: '#6b7280' }}>المجموع الجزئي</span>
                <span style={{ fontWeight: 500 }}>{parseFloat(order.total_amount || 0).toLocaleString()} EGP</span>
              </div>
              {parseFloat(order.discount_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#6b7280' }}>الخصم</span>
                  <span style={{ fontWeight: 500, color: '#059669' }}>-{parseFloat(order.discount_amount || 0).toLocaleString()} EGP</span>
                </div>
              )}
              {parseFloat(order.tax_amount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: '#6b7280' }}>الضريبة</span>
                  <span style={{ fontWeight: 500 }}>{parseFloat(order.tax_amount || 0).toLocaleString()} EGP</span>
                </div>
              )}
              <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>المبلغ النهائي</span>
                <span style={{ fontWeight: 800, color: '#059669' }}>{parseFloat(order.final_amount || 0).toLocaleString()} EGP</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{
              background: '#fffbeb', borderRadius: '12px', padding: '14px 16px',
              border: '1px solid #fde68a', display: 'flex', gap: '10px', alignItems: 'flex-start'
            }}>
              <FileText size={18} color="#b45309" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>ملاحظات</p>
                <p style={{ fontSize: '13px', color: '#78350f', margin: 0 }}>{order.notes}</p>
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          {order.status === 'rejected' && order.rejection_reason && (
            <div style={{
              background: '#fef2f2', borderRadius: '12px', padding: '14px 16px',
              border: '1px solid #fecaca', display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '12px'
            }}>
              <AlertCircle size={18} color="#b91c1c" style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b', margin: '0 0 4px' }}>سبب الرفض</p>
                <p style={{ fontSize: '13px', color: '#7f1d1d', margin: 0 }}>{order.rejection_reason}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '12px',
          padding: '16px 24px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0
        }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db',
            background: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
            color: '#374151'
          }}>إغلاق</button>
          {isManager && order.status === 'pending_approval' && (
            <>
              <button onClick={() => onReject(order.id)} style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '14px', fontWeight: 600
              }}>رفض</button>
              <button onClick={() => onApprove(order.id)} style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
              }}>موافقة</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color="#6b7280" />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>{label}</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>{value}</p>
      </div>
    </div>
  );
}