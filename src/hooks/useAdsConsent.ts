import { useState, useEffect } from "react";

const isAdsEnabled = import.meta.env.VITE_ADS_ENABLED === 'true';

export const useAdsConsent = () => {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Skip consent logic entirely when ads are disabled
    if (!isAdsEnabled) {
      setHasConsent(false);
      setShowBanner(false);
      return;
    }

    const consent = localStorage.getItem("ads-consent");
    if (consent === "accepted") {
      setHasConsent(true);
    } else if (consent === "rejected") {
      setHasConsent(false);
    } else {
      setHasConsent(null);
      setShowBanner(true);
    }
  }, []);

  const acceptConsent = () => {
    localStorage.setItem("ads-consent", "accepted");
    setHasConsent(true);
    setShowBanner(false);
  };

  const rejectConsent = () => {
    localStorage.setItem("ads-consent", "rejected");
    setHasConsent(false);
    setShowBanner(false);
  };

  return {
    hasConsent,
    showBanner,
    acceptConsent,
    rejectConsent
  };
};