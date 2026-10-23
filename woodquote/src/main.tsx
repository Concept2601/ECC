import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import App from './App';
import LicenceGate from './components/Licence';
import './index.css';
import { flushSave } from './store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LicenceGate>
      <App />
    </LicenceGate>
  </StrictMode>,
);

// Ask the browser / phone not to clear the saved database when storage runs low
void navigator.storage?.persist?.().catch(() => undefined);

// Android hardware back button: navigate back inside the app, exit on the home screen
if (Capacitor.isNativePlatform()) {
  // save right away when the app is sent to the background (Android may close it)
  CapApp.addListener('pause', () => void flushSave());
  CapApp.addListener('backButton', () => {
    const atHome = window.location.hash === '' || window.location.hash === '#/';
    if (atHome) CapApp.exitApp();
    else window.history.back();
  });
}
