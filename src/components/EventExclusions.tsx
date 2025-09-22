import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useEventParticipants } from "@/hooks/useEventParticipants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X, UserX } from "lucide-react";
import { toast } from "sonner";

interface EventExclusionsProps {
  eventId: string;
  userRole: string;
}

interface Member {
  id: string;
  role: string;
  anonymous_name: string | null;
  participant_id: string;
}

interface Exclusion {
  id: string;
  giver_id: string;
  blocked_id: string;
  reason: string | null;
  active: boolean;
}

export const EventExclusions = ({ eventId, userRole }: EventExclusionsProps) => {
  const { user } = useAuth();
  const { participants, loading: participantsLoading } = useEventParticipants(eventId);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [currentParticipantId, setCurrentParticipantId] = useState<string>("");
  
  const isLoading = participantsLoading;

  useEffect(() => {
    fetchData();
  }, [eventId, user]);

  const fetchData = async () => {
    try {
      // Get current user's participant ID
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user!.id)
        .single();

      if (participant) {
        setCurrentParticipantId(participant.id);
      }

      // Fetch exclusions
      const { data: exclusionsData, error: exclusionsError } = await supabase
        .from('exclusions')
        .select('*')
        .eq('event_id', eventId)
        .eq('active', true);

      if (exclusionsError) throw exclusionsError;
      setExclusions(exclusionsData || []);
    } catch (error: unknown) {
      console.error('Error fetching exclusions data:', error);
      toast.error("Errore nel caricamento delle esclusioni");
    }
  };

  const toggleExclusion = async (giverId: string, blockedId: string) => {
    try {
      // Check if exclusion already exists
      const existingExclusion = exclusions.find(
        ex => ex.giver_id === giverId && ex.blocked_id === blockedId
      );

      if (existingExclusion) {
        // Remove exclusion
        const { error } = await supabase
          .from('exclusions')
          .update({ active: false })
          .eq('id', existingExclusion.id);

        if (error) throw error;
        toast.success("Esclusione rimossa");
      } else {
        // Add exclusion
        const { error } = await supabase
          .from('exclusions')
          .insert({
            event_id: eventId,
            giver_id: giverId,
            blocked_id: blockedId,
            reason: "Esclusione manuale",
            active: true
          });

        if (error) throw error;
        toast.success("Esclusione aggiunta");
      }

      await fetchData();
    } catch (error: unknown) {
      console.error('Error toggling exclusion:', error);
      toast.error("Errore nel modificare l'esclusione");
    }
  };

  const getMemberName = (member: Member) => {
    return member.anonymous_name || `Utente ${member.participant_id?.slice(0, 8)}`;
  };

  const isExcluded = (giverId: string, blockedId: string) => {
    return exclusions.some(
      ex => ex.giver_id === giverId && ex.blocked_id === blockedId && ex.active
    );
  };

  const canEditExclusions = (memberId: string) => {
    return userRole === 'admin' || memberId === currentParticipantId;
  };

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            Matrice Esclusioni
          </CardTitle>
          <CardDescription>
            Configura chi non può regalare a chi. Ogni persona può impostare le proprie esclusioni
            {userRole === 'admin' && ' e l\'amministratore può modificare tutto'}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Exclusions Matrix */}
      {participants.length >= 2 ? (
        <Card>
          <CardContent className="p-6">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-background">
              {/* Mobile scroll hint */}
              <div className="sm:hidden text-xs text-muted-foreground mb-2 flex items-center gap-1">
                ← Scorri per vedere tutti i partecipanti →
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 sm:p-3 font-medium sticky left-0 bg-background z-10 border-r">Regala a →</th>
                    {participants.map((member) => (
                      <th key={member.id} className="p-2 sm:p-3 text-center min-w-[100px] sm:min-w-[120px]">
                        <div className="text-xs sm:text-sm font-medium truncate">
                          {getMemberName(member)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {participants.map((giver) => (
                    <tr key={giver.id} className="border-t">
                      <td className="p-2 sm:p-3 font-medium sticky left-0 bg-background z-10 border-r">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <span className="text-xs sm:text-sm truncate">{getMemberName(giver)}</span>
                          {giver.role === 'admin' && (
                            <Badge variant="secondary" className="text-xs hidden sm:inline-flex">Admin</Badge>
                          )}
                        </div>
                      </td>
                      {participants.map((receiver) => (
                        <td key={receiver.id} className="p-2 sm:p-3 text-center">
                          {giver.id === receiver.id ? (
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-muted rounded flex items-center justify-center mx-auto">
                              <X className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                            </div>
                          ) : (
                            <Checkbox
                              checked={isExcluded(giver.participant_id || giver.id, receiver.participant_id || receiver.id)}
                              onCheckedChange={() => 
                                toggleExclusion(giver.participant_id || giver.id, receiver.participant_id || receiver.id)
                              }
                              disabled={!canEditExclusions(giver.participant_id || giver.id)}
                              className="mx-auto min-w-[20px] min-h-[20px] sm:min-w-[24px] sm:min-h-[24px] touch-manipulation"
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p>✓ = Non può regalare a questa persona</p>
              <p>Le celle grigie rappresentano se stessi (non possono regalare a se stessi)</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Servono almeno 2 partecipanti</h3>
            <p className="text-sm text-muted-foreground">
              Aggiungi più partecipanti per configurare le esclusioni
            </p>
          </CardContent>
        </Card>
      )}

      {/* Active Exclusions Summary */}
      {exclusions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Esclusioni Attive</CardTitle>
            <CardDescription>
              Riepilogo delle esclusioni configurate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {exclusions.map((exclusion) => {
                const giver = participants.find(m => (m.participant_id || m.id) === exclusion.giver_id);
                const blocked = participants.find(m => (m.participant_id || m.id) === exclusion.blocked_id);
                
                if (!giver || !blocked) return null;

                return (
                  <div key={exclusion.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">
                      <strong>{getMemberName(giver)}</strong> non può regalare a <strong>{getMemberName(blocked)}</strong>
                    </span>
                    {canEditExclusions(exclusion.giver_id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExclusion(exclusion.giver_id, exclusion.blocked_id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
