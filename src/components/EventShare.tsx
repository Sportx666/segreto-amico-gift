import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";
import { useI18n } from "@/i18n";

interface EventShareProps {
  event: {
    id: string;
    name: string;
    join_code: string;
    date: string | null;
    budget: number | null;
  };
}

export const EventShare = ({ event }: EventShareProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            {t('event_share.title')}
          </CardTitle>
          <CardDescription>
            {t('event_share.description')}
          </CardDescription>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p></p>
            <p>{t('event_share.go_to_participants')}</p>
            <p>{t('event_share.share_link')}</p>
            <p>{t('event_share.email_hint')}</p>
          </CardContent>
        </CardHeader>
      </Card>

      {/* Come Funziona */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-lg text-blue-900">{t('event_share.how_it_works')}</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2 text-sm">
          <p>{t('event_share.step_1')}</p>
          <p>{t('event_share.step_2')}</p>
          <p>{t('event_share.step_3')}</p>
          <p>{t('event_share.step_4')}</p>
        </CardContent>
      </Card>
    </div>
  );
};