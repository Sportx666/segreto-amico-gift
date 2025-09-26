import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, User, Heart, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { getOrCreateParticipantId } from '@/lib/participants';

interface Assignment {
  id: string;
  receiver_id: string;
  receiver_name: string;
  receiver_avatar?: string;
  event_id: string;
}

interface UserAssignmentProps {
  eventId: string;
  eventStatus: string;
  onRevealAnimation?: () => void;
}

export function UserAssignment({ eventId, eventStatus, onRevealAnimation }: UserAssignmentProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserAssignment();
  }, [eventId, user]);

  const fetchUserAssignment = async () => {
    if (!user || eventStatus !== 'completed') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user's participant ID
      const participantId = await getOrCreateParticipantId(user.id);

      // Fetch user's assignment (they can only see their own due to RLS)
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, receiver_id, event_id')
        .eq('event_id', eventId)
        .eq('giver_id', participantId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;

      if (assignmentData) {
        // Get receiver details using secure function
        const { data: participantData, error: participantError } = await supabase
          .from('participants')
          .select('profile_id')
          .eq('id', assignmentData.receiver_id)
          .single();

        if (participantError) throw participantError;

        // Use secure function to get only safe profile fields
        const { data: receiverData, error: receiverError } = await supabase
          .rpc('get_event_member_display_info', { 
            member_profile_id: participantData.profile_id 
          });

        if (receiverError) throw receiverError;

        // Handle both single object and array responses
        const profileData = Array.isArray(receiverData) ? receiverData[0] : receiverData;

        setAssignment({
          id: assignmentData.id,
          receiver_id: assignmentData.receiver_id,
          receiver_name: profileData?.display_name || 'Utente Anonimo',
          receiver_avatar: profileData?.avatar_url,
          event_id: assignmentData.event_id,
        });

        // Trigger reveal animation if provided
        onRevealAnimation?.();
      } else {
        setAssignment(null);
      }
    } catch (error) {
      console.error('Error fetching assignment:', error);
      setError('Errore nel caricamento dell\'assegnazione');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="animate-pulse flex items-center gap-3">
            <Gift className="w-6 h-6 text-muted-foreground" />
            <span className="text-muted-foreground">Caricamento assegnazione...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Gift className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button 
            variant="outline" 
            onClick={fetchUserAssignment}
            className="mt-4"
          >
            Riprova
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (eventStatus !== 'completed') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Gift className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Sorteggio non ancora effettuato</h3>
          <p className="text-sm text-muted-foreground">
            L'amministratore deve ancora eseguire il sorteggio per vedere a chi farai il regalo!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Gift className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Nessuna assegnazione trovata</h3>
          <p className="text-sm text-muted-foreground">
            Non è stata trovata alcuna assegnazione per questo evento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          La tua assegnazione
          <Badge variant="secondary" className="ml-auto">
            <Heart className="w-3 h-3 mr-1" />
            Amico Segreto
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-primary/20">
              <AvatarImage src={assignment.receiver_avatar} alt={assignment.receiver_name} />
              <AvatarFallback className="text-xl bg-gradient-primary text-primary-foreground">
                <User className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Gift className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold">
              Farai un regalo a
            </h3>
            <p className="text-2xl font-bold text-primary">
              {assignment.receiver_name}
            </p>
          </div>

          <div className="w-full max-w-sm">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Heart className="w-4 h-4" />
                <span>Il tuo Amico Segreto per questo evento</span>
              </div>
              
              <Button 
                asChild
                className="w-full"
                size="lg"
              >
                <a 
                  href={`/wishlist?for=${assignment.receiver_id}&event=${eventId}`}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Vedi la sua lista desideri
                </a>
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground text-center max-w-md">
            <p>
              Ricorda: mantieni il segreto! Il tuo destinatario non deve sapere che sei tu il suo Amico Segreto.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}