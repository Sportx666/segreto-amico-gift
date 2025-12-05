import { registerSW } from 'virtual:pwa-register'

export const initServiceWorker = () => {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Show a confirmation to the user when a new version is available
      if (confirm('È disponibile una nuova versione! Clicca OK per aggiornare.')) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline')
    },
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 5 minutes
      if (registration) {
        setInterval(() => {
          registration.update()
        }, 5 * 60 * 1000)
      }
    },
  })
}
