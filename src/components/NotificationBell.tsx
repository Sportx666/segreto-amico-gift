import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { useI18n } from '@/i18n';
import { Bell, Check, CheckCheck, Clock, Gift, MessageCircle, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const typeIcons = {
  assignment: Gift,
  event: CalendarDays,
  chat: MessageCircle,
};

const typeColors = {
  assignment: 'text-primary',
  event: 'text-blue-500',
  chat: 'text-green-500',
};

export function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  
  const dateLocale = language === 'it' ? it : enUS;

  const handleNotificationClick = async (notificationId: string, isRead: boolean, notification: any) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
    
    // Navigate based on notification type and event_id
    const eventId = notification.event_id;
    
    if (notification.type === 'assignment' && eventId) {
      // Navigate to event's assignment tab
      navigate(`/events/${eventId}?tab=assegnazione`);
    } else if (notification.type === 'chat' && eventId) {
      // Navigate to event's chat tab
      if (notification.recipient_participant_id) {
        // DM notification - open specific DM conversation
        navigate(`/events/${eventId}?tab=chat&dm=${notification.recipient_participant_id}`);
      } else {
        // Event chat notification
        navigate(`/events/${eventId}?tab=chat`);
      }
    } else if (notification.type === 'event' && eventId) {
      // Navigate to event page
      navigate(`/events/${eventId}`);
    } else {
      // Fallback to events list
      navigate('/events');
    }
    
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount > 0) {
      await markAllAsRead();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">{t('notifications.title')}</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              {t('notifications.mark_all_read')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-96">
          {loading ? (
            <div className="flex items-center justify-center p-4 text-muted-foreground">
              <Clock className="w-4 h-4 mr-2" />
              {t('notifications.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-50" />
              <p>{t('notifications.no_notifications')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const IconComponent = typeIcons[notification.type];
                const isRead = !!notification.read_at;
                
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      !isRead && "bg-blue-50/50 border-l-2 border-l-primary"
                    )}
                    onClick={() => handleNotificationClick(notification.id, isRead, notification)}
                  >
                    <div className="flex gap-3">
                      <div className={cn("mt-0.5", typeColors[notification.type])}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h5 className={cn(
                            "text-sm font-medium leading-tight",
                            !isRead && "font-semibold"
                          )}>
                            {notification.title}
                          </h5>
                          
                          {!isRead && (
                            <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mt-1 leading-tight">
                          {notification.body}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <time className="text-xs text-muted-foreground">
                            {format(new Date(notification.created_at), 'dd MMM, HH:mm', { locale: dateLocale })}
                          </time>
                          
                          {isRead && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Check className="w-3 h-3" />
                              {t('notifications.read')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
