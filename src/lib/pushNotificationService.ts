/**
 * Push Notification Service — Hetzner backend.
 *
 * Device token registration and push subscription management now goes through
 * the Hetzner Node/Fastify backend (POST /api/device-tokens).
 * No Supabase / Appwrite / any third-party DB required.
 */

import { apiUrl } from "./api";
import { useAuthStore } from "../store/useAuthStore";

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
  platform: "web" | "ios" | "android";
  createdAt: string;
}

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function getCurrentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PushNotificationService {
  private isSupported: boolean = false;
  private subscription: PushSubscription | null = null;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    this.isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
  }

  /**
   * Request permission for push notifications and subscribe if granted.
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) return "denied";

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      await this.subscribeToPush();
    }

    return permission;
  }

  /**
   * Subscribe to the browser push manager and save the subscription on
   * the Hetzner backend.
   */
  private async subscribeToPush(): Promise<void> {
    if (!this.isSupported) {
      throw new Error("Push notifications not supported in this browser");
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "")
        .toString()
        .trim();

      if (!vapidKey) {
        console.warn(
          "[PushNotificationService] VITE_VAPID_PUBLIC_KEY not set — skipping push subscription",
        );
        return;
      }

      this.subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey),
      });

      await this.saveSubscriptionToBackend();
    } catch (error) {
      console.error("[PushNotificationService] Subscribe failed:", error);
      throw error;
    }
  }

  /**
   * Save the Web Push subscription to the Hetzner backend
   * (POST /api/device-tokens).
   */
  private async saveSubscriptionToBackend(): Promise<void> {
    if (!this.subscription) {
      throw new Error("No push subscription to save");
    }

    const userId = getCurrentUserId();
    if (!userId) {
      throw new Error("User not authenticated — cannot register push token");
    }

    const res = await fetch(apiUrl("/api/device-tokens"), {
      method: "POST",
      headers: getAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({
        userId,
        token: JSON.stringify(this.subscription),
        platform: "web",
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        err.error ?? `Failed to register push token (${res.status})`,
      );
    }
  }

  /**
   * Send a push notification via the Hetzner backend
   * (POST /api/notifications/send).
   */
  async sendNotification(notification: PushNotification): Promise<boolean> {
    try {
      const res = await fetch(apiUrl("/api/notifications/send"), {
        method: "POST",
        headers: getAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(notification),
      });

      return res.ok;
    } catch (error) {
      console.error(
        "[PushNotificationService] sendNotification failed:",
        error,
      );
      return false;
    }
  }

  /**
   * Show a local (in-browser) notification as a fallback.
   */
  showLocalNotification(notification: PushNotification): void {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    const options: NotificationOptions = {
      body: notification.body,
      icon: notification.icon || "/icon-192x192.png",
      badge: notification.badge || "/icon-192x192.png",
      tag: notification.tag,
      requireInteraction: notification.requireInteraction,
      data: notification.data,
    };

    const notif = new Notification(notification.title, options);

    notif.onclick = () => {
      notif.close();
      if (notification.data?.url) {
        window.location.href = notification.data.url;
      }
    };
  }

  /**
   * Get current push subscription status.
   */
  async getSubscriptionStatus(): Promise<{
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission;
  }> {
    return {
      isSupported: this.isSupported,
      isSubscribed: !!this.subscription,
      permission:
        typeof Notification !== "undefined"
          ? Notification.permission
          : "denied",
    };
  }

  /**
   * Unsubscribe from push notifications and remove the token from the
   * Hetzner backend (DELETE /api/device-tokens).
   */
  async unsubscribe(): Promise<void> {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      this.subscription = null;

      const userId = getCurrentUserId();
      if (userId) {
        try {
          await fetch(apiUrl("/api/device-tokens"), {
            method: "DELETE",
            headers: getAuthHeaders(),
            credentials: "include",
            body: JSON.stringify({ userId, platform: "web" }),
          });
        } catch {
          // Non-fatal — token will expire naturally
        }
      }
    }
  }

  // ── Notification factory helpers ─────────────────────────────────────────

  createFollowNotification(
    followerName: string,
    followerId: string,
  ): PushNotification {
    return {
      id: `follow_${followerId}_${Date.now()}`,
      userId: followerId,
      title: "New Follower!",
      body: `${followerName} started following you`,
      icon: "/icon-192x192.png",
      tag: "follow",
      data: {
        type: "follow",
        followerId,
        url: `/profile/${followerId}`,
      },
    };
  }

  createLikeNotification(
    videoTitle: string,
    likerName: string,
    videoId: string,
  ): PushNotification {
    return {
      id: `like_${videoId}_${Date.now()}`,
      userId: "",
      title: "New Like!",
      body: `${likerName} liked your video "${videoTitle}"`,
      icon: "/icon-192x192.png",
      tag: "like",
      data: {
        type: "like",
        videoId,
        url: `/video/${videoId}`,
      },
    };
  }

  createCommentNotification(
    commentText: string,
    commenterName: string,
    videoId: string,
  ): PushNotification {
    const preview =
      commentText.length > 50
        ? `${commentText.substring(0, 50)}…`
        : commentText;
    return {
      id: `comment_${videoId}_${Date.now()}`,
      userId: "",
      title: "New Comment!",
      body: `${commenterName} commented: "${preview}"`,
      icon: "/icon-192x192.png",
      tag: "comment",
      data: {
        type: "comment",
        videoId,
        url: `/video/${videoId}`,
      },
    };
  }

  createGiftNotification(
    giftName: string,
    senderName: string,
    amount: number,
  ): PushNotification {
    return {
      id: `gift_${Date.now()}`,
      userId: "",
      title: "Gift Received!",
      body: `${senderName} sent you ${amount} coins with a ${giftName}!`,
      icon: "/icon-192x192.png",
      tag: "gift",
      requireInteraction: true,
      data: {
        type: "gift",
        amount,
        url: "/live",
      },
    };
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /** Convert a VAPID base64url key to a Uint8Array for the push manager. */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }
}

// Singleton instance
export const pushNotificationService = new PushNotificationService();
