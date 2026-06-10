import React, { useState, useEffect } from 'react';
import { FileText, Upload, X, Download, Trash2, FileImage, FileSpreadsheet } from 'lucide-react';
import { documentService } from '../services/api';

const DocumentUpload = ({ entityType, entityId, allowUpload = true }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (entityId) {
      fetchDocuments();
    }
  }, [entityType, entityId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const result = await documentService.getByEntity(entityType, entityId);
      if (result.success) {
        setDocuments(result.documents || []);
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
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      const result = await documentService.delete(docId);
      if (result.success) {
        fetchDocuments();
      } else {
        alert(result.error || 'Delete failed');
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

  return (
    <div className="document-upload">
      <h4 className="document-upload-header">
        <FileText size={18} /> Documents / المستندات ({documents.length})
      </h4>

      {allowUpload && (
        <div className="document-upload-area">
          <div className="document-upload-row">
            <div className="document-upload-field">
              <label>File</label>
              <input
                type="file"
                onChange={handleFileSelect}
              />
            </div>
            <div className="document-upload-field">
              <label>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="document-upload-btn"
            >
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>Loading documents...</p>
      ) : documents.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: '13px' }}>No documents uploaded yet.</p>
      ) : (
        <div className="document-list">
          {documents.map((doc) => (
            <div key={doc.id} className="document-item">
              {getFileIcon(doc.file_type)}
              <div className="document-item-info">
                <div className="document-item-name">{doc.file_name}</div>
                <div className="document-item-meta">
                  {formatFileSize(doc.file_size)} {doc.description ? `| ${doc.description}` : ''}
                </div>
              </div>
              <a
                href={documentService.download(doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="document-action-btn download"
                title="Download"
              >
                <Download size={14} />
              </a>
              {allowUpload && (
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="document-action-btn delete"
                  title="Delete"
                >
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
