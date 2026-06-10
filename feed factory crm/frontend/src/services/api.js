const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

// Global 401 interceptor - redirect to login on any unauthorized response
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  try {
    const response = await originalFetch(...args);
    if (response.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return response;
  } catch (error) {
    console.error('Network request failed:', args[0], error.message);
    throw error;
  }
};

export const authService = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },
  
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    const data = await response.json();
    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  isAuthenticated: () => !!getAuthToken(),

  changePassword: async (data) => {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

export const dashboardService = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/dashboard`, { headers: headers() });
    return response.json();
  }
};

export const leadsService = {
  getLeads: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/leads?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getLead: async (id) => {
    const response = await fetch(`${API_BASE_URL}/leads/${id}`, { headers: headers() });
    return response.json();
  },
  
  createLead: async (leadData) => {
    const response = await fetch(`${API_BASE_URL}/leads`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(leadData)
    });
    return response.json();
  },
  
  updateLead: async (id, leadData) => {
    const response = await fetch(`${API_BASE_URL}/leads/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(leadData)
    });
    return response.json();
  },
  
  assignLeads: async (data) => {
    const response = await fetch(`${API_BASE_URL}/leads/assign`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/leads/stats`, { headers: headers() });
    return response.json();
  },
  
  getSources: async () => {
    const response = await fetch(`${API_BASE_URL}/leads/sources`, { headers: headers() });
    return response.json();
  }
};

export const inventoryService = {
  getProjects: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/inventory/projects?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getUnits: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/inventory/units?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getUnit: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inventory/units/${id}`, { headers: headers() });
    return response.json();
  },
  
  createUnit: async (unitData) => {
    const response = await fetch(`${API_BASE_URL}/inventory/units`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(unitData)
    });
    return response.json();
  },
  
  updateUnit: async (id, unitData) => {
    const response = await fetch(`${API_BASE_URL}/inventory/units/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(unitData)
    });
    return response.json();
  },
  
  getStats: async (projectId) => {
    const url = projectId ? `${API_BASE_URL}/inventory/units/stats?project=${projectId}` : `${API_BASE_URL}/inventory/units/stats`;
    const response = await fetch(url, { headers: headers() });
    return response.json();
  }
};

export const reservationsService = {
  getReservations: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/reservations?${queryString}`, { headers: headers() });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch reservations');
    }
    return data;
  },
  
  createReservation: async (data) => {
    const response = await fetch(`${API_BASE_URL}/reservations`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create reservation');
    }
    return result;
  },
  
  convertReservation: async (id) => {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}/convert`, {
      method: 'POST',
      headers: headers()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to convert reservation');
    }
    return data;
  },
  
  cancelReservation: async (id, reason) => {
    const response = await fetch(`${API_BASE_URL}/reservations/${id}/cancel`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ reason })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to cancel reservation');
    }
    return data;
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/reservations/stats`, { headers: headers() });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch stats');
    }
    return data;
  }
};

export const contractsService = {
  getContracts: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/contracts?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getContract: async (id) => {
    const response = await fetch(`${API_BASE_URL}/contracts/${id}`, { headers: headers() });
    return response.json();
  },
  
  createContract: async (contractData) => {
    const response = await fetch(`${API_BASE_URL}/contracts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(contractData)
    });
    return response.json();
  },
  
  signContract: async (id) => {
    const response = await fetch(`${API_BASE_URL}/contracts/${id}/sign`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/contracts/stats`, { headers: headers() });
    return response.json();
  }
};

export const installmentsService = {
  getInstallments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/installments?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  payInstallment: async (id, paymentData) => {
    const response = await fetch(`${API_BASE_URL}/installments/${id}/pay`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(paymentData)
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/installments/stats`, { headers: headers() });
    return response.json();
  }
};

export const whatsappService = {
  getConversations: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getConversation: async (id) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${id}`, { headers: headers() });
    return response.json();
  },
  
  sendMessage: async (conversationId, messageData) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(messageData)
    });
    return response.json();
  },
  
  assignConversation: async (conversationId, agentId) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${conversationId}/assign`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ agentId })
    });
    return response.json();
  },

  convertToLead: async (conversationId, leadData) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${conversationId}/convert-to-lead`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(leadData)
    });
    return response.json();
  },

  updateLeadQuality: async (conversationId, qualityData) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${conversationId}/lead-quality`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(qualityData)
    });
    return response.json();
  },

  transferConversation: async (conversationId, transferData) => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/conversations/${conversationId}/transfer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(transferData)
    });
    return response.json();
  },

  getAgents: async () => {
    const response = await fetch(`${API_BASE_URL}/whatsapp/agents`, { headers: headers() });
    return response.json();
  }
};
export const usersService = {
  getUsers: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/users?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, { headers: headers() });
    return response.json();
  },
  
  createUser: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(userData)
    });
    return response.json();
  },
  
  updateUser: async (id, userData) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(userData)
    });
    return response.json();
  },

  deleteUser: async (id) => {
    const response = await fetch(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  }
};

export const organizationService = {
  getHierarchy: async () => {
    const response = await fetch(`${API_BASE_URL}/organization/hierarchy`, { headers: headers() });
    return response.json();
  },
  
  getBranches: async () => {
    const response = await fetch(`${API_BASE_URL}/organization/branches`, { headers: headers() });
    return response.json();
  },
  
  getTeams: async (branchId) => {
    const url = branchId ? `${API_BASE_URL}/organization/teams?branch=${branchId}` : `${API_BASE_URL}/organization/teams`;
    const response = await fetch(url, { headers: headers() });
    return response.json();
  }
};

export const hrService = {
  getEmployees: async () => {
    const response = await fetch(`${API_BASE_URL}/hr/employees`, { headers: headers() });
    return response.json();
  },

  getAllEmployees: async () => {
    const response = await fetch(`${API_BASE_URL}/hr/employees`, { headers: headers() });
    return response.json();
  },
  
  getEmployee: async (id) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${id}`, { headers: headers() });
    return response.json();
  },
  
  createEmployee: async (data) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getAttendance: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/hr/attendance?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  checkIn: async (data) => {
    const response = await fetch(`${API_BASE_URL}/hr/attendance`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getLeaves: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/hr/leaves?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  applyLeave: async (data) => {
    const response = await fetch(`${API_BASE_URL}/hr/leaves`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  approveLeave: async (id) => {
    const response = await fetch(`${API_BASE_URL}/hr/leaves/${id}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  rejectLeave: async (id) => {
    const response = await fetch(`${API_BASE_URL}/hr/leaves/${id}/reject`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  checkOut: async (data) => {
    const response = await fetch(`${API_BASE_URL}/hr/attendance/checkout`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getPayroll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/hr/payroll?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getPerformance: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/hr/performance?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  // Employee document management
  updateEmployee: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  uploadDocument: async (employeeId, docData) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${employeeId}/documents`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(docData)
    });
    return response.json();
  },

  uploadDocumentFile: async (employeeId, file, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.name) formData.append('name', metadata.name);
    if (metadata.type) formData.append('type', metadata.type);
    if (metadata.expiryDate) formData.append('expiryDate', metadata.expiryDate);
    if (metadata.notes) formData.append('notes', metadata.notes);
    const response = await fetch(`${API_BASE_URL}/hr/employees/${employeeId}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      body: formData
    });
    return response.json();
  },

  downloadDocument: async (employeeId, docId) => {
    return `${API_BASE_URL}/hr/employees/${employeeId}/documents/${docId}/download`;
  },
  
  getDocuments: async (employeeId) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${employeeId}/documents`, { headers: headers() });
    return response.json();
  },
  
  deleteDocument: async (employeeId, docId) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${employeeId}/documents/${docId}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  verifyDocument: async (employeeId, docId, status, notes) => {
    const response = await fetch(`${API_BASE_URL}/hr/employees/${employeeId}/documents/${docId}/verify`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status, notes })
    });
    return response.json();
  }
};

// Employee Rating Service - Comprehensive rating system
export const employeeRatingService = {
  // Get all ratings for an employee
  getEmployeeRatings: async (employeeId) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/${employeeId}/ratings`, { 
      headers: headers() 
    });
    return response.json();
  },
  
  // Create new rating for an employee
  createRating: async (employeeId, ratingData) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/${employeeId}/ratings`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(ratingData)
    });
    return response.json();
  },
  
  // Update existing rating
  updateRating: async (employeeId, ratingId, ratingData) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/${employeeId}/ratings/${ratingId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(ratingData)
    });
    return response.json();
  },
  
  // Delete rating
  deleteRating: async (employeeId, ratingId) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/${employeeId}/ratings/${ratingId}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  // Get current rating for an employee
  getCurrentRating: async (employeeId) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/${employeeId}/ratings/current`, { 
      headers: headers() 
    });
    return response.json();
  },
  
  // Get leaderboard
  getLeaderboard: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/ratings/leaderboard?${queryString}`, { 
      headers: headers() 
    });
    return response.json();
  },
  
  // Get sales statistics
  getSalesStats: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/ratings/sales-stats?${queryString}`, { 
      headers: headers() 
    });
    return response.json();
  },
  
  // Calculate sales metrics from orders
  calculateSalesMetrics: async (employeeId, period, periodStart, periodEnd) => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/ratings/calculate-sales`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ employeeId, period, periodStart, periodEnd })
    });
    return response.json();
  },
  
  // Update all employee ranks
  updateRanks: async () => {
    const response = await fetch(`${API_BASE_URL}/employee-ratings/employees/ratings/update-ranks`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  }
};

export const financeService = {
  getDashboard: async () => {
    const response = await fetch(`${API_BASE_URL}/finance/dashboard`, { headers: headers() });
    return response.json();
  },
  
  getInvoices: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/invoices?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createInvoice: async (data) => {
    const response = await fetch(`${API_BASE_URL}/finance/invoices`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateInvoice: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/finance/invoices/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getExpenses: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/expenses?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createExpense: async (data) => {
    const response = await fetch(`${API_BASE_URL}/finance/expenses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  approveExpense: async (id) => {
    const response = await fetch(`${API_BASE_URL}/finance/expenses/${id}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  rejectExpense: async (id, reason) => {
    const response = await fetch(`${API_BASE_URL}/finance/expenses/${id}/reject`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ reason })
    });
    return response.json();
  },

  updateExpense: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/finance/expenses/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getAccounts: async () => {
    const response = await fetch(`${API_BASE_URL}/finance/accounts`, { headers: headers() });
    return response.json();
  },
  
  createAccount: async (data) => {
    const response = await fetch(`${API_BASE_URL}/finance/accounts`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getInstallments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/installments?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  payInstallment: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/finance/installments/${id}/pay`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  getReminders: async () => {
    const response = await fetch(`${API_BASE_URL}/finance/reminders`, { headers: headers() });
    return response.json();
  },
  
  // Invoices
  getInvoice: async (id) => {
    const response = await fetch(`${API_BASE_URL}/finance/invoices/${id}`, { headers: headers() });
    return response.json();
  },
  
  payInvoice: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/finance/invoices/${id}/pay`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // Payments
  getPayments: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/payments?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createPayment: async (data) => {
    const response = await fetch(`${API_BASE_URL}/finance/payments`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getPaymentStats: async () => {
    const response = await fetch(`${API_BASE_URL}/finance/payments/stats`, { headers: headers() });
    return response.json();
  },
  
  // Receivables
  getReceivables: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/receivables?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  // Client Account
  getClientAccount: async (clientId) => {
    const response = await fetch(`${API_BASE_URL}/finance/clients/${clientId}/account`, { headers: headers() });
    return response.json();
  },

  // Send reminder for receivable
  sendReceivableReminder: async (clientId, data) => {
    const response = await fetch(`${API_BASE_URL}/finance/clients/${clientId}/send-reminder`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  }
};

export const journalService = {
  getJournalEntries: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/finance/journal-entries?${queryString}`, { headers: headers() });
    return response.json();
  },

  createJournalEntry: async (data) => {
    const response = await fetch(`${API_BASE_URL}/finance/journal-entries`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  deleteJournalEntry: async (id) => {
    const response = await fetch(`${API_BASE_URL}/finance/journal-entries/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  }
};

export const leadActivityService = {
  getLeadActivities: async (leadId) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/activities`, { headers: headers() });
    return response.json();
  },
  
  addLeadActivity: async (leadId, data) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/activities`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getLeadNotes: async (leadId) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes`, { headers: headers() });
    return response.json();
  },
  
  addLeadNote: async (leadId, data) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getLeadFollowUps: async (leadId) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/followups`, { headers: headers() });
    return response.json();
  },
  
  addLeadFollowUp: async (leadId, data) => {
    const response = await fetch(`${API_BASE_URL}/leads/${leadId}/followups`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  completeFollowUp: async (id) => {
    const response = await fetch(`${API_BASE_URL}/leads/followups/${id}/complete`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  }
};

export const partnersService = {
  getPartners: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/partners?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getPartner: async (id) => {
    const response = await fetch(`${API_BASE_URL}/partners/${id}`, { headers: headers() });
    return response.json();
  },
  
  createPartner: async (partnerData) => {
    const response = await fetch(`${API_BASE_URL}/partners`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(partnerData)
    });
    return response.json();
  },
  
  updatePartner: async (id, partnerData) => {
    const response = await fetch(`${API_BASE_URL}/partners/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(partnerData)
    });
    return response.json();
  }
};

// Feed Factory CRM - Clients API
export const clientsService = {
  getClients: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/clients?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getClient: async (id) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, { headers: headers() });
    return response.json();
  },
  
  createClient: async (clientData) => {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(clientData)
    });
    return response.json();
  },
  
  updateClient: async (id, clientData) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(clientData)
    });
    return response.json();
  },
  
  deleteClient: async (id) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getClientOrders: async (id) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/orders`, { headers: headers() });
    return response.json();
  },
  
  getClientInvoices: async (id) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/invoices`, { headers: headers() });
    return response.json();
  },
  
  getClientAccount: async (id) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/account`, { headers: headers() });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/clients/stats`, { headers: headers() });
    return response.json();
  },
  
  uploadDocument: async (clientId, docData) => {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(docData)
    });
    return response.json();
  },
  
  getDocuments: async (clientId) => {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, { headers: headers() });
    return response.json();
  },
  
  // Overdue clients
  getOverdueClients: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/clients/overdue?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  // Admin notifications
  getNotifications: async () => {
    const response = await fetch(`${API_BASE_URL}/clients/notifications`, { headers: headers() });
    return response.json();
  },
  
  // Override client block
  overrideBlock: async (id, override, reason) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/override-block`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ override, reason })
    });
    return response.json();
  },
  
  // Update credit settings
  updateCreditSettings: async (id, creditLimit, blockingThreshold) => {
    const response = await fetch(`${API_BASE_URL}/clients/${id}/credit-settings`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ creditLimit, blockingThreshold })
    });
    return response.json();
  },
  
  // Client Payment Collection - Sales Rep feature
  clientPayment: {
    getSummary: async (clientId) => {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/payment-summary`, { headers: headers() });
      return response.json();
    },
    
    recordPayment: async (clientId, paymentData) => {
      const response = await fetch(`${API_BASE_URL}/clients/${clientId}/record-payment`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(paymentData)
      });
      return response.json();
    }
  }
};

// Feed Types API
export const feedTypesService = {
  getFeedTypes: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/feed-types?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getFeedType: async (id) => {
    const response = await fetch(`${API_BASE_URL}/feed-types/${id}`, { headers: headers() });
    return response.json();
  },
  
  createFeedType: async (data) => {
    const response = await fetch(`${API_BASE_URL}/feed-types`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateFeedType: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/feed-types/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  deleteFeedType: async (id) => {
    const response = await fetch(`${API_BASE_URL}/feed-types/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/feed-types/stats`, { headers: headers() });
    return response.json();
  }
};

// Sales Orders API
export const ordersService = {
  getOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/orders?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getOrder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, { headers: headers() });
    return response.json();
  },
  
  createOrder: async (orderData) => {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(orderData)
    });
    return response.json();
  },
  
  updateOrderStatus: async (id, status) => {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/status`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    return response.json();
  },
  
  generateInvoice: async (id) => {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/invoice`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },
  
  getInvoicePDF: async (id) => {
    const response = await fetch(`${API_BASE_URL}/orders/${id}/invoice/pdf`, { headers: headers() });
    return response.text();
  },
  
  deleteOrder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/orders/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/orders/stats`, { headers: headers() });
    return response.json();
  },
  
  getPendingDelivery: async () => {
    const response = await fetch(`${API_BASE_URL}/orders/pending/delivery`, { headers: headers() });
    return response.json();
  }
};

// Feed Factory - Inventory API
export const feedInventoryService = {
  // Raw Materials
  getRawMaterials: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getRawMaterial: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials/${id}`, { headers: headers() });
    return response.json();
  },
  
  createRawMaterial: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateRawMaterial: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  addRawMaterialStock: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials/${id}/add-stock`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  useRawMaterial: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials/${id}/use`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getRawMaterialStats: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/raw-materials/stats`, { headers: headers() });
    return response.json();
  },
  
  // Finished Goods
  getFinishedGoods: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/inventory/finished-goods?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  addFinishedGood: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/finished-goods`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  reserveFinishedGood: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/finished-goods/${id}/reserve`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  deliverFinishedGood: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/finished-goods/${id}/deliver`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getFinishedGoodsStats: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/finished-goods/stats`, { headers: headers() });
    return response.json();
  },
  
  // Production Orders
  getProductionOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/inventory/production?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getProductionOrder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inventory/production/${id}`, { headers: headers() });
    return response.json();
  },
  
  createProductionOrder: async (data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/production`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  startProduction: async (id) => {
    const response = await fetch(`${API_BASE_URL}/inventory/production/${id}/start`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  completeProduction: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/production/${id}/complete`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  cancelProduction: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/inventory/production/${id}/cancel`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getProductionStats: async () => {
    const response = await fetch(`${API_BASE_URL}/inventory/production/stats`, { headers: headers() });
    return response.json();
  }
};

// Feed Factory - Delivery API
export const deliveryService = {
  // Vehicles
  getVehicles: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/delivery/vehicles?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createVehicle: async (data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/vehicles`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateVehicle: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/vehicles/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getVehicleStats: async () => {
    const response = await fetch(`${API_BASE_URL}/delivery/vehicles/stats`, { headers: headers() });
    return response.json();
  },
  
  // Deliveries
  getDeliveries: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/delivery?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getDelivery: async (id) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}`, { headers: headers() });
    return response.json();
  },
  
  createDelivery: async (data) => {
    const response = await fetch(`${API_BASE_URL}/delivery`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  assignDelivery: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/assign`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  dispatchDelivery: async (id) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/dispatch`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  inTransitDelivery: async (id) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/in-transit`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  completeDelivery: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/delivered`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  partialDelivery: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/partial`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  cancelDelivery: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/delivery/${id}/cancel`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getDeliveryStats: async () => {
    const response = await fetch(`${API_BASE_URL}/delivery/stats`, { headers: headers() });
    return response.json();
  },
  
  getPendingDeliveries: async () => {
    const response = await fetch(`${API_BASE_URL}/delivery/pending`, { headers: headers() });
    return response.json();
  }
};

// Feed Factory - Assets API
export const assetsService = {
  // Machines
  getMachines: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/assets/machines?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getMachine: async (id) => {
    const response = await fetch(`${API_BASE_URL}/assets/machines/${id}`, { headers: headers() });
    return response.json();
  },
  
  createMachine: async (data) => {
    const response = await fetch(`${API_BASE_URL}/assets/machines`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateMachine: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/assets/machines/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getMachineStats: async () => {
    const response = await fetch(`${API_BASE_URL}/assets/machines/stats`, { headers: headers() });
    return response.json();
  },
  
  // Maintenance Records
  getMaintenance: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/assets/maintenance?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createMaintenance: async (data) => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateMaintenanceStatus: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance/${id}/status`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  startMaintenance: async (id) => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance/${id}/start`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  completeMaintenance: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance/${id}/complete`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  cancelMaintenance: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance/${id}/cancel`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  getMaintenanceStats: async () => {
    const response = await fetch(`${API_BASE_URL}/assets/maintenance/stats`, { headers: headers() });
    return response.json();
  }
};

// Payroll API Service - HR-Finance Integration
export const payrollService = {
  // Get all payroll periods
  getPayrolls: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/payroll?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  // Get single payroll by ID
  getPayroll: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}`, { headers: headers() });
    return response.json();
  },
  
  // Create new payroll period
  createPayroll: async (data) => {
    const response = await fetch(`${API_BASE_URL}/payroll`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // Update payroll
  updatePayroll: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  // Delete payroll
  deletePayroll: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  // Process payroll (calculate all salaries)
  processPayroll: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/process`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  // Approve payroll
  approvePayroll: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  // Post payroll to finance (create expense & payable)
  postToFinance: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/post`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  // Get payroll summary for posting
  getSummary: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/summary`, { headers: headers() });
    return response.json();
  },

  // Mark payroll as paid
  markAsPaid: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/mark-as-paid`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  // Owner/Admin: Full approval (process + approve + post to finance) in one step
  approveAllPayroll: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payroll/${id}/approve-all`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  }
};

// Suppliers API Service
export const suppliersService = {
  getSuppliers: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/suppliers?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getSupplier: async (id) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, { headers: headers() });
    return response.json();
  },
  
  createSupplier: async (data) => {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updateSupplier: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  deleteSupplier: async (id) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getSupplierStats: async () => {
    const response = await fetch(`${API_BASE_URL}/suppliers/stats`, { headers: headers() });
    return response.json();
  },
  
  // Update supplier performance metrics
  updatePerformance: async (id, performanceData) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}/performance`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(performanceData)
    });
    return response.json();
  },
  
  // Link supplier to material
  linkMaterial: async (id, materialId) => {
    const response = await fetch(`${API_BASE_URL}/suppliers/${id}/materials`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ materialId })
    });
    return response.json();
  }
};

// Purchase Orders API Service
export const purchaseOrdersService = {
  getPurchaseOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/purchase-orders?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getPurchaseOrder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, { headers: headers() });
    return response.json();
  },
  
  createPurchaseOrder: async (data) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updatePurchaseOrder: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  approve: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  reject: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}/reject`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  updateStatus: async (id, status) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}/status`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    return response.json();
  },
  
  deletePurchaseOrder: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/stats`, { headers: headers() });
    return response.json();
  },
  
  // Send PO to supplier via WhatsApp
  sendWhatsApp: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}/send-whatsapp`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },
  
  // Generate PO PDF
  generatePDF: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}/pdf`, { headers: headers() });
    return response.blob();
  }
};

// Purchase Requisitions API Service
export const purchaseRequisitionsService = {
  getPurchaseRequisitions: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getPurchaseRequisition: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/${id}`, { headers: headers() });
    return response.json();
  },
  
  createPurchaseRequisition: async (data) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updatePurchaseRequisition: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  approveRequisition: async (id, approvalData) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/${id}/approve`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(approvalData)
    });
    return response.json();
  },
  
  rejectRequisition: async (id, reason) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/${id}/reject`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ reason })
    });
    return response.json();
  },
  
  deletePurchaseRequisition: async (id) => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/purchase-requisitions/stats`, { headers: headers() });
    return response.json();
  }
};

// Payables API Service
export const payablesService = {
  getPayables: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/payables?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  getPayable: async (id) => {
    const response = await fetch(`${API_BASE_URL}/payables/${id}`, { headers: headers() });
    return response.json();
  },
  
  createPayable: async (data) => {
    const response = await fetch(`${API_BASE_URL}/payables`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  updatePayable: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/payables/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },
  
  recordPayment: async (id, paymentData) => {
    const response = await fetch(`${API_BASE_URL}/payables/${id}/pay`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(paymentData)
    });
    return response.json();
  },
  
  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/payables/stats`, { headers: headers() });
    return response.json();
  }
};

// Notifications API Service
export const notificationsService = {
  getNotifications: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/notifications?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  markAsRead: async (id) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  markAllAsRead: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  deleteNotification: async (id) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  getUnreadCount: async () => {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, { headers: headers() });
    return response.json();
  }
};

// ============================================
// NEW SALES MODULE API SERVICE
// Complete sales functionality with role-based access
// ============================================

export const salesService = {
  // Client Assignment & Management
  getMyClients: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/my-clients`, { headers: headers() });
    return response.json();
  },
  
  getUnassignedClients: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/unassigned-clients`, { headers: headers() });
    return response.json();
  },
  
  assignClient: async (clientId, salesRepId) => {
    const response = await fetch(`${API_BASE_URL}/sales/clients/${clientId}/assign`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ salesRepId })
    });
    return response.json();
  },
  
  unassignClient: async (clientId) => {
    const response = await fetch(`${API_BASE_URL}/sales/clients/${clientId}/unassign`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },
  
  getSalesReps: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/sales-reps`, { headers: headers() });
    return response.json();
  },
  
  getClientFullDetails: async (clientId) => {
    const response = await fetch(`${API_BASE_URL}/sales/clients/${clientId}/full`, { headers: headers() });
    return response.json();
  },
  
  // Orders
  getOrders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/sales/orders?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createOrder: async (orderData) => {
    const response = await fetch(`${API_BASE_URL}/sales/orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(orderData)
    });
    return response.json();
  },
  
  approveOrder: async (orderId) => {
    const response = await fetch(`${API_BASE_URL}/sales/orders/${orderId}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  rejectOrder: async (orderId, reason) => {
    const response = await fetch(`${API_BASE_URL}/sales/orders/${orderId}/reject`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ reason })
    });
    return response.json();
  },
  
  getOrderItems: async (orderId) => {
    const response = await fetch(`${API_BASE_URL}/sales/orders/${orderId}/items`, { headers: headers() });
    return response.json();
  },

  updateOrderStatus: async (orderId, status) => {
    const response = await fetch(`${API_BASE_URL}/sales/orders/${orderId}/status`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    return response.json();
  },
  
  // Invoices
  getInvoices: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/sales/invoices?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createInvoice: async (invoiceData) => {
    const response = await fetch(`${API_BASE_URL}/sales/invoices`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(invoiceData)
    });
    return response.json();
  },
  
  // Payments
  recordPayment: async (paymentData) => {
    const response = await fetch(`${API_BASE_URL}/sales/payments`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(paymentData)
    });
    return response.json();
  },
  
  getClientPayments: async (clientId) => {
    const response = await fetch(`${API_BASE_URL}/sales/clients/${clientId}/payments`, { headers: headers() });
    return response.json();
  },
  
  // Reminders
  getReminders: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/sales/reminders?${queryString}`, { headers: headers() });
    return response.json();
  },
  
  createReminder: async (reminderData) => {
    const response = await fetch(`${API_BASE_URL}/sales/reminders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(reminderData)
    });
    return response.json();
  },
  
  updateReminder: async (reminderId, reminderData) => {
    const response = await fetch(`${API_BASE_URL}/sales/reminders/${reminderId}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(reminderData)
    });
    return response.json();
  },
  
  completeReminder: async (reminderId) => {
    const response = await fetch(`${API_BASE_URL}/sales/reminders/${reminderId}/complete`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  sendReminder: async (reminderId) => {
    const response = await fetch(`${API_BASE_URL}/sales/reminders/${reminderId}/send`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },
  
  deleteReminder: async (reminderId) => {
    const response = await fetch(`${API_BASE_URL}/sales/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  },
  
  // Dashboard & Statistics
  getDashboardStats: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/dashboard-stats`, { headers: headers() });
    return response.json();
  },

  getPerformanceByRep: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/performance-by-rep`, { headers: headers() });
    return response.json();
  },

  // Red Flags
  getRedFlags: async () => {
    const response = await fetch(`${API_BASE_URL}/sales/red-flags`, { headers: headers() });
    return response.json();
  },

  // Client Ordering Patterns
  getClientPatterns: async (clientId) => {
    const url = clientId
      ? `${API_BASE_URL}/sales/client-patterns/${clientId}`
      : `${API_BASE_URL}/sales/client-patterns`;
    const response = await fetch(url, { headers: headers() });
    return response.json();
  },

  // Manager Filtered Clients
  getFilteredClients: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/sales/clients-filtered?${queryString}`, { headers: headers() });
    return response.json();
  }
};

// GRN API Service
export const grnService = {
  getEligiblePOs: async () => {
    const response = await fetch(`${API_BASE_URL}/grn/eligible-pos`, { headers: headers() });
    return response.json();
  },

  getGRNs: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${API_BASE_URL}/grn?${queryString}`, { headers: headers() });
    return response.json();
  },

  getGRN: async (id) => {
    const response = await fetch(`${API_BASE_URL}/grn/${id}`, { headers: headers() });
    return response.json();
  },

  createGRN: async (data) => {
    const response = await fetch(`${API_BASE_URL}/grn`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  inspectGRN: async (id, data) => {
    const response = await fetch(`${API_BASE_URL}/grn/${id}/inspect`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  },

  approveGRN: async (id) => {
    const response = await fetch(`${API_BASE_URL}/grn/${id}/approve`, {
      method: 'PUT',
      headers: headers()
    });
    return response.json();
  },

  getStats: async () => {
    const response = await fetch(`${API_BASE_URL}/grn/stats/overview`, { headers: headers() });
    return response.json();
  }
};

// Documents API Service
export const documentService = {
  upload: async (entityType, entityId, file, description = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const response = await fetch(`${API_BASE_URL}/documents/upload/${entityType}/${entityId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    return response.json();
  },

  getByEntity: async (entityType, entityId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${entityType}/${entityId}`, { headers: headers() });
    return response.json();
  },

  download: (documentId) => {
    return `${API_BASE_URL}/documents/download/${documentId}`;
  },

  delete: async (documentId) => {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'DELETE',
      headers: headers()
    });
    return response.json();
  }
};

// Requisitions API Service
export const requisitionService = {
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}/requisitions`, { headers: headers() });
    return response.json();
  },

  preview: async () => {
    const response = await fetch(`${API_BASE_URL}/requisitions/preview`, { headers: headers() });
    return response.json();
  },

  generate: async () => {
    const response = await fetch(`${API_BASE_URL}/requisitions/generate`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },

  getById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/requisitions/${id}`, { headers: headers() });
    return response.json();
  },

  sendToSuppliers: async (id) => {
    const response = await fetch(`${API_BASE_URL}/requisitions/${id}/send`, {
      method: 'POST',
      headers: headers()
    });
    return response.json();
  },

  updateStatus: async (id, status) => {
    const response = await fetch(`${API_BASE_URL}/requisitions/${id}/status`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    return response.json();
  },

  transfer: async (data) => {
    const response = await fetch(`${API_BASE_URL}/requisitions/transfer`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    return response.json();
  }
};