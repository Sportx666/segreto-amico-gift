import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { NotificationBell } from "./NotificationBell";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Gift, Calendar, Lightbulb, User, LogOut, Heart, Menu } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
      <nav className="bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="h-6 w-32 bg-muted animate-pulse rounded-lg"></div>
          <div className="h-8 w-20 bg-muted animate-pulse rounded-lg"></div>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 group"
            aria-label="Torna alla homepage"
          >
            <Gift className="w-6 h-6 text-primary transition-transform group-hover:scale-110" />
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
              Amico Segreto
            </span>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="sm" className="font-medium">
              Accedi
            </Button>
          </Link>
        </div>
      </nav>
    );
  }

  const isActiveRoute = (path: string) => {
    if (path === "/events") return location.pathname.startsWith("/events");
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => cn(
    "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 font-medium",
    "hover:bg-accent hover:text-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActiveRoute(path) 
      ? "bg-primary/10 text-primary shadow-sm" 
      : "text-muted-foreground hover:text-foreground"
  );

  const mobileLinkClass = (path: string) => cn(
    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[60px]",
    "hover:bg-accent/50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    isActiveRoute(path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
  );

  return (
    <>
      <nav className="bg-background/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 group"
            aria-label="Torna alla homepage"
          >
            <Gift className="w-6 h-6 text-primary transition-transform group-hover:scale-110" />
            <span className="font-bold text-xl bg-gradient-primary bg-clip-text text-transparent">
              Amico Segreto
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            <Link to="/events" className={navLinkClass("/events")} aria-current={isActiveRoute("/events") ? "page" : undefined}>
              <Calendar className="w-4 h-4" />
              <span>Eventi</span>
            </Link>
            <Link to="/ideas" className={navLinkClass("/ideas")} aria-current={isActiveRoute("/ideas") ? "page" : undefined}>
              <Lightbulb className="w-4 h-4" />
              <span>Idee</span>
            </Link>
            <Link to="/wishlist" className={navLinkClass("/wishlist")} aria-current={isActiveRoute("/wishlist") ? "page" : undefined}>
              <Heart className="w-4 h-4" />
              <span>Lista Desideri</span>
            </Link>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <NotificationBell />
            <Link 
              to="/profile" 
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Vai al profilo"
            >
              <Avatar className="w-8 h-8 border-2 border-transparent hover:border-primary/20 transition-colors">
                <AvatarImage src={avatarUrl || undefined} alt="Avatar profilo" />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Esci dall'account"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline ml-2">Esci</span>
            </Button>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-label="Menu principale"
          >
            <Menu className="w-4 h-4" />
          </Button>
        </div>
      </nav>
      
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden border-t bg-background/95 backdrop-blur-sm fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="flex justify-around py-2 px-2">
          <Link 
            to="/events" 
            className={mobileLinkClass("/events")}
            aria-current={isActiveRoute("/events") ? "page" : undefined}
            aria-label="Eventi"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-xs font-medium">Eventi</span>
          </Link>
          <Link 
            to="/ideas" 
            className={mobileLinkClass("/ideas")}
            aria-current={isActiveRoute("/ideas") ? "page" : undefined}
            aria-label="Idee regalo"
          >
            <Lightbulb className="w-5 h-5" />
            <span className="text-xs font-medium">Idee</span>
          </Link>
          <Link 
            to="/wishlist" 
            className={mobileLinkClass("/wishlist")}
            aria-current={isActiveRoute("/wishlist") ? "page" : undefined}
            aria-label="Lista desideri"
          >
            <Heart className="w-5 h-5" />
            <span className="text-xs font-medium">Lista</span>
          </Link>
          <Link
            to="/profile"
            className={cn(mobileLinkClass("/profile"), "relative")}
            aria-current={isActiveRoute("/profile") ? "page" : undefined}
            aria-label="Profilo utente"
          >
            <Avatar className="w-6 h-6 border border-border">
              <AvatarImage src={avatarUrl || undefined} alt="Avatar profilo" />
              <AvatarFallback className="text-xs bg-gradient-primary text-primary-foreground">
                <User className="w-3 h-3" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium">Profilo</span>
          </Link>
        </div>
      </div>
      
      {/* Spacer for mobile bottom navigation */}
      <div className="md:hidden h-16"></div>
    </>
  );
};
