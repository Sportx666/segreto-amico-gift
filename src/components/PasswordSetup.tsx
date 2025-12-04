import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Shield, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PasswordSetupProps {
  onComplete: () => void;
  onSkip: () => void;
}

const PasswordSetup = ({ onComplete, onSkip }: PasswordSetupProps) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[a-z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabel = strength < 50 ? "Debole" : strength < 75 ? "Media" : "Forte";
  const strengthColor = strength < 50 ? "bg-destructive" : strength < 75 ? "bg-yellow-500" : "bg-primary";

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Le password non corrispondono");
      return;
    }

    if (password.length < 8) {
      toast.error("La password deve essere di almeno 8 caratteri");
      return;
    }

    setLoading(true);
    
    try {
      // Update password AND set the password_set flag in user_metadata
      const { error } = await supabase.auth.updateUser({
        password: password,
        data: { password_set: true }
      });

      if (error) throw error;

      toast.success("Password impostata! 🔒", {
        description: "Ora puoi accedere più velocemente con email e password."
      });
      onComplete();
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore nell'impostazione della password", {
        description
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Accesso Più Veloce
              </CardTitle>
              <CardDescription className="text-base">
                Imposta una password per accedere senza controllare l'email ogni volta
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSetupPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Almeno 8 caratteri"
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                
                {password && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sicurezza:</span>
                      <span className={`font-medium ${strength < 50 ? "text-destructive" : strength < 75 ? "text-yellow-600" : "text-primary"}`}>
                        {strengthLabel}
                      </span>
                    </div>
                    <Progress value={strength} className="h-2" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Ripeti la password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit" 
                size="lg"
                className="w-full bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-glow"
                disabled={loading || strength < 50}
              >
                {loading ? "Impostazione..." : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Imposta Password
                  </>
                )}
              </Button>
            </form>

            <div className="text-center space-y-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• La password deve contenere almeno 8 caratteri</p>
                <p>• Usa lettere maiuscole, minuscole e numeri</p>
              </div>
              
              <Button 
                variant="ghost" 
                onClick={onSkip}
                className="text-muted-foreground hover:text-foreground"
              >
                Salta per ora
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordSetup;
