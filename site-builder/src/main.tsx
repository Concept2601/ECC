import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, loadTheme } from './appTheme';
import './styles.css';

// Apply the saved colour profile before first paint to avoid a flash.
applyTheme(loadTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
