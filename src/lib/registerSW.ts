import { registerSW } from 'virtual:pwa-register'
import { checkAndReloadIfNeeded } from './versionCheck'

const UPDATE_FLAG_KEY = 'app-just-updated'

export const initServiceWorker = () => {
  // Register with autoUpdate - SW will activate immediately
  registerSW({
    immediate: true,
    onOfflineReady() {
      console.log('App ready to work offline')
    },
    onRegisteredSW(swUrl, registration) {
      console.log('Service worker registered:', swUrl)
      // Check for updates periodically (1 min in dev, 3 min in prod)
      if (registration) {
        const interval = import.meta.env.DEV ? 60 * 1000 : 3 * 60 * 1000
        setInterval(() => {
          registration.update()
          // Also check version.json
          checkAndReloadIfNeeded()
        }, interval)
      }
    },
  })

  // Listen for when a new service worker takes control
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      sessionStorage.setItem(UPDATE_FLAG_KEY, 'true')
      window.location.reload()
    })
  }

  // Multi-layer version check: visibility change (app resume from background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAndReloadIfNeeded()
    }
  })

  // Initial version check on app load
  checkAndReloadIfNeeded()
}

// Check if app was just updated (called after reload)
export const wasJustUpdated = (): boolean => {
  const updated = sessionStorage.getItem(UPDATE_FLAG_KEY) === 'true'
  if (updated) {
    sessionStorage.removeItem(UPDATE_FLAG_KEY)
  }
  return updated
}
