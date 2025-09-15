// Route-based ads configuration
export const adsConfig = {
  routes: {
    "/": {
      enabled: true,
      slots: ["edge-left", "edge-right", "mobile-feed"]
    },
    "/events": {
      enabled: true,
      slots: ["edge-left", "edge-right", "mobile-feed"]
    },
    "/events/new": {
      enabled: false,
      slots: []
    },
    "/events/:id": {
      enabled: true,
      slots: ["edge-left", "edge-right"]
    },
    "/ideas": {
      enabled: true,
      slots: ["edge-left", "edge-right", "mobile-feed"]
    },
    "/wishlist": {
      enabled: true,
      slots: ["edge-left", "edge-right"]
    },
    "/profile": {
      enabled: false,
      slots: []
    },
    "/auth": {
      enabled: false,
      slots: []
    }
  }
};

import { config } from '@/config/env';

export const isAdsEnabledForRoute = (path: string): boolean => {
  const adsEnabled = config.ads.enabled;
  if (!adsEnabled) return false;

  // Direct match first
  if (adsConfig.routes[path as keyof typeof adsConfig.routes]) {
    return adsConfig.routes[path as keyof typeof adsConfig.routes].enabled;
  }

  // Check for dynamic routes
  for (const [route, config] of Object.entries(adsConfig.routes)) {
    if (route.includes(":") && matchRoute(route, path)) {
      return config.enabled;
    }
  }

  // Default to enabled for unspecified routes
  return true;
};

export const getAdSlotsForRoute = (path: string): string[] => {
  if (!isAdsEnabledForRoute(path)) return [];

  // Direct match first
  if (adsConfig.routes[path as keyof typeof adsConfig.routes]) {
    return adsConfig.routes[path as keyof typeof adsConfig.routes].slots;
  }

  // Check for dynamic routes
  for (const [route, config] of Object.entries(adsConfig.routes)) {
    if (route.includes(":") && matchRoute(route, path)) {
      return config.slots;
    }
  }

  return ["edge-left", "edge-right", "mobile-feed"];
};

// Simple route matcher for dynamic segments
const matchRoute = (pattern: string, path: string): boolean => {
  const patternParts = pattern.split("/");
  const pathParts = path.split("/");

  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, index) => {
    return part.startsWith(":") || part === pathParts[index];
  });
};