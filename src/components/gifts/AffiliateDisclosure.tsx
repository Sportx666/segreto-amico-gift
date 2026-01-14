import { useI18n } from '@/i18n';
import { Info } from 'lucide-react';

interface AffiliateDisclosureProps {
  variant?: 'inline' | 'footer';
  className?: string;
}

export const AffiliateDisclosure = ({ 
  variant = 'inline',
  className = '' 
}: AffiliateDisclosureProps) => {
  const { t } = useI18n();

  if (variant === 'footer') {
    return (
      <div className={`bg-muted/50 border-t py-6 ${className}`}>
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <p>{t('gift_guide.affiliate_disclosure')}</p>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2">
            {t('gift_guide.affiliate_note')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full ${className}`}>
      <Info className="w-3 h-3" />
      <span>{t('gift_guide.affiliate_disclosure_short')}</span>
    </div>
  );
};
