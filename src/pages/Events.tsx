import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Users, Euro } from "lucide-react";
import { toast } from "sonner";

interface Event {
  id: string;
  name: string;
  budget: number | null;
  date: string | null;
  draw_status: string;
  join_code: string | null;
  created_at: string;
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      toast.error("Errore nel caricamento eventi", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle p-4">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">I Miei Eventi</h1>
          <Link to="/events/new">
            <Button className="bg-gradient-primary hover:bg-primary-light shadow-card hover:shadow-elegant transition-all duration-300">
              <Plus className="w-4 h-4 mr-2" />
              Crea Evento
            </Button>
          </Link>
        </div>

        {events.length === 0 ? (
          <Card className="text-center py-12 shadow-card border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Nessun evento ancora</h3>
                <p className="text-muted-foreground mb-4">
                  Crea il tuo primo scambio di regali per iniziare!
                </p>
                <Link to="/events/new">
                  <Button className="bg-gradient-primary hover:bg-primary-light">
                    <Plus className="w-4 h-4 mr-2" />
                    Crea il Primo Evento
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`}>
                <Card className="hover:shadow-elegant transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{event.name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        event.draw_status === 'pending' ? 'bg-accent text-accent-foreground' :
                        event.draw_status === 'drawn' ? 'bg-primary/10 text-primary' :
                        'bg-secondary/10 text-secondary'
                      }`}>
                        {event.draw_status === 'pending' ? 'In Attesa' : 
                         event.draw_status === 'drawn' ? 'Sorteggiato' : 'Concluso'}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {event.budget && (
                        <div className="flex items-center gap-1">
                          <Euro className="w-4 h-4" />
                          <span>{event.budget}€</span>
                        </div>
                      )}
                      {event.date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(event.date).toLocaleDateString("it-IT")}</span>
                        </div>
                      )}
                      {event.join_code && (
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>#{event.join_code}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Events;