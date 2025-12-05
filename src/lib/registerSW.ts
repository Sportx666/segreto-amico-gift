import { registerSW } from 'virtual:pwa-register'

// Store the update function globally so React can call it
let pendingUpdate: (() => Promise<void>) | null = null

export const initServiceWorker = () => {
  const updateSW = registerSW({
    onNeedRefresh() {
      console.log('New version available')
      // Store the update function
      pendingUpdate = () => updateSW(true)
      // Dispatch custom event for React to handle
      window.dispatchEvent(new CustomEvent('sw-update-available'))
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
    onRegisteredSW(swUrl, registration) {
      // Check for updates more frequently (1 min in dev, 2 min in prod)
      if (registration) {
        const interval = import.meta.env.DEV ? 60 * 1000 : 2 * 60 * 1000
        setInterval(() => {
          registration.update()
        }, interval)
      }
    },
  })
}

// Export function to trigger update from React
export const applyUpdate = async () => {
  if (pendingUpdate) {
    await pendingUpdate()
    window.location.reload()
  }
}
