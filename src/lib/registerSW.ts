import { registerSW } from 'virtual:pwa-register'

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
      // Check for updates periodically (1 min in dev, 2 min in prod)
      if (registration) {
        const interval = import.meta.env.DEV ? 60 * 1000 : 2 * 60 * 1000
        setInterval(() => {
          registration.update()
        }, interval)
      }
    },
  })

  // Listen for when a new service worker takes control
  // This happens after the new SW activates with skipWaiting + clientsClaim
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Set flag so we can show success toast after reload
      sessionStorage.setItem(UPDATE_FLAG_KEY, 'true')
      // Reload to use new version
      window.location.reload()
    })
  }
}

// Check if app was just updated (called after reload)
export const wasJustUpdated = (): boolean => {
  const updated = sessionStorage.getItem(UPDATE_FLAG_KEY) === 'true'
  if (updated) {
    sessionStorage.removeItem(UPDATE_FLAG_KEY)
  }
  return updated
}
