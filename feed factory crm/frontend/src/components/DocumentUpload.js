import React, { useState, useEffect } from 'react';
import { FileText, Upload, X, Download, Trash2, FileImage, FileSpreadsheet } from 'lucide-react';
import { documentService } from '../services/api';
import { t } from '../utils/i18n';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const uploadHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`
});

const DocumentUpload = ({ entityType, entityId, allowUpload = true, useLegal = false }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  // Legal mode extra fields
  const [docType, setDocType] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [requiredDocs, setRequiredDocs] = useState([]);

  useEffect(() => {
    if (entityId) {
      fetchDocuments();
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (useLegal) {
      fetchRequiredDocs();
    }
  }, [useLegal]);

  const fetchRequiredDocs = async () => {
    try {
      const res = await fetch(`${API_URL}/legal/required-docs`, { headers: headers() });
      const data = await res.json();
      setRequiredDocs(data.docs || []);
    } catch (err) {
      console.error('Error fetching required docs:', err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      if (useLegal && entityType === 'client') {
        const res = await fetch(`${API_URL}/legal/documents?client_id=${entityId}`, { headers: headers() });
        const data = await res.json();
        setDocuments(Array.isArray(data) ? data : (data.documents || []));
      } else {
        const result = await documentService.getByEntity(entityType, entityId);
        if (result.success) {
          setDocuments(result.documents || []);
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !entityId) return;

    if (useLegal && entityType === 'client') {
      if (!docType || !docTitle) {
        alert('يرجى اختيار نوع المستند وإدخال عنوانه');
        return;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('client_id', entityId);
        formData.append('type', docType);
        formData.append('title', docTitle);
        formData.append('notes', description);
        formData.append('file', selectedFile);

        const res = await fetch(`${API_URL}/legal/documents/upload`, {
          method: 'POST',
          headers: uploadHeaders(),
          body: formData
        });

        if (res.ok) {
          setSelectedFile(null);
          setDescription('');
          setDocType('');
          setDocTitle('');
          fetchDocuments();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.error || 'فشل رفع المستند');
        }
      } catch (error) {
        console.error('Error uploading:', error);
        alert('فشل رفع المستند');
      } finally {
        setUploading(false);
      }
      return;
    }

    // Default generic upload
    setUploading(true);
    try {
      const result = await documentService.upload(entityType, entityId, selectedFile, description);
      if (result.success) {
        setSelectedFile(null);
        setDescription('');
        fetchDocuments();
      } else {
        alert(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستند؟')) return;
    try {
      if (useLegal && entityType === 'client') {
        const res = await fetch(`${API_URL}/legal/documents/${docId}`, {
          method: 'DELETE',
          headers: headers()
        });
        if (res.ok) {
          fetchDocuments();
        } else {
          alert('فشل حذف المستند');
        }
      } else {
        const result = await documentService.delete(docId);
        if (result.success) {
          fetchDocuments();
        } else {
          alert(result.error || 'Delete failed');
        }
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType?.startsWith('image/')) return <FileImage size={18} color="#3b82f6" />;
    if (fileType?.includes('sheet') || fileType?.includes('excel') || fileType?.includes('csv')) return <FileSpreadsheet size={18} color="#10b981" />;
    return <FileText size={18} color="#6b7280" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocDisplayName = (doc) => {
    if (useLegal) {
      if (doc.title) return doc.title;
      const req = requiredDocs.find(r => r.id === doc.type);
      return req?.name || doc.type || t('common.documents');
    }
    if (doc.description) return doc.description;
    if (doc.doc_type) return doc.doc_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return t('common.documents');
  };

  const getStatusBadge = (status) => {
    const map = {
      verified: { color: '#22c55e', label: 'متحقق' },
      pending: { color: '#f59e0b', label: 'بانتظار المراجعة' },
      rejected: { color: '#ef4444', label: 'مرفوض' }
    };
    const info = map[status] || { color: '#6b7280', label: status };
    return <span style={{ color: info.color, fontSize: '12px', fontWeight: 500 }}>{info.label}</span>;
  };

  return (
    <div className="document-upload">
      <h4 className="document-upload-header">
        <FileText size={18} /> {t('common.documents')} ({documents.length})
      </h4>

      {allowUpload && (
        <div className="document-upload-area">
          <div className="document-upload-row">
            {useLegal && entityType === 'client' && (
              <>
                <div className="document-upload-field">
                  <label>نوع المستند</label>
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="form-select">
                    <option value="">اختر النوع</option>
                    {requiredDocs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="document-upload-field">
                  <label>عنوان المستند</label>
                  <input type="text" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="عنوان المستند" className="form-input" />
                </div>
              </>
            )}
            <div className="document-upload-field">
              <label>{t('common.file')}</label>
              <input type="file" onChange={handleFileSelect} />
            </div>
            <div className="document-upload-field">
              <label>{useLegal ? 'ملاحظات' : t('common.description')}</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('common.additionalNotes')} />
            </div>
            <button onClick={handleUpload} disabled={!selectedFile || uploading} className="document-upload-btn">
              <Upload size={14} /> {uploading ? t('common.creating') : 'رفع'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>{t('common.loading')}...</p>
      ) : documents.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>لا توجد مستندات</p>
      ) : (
        <div className="document-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-item">
              {getFileIcon(doc.doc_type || doc.type)}
              <div className="document-item-info">
                <div className="document-item-name">{getDocDisplayName(doc)}</div>
                <div className="document-item-meta">
                  {doc.file_path ? formatFileSize(0) : ''}
                  {doc.description ? ` | ${doc.description}` : ''}
                  {useLegal && doc.status && <> | {getStatusBadge(doc.status)}</>}
                </div>
              </div>
              {(doc.document_url || doc.file_path) && (
                <a
                  href={`${API_URL}/${doc.document_url || doc.file_path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="document-action-btn download"
                  title={t('common.download')}
                >
                  <Download size={14} />
                </a>
              )}
              {allowUpload && (
                <button onClick={() => handleDelete(doc.id)} className="document-action-btn delete" title={t('common.delete')}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
