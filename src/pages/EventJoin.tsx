import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EventJoin = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "used">("loading");

  useEffect(() => {
    if (!token || loading) return;

    const run = async () => {
      const { data: jt, error } = await supabase
        .from("join_tokens")
        .select("event_id, participant_id, expires_at, used_at")
        .eq("token", token)
        .single();

      if (error || !jt) {
        setStatus("invalid");
        return;
      }
      if (jt.used_at) {
        setStatus("used");
        return;
      }
      if (new Date(jt.expires_at) < new Date()) {
        setStatus("expired");
        return;
      }

      if (!user) {
        localStorage.setItem("pendingJoinToken", token);
        navigate("/auth");
        return;
      }

      await supabase
        .from("participants")
        .update({ profile_id: user.id })
        .eq("id", jt.participant_id)
        .is("profile_id", null);

      await supabase
        .from("event_members")
        .update({ status: "joined" })
        .eq("event_id", jt.event_id)
        .eq("participant_id", jt.participant_id);

      await supabase
        .from("join_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      navigate(`/events/${jt.event_id}`);
    };

    run();
  }, [token, user, loading, navigate]);

  const renderMessage = () => {
    switch (status) {
      case "invalid":
        return "Link non valido";
      case "expired":
        return "Link scaduto";
      case "used":
        return "Link già utilizzato";
      default:
        return "Verifica del link in corso...";
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
            <Button onClick={() => navigate("/")}>Torna alla home</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EventJoin;
