import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gift, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import confetti from "canvas-confetti";

interface FirstDrawRevealDialogProps {
  eventId: string;
  assignedName?: string;
  onClose: () => void;
}

export function FirstDrawRevealDialog({ eventId, assignedName, onClose }: FirstDrawRevealDialogProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        // Check if user has already seen the reveal for this event
        const { data: member, error } = await supabase
          .from('event_members')
          .select('reveal_shown')
          .eq('event_id', eventId)
          .eq('participant_id', user.user.id)
          .single();

        if (error || !member) return;

        if (!member.reveal_shown && assignedName) {
          setShouldShow(true);
          setIsVisible(true);
          
          // Mark as shown
          await supabase
            .from('event_members')
            .update({ reveal_shown: true })
            .eq('event_id', eventId)
            .eq('participant_id', user.user.id);

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
            🎉 Sorteggio Completato! 🎉
          </h2>

          {/* Assigned Name with Animation */}
          <div className="bg-white/50 rounded-lg p-6 mb-4 border border-primary/20">
            <p className="text-sm text-muted-foreground mb-2">
              Il tuo abbinamento è:
            </p>
            <div className="text-3xl font-bold text-primary animate-pulse">
              {assignedName}
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-muted-foreground">
            Ora puoi vedere la lista dei desideri e iniziare a pensare al regalo perfetto!
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