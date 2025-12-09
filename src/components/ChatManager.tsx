import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChat } from '@/hooks/useChat';
import { useNickname } from '@/hooks/useNickname';
import { useJoinedParticipantCount } from '@/hooks/useJoinedParticipantCount';
import { useDMConversations } from '@/hooks/useDMConversations';
import { useI18n } from '@/i18n';
import { NicknameManager } from './NicknameManager';
import { ChatRecipientSelector } from './ChatRecipientSelector';
import { MessageCircle, Users, Heart, Send, ChevronUp, Plus, X, Glasses} from 'lucide-react';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

interface ActiveChat {
  recipientId: string;
  recipientName: string;
}

interface ChatManagerProps {
  eventId: string;
  eventStatus: string;
  openChat?: { recipientId: string; recipientName?: string };
  onOpenChatConsumed?: () => void;
}

export interface ChatManagerHandle {
  handleChatStart: (recipientId: string, recipientName: string) => void;
}

export const ChatManager = forwardRef<ChatManagerHandle, ChatManagerProps>(({ eventId, eventStatus, openChat, onOpenChatConsumed }, ref) => {
  const { t, language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Make URL params the source of truth - derive state from URL
  const dmParam = searchParams.get('dm');
  const activeChannel = dmParam ? 'pair' : 'event';
  const [activeChats, setActiveChats] = useState<ActiveChat[]>(() => (
    dmParam ? [{ recipientId: dmParam, recipientName: t('chat.anonymous_user') }] : []
  ));
  
  const [messageText, setMessageText] = useState('');
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handledOpenChatRef = useRef<string | null>(null);
  const { nickname: nickData } = useNickname(eventId);
  const { count: joinedCount } = useJoinedParticipantCount(eventId);
  const { contacts: dmContacts, loading: loadingDMs } = useDMConversations(eventId);
  
  // Get locale for date-fns
  const dateLocale = language === 'it' ? it : enUS;
  
  // Auto-populate activeChats from existing DM conversations
  useEffect(() => {
    if (!loadingDMs && dmContacts.length > 0) {
      setActiveChats(prev => {
        const existingIds = new Set(prev.map(c => c.recipientId));
        const newChats = dmContacts
          .filter(c => !existingIds.has(c.participantId))
          .map(c => ({ recipientId: c.participantId, recipientName: c.displayName }));
        return [...prev, ...newChats];
      });
    }
  }, [dmContacts, loadingDMs]);
  
  // Determine which chat to use based on active channel
  const isEventChannel = activeChannel === 'event';
  const recipientId = isEventChannel ? undefined : dmParam;
  
  // Handle direct chat opening from external components (YourAssignment)
  useEffect(() => {
    if (openChat?.recipientId) {
      if (
        handledOpenChatRef.current === openChat.recipientId &&
        activeChats.some(chat => chat.recipientId === openChat.recipientId)
      ) {
        return;
      }

      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('dm', openChat.recipientId);
        params.set('tab', 'chat');
        return params;
      });
      setActiveChats(prev => {
        if (prev.some(chat => chat.recipientId === openChat.recipientId)) {
          return prev;
        }

        return [
          ...prev,
          {
            recipientId: openChat.recipientId,
            recipientName: openChat.recipientName || t('chat.anonymous_user'),
          },
        ];
      });
      onOpenChatConsumed?.();
      handledOpenChatRef.current = openChat.recipientId;
    }
  }, [activeChats, openChat, setSearchParams, onOpenChatConsumed, t]);

  // Sync activeChats when URL changes (for refresh/deep-link support)
  useEffect(() => {
    if (!dmParam) return;
    if (activeChats.some(chat => chat.recipientId === dmParam)) return;

    setActiveChats(prev => {
      if (prev.some(chat => chat.recipientId === dmParam)) {
        return prev;
      }

      return [
        ...prev,
        {
          recipientId: dmParam,
          recipientName: t('chat.anonymous_user'),
        },
      ];
    });
  }, [activeChats, dmParam, t]);
  
  
  const {
    messages,
    loading,
    sending,
    hasMore,
    sendMessage,
    loadMore,
    refetch
  } = useChat(
    eventId, 
    activeChannel,
    recipientId
  );

  const handleChatStart = (recipientId: string, recipientName?: string) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      params.set('dm', recipientId);
      params.set('tab', 'chat');
      return params;
    });
    const existingChat = activeChats.find(chat => chat.recipientId === recipientId);
    if (!existingChat) {
      const newChat: ActiveChat = {
        recipientId,
        recipientName: recipientName || t('chat.anonymous_user'),
      };
      setActiveChats(prev => [...prev, newChat]);
    }
  };

  const handleCloseChat = (recipientId: string) => {
    setActiveChats(prev => prev.filter(chat => chat.recipientId !== recipientId));
    // Switch to event channel if closing active chat
    if (dmParam === recipientId) {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.delete('dm');
        return params;
      });
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'event') {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.delete('dm');
        return params;
      });
    } else {
      const recipientId = value.replace('pair-', '');
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('dm', recipientId);
        params.set('tab', 'chat');
        return params;
      });
    }
  };

  useImperativeHandle(ref, () => ({
    handleChatStart
  }));

  const canUsePairChat = true; // Private chat is always available

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

    // Prevent sending in private chat without a nickname
    if (!isEventChannel && !nickData?.nickname) {
      toast.error(t('chat.set_nickname_error'));
      return;
    }

    const success = await sendMessage(messageText);
    if (success) {
      setMessageText('');
      inputRef.current?.focus();
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    scrollToBottom();
  }, [messages]);

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm', { locale: dateLocale });
  };

  const formatMessageDate = (timestamp: string) => {
    return format(new Date(timestamp), 'dd MMM', { locale: dateLocale });
  };

  const groupMessagesByDate = (messages: any[]) => {
    const groups: { [key: string]: any[] } = {};
    messages.forEach(msg => {
      const date = formatMessageDate(msg.created_at);
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="space-y-6">
      {/* Nickname Manager */}
      <NicknameManager eventId={eventId} compact />

      {/* Chat Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              {t('chat.event_chat')}
            </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowRecipientSelector(true)}
                className="flex items-center gap-2 touch-target focus-ring"
                disabled={joinedCount < 2}
                aria-label={t('chat.start_private_chat')}
              >
              <Plus className="w-4 h-4" />
              {t('chat.new_chat')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeChannel === 'event' ? 'event' : `pair-${dmParam}`} onValueChange={handleTabChange}>
            <div className="px-6 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="grid grid-cols-1 sm:auto-cols-max sm:grid-flow-col">
                  <TabsTrigger value="event" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('chat.general_chat')}
                  </TabsTrigger>
                </TabsList>

                {activeChats.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 touch-target focus-ring"
                        aria-label={t('chat.private_chats')}
                      >
                        <Glasses className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">
                          {dmParam ? activeChats.find(chat => chat.recipientId === dmParam)?.recipientName : t('chat.private_chats')}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Glasses className="w-4 h-4" />
                        {t('chat.private_chats')}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {activeChats.map(chat => (
                        <DropdownMenuItem
                          key={chat.recipientId}
                          onSelect={(e) => {
                            e.preventDefault();
                            setSearchParams({ dm: chat.recipientId });
                          }}
                          className="flex items-center gap-2"
                        >
                          <Glasses className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate flex-1">{chat.recipientName}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="touch-target hover:bg-destructive/20 hover:text-destructive focus-ring"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCloseChat(chat.recipientId);
                            }}
                            aria-label={t('chat.close_chat_with').replace('{name}', chat.recipientName)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button variant="outline" size="sm" disabled className="flex items-center gap-2">
                    <Glasses className="w-4 h-4" />
                    {t('chat.no_active_private_chats')}
                  </Button>
                )}
              </div>
            </div>

            <TabsContent value="event" className="mt-0">
              <div className="flex flex-col h-[500px]">
                {/* Messages Area */}
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
                    {loading && messages.length === 0 && (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
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
                    )}
                    {hasMore && (
                      <div className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={loadMore} 
                          disabled={loading}
                          className="focus-ring" 
                          aria-label={t('chat.load_previous')}
                        >
                          <ChevronUp className="w-4 h-4 mr-2" />
                          {t('chat.load_previous')}
                        </Button>
                      </div>
                    )}

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
                                  {message.alias_snapshot || t('chat.anonymous')}
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

                    {messages.length === 0 && !loading && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('chat.no_messages')}</p>
                        <p className="text-sm">{t('chat.start_conversation')}</p>
                      </div>
                    )}

                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="border-t bg-background/50 p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t('chat.placeholder')}
                      maxLength={500}
                      disabled={sending}
                    />
                    <Button type="submit" disabled={!messageText.trim() || sending} className="touch-target focus-ring" aria-label={t('chat.send_message')}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </TabsContent>

            {/* Render TabsContent for each active chat */}
            {activeChats.map(chat => (
              <TabsContent key={chat.recipientId} value={`pair-${chat.recipientId}`} className="mt-0">
                <div className="flex flex-col h-[500px]">
                  {/* Private Messages Area */}
                  <ScrollArea className="flex-1 px-6">
                    <div className="space-y-4 pb-4">
                      {loading && messages.length === 0 && (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-3 mb-4 animate-pulse">
                              <div className="w-8 h-8 rounded-full bg-muted"></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="h-4 bg-muted rounded w-20"></div>
                                  <div className="h-3 bg-muted rounded w-12"></div>
                                </div>
                                <div className="h-8 bg-muted rounded-lg w-2/3"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasMore && (
                        <div className="text-center">
                          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                            <ChevronUp className="w-4 h-4 mr-2" />
                            {t('chat.load_previous')}
                          </Button>
                        </div>
                      )}

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
                                    {message.alias_snapshot || t('chat.anonymous')}
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

                      {messages.length === 0 && !loading && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>{t('chat.no_private_messages')}</p>
                          <p className="text-sm">{t('chat.start_anonymous')}</p>
                        </div>
                      )}

                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>

                  {/* Private Message Input */}
                  <div className="border-t bg-background/50 p-4">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder={t('chat.private_placeholder').replace('{nickname}', nickData?.nickname ?? t('chat.set_nickname'))}
                        maxLength={500}
                        disabled={sending || !nickData?.nickname}
                      />
                      <Button 
                        type="submit" 
                        disabled={!messageText.trim() || sending || !nickData?.nickname}
                        className="touch-target focus-ring"
                        aria-label={t('chat.send_message')}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Recipient Selector Modal */}
      <ChatRecipientSelector
        eventId={eventId}
        isOpen={showRecipientSelector}
        onOpenChange={setShowRecipientSelector}
        onChatStart={handleChatStart}
      />
    </div>
  );
});