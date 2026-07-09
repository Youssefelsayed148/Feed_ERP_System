import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate, formatNumber, getStatusLabel } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Package, Plus, Search, AlertTriangle, TrendingDown, 
  TrendingUp, Clock, Check, X, Play, Pause,
  ChevronDown, Truck, Box, Factory, ChefHat,
  ArrowLeftRight, PlusCircle, History, Filter, User,
  ArrowRight, Warehouse, DollarSign, FileText, Send, Eye
} from 'lucide-react';
import { requisitionService, purchaseOrdersService } from '../services/api';

const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const API_URL = `${API_BASE_URL}/inventory`;
const PRODUCTION_API_URL = `${API_BASE_URL}/production`;
const FEED_RECIPES_API_URL = `${API_BASE_URL}/feed-recipes`;
const SUPPLIERS_API_URL = `${API_BASE_URL}/suppliers`;
const getAuthToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('raw');
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedGoods, setFinishedGoods] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [feedTypes, setFeedTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialMovements, setMaterialMovements] = useState([]);
  const [materialDetailData, setMaterialDetailData] = useState(null);
  const [showMaterialDetailModal, setShowMaterialDetailModal] = useState(false);
  const [showAddNewMaterialModal, setShowAddNewMaterialModal] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewBySupplier, setPreviewBySupplier] = useState([]);
  const [previewTotalCost, setPreviewTotalCost] = useState(0);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [reqDetailData, setReqDetailData] = useState(null);
  const [allMaterialsForDropdown, setAllMaterialsForDropdown] = useState([]);
  
  // Filters for stock movements
  const [movementFilters, setMovementFilters] = useState({
    startDate: '',
    endDate: '',
    material: '',
    movementType: '',
    user: ''
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, page]);

  useEffect(() => {
    const fetchAllMaterials = async () => {
      try {
        const res = await fetch(`${API_URL}/raw-materials?page=1&limit=200`, { headers: headers() });
        const data = await res.json();
        const materialsData = Array.isArray(data) ? data : data.materials || [];
        setAllMaterialsForDropdown(materialsData.map(m => ({
          _id: m.id,
          name: m.name_arabic || m.name_english || m.name || '',
          code: m.code,
          unit: m.unit || 'kg',
          quantity: parseFloat(m.current_stock || 0),
          costPerUnit: parseFloat(m.unit_price || 0)
        })));
      } catch (e) {
        console.error('Error fetching all materials for dropdown:', e);
      }
    };
    fetchAllMaterials();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'raw') {
        // Fetch from PostgreSQL
        const [materialsRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/raw-materials?page=${page}&limit=20`, { headers: headers() }),
          fetch(`${API_URL}/dashboard`, { headers: headers() })
        ]);
        const materials = await materialsRes.json();
        const statsData = await statsRes.json();
        // PostgreSQL returns { materials: [], total, page, pages }
        const materialsData = Array.isArray(materials) ? materials : materials.materials || [];
        setTotalPages(materials.pages || 1);
        // Map API fields (id, name_arabic, current_stock, unit_price, min_stock_level, stock_status)
        // to frontend expectations (_id, name, quantity, costPerUnit, minimumStock, status)
        const mappedMaterials = materialsData.map(m => ({
          _id: m.id,
          id: m.id,
          name: m.name_arabic || m.name_english || m.name || '',
          nameArabic: m.name_arabic || '',
          nameEnglish: m.name_english || '',
          code: m.code,
          category: m.category,
          unit: m.unit || 'kg',
          quantity: parseFloat(m.current_stock || 0),
          current_stock: m.current_stock,
          costPerUnit: parseFloat(m.unit_price || 0),
          unit_price: m.unit_price,
          minimumStock: parseFloat(m.min_stock_level || 0),
          min_stock_level: m.min_stock_level,
          status: m.stock_status || (m.is_active ? 'active' : 'inactive')
        }));
        setRawMaterials(mappedMaterials);
        // Compute total quantity from mapped materials (dashboard API doesn't return it)
        const totalQty = mappedMaterials.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0);
        setStats({
          total: parseInt(statsData.total_materials) || 0,
          totalValue: parseFloat(statsData.total_inventory_value) || 0,
          totalQuantity: totalQty,
          lowStockCount: parseInt(statsData.low_stock_count) || 0,
          byCategory: {}
        });
      } else if (activeTab === 'production') {
        // Fetch production orders from PostgreSQL
        const [prodRes, statsRes] = await Promise.all([
          fetch(`${PRODUCTION_API_URL}/production-orders`, { headers: headers() }),
          fetch(`${PRODUCTION_API_URL}/stats`, { headers: headers() })
        ]);
        const prod = await prodRes.json();
        const statsData = await statsRes.json();
        // PostgreSQL returns { orders: [], total, page, pages }
        const prodRaw = prod.orders || prod.productionOrders || prod;
        const prodData = Array.isArray(prodRaw) ? prodRaw : [];
        const mappedProd = prodData.map(o => ({
          _id: o.id,
          id: o.id,
          productionNumber: o.order_number,
          batchNumber: o.batch_number,
          feedType: {
            name: o.feed_name_arabic || o.feed_name_english || 'Unknown'
          },
          totalBags: o.number_of_bags,
          totalOutputWeight: o.quantity_kg,
          status: o.status,
          createdAt: o.created_at
        }));
        setProductionOrders(mappedProd);
        setStats({
          total: parseInt(statsData.draft_count || 0) + parseInt(statsData.approved_count || 0) + parseInt(statsData.in_progress_count || 0) + parseInt(statsData.completed_count || 0) + parseInt(statsData.cancelled_count || 0),
          todayOrders: 0,
          todayOutput: parseFloat(statsData.total_produced_kg) || 0,
          pending: parseInt(statsData.draft_count || 0),
          inProgress: parseInt(statsData.in_progress_count || 0),
          completed: parseInt(statsData.completed_count || 0)
        });
      } else if (activeTab === 'recipes') {
        // Fetch recipes from PostgreSQL via FeedRecipes page API
        const recipesRes = await fetch(`${FEED_RECIPES_API_URL}/recipes`, { headers: headers() });
        const recipesData = await recipesRes.json();
        const recData = Array.isArray(recipesData) ? recipesData : recipesData?.data || [];
        const mappedRecipes = recData.map(r => ({
          _id: r.id,
          name: r.name,
          protein: r.protein_percentage,
          feedType: {
            name: r.feed_name_arabic || r.feed_name_english || 'Unknown'
          },
          totalCost: parseFloat(r.total_cost) || 0,
          pricing: r.pricing || {},
          status: r.is_active ? 'active' : 'inactive'
        }));
        setRecipes(mappedRecipes);
        setStats(mappedRecipes.length > 0 ? {
          total: mappedRecipes.length,
          active: mappedRecipes.filter(r => r.status === 'active').length,
          avgCost: mappedRecipes.reduce((sum, r) => sum + (r.totalCost || 0), 0) / mappedRecipes.length
        } : {});
      } else if (activeTab === 'finished') {
        // Fetch finished goods inventory
        const finishedRes = await fetch(`${API_URL}/finished-goods`, { headers: headers() });
        const finishedData = await finishedRes.json();
        const goods = finishedData.finishedGoods || [];
        const mappedGoods = goods.map(g => ({
          _id: g.id,
          id: g.id,
          feedType: {
            name: g.feed_name_arabic || g.feed_name_english || 'Unknown',
            code: g.feed_code,
            protein: g.protein_percentage
          },
          packageSize: g.package_size || 50,
          numberOfBags: g.number_of_bags || Math.round(parseFloat(g.quantity_kg) / (g.package_size || 50)),
          quantityKg: parseFloat(g.quantity_kg),
          quantityTons: parseFloat(g.quantity_kg) / 1000,
          totalWeight: parseFloat(g.quantity_kg),
          batchNumber: g.batch_number,
          status: g.status || 'available',
          expiryDate: g.expiry_date,
          unitCost: parseFloat(g.unit_cost) || 0,
          totalCost: parseFloat(g.total_cost) || 0,
          productionOrderNumber: g.production_order_number
        }));
        setFinishedGoods(mappedGoods);
        // Calculate stats
        const totalBags = mappedGoods.reduce((sum, g) => sum + (g.numberOfBags || 0), 0);
        const totalTons = mappedGoods.reduce((sum, g) => sum + parseFloat(g.quantityTons || 0), 0);
        const byPackageSize = {};
        mappedGoods.forEach(g => {
          const size = g.packageSize || 50;
          byPackageSize[`${size}kg`] = (byPackageSize[`${size}kg`] || 0) + (g.numberOfBags || 0);
        });
        setStats({
          total: mappedGoods.length,
          totalBags,
          totalTons: formatNumber(totalTons),
          lowStock: mappedGoods.filter(g => g.quantityTons < 5).length,
          byPackageSize
        });
      } else if (activeTab === 'movements') {
        // Fetch inventory transactions from the dedicated movements endpoint
        const movementsRes = await fetch(`${API_URL}/movements?limit=100`, { headers: headers() });
        const movementsData = movementsRes.ok ? await movementsRes.json() : { movements: [] };
        // Map API format to frontend format
        const mapped = (movementsData.movements || []).map(m => ({
          _id: m.id,
          id: m.id,
          materialId: m.raw_material_id,
          materialName: m.material_name || m.material_name_ar || 'مادة خام',
          materialCode: m.material_code || '',
          movementType: m.transaction_type || 'adjustment',
          quantity: parseFloat(m.quantity) || 0,
          unitCost: parseFloat(m.unit_price) || 0,
          totalValue: parseFloat(m.total_cost) || 0,
          reference: m.reference_type
            ? `${m.reference_type}${m.reference_id ? ' #' + m.reference_id : ''}`
            : (m.notes || ''),
          notes: m.notes || '',
          timestamp: m.created_at,
          unit: m.unit || 'كجم',
          performedBy: m.user_name || m.performed_by || m.created_by_name || '',
          supplier: m.supplier_name || ''
        }));
        setStockMovements(mapped);
      } else if (activeTab === 'requisitions') {
        const reqRes = await requisitionService.getAll();
        if (reqRes.success) {
          setRequisitions(reqRes.requisitions || []);
        }
        // Fetch raw-materials directly to get min_stock_level for red/orange color coding
        // Uses a high limit (not the raw-tab page state) since this needs the full list to compute low-stock accurately
        try {
          const matRes = await fetch(`${API_URL}/raw-materials?limit=1000`, { headers: headers() });
          const matData = await matRes.json();
          const mats = Array.isArray(matData) ? matData : (matData.materials || []);
          const lowStock = mats
            .filter(m => {
              const current = parseFloat(m.current_stock || 0);
              const reorder = parseFloat(m.reorder_level || 0);
              return reorder > 0 && current <= reorder && m.is_active !== false;
            })
            .map(m => ({
              id: m.id,
              material_code: m.code,
              material_name: m.name_arabic || m.name_english || '',
              current_stock: parseFloat(m.current_stock || 0),
              reorder_level: parseFloat(m.reorder_level || 0),
              min_stock_level: parseFloat(m.min_stock_level || 0),
              unit: m.unit || 'kg',
            }));
          setLowStockItems(lowStock);
        } catch (e) {
          setLowStockItems([]);
        }
      } else if (activeTab === 'purchase-orders') {
        const poRes = await purchaseOrdersService.getPurchaseOrders();
        if (poRes.success || poRes.purchaseOrders) {
          setPurchaseOrders(poRes.purchaseOrders || poRes.data || []);
        }
      }
      
      // Fetch suppliers for Add Stock modal (using legacy endpoint)
      try {
        const suppliersRes = await fetch(`${SUPPLIERS_API_URL}`, { headers: headers() });
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData.data || suppliersData || []);
      } catch (e) {
        setSuppliers([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (activeTab === 'raw') {
        setRawMaterials([]);
        setStats({});
      } else if (activeTab === 'finished') {
        setFinishedGoods([]);
        setStats({});
      } else if (activeTab === 'production') {
        setProductionOrders([]);
        setStats({});
      } else if (activeTab === 'recipes') {
        setRecipes([]);
        setStats({});
      } else if (activeTab === 'movements') {
        setStockMovements([]);
      } else if (activeTab === 'requisitions') {
        setRequisitions([]);
      } else if (activeTab === 'purchase-orders') {
        setPurchaseOrders([]);
      }
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  // Broadcast inventory updates to other modules
  const broadcastInventoryUpdate = (type, data) => {
    // Broadcast to other modules via localStorage events
    const event = new CustomEvent('inventoryUpdate', {
      detail: { type, data, timestamp: new Date().toISOString() }
    });
    window.dispatchEvent(event);
    
    // Also update localStorage for modules that check on load
    const currentInventory = JSON.parse(localStorage.getItem('inventoryState') || '{}');
    localStorage.setItem('inventoryState', JSON.stringify({
      ...currentInventory,
      lastUpdate: new Date().toISOString(),
      rawMaterials: rawMaterials,
      stockMovements: stockMovements,
      [type]: data
    }));
  };

  const handleMaterialClick = async (material) => {
    setSelectedMaterial(material);
    try {
      const res = await fetch(`${API_URL}/raw-materials/${material.id || material._id}`, { headers: headers() });
      setMaterialMovements(res.ok ? (await res.json()).recent_transactions || [] : []);
    } catch(e) { setMaterialMovements([]); }
    setShowMovementsModal(true);
  };

  const handleMaterialNameClick = async (material, e) => {
    e.stopPropagation();
    setSelectedMaterial(material);
    try {
      const res = await fetch(`${API_URL}/raw-materials/${material.id || material._id}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMaterialDetailData(data);
        setMaterialMovements(data.recent_transactions || []);
      } else {
        setMaterialDetailData(null);
        setMaterialMovements([]);
      }
    } catch(e) {
      setMaterialDetailData(null);
      setMaterialMovements([]);
    }
    setShowMaterialDetailModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      out_of_stock: 'bg-red-100 text-red-800',
      expired: 'bg-yellow-100 text-yellow-800',
      available: 'bg-green-100 text-green-800',
      reserved: 'bg-blue-100 text-blue-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      quality_check: 'bg-orange-100 text-orange-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeClass = (status) => {
    const badges = {
      active: 'badge-success',
      out_of_stock: 'badge-danger',
      expired: 'badge-warning',
      available: 'badge-success',
      reserved: 'badge-info',
      pending: 'badge-warning',
      approved: 'badge-info',
      in_progress: 'badge-primary',
      quality_check: 'badge-warning',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return badges[status] || 'badge-info';
  };

  const getCategoryLabel = (cat) => {
    const labels = {
      additive: t('inventory.additive'),
      enzyme: t('inventory.enzyme'),
      fiber: t('inventory.fiber'),
      grain: t('inventory.grain'),
      mineral: t('inventory.mineral'),
      medication: t('inventory.medication'),
      protein: t('inventory.protein'),
      raw_materials: t('inventory.rawMaterials'),
      finished_goods: t('inventory.finishedGoods')
    };
    return labels[cat] || cat;
  };

  const getStockStatusLabel = (status) => {
    const labels = {
      normal: t('common.normal'),
      low: t('common.low'),
      critical: t('common.critical')
    };
    return labels[status] || status;
  };

  const getMovementTypeBadge = (type) => {
    const badges = {
      purchase:   'badge-success',
      sale:       'badge-warning',
      adjustment: 'badge-danger',
      production: 'badge-info',
      transfer:   'badge-info',
      return:     'badge-primary',
      opening:    'badge-secondary',
    };
    return badges[(type || '').toLowerCase()] || 'badge-info';
  };

  const transactionTypeAr = {
    purchase:   'شراء',
    sale:       'بيع',
    adjustment: 'تسوية',
    production: 'إنتاج',
    transfer:   'تحويل',
    return:     'مرتجع',
    opening:    'رصيد افتتاحي',
  };

  const formatMovementType = (type) => transactionTypeAr[(type || '').toLowerCase()] || type;

  const displayQty = (quantity, unit) => {
    if (unit === 'ton' || unit === 'طن') {
      return `${(quantity / 1000).toFixed(3)} طن`;
    }
    return `${quantity} ${unit || 'كجم'}`;
  };

  // ADD STOCK MODAL COMPONENT — existing material only
  const AddStockModal = () => {
    const [formData, setFormData] = useState({
      materialId: '',
      quantity: '',
      costPerUnit: '',
      notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    const handleSubmit = async (e) => {
      e.preventDefault();
      const errors = {};
      if (!formData.materialId) errors.material = 'اختر الخامة';
      if (!formData.quantity || parseFloat(formData.quantity) <= 0) errors.quantity = 'الكمية يجب أن تكون أكبر من صفر';
      if (!formData.costPerUnit || parseFloat(formData.costPerUnit) <= 0) errors.costPerUnit = 'تكلفة الوحدة مطلوبة';
      if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
      setFormErrors({});
      setSubmitting(true);

      try {
        const response = await fetch(`${API_URL}/raw-materials/${formData.materialId}/stock`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            quantity: parseFloat(formData.quantity),
            unit_price: parseFloat(formData.costPerUnit),
            transaction_type: 'purchase',
            notes: formData.notes || t('inventory.manualStockAddition')
          })
        });

        if (response.ok) {
          const result = await response.json();
          broadcastInventoryUpdate('stockAdded', {
            materialId: formData.materialId,
            quantity: parseFloat(formData.quantity),
            result
          });
          alert(t('inventory.stockAdded'));
          setShowAddStockModal(false);
          fetchData();
        } else {
          const errorData = await response.json();
          alert(`${t('inventory.failedAddStock')}${errorData.message || t('common.unknownError')}`);
        }
      } catch (error) {
        console.error('Error adding stock:', error);
        const material = rawMaterials.find(m => m._id === formData.materialId);
        const oldQuantity = material?.quantity || 0;
        const addedQuantity = parseFloat(formData.quantity);
        const newQuantity = oldQuantity + addedQuantity;
        const updatedMaterials = rawMaterials.map(m =>
          m._id === formData.materialId ? {
            ...m,
            quantity: newQuantity,
            costPerUnit: formData.costPerUnit ? parseFloat(formData.costPerUnit) : m.costPerUnit
          } : m
        );
        setRawMaterials(updatedMaterials);
        alert(`${t('inventory.stockAddedDemo')} ${material?.name}: ${oldQuantity} → ${newQuantity} ${material?.unit}`);
        setShowAddStockModal(false);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal modal-large">
          <div className="modal-header">
            <h2 className="modal-title">{t('inventory.addStock')}</h2>
            <button className="modal-close" onClick={() => { setFormErrors({}); setShowAddStockModal(false); }}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              <div className="form-group">
                <label className="form-label">الخامة <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className="form-select"
                  style={{ border: formErrors.material ? '1px solid #ef4444' : undefined }}
                  value={formData.materialId}
                  onChange={(e) => {
                    setFormData({ ...formData, materialId: e.target.value });
                    if (formErrors.material) setFormErrors({ ...formErrors, material: undefined });
                  }}
                >
                  <option value="">اختر الخامة</option>
                  {allMaterialsForDropdown.map(m => (
                    <option key={m._id} value={m._id}>{m.name} ({m.code}) - Current: {m.quantity} {m.unit}</option>
                  ))}
                </select>
                {formErrors.material && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.material}</small>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.quantity')} <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  step="1"
                  className="form-input"
                  style={{ border: formErrors.quantity ? '1px solid #ef4444' : undefined }}
                  value={formData.quantity}
                  onChange={(e) => {
                    setFormData({ ...formData, quantity: e.target.value });
                    if (formErrors.quantity) setFormErrors({ ...formErrors, quantity: undefined });
                  }}
                />
                {formErrors.quantity && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.quantity}</small>}
              </div>
              <div className="form-group">
                <label className="form-label">{t('inventory.unitCostPerKg')} <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  style={{ border: formErrors.costPerUnit ? '1px solid #ef4444' : undefined }}
                  value={formData.costPerUnit}
                  onChange={(e) => {
                    setFormData({ ...formData, costPerUnit: e.target.value });
                    if (formErrors.costPerUnit) setFormErrors({ ...formErrors, costPerUnit: undefined });
                  }}
                  placeholder="سعر الوحدة - يؤثر على تقييم المخزون"
                />
                {formErrors.costPerUnit && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.costPerUnit}</small>}
                <small className="form-help">يؤثر على تقييم المخزون باستخدام طريقة متوسط التكلفة المرجح</small>
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('inventory.stockNotesPlaceholder')}
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setFormErrors({}); setShowAddStockModal(false); }}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-success" disabled={submitting}>
                {submitting ? t('inventory.adding') : t('inventory.addStock')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ADD NEW MATERIAL MODAL COMPONENT
  const AddNewMaterialModal = () => {
    const [formData, setFormData] = useState({
      nameArabic: '',
      nameEnglish: '',
      category: 'grain',
      unit: 'kg',
      unitPrice: '',
      currentStock: 0,
      reorderLevel: 0,
      minStockLevel: 0,
      restockQuantity: '',
      preferredSupplierId: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState({});

    const handleSubmit = async (e) => {
      e.preventDefault();
      const errors = {};
      if (!formData.nameArabic.trim()) errors.nameArabic = 'اسم الخامة بالعربية مطلوب';
      if (!formData.category) errors.category = 'الفئة مطلوبة';
      if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
      setFormErrors({});
      setSubmitting(true);

      try {
        const response = await fetch(`${API_URL}/raw-materials`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            name_arabic: formData.nameArabic,
            name_english: formData.nameEnglish,
            category: formData.category,
            unit: formData.unit,
            unit_price: parseFloat(formData.unitPrice) || 0,
            current_stock: parseFloat(formData.currentStock) || 0,
            reorder_level: parseFloat(formData.reorderLevel) || 0,
            min_stock_level: parseFloat(formData.minStockLevel) || 0,
            restock_quantity: formData.restockQuantity ? parseFloat(formData.restockQuantity) : null,
            preferred_supplier_id: formData.preferredSupplierId || null
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.material) {
            setRawMaterials(prev => [{
              _id: result.material.id,
              id: result.material.id,
              name: result.material.name_arabic || result.material.name_english || '',
              nameArabic: result.material.name_arabic || '',
              nameEnglish: result.material.name_english || '',
              code: result.material.code,
              category: result.material.category,
              unit: result.material.unit || 'kg',
              quantity: parseFloat(result.material.current_stock || 0),
              current_stock: result.material.current_stock,
              costPerUnit: parseFloat(result.material.unit_price || 0),
              unit_price: result.material.unit_price,
              minimumStock: parseFloat(result.material.min_stock_level || 0),
              min_stock_level: result.material.min_stock_level,
              status: 'active'
            }, ...prev]);
          }
          alert('تم إضافة المادة الجديدة بنجاح');
          setShowAddNewMaterialModal(false);
          fetchData();
        } else {
          const errorData = await response.json();
          alert(`فشل إضافة المادة: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error adding new material:', error);
        alert('فشل إضافة المادة: ' + (error.message || 'Unknown error'));
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal modal-large">
          <div className="modal-header">
            <h2 className="modal-title">إضافة مادة جديدة</h2>
            <button className="modal-close" onClick={() => { setFormErrors({}); setShowAddNewMaterialModal(false); }}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">اسم الخامة (عربي) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="text" className="form-input" style={{ border: formErrors.nameArabic ? '1px solid #ef4444' : undefined }}
                    value={formData.nameArabic} onChange={(e) => setFormData({ ...formData, nameArabic: e.target.value })} />
                  {formErrors.nameArabic && <small style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{formErrors.nameArabic}</small>}
                </div>
                <div className="form-group">
                  <label className="form-label">اسم الخامة (إنجليزي)</label>
                  <input type="text" className="form-input"
                    value={formData.nameEnglish} onChange={(e) => setFormData({ ...formData, nameEnglish: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">الفئة <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="form-select" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    <option value="grain">{t('inventory.grain')}</option>
                    <option value="protein">{t('inventory.protein')}</option>
                    <option value="fiber">{t('inventory.fiber')}</option>
                    <option value="mineral">{t('inventory.mineral')}</option>
                    <option value="oil">زيت</option>
                    <option value="additive">{t('inventory.additive')}</option>
                    <option value="other">{t('common.other')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">الوحدة</label>
                  <select className="form-select" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">سعر الوحدة</label>
                  <input type="number" step="0.01" className="form-input"
                    value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">المخزون الحالي</label>
                  <input type="number" step="1" className="form-input"
                    value={formData.currentStock} onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">حد إعادة الطلب</label>
                  <input type="number" step="1" className="form-input"
                    value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">الحد الأدنى للمخزون</label>
                  <input type="number" step="1" className="form-input"
                    value={formData.minStockLevel} onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">كمية إعادة التخزين</label>
                  <input type="number" step="1" className="form-input"
                    value={formData.restockQuantity} onChange={(e) => setFormData({ ...formData, restockQuantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">المورد المفضل</label>
                  <select className="form-select" value={formData.preferredSupplierId}
                    onChange={(e) => setFormData({ ...formData, preferredSupplierId: e.target.value })}>
                    <option value="">—</option>
                    {suppliers.map(s => (
                      <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setFormErrors({}); setShowAddNewMaterialModal(false); }}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? t('common.saving') : 'إضافة المادة'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // TRANSFER STOCK MODAL COMPONENT
  const TransferStockModal = () => {
    const [formData, setFormData] = useState({
      materialId: '',
      fromLocation: 'Warehouse A',
      toLocation: 'Production',
      quantity: '',
      transferType: 'INTERNAL_TRANSFER',
      reason: '',
      reference: '',
      productionOrderId: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState(null);

    const handleMaterialChange = (materialId) => {
      const material = rawMaterials.find(m => String(m._id) === String(materialId) || String(m.id) === String(materialId));
      setSelectedMaterial(material || null);
      setFormData({ ...formData, materialId });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      
      const quantity = parseFloat(formData.quantity);
      if (!quantity || quantity <= 0) {
        alert(t('inventory.enterValidQuantity'));
        setSubmitting(false);
        return;
      }

      // Must select a material
      if (!selectedMaterial) {
        alert(t('inventory.pleaseSelectMaterial'));
        setSubmitting(false);
        return;
      }
      
      // Must not exceed available stock
      const availableStock = parseFloat(selectedMaterial.quantity ?? selectedMaterial.current_stock ?? 0);
      if (quantity > availableStock) {
        alert(`${t('inventory.cannotTransferExceed')} (${availableStock} ${selectedMaterial.unit || 'kg'})`);
        setSubmitting(false);
        return;
      }
      
      try {
        // NOTE: Backend has no /transfer endpoint.
        const response = await fetch(`${API_URL}/transfer`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            raw_material_id: formData.materialId,
            quantity: quantity,
            from_location: formData.fromLocation,
            to_location: formData.toLocation,
            notes: `${formData.reason || ''} | Reference: ${formData.reference || 'N/A'} | Type: ${formData.transferType}`
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          broadcastInventoryUpdate('stockTransfer', { 
            materialId: formData.materialId,
            quantity: quantity,
            fromLocation: formData.fromLocation,
            toLocation: formData.toLocation,
            result
          });
          const unit = result?.material?.unit || selectedMaterial?.unit || 'kg';
          alert(`${t('inventory.movedQty', { qty: String(quantity), unit, from: formData.fromLocation, to: formData.toLocation })}`);
          setShowTransferModal(false);
          fetchData();
        } else {
          const errorData = await response.json();
          alert(`${t('inventory.failedTransferStock')}${errorData.message || t('common.unknownError')}`);
        }
      } catch (error) {
        console.error('Error transferring stock:', error);
        
        // Demo mode - update locally (only if enough stock)
        if (selectedMaterial) {
          const oldQuantity = parseFloat(selectedMaterial.quantity ?? selectedMaterial.current_stock ?? 0);
          if (quantity > oldQuantity) {
            alert(`${t('inventory.cannotTransferExceed')} (${oldQuantity} ${selectedMaterial.unit || 'kg'})`);
            setSubmitting(false);
            return;
          }
          const newQuantity = oldQuantity - quantity;
          
          setRawMaterials(rawMaterials.map(m => 
            String(m._id) === String(formData.materialId) ? { ...m, quantity: newQuantity, current_stock: newQuantity } : m
          ));
          
          // Add stock movement record for the transfer
          const newMovement = {
            _id: 'sm-' + Date.now(),
            materialName: selectedMaterial.name,
            materialCode: selectedMaterial.code,
            movementType: 'TRANSFER',
            quantity: -quantity,
            unitCost: selectedMaterial.costPerUnit || 0,
            totalValue: -(quantity * (selectedMaterial.costPerUnit || 0)),
            fromLocation: formData.fromLocation,
            toLocation: formData.toLocation,
            reference: formData.reference || 'MANUAL-TRANSFER',
            performedBy: 'Demo User',
            timestamp: new Date().toISOString()
          };
          setStockMovements(prev => {
            const updated = [newMovement, ...prev];
            broadcastInventoryUpdate('stockMovement', newMovement);
            return updated;
          });
          
          // Broadcast material update
          broadcastInventoryUpdate('materialUpdate', { 
            materialId: formData.materialId, 
            oldQuantity, 
            newQuantity,
            materialName: selectedMaterial.name,
            transferType: 'TRANSFER',
            fromLocation: formData.fromLocation,
            toLocation: formData.toLocation
          });
          
          alert(`${t('inventory.stockTransferredDemo')} ${selectedMaterial.name}: ${oldQuantity} → ${newQuantity} ${selectedMaterial.unit}`);
        }
        setShowTransferModal(false);
      } finally {
        setSubmitting(false);
      }
    };

    const locations = ['Warehouse A', 'Warehouse B', 'Production', 'Adjustment'];

    return (
      <div className="modal-overlay">
        <div className="modal modal-large">
          <div className="modal-header">
            <h2 className="modal-title">{t('inventory.transferStock')}</h2>
            <button className="modal-close" onClick={() => setShowTransferModal(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              {/* Material Selection */}
              <div className="form-group">
                <label className="form-label">{t('common.material')} *</label>
                <select 
                  className="form-select"
                  value={formData.materialId}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  required
                >
                  <option value="">اختر الخامة</option>
                  {rawMaterials.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.code}) - متاح: {m.quantity} {m.unit}
                    </option>
                  ))}
                </select>
                {selectedMaterial && (
                  <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                    {t('inventory.currentStock')}: {selectedMaterial.quantity} {selectedMaterial.unit} @ {formatCurrency(selectedMaterial.costPerUnit)}/{t('common.kg')}
                  </small>
                )}
              </div>
              
              {/* From/To Locations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('inventory.fromLocation')}</label>
                  <select
                    className="form-select"
                    value={formData.fromLocation}
                    onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                    required
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '20px' }}>
                  <ArrowRight className="w-6 h-6" style={{ color: '#64748b' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('inventory.toLocation')}</label>
                  <select
                    className="form-select"
                    value={formData.toLocation}
                    onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                    required
                  >
                    {locations.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">{t('inventory.quantityToTransfer')}</label>
                <input
                  type="number"
                  step="1"
                  className="form-input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  max={selectedMaterial?.quantity}
                  required
                />
                {selectedMaterial && parseFloat(formData.quantity) > selectedMaterial.quantity && (
                  <small className="form-help" style={{ color: '#ef4444' }}>
                    {t('inventory.cannotExceedAvailable')}: {selectedMaterial.quantity} {selectedMaterial.unit}
                  </small>
                )}
              </div>
              
              {/* Transfer Type */}
              <div className="form-group">
                <label className="form-label">{t('inventory.transferType')} *</label>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {['INTERNAL_TRANSFER', 'PRODUCTION_USE', 'STOCK_ADJUSTMENT'].map(type => (
                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="transferType"
                        value={type}
                        checked={formData.transferType === type}
                        onChange={(e) => setFormData({ ...formData, transferType: e.target.value })}
                        required
                      />
                      <span>{type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Reference */}
              <div className="form-group">
                <label className="form-label">{t('inventory.reference')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder={t('inventory.transferRefPlaceholder')}
                />
              </div>
              
              {/* Reason */}
              <div className="form-group">
                <label className="form-label">{t('inventory.transferReason')}</label>
                <textarea
                  className="form-textarea"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder={t('inventory.transferReasonPlaceholder')}
                  rows="3"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                {t('common.cancel')}
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting || (selectedMaterial && parseFloat(formData.quantity) > selectedMaterial.quantity)}
              >
                {submitting ? t('inventory.transferring') : t('inventory.transferStock')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const approveProduction = async (productionOrder) => {
    if (!window.confirm(t('inventory.confirmApprove', { number: productionOrder.productionNumber }))) return;
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/approve`, {
        method: 'PUT',
        headers: headers()
      });
      if (response.ok) {
        alert(t('inventory.productionApproved'));
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(t('inventory.failedApproveProduction') + (errorData.error || t('common.unknownError')));
      }
    } catch (error) {
      console.error('Error approving production:', error);
      alert(t('inventory.failedApproveProduction') + (error.message || t('common.unknownError')));
    }
  };

  const startProduction = async (productionOrder) => {
    if (!window.confirm(t('inventory.confirmStart', { number: productionOrder.productionNumber }))) {
      return;
    }
    
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/start`, {
        method: 'PUT',
        headers: headers()
      });
      
      if (response.ok) {
        alert(t('inventory.productionStarted'));
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(t('inventory.failedStartProduction') + (errorData.error || t('common.unknownError')));
      }
    } catch (error) {
      console.error('Error starting production:', error);
      alert(t('inventory.failedStartProduction') + (error.message || t('common.unknownError')));
    }
  };

  const completeProduction = async (productionOrder) => {
    if (!window.confirm(t('inventory.confirmComplete', { number: productionOrder.productionNumber }))) {
      return;
    }
    
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/complete`, {
        method: 'PUT',
        headers: headers()
      });
      
      if (response.ok) {
        alert(t('inventory.productionCompleted'));
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(t('inventory.failedCompleteProduction') + (errorData.error || t('common.unknownError')));
      }
    } catch (error) {
      console.error('Error completing production:', error);
      alert(t('inventory.failedCompleteProduction') + (error.message || t('common.unknownError')));
    }
  };

  // MATERIAL DETAIL MODAL COMPONENT
  const MaterialDetailModal = ({ material, movements, onClose }) => {
    const [editForm, setEditForm] = useState({
      unit_price: material.unit_price || '',
      reorder_level: material.reorder_level || '',
      min_stock_level: material.min_stock_level || '',
      restock_quantity: material.restock_quantity || ''
    });
    const [saving, setSaving] = useState(false);
    const [availableSuppliers, setAvailableSuppliers] = useState([]);
    const [preferredSupplierId, setPreferredSupplierId] = useState(material.preferred_supplier_id || '');

    useEffect(() => {
      fetch(`${API_URL}/raw-materials/${material.id}/available-suppliers`, { headers: headers() })
        .then(res => res.json())
        .then(data => {
          const list = data.suppliers || [];
          setAvailableSuppliers(list);
          if (!material.preferred_supplier_id) {
            const preferred = list.find(s => s.is_preferred);
            if (preferred) setPreferredSupplierId(preferred.id);
          }
        })
        .catch(() => setAvailableSuppliers([]));
    }, [material.id]);

    const handleSave = async () => {
      setSaving(true);
      try {
        const response = await fetch(`${API_URL}/raw-materials/${material.id}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify({
            unit_price: editForm.unit_price !== '' ? parseFloat(editForm.unit_price) : undefined,
            reorder_level: editForm.reorder_level !== '' ? parseFloat(editForm.reorder_level) : undefined,
            min_stock_level: editForm.min_stock_level !== '' ? parseFloat(editForm.min_stock_level) : undefined,
            restock_quantity: editForm.restock_quantity !== '' ? parseFloat(editForm.restock_quantity) : null,
            preferred_supplier_id: preferredSupplierId || null
          })
        });
        if (response.ok) {
          alert('تم الحفظ بنجاح');
          fetchData();
        } else {
          const data = await response.json();
          alert('فشل الحفظ: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('فشل الحفظ');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-large" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2 className="modal-title">{material.name_arabic || material.name || ''}</h2>
            <button className="modal-close" onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
          <div className="modal-body" style={{ overflowY: 'auto', maxHeight: '70vh' }}>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '12px', color: '#1e293b', fontSize: '16px', fontWeight: 600 }}>تفاصيل المادة</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">سعر الوحدة</label>
                  <input type="number" step="0.01" className="form-input"
                    value={editForm.unit_price} onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">حد إعادة الطلب</label>
                  <input type="number" step="1" className="form-input"
                    value={editForm.reorder_level} onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">الحد الأدنى للمخزون</label>
                  <input type="number" step="1" className="form-input"
                    value={editForm.min_stock_level} onChange={(e) => setEditForm({ ...editForm, min_stock_level: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">كمية إعادة التخزين</label>
                  <input type="number" step="1" className="form-input"
                    value={editForm.restock_quantity} onChange={(e) => setEditForm({ ...editForm, restock_quantity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">المورد المفضل</label>
                  {availableSuppliers.length > 0 ? (
                    <select className="form-select" value={preferredSupplierId}
                      onChange={(e) => setPreferredSupplierId(e.target.value)}>
                      <option value="">—</option>
                      {availableSuppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-input" style={{ background: '#f8fafc', display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: '#6b7280' }}>لا يوجد مورد مسجل لهذه المادة</span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
            {material.used_in_recipes && material.used_in_recipes.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '12px', color: '#1e293b', fontSize: '16px', fontWeight: 600 }}>تستخدم في الوصفات</h3>
                <table className="table">
                  <thead><tr><th>الوصفة</th><th>نوع العلف</th><th>الكمية (كجم)</th></tr></thead>
                  <tbody>
                    {material.used_in_recipes.map((r, i) => (
                      <tr key={i}><td>{r.recipe_name}</td><td>{r.feed_type_name || '—'}</td><td>{r.quantity_kg}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div>
              <h3 style={{ marginBottom: '12px', color: '#1e293b', fontSize: '16px', fontWeight: 600 }}>{t('inventory.movements')}</h3>
              {movements.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('inventory.type')}</th>
                      <th>{t('common.quantity')}</th>
                      <th>{t('common.reference')}</th>
                      <th>{t('common.notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m, i) => (
                      <tr key={m.id || i}>
                        <td>{formatDate(m.created_at)}</td>
                        <td><span className={`badge ${m.transaction_type === 'production' ? 'badge-info' : m.transaction_type === 'purchase' ? 'badge-success' : 'badge-warning'}`}>{m.transaction_type}</span></td>
                        <td style={{ color: m.quantity < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{m.quantity}</td>
                        <td>{m.reference_id ? `#${m.reference_id}` : '-'}</td>
                        <td>{m.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280' }}><p>{t('common.noData')}</p></div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('nav.inventory')}</h1>
          <p>{t('inventory.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeTab === 'raw' && (
            <>
              <button
                onClick={() => setShowAddStockModal(true)}
                className="btn btn-success"
              >
                <PlusCircle className="w-5 h-5" />
                {t('inventory.addStock')}
              </button>
              <button
                onClick={() => setShowAddNewMaterialModal(true)}
                className="btn btn-primary"
              >
                <Plus className="w-5 h-5" />
                إضافة مادة جديدة
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="btn btn-secondary"
              >
                <ArrowLeftRight className="w-5 h-5" />
                {t('inventory.transferStock')}
              </button>
            </>
          )}
          {activeTab === 'finished' && (
            <button 
              onClick={() => alert(t('inventory.finishedGoodsNote'))}
              className="btn btn-primary"
            >
              <Plus className="w-5 h-5" />
              {t('inventory.addFinishedGood')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('raw')}
          className={`btn ${activeTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Box className="w-4 h-4" />
          {t('nav.inventory')}
        </button>
        <button
          onClick={() => setActiveTab('finished')}
          className={`btn ${activeTab === 'finished' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Package className="w-4 h-4" />
          {t('inventory.finishedGoods')}
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`btn ${activeTab === 'production' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Factory className="w-4 h-4" />
          {t('nav.production')}
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`btn ${activeTab === 'recipes' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ChefHat className="w-4 h-4" />
          {t('nav.feedRecipes')}
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <History className="w-4 h-4" />
          {t('inventory.stockMovements')}
        </button>
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`btn ${activeTab === 'requisitions' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText className="w-4 h-4" />
          {t('inventory.requisitions')}
        </button>
        <button
          onClick={() => setActiveTab('purchase-orders')}
          className={`btn ${activeTab === 'purchase-orders' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Truck className="w-4 h-4" />
          {t('nav.purchaseOrders')}
        </button>
      </div>

      {stats && activeTab !== 'movements' && (
        <div className="stats-grid">
          {activeTab === 'raw' && (
            <>
              <div className="stat-card">
                <p className="stat-label">{t('inventory.totalMaterials')}</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('common.totalValue')}</p>
                    <p className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(stats.totalValue || 0)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('common.totalQuantity')}</p>
                <p className="stat-value">{formatNumber((stats.totalQuantity || 0))} kg</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('inventory.lowStock')}</p>
                <p className="stat-value" style={{ color: '#ef4444' }}>{stats.lowStockCount || stats.lowStock || 0}</p>
              </div>
              {Object.entries(stats.byCategory || {}).map(([category, count]) => (
                <div key={category} className="stat-card">
                  <p className="stat-label capitalize">{category}</p>
                  <p className="stat-value">{count}</p>
                </div>
              ))}
            </>
          )}
          {activeTab === 'finished' && (
            <>
              <div className="stat-card">
                <p className="stat-label">إجمالي العناصر</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">إجمالي الأطنان</p>
                <p className="stat-value" style={{ color: '#10b981' }}>{stats.totalTons || 0}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">إجمالي الأكياس</p>
                <p className="stat-value">{stats.totalBags || 0}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('inventory.lowStockUnder5Tons')}</p>
                <p className="stat-value" style={{ color: '#ef4444' }}>{stats.lowStock || stats.lowStockCount || 0}</p>
              </div>
              {Object.entries(stats.byPackageSize || {}).map(([size, count]) => (
                <div key={size} className="stat-card">
                   <p className="stat-label">{size} {t('common.bags')}</p>
                  <p className="stat-value">{count}</p>
                </div>
              ))}
            </>
          )}
          {activeTab === 'production' && (
            <>
              <div className="stat-card">
                <p className="stat-label">إجمالي الطلبات</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">اليوم</p>
                <p className="stat-value">{stats.todayOrders || 0}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">الإنتاج (كجم)</p>
                <p className="stat-value" style={{ color: '#10b981' }}>{(stats.todayOutput || stats.todayOutputWeight || 0).toFixed(0)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('common.statuses.pending')}</p>
                <p className="stat-value">{stats.pending || 0}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('production.inProgress')}</p>
                <p className="stat-value">{stats.inProgress || 0}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('common.statuses.completed')}</p>
                <p className="stat-value">{stats.completed || 0}</p>
              </div>
            </>
          )}
          {activeTab === 'recipes' && (
            <>
              <div className="stat-card">
                <p className="stat-label">إجمالي التركيبات</p>
                <p className="stat-value">{stats.total}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">{t('common.statuses.active')}</p>
                <p className="stat-value" style={{ color: '#10b981' }}>{stats.active}</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">متوسط التكلفة/1000 كجم</p>
                <p className="stat-value">{formatCurrency(stats.avgCost || 0)}</p>
              </div>
              {(stats.byFeedType || []).map((ft) => (
                <div key={ft._id} className="stat-card">
                  <p className="stat-label">{ft._id}</p>
                  <p className="stat-value">{ft.count}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div className="table-container">
        {loading ? (
          <div className="p-6 text-center">{t('common.loading')}</div>
        ) : activeTab === 'raw' ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.material')}</th>
                <th>{t('common.category')}</th>
                <th>{t('inventory.currentStock')}</th>
                <th>{t('inventory.avgCost')}</th>
                <th>{t('common.totalValue')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length === 0 ? (
                <tr><td colSpan="6" className="text-center">{t('inventory.noMaterials')}</td></tr>
              ) : rawMaterials.map((mat) => (
                <tr key={mat._id} onClick={() => handleMaterialClick(mat)} style={{ cursor: 'pointer' }}>
                  <td onClick={(e) => handleMaterialNameClick(mat, e)} style={{ cursor: 'pointer' }}>
                    <p className="font-medium" style={{ color: '#2563eb', textDecoration: 'underline' }}>{mat.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{mat.code}</p>
                  </td>
                  <td className="capitalize">{getCategoryLabel(mat.category)}</td>
                  <td>
                    <p className="font-medium">{mat.quantity} {mat.unit}</p>
                    {mat.quantity <= mat.minimumStock && (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <AlertTriangle className="w-3 h-3" />
                        {t('inventory.lowStockBadge')}
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(mat.costPerUnit || 0)}</td>
                  <td>{formatCurrency((mat.quantity || 0) * (mat.costPerUnit || 0))}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(mat.status)}`}>
                      {getStockStatusLabel(mat.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'finished' ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t('common.feedType')}</th>
                <th>{t('common.package')}</th>
                <th>{t('common.bags')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('inventory.batch')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {finishedGoods.length === 0 ? (
                <tr><td colSpan="6" className="text-center">{t('inventory.noFinishedGoods')}</td></tr>
              ) : finishedGoods.map((good) => (
                <tr key={good._id}>
                  <td>
                    <p className="font-medium">{good.feedType?.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{good.feedType?.code}</p>
                  </td>
                  <td>{good.packageSize} {t('common.kg')} {t('inventory.bag')}</td>
                  <td>
                    <p className="font-medium">{good.numberOfBags}</p>
                  </td>
                  <td>
                    <p className="font-medium">{good.quantityTons} {t('common.tons')}</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{formatNumber(good.quantityKg)} {t('common.kg')}</p>
                  </td>
                  <td>
                    <p>{good.batchNumber}</p>
                    {good.productionOrderNumber && (
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('common.orderNumber')}: {good.productionOrderNumber}</p>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(good.status)}`}>
                      {getStatusLabel(good.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'production' ? (
          <table className="table">
            <thead>
              <tr>
                <th>{t('inventory.orderNumber')}</th>
                <th>{t('common.feedType')}</th>
                <th>{t('inventory.output')}</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {productionOrders.length === 0 ? (
                <tr><td colSpan="6" className="text-center">{t('production.none')}</td></tr>
              ) : productionOrders.map((prod) => (
                <tr key={prod._id}>
                  <td>
                    <p className="font-medium">{prod.productionNumber}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{t('inventory.batch')}: {prod.batchNumber}</p>
                  </td>
                  <td>{prod.feedType?.name}</td>
                  <td>
                    <p className="font-medium">{prod.totalBags} {t('common.bagsUnit')}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{prod.totalOutputWeight} {t('common.kg')}</p>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(prod.status)}`}>
                      {getStatusLabel(prod.status)}
                    </span>
                  </td>
                  <td>
                    {prod.createdAt ? formatDate(prod.createdAt) : '-'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {prod.status === 'draft' && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          title={t('common.approve')}
                          onClick={() => approveProduction(prod)}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {prod.status === 'approved' && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          title={t('common.start')}
                          onClick={() => startProduction(prod)}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {prod.status === 'in_progress' && (
                        <button 
                          className="btn btn-sm btn-success" 
                          title={t('common.complete')}
                          onClick={() => completeProduction(prod)}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activeTab === 'recipes' ? (
          <table className="table">
            <thead>
               <tr>
                  <th>{t('recipes.name')}</th>
                  <th>{t('common.feedType')}</th>
                  <th>{t('recipes.version')}</th>
                  <th>{t('recipes.ingredients')}</th>
                  <th>{t('recipes.costPerTon')}</th>
                  <th>{t('recipes.sellPerTon')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('recipes.usage')}</th>
                </tr>
              </thead>
              <tbody>
                {recipes.length === 0 ? (
                  <tr><td colSpan="10" className="text-center">{t('recipes.none')}</td></tr>
                ) : recipes.map((recipe) => {
                  const p = recipe.pricing || {};
                  return (
                  <tr key={recipe._id}>
                    <td>
                      <p className="font-medium">{recipe.name}</p>
                      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {t('recipes.protein')}: {recipe.protein || '-'}% | {t('recipes.energy')}: {recipe.energy || '-'}
                      </p>
                    </td>
                    <td>{recipe.feedType?.name || t('recipes.notAvailable')}</td>
                    <td>{recipe.version || '-'}</td>
                    <td>{recipe.ingredientCount || recipe.ingredients?.length || '-'}</td>
                    <td>{formatCurrency(recipe.totalCost || 0)}</td>
                    <td>{formatCurrency(parseFloat(p.cost_per_ton || 0))}</td>
                    <td>{formatCurrency(parseFloat(p.sell_per_ton || 0))}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(recipe.status)}`}>
                        {getStatusLabel(recipe.status)}
                      </span>
                    </td>
                    <td>{recipe.usageCount || 0} {t('recipes.times')}</td>
                  </tr>
                )})}
            </tbody>
          </table>
        ) : activeTab === 'requisitions' ? (
          // Requisitions Tab
          (() => {
            const statusMap = {
              'draft':     { label: 'مسودة',           color: '#f59e0b', bg: '#fef3c7' },
              'sent':      { label: 'مرسل للموردين',   color: '#3b82f6', bg: '#dbeafe' },
              'completed': { label: 'مكتمل',           color: '#10b981', bg: '#d1fae5' },
              'cancelled': { label: 'ملغي',            color: '#ef4444', bg: '#fee2e2' },
            };
            const openPreview = async () => {
              setLoading(true);
              const result = await requisitionService.preview();
              setLoading(false);
              if (result.success && result.items && result.items.length > 0) {
                setPreviewItems(result.items);
                setPreviewBySupplier(result.bySupplier || []);
                setPreviewTotalCost(result.totalCost || 0);
                setShowPreviewModal(true);
              } else {
                alert(result.message || 'لا توجد مواد أقل من مستوى إعادة الطلب');
              }
            };
            return (
            <div>
              {/* Header row — button always at top right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0 }}>طلبات الاحتياج</h3>
                <button onClick={openPreview} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus className="w-4 h-4" /> إنشاء من المخزون المنخفض
                </button>
              </div>

              {/* Section 1 — Low stock alert */}
              {lowStockItems.length > 0 && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontWeight: 700, color: '#9a3412', fontSize: '15px' }}>
                    <AlertTriangle size={20} color="#f97316" />
                    المواد المنخفضة في المخزون ({lowStockItems.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lowStockItems.map((item, idx) => {
                      const isCritical = item.current_stock <= (item.min_stock_level || 0) && item.min_stock_level > 0;
                      return (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: isCritical ? '#fef2f2' : '#fffbeb',
                          borderRadius: '8px', padding: '10px 16px',
                          border: `1px solid ${isCritical ? '#fca5a5' : '#fde68a'}`,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: isCritical ? '#dc2626' : '#f97316', flexShrink: 0 }} />
                            <span style={{
                              background: isCritical ? '#fee2e2' : '#fef3c7',
                              color: isCritical ? '#991b1b' : '#92400e',
                              padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace'
                            }}>
                              {item.material_code || '—'}
                            </span>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>{item.material_name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                            <span style={{ color: '#64748b' }}>الحالي: <strong style={{ color: isCritical ? '#dc2626' : '#ea580c' }}>{item.current_stock} {item.unit}</strong></span>
                            <span style={{ color: '#64748b' }}>حد الطلب: <strong style={{ color: '#d97706' }}>{item.reorder_level} {item.unit}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section 2 — Requisitions list */}
              {requisitions.length === 0 ? (
                <div style={{ padding: '52px', textAlign: 'center', color: '#9ca3af' }}>
                  <FileText size={48} style={{ marginBottom: '12px', opacity: 0.25 }} />
                  <p style={{ fontSize: '15px', fontWeight: 500, margin: 0 }}>لا توجد طلبات احتياج بعد</p>
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>التاريخ</th>
                      <th>عدد العناصر</th>
                      <th>إجمالي التكلفة</th>
                      <th>الحالة</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requisitions.map((req) => {
                      const st = statusMap[req.status] || { label: req.status, color: '#6b7280', bg: '#f3f4f6' };
                      return (
                        <tr key={req.id}>
                          <td style={{ fontWeight: 600 }}>{req.requisition_number}</td>
                          <td>{formatDate(req.created_at)}</td>
                          <td>{req.item_count || req.total_items || 0}</td>
                          <td>{formatCurrency(parseFloat(req.total_cost || 0))}</td>
                          <td>
                            <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 600 }}>
                              {st.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`${API_BASE_URL}/requisitions/${req.id}`, { headers: headers() });
                                    const data = await res.json();
                                    if (data.success) setReqDetailData(data);
                                  } catch (e) {
                                    alert('تعذر تحميل التفاصيل');
                                  }
                                }}
                                className="btn btn-sm btn-secondary"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye className="w-3 h-3" /> عرض
                              </button>
                              {req.status === 'draft' && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('إرسال الطلب للموردين؟ سيتم إنشاء أوامر شراء تلقائياً.')) return;
                                    setLoading(true);
                                    try {
                                      const result = await requisitionService.sendToSuppliers(req.id);
                                      if (result.success) {
                                        fetchData();
                                        alert(result.message || 'تم إرسال الطلب للموردين بنجاح!');
                                      } else {
                                        alert(result.error || 'فشل إرسال الطلب');
                                      }
                                    } catch (e) {
                                      alert('خطأ في الشبكة: ' + (e.message || 'تعذر الوصول للخادم'));
                                    }
                                    setLoading(false);
                                  }}
                                  className="btn btn-sm btn-primary"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Send className="w-3 h-3" /> إرسال لأوامر الشراء
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Detail modal */}
              {reqDetailData && (
                <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setReqDetailData(null)}>
                  <div className="modal modal-large" style={{ maxWidth: '720px', maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3 style={{ margin: 0 }}>تفاصيل الطلب — {reqDetailData.requisition?.requisition_number}</h3>
                      <button className="modal-close" onClick={() => setReqDetailData(null)}><X size={20} /></button>
                    </div>
                    <div className="modal-body">
                      {(() => {
                        const st = statusMap[reqDetailData.requisition?.status] || { label: reqDetailData.requisition?.status, color: '#6b7280', bg: '#f3f4f6' };
                        return (
                          <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>{st.label}</span>
                            <span style={{ fontSize: '13px', color: '#6b7280' }}>{formatDate(reqDetailData.requisition?.created_at)}</span>
                            {reqDetailData.requisition?.notes && (
                              <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>{reqDetailData.requisition.notes}</span>
                            )}
                          </div>
                        );
                      })()}
                      <table className="table">
                        <thead>
                          <tr>
                            <th>اسم المادة</th>
                            <th>الكمية المطلوبة</th>
                            <th>الوحدة</th>
                            <th>التكلفة التقديرية</th>
                            <th>المورد المفضل</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(reqDetailData.items || []).map((item, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>{item.name_arabic || item.material_name || item.raw_material_id}</td>
                              <td style={{ fontWeight: 600 }}>{item.suggested_quantity}</td>
                              <td>{item.unit || 'kg'}</td>
                              <td>{formatCurrency(item.total_cost)}</td>
                              <td>{item.supplier_name || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
                      <button className="btn btn-secondary" onClick={() => setReqDetailData(null)}>إغلاق</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Modal */}
              {showPreviewModal && (
                <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setShowPreviewModal(false)}>
                  <div className="modal modal-large" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <AlertTriangle size={24} color="#f59e0b" />
                        معاينة المخزون المنخفض
                      </h3>
                      <button className="modal-close" onClick={() => setShowPreviewModal(false)}>
                        <X size={20} />
                      </button>
                    </div>
                    <div className="modal-body">
                      <div style={{ background: '#fefce8', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #facc15' }}>
                        <div style={{ fontWeight: 600, color: '#854d0e', marginBottom: '4px' }}>
                          {previewItems.length} مادة أقل من مستوى إعادة الطلب
                        </div>
                        <div style={{ color: '#a16207', fontSize: '14px' }}>
                          التكلفة الإجمالية التقديرية: <strong>{formatCurrency(previewTotalCost)}</strong>
                        </div>
                      </div>
                      {previewBySupplier.map((group, gIdx) => (
                        <div key={gIdx} style={{ marginBottom: '24px' }}>
                          <h4 style={{ margin: '0 0 12px 0', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Truck size={16} color="#3b82f6" />
                            {group.supplier_name || 'لا يوجد مورد مفضل'}
                            {group.supplier_id && (
                              <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400 }}>({group.items.length} عنصر)</span>
                            )}
                          </h4>
                          <table className="table" style={{ marginBottom: '0' }}>
                            <thead>
                              <tr>
                                <th>المادة</th>
                                <th>المخزون الحالي</th>
                                <th>مستوى إعادة الطلب</th>
                                <th>الكمية المقترحة</th>
                                <th>سعر الوحدة</th>
                                <th>الإجمالي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item, iIdx) => (
                                <tr key={iIdx}>
                                  <td>
                                    <div style={{ fontWeight: 500 }}>{item.material_name}</div>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.material_code}</div>
                                  </td>
                                  <td>{formatNumber(item.current_stock)} {item.unit}</td>
                                  <td>{formatNumber(item.reorder_level)} {item.unit}</td>
                                  <td style={{ fontWeight: 600, color: '#2563eb' }}>{formatNumber(item.suggested_quantity)} {item.unit}</td>
                                  <td>{formatCurrency(item.unit_price)}</td>
                                  <td style={{ fontWeight: 600 }}>{formatCurrency(item.total_cost)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                    <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 24px', borderTop: '1px solid #e5e7eb' }}>
                      <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>إلغاء</button>
                      <button
                        className="btn btn-primary"
                        onClick={async () => {
                          setShowPreviewModal(false);
                          setLoading(true);
                          const result = await requisitionService.generate();
                          setLoading(false);
                          if (result.success) {
                            fetchData();
                            alert('تم إنشاء الطلب بنجاح!');
                          } else {
                            alert(result.error || 'فشل إنشاء طلب الاحتياج');
                          }
                        }}
                      >
                        <Check className="w-4 h-4" style={{ marginRight: '6px', display: 'inline' }} />
                        تأكيد وإنشاء الطلب
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })()
        ) : activeTab === 'purchase-orders' ? (
          // Purchase Orders Tab
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>أوامر الشراء الواردة</h3>
              <button
                className="btn btn-primary"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? 'جارٍ التحديث...' : 'تحديث'}
              </button>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="empty-state">
                <Package className="w-12 h-12" style={{ color: '#9ca3af', marginBottom: '12px' }} />
                <p className="empty-state-title">لا توجد أوامر شراء</p>
                <p>لم يتم العثور على أوامر شراء. أنشئ أمراً من صفحة أوامر الشراء أو أرسل طلب احتياج.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم أمر الشراء</th>
                    <th>{t('common.supplier')}</th>
                    <th>{t('common.items')}</th>
                    <th>{t('common.total')}</th>
                    <th>{t('common.status')}</th>
                    <th>التاريخ المتوقع</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="font-medium">{po.po_number}</td>
                      <td>{po.supplier_name || po.supplier?.name || '-'}</td>
                      <td>{po.item_count || (po.items?.length || 0)} {t('common.items')}</td>
                      <td>{formatCurrency(parseFloat(po.total_amount || po.total || 0))}</td>
                      <td>
                        <span className={`badge ${po.status === 'approved' ? 'badge-success' : po.status === 'rejected' ? 'badge-danger' : po.status === 'pending_approval' ? 'badge-warning' : 'badge-secondary'}`}>
                          {po.status || 'unknown'}
                        </span>
                      </td>
                      <td>{po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-GB') : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {(po.status === 'draft' || po.status === 'pending_approval') && (
                            <>
                              <button
                                className="btn btn-sm btn-success"
                                onClick={async () => {
                                  if (!window.confirm(`اعتماد أمر الشراء ${po.po_number}؟`)) return;
                                  setLoading(true);
                                  try {
                                    const result = await purchaseOrdersService.approve(po.id);
                                    setLoading(false);
                                    if (result && !result.error) {
                                      alert('تم اعتماد أمر الشراء بنجاح');
                                      fetchData();
                                    } else {
                                      alert(result?.error || 'فشل اعتماد أمر الشراء');
                                    }
                                  } catch (err) {
                                    setLoading(false);
                                    alert('خطأ: ' + err.message);
                                  }
                                }}
                              >
                                <Check className="w-3 h-3" />
                                قبول
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={async () => {
                                  if (!window.confirm(`رفض أمر الشراء ${po.po_number}؟`)) return;
                                  setLoading(true);
                                  try {
                                    const result = await purchaseOrdersService.reject(po.id);
                                    setLoading(false);
                                    if (result && !result.error) {
                                      alert('تم رفض أمر الشراء');
                                      fetchData();
                                    } else {
                                      alert(result?.error || 'فشل رفض أمر الشراء');
                                    }
                                  } catch (err) {
                                    setLoading(false);
                                    alert('خطأ: ' + err.message);
                                  }
                                }}
                              >
                                <X className="w-3 h-3" />
                                رفض
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          // Stock Movements Tab
          <>
            {/* Filters */}
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter className="w-4 h-4" style={{ color: '#64748b' }} />
                <span style={{ fontSize: '14px', fontWeight: 500 }}>تصفية:</span>
              </div>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                placeholder="من تاريخ"
                value={movementFilters.startDate}
                onChange={(e) => setMovementFilters({ ...movementFilters, startDate: e.target.value })}
              />
              <span style={{ color: '#64748b' }}>إلى</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                placeholder="إلى تاريخ"
                value={movementFilters.endDate}
                onChange={(e) => setMovementFilters({ ...movementFilters, endDate: e.target.value })}
              />
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={movementFilters.material}
                onChange={(e) => setMovementFilters({ ...movementFilters, material: e.target.value })}
              >
                <option value="">{t('inventory.allMaterials')}</option>
                {rawMaterials.map(m => (
                  <option key={m._id} value={m._id}>{m.name}</option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: '150px' }}
                value={movementFilters.movementType}
                onChange={(e) => setMovementFilters({ ...movementFilters, movementType: e.target.value })}
              >
                <option value="">الكل</option>
                <option value="purchase">شراء</option>
                <option value="sale">بيع</option>
                <option value="production">إنتاج</option>
                <option value="transfer">تحويل</option>
                <option value="adjustment">تسوية</option>
                <option value="return">مرتجع</option>
                <option value="opening">رصيد افتتاحي</option>
              </select>
            </div>
            
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.material')}</th>
                  <th>{t('inventory.type')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>{t('inventory.unitCost')}</th>
                  <th>{t('common.totalValue')}</th>
                  <th>{t('common.reference')}</th>
                  <th>{t('common.user')}</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.length === 0 ? (
                  <tr><td colSpan="8" className="text-center">{t('inventory.noMovements')}</td></tr>
                ) : stockMovements
                  .filter(m => {
                    if (movementFilters.material && m.materialId !== movementFilters.material) return false;
                    if (movementFilters.movementType && m.movementType !== movementFilters.movementType) return false;
                    if (movementFilters.startDate && new Date(m.timestamp) < new Date(movementFilters.startDate)) return false;
                    if (movementFilters.endDate && new Date(m.timestamp) > new Date(movementFilters.endDate)) return false;
                    return true;
                  })
                  .map((movement) => (
                  <tr key={movement._id}>
                    <td>
                      {movement.timestamp ? formatDate(movement.timestamp) : '-'}
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {movement.timestamp ? new Date(movement.timestamp).toLocaleTimeString() : ''}
                      </p>
                    </td>
                    <td>
                      <p className="font-medium">{movement.materialName}</p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{movement.materialCode}</p>
                    </td>
                    <td>
                      <span className={`badge ${getMovementTypeBadge(movement.movementType)}`}>
                        {formatMovementType(movement.movementType)}
                      </span>
                    </td>
                    <td style={{ 
                      color: movement.quantity > 0 ? '#10b981' : movement.quantity < 0 ? '#ef4444' : '#374151',
                      fontWeight: 500
                    }}>
                      {movement.quantity > 0 ? '+' : ''}{displayQty(Math.abs(movement.quantity), movement.unit)}
                    </td>
                    <td>{movement.unitCost ? formatCurrency(movement.unitCost) : '-'}</td>
                    <td>{formatCurrency(Math.abs(movement.totalValue || 0))}</td>
                    <td>
                      {movement.reference && (
                        <p className="font-medium">{movement.reference}</p>
                      )}
                      {movement.supplier && (
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{movement.supplier}</p>
                      )}
                      {movement.fromLocation && (
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {movement.fromLocation} → {movement.toLocation}
                        </p>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User className="w-3 h-3" style={{ color: '#64748b' }} />
                        <span>{movement.performedBy}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Pagination (raw materials tab only) */}
      {activeTab === 'raw' && !loading && rawMaterials.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            السابق
          </button>
          <span className="text-sm text-gray-600">صفحة {page} من {totalPages}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            التالي
          </button>
        </div>
      )}

      {/* Render Modals */}
      {showAddStockModal && <AddStockModal />}
      {showAddNewMaterialModal && <AddNewMaterialModal />}
      {showTransferModal && <TransferStockModal />}
      
      {/* Material Movements Modal */}
      {showMovementsModal && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('inventory.movements')} - {selectedMaterial?.name || selectedMaterial?.name_arabic || ''}</h2>
              <button className="modal-close" onClick={() => setShowMovementsModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="modal-body">
              {materialMovements.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('inventory.type')}</th>
                      <th>{t('common.quantity')}</th>
                      <th>{t('common.reference')}</th>
                      <th>{t('common.notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialMovements.map((m, i) => (
                      <tr key={m.id || i}>
                        <td>{formatDate(m.created_at)}</td>
                        <td><span className={`badge ${m.transaction_type === 'production' ? 'badge-info' : m.transaction_type === 'purchase' ? 'badge-success' : 'badge-warning'}`}>{m.transaction_type}</span></td>
                        <td style={{ color: m.quantity < 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{m.quantity}</td>
                        <td>{m.reference_id ? `#${m.reference_id}` : '-'}</td>
                        <td>{m.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
                  <p>{t('common.noData')}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMovementsModal(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Material Detail Modal */}
      {showMaterialDetailModal && materialDetailData && (
        <MaterialDetailModal
          material={materialDetailData}
          movements={materialMovements}
          onClose={() => setShowMaterialDetailModal(false)}
        />
      )}
    </div>
  );
}