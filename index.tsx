
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DownloadRedirect } from './app/components/DownloadRedirect';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Simple Client-Side Routing for /download
const path = window.location.pathname;
const isDownloadRoute =
  path === '/download' ||
  path === '/download/' ||
  window.location.href.includes('/download#') ||
  window.location.href.includes('/download?');

if (isDownloadRoute) {
  root.render(
    <React.StrictMode>
      <DownloadRedirect />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
