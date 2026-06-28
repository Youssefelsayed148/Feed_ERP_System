import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../utils/i18n';
import { formatDate } from '../utils/formatters';
import {
  CheckCircle, XCircle, Clock, AlertCircle, RefreshCw,
  ShoppingCart, DollarSign, Package, FileText, Wrench,
  Users, ClipboardCheck, Inbox, ChevronRight, Filter,
  History, ListChecks, Eye
} from 'lucide-react';
import { authService } from '../services/api';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');
const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const MODULE_META = {
  sales_orders:    { icon: ShoppingCart, color: '#3b82f6', label: 'أوامر البيع',      link: '/sales' },
  clients:         { icon: Users,        color: '#8b5cf6', label: 'العملاء',           link: '/clients' },
  purchase_orders: { icon: Package,      color: '#f97316', label: 'أوامر الشراء',     link: '/purchase-orders' },
  grn:             { icon: Package,      color: '#10b981', label: 'إذن الاستلام',     link: '/grn' },
  expenses:        { icon: DollarSign,   color: '#ef4444', label: 'المصروفات',        link: '/finance/expenses' },
  payroll:         { icon: DollarSign,   color: '#22c55e', label: 'الرواتب',          link: '/hr/payroll' },
  production:      { icon: ClipboardCheck, color: '#6366f1', label: 'الإنتاج',        link: '/production' },
  legal:           { icon: FileText,     color: '#6b7280', label: 'القانونية',        link: '/legal' },
  assets:          { icon: Wrench,       color: '#eab308', label: 'الأصول',          link: '/assets' },
  maintenance:     { icon: Wrench,       color: '#eab308', label: 'الصيانة',         link: '/maintenance-reminders' },
};
const DEFAULT_META = { icon: Inbox, color: '#6b7280', label: '', link: '/dashboard' };

const STAGE_LABELS = {
  manager_review: 'مراجعة المدير',
  owner_review:   'مراجعة المالك',
};

const typeLabels = {
  'grn':            { label: 'إذن استلام',   color: '#8b5cf6' },
  'purchase_order': { label: 'أمر شراء',     color: '#f59e0b' },
  'sales_order':    { label: 'طلب مبيعات',   color: '#10b981' },
  'expense':        { label: 'مصروف',        color: '#ef4444' },
  'production':     { label: 'إنتاج',        color: '#3b82f6' },
  'payroll':        { label: 'رواتب',        color: '#22c55e' },
  'contract':       { label: 'عقد',          color: '#6b7280' },
  'client':         { label: 'عميل',         color: '#8b5cf6' },
};

const STATUS_STYLE = {
  approved: { bg: '#f0fdf4', color: '#16a34a', label: 'موافق عليه' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'مرفوض' },
  pending:  { bg: '#fffbeb', color: '#d97706', label: 'معلق' },
};

function parseNotes(notes) {
  if (!notes) return { ref: null, party: null, total: null };
  const refMatch = notes.match(/([A-Z]{2,}-\d+)/);
  const totalMatch = notes.match(/Total:\s*([\d,]+\.?\d*)/i);
  const partyMatch = notes.match(/(?:Supplier|Client|المورد|العميل)[:\s]+([^|\-\n]+)/i);
  return {
    ref: refMatch ? refMatch[1] : null,
    party: partyMatch ? partyMatch[1].trim() : null,
    total: totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : null,
  };
}

function fmtEGP(amount) {
  return `EGP ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function Approvals() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';
  const isManager = ['sales_manager','finance_manager','purchasing_mgr','production_mgr','legal_mgr','maintenance_mgr'].includes(user?.role);
  // Staff roles (sales_rep, driver, etc.) cannot see the pending queue — only their own submissions
  const canSeePending = isOwnerOrAdmin || isManager;

  const [activeTab, setActiveTab] = useState(canSeePending ? 'pending' : 'my-requests');
  const [requests, setRequests] = useState([]);
  const [auditRecords, setAuditRecords] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [teamRequests, setTeamRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [teamRequestsLoading, setTeamRequestsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [filterModule, setFilterModule] = useState('all');
  const [auditFilter, setAuditFilter] = useState('all');
  const [declineNoteFor, setDeclineNoteFor] = useState(null);
  const [declineNote, setDeclineNote] = useState('');

  const fetchPending = useCallback(async () => {
    if (!canSeePending) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/approvals/pending`, { headers: headers() });
      if (!res.ok) {
        setError(res.status === 403 ? 'ليس لديك صلاحية عرض الموافقات' : 'فشل تحميل الموافقات');
        setRequests([]);
        return;
      }
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (e) {
      setError('فشل تحميل الموافقات');
    } finally {
      setLoading(false);
    }
  }, [canSeePending]);

  const fetchMyRequests = useCallback(async () => {
    setMyRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/approvals/my-requests`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMyRequests(data.requests || []);
      }
    } catch (e) { console.error('my-requests error:', e); }
    finally { setMyRequestsLoading(false); }
  }, []);

  const fetchTeamRequests = useCallback(async () => {
    if (!isManager) return;
    setTeamRequestsLoading(true);
    try {
      const res = await fetch(`${API_URL}/approvals/team-requests`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setTeamRequests(data.requests || []);
      }
    } catch (e) { console.error('team-requests error:', e); }
    finally { setTeamRequestsLoading(false); }
  }, [isManager]);

  const fetchAudit = useCallback(async () => {
    if (!isOwnerOrAdmin) return;
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({ limit: 200 });
      if (auditFilter !== 'all') params.append('status', auditFilter);
      const res = await fetch(`${API_URL}/approvals/audit?${params}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setAuditRecords(data.records || []);
      }
    } catch (e) {
      console.error('Audit fetch error:', e);
    } finally {
      setAuditLoading(false);
    }
  }, [isOwnerOrAdmin, auditFilter]);

  useEffect(() => { fetchPending(); const i = setInterval(fetchPending, 30000); return () => clearInterval(i); }, [fetchPending]);
  useEffect(() => { if (activeTab === 'audit') fetchAudit(); }, [activeTab, fetchAudit]);
  useEffect(() => { if (activeTab === 'my-requests') fetchMyRequests(); }, [activeTab, fetchMyRequests]);
  useEffect(() => { if (activeTab === 'team-requests') fetchTeamRequests(); }, [activeTab, fetchTeamRequests]);

  const handleAction = async (id, action, notes) => {
    setActioningId(id);
    try {
      const res = await fetch(`${API_URL}/approvals/${id}/${action}`, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ notes: notes || '' })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'فشلت العملية'); return; }
      // If manager approved → item moves to owner stage, remove from manager's queue
      // If owner approved/rejected → remove from queue
      setRequests(prev => prev.filter(r => r.id !== id));
      setDeclineNoteFor(null);
      setDeclineNote('');
      await fetchPending();
    } catch (e) {
      alert('فشلت العملية');
    } finally {
      setActioningId(null);
    }
  };

  const moduleOptions = ['all', ...Array.from(new Set(requests.map(r => r.module_name)))];
  const filteredRequests = filterModule === 'all' ? requests : requests.filter(r => r.module_name === filterModule);

  // Stage label shown on each card
  const stageLabel = isOwnerOrAdmin
    ? 'مرحلة المالك / المدير العام'
    : 'مرحلة مراجعة المدير';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">الموافقات</h1>
          <p className="page-subtitle">مراجعة واعتماد الطلبات المعلقة من جميع الأقسام</p>
        </div>
        <button className="btn btn-secondary" onClick={activeTab === 'pending' ? fetchPending : fetchAudit} disabled={loading || auditLoading}>
          <RefreshCw size={16} className={loading || auditLoading ? 'spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff7ed', color: '#f97316' }}><Clock size={24} /></div>
          <div className="stat-value">{requests.length}</div>
          <div className="stat-label">إجمالي المعلقة</div>
        </div>
        {moduleOptions.filter(m => m !== 'all').slice(0, 3).map(m => {
          const meta = MODULE_META[m] || DEFAULT_META;
          const Icon = meta.icon;
          const count = requests.filter(r => r.module_name === m).length;
          return (
            <div className="stat-card" key={m}>
              <div className="stat-icon" style={{ background: meta.color + '20', color: meta.color }}><Icon size={24} /></div>
              <div className="stat-value">{count}</div>
              <div className="stat-label">{meta.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs — pending only visible to managers/owner/admin; audit only to owner/admin */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
        {[
          ...(canSeePending ? [{ key: 'pending', label: 'الطلبات المعلقة', icon: ListChecks }] : []),
          { key: 'my-requests', label: 'طلباتي', icon: Clock },
      ...(isManager ? [{ key: 'team-requests', label: 'طلبات القسم', icon: Users }] : []),
      ...(isOwnerOrAdmin ? [{ key: 'audit', label: 'سجل الموافقات', icon: History }] : [])
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#2563eb' : '#6b7280',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px'
            }}>
              <Icon size={16} />
              {tab.label}
              {tab.key === 'pending' && requests.length > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>
                  {requests.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== PENDING TAB ===== */}
      {activeTab === 'pending' && (
        <>
          {/* Stage indicator */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ChevronRight size={16} />
            <span>أنت في: <strong>{stageLabel}</strong></span>
            {isOwnerOrAdmin && <span style={{ color: '#6b7280', marginRight: 'auto' }}>الطلبات الظاهرة هنا وافق عليها المديرون وتحتاج موافقتك النهائية</span>}
          </div>

          {/* Module Filter */}
          {moduleOptions.length > 1 && (
            <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <Filter size={14} color="#6b7280" />
                <span style={{ fontSize: '13px', color: '#6b7280' }}>تصفية:</span>
                {moduleOptions.map(m => {
                  const meta = m === 'all' ? null : (MODULE_META[m] || DEFAULT_META);
                  return (
                    <button key={m} onClick={() => setFilterModule(m)}
                      className={`btn btn-sm ${filterModule === m ? 'btn-primary' : 'btn-secondary'}`}>
                      {m === 'all' ? 'الكل' : meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
              <AlertCircle size={32} style={{ marginBottom: '8px' }} />
              <p>{error}</p>
            </div>
          )}

          {!error && loading && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
          )}

          {!error && !loading && filteredRequests.length === 0 && (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <CheckCircle size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p style={{ fontSize: '16px', fontWeight: 600 }}>لا توجد طلبات معلقة — كل شيء محدث</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredRequests.map(req => {
              const meta = MODULE_META[req.module_name] || DEFAULT_META;
              const Icon = meta.icon;
              const isActioning = actioningId === req.id;
              const isDecliningThis = declineNoteFor === req.id;

              return (
                <div className="card" key={req.id} style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1, minWidth: '260px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: meta.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={meta.color} />
                      </div>
                      <div>
                        {/* Badges row */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                          <span style={{ background: meta.color + '20', color: meta.color, padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                            {meta.label}
                          </span>
                          {typeLabels[req.request_type] && (
                            <span style={{ background: typeLabels[req.request_type].color + '18', color: typeLabels[req.request_type].color, padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
                              {typeLabels[req.request_type].label}
                            </span>
                          )}
                          <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '8px', fontSize: '11px' }}>
                            {STAGE_LABELS[req.stage] || req.stage}
                          </span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{timeAgo(req.created_at)}</span>
                        </div>

                        {/* Structured fields parsed from notes + direct fields */}
                        {(() => {
                          console.log('[Approvals] pending req:', req);
                          const parsed = parseNotes(req.notes);
                          const ref = parsed.ref || `${req.request_type.toUpperCase()}-${req.request_id}`;
                          const party = parsed.party
                            || req.supplier_name || req.client_name
                            || req.metadata?.supplierName || req.metadata?.clientName;
                          const total = parsed.total ?? req.total_amount ?? req.amount;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                <span style={{ fontWeight: 600 }}>رقم المرجع:</span>{' '}
                                <span style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                                  {ref}
                                </span>
                              </p>
                              {party && (
                                <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                                  <span style={{ fontWeight: 600 }}>المورد / العميل:</span> {party}
                                </p>
                              )}
                              {total != null && (
                                <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                                  <span style={{ fontWeight: 600 }}>الإجمالي:</span>{' '}
                                  <span style={{ color: '#0f766e', fontWeight: 600 }}>{fmtEGP(total)}</span>
                                </p>
                              )}
                              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                                <span style={{ fontWeight: 600 }}>بواسطة:</span> {req.requester_name || req.requester_email || 'غير معروف'}
                              </p>
                            </div>
                          );
                        })()}

                        {/* Manager approval info */}
                        {req.stage === 'owner_review' && req.manager_name && (
                          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12} />
                            وافق عليه المدير: {req.manager_name}
                            {req.manager_approved_at ? ` — ${timeAgo(req.manager_approved_at)}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => navigate(meta.link)}>
                        عرض التفاصيل
                      </button>
                      {req.read_only ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                          background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a'
                        }}>
                          <Clock size={13} />
                          بانتظار موافقة المالك
                        </span>
                      ) : (
                        !isDecliningThis && (
                          <>
                            <button className="btn btn-sm btn-success" disabled={isActioning} onClick={() => handleAction(req.id, 'approve')}>
                              <CheckCircle size={14} />
                              {isOwnerOrAdmin ? 'اعتماد نهائي' : 'موافقة وإحالة'}
                            </button>
                            <button className="btn btn-sm btn-danger" disabled={isActioning} onClick={() => setDeclineNoteFor(req.id)}>
                              <XCircle size={14} />
                              رفض
                            </button>
                          </>
                        )
                      )}
                    </div>
                  </div>

                  {isDecliningThis && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                      <textarea
                        className="form-input"
                        placeholder="سبب الرفض (اختياري)"
                        value={declineNote}
                        onChange={e => setDeclineNote(e.target.value)}
                        rows={2}
                        style={{ marginBottom: '8px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-sm btn-danger" disabled={isActioning}
                          onClick={() => handleAction(req.id, 'reject', declineNote)}>
                          تأكيد الرفض
                        </button>
                        <button className="btn btn-sm btn-secondary"
                          onClick={() => { setDeclineNoteFor(null); setDeclineNote(''); }}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== MY REQUESTS TAB (all users) ===== */}
      {activeTab === 'my-requests' && (
        <>
          {myRequestsLoading && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
          )}
          {!myRequestsLoading && myRequests.length === 0 && (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <Eye size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>لم تقدم أي طلبات بعد</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {myRequests.map(rec => {
              const meta = MODULE_META[rec.module_name] || DEFAULT_META;
              const Icon = meta.icon;
              const statusStyle = STATUS_STYLE[rec.status] || STATUS_STYLE.pending;
              return (
                <div className="card" key={rec.id} style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: meta.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ background: meta.color + '20', color: meta.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{meta.label}</span>
                        <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>
                          {STAGE_LABELS[rec.stage] || rec.stage}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>{timeAgo(rec.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>
                        {rec.notes || `${rec.request_type} #${rec.request_id}`}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                        {rec.manager_name && rec.status !== 'pending' && (
                          <span>✅ وافق عليه المدير: <strong>{rec.manager_name}</strong></span>
                        )}
                        {rec.approver_name && rec.status === 'approved' && (
                          <span>✅ اعتمد نهائياً: <strong>{rec.approver_name}</strong></span>
                        )}
                        {rec.approver_name && rec.status === 'rejected' && (
                          <span>❌ رُفض بواسطة: <strong>{rec.approver_name}</strong></span>
                        )}
                        {rec.status === 'pending' && rec.stage === 'manager_review' && (
                          <span style={{ color: '#d97706' }}>⏳ بانتظار موافقة المدير</span>
                        )}
                        {rec.status === 'pending' && rec.stage === 'owner_review' && (
                          <span style={{ color: '#d97706' }}>⏳ بانتظار موافقة المالك</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== TEAM REQUESTS TAB (managers only) ===== */}
      {activeTab === 'team-requests' && isManager && (
        <>
          {teamRequestsLoading && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
          )}
          {!teamRequestsLoading && teamRequests.length === 0 && (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <Users size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>لا توجد طلبات في قسمك بعد</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teamRequests.map(rec => {
              const meta = MODULE_META[rec.module_name] || DEFAULT_META;
              const Icon = meta.icon;
              const statusStyle = STATUS_STYLE[rec.status] || STATUS_STYLE.pending;
              return (
                <div className="card" key={rec.id} style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: meta.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ background: meta.color + '20', color: meta.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{meta.label}</span>
                        <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>{timeAgo(rec.created_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>
                        {rec.notes || `${rec.request_type} #${rec.request_id}`}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                        <span>📝 طلب بواسطة: <strong>{rec.requester_name || '—'}</strong> ({rec.requester_role || '—'})</span>
                        {rec.manager_name && rec.stage !== 'manager_review' && (
                          <span>✅ مدير: <strong>{rec.manager_name}</strong></span>
                        )}
                        {rec.approver_name && rec.status !== 'pending' && (
                          <span>{rec.status === 'approved' ? '✅' : '❌'} مالك: <strong>{rec.approver_name}</strong></span>
                        )}
                        {rec.status === 'pending' && rec.stage === 'manager_review' && (
                          <span style={{ color: '#d97706' }}>⏳ بانتظار موافقتك</span>
                        )}
                        {rec.status === 'pending' && rec.stage === 'owner_review' && (
                          <span style={{ color: '#2563eb' }}>⏳ وافقت عليه — بانتظار المالك</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== AUDIT LOG TAB (owner/admin only) ===== */}
      {activeTab === 'audit' && isOwnerOrAdmin && (
        <>
          {/* Filter bar */}
          <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={14} color="#6b7280" />
              <span style={{ fontSize: '13px', color: '#6b7280' }}>تصفية حسب الحالة:</span>
              {['all', 'approved', 'rejected'].map(s => (
                <button key={s} onClick={() => { setAuditFilter(s); }}
                  className={`btn btn-sm ${auditFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                  {s === 'all' ? 'الكل' : STATUS_STYLE[s]?.label || s}
                </button>
              ))}
            </div>
          </div>

          {auditLoading && (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
          )}

          {!auditLoading && auditRecords.length === 0 && (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9ca3af' }}>
              <History size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>لا توجد سجلات موافقات بعد</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {auditRecords.map(rec => {
              const meta = MODULE_META[rec.module_name] || DEFAULT_META;
              const Icon = meta.icon;
              const statusStyle = STATUS_STYLE[rec.status] || STATUS_STYLE.pending;
              return (
                <div className="card" key={rec.id} style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: meta.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={meta.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ background: meta.color + '20', color: meta.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{meta.label}</span>
                        <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>{statusStyle.label}</span>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>
                          {STAGE_LABELS[rec.stage] || rec.stage}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: 'auto' }}>
                          {rec.updated_at ? formatDate(rec.updated_at) : '—'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: '14px', color: '#1e293b' }}>
                        {rec.notes || `${rec.request_type} #${rec.request_id}`}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
                        <span>📝 طلب بواسطة: <strong>{rec.requester_name || '—'}</strong> ({rec.requester_role || '—'})</span>
                        {rec.manager_name && (
                          <span>✅ مدير: <strong>{rec.manager_name}</strong> ({rec.manager_role || '—'})</span>
                        )}
                        {rec.approver_name && (
                          <span>{rec.status === 'approved' ? '✅' : '❌'} مالك/مدير عام: <strong>{rec.approver_name}</strong></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}