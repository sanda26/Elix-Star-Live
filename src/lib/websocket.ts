// WebSocket Real-Time Service

export type WebSocketEvent =
  // Room events
  | 'room_state'
  | 'viewer_count_update'
  | 'user_joined'
  | 'user_left'
  | 'connected'
  // Chat events
  | 'chat_message'
  | 'chat_deleted'
  // Gift events
  | 'gift_sent'
  | 'big_gift_queue_update'
  | 'leaderboard_update'
  // Battle events
  | 'battle_invite'
  | 'battle_accepted'
  | 'battle_declined'
  | 'battle_started'
  | 'battle_score_update'
  | 'battle_ended'
  | 'booster_activated'
  // Moderation events
  | 'user_muted'
  | 'user_kicked'
  | 'user_banned';

export interface WebSocketMessage {
  event: WebSocketEvent;
  data: any;
  timestamp: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<WebSocketEvent, Set<(data: any) => void>>();
  private roomId: string | null = null;
  private token: string | null = null;

  connect(roomId: string, token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.roomId = roomId;
    this.token = token;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    this.ws = new WebSocket(`${wsUrl}/live/${roomId}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected to room:', roomId);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocket] Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      this.attemptReconnect();
    };
  }

  disconnect() {
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect on intentional close
      this.ws.close();
      this.ws = null;
    }
    this.roomId = null;
    this.token = null;
    this.reconnectAttempts = 0;
  }

  send(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
    }
  }

  on(event: WebSocketEvent, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: WebSocketEvent, callback: (data: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  private handleMessage(message: WebSocketMessage) {
    // Special handling for gift videos
    if (message.event === 'gift_sent' && message.data.videoUrl) {
      this.playGiftVideo(message.data.videoUrl);
    }

    const listeners = this.listeners.get(message.event);
    if (listeners) {
      listeners.forEach(callback => callback(message.data));
    }
  }

  private playGiftVideo(videoUrl: string) {
    // Create a temporary video element for gift animation
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true; // Allow autoplay
    video.playsInline = true;
    video.style.position = 'fixed';
    video.style.top = '50%';
    video.style.left = '50%';
    video.style.transform = 'translate(-50%, -50%)';
    video.style.zIndex = '9999';
    video.style.maxWidth = '80vw';
    video.style.maxHeight = '80vh';
    video.style.borderRadius = '10px';
    video.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';

    document.body.appendChild(video);

    video.play().catch(console.error);

    // Remove after playing
    video.onended = () => {
      document.body.removeChild(video);
    };

    // Fallback: remove after 10 seconds
    setTimeout(() => {
      if (document.body.contains(video)) {
        document.body.removeChild(video);
      }
    }, 10000);
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);

    // Clear any existing timer before setting a new one
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.roomId && this.token) {
        this.connect(this.roomId, this.token);
      }
    }, delay);
  }
}

export const websocket = new WebSocketService();
