import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// The service worker (public/sw.js) makes PASAKJA installable and shows push notifications.
// Browsers allow it only on HTTPS or localhost. Chrome shows its own "Install app" option.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('Service worker not registered.', error));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
