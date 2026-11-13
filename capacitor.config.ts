import type { CapacitorConfig } from '@capacitor/cli';

// The app ships the built web app (dist/) inside the APK/AAB.
// For live-reload during development only, point the native shell at a dev
// server:  CAP_SERVER_URL=http://192.168.1.10:8080 npx cap run android
// Never set it for a Play Store build.
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  // Must match public/.well-known/assetlinks.json and can never change
  // once the app is published on Google Play.
  appId: 'fun.amicosegreto.app',
  appName: 'Amico Segreto',
  webDir: 'dist',
  server: devServerUrl
    ? { url: devServerUrl, cleartext: devServerUrl.startsWith('http://') }
    : { androidScheme: 'https' },
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
    allowMixedContent: false,
  },
};

export default config;
