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
    // Store token in a push_tokens table or profiles table
    // For now, we'll use localStorage as a simple solution
    // In production, you'd want to store this server-side
    const platform = Capacitor.getPlatform();
    const tokenKey = `push_token_${userId}`;
    
    const existingToken = localStorage.getItem(tokenKey);
    if (existingToken === token) {
      return true; // Token already saved
    }

    localStorage.setItem(tokenKey, token);
    localStorage.setItem(`push_platform_${userId}`, platform);
    
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
export const getStoredPushToken = (userId: string): string | null => {
  return localStorage.getItem(`push_token_${userId}`);
};

// Check if push notifications are enabled for the current user
export const isPushEnabled = (userId: string): boolean => {
  return !!getStoredPushToken(userId);
};
