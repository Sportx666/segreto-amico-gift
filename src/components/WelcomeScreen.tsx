import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Mail, Zap } from "lucide-react";
import { toast } from "sonner";

interface WelcomeScreenProps {
  onComplete: () => void;
  userEmail?: string;
}

export const WelcomeScreen = ({ onComplete, userEmail }: WelcomeScreenProps) => {
  const [showOptIn, setShowOptIn] = useState(false);
  const [hasRememberMe, setHasRememberMe] = useState(false);

  useEffect(() => {
    // Check if user already opted for remember me
    const rememberPreference = localStorage.getItem('rememberMe');
    const hasOptedForFaster = localStorage.getItem('hasOptedForFaster');
    
    setHasRememberMe(!!rememberPreference);
    
    // Only show opt-in if they haven't seen it and don't have remember me
    if (!hasOptedForFaster && !rememberPreference) {
      setShowOptIn(true);
    }
  }, []);

  const handleEnableFasterLogin = () => {
    localStorage.setItem('rememberMe', 'true');
    localStorage.setItem('hasOptedForFaster', 'true');
    toast.success("Perfetto! I tuoi prossimi accessi saranno più veloci ⚡");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem('hasOptedForFaster', 'true');
    onComplete();
  };

  // If user already has remember me enabled, show success and continue
  if (hasRememberMe) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold">
              Benvenuto! 🎉
            </CardTitle>
            <CardDescription>
              Sei già configurato per accessi veloci. La prossima volta non dovrai cliccare link email!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={onComplete}
              className="w-full bg-gradient-primary hover:bg-primary/90 font-medium"
            >
              Continua
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show opt-in screen for new users
  if (showOptIn) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl font-bold">
              Accessi più veloci? ⚡
            </CardTitle>
            <CardDescription>
              Vuoi evitare di cliccare link email ogni volta?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Ora</p>
                  <p className="text-xs text-muted-foreground">
                    Clicchi il link email ogni volta che vuoi accedere
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Zap className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    Con accesso veloce 
                    <Badge variant="secondary" className="text-xs">Consigliato</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Rientri automaticamente per settimane, senza email
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleEnableFasterLogin}
                className="w-full bg-gradient-primary hover:bg-primary/90 font-medium"
              >
                <Zap className="w-4 h-4 mr-2" />
                Attiva Accesso Veloce
              </Button>
              
              <Button 
                onClick={handleSkip}
                variant="ghost"
                className="w-full text-sm"
              >
                Forse più tardi
              </Button>
            </div>

            {userEmail && (
              <p className="text-xs text-muted-foreground text-center">
                Configureremo {userEmail} per accessi automatici
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default: just continue (shouldn't normally reach here)
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center">
          <CardTitle>Benvenuto!</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={onComplete} className="w-full">
            Continua
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};