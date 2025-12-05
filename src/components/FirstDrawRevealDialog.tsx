import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gift, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";
import { useI18n } from "@/i18n";

interface FirstDrawRevealDialogProps {
  eventId: string;
  assignedName?: string;
  onClose: () => void;
}

export function FirstDrawRevealDialog({ eventId, assignedName, onClose }: FirstDrawRevealDialogProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        // 1) Find this user's participant id
        const { data: participant, error: pErr } = await supabase
          .from('participants')
          .select('id')
          .eq('profile_id', user.user.id)
          .maybeSingle();

        if (pErr || !participant) {
          throw pErr ?? new Error('Participant not found for current user');
        }

        // 2) Check reveal flag for that participant in this event
        const { data: member, error: mErr } = await supabase
          .from('assignments')
          .select('first_reveal_pending')
          .eq('event_id', eventId)
          .eq('giver_id', participant.id)
          .maybeSingle();

        if (mErr) throw mErr;

        if (member?.first_reveal_pending && assignedName) {
          setShouldShow(true);
          setIsVisible(true);

          // Mark as shown
          await supabase
            .from('assignments')
            .update({ first_reveal_pending: false })
            .eq('event_id', eventId)
            .eq('giver_id', participant.id);


          // Trigger confetti after a short delay
          setTimeout(() => {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 }
            });
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking first visit:', error);
      }
    };

    if (assignedName) {
      checkFirstVisit();
    }
  }, [eventId, assignedName]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Allow animation to complete
  };

  if (!shouldShow) return null;

  return (
    <Dialog open={isVisible} onOpenChange={handleClose}>
      <DialogContent className="max-w-md mx-auto bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
        <div className="text-center py-6">
          {/* Animated Gift Icon */}
          <div className="relative inline-block mb-6">
            <div className="animate-bounce">
              <Gift className="w-20 h-20 text-primary mx-auto" />
            </div>
            <div className="absolute -top-2 -right-2 animate-pulse">
              <Sparkles className="w-8 h-8 text-accent" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-primary mb-2">
            {t('first_reveal.title')}
          </h2>

          {/* Assigned Name with Animation */}
          <div className="bg-white/50 rounded-lg p-6 mb-4 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-2">
              {t('first_reveal.your_match_is')}
            </p>
            <div className="text-3xl font-bold text-primary animate-pulse">
              {assignedName}
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground">
            {t('first_reveal.message')}
          </p>

          {/* Auto-close indicator */}
          <div className="mt-6 flex justify-center">
            <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
              <div className="w-full h-full bg-primary animate-pulse"></div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
