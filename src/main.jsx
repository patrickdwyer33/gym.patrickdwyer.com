import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initPWA } from './scripts/pwa';

// Initialize PWA with 60-second update check
const period = 60 * 1000;
initPWA(period);

// Render React app
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
