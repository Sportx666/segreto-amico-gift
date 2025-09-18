import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MessageCircle, User } from 'lucide-react';

interface EventMember {
  id: string;  
  anonymous_name: string;
}

interface ChatRecipientSelectorProps {
  eventId: string;
  onChatStart: (recipientId: string, recipientName: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}

export function ChatRecipientSelector({ eventId, onChatStart, isOpen, onOpenChange, disabled = false }: ChatRecipientSelectorProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<EventMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && eventId) {
      fetchEventMembers();
    }
  }, [isOpen, eventId]);

  const fetchEventMembers = async () => {
    try {
      setLoading(true);
      
      // Get current user's participant ID to exclude them
      const { data: currentParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      // Get all event members except current user
      const { data, error } = await supabase
        .from('event_members')
        .select(`
          participant_id,
          anonymous_name
        `)
        .eq('event_id', eventId)
        .neq('participant_id', currentParticipant?.id)
        .eq('status', 'joined');

      if (error) throw error;

      const formattedMembers = data.map(member => ({
        id: member.participant_id,
        anonymous_name: member.anonymous_name || 'Membro'
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error fetching event members:', error);
      toast.error('Errore nel caricamento dei membri');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!selectedRecipient) {
      toast.error('Seleziona un membro');
      return;
    }

    const selected = members.find(m => (m as any).participant_id === selectedRecipient || (m as any).id === selectedRecipient);
    const name = (selected as any)?.anonymous_name || (selected as any)?.display_name || 'Utente Anonimo';

    onChatStart(selectedRecipient, name);
    onOpenChange(false);
    setSelectedRecipient('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Nuova Chat Privata
          </DialogTitle>
          <DialogDescription>
            Seleziona un membro dell'evento e scegli un nickname anonimo per iniziare una chat privata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipient">Destinatario</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={disabled ? "Chat non disponibile" : "Scegli un membro..."} />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>
                    Caricamento...
                  </SelectItem>
                ) : (
                  members.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{member.anonymous_name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annulla
            </Button>
            <Button 
              onClick={handleStartChat} 
              disabled={!selectedRecipient || loading || disabled}
              className="flex-1"
            >
              Inizia Chat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
