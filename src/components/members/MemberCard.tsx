import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Crown, User, Copy, RefreshCw, UserX, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { debugLog } from "@/lib/debug";
import { StatusChip } from "@/components/StatusChip";
import { copyToClipboard } from "@/lib/utils";
import { EventMemberNameEditor } from '../EventMemberNameEditor';
import { absUrl } from "@/lib/url";
import { MemberWishlistPreview } from "./MemberWishlistPreview";

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
  onTransferAdmin: (participantId: string) => void;
}

const getMemberName = (member: Member, t: (key: string) => string) => {
  if (member.anonymous_name && member.anonymous_name.trim().length > 0) return member.anonymous_name;
  if (member.anonymous_email && member.anonymous_email.trim().length > 0) return member.anonymous_email;
  return t('member_card.participant');
};

export const MemberCard = ({ 
  member, 
  eventId, 
  userRole, 
  eventStatus, 
  currentUserParticipantId, 
  onRemoveMember, 
  onRemoveUnjoinedMember,
  onTransferAdmin
}: MemberCardProps) => {
  const { t } = useI18n();
  const [copyingToken, setCopyingToken] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const memberName = getMemberName(member, t);

  const copyJoinToken = async (token: string) => {
    setCopyingToken(true);
    try {
      const joinUrl = absUrl(`/join/${token}`);
      const success = await copyToClipboard(joinUrl);
      if (success) {
        toast.success(t('toasts.invite_link_copied'));
      } else {
        toast.error(t('toasts.copy_error'));
      }
    } catch (error) {
      console.error('Error copying token:', error);
      toast.error(t('toasts.copy_error'));
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
      toast.success(t('toasts.token_refreshed'));
    } catch (error) {
      console.error('Error refreshing token:', error);
      toast.error(t('toasts.token_error'));
    }
  };

  const getJoinUrl = (token: string) => absUrl(`/join/${token}`);

  // Handle email button click - show dialog if no email, otherwise send invite
  const handleEmailClick = () => {
    if (member.anonymous_email) {
      // Has email - trigger email share directly
      sendEmailInvite(member.anonymous_email);
    } else {
      // No email - show dialog to add it
      setMemberEmail("");
      setShowEmailDialog(true);
    }
  };

  const sendEmailInvite = async (email: string) => {
    if (!member.token_data?.token) {
      toast.error(t('toasts.token_unavailable'));
      return;
    }

    const joinUrl = getJoinUrl(member.token_data.token);
    const subject = encodeURIComponent(t('members.invite_email_subject'));
    const body = encodeURIComponent(t('members.invite_email_body').replace('{link}', joinUrl));
    
    // Use mailto link
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const handleSaveEmailAndInvite = async () => {
    if (!memberEmail.trim() || !memberEmail.includes('@')) {
      toast.error(t('toasts.invalid_email'));
      return;
    }

    setSavingEmail(true);
    try {
      // Update the member's email in the database
      const { error } = await supabase
        .from('event_members')
        .update({ anonymous_email: memberEmail.trim() })
        .eq('id', member.id);

      if (error) throw error;

      toast.success(t('toasts.email_saved'));
      setShowEmailDialog(false);
      
      // Send the invite
      sendEmailInvite(memberEmail.trim());
    } catch (error) {
      console.error('Error saving email:', error);
      toast.error(t('toasts.email_error'));
    } finally {
      setSavingEmail(false);
    }
  };

  // Handle WhatsApp share - use window.location.href to avoid extra tab
  const handleWhatsAppShare = () => {
    if (!member.token_data?.token) return;
    
    const joinUrl = getJoinUrl(member.token_data.token);
    const text = encodeURIComponent(t('members.invite_email_body').replace('{link}', joinUrl));
    
    // Use window.location.href to avoid opening a new tab
    window.location.href = `https://wa.me/?text=${text}`;
  };

  // Check if this member can receive admin transfer
  const canReceiveAdminTransfer = 
    userRole === 'admin' && 
    member.status === 'joined' && 
    member.role !== 'admin' &&
    currentUserParticipantId !== member.participant_id;

  return (
    <>
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                {member.role === 'admin' ? (
                  <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                ) : (
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {/* Name and editor row */}
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium truncate text-sm sm:text-base">{memberName}</p>
                  {/* Allow users to edit their own name */}
                  {currentUserParticipantId === member.participant_id && (
                    <EventMemberNameEditor
                      eventId={eventId}
                      participantId={member.participant_id}
                      currentName={member.anonymous_name}
                      currentEmail={member.anonymous_email}
                      onNameUpdated={() => {
                        setTimeout(() => {}, 100);
                      }}
                    />
                  )}
                </div>

                {/* Email row */}
                {member.anonymous_email && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 truncate">
                    {member.anonymous_email}
                  </p>
                )}

                {/* Status and role badges */}
                <div className="flex items-center gap-1 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
                  <StatusChip status={member.status} />
                  {member.role === 'admin' && (
                    <Badge variant="secondary" className="text-xs">
                      Admin
                    </Badge>
                  )}
                </div>

                {/* Token management section - hidden for joined members */}
                {member.token_data && userRole === 'admin' && member.status !== 'joined' && (
                  <div className="space-y-2">
                    {/* All action buttons in one aligned row */}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      {/* Copy button - blue circular */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyJoinToken(member.token_data!.token)}
                        disabled={copyingToken}
                        className="p-0 h-7 w-7 rounded-full hover:opacity-80 transition-opacity"
                        aria-label={t('member_card.copy_invite_for').replace('{name}', memberName)}
                      >
                        <div className="w-7 h-7 bg-[#3B82F6] rounded-full flex items-center justify-center">
                          <Copy className="w-4 h-4 text-white" />
                        </div>
                      </Button>
                      
                      {/* Refresh button - amber circular */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refreshToken(member.participant_id)}
                        className="p-0 h-7 w-7 rounded-full hover:opacity-80 transition-opacity"
                        aria-label={t('member_card.refresh_token_for').replace('{name}', memberName)}
                      >
                        <div className="w-7 h-7 bg-[#F59E0B] rounded-full flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-white" />
                        </div>
                      </Button>
                      
                      {/* Email button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEmailClick}
                        className="p-0 h-7 w-7 rounded-full hover:opacity-80 transition-opacity"
                        aria-label={t('member_card.send_email_invite')}
                      >
                        <div className="w-7 h-7 bg-[#EA4335] rounded-full flex items-center justify-center">
                          <Mail className="w-4 h-4 text-white" />
                        </div>
                      </Button>
                      
                      {/* WhatsApp button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleWhatsAppShare}
                        className="p-0 h-7 w-7 rounded-full hover:opacity-80 transition-opacity"
                        aria-label={t('member_card.send_whatsapp_invite')}
                      >
                        <div className="w-7 h-7 bg-[#25D366] rounded-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-current">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </div>
                      </Button>
                    </div>

                    {/* Token info */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>{t('member_card.expires')}: {new Date(member.token_data.expires_at).toLocaleDateString()}</p>
                      {member.token_data.used_at && (
                        <p>{t('member_card.used')}: {new Date(member.token_data.used_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>
                )}
            </div>
            
            {/* Wishlist Preview - only for joined members */}
            <MemberWishlistPreview
              participantId={member.participant_id}
              eventId={eventId}
              isCurrentUser={currentUserParticipantId === member.participant_id}
              memberStatus={member.status}
            />
          </div>

            {/* Actions */}
            {userRole === 'admin' && (
              <div className="flex flex-col gap-1">
                {/* Transfer Admin button - for joined non-admin members */}
                {canReceiveAdminTransfer && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTransferDialog(true)}
                    className="touch-target text-muted-foreground hover:text-primary focus-ring h-8 w-8 p-0"
                    aria-label={t('member_card.transfer_admin_to').replace('{name}', memberName)}
                    title={t('member_card.transfer_admin')}
                  >
                    <Crown className="w-4 h-4" />
                  </Button>
                )}

                {/* Delete buttons - Hide if this is the admin's own card */}
                {!(member.role === 'admin' && currentUserParticipantId === member.participant_id) && (
                  <>
                    {member.status === 'invited' && eventStatus === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveUnjoinedMember(member.participant_id)}
                        className="touch-target text-muted-foreground hover:text-destructive focus-ring h-8 w-8 p-0"
                        aria-label={t('member_card.remove_invite').replace('{name}', memberName)}
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    )}
                    
                    {member.status === 'joined' && eventStatus === 'pending' && member.role !== 'admin' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveMember(member.id)}
                        className="touch-target text-muted-foreground hover:text-destructive focus-ring h-8 w-8 p-0"
                        aria-label={t('member_card.remove_member').replace('{name}', memberName)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Input Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('member_card.add_email')}</DialogTitle>
            <DialogDescription>
              {t('member_card.add_email_desc').replace('{name}', memberName)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-email">{t('common.email')}</Label>
              <Input
                id="member-email"
                type="email"
                placeholder={t('member_name_editor.email_placeholder')}
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveEmailAndInvite} disabled={savingEmail}>
              {savingEmail ? t('member_card.saving') : t('member_card.save_and_send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Admin Confirmation Dialog */}
      <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('member_card.transfer_admin')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('member_card.transfer_admin_confirm').replace('{name}', memberName)}
              {' '}{t('member_card.transfer_admin_warning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onTransferAdmin(member.participant_id);
              setShowTransferDialog(false);
            }}>
              {t('member_card.transfer')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};