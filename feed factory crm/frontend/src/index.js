import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import './styles/rtl.css';
import App from './App';
import { init } from './utils/i18n';

// Initialize language (default English if not set)
const savedLang = localStorage.getItem('lang') || 'en';
init(savedLang);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);