import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Mail, Key, LogOut, User } from "lucide-react";
import { usePasswordAuth } from "@/hooks/usePasswordAuth";
import PasswordSetup from "./PasswordSetup";
import { useI18n } from "@/i18n";

const AccountSettings = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { hasPassword, loading: passwordLoading } = usePasswordAuth();
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success(t('account.signout_success'));
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : undefined;
      toast.error(t('account.signout_error'), { description });
    } finally {
      setSigningOut(false);
    }
  };

  if (showPasswordSetup) {
    return (
      <PasswordSetup 
        onComplete={() => {
          setShowPasswordSetup(false);
          toast.success(t('account.setup_complete'));
        }}
        onSkip={() => setShowPasswordSetup(false)}
      />
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('account.title')}
          </CardTitle>
          <CardDescription>
            {t('account.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('account.email_label')}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant="outline">
                <Mail className="w-3 h-3 mr-1" />
                {t('account.verified')}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">{t('account.login_method')}</p>
                <div className="flex items-center gap-2">
                  {!passwordLoading && (
                    <Badge variant={hasPassword ? "default" : "secondary"}>
                      {hasPassword ? (
                        <>
                          <Key className="w-3 h-3 mr-1" />
                          {t('account.password_method')}
                        </>
                      ) : (
                        <>
                          <Mail className="w-3 h-3 mr-1" />
                          {t('account.link_method')}
                        </>
                      )}
                    </Badge>
                  )}
                  {user.app_metadata?.providers?.includes('google') && (
                    <Badge variant="outline">Google</Badge>
                  )}
                </div>
              </div>              
            </div>
          </div>

          {/* Security Actions */}
          <div className="border-t pt-6">
            <h4 className="text-sm font-medium mb-4">{t('account.security')}</h4>
            <div className="space-y-3">
              {hasPassword && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    supabase.auth.resetPasswordForEmail(user.email || '', {
                      redirectTo: `${window.location.origin}/auth`
                    });
                    toast.success(t('account.reset_email_sent'));
                  }}
                  className="w-full justify-start"
                >
                  <Key className="w-4 h-4 mr-2" />
                  {t('account.change_password')}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full justify-start text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {signingOut ? t('account.signing_out') : t('account.signout')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasPassword && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-medium">{t('account.fast_login_title')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('account.fast_login_desc')}
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowPasswordSetup(true)}
                  className="bg-gradient-primary hover:bg-primary/90"
                >
                  {t('account.setup_now')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AccountSettings;
