import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Android hardware back button: navigate back inside the app, exit on the home screen
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', () => {
    const atHome = window.location.hash === '' || window.location.hash === '#/';
    if (atHome) CapApp.exitApp();
    else window.history.back();
  });
}
