import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from './lib/logger.js'

// Error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', 'GLOBAL', event.reason, {
    type: 'promise',
    promise: event.promise
  });
});

// Error handling for uncaught errors
window.addEventListener('error', (event) => {
  logger.error('Uncaught error', 'GLOBAL', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    message: event.message
  });
});

// Performance monitoring
if (import.meta.env.DEV) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        const navEntry = entry as PerformanceNavigationTiming;
        const loadTime = navEntry.loadEventEnd - navEntry.fetchStart;
        logger.performance('Page Load Time', loadTime, 'ms', {
          domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
          domComplete: navEntry.domComplete - navEntry.fetchStart
        });
      }
    }
  });
  
  observer.observe({ entryTypes: ['navigation'] });
}

// Log application startup
logger.info('React application initializing', 'APP', {
  mode: import.meta.env.MODE,
  dev: import.meta.env.DEV,
  prod: import.meta.env.PROD
});

// Get the root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  logger.error('Root element not found', 'APP', new Error('Root element not found'), {
    selector: '#root'
  });
  throw new Error('Root element not found');
}

// Create and render the React app
const root = createRoot(rootElement);

logger.info('Creating React root and rendering app', 'APP');

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

logger.info('Application successfully started', 'APP');
