import React, { useState, useEffect } from 'react';
import { 
  Settings, Users, Building, Bell, Shield, Palette, 
  Database, Globe, Mail, MessageCircle, CreditCard, Calendar, Check, X,
  Search, Plus, Edit2, Trash2, UserCheck, UserX, Lock, Eye, EyeOff,
  ChevronDown, Filter, RefreshCw, AlertTriangle
} from 'lucide-react';
import { authService, usersService } from '../services/api';
import { t } from '../utils/i18n';

// Available modules for permissions
const AVAILABLE_MODULES = [
  { id: 'sales', name: t('nav.sales'), category: t('settings.permissionCategories.Sales') },
  { id: 'clients', name: t('nav.clients'), category: t('settings.permissionCategories.Sales') },
  { id: 'orders', name: t('nav.orders'), category: t('settings.permissionCategories.Sales') },
  { id: 'inventory', name: t('nav.inventory'), category: t('settings.permissionCategories.Production') },
  { id: 'feed_recipes', name: t('nav.feedRecipes'), category: t('settings.permissionCategories.Production') },
  { id: 'production', name: t('nav.production'), category: t('settings.permissionCategories.Production') },
  { id: 'finance', name: t('nav.finance'), category: t('settings.permissionCategories.Finance') },
  { id: 'receivables', name: t('nav.receivables'), category: t('settings.permissionCategories.Finance') },
  { id: 'payables', name: t('nav.payables'), category: t('settings.permissionCategories.Finance') },
  { id: 'expenses', name: t('nav.expenses'), category: t('settings.permissionCategories.Finance') },
  { id: 'accounting', name: t('nav.accounting'), category: t('settings.permissionCategories.Finance') },
  { id: 'suppliers', name: t('nav.suppliers'), category: t('settings.permissionCategories.Purchasing') },
  { id: 'purchase_orders', name: t('nav.purchaseOrders'), category: t('settings.permissionCategories.Purchasing') },
  { id: 'grn', name: t('nav.grn'), category: t('settings.permissionCategories.Purchasing') },
  { id: 'hr', name: t('nav.hr'), category: t('settings.permissionCategories.HR') },
  { id: 'payroll', name: t('nav.payroll'), category: t('settings.permissionCategories.HR') },
  { id: 'delivery', name: t('nav.delivery'), category: t('settings.permissionCategories.Operations') },
  { id: 'assets', name: t('nav.assets'), category: t('settings.permissionCategories.Operations') },
  { id: 'legal', name: t('nav.legal'), category: t('settings.permissionCategories.Operations') },
  { id: 'reports', name: t('settings.permissionCategories.Operations'), category: t('settings.permissionCategories.Operations') },
  { id: 'settings', name: t('nav.settings'), category: t('settings.permissionCategories.Admin') }
];

// User roles
const USER_ROLES = [
  { id: 'admin', name: 'Administrator', description: t('settings.roleDescriptions.fullAccess') },
  { id: 'sales_manager', name: t('settings.roleNames.salesManager'), description: t('settings.roleDescriptions.manageSales') },
  { id: 'sales_rep', name: t('settings.roleNames.salesRep'), description: t('settings.roleDescriptions.salesClient') },
  { id: 'finance', name: t('settings.roleNames.finance'), description: t('settings.roleDescriptions.financialOps') },
  { id: 'production', name: t('settings.roleNames.production'), description: t('settings.roleDescriptions.productionInventory') },
  { id: 'purchasing', name: t('settings.roleNames.purchasing'), description: t('settings.roleDescriptions.suppliersPurchasing') },
  { id: 'hr', name: t('settings.roleNames.hr'), description: t('settings.roleDescriptions.hr') },
  { id: 'delivery', name: t('settings.roleNames.delivery'), description: t('settings.roleDescriptions.deliveryOps') },
  { id: 'owner', name: t('settings.roleNames.owner'), description: t('settings.roleDescriptions.businessOwner') },
  { id: 'ceo', name: 'CEO', description: t('settings.roleDescriptions.executiveAccess') }
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
    if (!userForm.firstName.trim()) errors.firstName = t('settings.firstNameRequired');
    if (!userForm.lastName.trim()) errors.lastName = t('settings.lastNameRequired');
    if (!userForm.email.trim()) {
      errors.email = t('settings.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      errors.email = t('settings.invalidEmail');
    }
    if (!selectedUser && !autoGeneratePassword && !userForm.password) {
      errors.password = t('settings.passwordRequired');
    }
    if (userForm.modulePermissions.length === 0) {
      errors.modulePermissions = t('settings.modulePermissionRequired');
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
      alert(t('settings.userSaveError'));
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
      alert(t('settings.userDeleteError'));
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
          <Plus size={18} /> {t('settings.addUser')}
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('settings.searchByEmailName')}
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
          <RefreshCw size={16} /> {t('common.refresh')}
        </button>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="loading-state">{t('settings.loadingUsers')}</div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.name')}</th>
                <th>{t('common.email')}</th>
                <th>{t('settings.role')}</th>
                <th>{t('common.status')}</th>
                <th>الوحدات</th>
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
                        {user.status === 'active' ? t('common.statuses.active') : t('common.statuses.inactive')}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600">
                        {user.modulePermissions?.length || 0} {t('settings.modules')}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-icon btn-edit"
                          onClick={() => openEditModal(user)}
                          title="تعديل المستخدم"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn-icon btn-delete"
                          onClick={() => openDeleteModal(user)}
                          title="تعطيل المستخدم"
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
              <h3>{selectedUser ? t('settings.editUser') : t('settings.createNewUser')}</h3>
              <button className="btn-icon" onClick={() => setShowUserModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-section">
                <h4 className="section-title">المعلومات الشخصية</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.firstName')} *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.firstName ? 'error' : ''}`}
                      value={userForm.firstName}
                      onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                      placeholder="أدخل الاسم الأول"
                    />
                    {formErrors.firstName && <span className="error-text">{formErrors.firstName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('settings.lastName')} *</label>
                    <input
                      type="text"
                      className={`form-input ${formErrors.lastName ? 'error' : ''}`}
                      value={userForm.lastName}
                      onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                      placeholder="أدخل اسم العائلة"
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
                      placeholder={t('settings.enterEmailAddress')}
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
                      placeholder="أدخل رقم الهاتف"
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h4 className="section-title">{t('settings.role')} & Status</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t('settings.role')} *</label>
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
                  <h4 className="section-title">كلمة المرور</h4>
                  <div className="form-group">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autoGeneratePassword}
                        onChange={(e) => setAutoGeneratePassword(e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                      {t('settings.autoGeneratePassword')}
                    </label>
                  </div>
                  {!autoGeneratePassword && (
                    <div className="form-group">
                      <label className="form-label">{t('settings.passwordRequired')}</label>
                      <div className="password-input-group">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className={`form-input ${formErrors.password ? 'error' : ''}`}
                          value={userForm.password}
                          onChange={(e) => setUserForm({...userForm, password: e.target.value})}
                          placeholder={t('settings.enterPassword')}
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
                  <h4 className="section-title">الأمان</h4>
                  <button className="btn btn-outline">
                    <Lock size={16} /> {t('settings.resetPassword')}
                  </button>
                </div>
              )}

              <div className="form-section">
                <h4 className="section-title">{t('settings.modulePermissions')} *</h4>
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
                          {t('settings.selectAll')}
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
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={handleSaveUser}>
                <Check size={16} /> {selectedUser ? t('settings.updateUser') : t('settings.createUser')}
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
                  <p>هل أنت متأكد من تعطيل هذا المستخدم؟</p>
                  <p className="text-sm text-gray-600">
                    <strong>{selectedUser.firstName} {selectedUser.lastName}</strong> ({selectedUser.email})
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {t('settings.deactivationWarning')}
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>
                إلغاء
              </button>
              <button className="btn btn-danger" onClick={handleDeleteUser}>
                <UserX size={16} /> تعطيل المستخدم
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
      description: t('settings.integrationsConfig.whatsapp')
    },
    { 
      id: 'email', 
      name: 'Email SMTP', 
      icon: Mail, 
      color: '#ea4335',
      description: t('settings.integrationsConfig.email')
    },
    { 
      id: 'payment', 
      name: 'Payment Gateway', 
      icon: CreditCard, 
      color: '#635bff',
      description: t('settings.integrationsConfig.payment')
    },
    { 
      id: 'sms', 
      name: 'SMS Gateway', 
      icon: MessageCircle, 
      color: '#3498db',
      description: t('settings.integrationsConfig.sms')
    },
    { 
      id: 'calendar', 
      name: 'Calendar Sync', 
      icon: Calendar, 
      color: '#4285f4',
      description: t('settings.integrationsConfig.calendar')
    }
  ];

  return (
    <div>
      <div className="settings-section-header">
        <h3 className="card-title">{t('settings.integrations')}</h3>
          <button className="btn btn-primary" onClick={saveIntegrations}>
            <Check size={16} /> {t('common.saveChanges')}
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
                    {config.connected ? t('settings.integrationsConfig.connected') : t('settings.integrationsConfig.disconnected')}
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
                            <label className="form-label">رقم الهاتف</label>
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
                            <label className="form-label">خادم SMTP</label>
                            <input 
                              type="text" 
                              className="form-input"
                              value={config.smtpHost}
                              onChange={(e) => updateField(item.id, 'smtpHost', e.target.value)}
                            />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label className="form-label">المنفذ</label>
                              <input 
                                type="text" 
                                className="form-input"
                                value={config.smtpPort}
                                onChange={(e) => updateField(item.id, 'smtpPort', e.target.value)}
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label">اسم المستخدم</label>
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
                            <label className="form-label">المزود</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="">اختر المزود</option>
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
                              placeholder="أدخل مفتاح API"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">المفتاح السري</label>
                            <input 
                              type="password" 
                              className="form-input"
                              value={config.secretKey}
                              onChange={(e) => updateField(item.id, 'secretKey', e.target.value)}
                              placeholder="أدخل المفتاح السري"
                            />
                          </div>
                        </>
                      )}
                      {item.id === 'sms' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">المزود</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="">اختر المزود</option>
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
                              placeholder="أدخل مفتاح API"
                            />
                          </div>
                        </>
                      )}
                      {item.id === 'calendar' && (
                        <>
                          <div className="form-group">
                            <label className="form-label">المزود</label>
                            <select 
                              className="form-select"
                              value={config.provider}
                              onChange={(e) => updateField(item.id, 'provider', e.target.value)}
                            >
                              <option value="google">{t('settings.googleCalendar')}</option>
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
                              placeholder={t('settings.enterOAuthClientId')}
                            />
                          </div>
                        </>
                      )}
                      <div className="form-actions">
                        <button className="btn btn-outline" onClick={() => setEditing(null)}>
                          <X size={16} /> {t('common.cancel')}
                        </button>
                        <button className="btn btn-primary" onClick={() => { setEditing(null); saveIntegrations(); }}>
                          <Check size={16} /> {t('common.save')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="integration-preview">
                      <div className="integration-preview-text">
                        {item.id === 'whatsapp' && `${t('settings.integrationsConfig.connectedTo')} ${config.phoneNumber}`}
                        {item.id === 'email' && `SMTP: ${config.smtpHost}:${config.smtpPort}`}
                        {item.id === 'payment' && (config.provider ? `${t('settings.integrationsConfig.provider')}: ${config.provider}` : t('settings.integrationsConfig.noProvider'))}
                        {item.id === 'sms' && (config.provider ? `${t('settings.integrationsConfig.provider')}: ${config.provider}` : t('settings.integrationsConfig.noProvider'))}
                        {item.id === 'calendar' && `${t('settings.integrationsConfig.provider')}: ${config.provider === 'google' ? t('settings.googleCalendar') : 'Outlook Calendar'}`}
                      </div>
                      <div className="integration-actions">
                        <button 
                          className="btn btn-outline btn-sm"
                          onClick={() => testConnection(item.id)}
                          disabled={testResult === 'testing'}
                        >
                          {testResult === 'testing' ? t('settings.integrationsConfig.testing') : t('settings.integrationsConfig.testConnection')}
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditing(item.id)}
                        >
                          {t('settings.configure')}
                        </button>
                      </div>
                    </div>
                  )}
                  {testResult === 'success' && (
                    <div className="alert alert-success test-result">
                      <Check size={14} /> {t('settings.integrationsConfig.connectionSuccess')}
                    </div>
                  )}
                  {testResult === 'error' && (
                    <div className="alert alert-danger test-result">
                      <X size={14} /> {t('settings.integrationsConfig.connectionFailed')}
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

// Format currency: ALWAYS full precision, comma thousands separator, period decimal,
// exactly 2 decimal places. e.g. 1000 -> "1,000.00 EGP", 1500000 -> "1,500,000.00 EGP"
// No abbreviation (no K/M shorthand) — this is the single source of truth for
// currency display across the whole app.
export const formatCurrency = (amount, currencyCode = null) => {
  const currency = currencyCode || getCompanyCurrency();
  const config = currencyConfig[currency] || currencyConfig.EGP;
  const value = Number(amount) || 0;
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${config.symbol}`;
};

// Alias kept for any existing call sites — identical behavior to formatCurrency now.
export const formatCurrencyFull = formatCurrency;

// Format a plain number (quantities, counts, kg, etc — no currency symbol).
// Same separator convention as formatCurrency: comma thousands, period decimal.
// Decimals default to 0 (most quantities are whole numbers) but can be overridden.
export const formatNumber = (amount, decimals = 0) => {
  const value = Number(amount) || 0;
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [companySettings, setCompanySettings] = useState({
    currency: 'EGP',
    timezone: 'Africa/Cairo',
    dateFormat: 'YYYY-MM-DD',
    companyName: 'شركة الخير لأعلاف الحيوانات'
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
    // Fetch real org name from backend
    fetch('/api/organization/company', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.name) setCompanySettings(prev => ({ ...prev, companyName: data.name }));
      })
      .catch(() => {});
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
        alert(response.error || t('settings.profileUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(t('settings.profileUpdateError'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setPasswordError('');
    if (!passwordForm.currentPassword) {
      setPasswordError(t('settings.currentPasswordRequired'));
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError(t('settings.newPasswordMinLength'));
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError(t('settings.passwordsDoNotMatch'));
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
        setPasswordError(response.error || t('settings.passwordUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError(t('settings.passwordUpdateError'));
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
    { id: 'profile', label: t('settings.profile'), icon: Users },
    { id: 'organization', label: t('settings.organization'), icon: Building },
    { id: 'notifications', label: t('settings.notificationsTab'), icon: Bell },
    { id: 'security', label: t('settings.security'), icon: Shield },
    { id: 'branding', label: t('settings.branding'), icon: Palette },
    { id: 'integrations', label: t('settings.integrations'), icon: Database }
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.settings')}</h1>
          <p className="page-subtitle">{t('settings.subtitle')}</p>
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
              <h3 className="card-title">{t('settings.profileSettings')}</h3>
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
                  <label className="form-label">{t('settings.firstName')}</label>
                  <input type="text" className="form-input" value={profileForm.firstName} onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('settings.lastName')}</label>
                  <input type="text" className="form-input" value={profileForm.lastName} onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.email')}</label>
                  <input type="email" className="form-input" value={profileForm.email} disabled />
                  <small className="form-help">{t('settings.emailCannotChange')}</small>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('common.phone')}</label>
                  <input type="tel" className="form-input" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} />
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={profileLoading}>
                {profileLoading ? t('settings.saving') : t('common.saveChanges')}
              </button>
            </div>
          )}

          {activeTab === 'organization' && (
            <div className="settings-content">
              <h3 className="card-title">{t('settings.organizationSettings')}</h3>
              <div className="form-group">
                <label className="form-label">{t('settings.companyName')}</label>
                <input type="text" className="form-input" value={companySettings.companyName}
                  onChange={(e) => setCompanySettings({...companySettings, companyName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.defaultCurrency')}</label>
                <select 
                  className="form-select" 
                  value={companySettings.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                  <option value="EGP">{t('settings.currency.egp')}</option>
                  <option value="AED">{t('settings.currency.aed')}</option>
                  <option value="USD">{t('settings.currency.usd')}</option>
                  <option value="EUR">{t('settings.currency.eur')}</option>
                  <option value="GBP">{t('settings.currency.gbp')}</option>
                </select>
                <small className="form-help">
                  {t('settings.current')}: {currencyConfig[companySettings.currency]?.symbol} {currencyConfig[companySettings.currency]?.name}
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.timezone')}</label>
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
              <h3 className="card-title">{t('settings.notificationPreferences')}</h3>
              {[
                { key: 'leadAssignments', label: 'تعيينات العملاء الجديدة', desc: 'إشعار عند تعيين عملاء جدد لك' },
                { key: 'reservationExpiring', label: 'انتهاء صلاحية الحجز', desc: 'تنبيه عند اقتراب انتهاء الحجوزات' },
                { key: 'paymentReceived', label: 'استلام دفعة', desc: 'إشعار عند استلام الأقساط' },
                { key: 'contractSigned', label: 'توقيع عقد', desc: 'تنبيه عند توقيع العقود' },
                { key: 'whatsappMessages', label: 'رسائل واتساب', desc: 'إشعارات الرسائل الجديدة' }
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
              <h3 className="card-title">{t('settings.securitySettings')}</h3>
              {passwordError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={20} /> {passwordError}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{t('settings.currentPassword')}</label>
                <input type="password" className="form-input" placeholder="أدخل كلمة المرور الحالية" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">كلمة المرور الجديدة</label>
                <input type="password" className="form-input" placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.confirmPassword')}</label>
                <input type="password" className="form-input" placeholder={t('settings.confirmPassword')} value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
              </div>
              <button className="btn btn-primary" onClick={handleUpdatePassword}>تحديث كلمة المرور</button>

              <div className="security-section">
                <h4 className="security-title">{t('settings.twoFactorAuth')}</h4>
                <p className="security-desc">{t('settings.2faDesc')}</p>
                <button className="btn btn-outline" onClick={() => {
                  setTwoFAEnabled(!twoFAEnabled);
                  alert(twoFAEnabled ? '2FA has been disabled.' : '2FA setup would open here. (Feature requires backend integration)');
                }}>
                  {twoFAEnabled ? 'تعطيل المصادقة الثنائية' : 'تفعيل المصادقة الثنائية'}
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
                    alt={t('settings.companyLogo')} 
                    className="logo-preview" 
                    style={{ maxHeight: '80px', objectFit: 'contain' }}
                  />
                  <div className="logo-upload-actions">
                    <p className="logo-current">{t('settings.currentLogo')}</p>
                    <p className="logo-dimensions">{t('settings.recommendedLogoDimensions')}</p>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.logoUrl')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm({...brandingForm, logoUrl: e.target.value})}
                  placeholder="https://..."
                />
                <small className="form-help">
                  {t('settings.enterLogoUrl')}
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">{t('settings.primaryColor')}</label>
                <div className="color-picker">
                  <input type="color" value={brandingForm.primaryColor} onChange={(e) => setBrandingForm({...brandingForm, primaryColor: e.target.value})} className="color-input" />
                  <span className="color-value">{brandingForm.primaryColor}</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSaveBranding}>{t('settings.saveBranding')}</button>
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
}

export default SettingsPage;