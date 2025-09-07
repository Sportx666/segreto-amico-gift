import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gift, Calendar, Lightbulb, User, LogOut, Heart } from "lucide-react";
import { toast } from "sonner";

export const Navbar = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .single();
      setAvatarUrl(data?.avatar_url ?? null);
    }
    load();
  }, [user]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast.success("Logout effettuato con successo");
    } catch (error: unknown) {
      toast.error("Errore durante il logout");
    }
  };

  // Don't show navbar on auth page
  if (location.pathname === "/auth") return null;

  if (loading) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm border-b border-border md:sticky md:top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="h-6 w-32 bg-muted animate-pulse rounded"></div>
          <div className="h-8 w-20 bg-muted animate-pulse rounded"></div>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm border-b border-border md:sticky md:top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
              Amico Segreto
            </span>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm">
              Accedi
            </Button>
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-border md:sticky md:top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
            Amico Segreto
          </span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6">
          <Link 
            to="/events" 
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              location.pathname.startsWith("/events") 
                ? "bg-primary/10 text-primary" 
                : "text-foreground hover:text-primary"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Eventi</span>
          </Link>
          <Link 
            to="/ideas" 
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/ideas" 
                ? "bg-primary/10 text-primary" 
                : "text-foreground hover:text-primary"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Idee</span>
          </Link>
          <Link 
            to="/wishlist" 
            className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/wishlist" 
                ? "bg-primary/10 text-primary" 
                : "text-foreground hover:text-primary"
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Lista Desideri</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/profile" className="hidden md:flex">
            <Avatar className="w-8 h-8">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Mobile navigation (fixed bottom) */}
      <div className="md:hidden border-t border-border bg-white/95 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-50">
        <div className="flex justify-around py-2">
          <Link 
            to="/events" 
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors ${
              location.pathname.startsWith("/events") 
                ? "text-primary" 
                : "text-muted-foreground"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-xs">Eventi</span>
          </Link>
          <Link 
            to="/ideas" 
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/ideas" 
                ? "text-primary" 
                : "text-muted-foreground"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span className="text-xs">Idee</span>
          </Link>
          <Link 
            to="/wishlist" 
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/wishlist" 
                ? "text-primary" 
                : "text-muted-foreground"
            }`}
          >
            <Heart className="w-4 h-4" />
            <span className="text-xs">Lista</span>
          </Link>
          <Link
            to="/profile"
            className="flex flex-col items-center gap-1 px-3 py-2 h-auto text-muted-foreground"
          >
            <Avatar className="w-6 h-6">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback>
                <User className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs">Profilo</span>
          </Link>
        </div>
      </div>
    </nav>
  );
};
