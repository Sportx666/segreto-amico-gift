import { forwardRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronUp, MessageCircle, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { ChatMessage } from '@/types';

interface MessageGroupsProps {
  messageGroups: { [key: string]: ChatMessage[] };
  formatMessageTime: (timestamp: string) => string;
}

export const MessageGroups = ({ messageGroups, formatMessageTime }: MessageGroupsProps) => {
  return (
    <>
      {Object.entries(messageGroups).map(([date, dayMessages]) => (
        <div key={date}>
          <div className="text-center my-4">
            <Badge variant="outline" className="text-xs">
              {date}
            </Badge>
          </div>
          {dayMessages.map((message) => (
            <div key={message.id} className="flex items-start gap-3 mb-4">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                style={{ backgroundColor: message.color_snapshot }}
              >
                {message.alias_snapshot?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">
                    {message.alias_snapshot || 'Anonimo'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(message.created_at)}
                  </span>
                </div>
                <div className="text-sm bg-muted/50 rounded-lg px-3 py-2">
                  {message.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </>
  );
};

interface LoadingSkeletonProps {
  count?: number;
}

export const LoadingSkeleton = ({ count = 3 }: LoadingSkeletonProps) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 mb-4 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-muted"></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-4 bg-muted rounded w-20"></div>
              <div className="h-3 bg-muted rounded w-12"></div>
            </div>
            <div className="h-8 bg-muted rounded-lg w-3/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface EmptyStateProps {
  isPrivate?: boolean;
}

export const EmptyState = ({ isPrivate = false }: EmptyStateProps) => {
  return (
    <div className="text-center py-8 text-muted-foreground">
      {isPrivate ? (
        <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
      ) : (
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
      )}
      <p>
        {isPrivate ? 'Nessun messaggio privato ancora.' : 'Nessun messaggio ancora.'}
      </p>
      <p className="text-sm">
        {isPrivate ? 'Inizia la conversazione anonima!' : 'Inizia la conversazione!'}
      </p>
    </div>
  );
};

interface LoadMoreButtonProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

export const LoadMoreButton = ({ hasMore, loading, onLoadMore }: LoadMoreButtonProps) => {
  if (!hasMore) return null;

  return (
    <div className="text-center">
      <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
        <ChevronUp className="w-4 h-4 mr-2" />
        Carica messaggi precedenti
      </Button>
    </div>
  );
};

export const formatMessageTime = (timestamp: string) => {
  return format(new Date(timestamp), 'HH:mm', { locale: it });
};

export const formatMessageDate = (timestamp: string) => {
  return format(new Date(timestamp), 'dd MMM', { locale: it });
};

export const groupMessagesByDate = (messages: ChatMessage[]) => {
  const groups: { [key: string]: ChatMessage[] } = {};
  messages.forEach(msg => {
    const date = formatMessageDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
  });
  return groups;
};