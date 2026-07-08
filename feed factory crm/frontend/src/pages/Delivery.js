import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { authService } from '../services/api';
import { captureLocation, startDriverDeliveryTracking, stopDriverDeliveryTracking } from '../utils/location';
import { 
  Truck, Plus, MapPin, Package, 
  Check, X, Play, Clock, Route, User,
  ChevronRight, AlertCircle, Camera, Star,
  Upload, Navigation, Send, Phone, Signature,
  CheckCircle, CheckCircle2, MapPinIcon
} from 'lucide-react';

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000') + '/api';
const getAuthToken = () => localStorage.getItem('token');
const getUserRole = () => {
  const user = authService.getCurrentUser();
  if (!user) return 'driver';
  if (['owner', 'admin', 'logistics_coordinator'].includes(user.role)) return 'foreman';
  return user.role === 'driver' ? 'driver' : 'foreman';
};

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});


export default function Delivery() {
  const [activeTab, setActiveTab] = useState('deliveries');
  const [userRole, setUserRole] = useState(getUserRole());
  const [deliveries, setDeliveries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showJourneyModal, setShowJourneyModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  
  // Confirmation form states
  const [confirmationData, setConfirmationData] = useState({
    status: 'completed',
    receivedBy: { name: '', phone: '', otpVerified: false },
    deliveredItems: [],
    deliveryProof: { photos: [], signature: '', gpsLocation: null },
    deliveryNotes: '',
    customerRating: 5,
    issues: []
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [assignForm, setAssignForm] = useState({ vehicle: '', driver: '', notifyDriver: false });
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [vehicleAvailability, setVehicleAvailability] = useState({});
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');
  const [journeyHistory, setJourneyHistory] = useState([]);
  
  // Signature canvas ref and drawing state
  const signatureRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCanvasCoordinates = (e) => {
    const canvas = signatureRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = signatureRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setConfirmationData(prev => ({
        ...prev,
        deliveryProof: { ...prev.deliveryProof, signature: dataUrl }
      }));
    }
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setConfirmationData(prev => ({
      ...prev,
      deliveryProof: { ...prev.deliveryProof, signature: '' }
    }));
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, userRole]);

  // Start/stop driver location tracking when active delivery status changes
  useEffect(() => {
    if (getUserRole() !== 'driver') return;
    const activeDeliveries = deliveries.filter(d =>
      ['accepted', 'picked_up', 'in_transit', 'arrived'].includes(d.status)
    );
    if (activeDeliveries.length > 0) {
      const deliveryId = activeDeliveries[0]._id || activeDeliveries[0].id;
      startDriverDeliveryTracking(deliveryId);
    } else {
      stopDriverDeliveryTracking();
    }
    return () => stopDriverDeliveryTracking();
  }, [deliveries]);

  // Capture real GPS location when confirmation modal opens
  useEffect(() => {
    if (showConfirmModal && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setConfirmationData(prev => ({
            ...prev,
            deliveryProof: {
              ...prev.deliveryProof,
              gpsLocation: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString()
              }
            }
          }));
        },
        (error) => {
          console.warn('GPS not available:', error.message);
          // Fallback: use hardcoded demo location
          setConfirmationData(prev => ({
            ...prev,
            deliveryProof: {
              ...prev.deliveryProof,
              gpsLocation: {
                latitude: 24.4539,
                longitude: 54.3773,
                accuracy: 0,
                timestamp: new Date().toISOString()
              }
            }
          }));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, [showConfirmModal]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'deliveries') {
        const [delRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/delivery`, { headers: headers() }),
          fetch(`${API_URL}/delivery/stats`, { headers: headers() })
        ]);
        const data = await delRes.json();
        const statsData = await statsRes.json();
        const deliveriesData = (data?.deliveries || []).map(normalizeDelivery);
        setDeliveries(deliveriesData);
        setStats(statsData || {});
      } else {
        const [vehRes, statsRes] = await Promise.all([
          fetch(`${API_URL}/delivery/vehicles`, { headers: headers() }),
          fetch(`${API_URL}/delivery/vehicles/stats`, { headers: headers() })
        ]);
        const data = await vehRes.json();
        const statsData = await statsRes.json();
        const vehiclesData = data?.vehicles || [];
        setVehicles(vehiclesData);
        setStats(statsData || {});
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (activeTab === 'deliveries') {
        setDeliveries([]);
        setStats({});
      } else {
        setVehicles([]);
        setStats({});
      }
    } finally {
      setLoading(false);
    }
  };

  // Driver workflow actions with immediate UI update
  const updateDeliveryStatus = async (id, endpoint, data = {}) => {
    // Determine the new status based on the endpoint
    const statusMap = {
      'accept': 'accepted',
      'pickup': 'picked_up',
      'in-transit': 'in_transit',
      'arrived': 'arrived'
    };
    const newStatus = statusMap[endpoint];

    // Update UI immediately for better UX
    if (newStatus) {
      setDeliveries(prev => prev.map(d => 
        d._id === id ? { ...d, status: newStatus } : d
      ));
    }

    try {
      const response = await fetch(`${API_URL}/delivery/${id}/${endpoint}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const result = await response.json();
        // Refresh from server to ensure consistency
        fetchData();
        return result;
      } else {
        // Revert on error
        console.error(`Error updating delivery ${endpoint}:`, await response.text());
        fetchData(); // Refresh to get correct state
      }
    } catch (error) {
      console.error(`Error updating delivery ${endpoint}:`, error);
      fetchData(); // Refresh to get correct state
    }
  };

  const acceptDelivery = (id) => updateDeliveryStatus(id, 'accept');
  const pickupDelivery = (id) => updateDeliveryStatus(id, 'pickup');
  const startTransit = (id) => updateDeliveryStatus(id, 'in-transit');
  const markArrived = (id) => updateDeliveryStatus(id, 'arrived');

  // Fetch available drivers from API
  const fetchAvailableDrivers = async () => {
    try {
      const response = await fetch(`${API_URL}/delivery/drivers/available`, {
        headers: headers()
      });
      if (response.ok) {
        const data = await response.json();
        const drivers = (data?.drivers || []).map(d => ({
          _id: d._id || d.id,
          name: d.name || '',
          firstName: d.name?.split(' ')[0] || '',
          lastName: d.name?.split(' ').slice(1).join(' ') || '',
          email: d.email || '',
          currentAssignment: 'متاح',
        }));
        setAvailableDrivers(drivers);
      }
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      setAvailableDrivers([]);
    }
  };

  // Check vehicle availability
  const checkVehicleAvailability = async (vehicleId) => {
    try {
      const response = await fetch(`${API_URL}/delivery/vehicles/${vehicleId}/availability`, {
        headers: headers()
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('Error checking vehicle availability:', error);
    }
    
    // Fallback check using local data
    const vehicle = vehicles.find(v => String(v._id) === String(vehicleId));
    return {
      available: vehicle?.status === 'available',
      currentDelivery: vehicle?.status === 'on_delivery' || vehicle?.status === 'assigned',
      message: vehicle?.status === 'on_delivery'
        ? 'المركبة قيد التوصيل حالياً'
        : vehicle?.status === 'assigned'
        ? 'المركبة معينة لتوصيل آخر'
        : 'المركبة متاحة'
    };
  };

  // Calculate delivery weight
  const normalizeDelivery = (d) => {
    if (!d) return d;
    return {
      ...d,
      _id: d._id || d.id,
      deliveryNumber: d.delivery_number || d.deliveryNumber || `DEL-${d.id || d._id}`,
      client: d.client || (d.client_name ? {
        name: d.client_name,
        phone: d.client_phone,
        address: d.client_address
      } : null),
      vehicle: d.vehicle || (d.vehicle_id ? {
        _id: d.vehicle_id,
        plateNumber: d.plate_number,
        model: d.model,
        make: d.make,
        capacityKg: d.capacity_kg
      } : null),
      driver: d.driver || (d.driver_id ? {
        _id: d.driver_id,
        firstName: d.driver_name?.split(' ')[0] || '',
        lastName: d.driver_name?.split(' ').slice(1).join(' ') || '',
        phone: d.driver_phone || ''
      } : null),
      items: Array.isArray(d.items_summary) ? d.items_summary : (Array.isArray(d.items) ? d.items : []),
      totalBags: d.total_bags || 0,
      totalWeightKg: d.total_weight_kg || 0,
      scheduledDate: d.scheduled_date || d.scheduledDate || d.delivery_date,
      deliveryAddress: d.client_address || d.delivery_address || d.deliveryAddress || ''
    };
  };

  const calculateDeliveryWeight = (delivery) => {
    if (!delivery?.items || !Array.isArray(delivery.items)) return 0;
    return delivery.items.reduce((total, item) => {
      const bagSize = item.packageSize || item.bagSizeKg || 25;
      return total + (bagSize * item.quantity);
    }, 0);
  };

  // Check vehicle capacity sufficiency
  const isVehicleCapacitySufficient = (vehicleId, delivery) => {
    const vehicle = vehicles.find(v => String(v._id) === String(vehicleId));
    const cap = vehicle?.capacity_kg || vehicle?.capacityKg;
    if (!vehicle || !cap) return true; // Assume sufficient if no capacity data

    const deliveryWeight = calculateDeliveryWeight(delivery);
    return parseFloat(cap) >= deliveryWeight;
  };

  // Notification helper
  const showNotification = (message, type = 'success') => {
    if (type === 'success') {
      setAssignSuccess(message);
      setTimeout(() => setAssignSuccess(''), 5000);
    } else {
      setAssignError(message);
      setTimeout(() => setAssignError(''), 5000);
    }
  };

  // OTP functions
  const sendOTP = async () => {
    if (!selectedDelivery) return;
    try {
      const response = await fetch(`${API_URL}/delivery/${selectedDelivery._id}/send-otp`, {
        method: 'POST',
        headers: headers()
      });
      
      if (response.ok) {
        setOtpSent(true);
        alert('تم إرسال رمز التحقق إلى العميل');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('فشل إرسال OTP');
    }
  };

  const verifyOTP = async () => {
    if (!selectedDelivery || !otpCode) return;
    try {
      const response = await fetch(`${API_URL}/delivery/${selectedDelivery._id}/verify-otp`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ otpCode })
      });
      
      if (response.ok) {
        setOtpVerified(true);
        setConfirmationData(prev => ({
          ...prev,
          receivedBy: { ...prev.receivedBy, otpVerified: true }
        }));
        alert('تم التحقق من OTP بنجاح!');
      } else {
        alert('رمز OTP غير صحيح');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      alert('فشل التحقق من OTP');
    }
  };

  // Photo upload with cleanup
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (uploadedPhotos.length + files.length > 3) {
      alert('الحد الأقصى 3 صور');
      return;
    }

    for (const file of files) {
      const formData = new FormData();
      formData.append('photo', file);
      try {
        const response = await fetch(`${API_URL}/delivery/${selectedDelivery._id}/upload-photo`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
          body: formData
        });
        if (response.ok) {
          const result = await response.json();
          setUploadedPhotos(prev => [...prev, result.photoUrl]);
        } else {
          alert('فشل رفع الصورة');
        }
      } catch (error) {
        console.error('Error uploading photo:', error);
        alert('فشل رفع الصورة');
      }
    }
  };

  const removePhoto = (index) => {
    setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
  };

  // Cleanup all blob URLs on modal close
  const cleanupPhotos = () => {
    setUploadedPhotos([]);
  };

  // Confirmation modal handlers
  const openConfirmModal = (delivery) => {
    setSelectedDelivery(delivery);
    setConfirmationData({
      status: 'completed',
      receivedBy: { name: delivery.client?.name || '', phone: delivery.client?.phone || '', otpVerified: false },
      deliveredItems: delivery.items?.map(item => ({
        itemId: item._id,
        itemName: item.feedType?.name,
        orderedQty: item.quantity,
        deliveredQty: item.quantity,
        rejectedQty: 0,
        rejectionReason: '',
        condition: 'good'
      })) || [],
      deliveryProof: { photos: [], signature: '', gpsLocation: null },
      deliveryNotes: '',
      customerRating: 5,
      issues: []
    });
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setUploadedPhotos([]);
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    cleanupPhotos();
    setShowConfirmModal(false);
    setSelectedDelivery(null);
    setConfirmationData({
      status: 'completed',
      receivedBy: { name: '', phone: '', otpVerified: false },
      deliveredItems: [],
      deliveryProof: { photos: [], signature: '', gpsLocation: null },
      deliveryNotes: '',
      customerRating: 5,
      issues: []
    });
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode('');
    setUploadedPhotos([]);
  };

  const updateDeliveredItem = (index, field, value) => {
    const newItems = [...confirmationData.deliveredItems];
    const item = newItems[index];
    
    // Validate quantities
    if (field === 'deliveredQty') {
      const val = parseInt(value) || 0;
      const max = item.orderedQty;
      const rejected = item.rejectedQty;
      if (val + rejected > max) {
        alert(`الكمية المسلمة + المرفوضة لا يمكن أن تتجاوز الكمية المطلوبة (${max})`);
        item.deliveredQty = max - rejected;
      } else {
        item.deliveredQty = val;
      }
    } else if (field === 'rejectedQty') {
      const val = parseInt(value) || 0;
      const max = item.orderedQty;
      const delivered = item.deliveredQty;
      if (delivered + val > max) {
        alert(`الكمية المسلمة + المرفوضة لا يمكن أن تتجاوز الكمية المطلوبة (${max})`);
        item.rejectedQty = max - delivered;
      } else {
        item.rejectedQty = val;
      }
    } else {
      item[field] = value;
    }
    
    setConfirmationData(prev => ({ ...prev, deliveredItems: newItems }));
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDelivery || !confirmationData.receivedBy.name) {
      alert('الرجاء إدخال اسم الشخص الذي استلم التوصيل');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/delivery/${selectedDelivery._id}/confirm`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          ...confirmationData,
          deliveryProof: {
            ...confirmationData.deliveryProof,
            photos: uploadedPhotos
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        fetchData();
        closeConfirmModal();
        alert('تم تأكيد التوصيل بنجاح! تم إرسال إشعار واتساب للعميل.');
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      alert('فشل تأكيد التوصيل');
    }
  };

  // Assign modal handlers
  const openAssignModal = async (delivery) => {
    setSelectedDelivery(delivery);
    setAssignError('');
    setAssignSuccess('');
    setVehicleAvailability({});
    
    // Pre-populate with current assignment if exists
    const currentVehicleId = delivery?.vehicle?._id || '';
    const currentDriverId = delivery?.driver?._id || '';
    
    setAssignForm({ 
      vehicle: currentVehicleId, 
      driver: currentDriverId,
      notifyDriver: false 
    });
    
    // Fetch available drivers
    await fetchAvailableDrivers();
    
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setSelectedDelivery(null);
    setAssignForm({ vehicle: '', driver: '', notifyDriver: false });
    setAssignError('');
    setAssignSuccess('');
    setVehicleAvailability({});
    setAssignLoading(false);
  };

  const handleAssign = async (alsoNotify = false) => {
    // Validate both vehicle and driver are selected
    if (!assignForm.vehicle) {
      setAssignError('الرجاء اختيار مركبة');
      return;
    }
    if (!assignForm.driver) {
      setAssignError('الرجاء اختيار سائق');
      return;
    }

    // Validate vehicle capacity
    if (!isVehicleCapacitySufficient(assignForm.vehicle, selectedDelivery)) {
      const vehicle = vehicles.find(v => String(v._id) === String(assignForm.vehicle));
      const deliveryWeight = calculateDeliveryWeight(selectedDelivery);
      setAssignError(`سعة المركبة غير كافية! المركبة: ${formatNumber(vehicle?.capacity_kg ?? vehicle?.capacityKg ?? 0)}كجم، التوصيل: ${formatNumber(deliveryWeight)}كجم`);
      return;
    }

    setAssignLoading(true);
    setAssignError('');

    try {
      // Check vehicle availability before assignment
      const availability = await checkVehicleAvailability(assignForm.vehicle);
      if (!availability.available && !selectedDelivery?.vehicle?._id) {
        setAssignError(availability.message || 'المركبة غير متاحة');
        setAssignLoading(false);
        return;
      }

      // Call API: PUT /api/delivery/{deliveryId}/assign
      const response = await fetch(`${API_URL}/delivery/${selectedDelivery._id}/assign`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ 
          vehicle: assignForm.vehicle, 
          driver: assignForm.driver,
          notifyDriver: alsoNotify
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update deliveries list in UI immediately
        setDeliveries(prev => prev.map(d => {
          if (d._id === selectedDelivery._id) {
            const assignedVehicle = vehicles.find(v => String(v._id) === String(assignForm.vehicle));
            const assignedDriver = availableDrivers.find(drv => drv._id === assignForm.driver);
            return {
              ...d,
              vehicle: assignedVehicle,
              driver: assignedDriver || d.driver,
              status: 'assigned'
            };
          }
          return d;
        }));
        
        // Refresh data from server
        fetchData();
        
        // Show success message
        const successMsg = alsoNotify
          ? 'تم تعيين التوصيل وإشعار السائق بنجاح!'
          : 'تم تعيين التوصيل بنجاح!';
        showNotification(successMsg);
        
        // Close modal after short delay
        setTimeout(() => {
          closeAssignModal();
        }, 1500);
      } else {
        const errorData = await response.json();
        setAssignError(errorData.message || 'فشل تعيين التوصيل. الرجاء المحاولة مرة أخرى.');
      }
    } catch (error) {
      console.error('Error assigning delivery:', error);
      setAssignError('فشل تعيين التوصيل. الرجاء التحقق من الاتصال والمحاولة مرة أخرى.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAssignAndNotify = () => {
    handleAssign(true);
  };

  // Journey modal handlers
  const openJourneyModal = (delivery) => {
    setSelectedDelivery(delivery);
    setJourneyHistory(delivery.driverJourney || []);
    setShowJourneyModal(true);
  };

  const closeJourneyModal = () => {
    setShowJourneyModal(false);
    setSelectedDelivery(null);
    setJourneyHistory([]);
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      pending: 'badge badge-warning',
      assigned: 'badge badge-primary',
      accepted: 'badge badge-info',
      picked_up: 'badge badge-info',
      in_transit: 'badge badge-primary',
      arrived: 'badge badge-secondary',
      delivered: 'badge badge-success',
      partial: 'badge badge-warning',
      rejected: 'badge badge-danger',
      rescheduled: 'badge badge-warning',
      cancelled: 'badge badge-danger'
    };
    return classes[status] || 'badge';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'معلق',
      assigned: 'تم التعيين',
      accepted: 'مقبول',
      picked_up: 'تم الاستلام',
      in_transit: 'قيد التوصيل',
      arrived: 'وصل',
      delivered: 'تم التوصيل',
      partial: 'جزئي',
      rejected: 'مرفوض',
      rescheduled: 'معاد جدولته',
      cancelled: 'ملغي'
    };
    return labels[status] || status;
  };

  const getWorkflowProgress = (status) => {
    const stages = ['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'];
    const currentIndex = stages.indexOf(status);
    return { currentIndex, total: stages.length - 1 };
  };

  // Driver Mobile View Component
  const DriverMobileView = () => {
    const activeDeliveries = deliveries.filter(d => 
      ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(d.status)
    );

    if (activeDeliveries.length === 0) {
      return (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <Truck className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
          <p style={{ color: '#64748b' }}>{t('delivery.noActive')}</p>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>
            {t('delivery.checkLaterAssig')}
          </p>
        </div>
      );
    }

    return (
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' }}>
            توصيلات نشطة
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {activeDeliveries.length} توصيلة قيد التنفيذ
          </p>
        </div>

        {activeDeliveries.map(delivery => {
          const { currentIndex, total } = getWorkflowProgress(delivery.status);
          
          return (
            <div key={delivery._id} style={{ 
              background: 'white', 
              borderRadius: '12px', 
              padding: '16px', 
              marginBottom: '16px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>{delivery.deliveryNumber}</p>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>{delivery.client?.name}</p>
                </div>
                <span className={getStatusBadgeClass(delivery.status)}>
                  {getStatusLabel(delivery.status)}
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                marginBottom: '16px',
                padding: '8px 0'
              }}>
                {['pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'].map((stage, idx) => {
                  const isCompleted = idx <= currentIndex;
                  const isCurrent = idx === currentIndex;
                  
                  return (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: isCurrent ? '20px' : '12px',
                        height: isCurrent ? '20px' : '12px',
                        borderRadius: '50%',
                        background: isCompleted ? '#22c55e' : '#e2e8f0',
                        border: isCurrent ? '3px solid #22c55e' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isCompleted && <Check className="w-3 h-3" style={{ color: 'white' }} />}
                      </div>
                      {idx < 6 && (
                        <div style={{
                          height: '2px',
                          background: idx < currentIndex ? '#22c55e' : '#e2e8f0',
                          flex: 1,
                          marginLeft: '2px'
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Address & Items */}
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '8px', 
                padding: '12px', 
                marginBottom: '16px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <MapPin className="w-4 h-4" style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>{delivery.deliveryAddress}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package className="w-4 h-4" style={{ color: '#64748b', flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>{delivery.totalBags} كيس · {delivery.items?.length} عنصر</p>
                </div>
              </div>

              {/* GPS Status */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '16px',
                fontSize: '12px',
                color: '#64748b'
              }}>
                <Navigation className="w-4 h-4" style={{ color: '#22c55e' }} />
                <span>GPS نشط • تتبع الموقع مفعّل</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {delivery.status === 'assigned' && (
                  <button 
                    onClick={() => acceptDelivery(delivery._id)}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    قبول
                  </button>
                )}
                {delivery.status === 'accepted' && (
                  <button 
                    onClick={() => pickupDelivery(delivery._id)}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Package className="w-4 h-4" />
                    تم الاستلام
                  </button>
                )}
                {delivery.status === 'picked_up' && (
                  <button 
                    onClick={() => startTransit(delivery._id)}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Truck className="w-4 h-4" />
                    بدء النقل
                  </button>
                )}
                {delivery.status === 'in_transit' && (
                  <button 
                    onClick={() => markArrived(delivery._id)}
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <MapPinIcon className="w-4 h-4" />
                    تم الوصول
                  </button>
                )}
                {delivery.status === 'arrived' && (
                  <button
                    onClick={() => openConfirmModal(delivery)}
                    className="btn btn-success"
                    style={{ flex: 1, justifyContent: 'center', background: '#22c55e' }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    إكمال التوصيل
                  </button>
                )}
                <button 
                  onClick={() => openJourneyModal(delivery)}
                  className="btn btn-outline"
                  style={{ padding: '8px 12px' }}
                >
                  <Clock className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Foreman Dashboard Component
  const ForemanDashboard = () => {
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>رقم التوصيل</th>
              <th>العميل</th>
              <th>المركبة</th>
              <th>السائق</th>
              <th>تاريخ التسليم</th>
              <th>الحالة</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>
                  <Package className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                  <p style={{ color: '#64748b' }}>لا توجد توصيلات</p>
                </td>
              </tr>
            ) : (
              deliveries.map(del => (
                <tr key={del._id}>
                  <td style={{ fontWeight: 600 }}>{del.deliveryNumber}</td>
                  <td>{del.client?.name || '-'}</td>
                  <td>{del.vehicle?.plateNumber || del.plate_number || '-'}</td>
                  <td>
                    {del.driver
                      ? `${del.driver.firstName} ${del.driver.lastName}`.trim() || del.driver_name || '-'
                      : del.driver_name || '-'}
                  </td>
                  <td>{del.scheduledDate ? formatDate(del.scheduledDate) : 'غير محدد'}</td>
                  <td>
                    <span className={getStatusBadgeClass(del.status)}>
                      {getStatusLabel(del.status)}
                    </span>
                  </td>
                  <td>
                    {del.status === 'pending' && (
                      <button
                        onClick={() => openAssignModal(del)}
                        className="btn btn-sm btn-primary"
                      >
                        <User className="w-4 h-4" />
                        تعيين
                      </button>
                    )}
                    {['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(del.status) && (
                      <button
                        onClick={() => openJourneyModal(del)}
                        className="btn btn-sm btn-outline"
                      >
                        <Clock className="w-4 h-4" />
                        {t('delivery.viewJourney')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('nav.delivery')}</h1>
          <p>{t('delivery.subtitle')}</p>
        </div>
        {userRole === 'driver' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-primary">وضع السائق</span>
          </div>
        )}
      </div>

      {/* Role Selector */}
      <div className="card" style={{ marginBottom: '24px', padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#64748b', marginRight: '8px' }}>{t('delivery.viewAs')}:</span>
          <button
            onClick={() => setUserRole('driver')}
            className={`btn ${userRole === 'driver' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <User className="w-4 h-4" />
            {t('delivery.driverRole')}
          </button>
          <button
            onClick={() => setUserRole('foreman')}
            className={`btn ${userRole === 'foreman' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Truck className="w-4 h-4" />
            {t('delivery.supervisorRole')}
          </button>
        </div>
      </div>

      {/* Driver Mobile View */}
      {userRole === 'driver' && <DriverMobileView />}

      {/* Foreman Dashboard */}
      {userRole === 'foreman' && (
        <>
          {/* Tabs */}
          <div className="card" style={{ marginBottom: '24px', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveTab('deliveries')}
                className={`btn ${activeTab === 'deliveries' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Route className="w-4 h-4" />
                {t('delivery.deliveries')}
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`btn ${activeTab === 'vehicles' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Truck className="w-4 h-4" />
                {t('delivery.vehicles')}
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && activeTab === 'deliveries' && (
            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">إجمالي التوصيلات</p>
                    <p className="stat-value">{stats.total || 0}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">معلق</p>
                    <p className="stat-value" style={{ color: '#b45309' }}>{stats.pending || 0}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">قيد التوصيل</p>
                    <p className="stat-value" style={{ color: '#0369a1' }}>{stats.inTransit || 0}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#d1fae5', color: '#047857' }}>
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">تم التوصيل</p>
                    <p className="stat-value" style={{ color: '#059669' }}>{stats.delivered || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stats && activeTab === 'vehicles' && (
            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">{t('delivery.totalVehicles')}</p>
                    <p className="stat-value">{stats.total}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#d1fae5', color: '#047857' }}>
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">{t('common.available')}</p>
                    <p className="stat-value" style={{ color: '#059669' }}>{stats.available || 0}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                    <Route className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">قيد التوصيل</p>
                    <p className="stat-value" style={{ color: '#2563eb' }}>{stats.onDelivery || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          {activeTab === 'deliveries' ? (
            <ForemanDashboard />
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>رقم اللوحة</th>
                    <th>النوع</th>
                    <th>الموديل</th>
                    <th>السعة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '48px' }}>
                        <Truck className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                        <p style={{ color: '#64748b' }}>لم يتم العثور على مركبات</p>
                      </td>
                    </tr>
                  ) : (
                    vehicles.map((veh) => (
                      <tr key={veh._id}>
                        <td style={{ fontWeight: 600 }}>{veh.plate_number}</td>
                        <td style={{ textTransform: 'capitalize' }}>{veh.type?.replace('_', ' ')}</td>
                        <td>{veh.model}</td>
                        <td>
                          {veh.capacity_kg
                            ? `${parseFloat(veh.capacity_kg).toLocaleString()} كجم`
                            : '-'}
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(veh.status)}>
                            {veh.status === 'available' ? 'متاح'
                              : veh.status === 'on_delivery' ? 'قيد الاستخدام'
                              : veh.status === 'in_use' ? 'قيد الاستخدام'
                              : veh.status === 'unavailable' ? 'غير متاح'
                              : veh.status === 'maintenance' ? 'صيانة'
                              : getStatusLabel(veh.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Delivery Confirmation Modal */}
      {showConfirmModal && selectedDelivery && (
        <div className="modal-overlay" onClick={closeConfirmModal}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{t('delivery.complete')}</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                  {selectedDelivery.deliveryNumber} - {selectedDelivery.client?.name}
                </p>
              </div>
              <button 
                className="modal-close" 
                onClick={closeConfirmModal}
                style={{ fontSize: '24px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Status Selection */}
              <div style={{ marginBottom: '24px' }}>
                <label className="form-label">حالة التوصيل</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['completed', 'partial', 'rejected'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setConfirmationData(prev => ({ ...prev, status }))}
                      className="btn"
                      style={{
                        flex: 1,
                        background: confirmationData.status === status ? 
                          (status === 'completed' ? '#22c55e' : status === 'partial' ? '#f59e0b' : '#ef4444') : 'white',
                        color: confirmationData.status === status ? 'white' : '#374151',
                        border: `1px solid ${confirmationData.status === status ? 'transparent' : '#d1d5db'}`
                      }}
                    >
                      {status === 'completed' && <CheckCircle className="w-4 h-4" />}
                      {status === 'partial' && <AlertCircle className="w-4 h-4" />}
                      {status === 'rejected' && <X className="w-4 h-4" />}
                      {status === 'completed' ? 'مكتمل' : status === 'partial' ? 'جزئي' : 'مرفوض'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  العناصر المسلمة
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {confirmationData.deliveredItems.map((item, index) => (
                    <div 
                      key={index}
                      style={{ 
                        background: '#f9fafb', 
                        borderRadius: '8px', 
                        padding: '12px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '500' }}>{item.itemName}</span>
                        <span style={{ color: '#64748b', fontSize: '14px' }}>
                          الكمية المطلوبة: {item.orderedQty}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            الكمية المسلمة
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            value={item.deliveredQty}
                            onChange={(e) => updateDeliveredItem(index, 'deliveredQty', parseInt(e.target.value) || 0)}
                            min="0"
                            max={item.orderedQty}
                            style={{ padding: '6px 10px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            الكمية المرفوضة
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            value={item.rejectedQty}
                            onChange={(e) => updateDeliveredItem(index, 'rejectedQty', parseInt(e.target.value) || 0)}
                            min="0"
                            max={item.orderedQty}
                            style={{ padding: '6px 10px', fontSize: '14px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            الحالة
                          </label>
                          <select
                            className="form-input"
                            value={item.condition}
                            onChange={(e) => updateDeliveredItem(index, 'condition', e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '14px' }}
                          >
                            <option value="good">جيد</option>
                            <option value="damaged">تالف</option>
                            <option value="expired">منتهي</option>
                          </select>
                        </div>
                      </div>
                      {item.rejectedQty > 0 && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t('expenses.rejectionReason')}
                          value={item.rejectionReason}
                          onChange={(e) => updateDeliveredItem(index, 'rejectionReason', e.target.value)}
                          style={{ marginTop: '8px', fontSize: '14px' }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Receiver Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  تفاصيل المستلم
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">الاسم <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{
                      padding: '10px 14px', background: '#f3f4f6', borderRadius: '8px',
                      fontSize: '15px', fontWeight: 600, color: '#111827', border: '1px solid #e5e7eb'
                    }}>
                      {confirmationData.receivedBy.name || '—'}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('common.phone')}</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={confirmationData.receivedBy.phone}
                      onChange={(e) => setConfirmationData(prev => ({
                        ...prev,
                        receivedBy: { ...prev.receivedBy, phone: e.target.value }
                      }))}
                      placeholder={t('common.phone')}
                    />
                  </div>
                </div>

                {/* STAGE 2: OTP disabled for now — hide UI entirely */}
                {false && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <button
                      onClick={sendOTP}
                      disabled={otpSent}
                      className="btn btn-sm btn-outline"
                      style={{ flexShrink: 0 }}
                    >
                      <Send className="w-4 h-4" />
                      {otpSent ? 'تم إرسال OTP' : 'إرسال OTP'}
                    </button>
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="أدخل رمز OTP مكون من 6 أرقام"
                        maxLength={6}
                        style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                      />
                      <button
                        onClick={verifyOTP}
                        disabled={otpCode.length !== 6 || otpVerified}
                        className="btn btn-sm btn-primary"
                      >
                        <Check className="w-4 h-4" />
                        تحقق
                      </button>
                    </div>
                  </div>
                  {otpVerified && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e' }}>
                      <CheckCircle className="w-4 h-4" />
                      <span style={{ fontSize: '14px' }}>تم التحقق من OTP</span>
                    </div>
                  )}
                </div>
                )}
                {/* END STAGE 2 OTP block */}
              </div>

              {/* Proof Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  إثبات التوصيل
                </h4>
                
                {/* Photo Upload */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">الصور (بحد أقصى 3)</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {uploadedPhotos.map((photo, index) => (
                      <div
                        key={index}
                        style={{
                          width: '100px',
                          height: '100px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          position: 'relative',
                          border: '2px solid #e5e7eb'
                        }}
                      >
                        <img
                          src={photo}
                          alt={`إثبات ${index + 1}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {uploadedPhotos.length < 3 && (
                      <label style={{ 
                        width: '100px', 
                        height: '100px', 
                        borderRadius: '8px', 
                        border: '2px dashed #d1d5db',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        background: '#f9fafb'
                      }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          style={{ display: 'none' }}
                          multiple={uploadedPhotos.length < 2}
                        />
                        <Camera className="w-6 h-6" style={{ color: '#64748b', marginBottom: '4px' }} />
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{t('delivery.addPhoto')}</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Signature Capture */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">توقيع المستلم</label>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#f9fafb' }}>
                    <canvas
                      ref={signatureRef}
                      width={640}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      style={{ width: '100%', height: '120px', cursor: 'crosshair', display: 'block' }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={clearSignature}>
                      <X className="w-4 h-4" /> مسح التوقيع
                    </button>
                    {confirmationData.deliveryProof.signature && (
                      <span style={{ fontSize: '12px', color: '#22c55e' }}>{t('assets.signatureCaptured')}</span>
                    )}
                  </div>
                </div>

                {/* GPS Location */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '12px',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #86efac'
                }}>
                  <MapPinIcon className="w-5 h-5" style={{ color: '#22c55e' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>تم التقاط موقع GPS</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      {confirmationData.deliveryProof.gpsLocation
                        ? `خط العرض: ${confirmationData.deliveryProof.gpsLocation.latitude?.toFixed(4)}, خط الطول: ${confirmationData.deliveryProof.gpsLocation.longitude?.toFixed(4)}`
                        : 'جاري تحديد الموقع...'}
                    </p>
                  </div>
                  <span className="badge badge-success">{t('common.statuses.active')}</span>
                </div>
              </div>

              {/* Notes & Rating */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  معلومات إضافية
                </h4>

                {/* Customer Rating */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">تقييم العميل</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setConfirmationData(prev => ({ ...prev, customerRating: star }))}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                      >
                        <Star 
                          className="w-6 h-6" 
                          style={{ 
                            fill: star <= confirmationData.customerRating ? '#fbbf24' : 'none',
                            color: star <= confirmationData.customerRating ? '#fbbf24' : '#d1d5db'
                          }} 
                        />
                      </button>
                    ))}
                    <span style={{ marginLeft: '8px', fontSize: '14px', color: '#64748b' }}>
                      {confirmationData.customerRating} / 5
                    </span>
                  </div>
                </div>

                {/* Issues */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">المشكلات المواجهة</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['تأخير مروري', 'عنوان خاطئ', 'العميل غير متاح', 'مشكلة في المركبة', 'بضائع تالفة'].map((issue) => (
                      <label key={issue} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={confirmationData.issues.includes(issue)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setConfirmationData(prev => ({
                                ...prev,
                                issues: [...prev.issues, issue]
                              }));
                            } else {
                              setConfirmationData(prev => ({
                                ...prev,
                                issues: prev.issues.filter(i => i !== issue)
                              }));
                            }
                          }}
                        />
                        <span style={{ fontSize: '14px' }}>{issue}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Delivery Notes */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('delivery.notes')}</label>
                  <textarea
                    className="form-textarea"
                    value={confirmationData.deliveryNotes}
                    onChange={(e) => setConfirmationData(prev => ({ ...prev, deliveryNotes: e.target.value }))}
                    placeholder="أي ملاحظات إضافية حول التوصيل..."
                    rows="3"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeConfirmModal}>
                إلغاء
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleConfirmDelivery}
                 disabled={!confirmationData.receivedBy.name /* STAGE 2: otpVerified check removed */ || confirmationData.deliveredItems.some(item => item.deliveredQty < 0)}
              >
                <CheckCircle2 className="w-4 h-4" />
                تأكيد التوصيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal - Enhanced */}
      {showAssignModal && selectedDelivery && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div 
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px' }}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{t('delivery.assignTitle')}</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                  {selectedDelivery.deliveryNumber} - {selectedDelivery.client?.name}
                </p>
              </div>
              <button 
                className="modal-close" 
                onClick={closeAssignModal}
                style={{ fontSize: '24px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              {/* Delivery Details Section */}
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '8px', 
                padding: '16px', 
                marginBottom: '24px',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', color: '#374151' }}>
                  تفاصيل التوصيل
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>{t('assets.totalBags')}: </span>
                    <span style={{ fontWeight: '600' }}>{selectedDelivery.totalBags}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>{t('assets.totalWeight')}: </span>
                    <span style={{ fontWeight: '600' }}>{formatNumber(calculateDeliveryWeight(selectedDelivery))} kg</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>العناصر: </span>
                    <span style={{ fontWeight: '600' }}>{selectedDelivery.items?.length || 0}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>المجدول: </span>
                    <span style={{ fontWeight: '600' }}>
                      {selectedDelivery.scheduledDate ? formatDate(selectedDelivery.scheduledDate) : 'غير محدد'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <MapPin className="w-4 h-4" style={{ color: '#64748b', marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px' }}>{selectedDelivery.deliveryAddress}</span>
                  </div>
                </div>
              </div>

              {/* Error/Success Messages */}
              {assignError && (
                <div style={{ 
                  background: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle className="w-5 h-5" style={{ color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ color: '#dc2626', fontSize: '14px' }}>{assignError}</span>
                </div>
              )}
              
              {assignSuccess && (
                <div style={{ 
                  background: '#f0fdf4', 
                  border: '1px solid #86efac', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#22c55e', flexShrink: 0 }} />
                  <span style={{ color: '#16a34a', fontSize: '14px' }}>{assignSuccess}</span>
                </div>
              )}

              {/* Vehicle Selection */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  اختر مركبة <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={assignForm.vehicle}
                  onChange={(e) => {
                    const vehicleId = e.target.value;
                    setAssignForm(prev => ({
                      ...prev,
                      vehicle: vehicleId,
                      driver: '' // Reset driver when vehicle changes
                    }));
                    // Check availability when vehicle is selected
                    if (vehicleId) {
                      checkVehicleAvailability(vehicleId).then(setVehicleAvailability);
                    } else {
                      setVehicleAvailability({});
                    }
                  }}
                  disabled={assignLoading}
                >
                  <option value="">اختر مركبة</option>
                  {vehicles
                    .filter(v => v.status === 'available' || v._id === selectedDelivery?.vehicle?._id)
                    .map(veh => (
                    <option key={veh._id} value={veh._id}>
                      {veh.plate_number} - {veh.model} ({formatNumber(veh.capacity_kg ?? 0)} كجم)
                    </option>
                  ))}
                </select>
                
                {/* Vehicle Availability Warning */}
                {vehicleAvailability.message && !vehicleAvailability.available && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: '#fff7ed', 
                    border: '1px solid #fed7aa',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px'
                  }}>
                    <AlertCircle className="w-4 h-4" style={{ color: '#f97316', flexShrink: 0 }} />
                    <span style={{ color: '#ea580c' }}>{vehicleAvailability.message}</span>
                  </div>
                )}

                {/* Vehicle Capacity Check */}
                {assignForm.vehicle && selectedDelivery && (
                  <div style={{ marginTop: '12px' }}>
                    {(() => {
                      const vehicle = vehicles.find(v => String(v._id) === String(assignForm.vehicle));
                      const vehicleCap = vehicle?.capacity_kg || vehicle?.capacityKg || 0;
                      const deliveryWeight = calculateDeliveryWeight(selectedDelivery);
                      const isSufficient = !vehicleCap || parseFloat(vehicleCap) >= deliveryWeight;

                      return (
                        <div style={{
                          padding: '10px 12px',
                          background: isSufficient ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${isSufficient ? '#86efac' : '#fecaca'}`,
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>{t('assets.vehicleCapacity')}:</span>
                            <span style={{ fontWeight: 600, color: isSufficient ? '#16a34a' : '#dc2626' }}>
                              {vehicleCap ? `${parseFloat(vehicleCap).toLocaleString()} كجم` : '-'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>{t('assets.deliveryWeight')}:</span>
                            <span style={{ fontWeight: 600, color: '#374151' }}>
                              {formatNumber(deliveryWeight)} kg
                            </span>
                          </div>
                          {!isSufficient && (
                            <div style={{
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: '1px solid #fecaca',
                              color: '#dc2626',
                              fontWeight: 500
                            }}>
                              ⚠️ سعة المركبة غير كافية لهذا التوصيل!
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Driver Selection */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">
                  اختر سائقاً <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={assignForm.driver}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, driver: e.target.value }))}
                  disabled={assignLoading || !assignForm.vehicle}
                >
                  <option value="">
                    {!assignForm.vehicle ? 'اختر مركبة أولاً' : 'اختر سائقاً...'}
                  </option>
                  {availableDrivers.map(driver => (
                    <option key={driver._id} value={driver._id}>
                      {driver.name || `${driver.firstName} ${driver.lastName}`.trim()}
                    </option>
                  ))}
                </select>
                
                {/* Driver Details Card */}
                {assignForm.driver && (
                  <div style={{ 
                    marginTop: '12px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px'
                  }}>
                    {(() => {
                      const driver = availableDrivers.find(d => d._id === assignForm.driver);
                      if (!driver) return null;
                      
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ 
                              width: '40px', 
                              height: '40px', 
                              borderRadius: '50%', 
                              background: '#3b82f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 600
                            }}>
                              {(driver.firstName || driver.name || '?')[0]}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600 }}>{driver.name || `${driver.firstName} ${driver.lastName}`.trim()}</p>
                              {driver.phone && (
                                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                                  <Phone className="w-3 h-3" style={{ display: 'inline', marginRight: '4px' }} />
                                  {driver.phone}
                                </p>
                              )}
                            </div>
                          </div>
                          <div style={{ 
                            padding: '8px 12px', 
                            background: driver.currentAssignment === 'متاح' ? '#f0fdf4' : '#fff7ed',
                            borderRadius: '6px',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: driver.currentAssignment === 'متاح' ? '#22c55e' : '#f97316'
                            }} />
                            <span style={{ 
                              color: driver.currentAssignment === 'متاح' ? '#16a34a' : '#ea580c',
                              fontWeight: 500
                            }}>
                              {driver.currentAssignment}
                            </span>
                          </div>
                          {driver.vehicle && (
                            <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                              <Truck className="w-3 h-3" style={{ display: 'inline', marginRight: '4px' }} />
                              المركبة المعينة: {driver.vehicle.plateNumber} ({driver.vehicle.model})
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Notify Checkbox */}
              <div style={{
                padding: '12px',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={assignForm.notifyDriver}
                    onChange={(e) => setAssignForm(prev => ({ ...prev, notifyDriver: e.target.checked }))}
                    disabled={assignLoading}
                  />
                  <span style={{ fontSize: '14px', color: '#1e40af', fontWeight: 500 }}>
                    إرسال إشعار للسائق
                  </span>
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '12px', color: '#64748b' }}>
                  سيتلقى السائق رسالة SMS وواتساب بشأن التعيين الجديد
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={closeAssignModal}
                disabled={assignLoading}
              >
                إلغاء
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleAssign(false)}
                disabled={!assignForm.vehicle || !assignForm.driver || assignLoading}
                style={{ minWidth: '140px' }}
              >
                {assignLoading ? (
                  <span>{t('assets.assigning')}</span>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    تعيين توصيل
                  </>
                )}
              </button>
              <button
                className="btn btn-success"
                onClick={handleAssignAndNotify}
                disabled={!assignForm.vehicle || !assignForm.driver || assignLoading}
                style={{
                  background: '#22c55e',
                  minWidth: '160px'
                }}
              >
                {assignLoading ? (
                  <span>{t('assets.assigning')}</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    تعيين وإشعار
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journey History Modal */}
      {showJourneyModal && selectedDelivery && (
        <div className="modal-overlay" onClick={closeJourneyModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{t('delivery.journey')}</h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                  {selectedDelivery.deliveryNumber} - {selectedDelivery.client?.name}
                </p>
              </div>
              <button 
                className="modal-close" 
                onClick={closeJourneyModal}
                style={{ fontSize: '24px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ position: 'relative', paddingLeft: '24px' }}>
                {journeyHistory.length === 0 ? (
                  <p style={{ color: '#64748b' }}>{t('assets.noJourneyHistory')}</p>
                ) : (
                  journeyHistory.map((entry, index) => (
                    <div key={index} style={{ marginBottom: '20px', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-24px',
                        top: '4px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: '#22c55e',
                        border: '2px solid white',
                        boxShadow: '0 0 0 2px #22c55e'
                      }} />
                      {index < journeyHistory.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          left: '-20px',
                          top: '20px',
                          width: '2px',
                          height: 'calc(100% + 8px)',
                          background: '#e5e7eb'
                        }} />
                      )}
                      <div>
                        <p style={{ fontWeight: '600', margin: '0 0 4px 0' }}>
                          {getStatusLabel(entry.status)}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>
                          {formatNumber(new Date(entry.timestamp))}
                        </p>
                        {entry.notes && (
                          <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>
                            {entry.notes}
                          </p>
                        )}
                        {entry.gpsLocation && (
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                            📍 {entry.gpsLocation.latitude}, {entry.gpsLocation.longitude}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeJourneyModal}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
