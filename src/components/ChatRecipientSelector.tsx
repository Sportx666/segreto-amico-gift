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
  display_name: string;
  anonymous_name: string;
  participant_id: string;
}

interface ChatRecipientSelectorProps {
  eventId: string;
  onChatStart: (recipientId: string, nickname: string) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatRecipientSelector({ eventId, onChatStart, isOpen, onOpenChange }: ChatRecipientSelectorProps) {
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
          anonymous_name,
          participants!inner(
            id,
            profiles!inner(
              display_name
            )
          )
        `)
        .eq('event_id', eventId)
        .neq('participant_id', currentParticipant?.id)
        .eq('status', 'confirmed');

      if (error) throw error;

      const formattedMembers = data.map(member => ({
        id: member.participant_id,
        display_name: member.participants.profiles.display_name || 'Senza nome',
        anonymous_name: member.anonymous_name || 'Membro',
        participant_id: member.participant_id
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
    if (!selectedRecipient || !nickname.trim()) {
      toast.error('Seleziona un membro e inserisci un nickname');
      return;
    }

    if (nickname.trim().length < 2) {
      toast.error('Il nickname deve avere almeno 2 caratteri');
      return;
    }

    onChatStart(selectedRecipient, nickname.trim());
    onOpenChange(false);
    setSelectedRecipient('');
    setNickname('');
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
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli un membro..." />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>
                    Caricamento...
                  </SelectItem>
                ) : (
                  members.map(member => (
                    <SelectItem key={member.id} value={member.participant_id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>{member.display_name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nickname">Il tuo nickname anonimo</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Es. Babbo Natale, Elfo Magico..."
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Questo nickname sarà visibile al destinatario per mantenere l'anonimato.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Annulla
            </Button>
            <Button 
              onClick={handleStartChat} 
              disabled={!selectedRecipient || !nickname.trim() || loading}
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