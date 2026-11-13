import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initDebug } from '@/lib/debug'
import { validateEnvironment } from '@/lib/validation'
import { I18nProvider } from '@/components/I18nProvider'
import { initServiceWorker } from '@/lib/registerSW'
import { pinterestLoad } from '@/lib/pinterest'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'

initDebug();
// Validate environment configuration on startup
validateEnvironment();
// Initialize PWA service worker with update detection
// The app bundles its own files (dist/ inside the APK); a service worker
// there would only serve stale code after an app update.
if (!Capacitor.isNativePlatform()) {
  initServiceWorker()
}
// Initialize Pinterest tag (anonymous; AuthProvider re-loads with email after sign-in)
pinterestLoad();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <I18nProvider>
      <App />
    </I18nProvider>
  </HelmetProvider>
);
