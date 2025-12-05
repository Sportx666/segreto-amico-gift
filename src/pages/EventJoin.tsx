import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";

const EventJoin = () => {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "used">("loading");

  useEffect(() => {
    if (!token || loading) return;

    if (!session) {
      navigate(`/auth?next=/join/${token}`);
      return;
    }

    const run = async () => {
      const { data, error } = await supabase.functions.invoke('join-claim', {
        body: { token }
      });

      if (error) {
        if (error.message === 'invalid') setStatus('invalid');
        else if (error.message === 'used') setStatus('used');
        else if (error.message === 'expired') setStatus('expired');
        else if (error.message === 'forbidden') setStatus('invalid');
        else setStatus('invalid');
        return;
      }

      if (data?.redirect) navigate(data.redirect);
      else setStatus('invalid');
    };

    run();
  }, [token, loading, session, navigate]);

  const renderMessage = () => {
    switch (status) {
      case "invalid":
        return t('event_join.invalid_link');
      case "expired":
        return t('event_join.expired_link');
      case "used":
        return t('event_join.used_link');
      default:
        return t('event_join.verifying');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm">
        <CardContent className="p-8 text-center space-y-4">
          <CardHeader className="p-0">
            <CardTitle>{renderMessage()}</CardTitle>
          </CardHeader>
          {(status === "invalid" || status === "expired" || status === "used") && (
            <Button onClick={() => navigate("/")}>{t('event_join.back_home')}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventJoin;
