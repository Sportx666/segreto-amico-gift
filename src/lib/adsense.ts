import type { AdSenseConfig } from "@/types/adsense";

// Google AdSense configuration
export const adsenseConfig = {
  publisherId: "ca-pub-9283228458809671",
  adUnits: {
    "edge-left": {
      slot: import.meta.env.VITE_ADSENSE_EDGE_LEFT_SLOT || "1234567890",
      format: "auto",
      fullWidthResponsive: true,
      style: { display: "block", width: "300px", height: "600px" }
    } as AdSenseConfig,
    "edge-right": {
      slot: import.meta.env.VITE_ADSENSE_EDGE_RIGHT_SLOT || "1234567891", 
      format: "auto",
      fullWidthResponsive: true,
      style: { display: "block", width: "300px", height: "600px" }
    } as AdSenseConfig,
    "mobile-feed": {
      slot: import.meta.env.VITE_ADSENSE_MOBILE_FEED_SLOT || "1234567892",
      format: "fluid",
      layoutKey: "-fb+5w+4e-db+86",
      style: { display: "block" }
    } as AdSenseConfig
  }
};

export const getAdUnitConfig = (slotId: string): AdSenseConfig | undefined => {
  return adsenseConfig.adUnits[slotId as keyof typeof adsenseConfig.adUnits];
};

// Initialize AdSense if not already loaded
export const initializeAdSense = () => {
  if (typeof window !== 'undefined' && !window.adsbygoogle) {
    window.adsbygoogle = [];
  }
};

// Push ad to AdSense queue
export const pushAd = (adConfig: any) => {
  if (typeof window !== 'undefined' && window.adsbygoogle) {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push(adConfig);
    } catch (error) {
      console.error('AdSense push failed:', error);
    }
  }
};