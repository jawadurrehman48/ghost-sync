import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerAppTranslations } from '@skeleton/core';
import en from './i18n/en.json';
import ur from './i18n/ur.json';
import './index.css';
import App from './App.tsx';

// Register Khata-specific translation keys on top of the skeleton's shared keys.
// Must be called before rendering so all keys are available on first paint.
registerAppTranslations({ en, ur });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
