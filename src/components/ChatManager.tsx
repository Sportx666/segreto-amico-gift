import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChat } from '@/hooks/useChat';
import { NicknameManager } from './NicknameManager';
import { MessageCircle, Users, Heart, Send, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface ChatManagerProps {
  eventId: string;
  eventStatus: string;
}

export function ChatManager({ eventId, eventStatus }: ChatManagerProps) {
  const [activeChannel, setActiveChannel] = useState<'event' | 'pair'>('event');
  const [messageText, setMessageText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    loading,
    sending,
    hasMore,
    sendMessage,
    loadMore
  } = useChat(eventId, activeChannel);

  const canUsePairChat = true; // Private chat is always available

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;

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
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Chat Evento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as 'event' | 'pair')}>
            <div className="px-6 pb-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="event" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Chat Generale
                </TabsTrigger>
                <TabsTrigger value="pair" className="flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Chat Privata
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="event" className="mt-0">
              <div className="flex flex-col h-[500px]">
                {/* Messages Area */}
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
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

            <TabsContent value="pair" className="mt-0">
              <div className="flex flex-col h-[500px]">
                {/* Pair Messages Area */}
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
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
                        <p className="text-sm">Chatta con il tuo Amico Segreto!</p>
                      </div>
                    )}

                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Pair Message Input */}
                <div className="border-t bg-background/50 p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Messaggio privato al tuo Amico Segreto..."
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
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}