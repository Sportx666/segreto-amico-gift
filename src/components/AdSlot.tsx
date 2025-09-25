import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { getAdUnitConfig, initializeAdSense, pushAd } from "@/lib/adsense";

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
    const adsEnabled = import.meta.env.VITE_ADS_ENABLED === 'true';
    setIsAdsEnabled(adsEnabled);

    // Check consent
    const consent = localStorage.getItem("ads-consent");
    setHasConsent(consent === "accepted");
  }, []);

  useEffect(() => {
    if (!hasConsent || !isAdsEnabled || !adRef.current) return;

    const loadAdSense = () => {
      const adConfig = getAdUnitConfig(id);
      if (!adConfig) {
        console.warn(`No AdSense configuration found for slot: ${id}`);
        return;
      }

      const adElement = adRef.current;
      if (!adElement) return;

      // Initialize AdSense
      initializeAdSense();

      // Create the ad unit HTML
      const { style, slot, format, fullWidthResponsive, layoutKey } = adConfig;
      const styleString = `display:${style.display}${style.width ? `;width:${style.width}` : ''}${style.height ? `;height:${style.height}` : ''}`;
      
      adElement.innerHTML = `
        <ins class="adsbygoogle"
             style="${styleString}"
             data-ad-client="ca-pub-9283228458809671"
             data-ad-slot="${slot}"
             ${format ? `data-ad-format="${format}"` : ''}
             ${fullWidthResponsive ? 'data-full-width-responsive="true"' : ''}
             ${layoutKey ? `data-ad-layout-key="${layoutKey}"` : ''}></ins>
      `;

      // Push to AdSense
      try {
        pushAd({});
      } catch (error) {
        console.error('Failed to load AdSense ad:', error);
        // Fallback to placeholder
        adElement.innerHTML = `
          <div class="w-full h-full bg-muted border border-border rounded-md flex items-center justify-center text-muted-foreground text-sm">
            ${placeholder}
          </div>
        `;
      }
    };

    const timer = setTimeout(loadAdSense, 100);
    return () => clearTimeout(timer);
  }, [hasConsent, isAdsEnabled, id, placeholder]);

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