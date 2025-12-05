import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageCircle, User } from 'lucide-react';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const { user } = useAuth();
  const [members, setMembers] = useState<EventMember[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && eventId) {
      fetchEventMembers();
    }
  }, [isOpen, eventId]);

  const fetchEventMembers = async () => {
    try {
      setLoading(true);
      
      const { data: currentParticipant } = await supabase
        .from('participants')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

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
        anonymous_name: member.anonymous_name || t('common.member')
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error fetching event members:', error);
      toast.error(t('chat_selector.error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!selectedRecipient) {
      toast.error(t('chat_selector.select_member'));
      return;
    }

    const selected = members.find(m => (m as any).participant_id === selectedRecipient || (m as any).id === selectedRecipient);
    const name = (selected as any)?.anonymous_name || (selected as any)?.display_name || t('chat.anonymous_user');

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
            {t('chat_selector.title')}
          </DialogTitle>
          <DialogDescription>
            {t('chat_selector.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipient">{t('chat_selector.recipient')}</Label>
            <Select value={selectedRecipient} onValueChange={setSelectedRecipient} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={disabled ? t('chat_selector.chat_unavailable') : t('chat_selector.choose_member')} />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="loading" disabled>
                    {t('chat_selector.loading')}
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
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleStartChat} 
              disabled={!selectedRecipient || loading || disabled}
              className="flex-1"
            >
              {t('chat_selector.start_chat')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
