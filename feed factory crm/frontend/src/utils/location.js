// Location tracking utility with geofence auto-attendance
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
};

const getUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
};

const isDriver = () => {
  const user = getUser();
  return user?.role === 'driver';
};

// Calculate distance between two coordinates in meters (Haversine)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + 
            Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let lastAttendanceAction = null;
let geofenceCheckInterval = null;

let driverLocationInterval = null;
let activeDeliveryId = null;

export const captureLocation = async (context = 'page_load', deliveryId = null) => {
  if (!navigator.geolocation) return;
  if (!isDriver()) return;

  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 300000
      });
    });

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const dId = deliveryId || activeDeliveryId;

    // Log location — only if this is a driver
    await fetch(`${API_URL}/location/log`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        latitude: lat, longitude: lng,
        accuracy: pos.coords.accuracy,
        context,
        delivery_id: dId || null
      })
    });

    // Check geofence for auto attendance
    checkGeofence(lat, lng);

    return { lat, lng };
  } catch (e) { return null; }
};

const checkGeofence = async (lat, lng) => {
  try {
    const res = await fetch(`${API_URL}/location/factory-config`, { headers: headers() });
    if (!res.ok) return;
    const config = await res.json();
    const factoryLat = parseFloat(config.latitude);
    const factoryLng = parseFloat(config.longitude);
    const radius = parseFloat(config.radius);
    
    if (!factoryLat || !factoryLng || !radius) return;
    
    const distance = getDistance(lat, lng, factoryLat, factoryLng);
    const isInside = distance <= radius;
    
    // Only act if state changed
    const now = new Date().toISOString();
    if (isInside && lastAttendanceAction !== 'checkin') {
      await fetch(`${API_URL}/location/auto-checkin`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ latitude: lat, longitude: lng, distance: Math.round(distance) })
      });
      lastAttendanceAction = 'checkin';
      console.log('Auto clock-in at factory');
    } else if (!isInside && lastAttendanceAction === 'checkin') {
      await fetch(`${API_URL}/location/auto-checkout`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ latitude: lat, longitude: lng, distance: Math.round(distance) })
      });
      lastAttendanceAction = 'checkout';
      console.log('Auto clock-out - left factory');
    }
  } catch (e) { /* silently fail */ }
};

// Start periodic geofence check (every 2 minutes) — drivers only
export const startGeofenceTracking = () => {
  if (!isDriver()) return () => {};
  if (geofenceCheckInterval) clearInterval(geofenceCheckInterval);
  geofenceCheckInterval = setInterval(() => {
    captureLocation('geofence_check');
  }, 120000);
  return () => { if (geofenceCheckInterval) clearInterval(geofenceCheckInterval); };
};

// Start periodic location logging for driver during an active delivery
export const startDriverDeliveryTracking = (deliveryId) => {
  if (!isDriver() || !deliveryId) return () => {};
  stopDriverDeliveryTracking();
  activeDeliveryId = deliveryId;
  driverLocationInterval = setInterval(() => {
    captureLocation('delivery_tracking', deliveryId);
  }, 120000);
  return () => stopDriverDeliveryTracking();
};

// Stop driver delivery tracking and clear the active delivery
export const stopDriverDeliveryTracking = () => {
  if (driverLocationInterval) {
    clearInterval(driverLocationInterval);
    driverLocationInterval = null;
  }
  activeDeliveryId = null;
};

export const getEmployeeLocations = async () => {
  try {
    const res = await fetch(`${API_URL}/location/users`, { headers: headers() });
    if (res.ok) return (await res.json()).locations || [];
  } catch (e) {}
  return [];
};
