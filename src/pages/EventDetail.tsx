import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Gift, Share2, Shuffle, Ban } from "lucide-react";
import { toast } from "sonner";
import { EventMembers } from "@/components/EventMembers";
import { EventExclusions } from "@/components/EventExclusions";
import { EventDraw } from "@/components/EventDraw";
import { EventShare } from "@/components/EventShare";
import { getOrCreateParticipantId } from "@/lib/participants";
import { debugLog, isDebug } from "@/lib/debug";

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
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [userRole, setUserRole] = useState<string>('member');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("partecipanti");
  const [diag, setDiag] = useState<any>({});

  useEffect(() => {
    // Wait for auth to resolve before deciding
    if (loading) return;

    if (!id) {
      navigate("/events");
      return;
    }

    if (!user) {
      navigate("/auth");
      return;
    }
    debugLog("EventDetail.mount", { eventId: id, userId: user.id });
    fetchEventDetails();
  }, [user, id, loading, navigate]);

  const fetchEventDetails = async () => {
    try {
      debugLog("EventDetail.fetch:start", { eventId: id, userId: user!.id });
      // Resolve participant id once
      const participantId = await getOrCreateParticipantId(user!.id);
      debugLog("EventDetail.participantId", { participantId });
      setDiag((d: any) => ({ ...d, userId: user!.id, eventId: id, participantId }));

      // Fetch event details first (to know admin_profile_id)
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();
      debugLog("EventDetail.eventData", { eventData, error });
      if (error) throw error;
      
      setEvent(eventData);
      setDiag((d: any) => ({ ...d, eventLoaded: true }));

      // Now check membership via participant_id
      const { data: membership, error: membershipError } = await supabase
        .from('event_members')
        .select('role')
        .eq('event_id', id)
        .eq('participant_id', participantId)
        .limit(1)
        .maybeSingle();
      debugLog("EventDetail.membership", { membership, membershipError });
      if (membershipError) {
        console.warn('membership lookup error', membershipError);
      }

      if (!membership) {
        // If you're the admin of the event, create admin membership; otherwise member
        const desiredRole = (eventData as any).admin_profile_id === user!.id ? 'admin' : 'member';
        // Load display name for label
        const { data: profileInfo } = await supabase
          .from('profiles')
          .select('display_name, email')
          .eq('id', user!.id)
          .single();
        const display = profileInfo?.display_name || (user!.email?.split('@')[0] ?? 'Partecipante');
        const inserted = await supabase
          .from('event_members')
          .insert({ event_id: id as string, participant_id: participantId, role: desiredRole, status: 'joined', anonymous_name: display })
          .select('role')
          .single();
        debugLog("EventDetail.autoJoin", { joined: inserted.data, joinErr: inserted.error, desiredRole });
        const role = inserted.data?.role ?? desiredRole;
        setUserRole(role);
        setDiag((d: any) => ({ ...d, membershipRole: role, autoJoined: true, joinErr: inserted.error }));
      } else {
        const role = membership.role ?? 'member';
        setUserRole(role);
        setDiag((d: any) => ({ ...d, membershipRole: role, autoJoined: false }));
      }
    } catch (error: unknown) {
      debugLog("EventDetail.fetch:error", { error });
      console.error('Error fetching event details:', error);
      toast.error("Errore nel caricamento dell'evento");
      navigate("/events");
      setDiag((d: any) => ({ ...d, error }));
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
                <span className="text-sm">Budget: �,�{event.budget}</span>
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
      {isDebug() && (
        <Card className="mb-4 p-4">
          <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(diag, null, 2)}</pre>
        </Card>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="partecipanti">
            <Users className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Partecipanti</span>
          </TabsTrigger>
          <TabsTrigger value="esclusioni">
            <Ban className="w-4 h-4 mr-2" />
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
