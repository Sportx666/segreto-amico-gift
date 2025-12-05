import { registerSW } from 'virtual:pwa-register'

export const initServiceWorker = () => {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Auto-update without prompting
      console.log('New version available, updating...')
      updateSW(true)
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
    onRegisteredSW(swUrl, registration) {
      // Check for updates more frequently (1 min in dev, 5 min in prod)
      if (registration) {
        const interval = import.meta.env.DEV ? 60 * 1000 : 5 * 60 * 1000
        setInterval(() => {
          registration.update()
        }, interval)
      }
    },
  })
}
