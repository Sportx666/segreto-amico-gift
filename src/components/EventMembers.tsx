import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Trash2, Crown, User } from "lucide-react";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");

  useEffect(() => {
    fetchMembers();
  }, [eventId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('event_members')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data || []);
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
      // First get current user's participant ID to ensure they're admin
      const { data: participant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user!.id)
        .single();

      if (!participant) throw new Error("Participant not found");

      // Create anonymous member
      const { error } = await supabase
        .from('event_members')
        .insert({
          event_id: eventId,
          participant_id: null, // Anonymous member
          anonymous_name: newMemberName.trim(),
          anonymous_email: newMemberEmail.trim() || null,
          role: 'member'
        });

      if (error) throw error;

      setNewMemberName("");
      setNewMemberEmail("");
      await fetchMembers();
      toast.success("Partecipante aggiunto!");
    } catch (error: unknown) {
      console.error('Error adding member:', error);
      toast.error("Errore nell'aggiungere il partecipante");
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
    return member.anonymous_name || `Utente ${member.participant_id?.slice(0, 8)}`;
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
