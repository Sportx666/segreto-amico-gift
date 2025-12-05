import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Settings, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";

interface AutoDrawToggleProps {
  eventId: string;
  drawDate: string | null | undefined;
  drawStatus: string;
  isAdmin: boolean;
}

export function AutoDrawToggle({ eventId, drawDate, drawStatus, isAdmin }: AutoDrawToggleProps) {
  const [autoDrawEnabled, setAutoDrawEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  // Fetch current auto_draw_enabled value on mount
  useEffect(() => {
    const fetchAutoDrawStatus = async () => {
      const { data, error } = await supabase
        .from('events')
        .select('auto_draw_enabled')
        .eq('id', eventId)
        .single();
      
      if (error) {
        console.error('Error fetching auto draw status:', error);
        setAutoDrawEnabled(false);
      } else {
        setAutoDrawEnabled(data?.auto_draw_enabled ?? false);
      }
    };

    if (eventId) {
      fetchAutoDrawStatus();
    }
  }, [eventId]);

  if (!isAdmin || drawStatus === 'completed') {
    return null;
  }

  // Show loading state while fetching
  if (autoDrawEnabled === null) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <Clock className="w-5 h-5" />
            {t('draw.auto_draw')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-amber-100 rounded"></div>
        </CardContent>
      </Card>
    );
  }

  const handleToggleAutoDraw = async (enabled: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('events')
        .update({ auto_draw_enabled: enabled })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      setAutoDrawEnabled(enabled);
      
      if (enabled) {
        toast.success(t('draw.auto_draw_scheduled'));
      } else {
        toast.success(t('draw.auto_draw_disabled'));
      }
    } catch (error) {
      console.error('Error toggling auto-draw:', error);
      toast.error(t('draw.auto_draw_error'));
    } finally {
      setLoading(false);
    }
  };

  const getScheduledTime = () => {
    if (!drawDate) return t('draw.no_draw_date');
    const date = new Date(drawDate);
    date.setHours(9, 0, 0, 0);
    return date.toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <Clock className="w-5 h-5" />
          {t('draw.auto_draw')}
        </CardTitle>
        <CardDescription className="text-amber-700">
          {t('draw.auto_draw_description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-draw"
              checked={autoDrawEnabled}
              onCheckedChange={handleToggleAutoDraw}
              disabled={loading}
            />
            <label htmlFor="auto-draw" className="text-sm font-medium text-amber-800">
              {t('draw.enable_auto_draw')}
            </label>
          </div>
          
          {autoDrawEnabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('draw.active')}
            </Badge>
          )}
        </div>

        {autoDrawEnabled && (
          <div className="p-3 bg-white/60 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">{t('draw.scheduled_for')}:</p>
                <p className="text-sm text-amber-700">{getScheduledTime()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-amber-700 bg-white/40 rounded p-2">
          <Settings className="w-3 h-3 inline mr-1" />
          {t('draw.auto_draw_info')}
        </div>
      </CardContent>
    </Card>
  );
}
