import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

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
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newName, setNewName] = useState(currentName || '');
  const [newEmail, setNewEmail] = useState(currentEmail || '');

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast.error(t('toasts.name_required'));
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
        toast.error(t('toasts.cannot_edit_others'));
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

      toast.success(t('toasts.name_updated'));
      setIsOpen(false);
      onNameUpdated();
    } catch (error: unknown) {
      console.error('Error updating name:', error);
      toast.error(t('toasts.name_update_error'));
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
          <DialogTitle>{t('member_name_editor.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t('member_name_editor.name_label')}</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('member_name_editor.name_placeholder')}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('member_name_editor.email_label')}</label>
            <Input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t('member_name_editor.email_placeholder')}
              type="email"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleUpdateName} 
              disabled={isUpdating || !newName.trim()}
            >
              {isUpdating ? t('member_name_editor.updating') : t('member_name_editor.update')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
