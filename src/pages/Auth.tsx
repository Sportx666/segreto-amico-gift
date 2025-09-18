import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Gift, Chrome, Lock, Eye, EyeOff } from "lucide-react";
import { getOAuthRedirectUrl, getMagicLinkRedirectUrl } from "@/lib/auth-urls";
import { Tabs as TabsComponent, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordReset from "@/components/PasswordReset";
import PasswordSetup from "@/components/PasswordSetup";
import GoogleButton from 'react-google-button'

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [activeTab, setActiveTab] = useState("magic");
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const nextParam = params.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate(next);
      }
    };
    checkAuth();
  }, [navigate, next]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Credenziali non valide", {
            description: "Email o password errati. Prova il reset password se necessario."
          });
        } else {
          throw error;
        }
        return;
      }

      toast.success("Accesso effettuato! 🎉");
      navigate(next);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error("Errore durante l'accesso", {
        description
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(next)
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

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getMagicLinkRedirectUrl(next),
          shouldCreateUser: true
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

  const handlePasswordSetupComplete = () => {
    setShowPasswordSetup(false);
    navigate(next);
  };

  const handlePasswordSetupSkip = () => {
    setShowPasswordSetup(false);
    navigate(next);
  };

  // Check if we should show password setup after magic link login
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is a new user from magic link who doesn't have password
        const isNewUser = session.user.created_at === session.user.last_sign_in_at;
        const signedInWithMagicLink = !session.user.app_metadata?.providers?.includes('password');
        
        if (isNewUser && signedInWithMagicLink) {
          // Show password setup for new magic link users
          setTimeout(() => setShowPasswordSetup(true), 1000);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (showPasswordReset) {
    return <PasswordReset onBack={() => setShowPasswordReset(false)} />;
  }

  if (showPasswordSetup) {
    return (
      <PasswordSetup 
        onComplete={handlePasswordSetupComplete}
        onSkip={handlePasswordSetupSkip}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4 sm:space-y-6 pb-4 sm:pb-6 px-4 sm:px-6">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow">
              <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Amico Segreto
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-muted-foreground">
                Entra per organizzare il tuo scambio di regali
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 px-4 sm:px-6">
                       
            <GoogleButton 
              onClick={handleGoogleLogin}
              type="light"
              size="lg"
              className="w-full border-border hover:bg-accent transition-colors"
            >
              <Chrome className="w-4 h-4 mr-2" />
              Accedi con Google
            </GoogleButton>

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
            
            <TabsComponent value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-11">
                <TabsTrigger value="password" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Accesso Veloce</span>
                  <span className="xs:hidden">Password</span>
                </TabsTrigger>
                <TabsTrigger value="magic" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">Link Magico</span>
                  <span className="xs:hidden">Link</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-4">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-password" className="text-sm font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email-password"
                        type="email"
                        placeholder="la.tua@email.com"
                        className="pl-10 h-12"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="La tua password"
                        className="pl-10 pr-10 h-12"
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
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe} 
                        onCheckedChange={(checked) => setRememberMe(!!checked)}
                      />
                      <Label htmlFor="remember" className="text-sm text-muted-foreground">
                        Ricordami
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm text-primary hover:text-primary/80"
                      onClick={() => setShowPasswordReset(true)}
                    >
                      Password dimenticata?
                    </Button>
                  </div>

                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-full bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-glow font-medium"
                    disabled={loading}
                  >
                    {loading ? "Accesso..." : "Accedi"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic" className="space-y-4">
                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-magic" className="text-sm font-medium">
                      Indirizzo Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email-magic"
                        type="email"
                        placeholder="la.tua@email.com"
                        className="pl-10 h-12 text-base focus-visible:ring-primary"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
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

                <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
                  Ti invieremo un link sicuro per accedere senza password. 
                  Controlla anche la cartella spam! 📧
                </p>
              </TabsContent>
            </TabsComponent>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
