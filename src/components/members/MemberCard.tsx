import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, User, Copy, RefreshCw, MessageCircle, UserX, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";
import { StatusChip } from "@/components/StatusChip";
import { copyToClipboard } from "@/lib/utils";
import { EventMemberNameEditor } from '../EventMemberNameEditor';
import { absUrl } from "@/lib/url";
import { EmailIcon, EmailShareButton, WhatsappIcon, WhatsappShareButton } from "react-share";

interface Member {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
  token_data?: {
    token: string;
    expires_at: string;
    used_at: string | null;
  } | null;
}

interface MemberCardProps {
  member: Member;
  eventId: string;
  userRole: string;
  eventStatus: string;
  currentUserParticipantId: string | null;
  onRemoveMember: (memberId: string) => void;
  onRemoveUnjoinedMember: (participantId: string) => void;
}

const getMemberName = (member: Member) => {
  if (member.anonymous_name && member.anonymous_name.trim().length > 0) return member.anonymous_name;
  if (member.anonymous_email && member.anonymous_email.trim().length > 0) return member.anonymous_email;
  return "Partecipante";
};

export const MemberCard = ({ 
  member, 
  eventId, 
  userRole, 
  eventStatus, 
  currentUserParticipantId, 
  onRemoveMember, 
  onRemoveUnjoinedMember 
}: MemberCardProps) => {
  const [copyingToken, setCopyingToken] = useState(false);

  const copyJoinToken = async (token: string) => {
    setCopyingToken(true);
    try {
      const joinUrl = absUrl(`/join/${token}`);
      const success = await copyToClipboard(joinUrl);
      if (success) {
        toast.success("Link di invito copiato!");
      } else {
        toast.error("Errore nel copiare il link");
      }
    } catch (error) {
      console.error('Error copying token:', error);
      toast.error("Errore nel copiare il link");
    } finally {
      setCopyingToken(false);
    }
  };

  const refreshToken = async (participantId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('join-create', {
        body: { eventId, participantId, ttlDays: 30 }
      });

      if (error) throw error;

      debugLog('EventMembers.tokenRefreshed', { data });
      toast.success("Token aggiornato!");
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error("Errore nell'aggiornare il token");
    }
  };

  const getJoinUrl = (token: string) => absUrl(`/join/${token}`);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              {member.role === 'admin' ? (
                <Crown className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {/* Name and editor row */}
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium truncate">{getMemberName(member)}</p>
                {/* Allow users to edit their own name */}
                {currentUserParticipantId === member.participant_id && (
                  <EventMemberNameEditor
                    eventId={eventId}
                    participantId={member.participant_id}
                    currentName={member.anonymous_name}
                    currentEmail={member.anonymous_email}
                    onNameUpdated={() => {
                      // The hook will automatically refresh via real-time subscriptions
                      setTimeout(() => {
                        // Could trigger a manual refresh here if needed
                      }, 100);
                    }}
                  />
                )}
              </div>

              {/* Email row */}
              {member.anonymous_email && (
                <p className="text-sm text-muted-foreground mb-2 truncate">
                  {member.anonymous_email}
                </p>
              )}

              {/* Status and role badges */}
              <div className="flex items-center gap-2 mb-3">
                <StatusChip status={member.status} />
                {member.role === 'admin' && (
                  <Badge variant="secondary" className="text-xs">
                    Admin
                  </Badge>
                )}
              </div>

              {/* Token management section */}
              {member.token_data && userRole === 'admin' && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyJoinToken(member.token_data!.token)}
                      disabled={copyingToken}
                      className="flex items-center gap-2 text-xs touch-target focus-ring"
                      aria-label={`Copia link di invito per ${getMemberName(member)}`}
                    >
                      <Copy className="w-3 h-3" />
                      <span className="hidden sm:inline">Copia Link</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshToken(member.participant_id)}
                      className="flex items-center gap-2 text-xs touch-target focus-ring"
                      aria-label={`Rinnova token per ${getMemberName(member)}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span className="hidden sm:inline">Rinnova</span>
                    </Button>
                  </div>

                  {/* Share buttons */}
                  <div className="flex gap-1">
                    {member.anonymous_email && (
                      <EmailShareButton
                        url={getJoinUrl(member.token_data.token)}
                        subject={`Invito per partecipare all'evento`}
                        body={`Ciao! Sei stato invitato a partecipare a un evento. Clicca qui per unirti: ${getJoinUrl(member.token_data.token)}`}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <EmailIcon size={28} round />
                      </EmailShareButton>
                    )}
                    
                    <WhatsappShareButton
                      url={getJoinUrl(member.token_data.token)}
                      title={`Ciao! Sei stato invitato a partecipare a un evento. Clicca qui per unirti:`}
                      className="hover:opacity-80 transition-opacity"
                    >
                      <WhatsappIcon size={28} round />
                    </WhatsappShareButton>
                  </div>

                  {/* Token info */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Scade: {new Date(member.token_data.expires_at).toLocaleDateString()}</p>
                    {member.token_data.used_at && (
                      <p>Usato: {new Date(member.token_data.used_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {userRole === 'admin' && (
            <div className="flex flex-col gap-1">
              {member.status === 'invited' && eventStatus === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveUnjoinedMember(member.participant_id)}
              className="touch-target text-muted-foreground hover:text-destructive focus-ring"
              aria-label={`Rimuovi invito per ${getMemberName(member)}`}
            >
              <UserX className="w-4 h-4" />
            </Button>
              )}
              
              {member.status === 'joined' && eventStatus === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemoveMember(member.id)}
              className="touch-target text-muted-foreground hover:text-destructive focus-ring"
              aria-label={`Rimuovi ${getMemberName(member)} dall'evento`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};