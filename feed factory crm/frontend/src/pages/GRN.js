import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { grnService } from '../services/api';

const GRN = () => {
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
    setReceiptItems((po.items || []).map(item => ({
      ...item,
      raw_material_id: item.raw_material_id,
      materialName: item.name || item.raw_material_name || 'Unknown',
      orderedQty: item.quantity || item.quantity_ordered || 0,
      receivedQty: item.pending_quantity || item.quantity || 0,
      acceptedQty: item.pending_quantity || item.quantity || 0,
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
    if (field === 'receivedQty' || field === 'acceptedQty') {
      const received = Number(updated[index].receivedQty) || 0;
      const accepted = Number(updated[index].acceptedQty) || 0;
      updated[index].rejectedQty = Math.max(0, received - accepted);
    }
    setReceiptItems(updated);
  };

  const calculateTotals = () => {
    const totalReceived = receiptItems.reduce((sum, item) => sum + Number(item.receivedQty || 0), 0);
    const totalAccepted = receiptItems.reduce((sum, item) => sum + Number(item.acceptedQty || 0), 0);
    const totalRejected = receiptItems.reduce((sum, item) => sum + Number(item.rejectedQty || 0), 0);
    return { totalReceived, totalAccepted, totalRejected };
  };

  const createGRN = async () => {
    if (!selectedPO) return;
    setLoading(true);
    try {
      const items = receiptItems.map(item => ({
        raw_material_id: item.raw_material_id,
        quantity_ordered: item.orderedQty,
        quantity_received: Number(item.receivedQty) || 0,
        quantity_accepted: Number(item.acceptedQty) || 0,
        quantity_rejected: Number(item.rejectedQty) || 0,
        rejection_reason: item.rejectionReason || null,
        unit_cost: item.unit_cost,
        total_cost: (Number(item.acceptedQty) || 0) * (item.unit_cost || 0)
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
      alert('Failed to create GRN: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveGRN = async (grnId) => {
    if (!window.confirm('Approve this GRN and update inventory?')) return;
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
              <th>{t('common.items')}</th>
              <th>{t('po.expectedDelivery')}</th>
              <th>{t('common.action')}</th>
            </tr>
          </thead>
          <tbody>
            {purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>
                  {t('grn.noPending')}
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td>{po.po_number || po.poNumber}</td>
                  <td>{po.supplier_name || po.supplier?.name}</td>
                  <td>{(po.items || []).length} items</td>
                  <td>{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString() : '-'}</td>
                  <td>
                    <button className="btn btn-primary" onClick={() => openCreateModal(po)} disabled={loading}>
                      Create GRN
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
              <th>{t('grn.totalAccepted')}</th>
              <th>{t('grn.totalRejected')}</th>
              <th>{t('common.status')}</th>
              <th>{t('grn.created')}</th>
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
                  <td>{grn.grn_number}</td>
                  <td>{grn.po_number}</td>
                  <td>{grn.supplier_name}</td>
                  <td>{grn.total_accepted || 0}</td>
                  <td style={{ color: (grn.total_rejected || 0) > 0 ? '#d32f2f' : 'inherit' }}>
                    {grn.total_rejected || 0}
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
                  <td>{grn.created_at ? new Date(grn.created_at).toLocaleDateString() : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={() => openViewModal(grn)} disabled={loading}>{t('common.view')}</button>
                      {grn.status === 'pending' && (
                        <button className="btn btn-success" onClick={() => handleApproveGRN(grn.id)} disabled={loading}>
                          موافقة
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
                  <th>{t('grn.receivedQty')}</th>
                  <th>{t('grn.acceptedQty')}</th>
                  <th>{t('grn.rejectedQty')}</th>
                  <th>{t('grn.rejectionReason')}</th>
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, index) => (
                  <tr key={index}>
                    <td>{item.materialName}</td>
                    <td>{item.orderedQty} {item.unit}</td>
                    <td>
                      <input type="number" className="form-input" value={item.receivedQty}
                        onChange={(e) => updateReceiptItem(index, 'receivedQty', e.target.value)}
                        style={{ width: '100px' }} />
                    </td>
                    <td>
                      <input type="number" className="form-input" value={item.acceptedQty}
                        onChange={(e) => updateReceiptItem(index, 'acceptedQty', e.target.value)}
                        style={{ width: '100px' }} />
                    </td>
                    <td style={{ color: item.rejectedQty > 0 ? '#d32f2f' : 'inherit' }}>
                      {item.rejectedQty}
                    </td>
                    <td>
                      <input type="text" className="form-input" value={item.rejectionReason}
                        onChange={(e) => updateReceiptItem(index, 'rejectionReason', e.target.value)}
                        placeholder={item.rejectedQty > 0 ? 'Reason required' : ''}
                        disabled={item.rejectedQty === 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              background: '#f5f5f5', padding: '16px', borderRadius: '4px',
              marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalReceived')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{calculateTotals().totalReceived}</div>
              </div>
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
              <label className="form-label">{t('grn.inspectionNotes')}</label>
              <textarea className="form-input" rows="3" value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Enter any inspection observations or notes..." />
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
                  <th>{t('grn.received')}</th>
                  <th>{t('grn.accepted')}</th>
                  <th>{t('grn.rejected')}</th>
                  <th>{t('grn.rejectionReason')}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedGRN.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.raw_material_name || item.raw_material_code || 'Unknown'}</td>
                    <td>{item.quantity_ordered} {item.unit || 'kg'}</td>
                    <td>{item.quantity_received}</td>
                    <td style={{ color: '#2e7d32', fontWeight: '500' }}>{item.quantity_accepted}</td>
                    <td style={{ color: item.quantity_rejected > 0 ? '#d32f2f' : 'inherit' }}>{item.quantity_rejected}</td>
                    <td>{item.rejection_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{
              background: '#f5f5f5', padding: '16px', borderRadius: '4px',
              marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px'
            }}>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalReceived')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {(selectedGRN.items || []).reduce((s, i) => s + Number(i.quantity_received || 0), 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalAccepted')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                  {(selectedGRN.items || []).reduce((s, i) => s + Number(i.quantity_accepted || 0), 0)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>{t('grn.totalRejected')}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>
                  {(selectedGRN.items || []).reduce((s, i) => s + Number(i.quantity_rejected || 0), 0)}
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
              {selectedGRN.status === 'pending' && (
                <button type="button" className="btn btn-success" onClick={() => handleApproveGRN(selectedGRN.id)} disabled={loading}>
                  {loading ? 'Approving...' : 'Approve GRN'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRN;
