import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const EventJoin = () => {
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
      const resp = await fetch('/api/join/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (data?.error === 'invalid') setStatus('invalid');
        else if (data?.error === 'used') setStatus('used');
        else if (data?.error === 'expired') setStatus('expired');
        else if (resp.status === 403) setStatus('invalid');
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
