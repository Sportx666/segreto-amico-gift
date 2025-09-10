import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft, Calendar, Users, Gift, Share2, Shuffle, Ban, ImageUp, Trash2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { EventMembers } from "@/components/EventMembers";
import { EventExclusions } from "@/components/EventExclusions";
import { EventDraw } from "@/components/EventDraw";
import { EventShare } from "@/components/EventShare";
import { ChatManager } from "@/components/ChatManager";
import { getOrCreateParticipantId } from "@/lib/participants";
import { debugLog, isDebug } from "@/lib/debug";
import { UserAssignment } from "@/components/UserAssignment";
import { useRevealAnimation } from "@/hooks/useRevealAnimation";
import { RevealAnimation } from "@/components/RevealAnimation";

interface Event {
  id: string;
  name: string;
  date: string | null;
  budget: number | null;
  draw_status: string;
  amazon_marketplace: string;
  join_code: string;
  created_at: string;
  cover_image_url?: string | null;
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);
  const [recipientName, setRecipientName] = useState<string>('');

  // Reveal animation hook
  const { shouldShow, isPlaying, startAnimation } = useRevealAnimation({
    eventId: id || '',
    onComplete: () => {
      // Animation completed
    }
  });

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

  const handleRevealAnimation = (name?: string) => {
    if (name) setRecipientName(name);
    if (shouldShow) {
      startAnimation();
    }
  };

  const handleDeleteItem = async (eventId: string) => {
      try {
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId);
  
        if (error) throw error;
  
        toast.success("Evento rimosso dalla lista");
        navigate("/events");
      } catch (error: unknown) {
        console.error("Error deleting item:", error);
        toast.error("Errore nella rimozione dell'evento");
      }
    };

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
          .insert({ event_id: id as string, participant_id: participantId, role: desiredRole, status: 'invited', anonymous_name: display })
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
      <div className="min-h-screen bg-gradient-subtle py-6">
        <div className="container max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="aspect-16-9 bg-muted rounded-xl"></div>
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded-xl"></div>
            <div className="h-96 bg-muted rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Hero Section with Cover Image */}
      <div className="relative">
        <div className="aspect-16-9 md:aspect-[3/1] lg:aspect-[4/1] overflow-hidden bg-gradient-primary">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-hero flex items-center justify-center">
              <Calendar className="w-16 h-16 md:w-24 md:h-24 text-white/80" />
            </div>
          )}
          {/* Overlay gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
        </div>
        
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="container max-w-6xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-4xl font-bold text-white">
                  {event.name}
                </h1>
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm md:text-base">
                    {formatDate(event.date)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(event.draw_status)}
                {userRole === 'admin' && (
                  <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                    Amministratore
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate("/events")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna agli eventi
        </Button>

        {/* Event Info Card */}
        <Card className="mb-6 shadow-card border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                {event.budget && (
                  <div className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">Budget: €{event.budget}</span>
                  </div>
                )}
              </div>
              
              {/* Admin Controls */}
              <div className="flex items-center gap-2">
                {userRole === 'admin' && (
                  <>
                    <input
                      id="cover-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !event) return;
                        setUploadingCover(true);
                        try {
                          const resized = await resizeToWebP(file, { max: 1600, quality: 0.8 });
                          const url = await uploadImage({
                            bucket: "event-images",
                            path: `${event.id}/cover.webp`,
                            file: resized,
                          });
                          const { data, error } = await supabase
                            .from('events')
                            .update({ cover_image_url: url })
                            .eq('id', event.id)
                            .select()
                            .single();
                          if (error) throw error;
                          setEvent(data);
                          toast.success("Immagine evento aggiornata");
                        } catch (err) {
                          console.error(err);
                          toast.error("Errore durante l'upload dell'immagine");
                        } finally {
                          setUploadingCover(false);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById('cover-input')?.click()}
                      disabled={uploadingCover}
                      className="hidden sm:flex"
                    >
                      <ImageUp className="w-4 h-4 mr-2" />
                      {uploadingCover ? 'Carico...' : 'Cambia immagine'}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => await handleDeleteItem(event.id)}
                      className="hidden sm:flex"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Rimuovi Evento
                    </Button>
                    
                    {/* Mobile buttons */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => document.getElementById('cover-input')?.click()}
                      disabled={uploadingCover}
                      className="sm:hidden"
                    >
                      <ImageUp className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => await handleDeleteItem(event.id)}
                      className="sm:hidden"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        {isDebug() && (
          <Card className="mb-6 p-4">
            <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(diag, null, 2)}</pre>
          </Card>
        )}

        {/* Sticky Tabs */}
        <div className="sticky top-0 z-40 bg-gradient-subtle/80 backdrop-blur-sm pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-white/80 backdrop-blur-sm shadow-card">
              <TabsTrigger value="partecipanti" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Partecipanti</span>
              </TabsTrigger>
              <TabsTrigger value="esclusioni" className="flex items-center gap-2">
                <Ban className="w-4 h-4" />
                <span className="hidden sm:inline">Esclusioni</span>
              </TabsTrigger>
              <TabsTrigger value="sorteggio" className="flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">Sorteggio</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
              <TabsTrigger value="condividi" className="flex items-center gap-2">
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Condividi</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="partecipanti">
            <EventMembers eventId={event.id} userRole={userRole} eventStatus={event.draw_status} />
          </TabsContent>

          <TabsContent value="esclusioni">
            <EventExclusions eventId={event.id} userRole={userRole} />
          </TabsContent>

          <TabsContent value="sorteggio">
            {userRole === 'admin' ? (
              <EventDraw eventId={event.id} userRole={userRole} event={event} onStatusChange={fetchEventDetails} />
            ) : (
              <UserAssignment 
                eventId={event.id} 
                eventStatus={event.draw_status}
                onRevealAnimation={() => handleRevealAnimation()}
              />
            )}
          </TabsContent>

          <TabsContent value="chat">
            <ChatManager eventId={event.id} eventStatus={event.draw_status} />
          </TabsContent>

          <TabsContent value="condividi">
            <EventShare event={event} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Reveal Animation Overlay */}
      <RevealAnimation 
        isVisible={isPlaying}
        recipientName={recipientName}
        onComplete={() => {
          // Animation completed, component will handle cleanup
        }}
      />
    </div>
  );
}
