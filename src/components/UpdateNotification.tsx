import { useEffect } from 'react'
import { toast } from 'sonner'
import { wasJustUpdated } from '@/lib/registerSW'
import { useI18n } from '@/i18n'

export const UpdateNotification = () => {
  const { t } = useI18n()

  useEffect(() => {
    // Check if app was just updated (after auto-reload)
    if (wasJustUpdated()) {
      toast.success(t('update.updated_successfully'), {
        description: t('update.now_using_latest'),
        duration: 4000,
      })
    }
  }, [t])

  return null
}
