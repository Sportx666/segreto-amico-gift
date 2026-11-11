import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";
import { displayNameFromUser } from "@/lib/profileName";
import { pinterestLoad } from "@/lib/pinterest";
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
  const displayName = displayNameFromUser(user);
  const row = {
    id: user.id,
    display_name: displayName,
    avatar_url: null,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // ignoreDuplicates keeps an existing display name. A second attempt
      // covers a race where the row appears between tries.
      const { error } = await supabase
        .from('profiles')
        .upsert(row, { onConflict: 'id', ignoreDuplicates: true });

      if (!error) {
        debugLog('AuthProvider', `Profile ensured for ${user.id}`);
        return;
      }
      console.error('Error ensuring profile:', error);
    } catch (error) {
      console.error('Error in ensureProfile:', error);
    }
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

      // Pinterest Enhanced Match: re-fire load with email when authenticated
      if (session?.user?.email) {
        pinterestLoad(session.user.email);
      }

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

      // Pinterest Enhanced Match on initial session restore
      if (session?.user?.email) {
        pinterestLoad(session.user.email);
      }

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