import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { initDebug } from '@/lib/debug'
import './index.css'

initDebug();
createRoot(document.getElementById("root")!).render(<App />);
