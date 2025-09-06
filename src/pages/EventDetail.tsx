import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Gift, Share2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { EventMembers } from "@/components/EventMembers";
import { EventExclusions } from "@/components/EventExclusions";
import { EventDraw } from "@/components/EventDraw";
import { EventShare } from "@/components/EventShare";

interface Event {
  id: string;
  name: string;
  date: string | null;
  budget: number | null;
  draw_status: string;
  amazon_marketplace: string;
  join_code: string;
  created_at: string;
}

interface EventMember {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
}

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [userRole, setUserRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("partecipanti");

  useEffect(() => {
    if (!user || !id) {
      navigate("/auth");
      return;
    }
    
    fetchEventDetails();
  }, [user, id, navigate]);

  const fetchEventDetails = async () => {
    try {
      // Get participant record
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user!.id)
        .single();

      if (!participant) {
        navigate("/events");
        return;
      }

      // Check if user is member of this event
      const { data: membership } = await supabase
        .from('event_members')
        .select('role')
        .eq('event_id', id)
        .eq('participant_id', participant.id)
        .single();

      if (!membership) {
        toast.error("Non hai accesso a questo evento");
        navigate("/events");
        return;
      }

      setUserRole(membership.role);

      // Fetch event details
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setEvent(eventData);
    } catch (error: unknown) {
      console.error('Error fetching event details:', error);
      toast.error("Errore nel caricamento dell'evento");
      navigate("/events");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Data da definire';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">In attesa</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/events")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna agli eventi
        </Button>
      </div>

      {/* Event Info Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{event.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Calendar className="w-4 h-4" />
                {formatDate(event.date)}
              </CardDescription>
            </div>
            {getStatusBadge(event.draw_status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {event.budget && (
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Budget: €{event.budget}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Codice: {event.join_code}</span>
            </div>
            {userRole === 'admin' && (
              <Badge variant="outline" className="w-fit">
                Amministratore
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="partecipanti">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Partecipanti</span>
          </TabsTrigger>
          <TabsTrigger value="esclusioni">
            <span className="text-lg mr-2">🚫</span>
            <span className="hidden sm:inline">Esclusioni</span>
          </TabsTrigger>
          <TabsTrigger value="sorteggio">
            <Shuffle className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Sorteggio</span>
          </TabsTrigger>
          <TabsTrigger value="condividi">
            <Share2 className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Condividi</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partecipanti" className="mt-6">
          <EventMembers eventId={event.id} userRole={userRole} />
        </TabsContent>

        <TabsContent value="esclusioni" className="mt-6">
          <EventExclusions eventId={event.id} userRole={userRole} />
        </TabsContent>

        <TabsContent value="sorteggio" className="mt-6">
          <EventDraw eventId={event.id} userRole={userRole} event={event} onStatusChange={fetchEventDetails} />
        </TabsContent>

        <TabsContent value="condividi" className="mt-6">
          <EventShare event={event} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
