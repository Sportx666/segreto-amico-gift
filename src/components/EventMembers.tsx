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
import { EventShareLink } from "./EventShareLink";
import { useI18n } from "@/i18n";

interface EventMembersProps {
  eventId: string;
  userRole: string;
  eventStatus?: string;
  joinCode?: string | null;
  eventName?: string;
}

interface DebugData {
  [key: string]: unknown;
}

export const EventMembers = ({ eventId, userRole, eventStatus, joinCode, eventName }: EventMembersProps) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { members, loading: isLoading } = useEventMembers(eventId);
  const { count: joinedCount } = useJoinedParticipantCount(eventId);
  const [diag, setDiag] = useState<DebugData>({});
  const [currentUserParticipantId, setCurrentUserParticipantId] = useState<string | null>(null);

  useEffect(() => {
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
    try {
      debugLog("EventMembers.fetch:start", { eventId, userId: user?.id });
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
    if (!(userRole === 'admin' && eventStatus === 'pending')) {
      toast.error(t('members.cannot_remove_after_draw'));
      return;
    }
    try {
      const { error } = await supabase
        .from('event_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success(t('members.participant_removed'));
    } catch (error: unknown) {
      console.error('Error removing member:', error);
      toast.error(t('members.error_removing_participant'));
    }
  };

  const removeUnjoinedMember = async (participantId: string) => {
    if (userRole !== 'admin') {
      toast.error(t('members.error_no_permission'));
      return;
    }

    try {
      const { data, error } = await supabase.rpc('remove_unjoined_participant', {
        _event_id: eventId,
        _participant_id: participantId
      });

      if (error) throw error;

      toast.success(t('members.invite_removed'));
      debugLog('EventMembers', `Removal result: ${JSON.stringify(data)}`);
    } catch (error: unknown) {
      console.error('Error removing unjoined member:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Cannot remove joined participant')) {
        toast.error(t('members.cannot_remove_joined'));
      } else {
        toast.error(t('members.error_removing_invite'));
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

      toast.success(t('members.admin_transfer_success'));
      debugLog('EventMembers.transferAdmin', { result: data });
      
      window.location.reload();
    } catch (error: unknown) {
      console.error('Error transferring admin:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(`${t('members.admin_transfer_error')}: ${errorMessage}`);
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

      {/* Event Share Link - show for admins when event is pending */}
      {userRole === 'admin' && eventStatus === 'pending' && joinCode && (
        <EventShareLink 
          eventId={eventId} 
          joinCode={joinCode} 
          eventName={eventName || ''} 
        />
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">{t('members.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} {t('members.total_members')} • {joinedCount} {t('members.active_participants')}
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
