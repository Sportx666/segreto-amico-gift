import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdSlot } from "@/components/AdSlot";
import { Gift, Heart, Users, Sparkles, Calendar } from "lucide-react";

interface IndexProps {
  showMobileFeed?: boolean;
}

const Index = ({ showMobileFeed = false }: IndexProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const fetchDisplayName = async () => {
      if (!user) return;
      const { data: profileInfo } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      const display = profileInfo?.display_name || (user.email?.split("@")[0] ?? null);
      setDisplayName(display);
    };
    fetchDisplayName();
  }, [user]);

  // Stay in sync if the profile name changes elsewhere
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("profiles-display-name")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const next = (payload as any)?.new?.display_name ?? user.email?.split("@")[0] ?? null;
          setDisplayName(next);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="space-y-6">
            <div className="mx-auto w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Gift className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
                Ciao, {displayName ?? "Amico"}!
              </h1>
              <p className="text-xl text-white/90 mb-8">
                Organizza il tuo scambio di regali perfetto
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 shadow-glow"
                onClick={() => navigate("/events")}
              >
                <Calendar className="w-5 h-5 mr-2" />
                I Miei Eventi
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm"
                onClick={() => navigate("/ideas")}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Scopri Idee Regalo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile In-Feed Ad */}
      {showMobileFeed && (
        <div className="lg:hidden px-4 py-8">
          <AdSlot 
            id="mobile-feed" 
            className="w-full"
            placeholder="Contenuti sponsorizzati"
          />
        </div>
      )}

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-white mb-12">
          Come Funziona
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-elegant">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle>Crea Evento</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-white/80 text-center">
                Imposta nome, budget e data. Invita amici e familiari con un semplice link.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-elegant">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Gift className="w-6 h-6" />
              </div>
              <CardTitle>Sorteggio</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-white/80 text-center">
                Il sistema assegna automaticamente chi regala a chi, rispettando le tue esclusioni.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-elegant">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <Heart className="w-6 h-6" />
              </div>
              <CardTitle>Lista Desideri</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-white/80 text-center">
                Ognuno può condividere la propria lista desideri per rendere tutto più facile.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
