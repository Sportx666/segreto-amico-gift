import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChat } from '@/hooks/useChat';
import { useNickname } from '@/hooks/useNickname';
import { useJoinedParticipantCount } from '@/hooks/useJoinedParticipantCount';
import { NicknameManager } from './NicknameManager';
import { ChatRecipientSelector } from './ChatRecipientSelector';
import { MessageCircle, Users, Heart, Send, ChevronUp, Plus, X, Glasses} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
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
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Make URL params the source of truth - derive state from URL
  const dmParam = searchParams.get('dm');
  const activeChannel = dmParam ? 'pair' : 'event';
  const [activeChats, setActiveChats] = useState<ActiveChat[]>(() => (
    dmParam ? [{ recipientId: dmParam, recipientName: 'Utente Anonimo' }] : []
  ));
  
  const [messageText, setMessageText] = useState('');
  const [showRecipientSelector, setShowRecipientSelector] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { nickname: nickData } = useNickname(eventId);
  const { count: joinedCount } = useJoinedParticipantCount(eventId);
  
  // Determine which chat to use based on active channel
  const isEventChannel = activeChannel === 'event';
  const recipientId = isEventChannel ? undefined : dmParam;
  
  // Handle direct chat opening from external components (YourAssignment)
  useEffect(() => {
    if (openChat?.recipientId) {
      setSearchParams({ dm: openChat.recipientId });
      const existingChat = activeChats.find(chat => chat.recipientId === openChat.recipientId);
      if (!existingChat) {
        setActiveChats(prev => [...prev, {
          recipientId: openChat.recipientId,
          recipientName: openChat.recipientName || 'Utente Anonimo'
        }]);
      }
      onOpenChatConsumed?.();
    }
  }, [openChat, setSearchParams, onOpenChatConsumed]);
  
  // Sync activeChats when URL changes (for refresh/deep-link support)
  useEffect(() => {
    if (dmParam && !activeChats.find(chat => chat.recipientId === dmParam)) {
      setActiveChats(prev => [...prev, {
        recipientId: dmParam,
        recipientName: 'Utente Anonimo'
      }]);
    }
  }, [dmParam]);
  
  
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
    setSearchParams({ dm: recipientId });
    const existingChat = activeChats.find(chat => chat.recipientId === recipientId);
    if (!existingChat) {
      const newChat: ActiveChat = {
        recipientId,
        recipientName: recipientName || 'Utente Anonimo',
      };
      setActiveChats(prev => [...prev, newChat]);
    }
  };

  const handleCloseChat = (recipientId: string) => {
    setActiveChats(prev => prev.filter(chat => chat.recipientId !== recipientId));
    // Switch to event channel if closing active chat
    if (dmParam === recipientId) {
      setSearchParams({});
    }
  };

  const handleTabChange = (value: string) => {
    if (value === 'event') {
      setSearchParams({});
    } else {
      const recipientId = value.replace('pair-', '');
      setSearchParams({ dm: recipientId });
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
      toast.error('Imposta il tuo nickname anonimo per inviare messaggi privati');
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
    return format(new Date(timestamp), 'HH:mm', { locale: it });
  };

  const formatMessageDate = (timestamp: string) => {
    return format(new Date(timestamp), 'dd MMM', { locale: it });
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
              Chat Evento
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowRecipientSelector(true)}
              className="flex items-center gap-2"
              disabled={joinedCount < 2}
            >
              <Plus className="w-4 h-4" />
              Nuova Chat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeChannel === 'event' ? 'event' : `pair-${dmParam}`} onValueChange={handleTabChange}>
            <div className="px-6 pb-4">
              <TabsList className={`grid ${activeChats.length === 0 ? 'grid-cols-1' : `grid-cols-${Math.min(activeChats.length + 1, 4)}`}`}>
                <TabsTrigger value="event" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Chat Generale
                </TabsTrigger>
                {activeChats.map(chat => (
                  <TabsTrigger 
                    key={chat.recipientId} 
                    value={`pair-${chat.recipientId}`}
                    className="flex items-center gap-2 relative"
                  >
                    <Glasses className="w-4 h-4" />
                    <span className="truncate max-w-20">{chat.recipientName}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseChat(chat.recipientId);
                      }}
                      className="h-auto w-auto p-0.5 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </TabsTrigger>
                ))}
              </TabsList>
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
                        <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                          <ChevronUp className="w-4 h-4 mr-2" />
                          Carica messaggi precedenti
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

                    {messages.length === 0 && !loading && (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nessun messaggio ancora.</p>
                        <p className="text-sm">Inizia la conversazione!</p>
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
                      placeholder="Scrivi un messaggio..."
                      maxLength={500}
                      disabled={sending}
                    />
                    <Button type="submit" disabled={!messageText.trim() || sending}>
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
                            Carica messaggi precedenti
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

                      {messages.length === 0 && !loading && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Nessun messaggio privato ancora.</p>
                          <p className="text-sm">Inizia la conversazione anonima!</p>
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
                        placeholder={`Messaggio privato come "${nickData?.nickname ?? 'imposta il tuo nickname'}"...`}
                        maxLength={500}
                        disabled={sending}
                      />
                      <Button type="submit" disabled={!messageText.trim() || sending}>
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

      {/* Recipient Selector Dialog */}
      <ChatRecipientSelector
        eventId={eventId}
        onChatStart={handleChatStart}
        isOpen={showRecipientSelector}
        onOpenChange={setShowRecipientSelector}
        disabled={joinedCount < 2}
      />
    </div>
  );
});
