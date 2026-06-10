import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { t } from '../utils/i18n';
import { 
  Truck, Plus, MapPin, Package, 
  Check, X, Play, Clock, Route, User,
  ChevronRight, AlertCircle, Camera, Star,
  Upload, Navigation, Send, Phone, Signature,
  CheckCircle, CheckCircle2, MapPinIcon
} from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || '/api';
const getAuthToken = () => localStorage.getItem('token');
const getUserRole = () => localStorage.getItem('userRole') || 'driver';

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
        const deliveriesData = data?.deliveries || [];
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
        setAvailableDrivers(data?.drivers || []);
      }
    } catch (error) {
      console.error('Error fetching available drivers:', error);
      // Fallback: extract from vehicles
      const driversFromVehicles = vehicles
        .filter(v => v.status === 'available' && v.driver)
        .map(v => ({
          _id: v.driver._id,
          firstName: v.driver.firstName,
          lastName: v.driver.lastName,
          phone: v.driver.phone || 'N/A',
          currentAssignment: v.status === 'on_delivery' ? 'قيد التوصيل' : 'متاح',
          vehicle: { _id: v._id, plateNumber: v.plateNumber, model: v.model }
        }));
      setAvailableDrivers(driversFromVehicles);
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
    const vehicle = vehicles.find(v => v._id === vehicleId);
    return {
      available: vehicle?.status === 'available',
      currentDelivery: vehicle?.status === 'on_delivery' || vehicle?.status === 'assigned',
      message: vehicle?.status === 'on_delivery' 
        ? 'Vehicle is currently on another delivery' 
        : vehicle?.status === 'assigned'
        ? 'Vehicle is already assigned to a delivery'
        : 'Vehicle is available'
    };
  };

  // Calculate delivery weight
  const calculateDeliveryWeight = (delivery) => {
    if (!delivery?.items) return 0;
    return delivery.items.reduce((total, item) => {
      const bagSize = item.packageSize || 25; // Default 25kg per bag
      return total + (bagSize * item.quantity);
    }, 0);
  };

  // Check vehicle capacity sufficiency
  const isVehicleCapacitySufficient = (vehicleId, delivery) => {
    const vehicle = vehicles.find(v => v._id === vehicleId);
    if (!vehicle || !vehicle.capacityKg) return true; // Assume sufficient if no capacity data
    
    const deliveryWeight = calculateDeliveryWeight(delivery);
    return vehicle.capacityKg >= deliveryWeight;
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
        const result = await response.json();
        setOtpSent(true);
        setOtpCode(result.otpCode); // For demo, in production don't show this
        alert(`OTP sent: ${result.otpCode}`);
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      alert('Failed to send OTP');
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
        alert('OTP verified successfully!');
      } else {
        alert('Invalid OTP code');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      alert('Failed to verify OTP');
    }
  };

  // Photo upload with cleanup
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (uploadedPhotos.length + files.length > 3) {
      alert('Maximum 3 photos allowed');
      return;
    }
    
    const newPhotos = files.map((file) => URL.createObjectURL(file));
    setUploadedPhotos([...uploadedPhotos, ...newPhotos]);
  };

  const removePhoto = (index) => {
    const url = uploadedPhotos[index];
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
    setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
  };

  // Cleanup all blob URLs on modal close
  const cleanupPhotos = () => {
    uploadedPhotos.forEach(url => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  };

  // Confirmation modal handlers
  const openConfirmModal = (delivery) => {
    setSelectedDelivery(delivery);
    setConfirmationData({
      status: 'completed',
      receivedBy: { name: '', phone: delivery.client?.phone || '', otpVerified: false },
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
        alert(`Delivered + Rejected cannot exceed ordered quantity (${max})`);
        item.deliveredQty = max - rejected;
      } else {
        item.deliveredQty = val;
      }
    } else if (field === 'rejectedQty') {
      const val = parseInt(value) || 0;
      const max = item.orderedQty;
      const delivered = item.deliveredQty;
      if (delivered + val > max) {
        alert(`Delivered + Rejected cannot exceed ordered quantity (${max})`);
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
      alert('Please enter the name of the person who received the delivery');
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
        alert('Delivery confirmed successfully! WhatsApp notification sent to customer.');
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      alert('Failed to confirm delivery');
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
      setAssignError('Please select a vehicle');
      return;
    }
    if (!assignForm.driver) {
      setAssignError('Please select a driver');
      return;
    }

    // Validate vehicle capacity
    if (!isVehicleCapacitySufficient(assignForm.vehicle, selectedDelivery)) {
      const vehicle = vehicles.find(v => v._id === assignForm.vehicle);
      const deliveryWeight = calculateDeliveryWeight(selectedDelivery);
      setAssignError(`Vehicle capacity insufficient! Vehicle: ${vehicle?.capacityKg?.toLocaleString()}kg, Delivery: ${deliveryWeight.toLocaleString()}kg`);
      return;
    }

    setAssignLoading(true);
    setAssignError('');

    try {
      // Check vehicle availability before assignment
      const availability = await checkVehicleAvailability(assignForm.vehicle);
      if (!availability.available && !selectedDelivery?.vehicle?._id) {
        setAssignError(availability.message || 'Vehicle is not available');
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
            const assignedVehicle = vehicles.find(v => v._id === assignForm.vehicle);
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
          ? 'Delivery assigned and driver notified successfully!' 
          : 'Delivery assigned successfully!';
        showNotification(successMsg);
        
        // Close modal after short delay
        setTimeout(() => {
          closeAssignModal();
        }, 1500);
      } else {
        const errorData = await response.json();
        setAssignError(errorData.message || 'Failed to assign delivery. Please try again.');
      }
    } catch (error) {
      console.error('Error assigning delivery:', error);
      setAssignError('Failed to assign delivery. Please check your connection and try again.');
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
      assigned: 'Assigned',
      accepted: 'مقبول',
      picked_up: t('delivery.pickedUp'),
      in_transit: 'قيد النقل',
      arrived: 'وصل',
      delivered: 'Delivered',
      partial: 'Partial',
      rejected: 'Rejected',
      rescheduled: 'Rescheduled',
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
          <p style={{ color: '#64748b' }}>No active deliveries assigned to you</p>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>
            Check back later for new assignments
          </p>
        </div>
      );
    }

    return (
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 8px 0' }}>
            Active Deliveries
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {activeDeliveries.length} delivery{activeDeliveries.length > 1 ? 'ies' : 'y'} in progress
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
                  <p style={{ margin: 0, fontSize: '14px' }}>{delivery.totalBags} bags · {delivery.items?.length} items</p>
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
                <span>GPS Active • Location tracking enabled</span>
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
                    Accept
                  </button>
                )}
                {delivery.status === 'accepted' && (
                  <button 
                    onClick={() => pickupDelivery(delivery._id)}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Package className="w-4 h-4" />
                    Picked Up
                  </button>
                )}
                {delivery.status === 'picked_up' && (
                  <button 
                    onClick={() => startTransit(delivery._id)}
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Truck className="w-4 h-4" />
                    Start Transit
                  </button>
                )}
                {delivery.status === 'in_transit' && (
                  <button 
                    onClick={() => markArrived(delivery._id)}
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <MapPinIcon className="w-4 h-4" />
                    Mark Arrived
                  </button>
                )}
                {delivery.status === 'arrived' && (
                  <button 
                    onClick={() => openConfirmModal(delivery)}
                    className="btn btn-success"
                    style={{ flex: 1, justifyContent: 'center', background: '#22c55e' }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Complete Delivery
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
      <div>
        {/* Map View Placeholder */}
        <div style={{ 
          background: '#f1f5f9', 
          height: '300px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <MapPin className="w-12 h-12" style={{ color: '#94a3b8' }} />
          <p style={{ color: '#64748b', margin: 0 }}>Live Map View - Active Deliveries</p>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {deliveries.filter(d => ['in_transit', 'arrived'].includes(d.status)).length} vehicles on the road
          </p>
        </div>

        {/* Assignments Table */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Delivery #</th>
                <th>{t('common.client')}</th>
                <th>{t('common.items')}</th>
                <th>Scheduled</th>
                <th>{t('common.status')}</th>
                <th>{t('delivery.assignedTo')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.filter(d => d.status === 'pending').length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>
                    <Package className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                    <p style={{ color: '#64748b' }}>No pending deliveries to assign</p>
                  </td>
                </tr>
              ) : (
                deliveries
                  .filter(d => d.status === 'pending')
                  .map(del => (
                    <tr key={del._id}>
                      <td>
                        <p style={{ fontWeight: 600, margin: 0 }}>{del.deliveryNumber}</p>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{del.totalBags} bags</p>
                      </td>
                      <td>
                        <p style={{ fontWeight: 500, margin: 0 }}>{del.client?.name}</p>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{del.deliveryAddress}</p>
                      </td>
                      <td>{del.items?.length} items</td>
                      <td>{del.scheduledDate ? new Date(del.scheduledDate).toLocaleDateString() : '-'}</td>
                      <td>
                        <span className={getStatusBadgeClass(del.status)}>
                          {getStatusLabel(del.status)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#94a3b8' }}>-</span>
                      </td>
                      <td>
                        <button
                          onClick={() => openAssignModal(del)}
                          className="btn btn-sm btn-primary"
                        >
                          <User className="w-4 h-4" />
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Active Deliveries */}
        <div style={{ marginTop: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
            Active Deliveries
          </h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Delivery #</th>
                  <th>{t('common.client')}</th>
                  <th>{t('delivery.driver')}</th>
                  <th>{t('delivery.vehicle')}</th>
                  <th>{t('common.status')}</th>
                  <th>Progress</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.filter(d => ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(d.status)).length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>
                      <p style={{ color: '#64748b' }}>{t('delivery.none')}</p>
                    </td>
                  </tr>
                ) : (
                  deliveries
                    .filter(d => ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'].includes(d.status))
                    .map(del => (
                      <tr key={del._id}>
                        <td>
                          <p style={{ fontWeight: 600, margin: 0 }}>{del.deliveryNumber}</p>
                        </td>
                        <td>{del.client?.name}</td>
                        <td>{del.driver ? `${del.driver.firstName} ${del.driver.lastName}` : '-'}</td>
                        <td>{del.vehicle?.plateNumber || '-'}</td>
                        <td>
                          <span className={getStatusBadgeClass(del.status)}>
                            {getStatusLabel(del.status)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              height: '8px', 
                              background: '#e2e8f0', 
                              borderRadius: '4px', 
                              flex: 1 
                            }}>
                              <div style={{
                                height: '100%',
                                background: '#22c55e',
                                borderRadius: '4px',
                                width: `${(getWorkflowProgress(del.status).currentIndex / 6) * 100}%`
                              }} />
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {Math.round((getWorkflowProgress(del.status).currentIndex / 6) * 100)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => openJourneyModal(del)}
                            className="btn btn-sm btn-outline"
                          >
                            <Clock className="w-4 h-4" />
                            View Journey
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>{t('nav.delivery')}</h1>
          <p>Manage deliveries and vehicles</p>
        </div>
        {userRole === 'driver' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-primary">Driver Mode</span>
          </div>
        )}
      </div>

      {/* Role Selector */}
      <div className="card" style={{ marginBottom: '24px', padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#64748b', marginRight: '8px' }}>View as:</span>
          <button
            onClick={() => setUserRole('driver')}
            className={`btn ${userRole === 'driver' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <User className="w-4 h-4" />
            Driver
          </button>
          <button
            onClick={() => setUserRole('foreman')}
            className={`btn ${userRole === 'foreman' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Truck className="w-4 h-4" />
            Foreman
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
                Deliveries
              </button>
              <button
                onClick={() => setActiveTab('vehicles')}
                className={`btn ${activeTab === 'vehicles' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <Truck className="w-4 h-4" />
                Vehicles
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && activeTab === 'deliveries' && (
            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">Today Scheduled</p>
                    <p className="stat-value">{stats.todayScheduled || 0}</p>
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="stat-icon" style={{ background: '#d1fae5', color: '#047857' }}>
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="stat-label">Delivered Today</p>
                    <p className="stat-value" style={{ color: '#059669' }}>{stats.todayDelivered || 0}</p>
                  </div>
                </div>
              </div>
              {(stats.byStatus || []).map((s) => (
                <div key={s._id} className="stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="stat-icon" style={{ 
                      background: s._id === 'pending' ? '#fef3c7' : 
                                 s._id === 'assigned' ? '#dbeafe' :
                                 s._id === 'in_transit' ? '#e0f2fe' :
                                 s._id === 'delivered' ? '#d1fae5' : '#f1f5f9',
                      color: s._id === 'pending' ? '#b45309' : 
                             s._id === 'assigned' ? '#1d4ed8' :
                             s._id === 'in_transit' ? '#0369a1' :
                             s._id === 'delivered' ? '#047857' : '#475569'
                    }}>
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="stat-label">{getStatusLabel(s._id)}</p>
                      <p className="stat-value">{s.count}</p>
                    </div>
                  </div>
                </div>
              ))}
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
                    <p className="stat-label">Total Vehicles</p>
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
                    <p className="stat-label">On Delivery</p>
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
                    <th>Plate #</th>
                    <th>Model</th>
                    <th>{t('common.type')}</th>
                    <th>{t('delivery.driver')}</th>
                    <th>{t('delivery.capacity')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '48px' }}>
                        <Truck className="w-12 h-12" style={{ margin: '0 auto 16px', color: '#94a3b8' }} />
                        <p style={{ color: '#64748b' }}>No vehicles found</p>
                      </td>
                    </tr>
                  ) : (
                    vehicles.map((veh) => (
                      <tr key={veh._id}>
                        <td style={{ fontWeight: 600 }}>{veh.plateNumber}</td>
                        <td>{veh.model}</td>
                        <td style={{ textTransform: 'capitalize' }}>{veh.type?.replace('_', ' ')}</td>
                        <td>
                          {veh.driver ? (
                            <span>{veh.driver.firstName} {veh.driver.lastName}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                        <td>{veh.capacityKg?.toLocaleString()} kg</td>
                        <td>
                          <span className={getStatusBadgeClass(veh.status)}>
                            {veh.status?.replace('_', ' ')}
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
                <label className="form-label">Delivery Status</label>
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
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  Items Delivered
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
                          Ordered: {item.orderedQty}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            Delivered Qty
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
                            Rejected Qty
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
                            Condition
                          </label>
                          <select
                            className="form-input"
                            value={item.condition}
                            onChange={(e) => updateDeliveredItem(index, 'condition', e.target.value)}
                            style={{ padding: '6px 10px', fontSize: '14px' }}
                          >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="expired">Expired</option>
                          </select>
                        </div>
                      </div>
                      {item.rejectedQty > 0 && (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Rejection reason"
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
                  Receiver Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Name <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      value={confirmationData.receivedBy.name}
                      onChange={(e) => setConfirmationData(prev => ({
                        ...prev,
                        receivedBy: { ...prev.receivedBy, name: e.target.value }
                      }))}
                      placeholder="Receiver's name"
                    />
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
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                {/* OTP Verification */}
                <div style={{ marginTop: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <button
                      onClick={sendOTP}
                      disabled={otpSent}
                      className="btn btn-sm btn-outline"
                      style={{ flexShrink: 0 }}
                    >
                      <Send className="w-4 h-4" />
                      {otpSent ? 'OTP Sent' : 'Send OTP'}
                    </button>
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
                      />
                      <button
                        onClick={verifyOTP}
                        disabled={otpCode.length !== 6 || otpVerified}
                        className="btn btn-sm btn-primary"
                      >
                        <Check className="w-4 h-4" />
                        Verify
                      </button>
                    </div>
                  </div>
                  {otpVerified && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22c55e' }}>
                      <CheckCircle className="w-4 h-4" />
                      <span style={{ fontSize: '14px' }}>OTP Verified</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Proof Section */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  Delivery Proof
                </h4>
                
                {/* Photo Upload */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Photos (max 3)</label>
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
                          alt={`Proof ${index + 1}`}
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
                  <label className="form-label">Receiver Signature</label>
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
                      <X className="w-4 h-4" /> Clear Signature
                    </button>
                    {confirmationData.deliveryProof.signature && (
                      <span style={{ fontSize: '12px', color: '#22c55e' }}>Signature captured</span>
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
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>GPS Location Captured</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      {confirmationData.deliveryProof.gpsLocation 
                        ? `Lat: ${confirmationData.deliveryProof.gpsLocation.latitude?.toFixed(4)}, Lng: ${confirmationData.deliveryProof.gpsLocation.longitude?.toFixed(4)}`
                        : 'Acquiring location...'}
                    </p>
                  </div>
                  <span className="badge badge-success">{t('common.statuses.active')}</span>
                </div>
              </div>

              {/* Notes & Rating */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>
                  Additional Information
                </h4>
                
                {/* Customer Rating */}
                <div style={{ marginBottom: '16px' }}>
                  <label className="form-label">Customer Rating</label>
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
                  <label className="form-label">Issues Encountered</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Traffic Delay', 'Wrong Address', 'Client Not Available', 'Vehicle Issue', 'Damaged Goods'].map((issue) => (
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
                  <label className="form-label">Delivery Notes</label>
                  <textarea
                    className="form-textarea"
                    value={confirmationData.deliveryNotes}
                    onChange={(e) => setConfirmationData(prev => ({ ...prev, deliveryNotes: e.target.value }))}
                    placeholder="Any additional notes about the delivery..."
                    rows="3"
                  />
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeConfirmModal}>
                Cancel
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleConfirmDelivery}
                disabled={!confirmationData.receivedBy.name || confirmationData.deliveredItems.some(item => item.deliveredQty < 0)}
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm Delivery
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
                  Delivery Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Total Bags: </span>
                    <span style={{ fontWeight: '600' }}>{selectedDelivery.totalBags}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Total Weight: </span>
                    <span style={{ fontWeight: '600' }}>{calculateDeliveryWeight(selectedDelivery).toLocaleString()} kg</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Items: </span>
                    <span style={{ fontWeight: '600' }}>{selectedDelivery.items?.length || 0}</span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Scheduled: </span>
                    <span style={{ fontWeight: '600' }}>
                      {selectedDelivery.scheduledDate ? new Date(selectedDelivery.scheduledDate).toLocaleDateString() : 'Not set'}
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
                  Select Vehicle <span style={{ color: '#ef4444' }}>*</span>
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
                  <option value="">Choose a vehicle...</option>
                  {vehicles
                    .filter(v => v.status === 'available' || v._id === selectedDelivery?.vehicle?._id)
                    .map(veh => (
                    <option key={veh._id} value={veh._id}>
                      {veh.plateNumber} - {veh.model} ({veh.capacityKg?.toLocaleString()} kg)
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
                      const vehicle = vehicles.find(v => v._id === assignForm.vehicle);
                      const deliveryWeight = calculateDeliveryWeight(selectedDelivery);
                      const isSufficient = vehicle?.capacityKg >= deliveryWeight;
                      
                      return (
                        <div style={{ 
                          padding: '10px 12px', 
                          background: isSufficient ? '#f0fdf4' : '#fef2f2', 
                          border: `1px solid ${isSufficient ? '#86efac' : '#fecaca'}`,
                          borderRadius: '6px',
                          fontSize: '13px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>Vehicle Capacity:</span>
                            <span style={{ fontWeight: 600, color: isSufficient ? '#16a34a' : '#dc2626' }}>
                              {vehicle?.capacityKg?.toLocaleString()} kg
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Delivery Weight:</span>
                            <span style={{ fontWeight: 600, color: '#374151' }}>
                              {deliveryWeight.toLocaleString()} kg
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
                              ⚠️ Vehicle capacity is insufficient for this delivery!
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
                  Select Driver <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={assignForm.driver}
                  onChange={(e) => setAssignForm(prev => ({ ...prev, driver: e.target.value }))}
                  disabled={assignLoading || !assignForm.vehicle}
                >
                  <option value="">
                    {!assignForm.vehicle ? 'Select a vehicle first' : 'Choose a driver...'}
                  </option>
                  {availableDrivers.map(driver => (
                    <option key={driver._id} value={driver._id}>
                      {driver.firstName} {driver.lastName} - {driver.phone || 'No phone'}
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
                              {driver.firstName[0]}{driver.lastName[0]}
                            </div>
                            <div>
                              <p style={{ margin: 0, fontWeight: 600 }}>{driver.firstName} {driver.lastName}</p>
                              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                                <Phone className="w-3 h-3" style={{ display: 'inline', marginRight: '4px' }} />
                                {driver.phone || 'No phone number'}
                              </p>
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
                              Assigned Vehicle: {driver.vehicle.plateNumber} ({driver.vehicle.model})
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
                    Send notification to driver
                  </span>
                </label>
                <p style={{ margin: '4px 0 0 24px', fontSize: '12px', color: '#64748b' }}>
                  Driver will receive an SMS and WhatsApp message about the new assignment
                </p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn-secondary" 
                onClick={closeAssignModal}
                disabled={assignLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => handleAssign(false)}
                disabled={!assignForm.vehicle || !assignForm.driver || assignLoading}
                style={{ minWidth: '140px' }}
              >
                {assignLoading ? (
                  <span>Assigning...</span>
                ) : (
                  <>
                    <User className="w-4 h-4" />
                    Assign Delivery
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
                  <span>Assigning...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Assign & Notify
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
                <h3 className="modal-title">Delivery Journey</h3>
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
                  <p style={{ color: '#64748b' }}>No journey history available</p>
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
                          {entry.status?.replace('_', ' ').toUpperCase()}
                        </p>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0' }}>
                          {new Date(entry.timestamp).toLocaleString()}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
