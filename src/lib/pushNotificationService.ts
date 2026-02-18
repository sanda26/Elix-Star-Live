import { supabase } from './supabase';

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: any;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  platform: 'web' | 'ios' | 'android';
  createdAt: string;
}

export class PushNotificationService {
  private isSupported: boolean = false;
  private subscription: PushSubscription | null = null;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Request permission for push notifications
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }

    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      await this.subscribeToPush();
    }

    return permission;
  }

  /**
   * Subscribe to push notifications
   */
  private async subscribeToPush(): Promise<void> {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.ready;
      
      // Subscribe to push
      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
        ),
      });

      // Save subscription to backend
      await this.saveSubscriptionToBackend();
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Save push subscription to backend
   */
  private async saveSubscriptionToBackend(): Promise<void> {
    if (!this.subscription) {
      throw new Error('No subscription to save');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const subscriptionData = {
      user_id: user.id,
      token: JSON.stringify(this.subscription),
      platform: 'web' as const,
    };

    const { error } = await supabase
      .from('device_tokens')
      .upsert(subscriptionData, {
        onConflict: 'user_id,platform'
      });

    if (error) {
      console.error('Failed to save subscription:', error);
      throw error;
    }
  }

  /**
   * Send push notification (server-side)
   */
  async sendNotification(notification: PushNotification): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: notification
      });

      if (error) {
        console.error('Failed to send notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Show local notification (fallback)
   */
  showLocalNotification(notification: PushNotification): void {
    if (!('Notification' in window)) {
      return;
    }

    const notificationOptions: NotificationOptions = {
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/icon-192x192.png',
      tag: notification.tag,
      requireInteraction: notification.requireInteraction,
      data: notification.data,
    };

    if (notification.actions && notification.actions.length > 0) {
      // notificationOptions.actions = notification.actions; // Actions not supported in basic NotificationOptions
    }

    const notif = new Notification(notification.title, notificationOptions);

    // Handle notification clicks
    notif.onclick = () => {
      notif.close();
      // Handle navigation based on notification data
      if (notification.data?.url) {
        window.location.href = notification.data.url;
      }
    };
  }

  /**
   * Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<{
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission;
  }> {
    const permission = Notification.permission;
    
    return {
      isSupported: this.isSupported,
      isSubscribed: !!this.subscription,
      permission,
    };
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;

      // Remove from backend
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('device_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('platform', 'web');
      }
    }
  }

  /**
   * Create notification for different types
   */
  createFollowNotification(followerName: string, followerId: string): PushNotification {
    return {
      id: `follow_${followerId}_${Date.now()}`,
      userId: followerId,
      title: 'New Follower!',
      body: `${followerName} started following you`,
      icon: '/icon-192x192.png',
      tag: 'follow',
      data: {
        type: 'follow',
        followerId,
        url: `/profile/${followerId}`
      }
    };
  }

  createLikeNotification(videoTitle: string, likerName: string, videoId: string): PushNotification {
    return {
      id: `like_${videoId}_${Date.now()}`,
      userId: '', // Will be set by server
      title: 'New Like!',
      body: `${likerName} liked your video "${videoTitle}"`,
      icon: '/icon-192x192.png',
      tag: 'like',
      data: {
        type: 'like',
        videoId,
        url: `/video/${videoId}`
      }
    };
  }

  createCommentNotification(commentText: string, commenterName: string, videoId: string): PushNotification {
    return {
      id: `comment_${videoId}_${Date.now()}`,
      userId: '', // Will be set by server
      title: 'New Comment!',
      body: `${commenterName} commented: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
      icon: '/icon-192x192.png',
      tag: 'comment',
      data: {
        type: 'comment',
        videoId,
        url: `/video/${videoId}`
      }
    };
  }

  createGiftNotification(giftName: string, senderName: string, amount: number): PushNotification {
    return {
      id: `gift_${Date.now()}`,
      userId: '', // Will be set by server
      title: 'Gift Received!',
      body: `${senderName} sent you ${amount} coins with a ${giftName}!`,
      icon: '/icon-192x192.png',
      tag: 'gift',
      requireInteraction: true,
      data: {
        type: 'gift',
        amount,
        url: '/live' // Or current live stream
      }
    };
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();