import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotificationSettings } from '@/hooks/useNotifications';
import { Bell, Mail, Gift, MessageCircle, Loader2 } from 'lucide-react';

export function NotificationSettings() {
  const { settings, loading, saving, updateSettings } = useNotificationSettings();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Caricamento impostazioni...
        </CardContent>
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifiche
        </CardTitle>
        <CardDescription>
          Gestisci le tue preferenze di notifica per eventi e messaggi
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* In-app notifications */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Bell className="w-4 h-4" />
              Notifiche nell'app
            </Label>
            <p className="text-sm text-muted-foreground">
              Ricevi notifiche direttamente nell'applicazione
            </p>
          </div>
          <Switch
            checked={settings.in_app}
            onCheckedChange={(checked) => updateSettings({ in_app: checked })}
            disabled={saving}
          />
        </div>

        {/* Email notifications section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <h4 className="font-medium">Notifiche Email</h4>
          </div>

          {/* Assignment email notifications */}
          <div className="flex items-center justify-between pl-6">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Gift className="w-4 h-4" />
                Assegnazioni regalo
              </Label>
              <p className="text-sm text-muted-foreground">
                Ricevi email quando viene effettuato il sorteggio
              </p>
            </div>
            <Switch
              checked={settings.email_assignment}
              onCheckedChange={(checked) => updateSettings({ email_assignment: checked })}
              disabled={saving}
            />
          </div>

          {/* Chat digest email notifications */}
          <div className="flex items-center justify-between pl-6">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="w-4 h-4" />
                Riassunto chat giornaliero
              </Label>
              <p className="text-sm text-muted-foreground">
                Ricevi un riassunto giornaliero dei messaggi (funzione futura)
              </p>
            </div>
            <Switch
              checked={settings.email_chat_digest}
              onCheckedChange={(checked) => updateSettings({ email_chat_digest: checked })}
              disabled={saving}
            />
          </div>
        </div>

        {saving && (
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Salvataggio in corso...
          </div>
        )}
      </CardContent>
    </Card>
  );
}