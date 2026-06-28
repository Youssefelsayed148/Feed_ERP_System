import { t } from '../utils/i18n';
import { formatCurrency, formatDate } from '../utils/formatters';
import React, { useState, useEffect } from 'react';
import { grnService, authService } from '../services/api';

const GRN = () => {
  const currentUser = authService.getCurrentUser();
  const canApproveGRN = currentUser?.role === 'owner' || currentUser?.role === 'admin';
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [grnList, setGrnList] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [grnErrors, setGrnErrors] = useState({});

  const formatDDMMYYYY = (dateStr) => {
    if (!dateStr) return 'غير محدد';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'غير محدد';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const translateUnit = (u) => u === 'ton' ? 'طن' : u === 'kg' ? 'كجم' : (u || 'كجم');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [posRes, grnsRes] = await Promise.all([
        grnService.getEligiblePOs(),
        grnService.getGRNs()
      ]);
      if (posRes.purchaseOrders) setPurchaseOrders(posRes.purchaseOrders);
      if (grnsRes.grns) setGrnList(grnsRes.grns);
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = (po) => {
    setSelectedPO(po);
    setGrnErrors({});
    setReceiptItems((po.items || []).map(item => ({
      ...item,
      raw_material_id: item.raw_material_id,
      materialName: item.name || item.raw_material_name || 'Unknown',
      orderedQty: item.quantity || item.quantity_ordered || 0,
      acceptedQty: item.quantity || item.quantity_ordered || 0,
      rejectedQty: 0,
      rejectionReason: '',
      unitCost: item.unit_cost || 0,
      unit: item.unit || 'kg'
    })));
    setInspectionNotes('');
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedPO(null);
    setReceiptItems([]);
    setInspectionNotes('');
    setGrnErrors({});
  };

  const openViewModal = async (grn) => {
    try {
      const res = await grnService.getGRN(grn.id);
      setSelectedGRN(res);
      setShowViewModal(true);
    } catch (err) {
      alert('Failed to load GRN details: ' + err.message);
    }
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedGRN(null);
  };

  const updateReceiptItem = (index, field, value) => {
    const updated = [...receiptItems];
    updated[index][field] = value;
    if (field === 'acceptedQty') {
      const ordered = Number(updated[index].orderedQty) || 0;
      const accepted = Math.min(ordered, Math.max(0, Number(value) || 0));
      updated[index].acceptedQty = accepted;
      updated[index].rejectedQty = Math.max(0, ordered - accepted);
    }
    if (field === 'rejectionReason' && grnErrors[`reason_${index}`]) {
      setGrnErrors(prev => ({ ...prev, [`reason_${index}`]: undefined }));
    }
    setReceiptItems(updated);
  };

  const calculateTotals = () => {
    const totalAccepted = receiptItems.reduce((sum, item) => sum + Number(item.acceptedQty || 0), 0);
    const totalRejected = receiptItems.reduce((sum, item) => sum + Number(item.rejectedQty || 0), 0);
    return { totalAccepted, totalRejected };
  };

  const createGRN = async () => {
    if (!selectedPO) return;
    const errors = {};
    const hasRejections = receiptItems.some(item => Number(item.rejectedQty) > 0);
    if (hasRejections && !inspectionNotes.trim()) {
      errors.notes = 'ملاحظات الفحص مطلوبة عند رفض أي كمية';
    }
    receiptItems.forEach((item, idx) => {
      if (Number(item.rejectedQty) > 0 && !item.rejectionReason.trim()) {
        errors[`reason_${idx}`] = 'أدخل سبب رفض الكمية المرفوضة';
      }
    });
    if (Object.keys(errors).length > 0) {
      setGrnErrors(errors);
      return;
    }
    setGrnErrors({});
    setLoading(true);
    try {
      const items = receiptItems.map(item => ({
        raw_material_id: item.raw_material_id,
        quantity_ordered: item.orderedQty,
        quantity_received: Number(item.acceptedQty) || 0,
        quantity_accepted: Number(item.acceptedQty) || 0,
        quantity_rejected: Number(item.rejectedQty) || 0,
        rejection_reason: item.rejectionReason || null,
        unit_cost: item.unit_cost,
        total_cost: (Number(item.acceptedQty) || 0) * (item.unit_cost || 0),
        unit: item.unit || 'kg'
      }));

      const totalAmount = items.reduce((sum, item) => sum + item.total_cost, 0);
      const grnNumber = `GRN-${Date.now()}`;

      await grnService.createGRN({
        grn_number: grnNumber,
        purchase_order_id: selectedPO.id,
        supplier_id: selectedPO.supplier_id,
        receipt_date: new Date().toISOString().split('T')[0],
        notes: inspectionNotes,
        items,
        total_amount: totalAmount
      });

      await loadData();
      closeCreateModal();
    } catch (err) {
      setError('Failed to create GRN: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGRN = async (grnId) => {
    if (!window.confirm('هل تريد اعتماد إذن الاستلام وتحديث المخزون؟')) return;
    setLoading(true);
    try {
      await grnService.approveGRN(grnId);
      await loadData();
      if (showViewModal) closeViewModal();
    } catch (err) {
      alert('Failed to approve GRN: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatStatus = (status) => {
    return t('common.statuses.' + status) || status;
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved': return { background: '#e8f5e9', color: '#2e7d32' };
      case 'inspected': return { background: '#e3f2fd', color: '#1565c0' };
      case 'rejected': return { background: '#ffebee', color: '#c62828' };
      default: return { background: '#fff3e0', color: '#ef6c00' };
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{t('grn.title')}</h1>
        <button className="btn btn-primary" onClick={loadData} disabled={loading}>
          {loading ? t('common.loading') : t('common.refresh')}
        </button>
      </div>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>{t('grn.pendingPOs')}</h2>
      <div className="table-container" style={{ marginBottom: '32px' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t('po.number')}</th>
              <th>{t('common.supplier')}</th>
              <th>العناصر المطلوبة</th>
              <th>الإجمالي</th>
              <th>تاريخ التسليم</th>
              <th>{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>
                  {t('grn.noPending')}
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td>{po.po_number || po.poNumber}</td>
                  <td>{po.supplier_name || po.supplier?.name}</td>
                  <td>
                    {(po.items || []).map((item, idx) => (
                      <div key={idx} style={{ fontSize: '13px', marginBottom: '2px' }}>
                        {item.raw_material_name || item.name || item.material || '—'} — {item.quantity || item.quantity_ordered || 0} {translateUnit(item.unit)}
                      </div>
                    ))}
                    {(po.items || []).length === 0 && '—'}
                  </td>
                  <td>{formatCurrency(parseFloat(po.total_amount || po.total || 0) + parseFloat(po.vat_amount || 0))}</td>
                  <td>{formatDDMMYYYY(po.expected_delivery_date || po.delivery_date || po.expected_date)}</td>
                  <td>
                    <button className="btn btn-primary" onClick={() => openCreateModal(po)} disabled={loading}>
                      إنشاء إذن استلام
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>{t('grn.history')}</h2>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>{t('grn.number')}</th>
              <th>{t('grn.poReference')}</th>
              <th>{t('common.supplier')}</th>
              <th>إجمالي المقبول</th>
              <th>إجمالي القيمة</th>
              <th>{t('common.status')}</th>
              <th>التاريخ</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {grnList.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>
                  {t('grn.none')}
                </td>
              </tr>
            ) : (
              grnList.map((grn) => (
                <tr key={grn.id}>
                  <td><p className="font-medium">{grn.grn_number}</p></td>
                  <td>{grn.po_number}</td>
                  <td>{grn.supplier_name}</td>
                  <td style={{ color: '#2e7d32', fontWeight: 500 }}>
                    {grn.total_accepted || 0}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {grn.total_amount ? `${Number(grn.total_amount).toLocaleString('en-EG', { minimumFractionDigits: 2 })} EGP` : '-'}
                  </td>
                  <td>
                    <span style={{
                      ...getStatusStyle(grn.status),
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {formatStatus(grn.status)}
                    </span>
                  </td>
                  <td>{grn.created_at ? formatDate(grn.created_at) : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={() => openViewModal(grn)} disabled={loading}>{t('common.view')}</button>
                      {grn.status === 'pending' && canApproveGRN && (
                        <button className="btn btn-success" onClick={() => handleApproveGRN(grn.id)} disabled={loading}>
                          موافقة
                        </button>
                      )}
                      {grn.status === 'pending' && !canApproveGRN && (
                        <span style={{ fontSize: '12px', padding: '4px 10px', background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', borderRadius: '8px', fontWeight: 500 }}>
                          بانتظار موافقة المالك
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateModal && selectedPO && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh', overflow: 'auto', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>{t('grn.create')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontWeight: 'bold' }}>PO: {selectedPO.po_number}</span>
                <span style={{ color: '#666' }}>{selectedPO.supplier_name}</span>
                <button onClick={closeCreateModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>&times;</button>
              </div>
            </div>

            <table className="table" style={{ marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th>{t('common.material')}</th>
                  <th>{t('grn.orderedQty')}</th>
                  <th>{t('grn.acceptedQty')}</th>
                  <th>{t('grn.rejectedQty')}</th>
                  <th>{t('grn.rejectionReason')}</th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.materialName}</td>
                    <td>{item.orderedQty} {translateUnit(item.unit)}</td>
                    <td>
                      <input
                        type="number"
                        className="form-input"
                        value={item.acceptedQty}
                        min="0"
                        max={item.orderedQty}
                        onChange={(e) => updateReceiptItem(index, 'acceptedQty', e.target.value)}
                        style={{ width: '100px' }}
                      />
                    </td>
                    <td style={{ color: item.rejectedQty > 0 ? '#d32f2f' : '#9ca3af', fontWeight: item.rejectedQty > 0 ? 600 : 400 }}>
                      {item.rejectedQty}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        value={item.rejectionReason}
                        onChange={(e) => updateReceiptItem(index, 'rejectionReason', e.target.value)}
                        placeholder={item.rejectedQty > 0 ? 'سبب الرفض مطلوب' : ''}
                        disabled={item.rejectedQty === 0}
                        style={{ border: grnErrors[`reason_${index}`] ? '1px solid #ef4444' : undefined }}
                      />
                      {grnErrors[`reason_${index}`] && <small style={{ color: '#ef4444', fontSize: '11px', display: 'block', marginTop: '2px' }}>{grnErrors[`reason_${index}`]}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              background: '#f5f5f5', padding: '16px', borderRadius: '4px',
              marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalAccepted')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>{calculateTotals().totalAccepted}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalRejected')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>{calculateTotals().totalRejected}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {t('grn.inspectionNotes')}
                {receiptItems.some(item => Number(item.rejectedQty) > 0) && <span style={{ color: '#ef4444' }}> *</span>}
              </label>
              <textarea
                className="form-input"
                rows="3"
                value={inspectionNotes}
                onChange={(e) => { setInspectionNotes(e.target.value); if (grnErrors.notes) setGrnErrors(prev => ({ ...prev, notes: undefined })); }}
                placeholder={receiptItems.some(item => Number(item.rejectedQty) > 0) ? 'سبب الرفض مطلوب عند وجود كميات مرفوضة...' : 'ملاحظات الفحص...'}
                style={{ border: grnErrors.notes ? '1px solid #ef4444' : undefined }}
              />
              {grnErrors.notes && <small style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{grnErrors.notes}</small>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn" onClick={closeCreateModal} disabled={loading}>{t('common.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={createGRN} disabled={loading}>
                {loading ? t('common.loading') : t('grn.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedGRN && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '8px', width: '800px',
            maxWidth: '95vw',
            maxHeight: '90vh', overflow: 'auto', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2>{selectedGRN.grn_number}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  ...getStatusStyle(selectedGRN.status),
                  padding: '6px 16px', borderRadius: '16px', fontSize: '14px', fontWeight: '500'
                }}>
                  {formatStatus(selectedGRN.status)}
                </span>
                <button onClick={closeViewModal} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', lineHeight: 1 }}>&times;</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div>
                <h4 style={{ marginBottom: '8px', color: '#666' }}>{t('grn.poReference')}</h4>
                <p style={{ fontSize: '18px', fontWeight: '500' }}>{selectedGRN.po_number || '-'}</p>
              </div>
              <div>
                <h4 style={{ marginBottom: '8px', color: '#666' }}>{t('common.supplier')}</h4>
                <p style={{ fontSize: '18px', fontWeight: '500' }}>{selectedGRN.supplier_name || '-'}</p>
              </div>
            </div>

            <h4 style={{ marginBottom: '12px' }}>{t('grn.receivedItems')}</h4>
            <table className="table" style={{ marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th>{t('common.material')}</th>
                  <th>{t('grn.ordered')}</th>
                  <th>{t('grn.accepted')}</th>
                  <th>{t('grn.rejected')}</th>
                  <th>{t('grn.rejectionReason')}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedGRN.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.raw_material_name || item.material_name || item.raw_material_code || 'مادة خام'}</td>
                    <td>{item.quantity_ordered || 0} {translateUnit(item.unit || item.quantity_unit)}</td>
                    <td style={{ color: '#2e7d32', fontWeight: '500' }}>{item.quantity_accepted || item.accepted_quantity || 0} {translateUnit(item.unit || item.quantity_unit)}</td>
                    <td style={{ color: item.quantity_rejected > 0 ? '#d32f2f' : 'inherit' }}>{item.quantity_rejected || item.rejected_quantity || 0} {translateUnit(item.unit || item.quantity_unit)}</td>
                    <td>{item.rejection_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              background: '#e8f5e9', padding: '12px 16px', borderRadius: '4px',
              marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#1b5e20' }}>إجمالي القيمة:</span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#1b5e20' }}>
                {formatCurrency(
                  parseFloat(selectedGRN.total_amount || selectedGRN.total_cost || selectedGRN.total || 0) ||
                  (selectedGRN.items || []).reduce((s, i) => s + (Number(i.quantity_accepted || i.accepted_quantity || 0) * Number(i.unit_cost || i.unit_price || 0)), 0)
                )}
              </span>
            </div>

            <div style={{
              background: '#f5f5f5', padding: '16px', borderRadius: '4px',
              marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>إجمالي المقبول</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                  {(selectedGRN.items || []).reduce((s, i) => s + Number(i.quantity_accepted || i.accepted_quantity || 0), 0).toFixed(3)} طن
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>إجمالي المرفوض</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>
                  {(selectedGRN.items || []).reduce((s, i) => s + Number(i.quantity_rejected || i.rejected_quantity || 0), 0).toFixed(3)} طن
                </div>
              </div>
            </div>

            {selectedGRN.notes && (
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ marginBottom: '8px' }}>{t('grn.inspectionNotes')}</h4>
                <p style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                  {selectedGRN.notes}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn" onClick={closeViewModal} disabled={loading}>{t('common.close')}</button>
              {selectedGRN.status === 'pending' && canApproveGRN && (
                <button type="button" className="btn btn-success" onClick={() => handleApproveGRN(selectedGRN.id)} disabled={loading}>
                  {loading ? 'جاري الاعتماد...' : 'اعتماد إذن الاستلام'}
                </button>
              )}
              {selectedGRN.status === 'pending' && !canApproveGRN && (
                <span style={{ fontSize: '13px', padding: '8px 14px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047', borderRadius: '8px', fontWeight: 500 }}>
                  ليس لديك صلاحية اعتماد هذا الإذن
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRN;