import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Gift, Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RevealAnimationProps {
  isVisible: boolean;
  onComplete?: () => void;
  recipientName?: string;
}

export function RevealAnimation({ isVisible, onComplete, recipientName }: RevealAnimationProps) {
  const [stage, setStage] = useState(0);
  
  useEffect(() => {
    if (!isVisible) return;

    const stages = [
      { delay: 0, duration: 800 },      // Initial fade in
      { delay: 800, duration: 1000 },  // Gift box animation
      { delay: 1800, duration: 800 },  // Sparkles
      { delay: 2600, duration: 400 },  // Final reveal
    ];

    const timeouts = stages.map(({ delay }, index) => 
      setTimeout(() => setStage(index + 1), delay)
    );

    const completeTimeout = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(completeTimeout);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 overflow-hidden">
        <CardContent className="p-8">
          <div className="flex flex-col items-center text-center space-y-6">
            
            {/* Stage 1: Initial message */}
            <div className={cn(
              "transition-all duration-800 ease-out",
              stage >= 1 ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}>
              <h2 className="text-2xl font-bold text-primary mb-2">
                🎉 Il sorteggio è completo!
              </h2>
              <p className="text-muted-foreground">
                Scopri a chi farai il regalo...
              </p>
            </div>

            {/* Stage 2: Animated gift box */}
            <div className={cn(
              "relative transition-all duration-1000 ease-out",
              stage >= 2 ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-12"
            )}>
              <div className={cn(
                "w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center relative",
                stage >= 2 && "animate-pulse"
              )}>
                <Gift className="w-12 h-12 text-primary-foreground" />
                
                {/* Sparkles around the gift */}
                {stage >= 3 && (
                  <>
                    <Sparkles className={cn(
                      "absolute -top-2 -right-2 w-6 h-6 text-yellow-400",
                      "animate-bounce delay-0"
                    )} />
                    <Sparkles className={cn(
                      "absolute -bottom-2 -left-2 w-4 h-4 text-yellow-400",
                      "animate-bounce delay-300"
                    )} />
                    <Sparkles className={cn(
                      "absolute -top-2 -left-2 w-5 h-5 text-yellow-400",
                      "animate-bounce delay-150"
                    )} />
                  </>
                )}
              </div>
            </div>

            {/* Stage 3: Hearts floating */}
            {stage >= 3 && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(5)].map((_, i) => (
                  <Heart
                    key={i}
                    className={cn(
                      "absolute w-4 h-4 text-red-400 opacity-70",
                      "animate-bounce"
                    )}
                    style={{
                      left: `${20 + i * 15}%`,
                      top: `${30 + (i % 2) * 20}%`,
                      animationDelay: `${i * 200}ms`,
                      animationDuration: '2s'
                    }}
                  />
                ))}
              </div>
            )}

            {/* Stage 4: Final reveal */}
            <div className={cn(
              "transition-all duration-400 ease-out",
              stage >= 4 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}>
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                <p className="text-lg font-semibold text-primary mb-1">
                  Il tuo Amico Segreto è:
                </p>
                {recipientName ? (
                  <p className="text-2xl font-bold">
                    {recipientName}
                  </p>
                ) : (
                  <p className="text-lg text-muted-foreground">
                    Caricamento...
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}