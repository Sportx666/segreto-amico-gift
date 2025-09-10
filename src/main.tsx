import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initDebug } from '@/lib/debug'
import { I18nProvider } from '@/components/I18nProvider'
import './index.css'

initDebug();
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
