import { useEffect } from 'react'
import { toast } from 'sonner'
import { applyUpdate } from '@/lib/registerSW'
import { useI18n } from '@/i18n'

export const UpdateNotification = () => {
  const { t } = useI18n()

  useEffect(() => {
    const handleUpdate = () => {
      toast(t('update.new_version_available'), {
        description: t('update.new_version_description'),
        duration: Infinity,
        action: {
          label: t('update.update_now'),
          onClick: () => applyUpdate()
        },
        cancel: {
          label: t('update.later'),
          onClick: () => {}
        }
      })
    }

    window.addEventListener('sw-update-available', handleUpdate)
    return () => window.removeEventListener('sw-update-available', handleUpdate)
  }, [t])

  return null
}
