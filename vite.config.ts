import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// Generate version.json at build time
const generateVersionJson = (): Plugin => {
  const buildTime = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  
  return {
    name: 'generate-version-json',
    writeBundle() {
      const versionData = {
        version: buildTime,
        timestamp: Date.now()
      };
      
      // Write to dist/version.json
      const distPath = path.resolve(__dirname, 'dist', 'version.json');
      fs.mkdirSync(path.dirname(distPath), { recursive: true });
      fs.writeFileSync(distPath, JSON.stringify(versionData, null, 2));
      console.log('[Build] Generated version.json:', versionData);
    }
  };
};

// https://vitejs.dev/config/
const buildTime = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');

export default defineConfig(({ mode }) => ({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    mode === 'production' && generateVersionJson(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}'],
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
        runtimeCaching: [
          {
            // HTML navigation - always check network first
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 }
            }
          },
          {
            // Supabase API - network only (no caching)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkOnly'
          }
        ]
      },
      includeAssets: [
        'favicon-16.png',
        'favicon-32.png',
        'favicon-48.png',
        'apple-touch-icon.png'
      ],
      manifest: {
        name: 'Amico Segreto',
        short_name: 'AmicoSegreto',
        description: 'Organizza il tuo scambio di regali perfetto',
        theme_color: '#0f6d2f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
