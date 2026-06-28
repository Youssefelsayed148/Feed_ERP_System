import { t } from '../utils/i18n';
import { formatCurrency, formatDate } from '../utils/formatters';
import React, { useState, useEffect } from 'react';
import {
  Scale, Plus, Search, FolderOpen, FileText, Upload,
  Check, X, Clock, AlertTriangle, Eye, Download, Trash2,
  User, Building, ChevronRight, CheckCircle, XCircle,
  Folder, Files, Archive, Tag, Calendar, Lock, Circle, Users
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const uploadHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`
});

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export default function Legal() {
  const [activeTab, setActiveTab] = useState('documents');
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [onboardingClients, setOnboardingClients] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadClientId, setUploadClientId] = useState('');
  const [uploadDocType, setUploadDocType] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadExpiry, setUploadExpiry] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState('required'); // 'required' | 'additional'
  const [uploadLinkUrl, setUploadLinkUrl] = useState('');
  const [uploadIsLink, setUploadIsLink] = useState(false);

  // Folder modal state (Bug 3)
  const [selectedClientFolder, setSelectedClientFolder] = useState(null);
  const [folderClientDocs, setFolderClientDocs] = useState([]);
  const [folderSearch, setFolderSearch] = useState('');
  const [companyLinks, setCompanyLinks] = useState({ website: '', facebook: '', whatsapp: '' });

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewClient, setReviewClient] = useState(null);
  const [reviewClientDocs, setReviewClientDocs] = useState([]);

  // Folder document selection state
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  // Inline upload state for folder modal
  const [folderUploadingType, setFolderUploadingType] = useState(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUser = getCurrentUser();
  const isOwner = currentUser.role === 'owner';

  useEffect(() => {
    fetchData();
  }, [activeTab, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Always fetch required docs and clients list (needed for upload modal)
      const [reqRes, clientsRes] = await Promise.all([
        fetch(`${API_URL}/legal/required-docs`, { headers: headers() }),
        fetch(`${API_URL}/clients`, { headers: headers() })
      ]);

      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequiredDocs(reqData.docs || reqData || []);
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClientsList(clientsData.clients || []);
      }

      if (activeTab === 'documents') {
        let url = `${API_URL}/legal/documents`;
        if (statusFilter) url += `?status=${statusFilter}`;
        const docRes = await fetch(url, { headers: headers() });
        const docData = docRes.ok ? await docRes.json() : { documents: [] };
        let docs = Array.isArray(docData) ? docData : (docData.documents || []);
        // Bug 2: deduplicate by id
        docs = Object.values(docs.reduce((acc, doc) => { acc[doc.id] = doc; return acc; }, {}));
        setDocuments(docs);
      } else if (activeTab === 'folders') {
        const clientsRes2 = await fetch(`${API_URL}/legal/clients`, { headers: headers() });
        const clientsData = clientsRes2.ok ? await clientsRes2.json() : { clients: [] };
        const clients = clientsData.clients || [];
        // Build folder data from all clients including those with no docs
        const requiredCount = requiredDocs.filter(d => d.required).length || 4;
        const folderList = clients.map(c => {
          const docs = c.documents || [];
          const totalDocs = docs.filter(d => d.status !== 'rejected').length;
          const verifiedDocs = docs.filter(d => d.status === 'verified').length;
          const pendingDocs = docs.filter(d => d.status === 'pending').length;
          const verifiedRequired = parseInt(c.verified_required_count) || docs.filter(d => d.is_required && d.status === 'verified').length;
          const progressPercent = requiredCount > 0 ? Math.round((verifiedRequired / requiredCount) * 100) : 0;
          return {
            clientId: c.id,
            clientCode: c.code,
            clientName: c.name_arabic || c.name_english || `عميل #${c.id}`,
            address: c.address,
            contactPerson: c.contact_person,
            totalDocs,
            verifiedDocs,
            pendingDocs,
            verifiedRequired,
            progressPercent,
            documents: docs
          };
        }).sort((a, b) => {
          // Sort: pending first, then verified, then empty
          if (a.pendingDocs > 0 && b.pendingDocs === 0) return -1;
          if (b.pendingDocs > 0 && a.pendingDocs === 0) return 1;
          if (a.verifiedDocs > 0 && b.verifiedDocs === 0) return -1;
          if (b.verifiedDocs > 0 && a.verifiedDocs === 0) return 1;
          return (a.clientName || '').localeCompare(b.clientName || '');
        });
        setFolders(folderList);
      } else if (activeTab === 'onboarding') {
        const progressRes = await fetch(`${API_URL}/legal/clients-progress`, { headers: headers() });
        const progressData = progressRes.ok ? await progressRes.json() : { clients: [] };
        setOnboardingClients(progressData.clients || []);
      }
    } catch (error) {
      console.error('Error fetching legal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDocument = async (doc, approved) => {
    const reason = approved ? null : prompt('سبب الرفض:');
    if (!approved && !reason) return;
    try {
      const res = await fetch(`${API_URL}/legal/documents/${doc.id}/verify`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: approved ? 'verified' : 'rejected', rejection_reason: reason })
      });
      if (res.ok) {
        alert(approved ? 'تم التحقق من المستند بنجاح!' : 'تم رفض المستند');
        fetchData();
        if (showReviewModal && reviewClient) {
          fetchClientDocsForReview(reviewClient.id);
        }
      } else {
        const err = await res.json();
        alert(err.error || 'فشل تحديث المستند');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    }
  };

  const handleUpload = async () => {
    if (!uploadClientId || !uploadTitle) {
      alert('يرجى ملء العميل والعنوان');
      return;
    }
    if (uploadMode === 'required' && !uploadDocType) {
      alert('يرجى اختيار نوع المستند المطلوب');
      return;
    }
    if (uploadIsLink && !uploadLinkUrl) {
      alert('يرجى إدخال الرابط');
      return;
    }
    if (!uploadIsLink && !uploadFile) {
      alert('يرجى اختيار ملف');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('client_id', uploadClientId);
      if (uploadMode === 'required') formData.append('type', uploadDocType);
      formData.append('title', uploadTitle);
      formData.append('notes', uploadNotes);
      if (uploadExpiry) formData.append('expiry_date', uploadExpiry);
      if (uploadIsLink) {
        formData.append('link_url', uploadLinkUrl);
      } else {
        formData.append('file', uploadFile);
      }

      const res = await fetch(`${API_URL}/legal/documents/upload`, {
        method: 'POST',
        headers: uploadHeaders(),
        body: formData
      });

      if (res.ok) {
        alert('تم رفع المستند بنجاح!');
        setShowUploadModal(false);
        resetUploadForm();
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'فشل رفع المستند');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadClientId('');
    setUploadDocType('');
    setUploadTitle('');
    setUploadNotes('');
    setUploadExpiry('');
    setUploadFile(null);
    setUploadMode('required');
    setUploadLinkUrl('');
    setUploadIsLink(false);
  };

  const fetchClientDocsForReview = async (clientId) => {
    try {
      const res = await fetch(`${API_URL}/legal/documents?client_id=${clientId}`, { headers: headers() });
      const data = res.ok ? await res.json() : { documents: [] };
      let docs = Array.isArray(data) ? data : (data.documents || []);
      docs = Object.values(docs.reduce((acc, doc) => { acc[doc.id] = doc; return acc; }, {}));
      setReviewClientDocs(docs);
    } catch (err) {
      console.error('Error fetching client docs:', err);
      setReviewClientDocs([]);
    }
  };

  // Bug 3: folder modal handlers
  const openFolderModal = async (client) => {
    setSelectedClientFolder(client);
    try {
      const res = await fetch(`${API_URL}/legal/documents?client_id=${client.clientId || client.id}`, { headers: headers() });
      const data = res.ok ? await res.json() : { documents: [] };
      let docs = Array.isArray(data) ? data : (data.documents || []);
      docs = Object.values(docs.reduce((acc, doc) => { acc[doc.id] = doc; return acc; }, {}));
      setFolderClientDocs(docs);
      // Prefill company links from existing link docs
      const links = { website: '', facebook: '', whatsapp: '' };
      docs.forEach(d => {
        if (d.file_type === 'link' && ['website', 'facebook', 'whatsapp'].includes(d.type)) {
          links[d.type] = d.link_url || '';
        }
      });
      setCompanyLinks(links);
    } catch (err) {
      console.error('Error fetching folder docs:', err);
      setFolderClientDocs([]);
      setCompanyLinks({ website: '', facebook: '', whatsapp: '' });
    }
  };

  const closeFolderModal = () => {
    setSelectedClientFolder(null);
    setFolderClientDocs([]);
    setCompanyLinks({ website: '', facebook: '', whatsapp: '' });
    setSelectedDocIds([]);
  };

  const refreshFolderDocs = async () => {
    if (!selectedClientFolder) return;
    try {
      const res = await fetch(`${API_URL}/legal/documents?client_id=${selectedClientFolder.clientId || selectedClientFolder.id}`, { headers: headers() });
      const data = res.ok ? await res.json() : { documents: [] };
      let docs = Array.isArray(data) ? data : (data.documents || []);
      docs = Object.values(docs.reduce((acc, doc) => { acc[doc.id] = doc; return acc; }, {}));
      setFolderClientDocs(docs);
    } catch (err) {
      console.error('Error refreshing folder docs:', err);
    }
  };

  const handleFolderInlineUpload = async (reqDoc, file) => {
    if (!file || !selectedClientFolder) return;
    setFolderUploadingType(reqDoc.id);
    try {
      const formData = new FormData();
      formData.append('client_id', selectedClientFolder.clientId || selectedClientFolder.id);
      formData.append('type', reqDoc.id);
      formData.append('title', reqDoc.name);
      formData.append('file', file);
      const res = await fetch(`${API_URL}/legal/documents/upload`, {
        method: 'POST',
        headers: uploadHeaders(),
        body: formData
      });
      if (res.ok) {
        await refreshFolderDocs();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'فشل رفع الملف');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    } finally {
      setFolderUploadingType(null);
    }
  };

  const triggerFolderUpload = (reqDoc) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) handleFolderInlineUpload(reqDoc, file);
    };
    input.click();
  };

  const handleFolderDocAction = async (doc, approved) => {
    const reason = approved ? null : prompt('سبب الرفض:');
    if (!approved && !reason) return;
    try {
      const res = await fetch(`${API_URL}/legal/documents/${doc.id}/verify`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: approved ? 'verified' : 'rejected', rejection_reason: reason })
      });
      if (res.ok) {
        await refreshFolderDocs();
      } else {
        const err = await res.json();
        alert(err.error || 'فشل تحديث المستند');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    }
  };

  const getDocStatusForClient = (docType, clientDocs) => {
    const doc = clientDocs.find(d => d.type === docType);
    if (!doc) return { status: 'missing', doc: null };
    return { status: doc.status, doc };
  };

  const getStatusBadge = (status, isAdditional) => {
    if (isAdditional) {
      return <span className="badge badge-info">إضافي</span>;
    }
    const statusMap = {
      verified: { color: 'success', label: 'متحقق' },
      pending: { color: 'warning', label: 'بانتظار المراجعة' },
      rejected: { color: 'danger', label: 'مرفوض' },
      missing: { color: 'secondary', label: 'غير مرفق' },
      active: { color: 'success', label: 'نشط' },
      pending_review: { color: 'warning', label: 'تحت المراجعة' },
      expired: { color: 'danger', label: 'منتهي' }
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: status };
    return <span className={`badge badge-${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const getDocTypeName = (doc) => {
    if (!doc.type) return doc.title || 'مستند';
    return requiredDocs.find(d => d.id === doc.type)?.name || doc.type;
  };

  const isDocRequired = (doc) => {
    if (doc.is_required === true) return true;
    if (doc.is_required === false) return false;
    // Fallback for old docs: check if type matches required doc types
    return requiredDocs.some(r => r.required && r.id === doc.type);
  };

  const openReviewModal = async (client) => {
    setReviewClient(client);
    setShowReviewModal(true);
    await fetchClientDocsForReview(client.id);
  };

  const saveCompanyLinks = async () => {
    const clientId = selectedClientFolder.clientId || selectedClientFolder.id;
    try {
      const res = await fetch(`${API_URL}/legal/clients/${clientId}/company-links`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(companyLinks)
      });
      if (res.ok) {
        alert('تم حفظ معلومات الشركة');
        openFolderModal(selectedClientFolder);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'فشل الحفظ');
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'document') {
        const res = await fetch(`${API_URL}/legal/documents/${deleteTarget.doc.id}`, {
          method: 'DELETE',
          headers: headers()
        });
        if (res.ok) {
          alert('تم حذف المستند بنجاح');
          setDeleteTarget(null);
          setDeleteConfirmText('');
          fetchData();
          if (selectedClientFolder) {
            openFolderModal(selectedClientFolder);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'فشل حذف المستند');
        }
      } else if (deleteTarget.type === 'multiple') {
        let successCount = 0;
        let failCount = 0;
        for (const docId of deleteTarget.ids) {
          const res = await fetch(`${API_URL}/legal/documents/${docId}`, {
            method: 'DELETE',
            headers: headers()
          });
          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        }
        alert(failCount > 0 ? `تم حذف ${successCount} مستند، فشل ${failCount}` : 'تم حذف المستندات المحددة بنجاح');
        setDeleteTarget(null);
        setDeleteConfirmText('');
        setSelectedDocIds([]);
        fetchData();
        closeFolderModal();
      } else if (deleteTarget.type === 'client') {
        const clientId = deleteTarget.client.clientId || deleteTarget.client.id;
        const res = await fetch(`${API_URL}/legal/clients/${clientId}/all-documents`, {
          method: 'DELETE',
          headers: headers()
        });
        if (res.ok) {
          alert('تم حذف جميع مستندات العميل بنجاح');
          setDeleteTarget(null);
          setDeleteConfirmText('');
          fetchData();
          closeFolderModal();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'فشل حذف مستندات العميل');
        }
      }
    } catch (err) {
      alert('فشل الاتصال بالخادم');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getProgressStatus = (percent) => {
    if (percent === 100) return { label: 'مكتمل', color: 'success' };
    if (percent > 0) return { label: 'جارٍ', color: 'warning' };
    return { label: 'لم يبدأ', color: 'danger' };
  };

  const tabs = [
    { id: 'documents', label: 'القسم القانوني', icon: <FileText size={18} /> },
    { id: 'folders', label: 'مجلدات العملاء', icon: <FolderOpen size={18} /> },
    { id: 'onboarding', label: 'توثيق العملاء', icon: <Building size={18} /> }
  ];

  const getFilteredDocuments = () => {
    let filtered = [...documents];
    if (search) {
      filtered = filtered.filter(d =>
        (d.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.folder || '').toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter) {
      filtered = filtered.filter(d => d.status === statusFilter);
    }
    return filtered;
  };

  return (
    <div className="page-container legal-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-title">
          <Scale size={28} />
          <div>
            <h1>{t('legal.title')}</h1>
            <p>{t('legal.subtitleLegal')}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="content-area">

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="documents-tab">
            <div className="action-bar" style={{ gap: '12px', flexWrap: 'wrap' }}>
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select"
              >
                <option value="">{t('common.allLabel')}</option>
                <option value="pending">بانتظار المراجعة</option>
                <option value="verified">متحقق</option>
                <option value="rejected">مرفوض</option>
              </select>
              <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
                <Upload size={18} /> رفع مستند
              </button>
            </div>

            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div className="stat-card mini-stat" style={{ borderRight: '4px solid #3498db', cursor: 'pointer' }} onClick={() => setStatusFilter('')}>
                <div className="stat-icon" style={{ background: '#ebf5fb', color: '#3498db' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.length}</div>
                  <div className="stat-label">إجمالي المستندات</div>
                </div>
              </div>
              <div className="stat-card mini-stat" style={{ borderRight: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => setStatusFilter('pending')}>
                <div className="stat-icon" style={{ background: '#fff7ed', color: '#f59e0b' }}>
                  <Clock size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.filter(d => d.status === 'pending').length}</div>
                  <div className="stat-label">بانتظار المراجعة</div>
                </div>
              </div>
              <div className="stat-card mini-stat" style={{ borderRight: '4px solid #22c55e', cursor: 'pointer' }} onClick={() => setStatusFilter('verified')}>
                <div className="stat-icon" style={{ background: '#f0fdf4', color: '#22c55e' }}>
                  <CheckCircle size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.filter(d => d.status === 'verified').length}</div>
                  <div className="stat-label">متحقق</div>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>المستند</th>
                    <th>العميل</th>
                    <th>رقم الملف</th>
                    <th>النوع</th>
                    <th>تاريخ الانتهاء</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDocuments().map(doc => {
                    const required = isDocRequired(doc);
                    const statusBorder = doc.status === 'verified' ? '#22c55e' : doc.status === 'pending' ? '#f59e0b' : '#ef4444';
                    return (
                      <tr key={doc.id} style={{ borderRight: `4px solid ${statusBorder}` }}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{doc.title}</span>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{doc.client_name}</span>
                            <span className="folder-num" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{doc.folder || '-'}</span>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span className="folder-num">{doc.folder || '-'}</span>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{getDocTypeName(doc)}</span>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{doc.expiry_date ? formatDate(doc.expiry_date) : '-'}</span>
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          {getStatusBadge(doc.status, !required)}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <div className="action-buttons" style={{ gap: '6px' }}>
                            {doc.file_type === 'link' && doc.link_url ? (
                              <button className="btn btn-outline btn-sm" onClick={() => window.open(doc.link_url, '_blank')} title="فتح الرابط">
                                <Eye size={14} /> فتح
                              </button>
                            ) : doc.document_url ? (
                              <>
                                <a
                                  href={`${API_URL}/${doc.document_url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-outline btn-sm"
                                  title="عرض"
                                >
                                  <Eye size={14} />
                                </a>
                                <a
                                  href={`${API_URL}/${doc.document_url}`}
                                  download
                                  className="btn btn-outline btn-sm"
                                  title="تنزيل"
                                >
                                  <Download size={14} />
                                </a>
                              </>
                            ) : null}
                            {required && doc.status === 'pending' && (
                              <>
                                <button className="btn btn-success btn-sm verify-btn" title="تحقق" onClick={() => handleVerifyDocument(doc, true)}>
                                  <Check size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm reject-btn" title="رفض" onClick={() => handleVerifyDocument(doc, false)}>
                                  <X size={14} />
                                </button>
                              </>
                            )}
                            {isOwner && (
                              <button className="btn btn-danger btn-sm" title="حذف" onClick={() => { setDeleteTarget({ type: 'document', doc }); setDeleteConfirmText(''); }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {getFilteredDocuments().length === 0 && (
                    <tr><td colSpan="7" className="text-center py-4">لا توجد مستندات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* FOLDERS TAB */}
        {activeTab === 'folders' && (
          <div className="folders-tab">
            <div className="action-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="بحث في المجلدات (اسم أو كود)..."
                  value={folderSearch}
                  onChange={(e) => setFolderSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="card-grid folders-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {folders.filter(f =>
                !folderSearch ||
                (f.clientName && f.clientName.toLowerCase().includes(folderSearch.toLowerCase())) ||
                (f.clientCode && f.clientCode.toLowerCase().includes(folderSearch.toLowerCase()))
              ).map(folder => {
                return (
                  <div key={folder.clientId} className="card folder-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="folder-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Folder size={40} style={{ color: '#f59e0b' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{folder.clientName}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>كود: {folder.clientCode}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                      {folder.totalDocs} مستندات
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      <span style={{ fontWeight: 500 }}>العنوان:</span> {folder.address || '-'}
                    </div>
                    {folder.contactPerson && (
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        <span style={{ fontWeight: 500 }}>الجهة المسؤولة:</span> {folder.contactPerson}
                      </div>
                    )}
                    <div className="folder-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openFolderModal(folder)}>
                        <Eye size={14} /> عرض المستندات
                      </button>
                    </div>
                  </div>
                );
              })}
              {folders.length === 0 && (
                <div className="text-center py-8 text-gray-500">لا توجد مجلدات</div>
              )}
            </div>
          </div>
        )}

        {/* ONBOARDING TAB */}
        {activeTab === 'onboarding' && (
          <div className="onboarding-tab">
            <div className="section-card onboarding-header">
              <h2 className="section-title">
                <Building size={24} /> تقدم توثيق العملاء
              </h2>
              <p className="section-description">
                تتبع المستندات المطلوبة لكل عميل. يجب التحقق من المستندات قبل تفعيل الحساب.
              </p>
            </div>

            <div className="data-grid onboarding-grid">
              {/* Required Documents List */}
              <div className="card required-docs-card">
                <div className="card-header">
                  <h3 className="card-title"><FileText size={18} /> قائمة المستندات المطلوبة</h3>
                </div>
                <div className="docs-list">
                  {requiredDocs.filter(d => d.required).map(doc => (
                    <div key={doc.id} className="required-doc-item required">
                      <div className="doc-check">
                        <CheckCircle size={16} className="required-icon" />
                      </div>
                      <div className="doc-details">
                        <span className="doc-name">{doc.name}</span>
                      </div>
                      <span className="badge badge-warning">مطلوب</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Onboarding Status */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><Users size={18} /> تقدم توثيق العملاء</h3>
                </div>
                <div className="onboarding-status-list">
                  {onboardingClients.length === 0 && <p style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>لا يوجد عملاء</p>}
                  {onboardingClients.map(client => {
                    const requiredCount = parseInt(client.required_count) || 1;
                    const verifiedRequired = parseInt(client.verified_required_count) || 0;
                    const percent = requiredCount > 0 ? Math.round((verifiedRequired / requiredCount) * 100) : 0;
                    const progressStatus = getProgressStatus(percent);
                    return (
                      <div key={client.id} className="client-onboarding-row">
                        <div className="client-info">
                          <span className="client-name">{client.name}</span>
                          <span className="folder-num">كود: {client.code}</span>
                        </div>
                        <div className="progress-section">
                          <div className="progress-bar">
                            <div
                              className={`progress-fill ${percent === 100 ? 'complete' : ''}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="progress-text">{percent}% (تم التحقق {verifiedRequired}/{requiredCount})</span>
                        </div>
                        <div className="client-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={`badge badge-${progressStatus.color}`}>{progressStatus.label}</span>
                          <button className="btn btn-outline btn-sm" onClick={() => openReviewModal(client)}>
                            <Eye size={14} /> مراجعة
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Process Flow */}
            <div className="card process-flow-card">
              <div className="card-header">
                <h3 className="card-title"><Tag size={18} /> عملية التوثيق</h3>
              </div>
              <div className="process-steps">
                <div className="process-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <span className="step-title">إنشاء مجلد عميل</span>
                    <span className="step-desc">تخصيص رقم مجلد فريد (CLT-XXX)</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <span className="step-title">رفع المستندات</span>
                    <span className="step-desc">رفع المستندات المطلوبة للعميل</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <span className="step-title">المراجعة</span>
                    <span className="step-desc">التحقق من جميع المستندات للتأكد من صحتها</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <span className="step-title">الاعتماد</span>
                    <span className="step-desc">الموافقة القانونية، يمكن للمبيعات إنشاء طلبات</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUploadModal(false)}>
          <div className="modal modal-large">
            <div className="modal-header">
              <h2 className="modal-title"><Upload size={20} /> رفع مستند قانوني</h2>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">العميل *</label>
                <select className="form-select" value={uploadClientId} onChange={(e) => setUploadClientId(e.target.value)}>
                  <option value="">اختر العميل</option>
                  {clientsList.map(c => (
                    <option key={c.id} value={c.id}>{c.name_arabic || c.name_english} ({c.code})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">نوع المستند</label>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="uploadMode" checked={uploadMode === 'required'} onChange={() => { setUploadMode('required'); setUploadIsLink(false); }} />
                    <span>مستند مطلوب</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="radio" name="uploadMode" checked={uploadMode === 'additional'} onChange={() => { setUploadMode('additional'); }} />
                    <span>مستند إضافي</span>
                  </label>
                </div>
              </div>
              {uploadMode === 'required' && (
                <div className="form-group">
                  <label className="form-label">نوع المستند المطلوب *</label>
                  <select className="form-select" value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}>
                    <option value="">اختر نوع المستند</option>
                    {requiredDocs.filter(d => d.required).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">عنوان المستند *</label>
                <input type="text" className="form-input" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder={uploadMode === 'required' ? 'مثال: سجل تجاري 2024' : 'مثال: عقد إضافي'} />
              </div>
              {uploadMode === 'additional' && (
                <div className="form-group">
                  <label className="form-label">طريقة الإضافة</label>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="uploadIsLink" checked={!uploadIsLink} onChange={() => setUploadIsLink(false)} />
                      <span>رفع ملف</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="radio" name="uploadIsLink" checked={uploadIsLink} onChange={() => setUploadIsLink(true)} />
                      <span>إضافة رابط</span>
                    </label>
                  </div>
                </div>
              )}
              {uploadIsLink ? (
                <div className="form-group">
                  <label className="form-label">الرابط *</label>
                  <input type="url" className="form-input" value={uploadLinkUrl} onChange={(e) => setUploadLinkUrl(e.target.value)} placeholder="https://..." />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">الملف *</label>
                  <input type="file" className="form-input" onChange={(e) => setUploadFile(e.target.files[0])} />
                  {uploadFile && <p className="text-sm text-gray-500 mt-1">{uploadFile.name}</p>}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">ملاحظات</label>
                <textarea className="form-textarea" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">تاريخ الانتهاء</label>
                <input type="date" className="form-input" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowUploadModal(false)}>إلغاء</button>
              <button className="btn btn-success" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'جاري الرفع...' : <><Upload size={16} /> رفع المستند</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Modal (Bug 3) */}
      {selectedClientFolder && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeFolderModal()}>
          <div className="modal modal-large" style={{ maxWidth: '800px' }}>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FolderOpen size={28} style={{ color: '#f59e0b' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{selectedClientFolder.clientName || selectedClientFolder.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{selectedClientFolder.clientCode || selectedClientFolder.code}</div>
                  </div>
                </div>
                <button className="modal-close" onClick={closeFolderModal}><X size={24} /></button>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: '6px', padding: '8px 12px', fontSize: '0.85rem', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>كود العميل: {selectedClientFolder.clientCode || selectedClientFolder.code}</span>
                <span>|</span>
                <span>{folderClientDocs.length} مستندات</span>
                <span>|</span>
                <span>{folderClientDocs.filter(d => d.status === 'verified').length} متحقق</span>
              </div>
            </div>
            <div className="modal-body">
              {selectedDocIds.length > 0 && (
                <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5, marginBottom: '16px' }}>
                  <span style={{ fontWeight: 600 }}>تم تحديد {selectedDocIds.length} مستند</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setSelectedDocIds([])}>إلغاء التحديد</button>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      if (selectedDocIds.length === 1) {
                        const doc = folderClientDocs.find(d => d.id === selectedDocIds[0]);
                        setDeleteTarget({ type: 'document', doc });
                      } else {
                        setDeleteTarget({ type: 'multiple', ids: [...selectedDocIds], clientName: selectedClientFolder.clientName });
                      }
                      setDeleteConfirmText('');
                    }}>
                      <Trash2 size={14} /> حذف المحدد
                    </button>
                  </div>
                </div>
              )}

              {/* Required documents section */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                <h4 style={{ fontWeight: 600, margin: 0 }}>المستندات المطلوبة</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      const sectionDocIds = requiredDocs.filter(d => d.required).map(reqDoc => {
                        const docsOfThisType = folderClientDocs.filter(d => d.type === reqDoc.id);
                        const priority = { verified: 3, pending: 2, rejected: 1 };
                        return docsOfThisType.length > 0
                          ? docsOfThisType.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0))[0]
                          : null;
                      }).filter(Boolean).map(d => d.id);
                      if (e.target.checked) {
                        setSelectedDocIds(prev => [...new Set([...prev, ...sectionDocIds])]);
                      } else {
                        setSelectedDocIds(prev => prev.filter(id => !sectionDocIds.includes(id)));
                      }
                    }}
                    checked={
                      requiredDocs.filter(d => d.required).map(reqDoc => {
                        const docsOfThisType = folderClientDocs.filter(d => d.type === reqDoc.id);
                        const priority = { verified: 3, pending: 2, rejected: 1 };
                        return docsOfThisType.length > 0
                          ? docsOfThisType.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0))[0]
                          : null;
                      }).filter(Boolean).map(d => d.id).every(id => selectedDocIds.includes(id))
                    }
                  />
                  تحديد الكل
                </label>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {requiredDocs.filter(d => d.required).map(reqDoc => {
                  const docsOfThisType = folderClientDocs.filter(d => d.type === reqDoc.id);
                  const priority = { verified: 3, pending: 2, rejected: 1 };
                  const bestDoc = docsOfThisType.length > 0
                    ? docsOfThisType.sort((a, b) => (priority[b.status] || 0) - (priority[a.status] || 0))[0]
                    : null;
                  const doc = bestDoc;
                  if (!doc) {
                    return (
                      <div key={reqDoc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#fef2f2', borderRadius: '8px', borderRight: '4px solid #ef4444' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <XCircle size={18} color="#ef4444" />
                          <span>{reqDoc.name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="badge badge-secondary">غير مرفق</span>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => triggerFolderUpload(reqDoc)}
                            disabled={folderUploadingType === reqDoc.id}
                            title="رفع الملف"
                          >
                            {folderUploadingType === reqDoc.id ? 'جاري الرفع...' : <><Upload size={14} /> رفع</>}
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '8px', borderRight: `4px solid ${doc.status === 'verified' ? '#22c55e' : '#f59e0b'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={selectedDocIds.includes(doc.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                            else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                          }}
                        />
                        {doc.status === 'verified' ? <CheckCircle size={18} color="#22c55e" /> : <Clock size={18} color="#f59e0b" />}
                        <span style={{ fontWeight: 600 }}>{doc.title || reqDoc.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getStatusBadge(doc.status, false)}
                        {doc.file_type === 'link' && doc.link_url ? (
                          <button className="btn btn-outline btn-sm" onClick={() => window.open(doc.link_url, '_blank')} title="عرض الرابط">
                            <Eye size={14} /> عرض
                          </button>
                        ) : doc.document_url ? (
                          <a href={`${API_URL}/${doc.document_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" title="عرض الملف">
                            <Eye size={14} /> عرض
                          </a>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => triggerFolderUpload(reqDoc)}
                            disabled={folderUploadingType === reqDoc.id}
                            title="رفع الملف"
                          >
                            {folderUploadingType === reqDoc.id ? 'جاري الرفع...' : <><Upload size={14} /> رفع</>}
                          </button>
                        )}
                        {doc.status === 'pending' && (
                          <>
                            <button className="btn btn-success btn-sm verify-btn" title="تحقق" onClick={() => handleFolderDocAction(doc, true)}>
                              <Check size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm reject-btn" title="رفض" onClick={() => handleFolderDocAction(doc, false)}>
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Company links section */}
              <h4 style={{ fontWeight: 600, marginBottom: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>معلومات الشركة</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>الموقع الإلكتروني</label>
                  <input type="url" className="form-input" placeholder="https://..." value={companyLinks.website} onChange={e => setCompanyLinks({...companyLinks, website: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>صفحة فيسبوك</label>
                  <input type="url" className="form-input" placeholder="https://facebook.com/..." value={companyLinks.facebook} onChange={e => setCompanyLinks({...companyLinks, facebook: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: '0' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem' }}>رقم واتساب</label>
                  <input type="text" className="form-input" placeholder="+201..." value={companyLinks.whatsapp} onChange={e => setCompanyLinks({...companyLinks, whatsapp: e.target.value})} />
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveCompanyLinks} style={{ alignSelf: 'flex-start' }}>
                  حفظ
                </button>
              </div>

              {/* Additional documents section */}
              {folderClientDocs.filter(d => !isDocRequired(d)).length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                    <h4 style={{ fontWeight: 600, margin: 0, color: '#64748b' }}>مستندات إضافية</h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          const sectionDocIds = folderClientDocs.filter(d => !isDocRequired(d)).map(d => d.id);
                          if (e.target.checked) {
                            setSelectedDocIds(prev => [...new Set([...prev, ...sectionDocIds])]);
                          } else {
                            setSelectedDocIds(prev => prev.filter(id => !sectionDocIds.includes(id)));
                          }
                        }}
                        checked={
                          folderClientDocs.filter(d => !isDocRequired(d)).length > 0 &&
                          folderClientDocs.filter(d => !isDocRequired(d)).every(d => selectedDocIds.includes(d.id))
                        }
                      />
                      تحديد الكل
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {folderClientDocs.filter(d => !isDocRequired(d)).map(doc => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '8px', borderRight: '4px solid #94a3b8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            checked={selectedDocIds.includes(doc.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                              else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{doc.title}</span>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{getDocTypeName(doc)} • {formatDate(doc.created_at)}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getStatusBadge(doc.status, true)}
                          {doc.status === 'pending' && (
                            <>
                              <button className="btn btn-success btn-sm verify-btn" title="تحقق" onClick={() => handleFolderDocAction(doc, true)}>
                                <Check size={14} />
                              </button>
                              <button className="btn btn-danger btn-sm reject-btn" title="رفض" onClick={() => handleFolderDocAction(doc, false)}>
                                <X size={14} />
                              </button>
                            </>
                          )}
                          {doc.file_type === 'link' && doc.link_url ? (
                            <button className="btn btn-outline btn-sm" onClick={() => window.open(doc.link_url, '_blank')}>
                              <Eye size={14} /> فتح الرابط
                            </button>
                          ) : doc.document_url ? (
                            <>
                              <a href={`${API_URL}/${doc.document_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" title="عرض"><Eye size={14} /></a>
                              <a href={`${API_URL}/${doc.document_url}`} download className="btn btn-outline btn-sm" title="تنزيل"><Download size={14} /></a>
                            </>
                          ) : null}
                          {isOwner && (
                            <button className="btn btn-danger btn-sm" title="حذف" onClick={() => { setDeleteTarget({ type: 'document', doc }); setDeleteConfirmText(''); }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {folderClientDocs.length === 0 && requiredDocs.filter(d => d.required).length === 0 && (
                <p className="text-center text-gray-500 py-4">لا توجد مستندات لهذا العميل</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeFolderModal}>رجوع</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" style={{ zIndex: 10000 }} onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal modal-large" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {deleteTarget.type === 'document' ? 'حذف مستند' : deleteTarget.type === 'multiple' ? 'حذف المستندات المحددة' : 'حذف جميع مستندات العميل'}
              </h2>
              <button className="modal-close" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px' }}>
                {deleteTarget.type === 'document' ? (
                  <>
                    لحذف هذا المستند، اكتب اسمه بالكامل للتأكيد:<br />
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginTop: '8px' }}>{deleteTarget.doc.title}</strong>
                  </>
                ) : deleteTarget.type === 'multiple' ? (
                  <>
                    لحذف المستندات المحددة، اكتب اسم العميل للتأكيد:<br />
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginTop: '8px' }}>{deleteTarget.clientName}</strong>
                  </>
                ) : (
                  <>
                    لحذف جميع مستندات هذا العميل، اكتب اسم العميل للتأكيد:<br />
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginTop: '8px' }}>{deleteTarget.client.clientName || deleteTarget.client.name}</strong>
                  </>
                )}
              </p>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="اكتب الاسم هنا..."
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(''); }}>إلغاء</button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleteLoading || deleteConfirmText.trim().toLowerCase() !== (deleteTarget.type === 'document' ? deleteTarget.doc.title : deleteTarget.type === 'multiple' ? deleteTarget.clientName : (deleteTarget.client.clientName || deleteTarget.client.name || '')).trim().toLowerCase()}
              >
                {deleteLoading ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && reviewClient && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowReviewModal(false)}>
          <div className="modal modal-large" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title"><Eye size={20} /> مراجعة مستندات العميل</h2>
              <button className="modal-close" onClick={() => setShowReviewModal(false)}><X size={24} /></button>
            </div>
            <div className="modal-body">
              <div className="card mb-4">
                <h3 className="card-title">{reviewClient.name} <span className="text-gray-500">({reviewClient.code})</span></h3>
              </div>

              <h4 className="font-semibold mb-3">المستندات المطلوبة</h4>
              <div className="space-y-2 mb-6">
                {requiredDocs.filter(d => d.required).map(reqDoc => {
                  const { status, doc } = getDocStatusForClient(reqDoc.id, reviewClientDocs);
                  return (
                    <div key={reqDoc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {status === 'verified' ? <CheckCircle size={18} color="#22c55e" /> :
                         status === 'pending' ? <Clock size={18} color="#f59e0b" /> :
                         <XCircle size={18} color="#ef4444" />}
                        <span>{reqDoc.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(status)}
                        {status === 'pending' && doc && (
                          <button className="btn btn-success btn-sm" onClick={() => handleVerifyDocument(doc, true)}>
                            <Check size={14} /> تحقق
                          </button>
                        )}
                        {status === 'missing' && (
                          <button className="btn btn-primary btn-sm" onClick={() => {
                            setShowReviewModal(false);
                            setUploadClientId(String(reviewClient.id));
                            setUploadDocType(reqDoc.id);
                            setUploadTitle(reqDoc.name);
                            setShowUploadModal(true);
                          }}>
                            <Upload size={14} /> رفع
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <h4 className="font-semibold mb-3">جميع المستندات المرفقة</h4>
              {reviewClientDocs.length === 0 ? (
                <p className="text-gray-500">لا توجد مستندات مرفقة</p>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>المستند</th><th>النوع</th><th>الحالة</th><th>الإجراءات</th></tr>
                    </thead>
                    <tbody>
                      {reviewClientDocs.map(doc => (
                        <tr key={doc.id}>
                          <td>{doc.title}</td>
                          <td>{getDocTypeName(doc)}</td>
                          <td>{getStatusBadge(doc.status, !doc.is_required)}</td>
                          <td>
                            {doc.file_type === 'link' && doc.link_url ? (
                              <button className="btn btn-outline btn-sm" onClick={() => window.open(doc.link_url, '_blank')}>
                                <Eye size={14} /> فتح
                              </button>
                            ) : doc.document_url ? (
                              <>
                                <a href={`${API_URL}/${doc.document_url}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><Eye size={14} /></a>
                                <a href={`${API_URL}/${doc.document_url}`} download className="btn btn-outline btn-sm"><Download size={14} /></a>
                              </>
                            ) : null}
                            {doc.is_required && doc.status === 'pending' && (
                              <>
                                <button className="btn btn-success btn-sm" onClick={() => handleVerifyDocument(doc, true)}>
                                  <Check size={14} />
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleVerifyDocument(doc, false)}>
                                  <X size={14} />
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowReviewModal(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
