import { t } from '../utils/i18n';
import React, { useState, useEffect } from 'react';
import { 
  Settings, Users, Building, Bell, Shield, Palette, 
  Database, Globe, Mail, MessageCircle, CreditCard, Calendar, Check, X,
  Search, Plus, Edit2, Trash2, UserCheck, UserX, Lock, Eye, EyeOff,
  ChevronDown, Filter, RefreshCw, AlertTriangle
} from 'lucide-react';
import { authService, usersService } from '../services/api';

// Available modules for permissions
const AVAILABLE_MODULES = [
  { id: 'sales', name: 'Sales', category: 'Sales' },
  { id: 'clients', name: 'Clients', category: 'Sales' },
  { id: 'orders', name: 'Orders', category: 'Sales' },
  { id: 'inventory', name: 'Inventory', category: 'Production' },
  { id: 'feed_recipes', name: 'Feed Recipes', category: 'Production' },
  { id: 'production', name: 'Production', category: 'Production' },
  { id: 'finance', name: 'Finance Dashboard', category: 'Finance' },
  { id: 'receivables', name: 'Receivables', category: 'Finance' },
  { id: 'payables', name: 'Payables', category: 'Finance' },
  { id: 'expenses', name: 'Expenses', category: 'Finance' },
  { id: 'accounting', name: 'Accounting', category: 'Finance' },
  { id: 'suppliers', name: 'Suppliers', category: 'Purchasing' },
  { id: 'purchase_orders', name: 'Purchase Orders', category: 'Purchasing' },
  { id: 'grn', name: 'Goods Receipt (GRN)', category: 'Purchasing' },
  { id: 'hr', name: 'HR', category: 'HR' },
  { id: 'payroll', name: 'Payroll', category: 'HR' },
  { id: 'delivery', name: 'Delivery', category: 'Operations' },
  { id: 'assets', name: 'Assets', category: 'Operations' },
  { id: 'legal', name: 'Legal Dept', category: 'Operations' },
  { id: 'reports', name: 'Reports', category: 'Operations' },
  { id: 'settings', name: 'Settings', category: 'Admin' }
];

// User roles
const USER_ROLES = [
  { id: 'admin', name: 'Administrator', description: 'Full system access' },
  { id: 'sales_manager', name: 'Sales Manager', description: 'Manage sales team and clients' },
  { id: 'sales_rep', name: 'Sales Representative', description: 'Sales and client management' },
  { id: 'finance', name: 'Finance Manager', description: 'Financial operations' },
  { id: 'production', name: 'Production Manager', description: 'Production and inventory' },
  { id: 'purchasing', name: 'Purchasing Manager', description: 'Suppliers and purchasing' },
  { id: 'hr', name: 'HR Manager', description: 'Human resources' },
  { id: 'delivery', name: 'Delivery Manager', description: 'Delivery operations' },
  { id: 'owner', name: 'Owner', description: 'Business owner access' },
  { id: 'ceo', name: 'CEO', description: 'Executive access' }
];

// User Management Component
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser] = useState(authService.getCurrentUser());
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [autoGeneratePassword, setAutoGeneratePassword] = useState(true);
  
  const [userForm, setUserForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'sales_rep',
    status: 'active',
    password: '',
    modulePermissions: []
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersService.getUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        // Fallback to localStorage if API not ready
        const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
        setUsers(localUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // Fallback to localStorage
      const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
      setUsers(localUsers);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!userForm.firstName.trim()) errors.firstName = 'First name is required';
    if (!userForm.lastName.trim()) errors.lastName = 'Last name is required';
    if (!userForm.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (!selectedUser && !autoGeneratePassword && !userForm.password) {
      errors.password = 'Password is required';
    }
    if (userForm.modulePermissions.length === 0) {
      errors.modulePermissions = 'At least one module permission is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = async () => {
    if (!validateForm()) return;

    try {
      const userData = {
        ...userForm,
        password: autoGeneratePassword && !selectedUser ? generatePassword() : userForm.password
      };

      if (selectedUser) {
        // Update existing user
        const response = await usersService.updateUser(selectedUser._id, userData);
        if (response.success || response._id) {
          const updatedUsers = users.map(u => u._id === selectedUser._id ? { ...u, ...userData } : u);
          setUsers(updatedUsers);
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          alert('User updated successfully!');
        }
      } else {
        // Create new user
        const response = await usersService.createUser(userData);
        if (response.success || response._id) {
          const newUser = { ...userData, _id: response._id || Date.now().toString() };
          const updatedUsers = [...users, newUser];
          setUsers(updatedUsers);
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          if (autoGeneratePassword) {
            alert(`User created successfully! Generated password: ${userData.password}`);
          } else {
            alert('User created successfully!');
          }
        }
      }
      setShowUserModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user. Please try again.');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    if (selectedUser._id === currentUser?._id || selectedUser.email === currentUser?.email) {
      alert('You cannot delete your own account!');
      setShowDeleteModal(false);
      return;
    }

    try {
      // Soft delete - mark as inactive
      const response = await usersService.updateUser(selectedUser._id, { status: 'inactive' });
      if (response.success || response._id) {
        const updatedUsers = users.map(u => 
          u._id === selectedUser._id ? { ...u, status: 'inactive' } : u
        );
        setUsers(updatedUsers);
        localStorage.setItem('users', JSON.stringify(updatedUsers));
        alert('User has been deactivated successfully!');
      }
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Please try again.');
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const resetForm = () => {
    setUserForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'sales_rep',
      status: 'active',
      password: '',
      modulePermissions: []
    });
    setFormErrors({});
    setAutoGeneratePassword(true);
    setShowPassword(false);
  };

  const openCreateModal = () => {
    setSelectedUser(null);
    resetForm();
    setShowUserModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setUserForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'sales_rep',
      status: user.status || 'active',
      password: '',
      modulePermissions: user.modulePermissions || []
    });
    setAutoGeneratePassword(false);
    setShowUserModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const toggleModulePermission = (moduleId) => {
    setUserForm(prev => ({
      ...prev,
      modulePermissions: prev.modulePermissions.includes(moduleId)
        ? prev.modulePermissions.filter(id => id !== moduleId)
        : [...prev.modulePermissions, moduleId]
    }));
  };

  const toggleAllModulesInCategory = (category) => {
    const categoryModules = AVAILABLE_MODULES.filter(m => m.category === category).map(m => m.id);
    const allSelected = categoryModules.every(id => userForm.modulePermissions.includes(id));
    
    setUserForm(prev => ({
      ...prev,
      modulePermissions: allSelected
        ? prev.modulePermissions.filter(id => !categoryModules.includes(id))
        : [...new Set([...prev.modulePermissions, ...categoryModules])]
    }));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.lastName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleName = (roleId) => {
    return USER_ROLES.find(r => r.id === roleId)?.name || roleId;
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      owner: 'bg-gold-100 text-gold-800',
      ceo: 'bg-blue-100 text-blue-800',
      sales_manager: 'bg-green-100 text-green-800',
      sales_rep: 'bg-teal-100 text-teal-800',
      finance: 'bg-red-100 text-red-800',
      production: 'bg-orange-100 text-orange-800',
      purchasing: 'bg-yellow-100 text-yellow-800',
      hr: 'bg-pink-100 text-pink-800',
      delivery: 'bg-indigo-100 text-indigo-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  // Group modules by category
  const modulesByCategory = AVAILABLE_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) acc[module.category] = [];
    acc[module.category].push(module);
    return acc;
  }, {});

  return (
    <div className="user-management">
      {/* Header */}
      <div className="settings-section-header">
        <div>
          <h3 className="card-title">{t('settings.userManagement')}</h3>
          <p className="text-sm text-gray-500">{t('settings.userManagementSub')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          <select 
            value={roleFilter} 
            onChange={(e) => setRoleFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('settings.allRoles')}</option>
            {USER_ROLES.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('common.allLabel')}</option>
            <option value="active">{t('common.statuses.active')}</option>
            <option value="inactive">{t('common.statuses.inactive')}</option>
          </select>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchUsers}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="loading-state">Loading users...</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.email')}</th>
                <th>{t('settings.role')}</th>
                <th>{t('common.status')}</th>
                <th>Modules</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-gray-500">
                    No users found. Click "{t('settings.addUser')}" to create one.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user._id || user.email}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        <span>{user.firstName} {user.lastName}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${getRoleBadgeColor(user.role)}`}>
                        {getRoleName(user.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600">
                        {user.modulePermissions?.length || 0} modules
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => openDeleteModal(user)}
                          title="Deactivate User"
                          disabled={user._id === currentUser?._id || user.email === currentUser?.email}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* User Modal (Create/Edit) */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{selectedUser ? 'Edit User' : 'Create New User'}</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h4 className="section-title">Personal Information</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.firstName ? 'error' : ''}`}
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                      placeholder="Enter first name"
                    />
                    {formErrors.firstName && <span className="error-text">{formErrors.firstName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.lastName ? 'error' : ''}`}
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                      placeholder="Enter last name"
                    />
                    {formErrors.lastName && <span className="error-text">{formErrors.lastName}</span>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className={`form-input ${formErrors.email ? 'error' : ''}`}
                      value={userForm.email}
                      onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                      placeholder="Enter email address"
                      disabled={selectedUser}
                    />
                    {formErrors.email && <span className="error-text">{formErrors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.phone')}</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="section-title">Role & Status</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={userForm.role}
                      onChange={(e) => setUserForm({...userForm, role: e.target.value})}
                    >
                      {USER_ROLES.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('common.status')}</label>
                    <select
                      className="form-select"
                      value={userForm.status}
                      onChange={(e) => setUserForm({...userForm, status: e.target.value})}
                    >
                      <option value="active">{t('common.statuses.active')}</option>
                      <option value="inactive">{t('common.statuses.inactive')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {!selectedUser && (
                <div className="form-section">
                  <h4 className="section-title">Password</h4>
                  <div className="form-group">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autoGeneratePassword}
                        onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                      Auto-generate password
                    </label>
                  </div>
                  {!autoGeneratePassword && (
                    <div className="form-group">
                      <label className="form-label">Password *</label>
                      <div className="password-input-group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className={`form-input ${formErrors.password ? 'error' : ''}`}
                          value={userForm.password}
                          onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                          placeholder="Enter password"
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {formErrors.password && <span className="error-text">{formErrors.password}</span>}
                    </div>
                  )}
                </div>
              )}

              {selectedUser && (
                <div className="form-section">
                  <h4 className="section-title">Security</h4>
                  <button className="btn btn-outline">
                    <Lock size={16} /> Reset Password
                  </button>
                </div>
              )}

              <div className="form-section">
                <h4 className="section-title">Module Permissions *</h4>
                {formErrors.modulePermissions && <span className="error-text">{formErrors.modulePermissions}</span>}
                <div className="modules-grid">
                  {Object.entries(modulesByCategory).map(([category, modules]) => (
                    <div key={category} className="module-category">
                      <div className="category-header">
                        <h5>{category}</h5>
                        <label className="checkbox-sm">
                          <input
                            type="checkbox"
                            checked={modules.every(m => userForm.modulePermissions.includes(m.id))}
                            onChange={() => toggleAllModulesInCategory(category)}
                          />
                          Select All
                        </label>
                      </div>
                      <div className="module-list">
                        {modules.map(module => (
                          <label key={module.id} className="module-checkbox">
                            <input
                              type="checkbox"
                              checked={userForm.modulePermissions.includes(module.id)}
                              onChange={() => toggleModulePermission(module.id)}
                            />
                            <span>{module.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowUserModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveUser}>
                <Check size={16} /> {selectedUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>{t('settings.deactivateUser')}</h3>
              <button className="btn-icon" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <AlertTriangle size={24} />
                <div>
                  <p>Are you sure you want to deactivate this user?</p>
                  <p className="text-sm text-gray-600">
                    <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    The user will be marked as inactive and will no longer be able to access the system.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteUser}>
                <UserX size={16} /> Deactivate User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Integration Settings Component
const IntegrationSettings = () => {
  const [integrations, setIntegrations] = useState({
    whatsapp: { connected: true, phoneNumber: '+971501234567', apiKey: '********' },
    email: { connected: true, smtpHost: 'smtp.gmail.com', smtpPort: '587', username: 'notifications@osirislabs.com' },
    payment: { connected: false, provider: '', apiKey: '', secretKey: '' },
    sms: { connected: false, provider: '', apiKey: '' },
    calendar: { connected: false, provider: 'google', clientId: '' }
  });
  const [editing, setEditing] = useState(null);
  const [testStatus, setTestStatus] = useState({});

  useEffect(() => {
    const saved = localStorage.getItem('integrations');
    if (saved) {
      setIntegrations(JSON.parse(saved));
    }
  }, []);

  const saveIntegrations = () => {
    localStorage.setItem('integrations', JSON.stringify(integrations));
    alert('Integration settings saved!');
  };

  const testConnection = (type) => {
    setTestStatus({ ...testStatus, [type]: 'testing' });
    setTimeout(() => {
      setTestStatus({ ...testStatus, [type]: integrations[type].connected ? 'success' : 'error' });
    }, 1500);
  };

  const toggleConnection = (type) => {
    setIntegrations({
      ...integrations,
      [type]: { ...integrations[type], connected: !integrations[type].connected }
    });
  };

  const updateField = (type, field, value) => {
    setIntegrations({
      ...integrations,
      [type]: { ...integrations[type], [field]: value }
    });
  };

  const integrationCards = [
    { 
      id: 'whatsapp', 
      name: 'WhatsApp Business', 
      icon: MessageCircle, 
      color: '#25d366',
      description: 'Send automated messages and reminders to clients'
    },
    { 
      id: 'email', 
      name: 'Email SMTP', 
      icon: Mail, 
      color: '#ea4335',
      description: 'Send invoices, contracts and notifications via email'
    },
    { 
      id: 'payment', 
      name: 'Payment Gateway', 
      icon: CreditCard, 
      color: '#635bff',
      description: 'Accept online payments via credit card or bank transfer'
    },
    { 
      id: 'sms', 
      name: 'SMS Gateway', 
      icon: MessageCircle, 
      color: '#3498db',
      description: 'Send SMS notifications and payment reminders'
    },
    { 
      id: 'calendar', 
      name: 'Calendar Sync', 
      icon: Calendar, 
      color: '#4285f4',
      description: 'Sync viewings and meetings with Google/Outlook calendar'
    }
  ];

  return (
    <div>
      <div className="settings-section-header">
        <h3 className="card-title">Integrations</h3>
        <button className="btn btn-primary" onClick={saveIntegrations}>
          <Check size={16} /> Save All Changes
        </button>
      </div>

      <div className="integration-cards-grid">
        {integrationCards.map((item) => {
          const Icon = item.icon;
          const config = integrations[item.id];
          const isEditing = editing === item.id;
          const testResult = testStatus[item.id];

          return (
            <div 
              key={item.id} 
              className={`integration-card ${config.connected ? 'integration-card-connected' : ''}`}
            >
              <div className="integration-card-header">
                <div className="integration-card-info">
                  <div 
                    className="integration-icon"
                    style={{ 
                      background: item.color + '20',
                      color: item.color
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div className="integration-text">
                    <div className="integration-name">{item.name}</div>
                    <div className="integration-description">{item.description}</div>
                  </div>
                </div>
                <div className="integration-controls">
                  <span className={`integration-status ${config.connected ? 'status-connected' : 'status-disconnected'}`}>
                    {config.connected ? 'Connected' : 'Disconnected'}
                  </span>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={config.connected}
                      onChange={() => toggleConnection(item.id)}
                      className="toggle-input"
                    />
                    <span className="toggle-slider" data-connected={config.connected}></span>
                  </label>
                </div>
              </div>

              {config.connected && (
                <div className="integration-config">
                  {isEditing ? (
                    <div className="form-grid">
                      {item.id === 'whatsapp' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={config.phoneNumber}
                              onChange={(e) => updateField(item.id, 'phoneNumber', e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('settings.apiKey')}</label>
                            <input 
                              type="password" 
                              className="form-input"
                              value={config.apiKey}
                              onChange={(e) => updateField(item.id, 'apiKey', e.target.value)}
                            />
                          </div>
                        </>
                      )}
                      {item.id === 'email' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">SMTP Host</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={config.smtpHost}
                              onChange={(e) => updateField(item.id, 'smtpHost', e.target.value)}
                            />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">Port</label>
                              <input 
                                type="text" 
                                className="form-input"
                                value={config.smtpPort}
                                onChange={(e) => updateField(item.id, 'smtpPort', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">Username</label>
                              <input 
                                type="text" 
                                className="form-input"
                                value={config.username}
                                onChange={(e) => updateField(item.id, 'username', e.target.value)}
                              />
                            </div>
                          </div>
                        </>
                      )}
                      {item.id === 'payment' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Provider</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="">Select Provider</option>
                              <option value="stripe">Stripe</option>
                              <option value="paypal">PayPal</option>
                              <option value="telr">Telr</option>
                              <option value="paymob">Paymob</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('settings.apiKey')}</label>
                            <input 
                              type="password" 
                              className="form-input"
                              value={config.apiKey}
                              onChange={(e) => updateField(item.id, 'apiKey', e.target.value)}
                              placeholder="Enter API Key"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Secret Key</label>
                            <input 
                              type="password" 
                              className="form-input"
                              value={config.secretKey}
                              onChange={(e) => updateField(item.id, 'secretKey', e.target.value)}
                              placeholder="Enter Secret Key"
                            />
                          </div>
                        </>
                      )}
                      {item.id === 'sms' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Provider</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="">Select Provider</option>
                              <option value="twilio">Twilio</option>
                              <option value="vonage">Vonage</option>
                              <option value="messagebird">MessageBird</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('settings.apiKey')}</label>
                            <input 
                              type="password" 
                              className="form-input"
                              value={config.apiKey}
                              onChange={(e) => updateField(item.id, 'apiKey', e.target.value)}
                              placeholder="Enter API Key"
                            />
                          </div>
                        </>
                      )}
                      {item.id === 'calendar' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Provider</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="google">Google Calendar</option>
                              <option value="outlook">Outlook Calendar</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">{t('settings.clientId')}</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={config.clientId}
                              onChange={(e) => updateField(item.id, 'clientId', e.target.value)}
                              placeholder="Enter OAuth Client ID"
                            />
                          </div>
                        </>
                      )}
                      <div className="form-actions">
                        <button className="btn btn-outline" onClick={() => setEditing(null)}>
                          <X size={16} /> Cancel
                        </button>
                        <button className="btn btn-primary" onClick={() => { setEditing(null); saveIntegrations(); }}>
                          <Check size={16} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="integration-preview">
                      <div className="integration-preview-text">
                        {item.id === 'whatsapp' && `Connected to: ${config.phoneNumber}`}
                        {item.id === 'email' && `SMTP: ${config.smtpHost}:${config.smtpPort}`}
                        {item.id === 'payment' && (config.provider ? `Provider: ${config.provider}` : 'No provider configured')}
                        {item.id === 'sms' && (config.provider ? `Provider: ${config.provider}` : 'No provider configured')}
                        {item.id === 'calendar' && `Provider: ${config.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'}`}
                      </div>
                      <div className="integration-actions">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => testConnection(item.id)}
                          disabled={testResult === 'testing'}
                        >
                          {testResult === 'testing' ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(item.id)}
                        >
                          Configure
                        </button>
                      </div>
                    </div>
                  )}
                  {testResult === 'success' && (
                    <div className="alert alert-success test-result">
                      <Check size={14} /> Connection successful!
                    </div>
                  )}
                  {testResult === 'error' && (
                    <div className="alert alert-danger test-result">
                      <X size={14} /> Connection failed. Please check your settings.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Currency configuration with symbols and locales
export const currencyConfig = {
  AED: { symbol: 'AED', locale: 'en-US', name: 'UAE Dirham' },
  EGP: { symbol: 'EGP', locale: 'en-US', name: 'Egyptian Pound' },
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
  EUR: { symbol: '€', locale: 'en-US', name: 'Euro' },
  GBP: { symbol: '£', locale: 'en-US', name: 'British Pound' }
};

// Get company currency from localStorage or default to EGP
export const getCompanyCurrency = () => {
  const settings = JSON.parse(localStorage.getItem('companySettings') || '{}');
  return settings.currency || 'EGP';
};

// Format currency based on company settings
export const formatCurrency = (amount, currencyCode = null) => {
  const currency = currencyCode || getCompanyCurrency();
  const config = currencyConfig[currency] || currencyConfig.EGP;
  
  if (amount >= 1000000) {
    return `${config.symbol} ${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `${config.symbol} ${(amount / 1000).toFixed(0)}K`;
  }
  return `${config.symbol} ${amount.toLocaleString()}`;
};

// Full currency formatter with Intl
export const formatCurrencyFull = (amount, currencyCode = null) => {
  const currency = currencyCode || getCompanyCurrency();
  const config = currencyConfig[currency] || currencyConfig.EGP;
  
  return new Intl.NumberFormat(config.locale, { 
    style: 'currency', 
    currency: currency, 
    maximumFractionDigits: 0 
  }).format(amount || 0);
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [companySettings, setCompanySettings] = useState({
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    dateFormat: 'YYYY-MM-DD'
  });
  const user = authService.getCurrentUser();

  // Profile state
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [profileLoading, setProfileLoading] = useState(false);

  // Security state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      leadAssignments: true,
      reservationExpiring: true,
      paymentReceived: true,
      contractSigned: true,
      whatsappMessages: true
    };
  });

  // Branding state
  const [brandingForm, setBrandingForm] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('brandingSettings') || '{}');
    return {
      logoUrl: saved.logoUrl || 'https://sandybrown-ant-159541.hostingersite.com/wp-content/uploads/2025/12/شركة-الخير-للأعلاف-1-02.png',
      primaryColor: saved.primaryColor || '#2980b9'
    };
  });

  useEffect(() => {
    // Load saved company settings
    const savedSettings = JSON.parse(localStorage.getItem('companySettings') || '{}');
    if (savedSettings.currency) {
      setCompanySettings(prev => ({ ...prev, ...savedSettings }));
    }
  }, []);

  const handleCurrencyChange = (currency) => {
    const newSettings = { ...companySettings, currency };
    setCompanySettings(newSettings);
    localStorage.setItem('companySettings', JSON.stringify(newSettings));
    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('currencyChanged', { detail: { currency } }));
  };

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      const response = await usersService.updateUser(user?._id, profileForm);
      if (response.success || response._id) {
        // Update local user data
        const updatedUser = { ...user, ...profileForm };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        alert('Profile updated successfully!');
      } else {
        alert(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError('');
    if (!passwordForm.currentPassword) {
      setPasswordError('Current password is required');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    try {
      const response = await authService.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      if (response.success) {
        alert('Password updated successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(response.error || 'Failed to update password');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('Error updating password. Please try again.');
    }
  };

  const toggleNotification = (key) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('notificationSettings', JSON.stringify(updated));
  };

  const handleSaveBranding = () => {
    localStorage.setItem('brandingSettings', JSON.stringify(brandingForm));
    localStorage.setItem('companyLogo', brandingForm.logoUrl);
    alert('Branding settings saved successfully!');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Users },
    { id: 'organization', label: 'Organization', icon: Building },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'language', label: t('settings.language'), icon: Globe },
    { id: 'users', label: t('settings.userManagement'), icon: UserCheck },
    { id: 'integrations', label: 'Integrations', icon: Database }
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.settings')}</h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Sidebar */}
        <div className="settings-sidebar card">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-tab ${activeTab === tab.id ? 'settings-tab-active' : ''}`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="card">
          {activeTab === 'profile' && (
            <div className="settings-content">
              <h3 className="card-title">Profile Settings</h3>
              <div className="profile-header">
                <div className="profile-avatar">
                  {profileForm.firstName?.charAt(0)}{profileForm.lastName?.charAt(0)}
                </div>
                <div className="profile-info">
                  <div className="profile-name">{profileForm.firstName} {profileForm.lastName}</div>
                  <div className="profile-email">{profileForm.email}</div>
                  <div className="profile-role">{user?.role}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input type="text" className="form-input" value={profileForm.firstName} onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input type="text" className="form-input" value={profileForm.lastName} onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.email')}</label>
                  <input type="email" className="form-input" value={profileForm.email} disabled />
                  <small className="form-help">Email cannot be changed</small>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.phone')}</label>
                  <input type="tel" className="form-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} />
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="settings-content">
              <h3 className="card-title">Organization Settings</h3>
              <div className="form-group">
                <label className="form-label">{t('settings.companyName')}</label>
                <input type="text" className="form-input" defaultValue="Osiris Labs Real Estate" />
              </div>
              <div className="form-group">
                <label className="form-label">Default Currency</label>
                <select 
                  className="form-select" 
                  value={companySettings.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                  <option value="EGP">EGP - Egyptian Pound (ج.م)</option>
                  <option value="AED">AED - UAE Dirham (د.إ)</option>
                  <option value="USD">USD - US Dollar ($)</option>
                  <option value="EUR">EUR - Euro (€)</option>
                  <option value="GBP">GBP - British Pound (£)</option>
                </select>
                <small className="form-help">
                  Current: {currencyConfig[companySettings.currency]?.symbol} {currencyConfig[companySettings.currency]?.name}
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Timezone</label>
                <select 
                  className="form-select"
                  value={companySettings.timezone}
                  onChange={(e) => setCompanySettings({...companySettings, timezone: e.target.value})}
                >
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                  <option value="Africa/Cairo">Africa/Cairo (EET)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={() => {
                localStorage.setItem('companySettings', JSON.stringify(companySettings));
                alert('Settings saved successfully!');
              }}>{t('common.saveChanges')}</button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-content">
              <h3 className="card-title">Notification Preferences</h3>
              {[
                { key: 'leadAssignments', label: 'New lead assignments', desc: 'Get notified when new leads are assigned to you' },
                { key: 'reservationExpiring', label: 'Reservation expiring', desc: 'Alert when reservations are about to expire' },
                { key: 'paymentReceived', label: 'Payment received', desc: 'Notification when installments are paid' },
                { key: 'contractSigned', label: 'Contract signed', desc: 'Alert when contracts are signed' },
                { key: 'whatsappMessages', label: 'WhatsApp messages', desc: 'New message notifications' }
              ].map((item) => (
                <div key={item.key} className="notification-item">
                  <div className="notification-text">
                    <div className="notification-label">{item.label}</div>
                    <div className="notification-desc">{item.desc}</div>
                  </div>
                  <label className="toggle-switch toggle-switch-sm">
                    <input type="checkbox" checked={notifications[item.key]} onChange={() => toggleNotification(item.key)} className="toggle-input" />
                    <span className="toggle-slider" data-connected={notifications[item.key]}></span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-content">
              <h3 className="card-title">Security Settings</h3>
              {passwordError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={20} /> {passwordError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{t('settings.currentPassword')}</label>
                <input type="password" className="form-input" placeholder="Enter current password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" placeholder="Enter new password (min 6 chars)" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.confirmPassword')}</label>
                <input type="password" className="form-input" placeholder="Confirm new password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
              <button className="btn btn-primary" onClick={handleUpdatePassword}>Update Password</button>

              <div className="security-section">
                <h4 className="security-title">Two-Factor Authentication</h4>
                <p className="security-desc">{t('settings.2faDesc')}</p>
                <button className="btn btn-outline" onClick={() => {
                  setTwoFAEnabled(!twoFAEnabled);
                  alert(twoFAEnabled ? '2FA has been disabled.' : '2FA setup would open here. (Feature requires backend integration)');
                }}>
                  {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="settings-content">
              <h3 className="card-title">{t('settings.branding')}</h3>
              <div className="form-group">
                <label className="form-label">{t('settings.companyLogo')}</label>
                <div className="logo-upload-container">
                  <img 
                    src={brandingForm.logoUrl}
                    alt="Company Logo" 
                    className="logo-preview" 
                    style={{ maxHeight: '80px', objectFit: 'contain' }}
                  />
                  <div className="logo-upload-actions">
                    <p className="logo-current">{t('settings.currentLogo')}</p>
                    <p className="logo-dimensions">Recommended: 400x100px, PNG or SVG</p>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Logo URL</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm({...brandingForm, logoUrl: e.target.value})}
                  placeholder="https://..."
                />
                <small className="form-help">
                  Enter the URL of your company logo image
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Primary Color</label>
                <div className="color-picker">
                  <input type="color" value={brandingForm.primaryColor} onChange={(e) => setBrandingForm({...brandingForm, primaryColor: e.target.value})} className="color-input" />
                  <span className="color-value">{brandingForm.primaryColor}</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveBranding}>Save Branding</button>
            </div>
          )}

          {activeTab === 'language' && (
            <div className="settings-content">
              <h3 className="card-title">Language / اللغة</h3>
              <p className="settings-description">Choose your preferred language / اختر لغتك المفضلة</p>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button
                  onClick={() => { localStorage.setItem('lang', 'en'); window.location.reload(); }}
                  style={{
                    flex: 1, padding: '24px', borderRadius: '12px', border: '2px solid',
                    borderColor: (localStorage.getItem('lang') || 'en') === 'en' ? '#2980b9' : '#e2e8f0',
                    background: (localStorage.getItem('lang') || 'en') === 'en' ? '#eef7ff' : '#fff',
                    cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🇬🇧</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>{t('settings.english')}</div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>English interface</div>
                </button>
                <button
                  onClick={() => { localStorage.setItem('lang', 'ar'); window.location.reload(); }}
                  style={{
                    flex: 1, padding: '24px', borderRadius: '12px', border: '2px solid',
                    borderColor: (localStorage.getItem('lang') || 'en') === 'ar' ? '#2980b9' : '#e2e8f0',
                    background: (localStorage.getItem('lang') || 'en') === 'ar' ? '#eef7ff' : '#fff',
                    cursor: 'pointer', textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🇸🇦</div>
                  <div style={{ fontSize: '18px', fontWeight: 600 }}>العربية</div>
                  <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>واجهة عربية</div>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="settings-content">
              <UserManagement />
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-content">
              <IntegrationSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
