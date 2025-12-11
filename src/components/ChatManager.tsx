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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChat } from '@/hooks/useChat';
import { useNickname } from '@/hooks/useNickname';
import { useJoinedParticipantCount } from '@/hooks/useJoinedParticipantCount';
import { usePrivateChats, PrivateChat } from '@/hooks/usePrivateChats';
import { useI18n } from '@/i18n';
import { NicknameManager } from './NicknameManager';
import { ChatRecipientSelector } from './ChatRecipientSelector';
import { MessageCircle, Users, Heart, Send, ChevronUp, Plus, X, Glasses } from 'lucide-react';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

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
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // URL params as source of truth
  const threadParam = searchParams.get('thread');
  
  const [messageText, setMessageText] = useState('');
  const [privateMenuOpen, setPrivateMenuOpen] = useState(false);
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const [pendingRecipient, setPendingRecipient] = useState<{ id: string; name: string } | null>(null);
  
  // Determine active channel based on thread param or pending recipient
  const activeChannel = (threadParam || pendingRecipient) ? 'pair' : 'event';
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handledOpenChatRef = useRef<string | null>(null);
  
  const { nickname: nickData } = useNickname(eventId);
  const { count: joinedCount } = useJoinedParticipantCount(eventId);
  const { chats: privateChats, loading: loadingChats } = usePrivateChats(eventId);
  
  const dateLocale = language === 'it' ? it : enUS;

  // Find the active private chat from the thread param
  const activePrivateChat = threadParam 
    ? privateChats.find(c => c.id === threadParam) 
    : null;

  // Handle direct chat opening from external components
  useEffect(() => {
    if (openChat?.recipientId) {
      if (handledOpenChatRef.current === openChat.recipientId) {
        return;
      }

      // Check if there's already a chat with this recipient where we're anonymous
      const existingChat = privateChats.find(
        c => c.otherParticipantId === openChat.recipientId && c.myRole === 'anonymous'
      );

      if (existingChat) {
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.set('thread', existingChat.id);
          params.set('tab', 'chat');
          return params;
        });
      } else {
        // Set pending recipient - chat will be created on first message
        setPendingRecipient({ 
          id: openChat.recipientId, 
          name: openChat.recipientName || t('chat.anonymous_user') 
        });
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.delete('thread');
          params.set('tab', 'chat');
          return params;
        });
      }
      
      onOpenChatConsumed?.();
      handledOpenChatRef.current = openChat.recipientId;
    }
  }, [openChat, privateChats, setSearchParams, onOpenChatConsumed, t]);

  // Determine chat options based on active state
  const chatOptions = activeChannel === 'event' 
    ? { eventId, channel: 'event' as const }
    : threadParam
      ? { eventId, channel: 'pair' as const, privateChatId: threadParam }
      : pendingRecipient
        ? { eventId, channel: 'pair' as const, recipientId: pendingRecipient.id }
        : { eventId, channel: 'event' as const };
  
  const {
    messages,
    loading,
    sending,
    hasMore,
    sendMessage,
    loadMore,
    currentChatId,
  } = useChat(chatOptions);

  // If a chat was created (from pending recipient), update URL
  useEffect(() => {
    if (currentChatId && pendingRecipient && !threadParam) {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('thread', currentChatId);
        params.set('tab', 'chat');
        return params;
      });
      setPendingRecipient(null);
    }
  }, [currentChatId, pendingRecipient, threadParam, setSearchParams]);

  const handleChatStart = async (recipientId: string, recipientName?: string) => {
    // Check if a chat already exists with this recipient where we're anonymous
    const existingChat = privateChats.find(
      c => c.otherParticipantId === recipientId && c.myRole === 'anonymous'
    );

    if (existingChat) {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('thread', existingChat.id);
        params.set('tab', 'chat');
        return params;
      });
    } else {
      // Create new private chat immediately
      try {
        // Get current user's participant ID
        const { data: myParticipant } = await supabase
          .from('participants')
          .select('id')
          .eq('profile_id', user?.id)
          .single();

        if (!myParticipant) {
          toast.error(t('chat.error_creating_chat'));
          return;
        }

        // Get my alias for this event
        const { data: alias } = await supabase
          .from('anonymous_aliases')
          .select('nickname')
          .eq('event_id', eventId)
          .eq('participant_id', myParticipant.id)
          .single();

        if (!alias?.nickname) {
          toast.error(t('chat.set_nickname_error'));
          return;
        }

        // Check if chat already exists (race condition protection)
        const { data: existingChatCheck } = await supabase
          .from('private_chats')
          .select('id')
          .eq('event_id', eventId)
          .eq('anonymous_participant_id', myParticipant.id)
          .eq('exposed_participant_id', recipientId)
          .maybeSingle();

        let chatId: string;

        if (existingChatCheck) {
          chatId = existingChatCheck.id;
        } else {
          // Create new private chat
          const { data: newChat, error: createError } = await supabase
            .from('private_chats')
            .insert({
              event_id: eventId,
              anonymous_participant_id: myParticipant.id,
              anonymous_alias: alias.nickname,
              exposed_participant_id: recipientId,
              exposed_name: recipientName || t('chat.anonymous_user'),
            })
            .select()
            .single();

          if (createError || !newChat) {
            console.error('Error creating private chat:', createError);
            toast.error(t('chat.error_creating_chat'));
            return;
          }

          chatId = newChat.id;
        }

        // Navigate to the new chat
        setSearchParams((current) => {
          const params = new URLSearchParams(current);
          params.set('thread', chatId);
          params.set('tab', 'chat');
          return params;
        });
      } catch (error) {
        console.error('Error in handleChatStart:', error);
        toast.error(t('chat.error_creating_chat'));
      }
    }
  };

  const handleCloseChat = (chatId: string) => {
    if (threadParam === chatId) {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.delete('thread');
        return params;
      });
    }
    if (pendingRecipient) {
      setPendingRecipient(null);
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'event') {
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.delete('thread');
        return params;
      });
      setPendingRecipient(null);
    } else {
      const chatId = value.replace('pair-', '');
      setSearchParams((current) => {
        const params = new URLSearchParams(current);
        params.set('thread', chatId);
        params.set('tab', 'chat');
        return params;
      });
    }
  };

  useImperativeHandle(ref, () => ({
    handleChatStart
  }));

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

    // Prevent sending in private chat without a nickname
    if (activeChannel === 'pair' && !nickData?.nickname) {
      toast.error(t('chat.set_nickname_error'));
      return;
    }

    const result = await sendMessage(messageText);
    if (result.success) {
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

  // Get display name for current private context
  const getCurrentDisplayName = () => {
    if (activePrivateChat) {
      return activePrivateChat.displayName;
    }
    if (pendingRecipient) {
      return pendingRecipient.name;
    }
    return t('chat.anonymous_user');
  };

  // Get current role indicator
  const getCurrentRoleLabel = () => {
    if (activePrivateChat) {
      return activePrivateChat.myRole === 'anonymous' 
        ? t('chat.you_are_anonymous')
        : t('chat.you_are_visible');
    }
    if (pendingRecipient) {
      return t('chat.you_are_anonymous');
    }
    return '';
  };

  const renderMessageList = () => (
    <>
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
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loading} className="focus-ring">
            <ChevronUp className="w-4 h-4 mr-2" />
            {t('chat.load_previous')}
          </Button>
        </div>
      )}

      {Object.entries(messageGroups).map(([date, dayMessages]) => (
        <div key={date}>
          <div className="text-center my-4">
            <Badge variant="outline" className="text-xs">{date}</Badge>
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
          {activeChannel === 'event' ? (
            <>
              <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('chat.no_messages')}</p>
              <p className="text-sm">{t('chat.start_conversation')}</p>
            </>
          ) : (
            <>
              <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('chat.no_private_messages')}</p>
              <p className="text-sm">{t('chat.start_anonymous')}</p>
            </>
          )}
        </div>
      )}

      <div ref={scrollRef} />
    </>
  );

  const renderMessageInput = () => {
    const isPairMode = activeChannel === 'pair';
    const needsNickname = isPairMode && !nickData?.nickname;
    
    return (
      <div className="border-t bg-background/50 p-4">
        {isPairMode && (
          <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
            <Glasses className="w-3 h-3" />
            {getCurrentRoleLabel()}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={
              isPairMode 
                ? t('chat.private_placeholder').replace('{nickname}', nickData?.nickname ?? t('chat.set_nickname'))
                : t('chat.placeholder')
            }
            maxLength={500}
            disabled={sending || needsNickname}
          />
          <Button 
            type="submit" 
            disabled={!messageText.trim() || sending || needsNickname}
            className="touch-target focus-ring"
            aria-label={t('chat.send_message')}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    );
  };

  // Build list of chats for the dropdown
  const chatList = [
    ...privateChats,
    ...(pendingRecipient && !privateChats.some(c => c.otherParticipantId === pendingRecipient.id && c.myRole === 'anonymous')
      ? [{ 
          id: 'pending', 
          displayName: pendingRecipient.name, 
          myRole: 'anonymous' as const,
          otherParticipantId: pendingRecipient.id,
        }] 
      : [])
  ];

  const activeTabValue = activeChannel === 'event' 
    ? 'event' 
    : threadParam 
      ? `pair-${threadParam}`
      : pendingRecipient 
        ? 'pair-pending'
        : 'event';

  return (
    <div className="space-y-6">
      <NicknameManager eventId={eventId} compact />

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
          <Tabs value={activeTabValue} onValueChange={handleTabChange}>
            <div className="px-6 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="grid grid-cols-1 sm:auto-cols-max sm:grid-flow-col">
                  <TabsTrigger value="event" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('chat.general_chat')}
                  </TabsTrigger>
                </TabsList>

                {chatList.length > 0 ? (
                  <DropdownMenu open={privateMenuOpen} onOpenChange={setPrivateMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 touch-target focus-ring"
                        aria-label={t('chat.private_chats')}
                      >
                        <Glasses className="w-4 h-4" />
                        <span className="truncate max-w-[150px]">
                          {activeChannel === 'pair' ? getCurrentDisplayName() : t('chat.private_chats')}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {chatList.map(chat => (
                        <DropdownMenuItem
                          key={chat.id}
                          onSelect={() => {
                            if (chat.id === 'pending') {
                              // Already in pending state
                            } else {
                              setSearchParams({ thread: chat.id, tab: 'chat' });
                            }
                            setPrivateMenuOpen(false);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Glasses className="w-4 h-4 text-muted-foreground" />
                          <div className="flex-1 truncate">
                            <span>{chat.displayName}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {chat.myRole === 'anonymous' ? `(${t('chat.anonymous')})` : `(${t('chat.visible')})`}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive focus-ring"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCloseChat(chat.id);
                              setPrivateMenuOpen(false);
                            }}
                            aria-label={t('chat.close_chat_with').replace('{name}', chat.displayName)}
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
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
                    {renderMessageList()}
                  </div>
                </ScrollArea>
                {renderMessageInput()}
              </div>
            </TabsContent>

            {/* Render TabsContent for each private chat */}
            {chatList.map(chat => (
              <TabsContent key={chat.id} value={`pair-${chat.id}`} className="mt-0">
                <div className="flex flex-col h-[500px]">
                  <ScrollArea className="flex-1 px-6">
                    <div className="space-y-4 pb-4">
                      {renderMessageList()}
                    </div>
                  </ScrollArea>
                  {renderMessageInput()}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      <ChatRecipientSelector
        eventId={eventId}
        isOpen={showRecipientSelector}
        onOpenChange={setShowRecipientSelector}
        onChatStart={handleChatStart}
      />
    </div>
  );
});
