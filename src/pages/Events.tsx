import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdSlot } from "@/components/AdSlot";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonGrid } from "@/components/ui/skeleton-grid";
import { Plus, Calendar, Users, Euro, Edit, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { getOrCreateParticipantId } from "@/lib/participants";
import { debugLog, isDebug } from "@/lib/debug";

interface Event {
  id: string;
  name: string;
  budget: number | null;
  date: string | null;
  draw_status: string;
  join_code: string | null;
  created_at: string;
  cover_image_url?: string | null;
  draw_date?: string | null;
  admin_profile_id?: string;
}

interface EventsProps {
  showMobileFeed?: boolean;
}

const Events = ({ showMobileFeed = false }: EventsProps) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [diag, setDiag] = useState<any>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchEvents();
  }, [authLoading, user, navigate]);

  const fetchEvents = async () => {
    try {
      debugLog("Events.fetchEvents:start", { userId: user!.id });
      const participantId = await getOrCreateParticipantId(user!.id);
      debugLog("Events.participantId", { participantId });
      setDiag((d: any) => ({ ...d, userId: user!.id, participantId }));

      // Step 1: get event ids where user is a member
      const { data: memberRows, error: membersErr } = await supabase
        .from("event_members")
        .select("event_id")
        .eq("participant_id", participantId);
      debugLog("Events.memberRows", { count: memberRows?.length, error: membersErr });
      if (membersErr) throw membersErr;

        const eventIds = (memberRows || []).map((r: any) => r.event_id).filter(Boolean);
      debugLog("Events.eventIds", { eventIds });
      setDiag((d: any) => ({ ...d, memberRowsCount: memberRows?.length ?? 0, eventIds }));

      if (eventIds.length === 0) {
        setEvents([]);
        return;
      }

      // Step 2: fetch those events
      const { data: eventsData, error: eventsErr } = await supabase
        .from("events")
        .select("*")
        .in("id", eventIds);
      debugLog("Events.eventsData", { count: eventsData?.length, error: eventsErr });
      if (eventsErr) throw eventsErr;

      const joinedEvents = (eventsData || []) as Event[];
      joinedEvents.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      setEvents(joinedEvents);
      setDiag((d: any) => ({ ...d, eventsCount: joinedEvents.length }));
    } catch (error: unknown) {
      debugLog("Events.fetchEvents:error", { error });
      setDiag((d: any) => ({ ...d, error }));
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore nel caricamento eventi", {
        description
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle py-6">
        <div className="container max-w-6xl">
          <div className="mb-8">
            <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
          <SkeletonGrid count={6} columns="3" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle py-6">
      <div className="container max-w-6xl">
        <PageHeader
          title="I Miei Eventi"
          description="Gestisci i tuoi scambi di regali"
        >
          <Link to="/events/new">
            <Button className="bg-gradient-primary hover:bg-primary-light shadow-card hover:shadow-elegant transition-all duration-300">
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Crea Evento</span>
            </Button>
          </Link>
        </PageHeader>

        {events.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-white" />}
            title="Nessun evento ancora"
            description="Crea il tuo primo scambio di regali per iniziare!"
          >
            <Link to="/events/new">
              <Button className="bg-gradient-primary hover:bg-primary-light">
                <Plus className="w-4 h-4 mr-2" />
                Crea il Primo Evento
              </Button>
            </Link>
          </EmptyState>
        ) : (
          <>
            {isDebug() && (
              <Card className="p-4 mb-6">
                <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(diag, null, 2)}</pre>
              </Card>
            )}
            
            {/* Mobile In-Feed Ad */}
            {showMobileFeed && (
              <div className="lg:hidden mb-8">
                <AdSlot 
                  id="events-mobile-feed" 
                  className="w-full"
                  placeholder="Contenuti sponsorizzati"
                />
              </div>
            )}
            
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div key={event.id} className="group relative">
                  <Link to={`/events/${event.id}`} className="block">
                    <Card className="group-hover:shadow-elegant transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm shadow-card overflow-hidden">
                    {/* Event Cover Image */}
                    <div className="aspect-16-9 overflow-hidden bg-gradient-primary relative">
                      {event.cover_image_url ? (
                        <img
                          src={event.cover_image_url}
                          alt={event.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-primary flex items-center justify-center">
                          <Calendar className="w-12 h-12 text-white/80" />
                        </div>
                      )}
                      {/* Status Badge and Edit Button Overlay */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        {event.admin_profile_id === user?.id && event.draw_status !== 'completed' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/events/${event.id}/edit`);
                            }}
                            className="p-1.5 bg-white/90 hover:bg-white text-gray-700 rounded-full transition-colors"
                            title="Modifica evento"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                          event.draw_status === 'pending' ? 'bg-accent/90 text-accent-foreground' :
                          event.draw_status === 'drawn' ? 'bg-primary/90 text-primary-foreground' :
                          'bg-secondary/90 text-secondary-foreground'
                        }`}>
                          {event.draw_status === 'pending' ? 'In Attesa' : 
                           event.draw_status === 'drawn' ? 'Sorteggiato' : 'Concluso'}
                        </span>
                      </div>
                    </div>
                    <CardHeader className="pb-3">
                      <CardTitle className="line-clamp-2 text-lg group-hover:text-primary transition-colors">
                        {event.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        {event.budget && (
                          <div className="flex items-center gap-1">
                            <Euro className="w-4 h-4" />
                            <span>{event.budget}€</span>
                          </div>
                        )}
                        {event.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Data Evento: {new Date(event.date).toLocaleDateString("it-IT", { 
                              day: 'numeric', 
                              month: 'short' 
                            })}</span>
                          </div>
                        )}                      
                        <div className="flex items-center gap-1">
                          <Shuffle className="w-3 h-3" />
                          <span>Sorteggio: {event.draw_date && (new Date(event.draw_date).toLocaleDateString("it-IT", { 
                              day: 'numeric', 
                              month: 'short' 
                            })) || ('--/--')}</span>
                          </div>                  
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Events;
