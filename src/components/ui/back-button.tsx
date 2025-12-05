import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface BackButtonProps {
  to: string;
  label?: string;
  variant?: 'back' | 'home';
  className?: string;
}

export function BackButton({ 
  to, 
  label, 
  variant = 'back',
  className 
}: BackButtonProps) {
  const navigate = useNavigate();
  const { t } = useI18n();

  const defaultLabel = variant === 'home' 
    ? t('buttons.home') 
    : t('buttons.back');
  const Icon = variant === 'home' ? Home : ArrowLeft;

  return (
    <div className={cn("container max-w-6xl py-2 md:py-3", className)}>
      <Button
        variant="ghost"
        onClick={() => navigate(to)}
        className="text-muted-foreground hover:text-foreground focus-ring"
        aria-label={label || defaultLabel}
      >
        <Icon className="w-4 h-4 mr-2" />
        {label || defaultLabel}
      </Button>
    </div>
  );
}
