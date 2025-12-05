import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useEventMembers } from "@/hooks/useEventMembers";
import { useJoinedParticipantCount } from "@/hooks/useJoinedParticipantCount";
import { toast } from "sonner";
import { debugLog, isDebug } from "@/lib/debug";
import { getOrCreateParticipantId } from "@/lib/participants";
import { MemberCard } from "./members/MemberCard";
import { AddMemberDialog } from "./members/AddMemberDialog";
import { DebugPanel } from "./members/DebugPanel";

interface EventMembersProps {
  eventId: string;
  userRole: string;
  eventStatus?: string; // draw_status from event (e.g., 'pending', 'completed')
}

interface DebugData {
  [key: string]: unknown;
}

export const EventMembers = ({ eventId, userRole, eventStatus }: EventMembersProps) => {
  const { user } = useAuth();
  const { members, loading: isLoading } = useEventMembers(eventId);
  const { count: joinedCount } = useJoinedParticipantCount(eventId);
  const [diag, setDiag] = useState<DebugData>({});
  const [currentUserParticipantId, setCurrentUserParticipantId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user's participant ID
    const getCurrentUserParticipant = async () => {
      if (user) {
        try {
          const { data: participant } = await supabase
            .from('participants')
            .select('id')
            .eq('profile_id', user.id)
            .single();

          if (participant) {
            setCurrentUserParticipantId(participant.id);
          }
        } catch (error) {
          console.error('Error fetching user participant:', error);
        }
      }
    };

    getCurrentUserParticipant();
  }, [user]);

  const fetchMembers = async () => {
    // This function is kept for backward compatibility with existing functionality
    // but is no longer needed since we use the useEventMembers hook
    // However, some debug and fallback logic still references it
    try {
      debugLog("EventMembers.fetch:start", { eventId, userId: user?.id });
      // Ensure the viewer has a participant id (RLS-friendly path)
      if (user) {
        try {
          const pid = await getOrCreateParticipantId(user.id);
          debugLog("EventMembers.viewerParticipantId", { participantId: pid });
          setDiag((d) => ({ ...d, viewerParticipantId: pid }));
        } catch (e) {
          debugLog("EventMembers.viewerParticipantId:error", { error: e });
          setDiag((d) => ({ ...d, viewerParticipantIdError: String(e) }));
        }
      }

      setDiag((d) => ({ ...d, membersCount: members?.length ?? 0 }));

      // If blocked or empty, try to at least show current user's membership
      if (user && members.length === 0) {
        const pid = await getOrCreateParticipantId(user.id);
        const { data: selfRow } = await supabase
          .from('event_members')
          .select('id, role, anonymous_name, anonymous_email, status, participant_id')
          .eq('event_id', eventId)
          .eq('participant_id', pid)
          .maybeSingle();
        debugLog("EventMembers.selfRow", { selfRow });
        if (selfRow) {
          setDiag((d) => ({ ...d, fallbackSelfRow: true }));
        }
      }
    } catch (error: unknown) {
      console.error('Error in fetchMembers:', error);
    }
  };

  const handleMemberAdded = () => {
    // The hook will automatically refresh via real-time subscriptions
  };

  const removeMember = async (memberId: string) => {
    // Guard: allow deletion only for admins when draw is pending
    if (!(userRole === 'admin' && eventStatus === 'pending')) {
      toast.error("Non puoi rimuovere partecipanti dopo il sorteggio");
      return;
    }
    try {
      const { error } = await supabase
        .from('event_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Members will auto-update via the useEventMembers hook
      toast.success("Partecipante rimosso");
    } catch (error: unknown) {
      console.error('Error removing member:', error);
      toast.error("Errore nella rimozione del partecipante");
    }
  };

  const removeUnjoinedMember = async (participantId: string) => {
    if (userRole !== 'admin') {
      toast.error("Solo gli amministratori possono rimuovere partecipanti");
      return;
    }

    try {
      const { data, error } = await supabase.rpc('remove_unjoined_participant', {
        _event_id: eventId,
        _participant_id: participantId
      });

      if (error) throw error;

      // Members will auto-update via the useEventMembers hook
      toast.success("Invito rimosso");
      debugLog('EventMembers', `Removal result: ${JSON.stringify(data)}`);
    } catch (error: unknown) {
      console.error('Error removing unjoined member:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cannot remove joined participant')) {
        toast.error("Non puoi rimuovere un partecipante che ha già accettato l'invito");
      } else {
        toast.error("Errore nella rimozione dell'invito");
      }
    }
  };

  const transferAdmin = async (newAdminParticipantId: string) => {
    try {
      const { data, error } = await supabase.rpc('transfer_event_admin', {
        _event_id: eventId,
        _new_admin_participant_id: newAdminParticipantId
      });

      if (error) throw error;

      toast.success("Ruolo admin trasferito con successo!");
      debugLog('EventMembers.transferAdmin', { result: data });
      
      // Reload to refresh user role and UI
      window.location.reload();
    } catch (error: unknown) {
      console.error('Error transferring admin:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`Errore nel trasferimento: ${errorMessage}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-card rounded-lg p-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDebug() && (
        <DebugPanel 
          eventId={eventId} 
          diag={diag} 
          setDiag={setDiag}
          newMemberName=""
          newMemberEmail=""
        />
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Membri</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} membri totali • {joinedCount} partecipanti attivi
          </p>
        </div>

        {userRole === 'admin' && (
          <AddMemberDialog eventId={eventId} onMemberAdded={handleMemberAdded} />
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            eventId={eventId}
            userRole={userRole}
            eventStatus={eventStatus || 'pending'}
            currentUserParticipantId={currentUserParticipantId}
            onRemoveMember={removeMember}
            onRemoveUnjoinedMember={removeUnjoinedMember}
            onTransferAdmin={transferAdmin}
          />
        ))}
      </div>
    </div>
  );
};
