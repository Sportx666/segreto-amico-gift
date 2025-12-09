import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';

interface Notification {
  id: string;
  type: 'assignment' | 'event' | 'chat';
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  event_id?: string | null;
  recipient_participant_id?: string | null;
}

interface NotificationSettings {
  profile_id: string;
  in_app: boolean;
  email_assignment: boolean;
  email_chat_digest: boolean;
  updated_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data as Notification[] || []);
      setUnreadCount(data?.filter(n => !n.read_at).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error(t('toasts.load_notifications_error'));
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('profile_id', user.id);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error(t('toasts.update_notification_error'));
      return false;
    }
  };

  const markAllAsRead = async () => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('profile_id', user.id)
        .is('read_at', null);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      
      setUnreadCount(0);
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error(t('toasts.update_notifications_error'));
      return false;
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Set up real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `profile_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new notification
          toast.info(newNotification.title, {
            description: newNotification.body,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications
  };
}

export function useNotificationSettings() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // No settings found, create default ones
        const { data: newSettings, error: insertError } = await supabase
          .from('notification_settings')
          .insert({
            profile_id: user.id,
            in_app: true,
            email_assignment: true,
            email_chat_digest: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newSettings;
      } else if (error) {
        throw error;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error(t('toasts.load_settings_error'));
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<Omit<NotificationSettings, 'profile_id' | 'updated_at'>>) => {
    if (!user || !settings) return false;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('profile_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setSettings(data);
      toast.success(t('toasts.settings_updated'));
      return true;
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast.error(t('toasts.update_settings_error'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [user]);

  return {
    settings,
    loading,
    saving,
    updateSettings,
    refetch: fetchSettings
  };
}
