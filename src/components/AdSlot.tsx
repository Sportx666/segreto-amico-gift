import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { config } from "@/config/env";

interface AdSlotProps {
  id: string;
  className?: string;
  placeholder?: string;
}

export const AdSlot = ({ id, className = "", placeholder = "Pubblicità" }: AdSlotProps) => {
  const adRef = useRef<HTMLDivElement>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [isAdsEnabled, setIsAdsEnabled] = useState(false);

  useEffect(() => {
    // Check env flag
    const adsEnabled = config.ads.enabled;
    setIsAdsEnabled(adsEnabled);

    // Check consent
    const consent = localStorage.getItem("ads-consent");
    setHasConsent(consent === "accepted");
  }, []);

  useEffect(() => {
    if (!hasConsent || !isAdsEnabled || !adRef.current) return;

    // Load ads script and render ad
    const loadAds = async () => {
      const adElement = adRef.current;
      if (!adElement) return;

      // Load AdSense script if not already loaded
      if (!(window as any).adsbygoogle) {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.ads.adsenseClientId}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }

      // For now, show placeholder until ads are fully configured
      adElement.innerHTML = `
        <div class="w-full h-full bg-muted border border-border rounded-md flex items-center justify-center text-muted-foreground text-sm">
          ${placeholder}
        </div>
      `;
    };

    const timer = setTimeout(loadAds, 100);
    return () => clearTimeout(timer);
  }, [hasConsent, isAdsEnabled, placeholder]);

  if (!isAdsEnabled) {
    return null;
  }

  return (
    <div 
      ref={adRef}
      id={id}
      className={`ad-slot ${className}`}
      style={{ minHeight: "250px" }}
    >
      {!hasConsent && (
        <Card className="w-full h-full min-h-[250px] flex items-center justify-center border-dashed">
          <div className="text-muted-foreground text-sm text-center p-4">
            <div>Contenuti pubblicitari</div>
            <div className="text-xs mt-1">Accetta i cookie per visualizzare</div>
          </div>
        </Card>
      )}
    </div>
  );
};