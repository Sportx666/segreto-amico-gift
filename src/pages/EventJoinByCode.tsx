import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { Loader2 } from "lucide-react";

const EventJoinByCode = () => {
  const { t } = useI18n();
  const { code } = useParams<{ code: string }>();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "invalid_code" | "event_closed" | "error">("loading");

  useEffect(() => {
    if (!code || loading) return;

    if (!session) {
      navigate(`/auth?next=/join/event/${code}`);
      return;
    }

    const joinEvent = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('join-event', {
          body: { code }
        });

        if (error) {
          console.error('Join event error:', error);
          const errorMessage = error.message || 'error';
          if (errorMessage.includes('invalid_code')) setStatus('invalid_code');
          else if (errorMessage.includes('event_closed')) setStatus('event_closed');
          else setStatus('error');
          return;
        }

        if (data?.redirect) {
          navigate(data.redirect);
        } else {
          setStatus('error');
        }
      } catch (err) {
        console.error('Join event exception:', err);
        setStatus('error');
      }
    };

    joinEvent();
  }, [code, loading, session, navigate]);

  const renderMessage = () => {
    switch (status) {
      case "invalid_code":
        return t('event_join.invalid_code');
      case "event_closed":
        return t('event_join.event_closed');
      case "error":
        return t('event_join.join_error');
      default:
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t('event_join.joining')}</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="shadow-elegant border-0 bg-white/95 backdrop-blur-sm max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">{renderMessage()}</CardTitle>
          </CardHeader>
          {status !== "loading" && (
            <Button onClick={() => navigate("/")} className="mt-4">
              {t('event_join.back_home')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventJoinByCode;
