import React, { useState, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Package, Plus, Search, AlertTriangle, TrendingDown, 
  TrendingUp, Clock, Check, X, Play, Pause,
  ChevronDown, Truck, Box, Factory, ChefHat,
  ArrowLeftRight, PlusCircle, History, Filter, User,
  ArrowRight, Warehouse, DollarSign, FileText, Send
} from 'lucide-react';
import { requisitionService, purchaseOrdersService } from '../services/api';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_URL = `${API_BASE_URL}/inventory`;
const PRODUCTION_API_URL = `${API_BASE_URL}/production`;
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
  
  // Modal states
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [requisitions, setRequisitions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewBySupplier, setPreviewBySupplier] = useState([]);
  const [previewTotalCost, setPreviewTotalCost] = useState(0);
  
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
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'raw') {
        // Fetch from PostgreSQL
        const [materialsRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/raw-materials`, { headers: headers() }),
          fetch(`${API_URL}/dashboard`, { headers: headers() })
        ]);
        const materials = await materialsRes.json();
        const statsData = await statsRes.json();
        // PostgreSQL returns array directly
        const materialsData = Array.isArray(materials) ? materials : materials.materials || [];
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
        setStats({
          total: parseInt(statsData.total_materials) || 0,
          totalValue: parseFloat(statsData.total_inventory_value) || 0,
          totalQuantity: 0,
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
        const prodData = prod.orders || prod.productionOrders || prod || [];
        const mappedProd = prodData.map(o => ({
          _id: o.id,
          id: o.id,
          productionNumber: o.order_number,
          batchNumber: o.batch_number,
          feedType: {
            name: o.feed_name_english || o.feed_name_arabic || 'Unknown'
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
        const recipesRes = await fetch(`${API_URL.replace('/inventory', '/feed-recipes')}/recipes`, { headers: headers() });
        const recipesData = await recipesRes.json();
        const recData = Array.isArray(recipesData) ? recipesData : recipesData?.data || [];
        const mappedRecipes = recData.map(r => ({
          _id: r.id,
          name: r.name,
          protein: r.protein_percentage,
          feedType: {
            name: r.feed_name_english || r.feed_name_arabic || 'Unknown'
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
        const finishedRes = await fetch(`${API_BASE_URL}/production/finished-goods`, { headers: headers() });
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
        const movementsRes = await fetch(`${API_BASE_URL}/inventory/movements?limit=100`, { headers: headers() });
        const movementsData = movementsRes.ok ? await movementsRes.json() : { movements: [] };
        // Map API format to frontend format
        const mapped = (movementsData.movements || []).map(m => ({
          _id: m.id,
          id: m.id,
          materialId: m.raw_material_id,
          materialName: m.material_name || m.material_name_ar || 'Unknown',
          materialCode: m.material_code || '',
          movementType: m.transaction_type || 'adjustment',
          quantity: parseFloat(m.quantity) || 0,
          unitCost: parseFloat(m.unit_price) || 0,
          totalValue: parseFloat(m.total_cost) || 0,
          reference: m.reference_type ? `${m.reference_type} #${m.reference_id || ''}` : m.notes || '',
          notes: m.notes || '',
          timestamp: m.created_at,
          unit: m.unit || 'kg'
        }));
        setStockMovements(mapped);
      } else if (activeTab === 'requisitions') {
        const reqRes = await requisitionService.getAll();
        if (reqRes.success) {
          setRequisitions(reqRes.requisitions || []);
        }
      } else if (activeTab === 'purchase-orders') {
        const poRes = await purchaseOrdersService.getPurchaseOrders();
        if (poRes.success || poRes.purchaseOrders) {
          setPurchaseOrders(poRes.purchaseOrders || poRes.data || []);
        }
      }
      
      // Fetch suppliers for Add Stock modal (using legacy endpoint)
      try {
        const suppliersRes = await fetch(`${API_URL.replace('/api/inventory', '/api/suppliers')}`, { headers: headers() });
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

  const getMovementTypeBadge = (type) => {
    const badges = {
      PURCHASE: 'badge-success',
      TRANSFER: 'badge-info',
      RECEIPT: 'badge-primary',
      PRODUCTION: 'badge-warning',
      ADJUSTMENT: 'badge-danger',
      NEW_MATERIAL: 'badge-success'
    };
    return badges[type] || 'badge-info';
  };

  const formatMovementType = (type) => {
    return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  // ADD STOCK MODAL COMPONENT
  const AddStockModal = () => {
    const [formData, setFormData] = useState({
      materialId: '',
      isNewMaterial: false,
      newMaterialName: '',
      newMaterialCode: '',
      newMaterialCategory: 'grain',
      quantity: '',
      unit: 'kg',
      costPerUnit: '',
      supplier: '',
      supplierId: '',
      batchNumber: '',
      expiryDate: '',
      notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      
      try {
        if (formData.isNewMaterial) {
          // Create new material with stock
          const response = await fetch(`${API_URL}/raw-materials`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              name: formData.newMaterialName,
              code: formData.newMaterialCode,
              category: formData.newMaterialCategory,
              quantity: parseFloat(formData.quantity),
              unit: formData.unit,
              costPerUnit: parseFloat(formData.costPerUnit),
              supplier: formData.supplier,
              supplierId: formData.supplierId,
              batchNumber: formData.batchNumber,
              expiryDate: formData.expiryDate,
              notes: formData.notes
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            broadcastInventoryUpdate('newMaterial', result);
            alert('Stock added successfully!');
            setShowAddStockModal(false);
            fetchData();
          } else {
            const errorData = await response.json();
            alert(`Failed to add stock: ${errorData.message || 'Unknown error'}`);
          }
        } else {
          // Add stock to existing material
          const response = await fetch(`${API_URL}/raw-materials/${formData.materialId}/stock`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
              quantity: parseFloat(formData.quantity),
              unit_price: parseFloat(formData.costPerUnit),
              transaction_type: 'purchase',
              notes: formData.notes || 'Manual stock addition'
            })
          });
          
          if (response.ok) {
            const result = await response.json();
            broadcastInventoryUpdate('stockAdded', { 
              materialId: formData.materialId,
              quantity: parseFloat(formData.quantity),
              result
            });
            alert('Stock added successfully!');
            setShowAddStockModal(false);
            fetchData();
          } else {
            const errorData = await response.json();
            alert(`Failed to add stock: ${errorData.message || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error('Error adding stock:', error);
        // Demo mode - update locally
        if (formData.isNewMaterial) {
          const newMaterial = {
            _id: 'rm-' + Date.now(),
            name: formData.newMaterialName,
            code: formData.newMaterialCode,
            category: formData.newMaterialCategory,
            quantity: parseFloat(formData.quantity),
            unit: formData.unit,
            costPerUnit: parseFloat(formData.costPerUnit),
            minimumStock: 1000,
            status: 'active'
          };
          setRawMaterials([...rawMaterials, newMaterial]);
          // Add stock movement
          const newMovement = {
            _id: 'sm-' + Date.now(),
            materialName: formData.newMaterialName,
            materialCode: formData.newMaterialCode,
            movementType: 'NEW_MATERIAL',
            quantity: parseFloat(formData.quantity),
            unitCost: parseFloat(formData.costPerUnit),
            totalValue: parseFloat(formData.quantity) * parseFloat(formData.costPerUnit),
            reference: formData.batchNumber || 'MANUAL-ENTRY',
            supplier: formData.supplier || 'N/A',
            performedBy: 'Demo User',
            timestamp: new Date().toISOString()
          };
          setStockMovements(prev => {
            const updated = [newMovement, ...prev];
            broadcastInventoryUpdate('stockMovement', newMovement);
            return updated;
          });
          alert('Stock added successfully (Demo Mode)');
        } else {
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
          
          // Add stock movement record
          const newMovement = {
            _id: 'sm-' + Date.now(),
            materialName: material?.name || 'Unknown',
            materialCode: material?.code || 'N/A',
            movementType: 'PURCHASE',
            quantity: addedQuantity,
            unitCost: parseFloat(formData.costPerUnit) || material?.costPerUnit || 0,
            totalValue: addedQuantity * (parseFloat(formData.costPerUnit) || material?.costPerUnit || 0),
            reference: formData.batchNumber || 'MANUAL-ENTRY',
            supplier: formData.supplier || 'N/A',
            performedBy: 'Demo User',
            timestamp: new Date().toISOString()
          };
          setStockMovements(prev => {
            const updated = [newMovement, ...prev];
            broadcastInventoryUpdate('stockMovement', newMovement);
            return updated;
          });
          
          // Update stats
          broadcastInventoryUpdate('materialUpdate', { 
            materialId: formData.materialId, 
            oldQuantity, 
            newQuantity,
            materialName: material?.name 
          });
          
          alert(`Stock added successfully! ${material?.name}: ${oldQuantity} → ${newQuantity} ${material?.unit} (Demo Mode)`);
        }
        setShowAddStockModal(false);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="modal-overlay">
        <div className="modal modal-large">
          <div className="modal-header">
            <h2 className="modal-title">{t('inventory.addRawMaterial')}</h2>
            <button className="modal-close" onClick={() => setShowAddStockModal(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Material Selection */}
              <div className="form-group">
                <label className="form-label">Material *</label>
                <select 
                  className="form-select"
                  value={formData.isNewMaterial ? 'new' : formData.materialId}
                  onChange={(e) => {
                    if (e.target.value === 'new') {
                      setFormData({ ...formData, isNewMaterial: true, materialId: '' });
                    } else {
                      setFormData({ ...formData, isNewMaterial: false, materialId: e.target.value });
                    }
                  }}
                  required
                >
                  <option value="">اختر الخامة</option>
                  {rawMaterials.map(m => (
                    <option key={m._id} value={m._id}>{m.name} ({m.code}) - Current: {m.quantity} {m.unit}</option>
                  ))}
                  <option value="new">+ Create New Material</option>
                </select>
              </div>
              
              {/* New Material Fields */}
              {formData.isNewMaterial && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Material Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.newMaterialName}
                      onChange={(e) => setFormData({ ...formData, newMaterialName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material Code *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.newMaterialCode}
                      onChange={(e) => setFormData({ ...formData, newMaterialCode: e.target.value })}
                      placeholder="e.g., RM-CORN-002"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select
                      className="form-select"
                      value={formData.newMaterialCategory}
                      onChange={(e) => setFormData({ ...formData, newMaterialCategory: e.target.value })}
                      required
                    >
                      <option value="grain">{t('inventory.grain')}</option>
                      <option value="protein">{t('inventory.protein')}</option>
                      <option value="fiber">{t('inventory.fiber')}</option>
                      <option value="mineral">{t('inventory.mineral')}</option>
                      <option value="oil">زيت</option>
                      <option value="additive">{t('inventory.additive')}</option>
                      <option value="other">{t('common.other')}</option>
                    </select>
                  </div>
                </div>
              )}
              
              {/* Quantity and Unit */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select
                    className="form-select"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    required
                  >
                    <option value="kg">kg</option>
                    <option value="ton">ton</option>
                  </select>
                </div>
              </div>
              
              {/* Unit Cost */}
              <div className="form-group">
                <label className="form-label">Unit Cost (EGP per kg) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.costPerUnit}
                  onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
                  placeholder="Price per kg - affects inventory valuation"
                  required
                />
                <small className="form-help">This affects inventory valuation using weighted average cost method</small>
              </div>
              
              {/* Supplier */}
              <div className="form-group">
                <label className="form-label">{t('common.supplier')}</label>
                <select
                  className="form-select"
                  value={formData.supplierId}
                  onChange={(e) => {
                    const supplier = suppliers.find(s => s._id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      supplierId: e.target.value,
                      supplier: supplier?.name || ''
                    });
                  }}
                >
                  <option value="">اختر المورد</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Batch Number and Expiry */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.batchNumber')}</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    placeholder="Optional tracking number"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">تاريخ الانتهاء</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              </div>
              
              {/* Notes */}
              <div className="form-group">
                <label className="form-label">{t('common.notes')}</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional information about this stock addition..."
                  rows="3"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddStockModal(false)}>
                إلغاء
              </button>
              <button type="submit" className="btn btn-success" disabled={submitting}>
                {submitting ? 'Adding Stock...' : 'Add Stock'}
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
        alert('Please enter a valid quantity');
        setSubmitting(false);
        return;
      }

      // Must select a material
      if (!selectedMaterial) {
        alert('Please select a material');
        setSubmitting(false);
        return;
      }
      
      // Must not exceed available stock
      const availableStock = parseFloat(selectedMaterial.quantity ?? selectedMaterial.current_stock ?? 0);
      if (quantity > availableStock) {
        alert(`Cannot transfer more than available stock (${availableStock} ${selectedMaterial.unit || 'kg'})`);
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
          alert(`Stock transferred successfully! Moved ${quantity} ${unit} from ${formData.fromLocation} to ${formData.toLocation}`);
          setShowTransferModal(false);
          fetchData();
        } else {
          const errorData = await response.json();
          alert(`Failed to transfer stock: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error transferring stock:', error);
        
        // Demo mode - update locally (only if enough stock)
        if (selectedMaterial) {
          const oldQuantity = parseFloat(selectedMaterial.quantity ?? selectedMaterial.current_stock ?? 0);
          if (quantity > oldQuantity) {
            alert(`Cannot transfer more than available stock (${oldQuantity} ${selectedMaterial.unit || 'kg'})`);
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
          
          alert(`Stock transferred successfully (Demo Mode)! ${selectedMaterial.name}: ${oldQuantity} → ${newQuantity} ${selectedMaterial.unit}`);
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
            <div className="modal-body">
              {/* Material Selection */}
              <div className="form-group">
                <label className="form-label">Material *</label>
                <select 
                  className="form-select"
                  value={formData.materialId}
                  onChange={(e) => handleMaterialChange(e.target.value)}
                  required
                >
                  <option value="">اختر الخامة</option>
                  {rawMaterials.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name} ({m.code}) - Available: {m.quantity} {m.unit}
                    </option>
                  ))}
                </select>
                {selectedMaterial && (
                  <small className="form-help">
                    Current Stock: {selectedMaterial.quantity} {selectedMaterial.unit} @ {selectedMaterial.costPerUnit?.toFixed(2)} EGP/kg
                  </small>
                )}
              </div>
              
              {/* From/To Locations */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">From Location *</label>
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
                  <label className="form-label">To Location *</label>
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
                <label className="form-label">Quantity to Transfer *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  max={selectedMaterial?.quantity}
                  required
                />
                {selectedMaterial && parseFloat(formData.quantity) > selectedMaterial.quantity && (
                  <small className="form-help" style={{ color: '#ef4444' }}>
                    Cannot exceed available stock of {selectedMaterial.quantity} {selectedMaterial.unit}
                  </small>
                )}
              </div>
              
              {/* Transfer Type */}
              <div className="form-group">
                <label className="form-label">Transfer Type *</label>
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
                <label className="form-label">المرجع (رقم أمر الشراء/الإنتاج)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="e.g., PRD-2025-001 or PO-2025-012"
                />
              </div>
              
              {/* Reason */}
              <div className="form-group">
                <label className="form-label">سبب النقل</label>
                <textarea
                  className="form-textarea"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this transfer happening?"
                  rows="3"
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                إلغاء
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting || (selectedMaterial && parseFloat(formData.quantity) > selectedMaterial.quantity)}
              >
                {submitting ? 'Transferring...' : 'Transfer Stock'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const approveProduction = async (productionOrder) => {
    if (!window.confirm(`Approve production order ${productionOrder.productionNumber}?`)) return;
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/approve`, {
        method: 'PUT',
        headers: headers()
      });
      if (response.ok) {
        alert('Production order approved successfully');
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Failed to approve production: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error approving production:', error);
      alert('Failed to approve production: ' + (error.message || 'Unknown error'));
    }
  };

  const startProduction = async (productionOrder) => {
    if (!window.confirm(`Start production ${productionOrder.productionNumber}? This will deduct raw materials from inventory.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/start`, {
        method: 'PUT',
        headers: headers()
      });
      
      if (response.ok) {
        alert('Production started successfully');
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Failed to start production: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error starting production:', error);
      alert('Failed to start production: ' + (error.message || 'Unknown error'));
    }
  };

  const completeProduction = async (productionOrder) => {
    if (!window.confirm(`Complete production ${productionOrder.productionNumber}? This will add finished goods to inventory.`)) {
      return;
    }
    
    try {
      const response = await fetch(`${PRODUCTION_API_URL}/production-orders/${productionOrder.id}/complete`, {
        method: 'PUT',
        headers: headers()
      });
      
      if (response.ok) {
        alert('Production completed successfully');
        fetchData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert('Failed to complete production: ' + (errorData.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error completing production:', error);
      alert('Failed to complete production: ' + (error.message || 'Unknown error'));
    }
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
                Add Stock
              </button>
              <button 
                onClick={() => setShowTransferModal(true)}
                className="btn btn-primary"
              >
                <ArrowLeftRight className="w-5 h-5" />
                نقل مخزون
              </button>
            </>
          )}
          {activeTab === 'finished' && (
            <button 
              onClick={() => alert('Finished goods are created via Production Orders. Go to Production page.')}
              className="btn btn-primary"
            >
              <Plus className="w-5 h-5" />
              Add Finished Good
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
          Raw Materials
        </button>
        <button
          onClick={() => setActiveTab('finished')}
          className={`btn ${activeTab === 'finished' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Package className="w-4 h-4" />
          منتجات نهائية
        </button>
        <button
          onClick={() => setActiveTab('production')}
          className={`btn ${activeTab === 'production' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Factory className="w-4 h-4" />
          Production
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`btn ${activeTab === 'recipes' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ChefHat className="w-4 h-4" />
          Recipes
        </button>
        <button
          onClick={() => setActiveTab('movements')}
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <History className="w-4 h-4" />
          Stock Movements
        </button>
        <button
          onClick={() => setActiveTab('requisitions')}
          className={`btn ${activeTab === 'requisitions' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText className="w-4 h-4" />
          Requisitions
        </button>
        <button
          onClick={() => setActiveTab('purchase-orders')}
          className={`btn ${activeTab === 'purchase-orders' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Truck className="w-4 h-4" />
          Purchase Orders
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
                <p className="stat-value">{(stats.totalQuantity || 0).toLocaleString()} kg</p>
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
                <p className="stat-label">Low Stock (&lt;5 tons)</p>
                <p className="stat-value" style={{ color: '#ef4444' }}>{stats.lowStock || stats.lowStockCount || 0}</p>
              </div>
              {Object.entries(stats.byPackageSize || {}).map(([size, count]) => (
                <div key={size} className="stat-card">
                  <p className="stat-label">{size} Bags</p>
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
                <p className="stat-value">{(stats.avgCost || 0).toFixed(0)} EGP</p>
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
                <th>المخزون الحالي</th>
                <th>متوسط التكلفة</th>
                <th>إجمالي القيمة</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.length === 0 ? (
                <tr><td colSpan="6" className="text-center">لا توجد خامات</td></tr>
              ) : rawMaterials.map((mat) => (
                <tr key={mat._id}>
                  <td>
                    <p className="font-medium">{mat.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{mat.code}</p>
                  </td>
                  <td className="capitalize">{mat.category}</td>
                  <td>
                    <p className="font-medium">{mat.quantity} {mat.unit}</p>
                    {mat.quantity <= mat.minimumStock && (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <AlertTriangle className="w-3 h-3" />
                        مخزون منخفض
                      </span>
                    )}
                  </td>
                  <td>{formatCurrency(mat.costPerUnit || 0)}</td>
                  <td>{formatCurrency((mat.quantity || 0) * (mat.costPerUnit || 0))}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(mat.status)}`}>
                      {mat.status}
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
                <th>نوع العلف</th>
                <th>Package</th>
                <th>{t('common.bags')}</th>
                <th>{t('common.quantity')}</th>
                <th>{t('inventory.batch')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {finishedGoods.length === 0 ? (
                <tr><td colSpan="6" className="text-center">No finished goods in inventory</td></tr>
              ) : finishedGoods.map((good) => (
                <tr key={good._id}>
                  <td>
                    <p className="font-medium">{good.feedType?.name}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{good.feedType?.code}</p>
                  </td>
                  <td>{good.packageSize} kg bag</td>
                  <td>
                    <p className="font-medium">{good.numberOfBags}</p>
                  </td>
                  <td>
                    <p className="font-medium">{good.quantityTons} tons</p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>{good.quantityKg.toLocaleString()} kg</p>
                  </td>
                  <td>
                    <p>{good.batchNumber}</p>
                    {good.productionOrderNumber && (
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>PO: {good.productionOrderNumber}</p>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(good.status)}`}>
                      {good.status}
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
                <th>رقم الطلب</th>
                <th>نوع العلف</th>
                <th>Output</th>
                <th>{t('common.status')}</th>
                <th>{t('common.date')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {productionOrders.length === 0 ? (
                <tr><td colSpan="6" className="text-center">No production orders</td></tr>
              ) : productionOrders.map((prod) => (
                <tr key={prod._id}>
                  <td>
                    <p className="font-medium">{prod.productionNumber}</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Batch: {prod.batchNumber}</p>
                  </td>
                  <td>{prod.feedType?.name}</td>
                  <td>
                    <p className="font-medium">{prod.totalBags} bags</p>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{prod.totalOutputWeight} kg</p>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(prod.status)}`}>
                      {prod.status}
                    </span>
                  </td>
                  <td>
                    {prod.createdAt ? new Date(prod.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      {prod.status === 'draft' && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          title="{t('common.approve')}"
                          onClick={() => approveProduction(prod)}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      {prod.status === 'approved' && (
                        <button 
                          className="btn btn-sm btn-primary" 
                          title="{t('common.start')}"
                          onClick={() => startProduction(prod)}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {prod.status === 'in_progress' && (
                        <button 
                          className="btn btn-sm btn-success" 
                          title="{t('common.complete')}"
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
                  <th>Recipe Name</th>
                  <th>نوع العلف</th>
                  <th>الإصدار</th>
                  <th>Ingredients</th>
                  <th>Cost/ton</th>
                  <th>Sell/ton (15%)</th>
                  <th>{t('common.status')}</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                {recipes.length === 0 ? (
                  <tr><td colSpan="10" className="text-center">No recipes found</td></tr>
                ) : recipes.map((recipe) => {
                  const p = recipe.pricing || {};
                  return (
                  <tr key={recipe._id}>
                    <td>
                      <p className="font-medium">{recipe.name}</p>
                      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Protein: {recipe.protein || '-'}% | Energy: {recipe.energy || '-'}
                      </p>
                    </td>
                    <td>{recipe.feedType?.name || 'Unknown'}</td>
                    <td>{recipe.version || '-'}</td>
                    <td>{recipe.ingredientCount || recipe.ingredients?.length || '-'}</td>
                    <td>EGP {(recipe.totalCost || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>EGP {parseFloat(p.cost_per_ton || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>EGP {parseFloat(p.sell_per_ton || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(recipe.status)}`}>
                        {recipe.status}
                      </span>
                    </td>
                    <td>{recipe.usageCount || 0} times</td>
                  </tr>
                )})}
            </tbody>
          </table>
        ) : activeTab === 'requisitions' ? (
          // Requisitions Tab
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Purchase Requisitions</h3>
              <button
                onClick={async () => {
                  setLoading(true);
                  const result = await requisitionService.preview();
                  setLoading(false);
                  if (result.success) {
                    if (result.items && result.items.length > 0) {
                      setPreviewItems(result.items);
                      setPreviewBySupplier(result.bySupplier || []);
                      setPreviewTotalCost(result.totalCost || 0);
                      setShowPreviewModal(true);
                    } else {
                      alert(result.message || 'No materials below reorder level');
                    }
                  } else {
                    alert(result.error || 'Failed to preview low stock items');
                  }
                }}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus className="w-4 h-4" /> Generate from Low Stock
              </button>
            </div>
            {requisitions.length === 0 ? (
              <div className="text-center" style={{ padding: '40px', color: '#9ca3af' }}>
                <FileText size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p>No requisitions yet. Click "Generate from Low Stock" to see a preview and create one.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Req #</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.items')}</th>
                    <th>التكلفة الإجمالية</th>
                    <th>Created</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requisitions.map((req) => (
                    <tr key={req.id}>
                      <td className="font-medium">{req.requisition_number}</td>
                      <td>
                        <span className={`badge ${req.status === 'draft' ? 'badge-warning' : req.status === 'sent' ? 'badge-primary' : req.status === 'completed' ? 'badge-success' : 'badge-secondary'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>{req.item_count || req.total_items || 0}</td>
                      <td>{formatCurrency(parseFloat(req.total_cost || 0))}</td>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {req.status === 'draft' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm('Send this requisition to suppliers? This will create purchase orders.')) return;
                                setLoading(true);
                                try {
                                  const result = await requisitionService.sendToSuppliers(req.id);
                                  if (result.success) {
                                    fetchData();
                                    alert(result.message || 'Requisition sent to suppliers successfully!');
                                  } else {
                                    alert(result.error || 'Failed to send requisition');
                                  }
                                } catch (e) {
                                  alert('Network error: ' + (e.message || 'Could not reach server'));
                                }
                                setLoading(false);
                              }}
                              className="btn btn-sm btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Send className="w-3 h-3" /> Send
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Preview Modal */}
            {showPreviewModal && (
              <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={() => setShowPreviewModal(false)}>
                <div className="modal modal-large" style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <AlertTriangle size={24} color="#f59e0b" />
                      Low Stock Preview / معاينة المخزون المنخفض
                    </h3>
                    <button className="modal-close" onClick={() => setShowPreviewModal(false)}>
                      <X size={20} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <div style={{ background: '#fefce8', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #facc15' }}>
                      <div style={{ fontWeight: 600, color: '#854d0e', marginBottom: '4px' }}>
                        {previewItems.length} material(s) below reorder level
                      </div>
                      <div style={{ color: '#a16207', fontSize: '14px' }}>
                        Total estimated cost: <strong>{formatCurrency(previewTotalCost)}</strong>
                      </div>
                    </div>

                    {previewBySupplier.map((group, gIdx) => (
                      <div key={gIdx} style={{ marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 12px 0', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Truck size={16} color="#3b82f6" />
                          {group.supplier_name || 'No preferred supplier'}
                          {group.supplier_id && (
                            <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 400 }}>
                              ({group.items.length} item(s))
                            </span>
                          )}
                        </h4>
                        <table className="table" style={{ marginBottom: '0' }}>
                          <thead>
                            <tr>
                              <th>{t('common.material')}</th>
                              <th>المخزون الحالي</th>
                              <th>Reorder Level</th>
                              <th>Suggested Qty</th>
                              <th>سعر الوحدة</th>
                              <th>{t('common.total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item, iIdx) => (
                              <tr key={iIdx}>
                                <td>
                                  <div style={{ fontWeight: 500 }}>{item.material_name}</div>
                                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.material_code}</div>
                                </td>
                                <td>{item.current_stock.toLocaleString()} {item.unit}</td>
                                <td>{item.reorder_level.toLocaleString()} {item.unit}</td>
                                <td style={{ fontWeight: 600, color: '#2563eb' }}>{item.suggested_quantity.toLocaleString()} {item.unit}</td>
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
                    <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>
                      إلغاء
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        setShowPreviewModal(false);
                        setLoading(true);
                        const result = await requisitionService.generate();
                        setLoading(false);
                        if (result.success) {
                          fetchData();
                          alert('Requisition created successfully!');
                        } else {
                          alert(result.error || 'Failed to generate requisition');
                        }
                      }}
                    >
                      <Check className="w-4 h-4" style={{ marginRight: '6px', display: 'inline' }} />
                      Confirm & Create Requisition
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'purchase-orders' ? (
          // Purchase Orders Tab
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Incoming Purchase Orders</h3>
              <button
                className="btn btn-primary"
                onClick={fetchData}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="empty-state">
                <Package className="w-12 h-12" style={{ color: '#9ca3af', marginBottom: '12px' }} />
                <p className="empty-state-title">No Purchase Orders</p>
                <p>No purchase orders found. Create one from the Purchase Orders page or send a requisition.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>{t('common.supplier')}</th>
                    <th>{t('common.items')}</th>
                    <th>{t('common.total')}</th>
                    <th>{t('common.status')}</th>
                    <th>Expected Date</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id}>
                      <td className="font-medium">{po.po_number}</td>
                      <td>{po.supplier_name || po.supplier?.name || '-'}</td>
                      <td>{po.item_count || (po.items?.length || 0)} items</td>
                      <td>EGP {parseFloat(po.total_amount || po.total || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
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
                                  if (!window.confirm(`Approve PO ${po.po_number}?`)) return;
                                  setLoading(true);
                                  try {
                                    const result = await purchaseOrdersService.approve(po.id);
                                    setLoading(false);
                                    if (result && !result.error) {
                                      alert('Purchase order approved successfully');
                                      fetchData();
                                    } else {
                                      alert(result?.error || 'Failed to approve purchase order');
                                    }
                                  } catch (err) {
                                    setLoading(false);
                                    alert('Error: ' + err.message);
                                  }
                                }}
                              >
                                <Check className="w-3 h-3" />
                                قبول
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={async () => {
                                  if (!window.confirm(`Reject PO ${po.po_number}?`)) return;
                                  setLoading(true);
                                  try {
                                    const result = await purchaseOrdersService.reject(po.id);
                                    setLoading(false);
                                    if (result && !result.error) {
                                      alert('Purchase order rejected');
                                      fetchData();
                                    } else {
                                      alert(result?.error || 'Failed to reject purchase order');
                                    }
                                  } catch (err) {
                                    setLoading(false);
                                    alert('Error: ' + err.message);
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
                <span style={{ fontSize: '14px', fontWeight: 500 }}>Filters:</span>
              </div>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                placeholder="From Date"
                value={movementFilters.startDate}
                onChange={(e) => setMovementFilters({ ...movementFilters, startDate: e.target.value })}
              />
              <span style={{ color: '#64748b' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px' }}
                placeholder="To Date"
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
                <option value="">{t('inventory.allTypes')}</option>
                <option value="PURCHASE">Purchase</option>
                <option value="TRANSFER">Transfer</option>
                <option value="RECEIPT">الإيصال</option>
                <option value="PRODUCTION">{t('nav.production')}</option>
                <option value="ADJUSTMENT">{t('inventory.adjustment')}</option>
              </select>
            </div>
            
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.material')}</th>
                  <th>{t('inventory.type')}</th>
                  <th>{t('common.quantity')}</th>
                  <th>Unit Cost</th>
                  <th>{t('common.totalValue')}</th>
                  <th>{t('common.reference')}</th>
                  <th>User</th>
                </tr>
              </thead>
              <tbody>
                {stockMovements.length === 0 ? (
                  <tr><td colSpan="8" className="text-center">No stock movements recorded</td></tr>
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
                      {movement.timestamp ? new Date(movement.timestamp).toLocaleDateString() : '-'}
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
                      {movement.quantity > 0 ? '+' : ''}{formatNumber(movement.quantity)} kg
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
      
      {/* Render Modals */}
      {showAddStockModal && <AddStockModal />}
      {showTransferModal && <TransferStockModal />}
    </div>
  );
}
