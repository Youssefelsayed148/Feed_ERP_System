import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t, getLang } from '../utils/i18n';
import { 
  Plus, Search, Eye, Edit2, Copy, Printer, Check, X, 
  Calculator, AlertCircle, ArrowLeft, ChefHat, Package,
  TrendingUp, TrendingDown, DollarSign, BarChart3
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_URL = `${API_BASE_URL}/feed-recipes`;
const INVENTORY_API_URL = `${API_BASE_URL}/inventory`;
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export default function FeedRecipes() {
  const [recipes, setRecipes] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'detail', 'edit', 'create'
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'create', 'edit', 'detail'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    feedTypeId: '',
    version: '1.0',
    status: 'active',
    ingredients: [],
    sellingPrice: '',
    protein: '',
    energy: '',
    fiber: '',
    notes: ''
  });

  // Production calculator state
  const [batchSize, setBatchSize] = useState(1000);
  const [calculatedMaterials, setCalculatedMaterials] = useState([]);
  const [inventoryCheck, setInventoryCheck] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    try {
      // Check if user is logged in
      const token = getAuthToken();
      if (!token) {
        setError('Please login to view data');
        setLoading(false);
        return;
      }

      // Fetch recipes from PostgreSQL
      const recipesRes = await fetch(`${API_URL}/recipes`, { headers: headers() });
      
      if (!recipesRes.ok) {
        const errorText = await recipesRes.text();
        
        // Handle 401 - Token expired or invalid
        if (recipesRes.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
        
        throw new Error(`Failed to fetch recipes: ${recipesRes.status}`);
      }
      
      // Parse response
      const responseText = await recipesRes.text();
      
      // Try to parse as JSON
      let recipesData;
      try {
        recipesData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Server returned invalid JSON. Make sure backend is running on port 5000.`);
      }
      
      // Handle both PostgreSQL (array) and legacy (object with success/data) formats
      const recipesArray = Array.isArray(recipesData) ? recipesData : recipesData?.data || [];
      if (recipesArray.length > 0) {
        // Map API fields to frontend expected format
        const mapped = recipesArray.map(r => ({
          _id: r.id,
          id: r.id,
          name: r.name || '',
          feedType: {
            _id: r.feed_type_id,
            id: r.feed_type_id,
            name: r.feed_name_english || r.feed_name_arabic || '',
            nameArabic: r.feed_name_arabic || '',
            code: r.feed_code || '',
            protein: r.protein_percentage || ''
          },
          feed_type_id: r.feed_type_id,
          version: r.version || '1.0',
          status: r.is_active ? 'active' : 'inactive',
          is_active: r.is_active,
          batchSize: parseFloat(r.total_quantity_kg || 0),
          total_quantity_kg: r.total_quantity_kg,
          totalCost: parseFloat(r.total_cost || 0),
          total_cost: r.total_cost,
          costPerKg: parseFloat(r.total_quantity_kg) > 0 ? parseFloat(r.total_cost || 0) / parseFloat(r.total_quantity_kg) : 0,
          sellPerTon: r.pricing?.sell_per_ton ? parseFloat(r.pricing.sell_per_ton) : 0,
          costPerTon: r.pricing?.cost_per_ton ? parseFloat(r.pricing.cost_per_ton) : 0,
          protein: r.protein_percentage || '',
          ingredients: [],
          ingredientCount: parseInt(r.ingredient_count || 0),
          usageCount: r.usage_count || 0
        }));
        setRecipes(mapped);
      } else {
        setRecipes([]);
      }

      // Fetch feed types
      const feedTypesRes = await fetch(`${API_URL}/feed-types`, { headers: headers() });
      
      if (!feedTypesRes.ok) {
        throw new Error(`Failed to fetch feed types: ${feedTypesRes.status}`);
      }
      
      const feedTypesData = await feedTypesRes.json();
      
      // Handle both array and object responses
      const feedTypesArray = Array.isArray(feedTypesData) ? feedTypesData : feedTypesData?.data || [];
      if (feedTypesArray.length > 0) {
        // Map API fields (id, name_english, name_arabic, protein_percentage) to frontend (id, name, nameArabic, protein)
        const mapped = feedTypesArray.map(ft => ({
          _id: ft.id,
          id: ft.id,
          name: ft.name_english || ft.name || '',
          nameArabic: ft.name_arabic || ft.nameArabic || '',
          name_english: ft.name_english,
          name_arabic: ft.name_arabic,
          code: ft.code,
          protein: ft.protein_percentage || ft.protein || '',
          protein_percentage: ft.protein_percentage,
          category: ft.category,
          sub_category: ft.sub_category
        }));
        setFeedTypes(mapped);
      } else {
        setFeedTypes([]);
      }

      // Fetch raw materials from PostgreSQL
      const materialsRes = await fetch(`${INVENTORY_API_URL}/raw-materials`, { headers: headers() });
      const materialsData = await materialsRes.json();
      
      // Handle both PostgreSQL (array) and legacy formats
      const materials = Array.isArray(materialsData) ? materialsData : materialsData?.materials || materialsData?.data?.materials || [];
      if (materials.length > 0) {
        // Map API fields (id, name_arabic, name_english, cost_per_unit) to frontend (_id, name, nameArabic, costPerUnit)
        const mapped = materials.map(m => ({
          _id: m.id,
          id: m.id,
          name: m.name_english || m.name_arabic || m.name || '',
          nameArabic: m.name_arabic || '',
          nameEnglish: m.name_english || '',
          name_arabic: m.name_arabic,
          name_english: m.name_english,
          unit: m.unit || 'kg',
          costPerUnit: parseFloat(m.unit_price || m.cost_per_unit || m.costPerUnit || 0),
          cost_per_unit: m.cost_per_unit || m.unit_price,
          unit_price: m.unit_price,
          quantity: parseFloat(m.current_stock || m.quantity || m.stock_quantity || 0),
          current_stock: m.current_stock,
          category: m.category
        }));
        setRawMaterials(mapped);
      } else {
        setRawMaterials([]);
      }

    } catch (error) {
      
      // Don't show error for 401 (we already redirected)
      if (error.message.includes('401')) {
        return;
      }
      
      setError(`Error loading data: ${error.message}. Please check if the backend server is running on port 5000.`);
      // Don't use demo data - show empty state
      setRecipes([]);
      setFeedTypes([]);
      setRawMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  const getStats = () => {
    const total = recipes.length;
    const active = recipes.filter(r => r.status === 'active').length;
    const avgCost = total > 0 ? recipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / total : 0;
    const mostUsed = recipes.reduce((max, r) => (r.usageCount || 0) > (max?.usageCount || 0) ? r : max, recipes[0]);
    return { total, active, avgCost, mostUsed };
  };

  const getFilteredRecipes = () => {
    return recipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          recipe.feedType?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || recipe.feedType?._id === filterType;
      const matchesStatus = filterStatus === 'all' || recipe.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  };

  const getMaterialName = (materialId) => {
    const material = rawMaterials.find(m => m._id === materialId);
    return material?.name || materialId;
  };

  const getMaterialNameArabic = (materialId) => {
    const material = rawMaterials.find(m => m._id === materialId);
    return material?.nameArabic || '';
  };

  const getIngredientDisplayName = (ing) => {
    if (ing.name && ing.nameArabic) {
      return `${ing.name} (${ing.nameArabic})`;
    }
    const material = rawMaterials.find(m => m._id === ing.materialId);
    if (material?.name && material?.nameArabic) {
      return `${material.name} (${material.nameArabic})`;
    }
    return ing.name || getMaterialName(ing.materialId);
  };

  const getMaterialCost = (materialId) => {
    const material = rawMaterials.find(m => m._id === materialId);
    return material?.costPerUnit || 0;
  };

  const getMaterialInventory = (materialId) => {
    const item = inventory.find(i => i._id === materialId);
    return item?.quantity || 0;
  };

  const calculateTotalPercentage = (ingredients) => {
    return ingredients.reduce((sum, ing) => sum + (parseFloat(ing.percentage) || 0), 0);
  };

  const calculateTotalCost = (ingredients) => {
    return ingredients.reduce((sum, ing) => {
      const quantity = (parseFloat(ing.percentage) || 0) * 10; // per 1000kg
      const costPerUnit = getMaterialCost(ing.materialId);
      return sum + (quantity * costPerUnit);
    }, 0);
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    
    // Auto-calculate quantity and cost when percentage or material changes
    if (field === 'percentage' || field === 'materialId') {
      const percentage = parseFloat(newIngredients[index].percentage) || 0;
      newIngredients[index].quantity = (percentage * 10).toFixed(2); // per 1000kg
      newIngredients[index].costPerUnit = getMaterialCost(newIngredients[index].materialId);
      newIngredients[index].totalCost = (percentage * 10 * newIngredients[index].costPerUnit).toFixed(2);
    }
    
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addIngredient = () => {
    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, { materialId: '', percentage: 0, quantity: 0, costPerUnit: 0, totalCost: 0 }]
    });
  };

  const removeIngredient = (index) => {
    const newIngredients = formData.ingredients.filter((_, i) => i !== index);
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const handleCreateRecipe = () => {
    setFormData({
      name: '',
      feedTypeId: '',
      version: '1.0',
      status: 'active',
      ingredients: [],
      protein: '',
      energy: '',
      fiber: '',
      notes: ''
    });
    setModalType('create');
    setShowModal(true);
  };

  const handleEditRecipe = async (recipe) => {
    try {
      // Fetch full recipe details with ingredients from PostgreSQL
      const response = await fetch(`${API_URL}/recipes/${recipe.id || recipe._id}`, { headers: headers() });
      let fullRecipe = recipe;
      let recipeIngredients = recipe.ingredients || [];

      if (response.ok) {
        const data = await response.json();
        fullRecipe = data;
        // Map PostgreSQL ingredients to frontend format
        recipeIngredients = data.ingredients?.map(ing => ({
          materialId: ing.raw_material_id || ing.materialId || '',
          percentage: parseFloat(ing.percentage || 0),
          quantity: parseFloat(ing.quantity_kg || ing.quantity || 0),
          costPerUnit: parseFloat(ing.unit_cost || ing.costPerUnit || 0),
          totalCost: parseFloat(ing.quantity_kg || ing.quantity || 0) * parseFloat(ing.unit_cost || ing.costPerUnit || 0),
          name: ing.material_name_english || ing.name || '',
          nameArabic: ing.material_name_arabic || ing.nameArabic || ''
        })) || [];
      }

      const totalCost = calculateTotalCost(recipeIngredients);
      const suggestedSell = totalCost * 1.15;
      setFormData({
        name: fullRecipe.name || recipe.name,
        feedTypeId: fullRecipe.feed_type_id || recipe.feedType?._id || '',
        version: fullRecipe.version || recipe.version,
        status: fullRecipe.status || recipe.status,
        ingredients: recipeIngredients,
        sellingPrice: fullRecipe.selling_price || recipe.sellPerTon || '',
        protein: fullRecipe.protein_percentage || recipe.protein || '',
        energy: fullRecipe.energy || recipe.energy || '',
        fiber: fullRecipe.fiber || recipe.fiber || '',
        notes: fullRecipe.notes || recipe.notes || ''
      });
      setSelectedRecipe(recipe);
      setModalType('edit');
      setShowModal(true);
    } catch (error) {
      // Fallback: open edit modal with whatever we have
      setFormData({
        name: recipe.name,
        feedTypeId: recipe.feedType?._id || '',
        version: recipe.version,
        status: recipe.status,
        ingredients: recipe.ingredients || [],
        sellingPrice: recipe.sellPerTon || '',
        protein: recipe.protein || '',
        energy: recipe.energy || '',
        fiber: recipe.fiber || '',
        notes: recipe.notes || ''
      });
      setSelectedRecipe(recipe);
      setModalType('edit');
      setShowModal(true);
    }
  };

  const handleViewRecipe = async (recipe) => {
    try {
      // Fetch full recipe details with ingredients from PostgreSQL
      const response = await fetch(`${API_URL}/recipes/${recipe.id}`, { headers: headers() });
      if (response.ok) {
        const fullRecipe = await response.json();
        // Map PostgreSQL field names to match the component's expectations
        const totalCost = parseFloat(fullRecipe.total_cost || 0);
        const totalKg = parseFloat(fullRecipe.total_quantity_kg) || 1000;
        const mappedRecipe = {
          ...fullRecipe,
          _id: fullRecipe.id,
          total_cost: fullRecipe.total_cost,
          totalCost: totalCost,
          costPerKg: totalKg > 0 ? totalCost / totalKg : 0,
          costPerTon: fullRecipe.pricing?.cost_per_ton ? parseFloat(fullRecipe.pricing.cost_per_ton) : totalCost,
          sellPerTon: fullRecipe.pricing?.sell_per_ton ? parseFloat(fullRecipe.pricing.sell_per_ton) : totalCost * 1.15,
          feedType: {
            _id: fullRecipe.feed_type_id,
            name: fullRecipe.feed_name_english,
            nameArabic: fullRecipe.feed_name_arabic,
            protein: fullRecipe.protein_percentage
          },
          ingredients: fullRecipe.ingredients?.map(ing => ({
            ...ing,
            _id: ing.id,
            materialId: ing.raw_material_id,
            name: ing.material_name_english,
            nameArabic: ing.material_name_arabic,
            quantity: parseFloat(ing.quantity_kg || 0),
            unitPrice: parseFloat(ing.unit_cost || 0),
            totalCost: parseFloat(ing.quantity_kg || 0) * parseFloat(ing.unit_cost || 0),
            percentage: parseFloat(ing.percentage || 0)
          })) || []
        };
        setSelectedRecipe(mappedRecipe);
      } else {
        // Fallback to basic recipe if API fails
        setSelectedRecipe(recipe);
      }
    } catch (error) {
      setSelectedRecipe(recipe);
    }
    setModalType('detail');
    setShowModal(true);
    calculateBatchMaterials(recipe, batchSize);
  };

  const handleDuplicateRecipe = (recipe) => {
    const newVersion = (parseFloat(recipe.version) + 0.1).toFixed(1);
    setFormData({
      name: `${recipe.name} (Copy)`,
      feedTypeId: recipe.feedType?._id || '',
      version: newVersion,
      status: 'inactive',
      ingredients: recipe.ingredients.map(ing => ({ ...ing })),
      protein: recipe.protein || '',
      energy: recipe.energy || '',
      fiber: recipe.fiber || '',
      notes: recipe.notes || ''
    });
    setModalType('create');
    setShowModal(true);
  };

  const handleToggleStatus = async (recipe) => {
    const newStatus = recipe.status === 'active' ? 'inactive' : 'active';
    try {
      await fetch(`${API_URL}/recipes/${recipe.id || recipe._id}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ status: newStatus })
      });
      setRecipes(recipes.map(r => (r.id === recipe.id || r._id === recipe._id) ? { ...r, status: newStatus } : r));
    } catch (error) {
      setRecipes(recipes.map(r => (r.id === recipe.id || r._id === recipe._id) ? { ...r, status: newStatus } : r));
    }
  };

  const handleSaveRecipe = async () => {
    if (!formData.name.trim()) {
      alert('Recipe name is required');
      return;
    }
    if (!formData.feedTypeId) {
      alert('Feed type is required');
      return;
    }
    if (formData.ingredients.length === 0) {
      alert('At least one ingredient is required');
      return;
    }

    const totalPercentage = calculateTotalPercentage(formData.ingredients);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Total percentage must be exactly 100%. Current: ${totalPercentage.toFixed(2)}%`);
      return;
    }

    const payload = {
      name: formData.name,
      feedTypeId: parseInt(formData.feedTypeId),
      version: parseInt(formData.version) || 1,
      sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : null,
      status: formData.status,
      ingredients: formData.ingredients.map(ing => ({
        raw_material_id: parseInt(ing.materialId),
        quantity_kg: parseFloat(ing.quantity || ing.quantity_kg || 0),
        percentage: parseFloat(ing.percentage || 0),
        unit_cost: parseFloat(ing.costPerUnit || ing.unit_cost || 0)
      }))
    };

    try {
      if (modalType === 'create') {
        const res = await fetch(`${API_URL}/recipes`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }
        await fetchData(); // Refresh full list
      } else {
        const res = await fetch(`${API_URL}/recipes/${selectedRecipe.id || selectedRecipe._id}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned ${res.status}`);
        }
        await fetchData(); // Refresh full list
      }
      setShowModal(false);
    } catch (error) {
      alert('Error saving recipe: ' + error.message);
    }
  };

  const calculateBatchMaterials = (recipe, size) => {
    const materials = recipe.ingredients.map(ing => {
      const quantity = (ing.percentage / 100) * size;
      const available = getMaterialInventory(ing.materialId);
      return {
        ...ing,
        materialName: getMaterialName(ing.materialId),
        batchQuantity: quantity.toFixed(2),
        available: available,
        isAvailable: available >= quantity
      };
    });
    setCalculatedMaterials(materials);
    
    // Calculate inventory check
    const check = {};
    materials.forEach(m => {
      check[m.materialId] = m.isAvailable;
    });
    setInventoryCheck(check);
  };

  const handleBatchSizeChange = (size) => {
    setBatchSize(size);
    if (selectedRecipe) {
      calculateBatchMaterials(selectedRecipe, size);
    }
  };

  const handlePrintRecipe = () => {
    window.print();
  };

  const stats = getStats();
  const filteredRecipes = getFilteredRecipes();

  const getStatusBadgeClass = (status) => {
    return status === 'active' ? 'badge-success' : 'badge-secondary';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('recipes.title')}</h1>
          <p>{t('recipes.subtitle')}</p>
        </div>
        <button onClick={handleCreateRecipe} className="btn btn-primary">
          <Plus className="w-5 h-5" />
          {t('recipes.create')}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#b91c1c',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          <strong>Error:</strong> {error}
          <div style={{marginTop: '8px', fontSize: '12px'}}>
            Check browser console (F12) for more details
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280'
        }}>
          {t('common.loading')}...
        </div>
      )}

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">{t('common.totalRecipes')}</p>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('recipes.active')}</p>
          <p className="stat-value text-green-600">{stats.active}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('recipes.avgCost')}</p>
          <p className="stat-value">{t('common.currency')} {formatNumber(stats.avgCost, { decimals: 0 })}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">{t('recipes.mostUsed')}</p>
          <p className="stat-value text-sm">{stats.mostUsed?.name || 'N/A'}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-200px">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('recipes.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="input"
        >
          <option value="all">{t('recipes.allFeedTypes')}</option>
          {feedTypes.map(ft => (
            <option key={ft._id} value={ft._id}>{(getLang() === 'ar' ? (ft.nameArabic || ft.name) : ft.name)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="input"
        >
          <option value="all">{t('common.allLabel')}</option>
          <option value="active">{t('common.statuses.active')}</option>
          <option value="inactive">{t('common.statuses.inactive')}</option>
        </select>
      </div>

      {/* Recipe List */}
      <div className="table-container">
        {loading ? (
          <div className="p-6 text-center">{t('common.loading')}</div>
        ) : (
          <table className="table recipe-table">
            <thead>
              <tr>
                <th>{t('recipes.name')}</th>
                <th>{t('production.feedType')}</th>
                <th>الإصدار</th>
                <th>{t('recipes.ingredients')}</th>
                <th>التكلفة/1000 كجم</th>
                <th>{t('common.status')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecipes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center">{t('recipes.none')}</td>
                </tr>
              ) : (
                filteredRecipes.map((recipe) => (
                  <tr key={recipe._id}>
                    <td>
                      <p className="font-medium">{recipe.name}</p>
                      {recipe.nameArabic && (
                        <p className="text-sm text-blue-600" dir="rtl">{recipe.nameArabic}</p>
                      )}
                      <p className="text-sm text-gray-600">{t('recipes.used', { count: recipe.usageCount || 0 })}</p>
                    </td>
                    <td>
                      <p>{(getLang() === 'ar' ? (recipe.feedType?.nameArabic || recipe.feedType?.name) : (recipe.feedType?.name)) || 'غير معروف'}</p>
                      {recipe.feedType?.nameArabic && (
                        <p className="text-sm text-blue-600" dir="rtl">{recipe.feedType?.nameArabic}</p>
                      )}
                    </td>
                    <td>{recipe.version}</td>
                    <td>{recipe.ingredientCount || 0}</td>
                    <td>{formatCurrency(recipe.totalCost || 0)}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(recipe.status)}`}>
                        {recipe.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewRecipe(recipe)}
                          className="btn btn-sm btn-outline"
                          title={t('common.view')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditRecipe(recipe)}
                          className="btn btn-sm btn-primary"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDuplicateRecipe(recipe)}
                          className="btn btn-sm btn-outline"
                          title={t('recipes.duplicate')}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content modal-xl recipe-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {modalType === 'create' && 'إنشاء تركيبة جديدة'}
                {modalType === 'edit' && 'تعديل التركيبة'}
                {modalType === 'detail' && 'تفاصيل التركيبة'}
              </h2>
              <div className="flex gap-2">
                {modalType === 'detail' && (
                  <button onClick={handlePrintRecipe} className="btn btn-sm btn-outline">
                    <Printer className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="btn btn-sm btn-outline">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="modal-body recipe-modal-body">
              {modalType === 'detail' && selectedRecipe ? (
                <div className="space-y-6">
                  {/* Recipe Header */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">{t('recipes.name')}</p>
                      <p className="font-medium text-lg">{selectedRecipe.name}</p>
                      {selectedRecipe.nameArabic && (
                        <p className="font-medium text-lg text-blue-600" dir="rtl">{selectedRecipe.nameArabic}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('production.feedType')}</p>
                      <p className="font-medium">{selectedRecipe.feedType?.name}</p>
                      {selectedRecipe.feedType?.nameArabic && (
                        <p className="font-medium text-blue-600" dir="rtl">{selectedRecipe.feedType?.nameArabic}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('recipes.version')}</p>
                      <p className="font-medium">{selectedRecipe.version}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('common.status')}</p>
                      <span className={`badge ${getStatusBadgeClass(selectedRecipe.status)}`}>
                        {selectedRecipe.status}
                      </span>
                    </div>
                    {selectedRecipe.batchSize && (
                      <div>
                        <p className="text-sm text-gray-600">{t('recipes.batchSize')}</p>
                        <p className="font-medium">{selectedRecipe.batchSize.toFixed(3)} {t('common.kg')}</p>
                      </div>
                    )}
                    {selectedRecipe.costPerKg && (
                      <div>
                        <p className="text-sm text-gray-600">{t('recipes.costPerKg')}</p>
                        <p className="font-medium text-blue-600">{formatCurrency(selectedRecipe.costPerKg || 0)}</p>
                      </div>
                    )}
                    {selectedRecipe.costPerTon > 0 && (
                      <div>
                        <p className="text-sm text-gray-600">{t('recipes.costPerTon')}</p>
                        <p className="font-medium">{formatCurrency(selectedRecipe.costPerTon)}</p>
                      </div>
                    )}
                    {selectedRecipe.sellPerTon > 0 && (
                      <div>
                        <p className="text-sm text-gray-600">{t('recipes.sellPerTon')}</p>
                        <p className="font-medium text-green-600">{formatCurrency(selectedRecipe.sellPerTon)}</p>
                      </div>
                    )}
                  </div>

                  {/* Cost Breakdown Table */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      {t('recipes.costBreakdown')}
                    </h3>
                    <div className="table-responsive">
                      <table className="table recipe-table">
                        <thead>
                          <tr>
                            <th>{t('recipes.material')}</th>
                            <th>%</th>
                            <th>{t('common.quantity')}</th>
                            <th>{t('common.unit')}</th>
                            <th>{t('common.price')}</th>
                            <th>{t('common.total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedRecipe.ingredients?.map((ing, idx) => (
                            <tr key={idx}>
                              <td>
                                <div className="flex flex-col">
                                  <span className="font-medium">{getIngredientDisplayName(ing)}</span>
                                </div>
                              </td>
                              <td className="text-right">{ing.percentage?.toFixed(2)}%</td>
                              <td className="text-right">{ing.quantity?.toFixed(3)}</td>
                              <td>{ing.unit || t('common.kg')}</td>
                              <td className="text-right">{formatCurrency(ing.unitPrice || ing.costPerUnit || 0)}</td>
                              <td className="text-right font-medium">{formatCurrency(ing.totalCost || 0)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-gray-100">
                            <td colSpan="5" className="text-right">{t('recipes.totalCostLabel')}:</td>
<td className="text-right text-blue-600">{formatCurrency(selectedRecipe.totalCost || 0)}</td>
                            </tr>
                            <tr>
                              <td className="text-gray-600">{t('recipes.costPerKg')}</td>
                              <td className="text-right text-blue-700">{formatCurrency(selectedRecipe.costPerKg || selectedRecipe.totalCost / 1000 || 0)}</td>
                          </tr>
                          <tr>
                            <td className="text-gray-600">Cost per Ton / التكلفة للطن</td>
                            <td className="text-right font-medium">{formatCurrency(selectedRecipe.costPerTon || selectedRecipe.totalCost || 0)}</td>
                          </tr>
                          <tr>
                            <td className="text-gray-600">Sell per Ton / سعر البيع للطن (15% markup)</td>
                            <td className="text-right font-medium text-green-600">{formatCurrency(selectedRecipe.sellPerTon || (selectedRecipe.totalCost || 0) * 1.15)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Nutritional Summary */}
                  {(selectedRecipe.protein || selectedRecipe.energy || selectedRecipe.fiber) && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        القيم الغذائية
                      </h3>
                      <div className="grid grid-cols-3 gap-4">
                        {selectedRecipe.protein && (
                          <div className="p-3 bg-blue-50 rounded-lg text-center">
                            <p className="text-sm text-gray-600">{t('recipes.protein')}</p>
                            <p className="text-xl font-bold text-blue-600">{selectedRecipe.protein}%</p>
                          </div>
                        )}
                        {selectedRecipe.energy && (
                          <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-sm text-gray-600">{t('recipes.energy')}</p>
                            <p className="text-xl font-bold text-green-600">{selectedRecipe.energy} kcal/kg</p>
                          </div>
                        )}
                        {selectedRecipe.fiber && (
                          <div className="p-3 bg-yellow-50 rounded-lg text-center">
                            <p className="text-sm text-gray-600">{t('recipes.fiber')}</p>
                            <p className="text-xl font-bold text-yellow-600">{selectedRecipe.fiber}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Production Calculator */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      Production Calculator / حاسبة الإنتاج
                    </h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="form-group mb-4">
                        <label className="label">Batch Size / حجم الدفعة (kg)</label>
                        <input
                          type="number"
                          value={batchSize}
                          onChange={(e) => handleBatchSizeChange(parseFloat(e.target.value) || 0)}
                          className="input w-full"
                          min="0"
                        />
                      </div>

                      <div className="table-responsive">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Material / المادة</th>
                              <th>Required / مطلوب</th>
                              <th>Available / متاح</th>
                              <th>Status / الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculatedMaterials.map((mat, idx) => (
                              <tr key={idx}>
                                <td>{getIngredientDisplayName(mat)}</td>
                                <td>{mat.batchQuantity} {mat.unit || 'kg'}</td>
                                <td>{mat.available} kg</td>
                                <td>
                                  {mat.isAvailable ? (
                                    <span className="badge badge-success flex items-center gap-1 w-fit">
                                      <Check className="w-3 h-3" />
                                      متاح
                                    </span>
                                  ) : (
                                    <span className="badge badge-danger flex items-center gap-1 w-fit">
                                      <AlertCircle className="w-3 h-3" />
                                      غير كاف
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Batch Cost:</span>
                          <span className="text-xl font-bold text-blue-600">
                            {formatCurrency((selectedRecipe.totalCost / 1000) * batchSize || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-medium">Cost per kg:</span>
                          <span className="font-semibold">
                            {formatCurrency(selectedRecipe.totalCost / 1000 || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedRecipe.notes && (
                    <div>
                      <h3 className="font-semibold mb-2">{t('common.notes')}</h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedRecipe.notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <button 
                      onClick={() => handleEditRecipe(selectedRecipe)}
                      className="btn btn-primary flex-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      تعديل التركيبة
                    </button>
                    <button 
                      onClick={() => handleDuplicateRecipe(selectedRecipe)}
                      className="btn btn-outline flex-1"
                    >
                      <Copy className="w-4 h-4" />
                      نسخ
                    </button>
                    <button 
                      onClick={() => handleToggleStatus(selectedRecipe)}
                      className={`btn flex-1 ${selectedRecipe.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                    >
                      {selectedRecipe.status === 'active' ? (
                        <><Pause className="w-4 h-4" /> Deactivate</>
                      ) : (
                        <><Play className="w-4 h-4" /> Activate</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Create/Edit Form */
                <div className="space-y-4 recipe-form">
                  <div className="form-row-responsive">
                    <div className="form-group">
                      <label className="label required">{t('recipes.name')}</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="input w-full"
                        placeholder="أدخل اسم التركيبة"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="label required">{t('production.feedType')}</label>
                      <select
                        value={formData.feedTypeId}
                        onChange={(e) => setFormData({ ...formData, feedTypeId: e.target.value })}
                        className="input w-full"
                        required
                      >
                        <option value="">اختر نوع العلف</option>
                        {feedTypes.map(ft => (
                          <option key={ft._id} value={ft._id}>{(getLang() === 'ar' ? (ft.nameArabic || ft.name) : ft.name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row-responsive">
                    <div className="form-group">
                      <label className="label">الإصدار</label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                        className="input w-full"
                        placeholder="1.0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">{t('common.status')}</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="input w-full"
                      >
                        <option value="active">{t('common.statuses.active')}</option>
                        <option value="inactive">{t('common.statuses.inactive')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="label mb-0">{t('recipes.ingredients')}</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Total:</span>
                        <span className={`font-bold ${Math.abs(calculateTotalPercentage(formData.ingredients) - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                          {calculateTotalPercentage(formData.ingredients).toFixed(1)}%
                        </span>
                        {Math.abs(calculateTotalPercentage(formData.ingredients) - 100) > 0.01 && (
                          <span className="text-xs text-red-500">(Must be 100%)</span>
                        )}
                      </div>
                    </div>

                    <div className="ingredients-container">
                      {formData.ingredients.map((ing, idx) => (
                        <div key={idx} className="ingredient-row">
                          <div>
                            <label className="label text-xs">{t('common.material')}</label>
                            <select
                              value={ing.materialId}
                              onChange={(e) => handleIngredientChange(idx, 'materialId', e.target.value)}
                              className="input w-full text-sm"
                            >
                              <option value="">اختر الخامة</option>
                              {rawMaterials.map(rm => (
                                <option key={rm._id} value={rm._id}>{rm.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">%</label>
                            <input
                              type="number"
                              value={ing.percentage}
                              onChange={(e) => handleIngredientChange(idx, 'percentage', e.target.value)}
                              className="input w-full text-sm"
                              min="0"
                              max="100"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">الكمية (كجم)</label>
                            <input
                              type="text"
                              value={ing.quantity}
                              readOnly
                              className="input w-full text-sm bg-gray-100"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">التكلفة</label>
                            <input
                              type="text"
                              value={ing.totalCost}
                              readOnly
                              className="input w-full text-sm bg-gray-100"
                            />
                          </div>
                          <div>
                            <button
                              onClick={() => removeIngredient(idx)}
                              className="btn btn-sm btn-danger w-full"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={addIngredient}
                      className="btn btn-outline mt-3 w-full"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة مكون
                    </button>

                    {/* Total Cost Display */}
                    <div className="total-cost-display">
                      <span className="label">Total Cost per 1000kg:</span>
                      <span className="value">
                        {formatCurrency(calculateTotalCost(formData.ingredients))}
                      </span>
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div className="form-group mt-4">
                    <label className="label">سعر البيع للطن (ج.م)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                        className="input"
                        placeholder={formatCurrency(calculateTotalCost(formData.ingredients) * 1.15)}
                        min="0"
                        step="0.01"
                      />
                      <span className="text-sm text-gray-500">
                        (Suggested: {formatCurrency(calculateTotalCost(formData.ingredients) * 1.15)})
                      </span>
                    </div>
                  </div>

                  {/* Nutritional Values */}
                  <div className="form-row-responsive">
                    <div className="form-group">
                      <label className="label">Protein (%)</label>
                      <input
                        type="number"
                        value={formData.protein}
                        onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                        className="input w-full"
                        placeholder="Optional"
                        step="0.1"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">الطاقة (كيلو كالوري/كجم)</label>
                      <input
                        type="number"
                        value={formData.energy}
                        onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                        className="input w-full"
                        placeholder="Optional"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Fiber (%)</label>
                      <input
                        type="number"
                        value={formData.fiber}
                        onChange={(e) => setFormData({ ...formData, fiber: e.target.value })}
                        className="input w-full"
                        placeholder="Optional"
                        step="0.1"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="form-group">
                    <label className="label">{t('common.notes')}</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="input w-full"
                      rows="3"
                      placeholder="Optional notes about this recipe..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer recipe-modal-footer">
              {modalType !== 'detail' && (
                <>
                  <button onClick={() => setShowModal(false)} className="btn btn-outline">
                    إلغاء
                  </button>
                  <button onClick={handleSaveRecipe} className="btn btn-primary">
                    {modalType === 'create' ? t('recipes.create') : t('common.save')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icon components for missing imports
const Play = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const Pause = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
