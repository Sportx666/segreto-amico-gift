import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.75ce866ec02645ceb336e9513a194ba3',
  appName: 'amico-segreto',
  webDir: 'dist',
  server: {
    // For development: use the Lovable preview URL for hot reload
    // Comment this out for production builds
    url: 'https://75ce866e-c026-45ce-b336-e9513a194ba3.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0f0f0f',
      showSpinner: false,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
