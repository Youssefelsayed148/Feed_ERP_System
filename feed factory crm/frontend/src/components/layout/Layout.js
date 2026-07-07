import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { init } from '../../utils/i18n';

const Layout = () => {
  useEffect(() => {
    // Arabic is the system's fixed language for now.
    init('ar');
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