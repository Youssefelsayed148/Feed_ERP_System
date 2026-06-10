import { t } from '../utils/i18n';
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



// Documents needed for client onboarding
const requiredDocuments = [
  { id: 'trade_license', name: 'Trade License', category: 'Business', required: true },
  { id: 'passport', name: 'Passport Copy', category: 'Identity', required: true },
  { id: 'emirates_id', name: 'Emirates ID', category: 'Identity', required: true },
  { id: 'company_profile', name: 'Company Profile', category: 'Business', required: false },
  { id: 'bank_ref', name: 'Bank Reference', category: 'Financial', required: true },
  { id: 'credit_app', name: 'Credit Application', category: 'Financial', required: true },
  { id: 'address_proof', name: 'Address Proof', category: 'Business', required: false },
  { id: 'moa', name: 'MOA (Memorandum of Association)', category: 'Legal', required: true },
];


export default function Legal() {
  const [activeTab, setActiveTab] = useState('documents'); // 'documents', 'folders', 'onboarding'
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [onboardingClients, setOnboardingClients] = useState([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'documents') {
        let url = `${API_URL}/legal/documents`;
        if (statusFilter) url += `?status=${statusFilter}`;
        const docRes = await fetch(url, { headers: headers() });
        const docData = docRes.ok ? await docRes.json() : { documents: [] };
        setDocuments(Array.isArray(docData) ? docData : (docData.documents || []));
      } else if (activeTab === 'folders') {
        const docRes = await fetch(`${API_URL}/legal/documents`, { headers: headers() });
        const docData = docRes.ok ? await docRes.json() : { documents: [] };
        const docs = Array.isArray(docData) ? docData : (docData.documents || []);
        setDocuments(docs);
        const folderMap = {};
        docs.forEach(d => {
          const key = d.folder || `CL-${d.client_id}`;
          if (!folderMap[key]) {
            folderMap[key] = { number: key, client: d.client_name || `Client #${d.client_id}`, type: d.type || 'General', status: d.status, createdAt: d.created_at ? d.created_at.split('T')[0] : '-' };
          }
        });
        setFolders(Object.values(folderMap));
      } else if (activeTab === 'onboarding') {
        const [clientRes, docRes] = await Promise.all([
          fetch(`${API_URL}/legal/clients`, { headers: headers() }),
          fetch(`${API_URL}/legal/documents`, { headers: headers() })
        ]);
        const clientData = clientRes.ok ? await clientRes.json() : { clients: [] };
        const docData = docRes.ok ? await docRes.json() : { documents: [] };
        const docs = Array.isArray(docData) ? docData : (docData.documents || []);
        setDocuments(docs);
        setOnboardingClients(Array.isArray(clientData) ? clientData : (clientData.clients || []));
      }
    } catch (error) {
      console.error('Error fetching legal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDocument = async (doc, approved) => {
    const reason = approved ? null : prompt('Enter rejection reason:');
    if (!approved && !reason) return;
    try {
      const res = await fetch(`${API_URL}/legal/documents/${doc.id}/verify`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ status: approved ? 'verified' : 'rejected', rejection_reason: reason })
      });
      if (res.ok) {
        alert(approved ? 'Document verified successfully!' : 'Document rejected');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update document');
      }
    } catch (err) {
      alert('Failed to connect to server');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      verified: { color: 'success', label: t('legal.verified') },
      pending: { color: 'warning', label: t('legal.pendingReview') },
      rejected: { color: 'danger', label: t('legal.rejected') },
      active: { color: 'success', label: 'Active' },
      pending_review: { color: 'warning', label: 'Under Review' },
      expired: { color: 'danger', label: 'Expired' }
    };
    const statusInfo = statusMap[status] || { color: 'secondary', label: status };
    return <span className={`badge badge-${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const getDocumentProgress = (clientId) => {
    const clientDocs = documents.filter(d => d.client_id === clientId);
    const requiredTypes = requiredDocuments.filter(d => d.required).map(d => d.id);
    const verifiedRequired = clientDocs.filter(d => requiredTypes.includes(d.type) && d.status === 'verified').length;
    const totalRequired = requiredTypes.length;
    return { verified: verifiedRequired, total: totalRequired, percent: totalRequired > 0 ? Math.round((verifiedRequired / totalRequired) * 100) : 0 };
  };

  const tabs = [
    { id: 'documents', label: 'Documents', icon: <FileText size={18} /> },
    { id: 'folders', label: 'Folders', icon: <FolderOpen size={18} /> },
    { id: 'onboarding', label: 'Client Onboarding', icon: <Building size={18} /> }
  ];

  // Filter documents
  const getFilteredDocuments = () => {
    let filtered = [...documents];
    if (search) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(search.toLowerCase()) || 
        d.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        d.folderNumber?.toLowerCase().includes(search.toLowerCase())
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
            <p>Manage client documents, contracts and compliance</p>
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
            <div className="action-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search documents..."
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
                <option value="pending">{t('legal.pendingReview')}</option>
                <option value="verified">{t('legal.verified')}</option>
                <option value="rejected">{t('legal.rejected')}</option>
              </select>
            </div>

            <div className="stats-row">
              <div className="stat-card mini-stat">
                <div className="stat-icon">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.length}</div>
                  <div className="stat-label">{t('legal.totalDocuments')}</div>
                </div>
              </div>
              <div className="stat-card mini-stat pending">
                <div className="stat-icon">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.filter(d => d.status === 'pending').length}</div>
                  <div className="stat-label">{t('legal.pendingReview')}</div>
                </div>
              </div>
              <div className="stat-card mini-stat verified">
                <div className="stat-icon">
                  <CheckCircle size={20} />
                </div>
                <div>
                  <div className="stat-value">{documents.filter(d => d.status === 'verified').length}</div>
                  <div className="stat-label">{t('legal.verified')}</div>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('legal.document')}</th>
                    <th>{t('common.client')}</th>
                    <th>رقم الملف</th>
                    <th>{t('common.type')}</th>
                    <th>{t('legal.expiryDate')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDocuments().map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="doc-info">
                          <FileText size={18} />
                          <span className="doc-name">{doc.title || doc.name}</span>
                        </div>
                      </td>
                      <td>{doc.client_name || doc.clientName}</td>
                      <td className="folder-num">{doc.folder || doc.folderNumber}</td>
                      <td>{requiredDocuments.find(d => d.id === doc.type)?.name || doc.type}</td>
                      <td>{doc.expiry_date || doc.expiryDate ? new Date(doc.expiry_date || doc.expiryDate).toLocaleDateString() : '-'}</td>
                      <td>{getStatusBadge(doc.status)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-outline btn-sm" title="View">
                            <Eye size={14} />
                          </button>
                          <button className="btn btn-outline btn-sm" title="Download">
                            <Download size={14} />
                          </button>
                          {doc.status === 'pending' && (
                            <>
                              <button className="btn btn-success btn-sm verify-btn" title="Verify Document" onClick={() => handleVerifyDocument(doc, true)}>
                                <Check size={14} />
                                <span>تحقق</span>
                              </button>
                              <button className="btn btn-danger btn-sm reject-btn" title="Reject Document" onClick={() => handleVerifyDocument(doc, false)}>
                                <X size={14} />
                                <span>{t('legal.reject')}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
                  placeholder="Search folders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-primary">
                <Plus size={18} /> Create New Folder
              </button>
            </div>

            <div className="card-grid folders-grid">
              {folders.filter(f => !search || (f.client && f.client.toLowerCase().includes(search.toLowerCase())) || f.number.toLowerCase().includes(search.toLowerCase())).map(folder => (
                <div key={folder.number} className="card folder-card">
                  <div className="folder-header">
                    <Folder size={24} className="folder-icon" />
                    <div className="folder-info">
                      <span className="folder-number">{folder.number}</span>
                      {getStatusBadge(folder.status)}
                    </div>
                  </div>
                  <div className="folder-body">
                    <div className="folder-client">
                      <User size={16} />
                      <span>{folder.client}</span>
                    </div>
                    <div className="folder-type">
                      <Files size={16} />
                      <span>{folder.type}</span>
                    </div>
                    <div className="folder-date">
                      <Calendar size={16} />
                      <span>Created: {folder.createdAt}</span>
                    </div>
                    <div className="folder-docs">
                      <FileText size={16} />
                      <span>{documents.filter(d => d.folder === folder.number || d.client_name === folder.client).length} documents</span>
                    </div>
                  </div>
                  <div className="folder-actions">
                    <button className="btn btn-outline btn-sm">
                      <Eye size={14} /> View
                    </button>
                    <button className="btn btn-outline btn-sm">
                      <Upload size={14} /> Add Doc
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ONBOARDING TAB */}
        {activeTab === 'onboarding' && (
          <div className="onboarding-tab">
            <div className="section-card onboarding-header">
              <h2 className="section-title">
                <Building size={24} /> Client Onboarding Checklist
              </h2>
              <p className="section-description">
                Track required documents for each client. Documents must be verified before account activation.
              </p>
            </div>

            <div className="data-grid onboarding-grid">
              {/* Required Documents List */}
              <div className="card required-docs-card">
                <div className="card-header">
                  <h3 className="card-title"><FileText size={18} /> Required Documents List</h3>
                </div>
                <div className="docs-list">
                  {requiredDocuments.map(doc => (
                    <div key={doc.id} className={`required-doc-item ${doc.required ? 'required' : ''}`}>
                      <div className="doc-check">
                        {doc.required ? <CheckCircle size={16} className="required-icon" /> : <Circle size={16} />}
                      </div>
                      <div className="doc-details">
                        <span className="doc-name">{doc.name}</span>
                        <span className="doc-category">{doc.category}</span>
                      </div>
                      {doc.required && <span className="badge badge-warning">{t('common.required')}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Client Onboarding Status */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title"><Users size={18} /> Client Onboarding Progress</h3>
                </div>
                <div className="onboarding-status-list">
                  {onboardingClients.length === 0 && <p style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>{t('legal.noClients')}</p>}
                  {onboardingClients.map(client => {
                    const progress = getDocumentProgress(client.id);
                    return (
                      <div key={client.id} className="client-onboarding-row">
                        <div className="client-info">
                          <span className="client-name">{client.name_arabic || client.name_english}</span>
                          <span className="folder-num">Code: {client.code}</span>
                        </div>
                        <div className="progress-section">
                          <div className="progress-bar">
                            <div 
                              className={`progress-fill ${progress.percent === 100 ? 'complete' : ''}`}
                              style={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <span className="progress-text">{progress.percent}% ({progress.verified}/{progress.total} verified)</span>
                        </div>
                        <div className="client-actions">
                          {progress.percent === 100 ? (
                            <button className="btn btn-success btn-sm">
                              <Check size={14} /> Approve
                            </button>
                          ) : (
                            <button className="btn btn-outline btn-sm">
                              <Eye size={14} /> Review
                            </button>
                          )}
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
                <h3 className="card-title"><Tag size={18} /> Onboarding Process</h3>
              </div>
              <div className="process-steps">
                <div className="process-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <span className="step-title">{t('legal.createClientFolder')}</span>
                    <span className="step-desc">Assign unique folder number (LEG-YYYY-XXX)</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <span className="step-title">رفع مستندات</span>
                    <span className="step-desc">{t('legal.clientSubmits')}</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <span className="step-title">{t('legal.review')}</span>
                    <span className="step-desc">تحقق من جميع المستندات للتأكد من صحتها</span>
                  </div>
                </div>
                <div className="process-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <span className="step-title">{t('legal.approval')}</span>
                    <span className="step-desc">Legal approves, Sales can create orders</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
