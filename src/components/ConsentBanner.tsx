import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie } from "lucide-react";
import { useI18n } from "@/i18n";

interface ConsentBannerProps {
  onAccept: () => void;
  onReject: () => void;
}

export const ConsentBanner = ({ onAccept, onReject }: ConsentBannerProps) => {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("ads-consent");
    if (consent === null) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("ads-consent", "accepted");
    setIsVisible(false);
    onAccept();
  };

  const handleReject = () => {
    localStorage.setItem("ads-consent", "rejected");
    setIsVisible(false);
    onReject();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto md:left-auto md:right-4 md:max-w-sm">
      <Card className="border-border bg-card shadow-elegant">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Cookie className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-card-foreground mb-1">
                {t('consent_banner.title')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('consent_banner.description')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              className="flex-1"
            >
              {t('consent_banner.accept')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              className="flex-1"
            >
              {t('consent_banner.reject')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
