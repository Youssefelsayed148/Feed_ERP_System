// Location tracking utility with geofence auto-attendance
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const headers = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
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

export const captureLocation = async (context = 'page_load') => {
  if (!navigator.geolocation) return;
  try {
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 10000, maximumAge: 300000
      });
    });
    
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    
    // Log location
    await fetch(`${API_URL}/location/log`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ latitude: lat, longitude: lng, accuracy: pos.coords.accuracy, context })
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
      await fetch(`${API_URL}/attendance/auto-checkin`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ latitude: lat, longitude: lng, distance: Math.round(distance) })
      });
      lastAttendanceAction = 'checkin';
      console.log('Auto clock-in at factory');
    } else if (!isInside && lastAttendanceAction === 'checkin') {
      await fetch(`${API_URL}/attendance/auto-checkout`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ latitude: lat, longitude: lng, distance: Math.round(distance) })
      });
      lastAttendanceAction = 'checkout';
      console.log('Auto clock-out - left factory');
    }
  } catch (e) { /* silently fail */ }
};

// Start periodic geofence check (every 2 minutes)
export const startGeofenceTracking = () => {
  if (geofenceCheckInterval) clearInterval(geofenceCheckInterval);
  geofenceCheckInterval = setInterval(() => {
    captureLocation('geofence_check');
  }, 120000); // 2 minutes
  return () => { if (geofenceCheckInterval) clearInterval(geofenceCheckInterval); };
};

export const getEmployeeLocations = async () => {
  try {
    const res = await fetch(`${API_URL}/location/users`, { headers: headers() });
    if (res.ok) return (await res.json()).locations || [];
  } catch (e) {}
  return [];
};
