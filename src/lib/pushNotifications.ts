import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export interface PushNotificationState {
  isSupported: boolean;
  isRegistered: boolean;
  token: string | null;
}

// Check if push notifications are supported on this platform
export const isPushSupported = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
};

// Request permission and register for push notifications
export const registerPushNotifications = async (): Promise<string | null> => {
  if (!isPushSupported()) {
    console.log('Push notifications not supported on this platform');
    return null;
  }

  try {
    // Check current permission status
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    
    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Register with the native push notification service
    await PushNotifications.register();

    // Wait for registration token
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token:', token.value);
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        resolve(null);
      });

      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10000);
    });
  } catch (error) {
    console.error('Error registering push notifications:', error);
    return null;
  }
};

// Save the push token to the user's profile in the database
export const savePushToken = async (userId: string, token: string): Promise<boolean> => {
  try {
    const platform = Capacitor.getPlatform();
    
    // Save to Supabase push_tokens table
    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          profile_id: userId,
          token,
          platform,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'profile_id,token' }
      );

    if (error) {
      console.error('Error saving push token to database:', error);
      return false;
    }
    
    console.log(`Push token saved for user ${userId} on ${platform}`);
    return true;
  } catch (error) {
    console.error('Error saving push token:', error);
    return false;
  }
};

// Setup push notification listeners
export const setupPushListeners = (
  onNotificationReceived?: (notification: PushNotificationSchema) => void,
  onNotificationAction?: (action: ActionPerformed) => void
): (() => void) => {
  if (!isPushSupported()) {
    return () => {};
  }

  const receivedListener = PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      onNotificationReceived?.(notification);
    }
  );

  const actionListener = PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      onNotificationAction?.(action);
    }
  );

  // Return cleanup function
  return () => {
    receivedListener.then(l => l.remove());
    actionListener.then(l => l.remove());
  };
};

// Unregister from push notifications
export const unregisterPushNotifications = async (): Promise<void> => {
  if (!isPushSupported()) return;
  
  try {
    await PushNotifications.removeAllListeners();
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
};

// Get the current push notification token from storage
export const getStoredPushToken = async (userId: string): Promise<string | null> => {
  try {
    const { data } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('profile_id', userId)
      .limit(1)
      .maybeSingle();
    
    return data?.token || null;
  } catch {
    return null;
  }
};

// Check if push notifications are enabled for the current user
export const isPushEnabled = async (userId: string): Promise<boolean> => {
  const token = await getStoredPushToken(userId);
  return !!token;
};

// Delete push token from database
export const deletePushToken = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('profile_id', userId);

    if (error) {
      console.error('Error deleting push token:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting push token:', error);
    return false;
  }
};
