import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { 
  isPushSupported, 
  registerPushNotifications, 
  savePushToken, 
  setupPushListeners,
  unregisterPushNotifications,
  getStoredPushToken,
  deletePushToken,
  PushNotificationState 
} from '@/lib/pushNotifications';
import { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isRegistered: false,
    token: null,
  });
  const [loading, setLoading] = useState(false);

  // Check if push is supported on mount
  useEffect(() => {
    const isSupported = isPushSupported();
    setState(prev => ({ ...prev, isSupported }));

    if (user?.id && isSupported) {
      // Check async if token exists
      getStoredPushToken(user.id).then(existingToken => {
        if (existingToken) {
          setState(prev => ({ 
            ...prev, 
            isRegistered: true, 
            token: existingToken 
          }));
        }
      });
    }
  }, [user?.id]);

  // Handle notification received while app is open
  const handleNotificationReceived = useCallback((notification: PushNotificationSchema) => {
    // Show in-app toast for notifications received while app is open
    toast.info(notification.title || 'New notification', {
      description: notification.body,
    });
  }, []);

  // Handle notification action (user tapped on notification)
  const handleNotificationAction = useCallback((action: ActionPerformed) => {
    const data = action.notification.data;
    
    // Navigate based on notification data
    if (data?.eventId) {
      if (data.type === 'chat' && data.privateChatId) {
        navigate(`/events/${data.eventId}?tab=chat&thread=${data.privateChatId}`);
      } else if (data.type === 'chat') {
        navigate(`/events/${data.eventId}?tab=chat`);
      } else if (data.type === 'assignment') {
        navigate(`/events/${data.eventId}?tab=sorteggio`);
      } else {
        navigate(`/events/${data.eventId}`);
      }
    }
  }, [navigate]);

  // Setup listeners when component mounts
  useEffect(() => {
    if (!state.isSupported) return;

    const cleanup = setupPushListeners(
      handleNotificationReceived,
      handleNotificationAction
    );

    return cleanup;
  }, [state.isSupported, handleNotificationReceived, handleNotificationAction]);

  // Register for push notifications
  const register = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !state.isSupported) return false;

    setLoading(true);
    try {
      const token = await registerPushNotifications();
      
      if (token) {
        const saved = await savePushToken(user.id, token);
        if (saved) {
          setState(prev => ({ 
            ...prev, 
            isRegistered: true, 
            token 
          }));
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, state.isSupported]);

  // Unregister from push notifications
  const unregister = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    try {
      await unregisterPushNotifications();
      await deletePushToken(user.id);
      setState(prev => ({ 
        ...prev, 
        isRegistered: false, 
        token: null 
      }));
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }, [user?.id]);

  return {
    ...state,
    loading,
    register,
    unregister,
  };
}
