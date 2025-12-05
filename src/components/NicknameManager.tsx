import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNickname } from '@/hooks/useNickname';
import { UserCheck, Edit3, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n';

interface NicknameManagerProps {
  eventId?: string;
  compact?: boolean;
}

export function NicknameManager({ eventId, compact = false }: NicknameManagerProps) {
  const { t } = useI18n();
  const { nickname, loading, saving, updateNickname } = useNickname(eventId);
  const [editValue, setEditValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setEditValue(nickname?.nickname || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (editValue.trim().length < 2) return;
    
    const success = await updateNickname(editValue);
    if (success) {
      setIsEditing(false);
      setEditValue('');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
  };

  if (!eventId) {
    return (
      <Card className={compact ? 'p-4' : ''}>
        <CardContent className={compact ? 'p-0' : 'pt-6'}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{t('nickname.select_event')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            <span className="font-medium">{t('nickname.title')}</span>
          </div>
          {nickname && (
            <Badge variant="secondary" className="text-xs">
              {nickname.changes_used} {nickname.changes_used === 1 ? t('nickname.changes_used_singular') : t('nickname.changes_used_plural')}
            </Badge>
          )}
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={t('nickname.placeholder')}
              maxLength={20}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <Button size="sm" onClick={handleSave} disabled={saving || editValue.trim().length < 2}>
              {saving ? t('nickname.saving_short') : t('common.save')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {loading ? t('common.loading') : (nickname?.nickname || t('nickname.no_nickname'))}
            </span>
            <Button size="sm" variant="outline" onClick={handleEdit} disabled={loading}>
              <Edit3 className="w-3 h-3 mr-1" />
              {t('common.edit')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          {t('nickname.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t('nickname.for_event')}
            </p>
            {nickname && (
              <Badge variant="secondary" className="mt-1">
                {nickname.changes_used} {nickname.changes_used === 1 ? t('nickname.changes_used') : t('nickname.changes_used_multi')}
              </Badge>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="nickname">{t('nickname.new_nickname')}</Label>
              <Input
                id="nickname"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={t('nickname.placeholder')}
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('nickname.min_max_chars')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || editValue.trim().length < 2}>
                {saving ? t('nickname.saving') : t('nickname.save_nickname')}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="font-medium">
                {loading ? t('common.loading') : (nickname?.nickname || t('nickname.no_nickname'))}
              </p>
            </div>
            <Button variant="outline" onClick={handleEdit} disabled={loading}>
              <Edit3 className="w-4 h-4 mr-2" />
              {nickname ? t('nickname.edit_nickname') : t('nickname.set_nickname')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
