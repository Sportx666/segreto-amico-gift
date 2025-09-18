import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

interface UsePasswordAuthReturn {
  hasPassword: boolean;
  loading: boolean;
  checkPasswordStatus: () => Promise<void>;
}

export function usePasswordAuth(): UsePasswordAuthReturn {
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const checkPasswordStatus = async () => {
    if (!user) {
      setHasPassword(false);
      setLoading(false);
      return;
    }

    try {
      // Check if user has password set by examining user metadata
      // Users who signed up with password will have different metadata than magic link users
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // If user has app_metadata.provider === 'email' and no phone, likely has password
        // This is a heuristic since Supabase doesn't expose password status directly
        const hasEmailProvider = currentUser.app_metadata?.providers?.includes('email');
        const signedUpWithPassword = currentUser.user_metadata?.password_set === true;
        
        setHasPassword(hasEmailProvider && (signedUpWithPassword || false));
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error checking password status:', error);
      setHasPassword(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkPasswordStatus();
  }, [user]);

  return {
    hasPassword,
    loading,
    checkPasswordStatus
  };
}