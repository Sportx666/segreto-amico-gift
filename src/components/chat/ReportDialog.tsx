import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import { chatService, type ReportReason } from '@/services/chatService';

export type ReportTarget = { messageId: string } | { privateChatId: string };

interface ReportDialogProps {
  target: ReportTarget | null;
  onClose: () => void;
}

const REASONS: ReportReason[] = ['harassment', 'inappropriate', 'spam', 'other'];

/** Report a chat message or a whole private conversation. */
export function ReportDialog({ target, onClose }: ReportDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    if (sending) return;
    setReason('harassment');
    setDetails('');
    onClose();
  };

  const submit = async () => {
    if (!target) return;
    setSending(true);
    try {
      await chatService.reportContent(target, reason, details);
      toast.success(t('chat.report_sent'));
      setSending(false);
      close();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      toast.error(code.includes('too_many_reports') ? t('chat.report_too_many') : t('chat.report_error'));
      setSending(false);
    }
  };

  const isConversation = !!target && 'privateChatId' in target;

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isConversation ? t('chat.report_conversation') : t('chat.report_message')}</DialogTitle>
          <DialogDescription>{t('chat.report_description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('chat.report_reason_label')}</Label>
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              {REASONS.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <RadioGroupItem value={r} id={`report-reason-${r}`} />
                  <Label htmlFor={`report-reason-${r}`} className="font-normal">
                    {t(`chat.report_reason_${r}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">{t('chat.report_details_label')}</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t('chat.report_details_placeholder')}
              maxLength={1000}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={close} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" onClick={submit} disabled={sending || !target}>
            {t('chat.report_submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
