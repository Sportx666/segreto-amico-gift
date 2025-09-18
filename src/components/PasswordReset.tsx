import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, RotateCcw } from "lucide-react";
import { getMagicLinkRedirectUrl } from "@/lib/auth-urls";

interface PasswordResetProps {
  onBack: () => void;
}

const PasswordReset = ({ onBack }: PasswordResetProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getMagicLinkRedirectUrl('/')
      });

      if (error) throw error;

      toast.success("Email di reset inviata! 📧", {
        description: "Controlla la tua email per reimpostare la password."
      });
      setSent(true);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore durante l'invio", {
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
              <RotateCcw className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {sent ? "Email Inviata!" : "Reset Password"}
              </CardTitle>
              <CardDescription className="text-base">
                {sent 
                  ? "Controlla la tua email per completare il reset della password"
                  : "Inserisci la tua email per ricevere il link di reset"
                }
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!sent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Indirizzo Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="la.tua@email.com"
                      className="pl-10 h-12"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  size="lg"
                  className="w-full bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-glow"
                  disabled={loading}
                >
                  {loading ? "Invio..." : "Invia Link di Reset"}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se l'email esiste nel nostro sistema, riceverai le istruzioni per reimpostare la password.
                </p>
                <Button 
                  onClick={() => setSent(false)}
                  variant="outline"
                  className="w-full"
                >
                  Invia di nuovo
                </Button>
              </div>
            )}

            <Button 
              variant="ghost" 
              onClick={onBack}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna al login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;