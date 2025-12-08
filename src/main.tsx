import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initDebug } from '@/lib/debug'
import { validateEnvironment } from '@/lib/validation'
import { I18nProvider } from '@/components/I18nProvider'
import { initServiceWorker } from '@/lib/registerSW'
import { initVersionChecker } from '@/lib/versionCheck'
import './index.css'

initDebug();
// Validate environment configuration on startup
validateEnvironment();
// Initialize PWA service worker with update detection
initServiceWorker();
// Initialize multi-layer version checker
initVersionChecker();

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
