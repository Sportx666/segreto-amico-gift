import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gift, Users, Calendar, Euro } from "lucide-react";
import { toast } from "sonner";

interface EventInfo {
  id: string;
  name: string;
  budget: number | null;
  date: string | null;
}

const EventJoin = () => {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      validateTokenAndLoadEvent();
    }
  }, [token]);

  const validateTokenAndLoadEvent = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      // Check if token is valid and get event info
      const { data: joinToken, error: tokenError } = await supabase
        .from("join_tokens")
        .select(`
          event_id,
          expires_at,
          used_at,
          events (
            id,
            name,
            budget,
            date
          )
        `)
        .eq("token", token)
        .single();

      if (tokenError || !joinToken) {
        toast.error("Link non valido o scaduto");
        navigate("/");
        return;
      }

      if (joinToken.used_at) {
        toast.error("Questo link è già stato utilizzato");
        navigate("/");
        return;
      }

      if (new Date(joinToken.expires_at) < new Date()) {
        toast.error("Questo link è scaduto");
        navigate("/");
        return;
      }

      // Store token in localStorage for later use
      localStorage.setItem("joinToken", token);
      setEvent(joinToken.events as EventInfo);

    } catch (error: unknown) {
      console.error("Error validating token:", error);
      toast.error("Errore nel verificare il link");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !event) return;

    setJoining(true);
    try {
      // Create anonymous participant
      const { data: participant, error: participantError } = await supabase
        .from("participants")
        .insert({
          profile_id: null // Anonymous participant
        })
        .select()
        .single();

      if (participantError) throw participantError;

      // Add as event member with token info
      const { error: memberError } = await supabase
        .from("event_members")
        .insert({
          event_id: event.id,
          participant_id: participant.id,
          role: "member",
          status: "joined",
          join_token: token,
          anonymous_name: name.trim(),
          anonymous_email: email.trim() || null
        });

      if (memberError) throw memberError;

      // Mark token as used
      const { error: tokenError } = await supabase
        .from("join_tokens")
        .update({ 
          used_at: new Date().toISOString(),
          participant_id: participant.id
        })
        .eq("token", token);

      if (tokenError) throw tokenError;

      // Store participant info in localStorage
      localStorage.setItem("participantInfo", JSON.stringify({
        participantId: participant.id,
        eventId: event.id,
        name,
        email: email || null
      }));

      toast.success(`Benvenuto/a ${name}! 🎉`);
      navigate(`/events/${event.id}/member/${participant.id}`);
      
    } catch (error: unknown) {
      console.error("Error joining event:", error);
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore nell'unirsi all'evento", {
        description
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p>Verifica del link in corso...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Link non trovato</h2>
            <p className="text-muted-foreground">Questo link non è valido o è scaduto.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {event.name}
              </CardTitle>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-3">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Il tuo nome</Label>
                <Input
                  id="name"
                  placeholder="Come ti chiami?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email (opzionale)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="la.tua@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  L'email è opzionale ma utile per ricevere aggiornamenti
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:bg-primary-light transition-all duration-300 hover:shadow-glow"
                disabled={joining}
              >
                {joining ? (
                  "Unisciti..."
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Unisciti all'Evento
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EventJoin;
