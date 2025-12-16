/**
 * Refactored EventDetail page with better separation of concerns
 */
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, Gift, Share2, Shuffle, Ban, ImageUp, Trash2, MessageCircle, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { uploadImage, resizeToWebP } from "@/lib/upload";
import { EventMembers } from "@/components/EventMembers";
import { EventExclusions } from "@/components/EventExclusions";
import { EventDraw } from "@/components/EventDraw";
import { EventShare } from "@/components/EventShare";
import { YourAssignment } from "@/components/YourAssignment";
import { ChatManager, ChatManagerHandle } from "@/components/ChatManager";
import { UserAssignment } from "@/components/UserAssignment";
import { FirstDrawRevealDialog } from "@/components/FirstDrawRevealDialog";
import { useRevealAnimation } from "@/hooks/useRevealAnimation";
import { RevealAnimation } from "@/components/RevealAnimation";
import { formatDate } from "@/utils/format";
import { debugLog, isDebug } from "@/lib/debug";
import { useEvent, useEventRole } from "../hooks/useEvent";
import { ApiService } from "@/services/api";
import { useNickname } from "@/hooks/useNickname";
import { useJoinedParticipantCount } from '@/hooks/useJoinedParticipantCount';
import { useI18n } from "@/i18n";

export default function EventDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  // Authentication guard - will redirect if not authenticated
  const { user, loading: authLoading, isAuthenticated } = useAuthGuard();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("partecipanti");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [recipientName, setRecipientName] = useState<string>('');

  // Use new hooks
  const { data: event, isLoading: eventLoading } = useEvent(id);
  const { data: eventRole } = useEventRole(id);
  const { nickname } = useNickname(event?.id);
  const { count: joinedCount, loading: countLoading } = useJoinedParticipantCount(id);

  
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
          // Get participant ID first
          const { data: participant } = await supabase
            .from('participants')
            .select('id')
            .eq('profile_id', user.id)
            .single();

          if (!participant) return;

          // Check if first_reveal_pending is true for this user's assignment
          const { data: assignment } = await supabase
            .from('assignments')
            .select('receiver_id, first_reveal_pending')
            .eq('event_id', event.id)
            .eq('giver_id', participant.id)
            .single();

          if (assignment && assignment.first_reveal_pending) {
            // Get the receiver's anonymous name from event_members
            const { data: member } = await supabase
              .from('event_members')
              .select('anonymous_name')
              .eq('event_id', event.id)
              .eq('participant_id', assignment.receiver_id)
              .single();

            setAssignedName(member?.anonymous_name || t('chat.anonymous_user'));
            setShowFirstReveal(true);
          }
        } catch (error) {
          console.error('Error fetching assignment for reveal:', error);
        }
      };

      fetchAssignment();
    }
  }, [event?.draw_status, event?.id, user, t]);

  const handleRevealAnimation = (name?: string) => {
    if (name) setRecipientName(name);
    if (shouldShow) {
      startAnimation();
    }
  };

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFirstReveal, setShowFirstReveal] = useState(false);
  const [assignedName, setAssignedName] = useState<string>('');
  const [openChat, setOpenChat] = useState<{ recipientId: string; recipientName?: string } | null>(null);
  const chatManagerRef = useRef<ChatManagerHandle>(null);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('tab', value);

      if (value !== 'chat') {
        params.delete('dm');
      }

      return params;
    });
  };

  const handleStartChat = (recipientId: string, recipientName: string) => {
    setOpenChat({ recipientId, recipientName });
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('tab', 'chat');
      params.set('dm', recipientId);
      return params;
    });
    setActiveTab('chat');
  };

  const handleOpenChatConsumed = () => {
    setOpenChat(null);
  };

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const dmParam = searchParams.get('dm');
    const validTabs = ['partecipanti', 'esclusioni', 'sorteggio', 'chat', 'assegnazione'];

    if (dmParam) {
      if (activeTab !== 'chat') {
        setActiveTab('chat');
      }

      setOpenChat((current) =>
        current?.recipientId === dmParam ? current : { recipientId: dmParam }
      );
      return;
    }

    if (openChat) {
      setOpenChat(null);
    }

    const nextTab = tabParam && validTabs.includes(tabParam) ? tabParam : 'partecipanti';

    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [searchParams, activeTab, openChat]);

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

      toast.success(t('toasts.event_removed'));
      navigate("/events");
    } catch (error) {
      ApiService.handleError(error, 'delete_event', t('toasts.event_remove_error'));
    }
    setShowDeleteDialog(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">{t('events.status_pending')}</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">{t('events.status_completed')}</Badge>;
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
      {/* Back Button Bar - Between Navbar and Content */}
      <div className="container max-w-6xl py-2 md:py-3">
        <Button
          variant="ghost"
          onClick={() => navigate("/events")}
          className="text-muted-foreground hover:text-foreground focus-ring"
          aria-label={t('buttons.back_to_events')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('buttons.back_to_events')}
        </Button>
      </div>

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

        {/* Admin Controls - Top Right in Hero */}
        {userRole === 'admin' && (
          <div className="absolute top-3 right-3 md:top-4 md:right-4 flex items-center gap-2">
            {event.draw_status !== 'completed' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/events/${event.id}/edit`)}
                className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-foreground"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="container max-w-6xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h1 className="text-xl md:text-4xl font-bold text-white">
                  {event.name}
                </h1>
                <div className="flex flex-col gap-1 text-white/90">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm md:text-base">
                      {formatDate(event.date)}
                    </span>
                  </div>
                  {event.draw_date && (
                    <div className="flex items-center gap-2">
                      <Shuffle className="w-4 h-4" />
                      <span className="text-xs md:text-sm opacity-80">
                        {t('events.draw_date')}: {formatDate(event.draw_date)}
                      </span>
                    </div>
                  )}
                  {/* Budget - shown in overlay on mobile */}
                  {event.budget && (
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      <span className="text-xs md:text-sm opacity-80">
                        Budget: €{event.budget}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(event.draw_status)}
                {/* {userRole === 'admin' && (
                  <Badge variant="outline" className="bg-white/10 border-white/20 text-white text-xs">
                    Admin
                  </Badge>
                )} */}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-6">
        <main id="main-content" className="focus:outline-none" tabIndex={-1}>
        {/* Sticky Tabs */}
        <nav 
          className="sticky top-0 z-40 bg-gradient-subtle/80 backdrop-blur-sm pb-6"
          role="navigation"
          aria-label={t('event_detail.participants_tab')}
        >
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className={`grid w-full ${event.draw_status === 'completed' ? 'grid-cols-4' : (userRole === 'admin' ? 'grid-cols-4' : 'grid-cols-3')} bg-white/80 backdrop-blur-sm shadow-card`}>
              <TabsTrigger value="partecipanti" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">{t('event_detail.participants_tab')}</span>
              </TabsTrigger>
              {event.draw_status !== 'completed' && userRole === 'admin' && (
                <TabsTrigger value="esclusioni" className="flex items-center gap-2">
                  <Ban className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('event_detail.exclusions_tab')}</span>
                </TabsTrigger>
              )}
              {event.draw_status === 'completed' && (
                <TabsTrigger value="assegnazione" className="flex items-center gap-2 bg-yellow-500/40 hover:bg-yellow-500/80 transition-all duration-300 data-[state=active]:text-red-500">
                  <Gift className="w-4 h-4 animate-bounce" />
                  <span className="hidden sm:inline font-semibold">{t('event_detail.assignment_tab')}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="sorteggio" className="flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('event_detail.draw_tab')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                disabled={joinedCount < 2}
                className={`flex items-center gap-2 ${joinedCount < 2 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {t('event_detail.chat_tab')} {joinedCount < 2 && `(${joinedCount}/2)`}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>

        {/* Tab Content */}
        <div role="tabpanel" aria-live="polite">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsContent value="partecipanti">
            <EventMembers 
              eventId={event.id} 
              userRole={userRole} 
              eventStatus={event.draw_status}
              joinCode={event.join_code}
              eventName={event.name}
            />
          </TabsContent>

          {event.draw_status !== 'completed' && userRole === 'admin' && (
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
                drawDate={event.draw_date}
                onRevealAnimation={() => handleRevealAnimation()}
              />
            )}
          </TabsContent>

          <TabsContent value="chat">
            {joinedCount >= 2 ? (
              <ChatManager
                ref={chatManagerRef}
                eventId={event.id}
                eventStatus={event.draw_status}
                openChat={openChat}
                onOpenChatConsumed={handleOpenChatConsumed}
              />
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="text-muted-foreground">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <h3 className="font-medium text-lg mb-2">{t('chat.unavailable')}</h3>
                  <p>{t('chat.min_participants')}</p>
                  <p className="text-sm mt-2">
                    {t('members.active_participants')}: <span className="font-medium">{joinedCount}/2</span>
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assegnazione">
            <YourAssignment
              eventId={event.id}
              eventStatus={event.draw_status}
              onStartChat={handleStartChat}
            />
          </TabsContent>
          </Tabs>
        </div>
        </main>
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
            <AlertDialogTitle>{t('event_detail.delete_confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('event_detail.delete_warning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('event_detail.delete_event')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
