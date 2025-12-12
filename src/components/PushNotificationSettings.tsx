import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Smartphone } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useI18n } from '@/i18n';
import { toast } from 'sonner';

export function PushNotificationSettings() {
  const { t } = useI18n();
  const { isSupported, isRegistered, loading, register, unregister } = usePushNotifications();

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await register();
      if (success) {
        toast.success(t('push_notifications.enable_success'));
      } else {
        toast.error(t('push_notifications.enable_error'));
      }
    } else {
      await unregister();
      toast.info(t('push_notifications.disabled'));
    }
  };

  if (!isSupported) {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellOff className="w-5 h-5 text-muted-foreground" />
            {t('push_notifications.title')}
          </CardTitle>
          <CardDescription>{t('push_notifications.not_supported')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="w-5 h-5 text-primary" />
          {t('push_notifications.title')}
        </CardTitle>
        <CardDescription>{t('push_notifications.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRegistered ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            <Label htmlFor="push-toggle" className="cursor-pointer">
              {isRegistered ? t('push_notifications.enabled') : t('push_notifications.disabled')}
            </Label>
          </div>
          <Switch
            id="push-toggle"
            checked={isRegistered}
            onCheckedChange={handleToggle}
            disabled={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
