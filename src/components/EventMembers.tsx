import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Trash2, Crown, User, Copy, RefreshCw, MessageCircle, Mail, UserX } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateParticipantId } from "@/lib/participants";
import { debugLog, isDebug } from "@/lib/debug";
import { StatusChip } from "@/components/StatusChip";
import { copyToClipboard, shareViaWhatsApp } from "@/lib/whatsapp";
import { EventMemberNameEditor } from './EventMemberNameEditor';
import { absUrl } from "@/lib/url";

interface EventMembersProps {
  eventId: string;
  userRole: string;
  eventStatus?: string; // draw_status from event (e.g., 'pending', 'completed')
}

interface Member {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
}

export const EventMembers = ({ eventId, userRole, eventStatus }: EventMembersProps) => {
  const { user, session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [sendInviteEmail, setSendInviteEmail] = useState(false);
  const [diag, setDiag] = useState<any>({});
  const [currentUserParticipantId, setCurrentUserParticipantId] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchMembers();
    
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
  }, [eventId, userRole, user]);

  const fetchMembers = async () => {
    try {
      debugLog("EventMembers.fetch:start", { eventId, userId: user?.id });
      // Ensure the viewer has a participant id (RLS-friendly path)
      if (user) {
        try { 
          const pid = await getOrCreateParticipantId(user.id);
          debugLog("EventMembers.viewerParticipantId", { participantId: pid });
          setDiag((d: any) => ({ ...d, viewerParticipantId: pid }));
        } catch (e) {
          debugLog("EventMembers.viewerParticipantId:error", { error: e });
          setDiag((d: any) => ({ ...d, viewerParticipantIdError: String(e) }));
        }
      }

      const { data, error } = await supabase
        .from('event_members')
        .select('id, role, anonymous_name, anonymous_email, status, participant_id')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
      debugLog("EventMembers.query", { count: data?.length, error });
      if (!error && data) {
        setMembers((data as any[] || []) as Member[]);
        setDiag((d: any) => ({ ...d, membersCount: data?.length ?? 0 }));
        return;
      }

      // If blocked or empty, try to at least show current user's membership
      if (user) {
        const pid = await getOrCreateParticipantId(user.id);
        const { data: selfRow } = await supabase
          .from('event_members')
          .select('id, role, anonymous_name, anonymous_email, status, participant_id')
          .eq('event_id', eventId)
          .eq('participant_id', pid)
          .maybeSingle();
        debugLog("EventMembers.selfRow", { selfRow });
        if (selfRow) {
          setMembers([selfRow as Member]);
          setDiag((d: any) => ({ ...d, fallbackSelfRow: true }));
          return;
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching members:', error);
      toast.error("Errore nel caricamento dei partecipanti");
    } finally {
      setIsLoading(false);
    }
  };

  const addMember = async () => {
    if (!newMemberName.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }

    setIsAddingMember(true);
    try {
      const { data: participant } = await supabase
        .from('participants')
        .insert({ profile_id: null })
        .select('id')
        .single();

      if (!participant) throw new Error('Participant creation failed');

      const { data: memberRow, error: memberError } = await supabase
        .from('event_members')
        .insert({
          event_id: eventId,
          participant_id: participant.id,
          anonymous_name: newMemberName.trim(),
          anonymous_email: newMemberEmail.trim() || null,
          role: 'member',
          status: 'invited'
        })
        .select('id, participant_id')
        .single();

      if (memberError) throw memberError;

      const { data: inviteData, error: inviteError } = await supabase.functions.invoke('join-create', {
        body: { eventId, participantId: memberRow.participant_id }
      });
      if (inviteError) {
        console.error('join/create failed', inviteError);
        toast.error('Errore nel generare il link');
      } else if (inviteData) {
        setInviteLinks((prev) => ({ ...prev, [memberRow.id]: { ...inviteData, url: absUrl(`/join/${inviteData.token}`) } }));
      }

      setNewMemberName('');
      setNewMemberEmail('');
      await fetchMembers();
      toast.success('Partecipante aggiunto!');
    } catch (error: unknown) {
      console.error('Error adding member:', error);
      toast.error('Errore nell\'aggiungere il partecipante');
    } finally {
      setIsAddingMember(false);
    }
  };

  const addMemberServer = async () => {
    const name = newMemberName.trim();
    const email = newMemberEmail.trim();
    if (!name) {
      toast.error("Il nome è obbligatorio");
      return;
    }

    // Debug: Check if we have authentication
    if (!session?.access_token) {
      toast.error("Non autenticato - riprova");
      console.error('No access token available');
      return;
    }
    if (!user?.id) {
      toast.error("Utente non identificato - riprova");
      console.error('No user ID available');
      return;
    }

    console.log('Adding member:', { eventId, name, email, hasAuth: !!session.access_token });
    setIsAddingMember(true);
    try {
      const { data: body, error } = await supabase.functions.invoke('members-add', {
        body: { eventId, anonymousName: name, anonymousEmail: email || null },
      });
      
      if (error) {
        let msg = 'Errore nell\'aggiungere il partecipante';
        console.error('members-add function error:', error);
        
        if (error.message?.includes('duplicate_email')) {
          msg = 'Questa email è già stata invitata';
        } else if (error.message?.includes('Forbidden')) {
          msg = 'Non hai i permessi per aggiungere partecipanti';
        } else if (error.message?.includes('Unauthorized')) {
          msg = 'Sessione scaduta - ricarica la pagina';
        } else if (error.message) {
          msg = `Errore: ${error.message}`;
        }
        
        toast.error(msg);
        return;
      }
      if (body?.invite && body?.memberId) {
        const invite = { ...body.invite, url: absUrl(`/join/${body.invite.token}`) };
        setInviteLinks((prev) => ({ ...prev, [body.memberId]: invite }));

        // Send invite email if requested
        if (sendInviteEmail && email) {
          try {
            const { data: emailData, error: emailError } = await supabase.functions.invoke('mail-invite', {
              body: {
                email,
                eventId,
                participantId: body.participantId,
                joinUrl: invite.url
              }
            });

            if (!emailError) {
              toast.success('Partecipante aggiunto e email inviata!');
            } else {
              toast.success('Partecipante aggiunto! (Errore nell\'invio email)');
            }
          } catch (emailError) {
            console.error('Error sending invite email:', emailError);
            toast.success('Partecipante aggiunto! (Errore nell\'invio email)');
          }
        } else {
          toast.success('Partecipante aggiunto!');
        }
      }
      
      setNewMemberName('');
      setNewMemberEmail('');
      setSendInviteEmail(false);
      await fetchMembers();
    } catch (error) {
      console.error('Error adding member via API:', error);
      toast.error('Errore nell\'aggiungere il partecipante');
    } finally {
      setIsAddingMember(false);
    }
  };

  const debugCheckPermissions = async () => {
    try {
      const { data: debugData, error: debugError } = await supabase.functions.invoke('debug-rls', {
        body: { eventId }
      });
      
      if (debugError) {
        setDiag((d: any) => ({ ...d, debugRls: { error: debugError.message } }));
        toast.error('Debug RLS errore');
      } else {
        setDiag((d: any) => ({ ...d, debugRls: debugData }));
        toast.success('Debug RLS completato');
      }
    } catch (e) {
      console.error('RLS debug failed', e);
      toast.error('Debug RLS errore');
    }
  };

  const debugAddMemberTest = async () => {
    try {
      const name = newMemberName.trim() || 'Test User';
      const email = newMemberEmail.trim() || '';
      const { data: addData, error: addError } = await supabase.functions.invoke('members-add', {
        body: { eventId, anonymousName: name, anonymousEmail: email || null, ttlDays: 1 }
      });
      
      setDiag((d: any) => ({ ...d, debugAddResp: addError ? { error: addError.message } : addData }));
      if (addError) toast.error('members/add error');
      else toast.success('members/add OK');
    } catch (e) {
      console.error('debug add failed', e);
      toast.error('Debug add errore');
    }
  };

  function safeJson(text: string) {
    try { return JSON.parse(text); } catch { return text; }
  }

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

      await fetchMembers();
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

      await fetchMembers();
      toast.success("Invito rimosso");
      console.log('Removal result:', data);
    } catch (error: any) {
      console.error('Error removing unjoined member:', error);
      if (error.message?.includes('Cannot remove joined participant')) {
        toast.error("Non puoi rimuovere un partecipante che ha già accettato l'invito");
      } else {
        toast.error("Errore nella rimozione dell'invito");
      }
    }
  };

  const getMemberName = (member: Member) => {
    if (member.anonymous_name && member.anonymous_name.trim().length > 0) return member.anonymous_name;
    if (member.anonymous_email && member.anonymous_email.trim().length > 0) return member.anonymous_email;
    return "Partecipante";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-6 bg-muted rounded w-1/3"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isDebug() && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="secondary" size="sm" onClick={debugCheckPermissions}>Verifica permessi (RLS)</Button>
            <Button variant="secondary" size="sm" onClick={debugAddMemberTest}>Test add via API</Button>
          </div>
          <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify({ eventId, ...diag }, null, 2)}</pre>
        </Card>
      )}
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Partecipanti</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} partecipanti nell'evento
          </p>
        </div>

        {userRole === 'admin' && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4"/>
                <span className="hidden sm:inline">Aggiungi</span> 
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi Partecipante</DialogTitle>
                <DialogDescription>
                  Aggiungi un nuovo partecipante all'evento
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="Nome del partecipante"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email (opzionale)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="email@esempio.com"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="send-invite"
                    checked={sendInviteEmail}
                    onCheckedChange={(checked) => setSendInviteEmail(checked as boolean)}
                    disabled={!newMemberEmail.trim()}
                  />
                  <Label
                    htmlFor="send-invite"
                    className={`text-sm ${!newMemberEmail.trim() ? 'text-muted-foreground' : ''}`}
                  >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Invia email di invito
                  </Label>
                </div>
                <Button 
                  onClick={addMemberServer} 
                  className="w-full" 
                  disabled={isAddingMember}
                >
                  {isAddingMember ? "Aggiungendo..." : "Aggiungi Partecipante"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <Card key={member.id}>
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
                          onNameUpdated={fetchMembers}
                        />
                      )}
                    </div>
                    
                    {/* Email row */}
                    {member.anonymous_email && (
                      <p className="text-sm text-muted-foreground mb-2 truncate">
                        {member.anonymous_email}
                      </p>
                    )}
                    
                    {/* Badges row - responsive layout */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <StatusChip status={member.status} />
                      {member.role === 'admin' && (
                        <Badge variant="secondary" aria-label="Amministratore">Admin</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Right side: badges (hidden on mobile) and action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Badges - visible on desktop only */}
                  <div className="hidden sm:flex items-center gap-2">
                    <StatusChip status={member.status} />
                    {member.role === 'admin' && (
                      <Badge variant="secondary" aria-label="Amministratore">Admin</Badge>
                    )}
                  </div>

                  {userRole === 'admin' && eventStatus === 'pending' && member.role !== 'admin' && (
                    <>
                      {member.status === 'invited' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUnjoinedMember(member.participant_id)}
                          title="Rimuovi invito"
                        >
                          <UserX className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(member.id)}
                        title="Rimuovi partecipante"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {inviteLinks[member.id] && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const link = inviteLinks[member.id].url || absUrl(`/join/${inviteLinks[member.id].token}`);
                        await copyToClipboard(link);
                        toast.success('Link copiato');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copia Link
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
                      onClick={() => {
                        const link = inviteLinks[member.id].url || absUrl(`/join/${inviteLinks[member.id].token}`);
                        shareViaWhatsApp(link);
                      }}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const { data: inviteData, error: inviteError } = await supabase.functions.invoke('join-create', {
                            body: { eventId, participantId: member.participant_id }
                          });
                          if (inviteError) {
                            console.error('join/create failed', inviteError);
                            toast.error('Errore nel rigenerare il link');
                            return;
                          }
                          if (inviteData) {
                            setInviteLinks((prev) => ({ ...prev, [member.id]: { ...inviteData, url: absUrl(`/join/${inviteData.token}`) } }));
                            toast.success('Link rigenerato');
                          }
                        } catch {
                          toast.error('Errore nel rigenerare il link');
                        }
                      }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Rigenera
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {members.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Nessun partecipante</h3>
            <p className="text-sm text-muted-foreground">
              Aggiungi i primi partecipanti per iniziare
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
