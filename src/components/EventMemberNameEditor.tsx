import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";

interface EventMemberNameEditorProps {
  eventId: string;
  participantId: string;
  currentName: string | null;
  currentEmail: string | null;
  onNameUpdated: () => void;
}

export const EventMemberNameEditor = ({ 
  eventId, 
  participantId, 
  currentName, 
  currentEmail, 
  onNameUpdated 
}: EventMemberNameEditorProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newName, setNewName] = useState(currentName || '');
  const [newEmail, setNewEmail] = useState(currentEmail || '');

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }

    setIsUpdating(true);
    try {
      // Check if this is the current user's participant
      const { data: participant } = await supabase
        .from('participants')
        .select('profile_id')
        .eq('id', participantId)
        .single();

      if (!participant || participant.profile_id !== user?.id) {
        toast.error("Non puoi modificare il nome di altri partecipanti");
        return;
      }

      const { error } = await supabase
        .from('event_members')
        .update({
          anonymous_name: newName.trim(),
          anonymous_email: newEmail.trim() || null
        })
        .eq('event_id', eventId)
        .eq('participant_id', participantId);

      if (error) throw error;

      toast.success("Nome aggiornato con successo");
      setIsOpen(false);
      onNameUpdated();
    } catch (error: unknown) {
      console.error('Error updating name:', error);
      toast.error("Errore nell'aggiornare il nome");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica il tuo nome per questo evento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Il tuo nome per questo evento"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email (opzionale)</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@esempio.com"
              type="email"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleUpdateName} 
              disabled={isUpdating || !newName.trim()}
            >
              {isUpdating ? "Aggiornando..." : "Aggiorna"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};