// PostgreSQL API Service for Al Kheir Feed Factory
// All endpoints use /api/ base (no /api/v2/)

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_URL = `${API_BASE_URL}/api`;

const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json();
};

// Feed Recipes & Types
export const FeedRecipeService = {
  // Get all feed types
  getFeedTypes: () => 
    fetch(`${API_URL}/feed-recipes/feed-types`, { headers: headers() })
      .then(handleResponse),

  // Get feed type with pricing
  getFeedTypeWithPricing: (id) => 
    fetch(`${API_URL}/feed-recipes/feed-types/${id}/pricing`, { headers: headers() })
      .then(handleResponse),

  // Get all recipes
  getRecipes: () => 
    fetch(`${API_URL}/feed-recipes/recipes`, { headers: headers() })
      .then(handleResponse),

  // Get single recipe with ingredients
  getRecipe: (id) => 
    fetch(`${API_URL}/feed-recipes/recipes/${id}`, { headers: headers() })
      .then(handleResponse),

  // Get recipe by feed type
  getRecipeByFeedType: (feedTypeId) => 
    fetch(`${API_URL}/feed-recipes/recipes/by-feed-type/${feedTypeId}`, { headers: headers() })
      .then(handleResponse),

  // Get pricing summary
  getPricingSummary: () => 
    fetch(`${API_URL}/feed-recipes/pricing-summary`, { headers: headers() })
      .then(handleResponse),

  // Create recipe
  createRecipe: (data) => 
    fetch(`${API_URL}/feed-recipes/recipes`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Update recipe
  updateRecipe: (id, data) => 
    fetch(`${API_URL}/feed-recipes/recipes/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Toggle recipe status
  toggleRecipeStatus: (id, status) => 
    fetch(`${API_URL}/feed-recipes/recipes/${id}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status })
    }).then(handleResponse)
};

// Inventory & Raw Materials
export const InventoryService = {
  // Get all raw materials
  getRawMaterials: () => 
    fetch(`${API_URL}/inventory/raw-materials`, { headers: headers() })
      .then(handleResponse),

  // Get low stock materials
  getLowStockMaterials: () => 
    fetch(`${API_URL}/inventory/raw-materials/low-stock`, { headers: headers() })
      .then(handleResponse),

  // Get single material
  getMaterial: (id) => 
    fetch(`${API_URL}/inventory/raw-materials/${id}`, { headers: headers() })
      .then(handleResponse),

  // Update stock (purchase or adjustment)
  updateStock: (id, data) => 
    fetch(`${API_URL}/inventory/raw-materials/${id}/stock`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Get inventory dashboard stats
  getDashboardStats: () => 
    fetch(`${API_URL}/inventory/dashboard`, { headers: headers() })
      .then(handleResponse),

  // Get material categories
  getCategories: () => 
    fetch(`${API_URL}/inventory/categories`, { headers: headers() })
      .then(handleResponse)
};

// Production Orders
export const ProductionService = {
  // Get all production orders
  getProductionOrders: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/production/production-orders?${queryString}`, { headers: headers() })
      .then(handleResponse);
  },

  // Get single production order
  getProductionOrder: (id) => 
    fetch(`${API_URL}/production/production-orders/${id}`, { headers: headers() })
      .then(handleResponse),

  // Create production order
  createProductionOrder: (data) => 
    fetch(`${API_URL}/production/production-orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Approve production order
  approveProductionOrder: (id, approvedBy) => 
    fetch(`${API_URL}/production/production-orders/${id}/approve`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ approved_by: approvedBy })
    }).then(handleResponse),

  // Complete production order (deducts stock)
  completeProductionOrder: (id, data) => 
    fetch(`${API_URL}/production/production-orders/${id}/complete`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Cancel production order
  cancelProductionOrder: (id, reason) => 
    fetch(`${API_URL}/production/production-orders/${id}/cancel`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ reason })
    }).then(handleResponse),

  // Get production stats
  getStats: () => 
    fetch(`${API_URL}/production/stats`, { headers: headers() })
      .then(handleResponse)
};

// Clients
export const ClientService = {
  // Get all clients
  getClients: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return fetch(`${API_URL}/clients/clients?${queryString}`, { headers: headers() })
      .then(handleResponse);
  },

  // Get single client
  getClient: (id) => 
    fetch(`${API_URL}/clients/clients/${id}`, { headers: headers() })
      .then(handleResponse),

  // Get client statement
  getClientStatement: (id, fromDate, toDate) => {
    const params = new URLSearchParams();
    if (fromDate) params.append('from_date', fromDate);
    if (toDate) params.append('to_date', toDate);
    return fetch(`${API_URL}/clients/clients/${id}/statement?${params}`, { headers: headers() })
      .then(handleResponse);
  },

  // Record payment
  recordPayment: (id, data) => 
    fetch(`${API_URL}/clients/clients/${id}/payments`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    }).then(handleResponse),

  // Get dashboard stats
  getDashboardStats: () => 
    fetch(`${API_URL}/clients/dashboard`, { headers: headers() })
      .then(handleResponse),

  // Get client types
  getClientTypes: () => 
    fetch(`${API_URL}/clients/types`, { headers: headers() })
      .then(handleResponse)
};

// Dashboard
export const DashboardService = {
  // Get all dashboard data
  getAllStats: async () => {
    const [inventory, production, clients] = await Promise.all([
      InventoryService.getDashboardStats(),
      ProductionService.getStats(),
      ClientService.getDashboardStats()
    ]);
    
    return {
      inventory,
      production,
      clients
    };
  }
};

export default {
  FeedRecipeService,
  InventoryService,
  ProductionService,
  ClientService,
  DashboardService
};
