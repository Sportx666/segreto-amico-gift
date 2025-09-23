import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { debugLog } from "@/lib/debug";
import { absUrl } from "@/lib/url";

interface AddMemberDialogProps {
  eventId: string;
  onMemberAdded: () => void;
}

export const AddMemberDialog = ({ eventId, onMemberAdded }: AddMemberDialogProps) => {
  const { user, session } = useAuth();
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [sendInviteEmail, setSendInviteEmail] = useState(false);
  const [open, setOpen] = useState(false);

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

    debugLog('AddMemberDialog', `Adding member: ${eventId}, ${name}, ${email}, hasAuth: ${!!session.access_token}`);
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

      // Send invite email if requested
      if (sendInviteEmail && email && body?.invite) {
        try {
          const { error: emailError } = await supabase.functions.invoke('mail-invite', {
            body: {
              email,
              eventId,
              participantId: body.participantId,
              joinUrl: absUrl(`/join/${body.invite.token}`)
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

      setNewMemberName('');
      setNewMemberEmail('');
      setSendInviteEmail(false);
      setOpen(false);
      onMemberAdded();
    } catch (error) {
      console.error('Error adding member via API:', error);
      toast.error('Errore nell\'aggiungere il partecipante');
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="w-4 h-4" />
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
  );
};