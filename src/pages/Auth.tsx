import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { getOAuthRedirectUrl, getMagicLinkRedirectUrl } from "@/lib/auth-urls";
import { Tabs as TabsComponent, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordReset from "@/components/PasswordReset";
import PasswordSetup from "@/components/PasswordSetup";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import logo from "@/assets/logo.png";

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
  const { t } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const nextParam = params.get("next");
  const typeParam = params.get("type");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  useEffect(() => {
    // Check URL for password recovery type
    if (typeParam === 'recovery') {
      setShowPasswordSetup(true);
      return;
    }

    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // If recovery type in URL, show password setup
        if (typeParam === 'recovery') {
          setShowPasswordSetup(true);
        } else {
          navigate(next);
        }
      }
    };
    checkAuth();
  }, [navigate, next, typeParam]);

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
          toast.error(t('auth.invalid_credentials'), {
            description: t('auth.invalid_credentials_desc')
          });
        } else {
          throw error;
        }
        return;
      }

      toast.success(t('auth.login_success'));
      navigate(next);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('auth.login_error'), {
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
      toast.error(t('auth.google_login_error'), {
        description
      });
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: getOAuthRedirectUrl(next)
        }
      });

      if (error) throw error;
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('auth.facebook_login_error'), {
        description
      });
    }
  };

  const handleDiscordLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: getOAuthRedirectUrl(next)
        }
      });

      if (error) throw error;
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('auth.discord_login_error'), {
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

      toast.success(t('auth.magic_link_sent'), {
        description: t('auth.magic_link_desc')
      });
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('auth.send_error'), {
        description
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetupComplete = () => {
    setShowPasswordSetup(false);
    // Clear the type param from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('type');
    window.history.replaceState({}, '', newUrl.toString());
    navigate(next);
  };

  const handlePasswordSetupSkip = () => {
    setShowPasswordSetup(false);
    // Clear the type param from URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('type');
    window.history.replaceState({}, '', newUrl.toString());
    navigate(next);
  };

  // Check if we should show password setup after magic link login or handle password recovery
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle password recovery flow
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordSetup(true);
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // Check if this is a recovery flow from URL
        if (typeParam === 'recovery') {
          setShowPasswordSetup(true);
          return;
        }

        // Check if this is a new user from magic link who doesn't have password
        const isNewUser = session.user.created_at === session.user.last_sign_in_at;
        const hasPasswordSet = session.user.user_metadata?.password_set === true;
        const signedInWithMagicLink = !session.user.app_metadata?.providers?.includes('password');
        
        if (isNewUser && signedInWithMagicLink && !hasPasswordSet) {
          // Show password setup for new magic link users
          setTimeout(() => setShowPasswordSetup(true), 500);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [typeParam]);

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
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <img src={logo} alt="Amico Segreto Logo" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-1 sm:space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Amico Segreto
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-muted-foreground">
                {t('auth.enter_to_organize')}
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0 px-4 sm:px-6">
            {/* Social login buttons - icon only row */}
            <div className="flex justify-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-full p-0 bg-white hover:bg-gray-50 border border-gray-200 shadow-sm"
                    onClick={handleGoogleLogin}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Google</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-full p-0 bg-[#1877F2] hover:bg-[#166FE5] border-0"
                    onClick={handleFacebookLogin}
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Facebook</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="h-12 w-12 rounded-full p-0 bg-[#5865F2] hover:bg-[#4752C4] border-0"
                    onClick={handleDiscordLogin}
                  >
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                    </svg>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discord</TooltipContent>
              </Tooltip>
            </div>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-muted-foreground font-medium">
                  {t('auth.or_continue_with')}
                </span>
              </div>
            </div>
            
            <TabsComponent value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-11">
                <TabsTrigger value="password" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t('auth.fast_login')}</span>
                  <span className="xs:hidden">{t('auth.password')}</span>
                </TabsTrigger>
                <TabsTrigger value="magic" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{t('auth.magic_link')}</span>
                  <span className="xs:hidden">Link</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-4">
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-password" className="text-sm font-medium">
                      {t('auth.email')}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email-password"
                        type="email"
                        placeholder={t('auth.email_placeholder')}
                        className="pl-10 h-12"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      {t('auth.password')}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t('auth.password_placeholder')}
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
                        {t('auth.remember_me')}
                      </Label>
                    </div>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm text-primary hover:text-primary/80"
                      onClick={() => setShowPasswordReset(true)}
                    >
                      {t('auth.forgot_password')}
                    </Button>
                  </div>

                  <Button 
                    type="submit" 
                    size="lg"
                    className="w-full bg-gradient-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-glow font-medium"
                    disabled={loading}
                  >
                    {loading ? t('auth.logging_in') : t('auth.login_button')}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="magic" className="space-y-4">
                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-magic" className="text-sm font-medium">
                      {t('auth.email_address')}
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="email-magic"
                        type="email"
                        placeholder={t('auth.email_placeholder')}
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
                    {loading ? t('auth.sending') : t('auth.send_magic_link')}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center mt-4 leading-relaxed">
                  {t('auth.magic_link_info')}
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