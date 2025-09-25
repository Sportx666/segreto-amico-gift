// TypeScript declarations for Google AdSense
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export interface AdSenseConfig {
  slot: string;
  format: string;
  fullWidthResponsive?: boolean;
  layoutKey?: string;
  style: {
    display: string;
    width?: string;
    height?: string;
  };
}

export {};