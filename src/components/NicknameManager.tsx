import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useNickname } from '@/hooks/useNickname';
import { UserCheck, Edit3, AlertCircle } from 'lucide-react';

interface NicknameManagerProps {
  eventId?: string;
  compact?: boolean;
}

export function NicknameManager({ eventId, compact = false }: NicknameManagerProps) {
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
            <span className="text-sm">Seleziona un evento per gestire il tuo nickname</span>
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
            <span className="font-medium">Nickname Anonimo</span>
          </div>
          {nickname && (
            <Badge variant="secondary" className="text-xs">
              {nickname.changes_used} {nickname.changes_used === 1 ? 'modifica' : 'modifiche'}
            </Badge>
          )}
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Il tuo nickname anonimo"
              maxLength={20}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <Button size="sm" onClick={handleSave} disabled={saving || editValue.trim().length < 2}>
              {saving ? 'Salvo...' : 'Salva'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Annulla
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {loading ? 'Caricamento...' : (nickname?.nickname || 'Nessun nickname impostato')}
            </span>
            <Button size="sm" variant="outline" onClick={handleEdit} disabled={loading}>
              <Edit3 className="w-3 h-3 mr-1" />
              Modifica
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
          Nickname Anonimo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Il tuo nickname per questo evento
            </p>
            {nickname && (
              <Badge variant="secondary" className="mt-1">
                {nickname.changes_used} {nickname.changes_used === 1 ? 'modifica utilizzata' : 'modifiche utilizzate'}
              </Badge>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="nickname">Nuovo Nickname</Label>
              <Input
                id="nickname"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Il tuo nickname anonimo"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimo 2 caratteri, massimo 20
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || editValue.trim().length < 2}>
                {saving ? 'Salvando...' : 'Salva Nickname'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Annulla
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 border rounded-lg bg-muted/50">
              <p className="font-medium">
                {loading ? 'Caricamento...' : (nickname?.nickname || 'Nessun nickname impostato')}
              </p>
            </div>
            <Button variant="outline" onClick={handleEdit} disabled={loading}>
              <Edit3 className="w-4 h-4 mr-2" />
              {nickname ? 'Modifica Nickname' : 'Imposta Nickname'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}