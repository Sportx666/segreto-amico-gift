import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { checkAndReloadIfNeeded } from '@/lib/versionCheck';

// Hook to check for updates on route changes
export function useVersionCheck() {
  const location = useLocation();

  useEffect(() => {
    // Check for updates when route changes
    checkAndReloadIfNeeded();
  }, [location.pathname]);
}
