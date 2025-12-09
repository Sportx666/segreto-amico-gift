// Version check utility for multi-layer cache busting
// Compares client build time against server version.json

const VERSION_CHECK_DEBOUNCE_KEY = 'last-version-check';
const DEBOUNCE_MS = 30000; // 30 seconds minimum between checks

export interface VersionInfo {
  version: string;
  timestamp: number;
}

export async function checkForUpdates(): Promise<boolean> {
  // Debounce: don't check too frequently
  const lastCheck = sessionStorage.getItem(VERSION_CHECK_DEBOUNCE_KEY);
  if (lastCheck && Date.now() - parseInt(lastCheck) < DEBOUNCE_MS) {
    return false;
  }

  try {
    // Fetch version.json with cache busting
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) {
      console.log('[VersionCheck] version.json not found, skipping check');
      return false;
    }

    const serverVersion: VersionInfo = await response.json();
    const clientVersion = import.meta.env.VITE_BUILD_TIME;

    sessionStorage.setItem(VERSION_CHECK_DEBOUNCE_KEY, Date.now().toString());

    // Compare versions
    if (serverVersion.version && clientVersion && serverVersion.version !== clientVersion) {
      console.log(`[VersionCheck] Update available: ${clientVersion} → ${serverVersion.version}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[VersionCheck] Error checking for updates:', error);
    return false;
  }
}

export function triggerUpdateReload(): void {
  sessionStorage.setItem('app-just-updated', 'true');
  window.location.reload();
}

// Check and reload if update is available
export async function checkAndReloadIfNeeded(): Promise<void> {
  const hasUpdate = await checkForUpdates();
  if (hasUpdate) {
    triggerUpdateReload();
  }
}
