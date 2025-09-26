import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, ExternalLink, Calendar, ShoppingCart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateParticipantId } from "@/lib/participants";

interface YourAssignmentProps {
  eventId: string;
  eventStatus: string;
  onStartChat?: (recipientId: string, recipientName: string) => void;
}

interface Assignment {
  receiver_id: string;
  receiver_name: string;
}

interface WishlistItem {
  id: string;
  title: string;
  affiliate_url?: string;
  raw_url?: string;
  image_url?: string;
  price_snapshot?: string;
  priority?: number;
  notes?: string;
  is_purchased: boolean;
}

export const YourAssignment = ({ eventId, eventStatus, onStartChat }: YourAssignmentProps) => {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && eventStatus === 'completed') {
      fetchAssignment();
    } else {
      setIsLoading(false);
    }
  }, [eventId, eventStatus, user]);

  const fetchAssignment = async () => {
    try {
      if (!user) return;

      // Get current user's participant ID
      const participantId = await getOrCreateParticipantId(user.id);

      // Fetch assignment where current user is the giver
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('assignments')
        .select(`
          receiver_id,
          participants!assignments_receiver_id_fkey(
            id,
            profile_id
          )
        `)
        .eq('event_id', eventId)
        .eq('giver_id', participantId)
        .single();

      if (assignmentError || !assignmentData) {
        console.error('Error fetching assignment:', assignmentError);
        return;
      }

      // Get receiver's display info using secure function
      let receiverName = 'Il tuo destinatario';
      if (assignmentData.participants?.profile_id) {
        const { data: profileData } = await supabase
          .rpc('get_event_member_display_info', { 
            member_profile_id: assignmentData.participants.profile_id 
          });
        
        // Handle both single object and array responses
        const profile = Array.isArray(profileData) ? profileData[0] : profileData;
        if (profile?.display_name) {
          receiverName = profile.display_name;
        }
      }

      // If no profile, check event_members for anonymous name
      if (receiverName === 'Il tuo destinatario') {
        const { data: memberData } = await supabase
          .from('event_members')
          .select('anonymous_name')
          .eq('event_id', eventId)
          .eq('participant_id', assignmentData.receiver_id)
          .single();
        
        if (memberData?.anonymous_name) {
          receiverName = memberData.anonymous_name;
        }
      }

      setAssignment({
        receiver_id: assignmentData.receiver_id,
        receiver_name: receiverName
      });

      // Fetch wishlist items for the receiver
      const { data: wishlistData, error: wishlistError } = await supabase
        .from('wishlist_items')
        .select('id, title, affiliate_url, raw_url, image_url, price_snapshot, priority, notes, is_purchased')
        .eq('event_id', eventId)
        .eq('owner_id', assignmentData.receiver_id)
        .order('priority', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (wishlistError) {
        console.error('Error fetching wishlist:', wishlistError);
      } else {
        setWishlistItems(wishlistData || []);
      }

    } catch (error) {
      console.error('Error in fetchAssignment:', error);
      toast.error("Errore nel caricamento dell'assegnazione");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (eventStatus !== 'completed') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Il sorteggio non è ancora stato effettuato</h3>
          <p className="text-muted-foreground">
            L'amministratore dell'evento deve ancora effettuare il sorteggio dei partecipanti.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Nessuna assegnazione trovata</h3>
          <p className="text-muted-foreground">
            Non è stata trovata un'assegnazione per te in questo evento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Assignment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Il tuo abbinamento
          </CardTitle>
          <CardDescription>
            Ecco a chi dovrai fare un regalo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-6 bg-gradient-primary/10 rounded-lg">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">{assignment.receiver_name}</h3>
              <Badge variant="secondary">Il tuo destinatario</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wishlist */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Lista dei desideri
          </CardTitle>
          <CardDescription>
            Ecco cosa desidera {assignment.receiver_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wishlistItems.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Nessun desiderio ancora</h3>
              <p className="text-muted-foreground mb-4">
                {assignment.receiver_name} non ha ancora aggiunto nulla alla sua lista dei desideri.
              </p>
              <Button
                onClick={() => onStartChat?.(assignment.receiver_id, assignment.receiver_name)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Scrivigli un messaggio!
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {wishlistItems.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 ${item.is_purchased ? 'opacity-60' : ''}`}
                >
                  <div className="flex gap-4">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          {item.price_snapshot && (
                            <p className="text-sm text-muted-foreground">
                              {item.price_snapshot}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {item.priority && (
                            <Badge variant="outline" className="text-xs">
                              Priorità {item.priority}
                            </Badge>
                          )}
                          {item.is_purchased && (
                            <Badge variant="secondary">Acquistato</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        {item.affiliate_url && (
                          <Button size="sm" asChild>
                            <a
                              href={item.affiliate_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Acquista
                            </a>
                          </Button>
                        )}
                        {!item.affiliate_url && item.raw_url && (
                          <Button size="sm" variant="outline" asChild>
                            <a
                              href={item.raw_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Vedi prodotto
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};