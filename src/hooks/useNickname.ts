import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getOrCreateParticipantId } from '@/lib/participants';
import { useI18n } from '@/i18n';

interface NicknameData {
  id: string;
  nickname: string;
  changes_used: number;
}

export function useNickname(eventId?: string) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [nickname, setNickname] = useState<NicknameData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchNickname = async () => {
    if (!user || !eventId) return;
    
    setLoading(true);
    try {
      const participantId = await getOrCreateParticipantId(user.id);
      
      const { data, error } = await supabase
        .from('anonymous_aliases')
        .select('id, nickname, changes_used')
        .eq('event_id', eventId)
        .eq('participant_id', participantId)
        .maybeSingle();

      if (error) throw error;
      setNickname(data);
    } catch (error) {
      console.error('Error fetching nickname:', error);
      toast.error(t('toasts.load_nickname_error'));
    } finally {
      setLoading(false);
    }
  };

  const updateNickname = async (newNickname: string) => {
    if (!user || !eventId || newNickname.trim().length < 2) return false;
    
    setSaving(true);
    try {
      const participantId = await getOrCreateParticipantId(user.id);
      
      if (nickname) {
        // Update existing
        const { data, error } = await supabase
          .from('anonymous_aliases')
          .update({ 
            nickname: newNickname.trim(),
            changes_used: nickname.changes_used + 1
          })
          .eq('id', nickname.id)
          .select()
          .single();

        if (error) throw error;
        setNickname(data);
      } else {
        // Create new
        const { data, error } = await supabase
          .from('anonymous_aliases')
          .insert({
            event_id: eventId,
            participant_id: participantId,
            nickname: newNickname.trim(),
            changes_used: 1
          })
          .select()
          .single();

        if (error) throw error;
        setNickname(data);
      }

      toast.success(t('toasts.nickname_updated'));
      return true;
    } catch (error: any) {
      console.error('Error updating nickname:', error);
      if (error.code === '23505') {
        toast.error(t('toasts.nickname_in_use'));
      } else {
        toast.error(t('toasts.save_nickname_error'));
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchNickname();
  }, [user, eventId]);

  return {
    nickname,
    loading,
    saving,
    updateNickname,
    refetch: fetchNickname
  };
}
