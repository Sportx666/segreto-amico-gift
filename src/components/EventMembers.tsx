import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Trash2, Crown, User, Copy, RefreshCw, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateParticipantId } from "@/lib/participants";
import { debugLog, isDebug } from "@/lib/debug";
import { StatusChip } from "@/components/StatusChip";
import { copyToClipboard, shareViaWhatsApp } from "@/lib/whatsapp";

interface EventMembersProps {
  eventId: string;
  userRole: string;
}

interface Member {
  id: string;
  role: string;
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: string;
  participant_id: string;
}

export const EventMembers = ({ eventId, userRole }: EventMembersProps) => {
  const { user, session } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [diag, setDiag] = useState<any>({});
  const [inviteLinks, setInviteLinks] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchMembers();
  }, [eventId, userRole]);

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

      const inviteResp = await fetch('/api/join/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ eventId, participantId: memberRow.participant_id }),
      });
      const invite = await inviteResp.json();
      setInviteLinks((prev) => ({ ...prev, [memberRow.id]: invite }));

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

  const removeMember = async (memberId: string) => {
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
                <UserPlus className="w-4 h-4 mr-2" />
                Aggiungi
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
                <Button 
                  onClick={addMember} 
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    {member.role === 'admin' ? (
                      <Crown className="w-5 h-5 text-primary" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{getMemberName(member)}</p>
                    {member.anonymous_email && (
                      <p className="text-sm text-muted-foreground">
                        {member.anonymous_email}
                      </p>
                    )}
                  </div>
                </div>
                
                  <div className="flex items-center gap-2">
                  <StatusChip status={member.status} />
                  {member.role === 'admin' && (
                    <Badge variant="secondary">Admin</Badge>
                  )}

                  {userRole === 'admin' && member.role !== 'admin' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                  </div>
                </div>
                {inviteLinks[member.id] && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await copyToClipboard(inviteLinks[member.id].url);
                        toast.success('Link copiato');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copia Link
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#25D366] hover:bg-[#20BD5A] text-white"
                      onClick={() => shareViaWhatsApp(inviteLinks[member.id].url)}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const resp = await fetch('/api/join/create', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session?.access_token}`,
                            },
                            body: JSON.stringify({ eventId, participantId: member.participant_id }),
                          });
                          const invite = await resp.json();
                          setInviteLinks((prev) => ({ ...prev, [member.id]: invite }));
                          toast.success('Link rigenerato');
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
