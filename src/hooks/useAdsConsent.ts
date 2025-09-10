import { useState, useEffect } from "react";

export const useAdsConsent = () => {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
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