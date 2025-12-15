import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, RotateCcw } from "lucide-react";
import { useI18n } from "@/i18n";

interface PasswordResetProps {
  onBack: () => void;
}

const PasswordReset = ({ onBack }: PasswordResetProps) => {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/auth?type=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) throw error;

      toast.success(t('password_reset.email_sent_success'), {
        description: t('password_reset.email_sent_desc')
      });
      setSent(true);
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('password_reset.send_error'), {
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
                {sent ? t('password_reset.title_sent') : t('password_reset.title')}
              </CardTitle>
              <CardDescription className="text-base">
                {sent 
                  ? t('password_reset.description_sent')
                  : t('password_reset.description')
                }
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!sent ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">{t('password_reset.email_address')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder={t('auth.email_placeholder')}
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
                  {loading ? t('password_reset.sending') : t('password_reset.send_reset_link')}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('password_reset.check_email')}
                </p>
                <Button 
                  onClick={() => setSent(false)}
                  variant="outline"
                  className="w-full"
                >
                  {t('password_reset.send_again')}
                </Button>
              </div>
            )}

            <Button 
              variant="ghost" 
              onClick={onBack}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('password_reset.back_to_login')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PasswordReset;
