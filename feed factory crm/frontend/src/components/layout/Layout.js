import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { init, getLang } from '../../utils/i18n';
import { captureLocation, startGeofenceTracking } from '../../utils/location';

const Layout = () => {
  useEffect(() => {
    const lang = getLang() || localStorage.getItem('lang') || 'en';
    init(lang);
    captureLocation('page_load');
    const cleanup = startGeofenceTracking();
    return cleanup;
  }, []);

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;