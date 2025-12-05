import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventParticipants } from "@/hooks/useEventParticipants";
import { useJoinedParticipantCount } from "@/hooks/useJoinedParticipantCount";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Shuffle, CheckCircle, AlertTriangle, Users, Gift } from "lucide-react";
import { toast } from "sonner";
import { AutoDrawToggle } from "@/components/AutoDrawToggle";

interface EventDrawProps {
  eventId: string;
  userRole: string;
  event: {
    draw_status: string;
    name: string;
    date: string | null;
    draw_date?: string | null;
  };
  onStatusChange: () => void;
}

interface Member {
  id: string;
  participant_id: string;
  anonymous_name: string | null;
  role: string;
}

interface Assignment {
  id: string;
  giver_id: string;
  receiver_id: string;
}

interface Exclusion {
  giver_id: string;
  blocked_id: string;
}

export const EventDraw = ({ eventId, userRole, event, onStatusChange }: EventDrawProps) => {
  const { participants, loading: participantsLoading } = useEventParticipants(eventId);
  const { count: joinedCount, loading: countLoading } = useJoinedParticipantCount(eventId);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canDraw, setCanDraw] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  
  const isLoading = participantsLoading || countLoading;

  useEffect(() => {
    fetchData();
  }, [eventId]);

  useEffect(() => {
    // Check if we can perform draw based on participant count
    setCanDraw(joinedCount >= 2 && userRole === 'admin');
  }, [joinedCount, userRole]);

  useEffect(() => {
    if (!event.draw_date || event.draw_status === 'completed') {
      setTimeLeft("");
      return;
    }

    const target = new Date(event.draw_date).getTime();

    let timer: ReturnType<typeof setInterval>;

    const updateTime = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("0d 0h 0m 0s");
        clearInterval(timer);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    timer = setInterval(updateTime, 1000);
    updateTime();

    return () => clearInterval(timer);
  }, [event.draw_date, event.draw_status]);

  const fetchData = async () => {
    try {
      // Fetch exclusions
      const { data: exclusionsData, error: exclusionsError } = await supabase
        .from('exclusions')
        .select('giver_id, blocked_id')
        .eq('event_id', eventId)
        .eq('active', true);

      if (exclusionsError) throw exclusionsError;
      setExclusions(exclusionsData || []);

    } catch (error: unknown) {
      console.error('Error fetching exclusions data:', error);
      toast.error("Errore nel caricamento delle esclusioni");
    }
  };

  const performDraw = async () => {
    if (joinedCount < 2) {
      toast.error("Servono almeno 2 partecipanti attivi per il sorteggio");
      return;
    }

    setIsDrawing(true);
    try {
      // Call the Supabase edge function
      const { data, error } = await supabase.functions.invoke('draw', {
        body: { eventId }
      });

      if (error || !data?.assignedCount) {
        throw new Error((error as any)?.message || (data as any)?.error || "Errore durante il sorteggio");
      }

      toast.success(`Sorteggio completato! ${data.assignedCount} assegnazioni create.`);
      await fetchData();
      onStatusChange();

    } catch (error: unknown) {
      console.error('Error performing draw:', error);
      const message = error instanceof Error ? error.message : "Errore durante il sorteggio";
      toast.error(message);
    } finally {
      setIsDrawing(false);
    }
  };

  const resetDraw = async () => {
    try {
      // Call secure RPC function to reset draw
      const { error } = await supabase.rpc('reset_event_draw', {
        _event_id: eventId
      });

      if (error) throw error;

      toast.success("Sorteggio ripristinato");
      await fetchData();
      onStatusChange();

    } catch (error: unknown) {
      console.error('Error resetting draw:', error);
      toast.error("Errore nel ripristinare il sorteggio");
    }
  };

  const getMemberName = (memberId: string) => {
    const participant = participants.find(p => (p.participant_id || p.id) === memberId);
    return participant?.anonymous_name || `Utente ${memberId.slice(0, 8)}`;
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5" />
            Sorteggio Regali
          </CardTitle>
          <CardDescription>
            Stato del sorteggio per l'evento "{event.name}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {event.draw_status === 'completed' ? (
                <>
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="font-semibold text-green-700">Sorteggio Completato</p>
                    <p className="text-sm text-muted-foreground">
                      Tutti i partecipanti hanno la loro assegnazione
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="font-semibold text-orange-700">In Attesa del Sorteggio</p>
                    <p className="text-sm text-muted-foreground">
                      {event.draw_date
                        ? `Il sorteggio avverrà tra ${timeLeft}`
                        : "Il sorteggio non è ancora stato effettuato"}
                    </p>
                  </div>
                </>
              )}
            </div>
            
            {event.draw_status === 'completed' && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                Completato
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pre-Draw Checks */}
      {event.draw_status !== 'completed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controlli Pre-Sorteggio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {joinedCount >= 2 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
              <span className={joinedCount >= 2 ? "text-green-700" : "text-orange-700"}>
                Partecipanti attivi: {joinedCount} (minimo 2)
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              {userRole === 'admin' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              )}
              <span className={userRole === 'admin' ? "text-green-700" : "text-orange-700"}>
                Permessi amministratore
              </span>
            </div>

            {exclusions.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Ci sono {exclusions.length} esclusioni configurate. Il sorteggio ne terrà conto.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Draw Actions */}
      {userRole === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controlli Amministratore</CardTitle>
            <CardDescription>
              Solo l'amministratore può gestire il sorteggio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {event.draw_status !== 'completed' ? (
              <Button
                onClick={performDraw}
                disabled={!canDraw || isDrawing}
                size="lg"
                className="w-full"
              >
                <Shuffle className="w-5 h-5 mr-2" />
                {isDrawing ? "Sorteggio in corso..." : "Esegui Sorteggio"}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-700">Sorteggio Completato</p>
                  <p className="text-sm text-green-600">
                    Tutti i partecipanti hanno ricevuto la loro assegnazione
                  </p>
                </div>
                
                <Button
                  onClick={resetDraw}
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Ripristina Sorteggio
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Attenzione: ripristinando il sorteggio, tutte le assegnazioni verranno cancellate
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto Draw Toggle */}
      <AutoDrawToggle 
        eventId={eventId}
        drawDate={event.draw_date}
        drawStatus={event.draw_status}
        isAdmin={userRole === 'admin'}
      />

      {/* Privacy Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800 mb-1">Privacy del Sorteggio</h4>
              <p className="text-sm text-amber-700">
                Per mantenere la sorpresa, nessuno (nemmeno l'amministratore) può vedere tutte le assegnazioni. 
                Ogni partecipante vedrà solo a chi deve fare il regalo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {event.draw_status !== 'completed' && userRole !== 'admin' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Solo gli amministratori possono eseguire il sorteggio. Contatta l'organizzatore dell'evento.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
