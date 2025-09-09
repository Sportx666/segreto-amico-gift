import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Gift, Chrome } from "lucide-react";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore durante l'accesso con Google", {
        description
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      toast.success("Link magico inviato! 📧", {
        description: "Controlla la tua email e clicca il link per accedere."
      });
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
          <CardHeader className="text-center space-y-6 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <Gift className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Amico Segreto
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                Entra per organizzare il tuo scambio di regali
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Indirizzo Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="la.tua@email.com"
                    className="pl-10 h-12 text-base focus-visible:ring-primary"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-describedby="email-help"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                size="lg"
                className="w-full bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-glow font-medium"
                disabled={loading}
              >
                {loading ? "Invio in corso..." : "Invia Link Magico ✨"}
              </Button>
            </form>
            
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-muted-foreground font-medium">
                  O continua con
                </span>
              </div>
            </div>
            
            <Button 
              onClick={handleGoogleLogin}
              variant="outline"
              size="lg"
              className="w-full border-border hover:bg-accent transition-colors"
            >
              <Chrome className="w-4 h-4 mr-2" />
              Accedi con Google
            </Button>
            
            <p id="email-help" className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
              Ti invieremo un link sicuro per accedere senza password. 
              Controlla anche la cartella spam! 📧
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
