const VERSION_CHECK_DEBOUNCE = 30 * 1000; // 30 seconds
const VERSION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
const UPDATE_FLAG_KEY = 'app-just-updated';

let lastCheckTime = 0;
let currentBuildTime: string | null = null;

// Get the build time from Vite env
const getBuildTime = (): string => {
  if (!currentBuildTime) {
    currentBuildTime = import.meta.env.VITE_BUILD_TIME || 'unknown';
  }
  return currentBuildTime;
};

// Check if a new version is available by fetching version.json
export const checkForUpdates = async (): Promise<boolean> => {
  const now = Date.now();
  
  // Debounce: skip if checked recently
  if (now - lastCheckTime < VERSION_CHECK_DEBOUNCE) {
    return false;
  }
  
  lastCheckTime = now;
  
  try {
    // Fetch version.json with cache-busting query param
    const response = await fetch(`/version.json?t=${now}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.log('[VersionCheck] version.json not found, skipping check');
      return false;
    }
    
    const data = await response.json();
    const serverVersion = data.version;
    const clientVersion = getBuildTime();
    
    console.log('[VersionCheck] Server version:', serverVersion, 'Client version:', clientVersion);
    
    // If versions differ, update is available
    if (serverVersion && clientVersion !== 'unknown' && serverVersion !== clientVersion) {
      console.log('[VersionCheck] New version detected!');
      return true;
    }
    
    return false;
  } catch (error) {
    console.log('[VersionCheck] Error checking for updates:', error);
    return false;
  }
};

// Perform update: set flag and reload
const performUpdate = () => {
  sessionStorage.setItem(UPDATE_FLAG_KEY, 'true');
  window.location.reload();
};

// Check and update if needed
const checkAndUpdate = async () => {
  const hasUpdate = await checkForUpdates();
  if (hasUpdate) {
    console.log('[VersionCheck] Reloading to apply update...');
    performUpdate();
  }
};

// Initialize the version checker with all detection layers
export const initVersionChecker = () => {
  console.log('[VersionCheck] Initializing multi-layer version checker');
  console.log('[VersionCheck] Current build:', getBuildTime());
  
  // Layer 1: Check on app load (after a small delay to not block initial render)
  setTimeout(() => {
    checkAndUpdate();
  }, 2000);
  
  // Layer 2: Periodic check every 3 minutes
  setInterval(() => {
    checkAndUpdate();
  }, VERSION_CHECK_INTERVAL);
  
  // Layer 3: Check on visibility change (when app comes back from background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[VersionCheck] App became visible, checking for updates...');
      checkAndUpdate();
    }
  });
};

// Hook for route-based version checking
export const checkVersionOnRouteChange = () => {
  checkAndUpdate();
};
