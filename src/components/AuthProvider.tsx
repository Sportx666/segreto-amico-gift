import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WelcomeScreen } from "./WelcomeScreen";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  showWelcome: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  showWelcome: false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

/**
 * Ensures a profile record exists for the authenticated user.
 * Creates a new profile with defaults if one doesn't exist.
 * @param user - The authenticated user
 */
const ensureProfile = async (user: User) => {
  try {
    // Check if profile already exists
    const { data: existingProfile, error: selectError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (selectError) {
      console.error('Error checking existing profile:', selectError);
      return;
    }

    // If profile already exists, do nothing
    if (existingProfile) {
      return;
    }

    // Extract display name from email (local part before @)
    const displayName = user.email?.split('@')[0] || 'User';

    // Create new profile with defaults
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
        avatar_url: null
      });

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return;
    }

    console.log('✅ Profile created for new user:', { userId: user.id, displayName });
    toast.success(`Welcome ${displayName}! Your profile has been created.`);

  } catch (error) {
    console.error('Error in ensureProfile:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const prevUser = user;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Show welcome screen for new logins (but not on initial page load)
      if (event === 'SIGNED_IN' && session?.user && !prevUser) {
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
          setShowWelcome(true);
        }
      }

      // Ensure profile exists for authenticated user
      if (session?.user) {
        // Use setTimeout to avoid blocking the auth state change
        setTimeout(() => {
          ensureProfile(session.user);
        }, 0);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Ensure profile exists for existing session
      if (session?.user) {
        setTimeout(() => {
          ensureProfile(session.user);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenWelcome', 'true');
  };

  // Show welcome screen if needed
  if (showWelcome && user) {
    return (
      <AuthContext.Provider value={{ user, session, loading, showWelcome }}>
        <WelcomeScreen 
          onComplete={handleWelcomeComplete}
          userEmail={user.email}
        />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, showWelcome }}>
      {children}
    </AuthContext.Provider>
  );
};