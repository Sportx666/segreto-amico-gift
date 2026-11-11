import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { readFunctionError } from "@/lib/functionError";

const EventJoin = () => {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "used" | "forbidden">("loading");

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
        const code = await readFunctionError(error);
        if (code === 'used') setStatus('used');
        else if (code === 'expired') setStatus('expired');
        else if (code === 'forbidden') setStatus('forbidden');
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
      case "forbidden":
        return t('event_join.forbidden_link');
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
          {(status === "invalid" || status === "expired" || status === "used" || status === "forbidden") && (
            <Button onClick={() => navigate("/")}>{t('event_join.back_home')}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventJoin;
