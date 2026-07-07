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
import Approvals from './pages/Approvals';

import { authService } from './services/api';
import './styles/index.css';

// Module permission required to access each route. Mirrors Sidebar.js's
// getMenuItems() module mapping exactly — if a route isn't in this map,
// it's treated as requiring no module check beyond being logged in
// (currently: dashboard only). Routes with `null` are owner/admin-only,
// matching the access doc (Settings is role-only, not a modulePermission).
const ROUTE_MODULES = {
  dashboard: 'dashboard',
  clients: 'clients',
  orders: 'orders',
  sales: 'sales',
  'sales-rep': 'sales',
  inventory: 'inventory',
  'feed-recipes': 'feed_recipes',
  finance: 'finance',
  'finance/receivables': 'receivables',
  'finance/payables': 'payables',
  'finance/expenses': 'expenses',
  hr: 'hr',
  'hr/payroll': 'payroll',
  delivery: 'delivery',
  assets: 'assets',
  'maintenance-reminders': 'assets',
  legal: 'legal',
  suppliers: 'suppliers',
  'purchase-orders': 'purchase_orders',
  grn: 'grn',
  production: 'production',
  accountant: 'accounting',
  accounting: 'accounting',
  approvals: 'approvals', // open to all authenticated users — each sees only their relevant tabs
  settings: null // owner/admin/ceo only — no modulePermission, per access doc
};

// Reverse map: modulePermission → default route path (used for landing redirects)
const MODULE_TO_ROUTE = {
  dashboard: '/dashboard',
  sales: '/sales',
  clients: '/clients',
  orders: '/orders',
  suppliers: '/suppliers',
  purchase_orders: '/purchase-orders',
  grn: '/grn',
  inventory: '/inventory',
  feed_recipes: '/feed-recipes',
  production: '/production',
  finance: '/finance',
  receivables: '/finance/receivables',
  payables: '/finance/payables',
  expenses: '/finance/expenses',
  accounting: '/accountant',
  legal: '/legal',
  assets: '/assets',
  hr: '/hr',
  payroll: '/hr/payroll',
  delivery: '/delivery',
  approvals: '/approvals',
};

const getUserLandingPath = (user) => {
  if (!user) return '/login';
  const role = user.role;
  if (role === 'admin' || role === 'owner' || role === 'ceo') return '/dashboard';
  const perms = user.modulePermissions || [];
  if (perms.length === 0) return '/approvals';
  const firstModule = perms[0];
  if (firstModule === 'sales' && role === 'sales_rep') return '/sales-rep';
  return MODULE_TO_ROUTE[firstModule] || '/approvals';
};

const APPROVAL_MANAGER_ROLES = ['sales_manager', 'finance_manager', 'purchasing_mgr', 'production_mgr', 'legal_mgr', 'maintenance_mgr'];

const hasModuleAccess = (user, routePath) => {
  if (!user) return false;
  const role = user.role;
  if (role === 'admin' || role === 'owner' || role === 'ceo') return true;

  if (routePath === 'approvals') return true; // all authenticated users can see their own requests

  const requiredModule = ROUTE_MODULES[routePath];
  if (requiredModule === null) return false; // settings: non-admin/owner never gets in
  if (requiredModule === undefined) return true; // unmapped routes: auth-only

  const modulePermissions = user.modulePermissions || [];
  return modulePermissions.includes(requiredModule);
};

const ProtectedRoute = ({ children, routePath }) => {
  const isAuthenticated = authService.isAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const user = authService.getCurrentUser();
  if (routePath && !hasModuleAccess(user, routePath)) {
    return <Navigate to={getUserLandingPath(user)} replace />;
  }
  return children;
};

const LandingRedirect = () => {
  const user = authService.getCurrentUser();
  return <Navigate to={getUserLandingPath(user)} replace />;
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
            <Route index element={<LandingRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute routePath="dashboard"><Dashboard /></ProtectedRoute>} />
            <Route path="clients" element={<ProtectedRoute routePath="clients"><Clients /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute routePath="orders"><Orders /></ProtectedRoute>} />
            <Route path="sales" element={<ProtectedRoute routePath="sales"><Sales /></ProtectedRoute>} />
            <Route path="sales-rep" element={<ProtectedRoute routePath="sales-rep"><SalesRep /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute routePath="inventory"><Inventory /></ProtectedRoute>} />
            <Route path="feed-recipes" element={<ProtectedRoute routePath="feed-recipes"><FeedRecipes /></ProtectedRoute>} />
            <Route path="finance" element={<ProtectedRoute routePath="finance"><Finance /></ProtectedRoute>} />
            <Route path="finance/receivables" element={<ProtectedRoute routePath="finance/receivables"><Finance /></ProtectedRoute>} />
            <Route path="finance/payables" element={<ProtectedRoute routePath="finance/payables"><Payables /></ProtectedRoute>} />
            <Route path="finance/expenses" element={<ProtectedRoute routePath="finance/expenses"><Expenses /></ProtectedRoute>} />
            <Route path="hr" element={<ProtectedRoute routePath="hr"><HR /></ProtectedRoute>} />
            <Route path="hr/payroll" element={<ProtectedRoute routePath="hr/payroll"><Payroll /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute routePath="settings"><Settings /></ProtectedRoute>} />
            <Route path="delivery" element={<ProtectedRoute routePath="delivery"><Delivery /></ProtectedRoute>} />
            <Route path="assets" element={<ProtectedRoute routePath="assets"><Assets /></ProtectedRoute>} />
            <Route path="maintenance-reminders" element={<ProtectedRoute routePath="maintenance-reminders"><MaintenanceReminders /></ProtectedRoute>} />
            <Route path="legal" element={<ProtectedRoute routePath="legal"><Legal /></ProtectedRoute>} />
            
            {/* Purchasing Routes */}
            <Route path="suppliers" element={<ProtectedRoute routePath="suppliers"><Suppliers /></ProtectedRoute>} />
            <Route path="purchase-orders" element={<ProtectedRoute routePath="purchase-orders"><PurchaseOrders /></ProtectedRoute>} />
            <Route path="grn" element={<ProtectedRoute routePath="grn"><GRN /></ProtectedRoute>} />

            {/* Production Routes */}
            <Route path="production" element={<ProtectedRoute routePath="production"><Production /></ProtectedRoute>} />

            {/* Accounting Routes */}
            <Route path="accountant" element={<ProtectedRoute routePath="accountant"><Accountant /></ProtectedRoute>} />
            <Route path="accounting" element={<ProtectedRoute routePath="accounting"><Accountant /></ProtectedRoute>} />
            <Route path="approvals" element={<ProtectedRoute routePath="approvals"><Approvals /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;