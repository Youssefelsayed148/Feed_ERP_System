import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Orders from './pages/Orders';
import Sales from './pages/Sales';
import SalesRep from './pages/SalesRep';
import Inventory from './pages/Inventory';
import FeedRecipes from './pages/FeedRecipes';
import HR from './pages/HR';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Assets from './pages/Assets';
import MaintenanceReminders from './pages/MaintenanceReminders';
import Delivery from './pages/Delivery';
import Legal from './pages/Legal';

// New Module Pages
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import GRN from './pages/GRN';
import Payables from './pages/Payables';
import Expenses from './pages/Expenses';
import Payroll from './pages/Payroll';
import Production from './pages/Production';
import Accountant from './pages/Accountant';

import { authService } from './services/api';
import './styles/index.css';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clients" element={<Clients />} />
            <Route path="orders" element={<Orders />} />
            <Route path="sales" element={<Sales />} />
            <Route path="sales-rep" element={<SalesRep />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="feed-recipes" element={<FeedRecipes />} />
            <Route path="finance" element={<Finance />} />
            <Route path="finance/receivables" element={<Finance />} />
            <Route path="finance/payables" element={<Payables />} />
            <Route path="finance/expenses" element={<Expenses />} />
            <Route path="hr" element={<HR />} />
            <Route path="hr/payroll" element={<Payroll />} />
            <Route path="settings" element={<Settings />} />
            <Route path="delivery" element={<Delivery />} />
            <Route path="assets" element={<Assets />} />
            <Route path="maintenance-reminders" element={<MaintenanceReminders />} />
            <Route path="legal" element={<Legal />} />
            
            {/* Purchasing Routes */}
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="grn" element={<GRN />} />

            {/* Production Routes */}
            <Route path="production" element={<Production />} />

            {/* Accounting Routes */}
            <Route path="accountant" element={<Accountant />} />
            <Route path="accounting" element={<Accountant />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;