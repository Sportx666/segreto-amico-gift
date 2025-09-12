/**
 * Refactored EventDetail page with better separation of concerns
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Gift, Share2, Shuffle, Ban, ImageUp, Trash2, MessageCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { EventMembers } from "@/components/EventMembers";
import { EventExclusions } from "@/components/EventExclusions";
import { EventDraw } from "@/components/EventDraw";
import { EventShare } from "@/components/EventShare";
import { YourAssignment } from "@/components/YourAssignment";
import { ChatManager } from "@/components/ChatManager";
import { UserAssignment } from "@/components/UserAssignment";
import { FirstDrawRevealDialog } from "@/components/FirstDrawRevealDialog";
import { useRevealAnimation } from "@/hooks/useRevealAnimation";
import { RevealAnimation } from "@/components/RevealAnimation";
import { formatDate } from "@/utils/format";
import { debugLog, isDebug } from "@/lib/debug";
import { useEvent, useEventRole } from "../hooks/useEvent";
import { ApiService } from "@/services/api";

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

export default function EventDetailPage() {
  const { id } = useParams();
  // Authentication guard - will redirect if not authenticated  
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("partecipanti");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [recipientName, setRecipientName] = useState<string>('');

  // Use new hooks
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: eventRole } = useEventRole(id);

  // Reveal animation hook
  const { shouldShow, isPlaying, startAnimation } = useRevealAnimation({
    eventId: id || '',
    onComplete: () => {
      // Animation completed
    }
  });

  useEffect(() => {
    // Skip redirect logic since useAuthGuard handles authentication
    if (authLoading) return;

    if (!id) {
      navigate("/events");
      return;
    }
  }, [id, authLoading, navigate]);

  // Check for first draw reveal when event draw is completed
  useEffect(() => {
    if (event?.draw_status === 'completed' && user) {
      // Fetch user's assignment to show in reveal dialog
      const fetchAssignment = async () => {
        try {
          const { data: assignment } = await supabase
            .from('assignments')
            .select('receiver_id')
            .eq('event_id', event.id)
            .eq('giver_id', user.id)
            .single();

          if (assignment) {
            // Get the receiver's anonymous name from event_members
            const { data: member } = await supabase
              .from('event_members')
              .select('anonymous_name')
              .eq('event_id', event.id)
              .eq('participant_id', assignment.receiver_id)
              .single();

            setAssignedName(member?.anonymous_name || 'Utente Anonimo');
            setShowFirstReveal(true);
          }
        } catch (error) {
          console.error('Error fetching assignment for reveal:', error);
        }
      };

      fetchAssignment();
    }
  }, [event?.draw_status, event?.id, user]);

  const handleRevealAnimation = (name?: string) => {
    if (name) setRecipientName(name);
    if (shouldShow) {
      startAnimation();
    }
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFirstReveal, setShowFirstReveal] = useState(false);
  const [assignedName, setAssignedName] = useState<string>('');

  const handleDeleteEvent = async () => {
    if (!event) return;
    
    try {
      await ApiService.supabaseQuery(
        'delete_event',
        async () => {
          const result = await supabase
            .from("events")
            .delete()
            .eq("id", event.id);
          return result;
        }
      );

      toast.success("Evento rimosso dalla lista");
      navigate("/events");
    } catch (error) {
      ApiService.handleError(error, 'delete_event', "Errore nella rimozione dell'evento");
    }
    setShowDeleteDialog(false);
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

  // Show loading spinner while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Auth guard will handle redirects, this won't be reached if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (eventLoading) {
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

  const userRole = eventRole?.role || 'member';

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
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      className="hidden sm:flex"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Rimuovi Evento
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
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

        {/* Sticky Tabs */}
        <div className="sticky top-0 z-40 bg-gradient-subtle/80 backdrop-blur-sm pb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className={`grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm shadow-card`}>
              <TabsTrigger value="partecipanti" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Partecipanti</span>
              </TabsTrigger>
              {event.draw_status !== 'completed' && (
                <TabsTrigger value="esclusioni" className="flex items-center gap-2">
                  <Ban className="w-4 h-4" />
                  <span className="hidden sm:inline">Esclusioni</span>
                </TabsTrigger>
              ) || (
                  <TabsTrigger value="assegnazione" className="flex items-center gap-2 animate-pulse bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 transition-all duration-300">
                    <Gift className="w-4 h-4 animate-bounce" />
                    <span className="hidden sm:inline font-semibold">Il tuo abbinamento</span>
                  </TabsTrigger>
                )}
              <TabsTrigger value="sorteggio" className="flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">Sorteggio</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="partecipanti">
            <EventMembers eventId={event.id} userRole={userRole} eventStatus={event.draw_status} />
          </TabsContent>

          {event.draw_status !== 'completed' && (
            <TabsContent value="esclusioni">
              <EventExclusions eventId={event.id} userRole={userRole} />
            </TabsContent>
          )}

          <TabsContent value="sorteggio">
            {userRole === 'admin' ? (
              <EventDraw 
                eventId={event.id} 
                userRole={userRole} 
                event={event} 
                onStatusChange={() => {
                  // Reload the page after draw completion/reset
                  window.location.reload();
                }} 
              />
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

          <TabsContent value="assegnazione">
            <YourAssignment
              eventId={event.id}
              eventStatus={event.draw_status}
            />
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

      {/* First Draw Reveal Dialog */}
      {showFirstReveal && (
        <FirstDrawRevealDialog
          eventId={event.id}
          assignedName={assignedName}
          onClose={() => setShowFirstReveal(false)}
        />
      )}

      {/* Delete Event Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'evento "{event.name}"? 
              Questa azione non può essere annullata e rimuoverà tutti i dati associati inclusi messaggi, assegnazioni e liste dei desideri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina Evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}