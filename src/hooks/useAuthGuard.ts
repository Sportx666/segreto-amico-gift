/**
 * Authentication guard hook to protect routes and redirect unauthenticated users
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';

interface UseAuthGuardOptions {
  /** Redirect path for unauthenticated users. Defaults to '/auth' */
  redirectTo?: string;
  /** Whether to include current path as 'next' parameter. Defaults to true */
  preserveNext?: boolean;
}

interface UseAuthGuardReturn {
  /** Current authenticated user */
  user: ReturnType<typeof useAuth>['user'];
  /** Whether authentication is still loading */
  loading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

export function useAuthGuard(options: UseAuthGuardOptions = {}): UseAuthGuardReturn {
  const { redirectTo = '/auth', preserveNext = true } = options;
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect while still loading
    if (loading) return;

    // If user is not authenticated, redirect to auth page
    if (!user) {
      const currentPath = window.location.pathname;
      const redirectUrl = preserveNext && currentPath !== '/' 
        ? `${redirectTo}?next=${encodeURIComponent(currentPath)}`
        : redirectTo;
      
      navigate(redirectUrl);
    }
  }, [user, loading, navigate, redirectTo, preserveNext]);

  return {
    user,
    loading,
    isAuthenticated: !!user
  };
}