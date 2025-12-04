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
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Check multiple indicators for password presence:
        // 1. user_metadata.password_set flag (set by PasswordSetup)
        // 2. identities array contains an email identity
        // 3. app_metadata.providers includes 'email'
        const passwordSetFlag = currentUser.user_metadata?.password_set === true;
        const hasEmailIdentity = currentUser.identities?.some(
          (identity) => identity.provider === 'email'
        );
        const hasEmailProvider = currentUser.app_metadata?.providers?.includes('email');
        
        // User has password if any reliable indicator is true
        setHasPassword(passwordSetFlag || (hasEmailIdentity && hasEmailProvider) || false);
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
