// Push Notification Service (Firebase Cloud Messaging compatible)

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { trackEvent } from './analytics';

class NotificationService {
  private isInitialized = false;
  private deviceToken: string | null = null;
  private autoRemoveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Escape HTML to prevent XSS in banner innerHTML */
  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /** Only allow same-origin or relative URLs to prevent open redirects */
  private isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch {
      return false;
    }
  }

  /**
   * Initialize push notifications
   */
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not available on web');
      return;
    }

    if (this.isInitialized) return;

    try {
      // Request permission
      const permStatus = await PushNotifications.requestPermissions();

      if (permStatus.receive === 'granted') {
        // Register for push
        await PushNotifications.register();

        // Listen for token
        await PushNotifications.addListener('registration', this.handleRegistration.bind(this));

        // Listen for notification received
        await PushNotifications.addListener(
          'pushNotificationReceived',
          this.handleNotificationReceived.bind(this)
        );

        // Listen for notification action
        await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          this.handleNotificationAction.bind(this)
        );

        this.isInitialized = true;
        console.log('Push notifications initialized');
      } else {
        console.log('Push notification permission denied');
      }
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Handle device token registration
   */
  private async handleRegistration(token: Token) {
    console.log('Push registration success, token:', token.value);
    this.deviceToken = token.value;

    // Save token to backend
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      await supabase.from('device_tokens').upsert({
        user_id: userData.user.id,
        token: token.value,
        platform: Capacitor.getPlatform(),
        updated_at: new Date().toISOString(),
      });

      trackEvent('push_token_registered', { platform: Capacitor.getPlatform() });
    } catch (error) {
      console.error('Failed to save device token:', error);
    }
  }

  /**
   * Handle notification received while app is in foreground
   */
  private handleNotificationReceived(notification: PushNotificationSchema) {
    console.log('Push notification received:', notification);

    // Show in-app notification banner
    this.showInAppNotification(notification);

    trackEvent('notification_received', {
      title: notification.title,
      foreground: true,
    });
  }

  /**
   * Handle notification tap/action
   */
  private handleNotificationAction(action: any) {
    console.log('Push notification action:', action);

    const notification = action.notification;
    const data = notification.data;

    trackEvent('notification_tap', {
      title: notification.title,
      action_url: data?.action_url,
    });

    // Navigate based on notification data (only same-origin)
    if (data?.action_url && this.isSafeUrl(data.action_url)) {
      window.location.href = data.action_url;
    }
  }

  /**
   * Show in-app notification banner
   */
  private showInAppNotification(notification: PushNotificationSchema) {
    // Create temporary notification element
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-4 right-4 bg-black/90 backdrop-blur-sm rounded-2xl p-4 shadow-2xl z-50 animate-slide-down';
    const safeTitle = this.escapeHtml(notification.title || '');
    const safeBody = this.escapeHtml(notification.body || '');
    banner.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 bg-[#E6B36A] rounded-full flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-white mb-1">${safeTitle}</p>
          <p class="text-sm text-white/80">${safeBody}</p>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Auto-remove after 5 seconds, track timer for cleanup
    if (this.autoRemoveTimer) clearTimeout(this.autoRemoveTimer);
    this.autoRemoveTimer = setTimeout(() => {
      banner.remove();
      this.autoRemoveTimer = null;
    }, 5000);

    // Remove on click
    banner.addEventListener('click', () => {
      banner.remove();
      if (this.autoRemoveTimer) { clearTimeout(this.autoRemoveTimer); this.autoRemoveTimer = null; }
      const actionUrl = notification.data?.action_url;
      if (actionUrl && this.isSafeUrl(actionUrl)) {
        window.location.href = actionUrl;
      }
    });
  }

  /**
   * Request notification permission (for web)
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Show local notification (for web)
   */
  showLocalNotification(title: string, body: string, actionUrl?: string) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    const notification = new Notification(title, {
      body,
      icon: '/apple-touch-icon.svg',
      badge: '/favicon.svg',
      tag: 'elixstar-notification',
    });

    notification.onclick = () => {
      if (actionUrl) {
        window.location.href = actionUrl;
      }
      notification.close();
    };

    trackEvent('local_notification_show', { title });
  }
}

export const notificationService = new NotificationService();
