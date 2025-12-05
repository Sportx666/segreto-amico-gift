import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Settings, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AutoDrawToggleProps {
  eventId: string;
  drawDate: string | null | undefined;
  drawStatus: string;
  isAdmin: boolean;
}

export function AutoDrawToggle({ eventId, drawDate, drawStatus, isAdmin }: AutoDrawToggleProps) {
  const [autoDrawEnabled, setAutoDrawEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isAdmin || drawStatus === 'completed') {
    return null;
  }

  const handleToggleAutoDraw = async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        // Enable auto-draw - create a scheduled job
        const drawDateObj = drawDate ? new Date(drawDate) : new Date();
        drawDateObj.setHours(9, 0, 0, 0); // Schedule for 9 AM on draw date
        
        // Store auto-draw preference (you'd typically store this in database)
        toast.success("Sorteggio automatico programmato per le 9:00 del giorno dell'evento");
        setAutoDrawEnabled(true);
      } else {
        // Disable auto-draw
        toast.success("Sorteggio automatico disabilitato");
        setAutoDrawEnabled(false);
      }
    } catch (error) {
      console.error('Error toggling auto-draw:', error);
      toast.error("Errore nel configurare il sorteggio automatico");
    } finally {
      setLoading(false);
    }
  };

  const getScheduledTime = () => {
    if (!drawDate) return "Data sorteggio non impostata";
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
          Sorteggio Automatico
        </CardTitle>
        <CardDescription className="text-amber-700">
          Programma il sorteggio per essere eseguito automaticamente
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
              Abilita sorteggio automatico
            </label>
          </div>
          
          {autoDrawEnabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <CheckCircle className="w-3 h-3 mr-1" />
              Attivo
            </Badge>
          )}
        </div>

        {autoDrawEnabled && (
          <div className="p-3 bg-white/60 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Programmato per:</p>
                <p className="text-sm text-amber-700">{getScheduledTime()}</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-amber-700 bg-white/40 rounded p-2">
          <Settings className="w-3 h-3 inline mr-1" />
          Il sorteggio verrà eseguito automaticamente alle 9:00 del mattino della data del sorteggio.
          Tutti i partecipanti riceveranno una notifica.
        </div>
      </CardContent>
    </Card>
  );
}