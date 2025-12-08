import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { checkVersionOnRouteChange } from '@/lib/versionCheck';

/**
 * Hook that triggers a version check on route changes.
 * Uses debouncing internally to prevent excessive checks.
 */
export const useVersionCheck = () => {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  
  useEffect(() => {
    // Only check if the path actually changed (not just search params)
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      checkVersionOnRouteChange();
    }
  }, [location.pathname]);
};
