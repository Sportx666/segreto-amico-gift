import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
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

    // Create new profile with defaults (email removed for security)
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: displayName,
        avatar_url: null
      });

    if (insertError) {
      console.error('Error creating profile:', insertError);
      return;
    }

    debugLog('AuthProvider', `✅ Profile created for new user: ${user.id}, ${displayName}`);

  } catch (error) {
    console.error('Error in ensureProfile:', error);
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Ensure profile exists for authenticated user
      if (session?.user) {
        // Mark if user set up password (for password auth tracking)
        if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') {
          setTimeout(async () => {
            await supabase.auth.updateUser({
              data: { password_set: true }
            });
          }, 0);
        }

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
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};