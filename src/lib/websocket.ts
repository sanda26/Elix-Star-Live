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
  // Battle events (server-controlled)
  | 'battle_invite'
  | 'battle_accepted'
  | 'battle_declined'
  | 'battle_started'
  | 'battle_score_update'
  | 'battle_ended'
  | 'booster_activated'
  | 'battle_created'
  | 'battle_state_sync'
  | 'battle_countdown'
  | 'battle_tick'
  | 'battle_score'
  | 'battle_error'
  // WebRTC signaling events
  | 'rtc_offer'
  | 'rtc_answer'
  | 'rtc_ice_candidate'
  | 'rtc_join'
  | 'rtc_leave'
  // Moderation events (AI safety: warning → pause → suspend)
  | 'user_muted'
  | 'user_kicked'
  | 'user_banned'
  | 'moderation_warning'
  | 'moderation_pause'
  | 'moderation_suspend'
  | 'room_full'
  | 'stream_ended';

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
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      if (this.roomId === roomId) return;
      this.disconnect();
    }

    this.roomId = roomId;
    this.token = token;
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${proto}//${window.location.host}`;
    }
    if (!wsUrl.startsWith('ws://localhost') && wsUrl.startsWith('ws://')) {
      wsUrl = wsUrl.replace('ws://', 'wss://');
    }
    this.ws = new WebSocket(`${wsUrl}/live/${roomId}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.handleMessage({ event: 'connected', data: {}, timestamp: new Date().toISOString() });
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        /* ignored */
      }
    };

    this.ws.onerror = () => {
    };

    this.ws.onclose = (event) => {
      this.attemptReconnect(event.code);
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

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
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
    const listeners = this.listeners.get(message.event);
    if (listeners) {
      listeners.forEach(callback => callback(message.data));
    }
  }

  reconnectOnForeground() {
    if (this.roomId && this.token && this.ws?.readyState !== WebSocket.OPEN && this.ws?.readyState !== WebSocket.CONNECTING) {
      this.reconnectAttempts = 0;
      this.connect(this.roomId, this.token);
    }
  }

  private attemptReconnect(code?: number) {
    // Don't reconnect on auth/policy failures — these won't succeed on retry
    if (code === 1008 || code === 1003 || code === 4001 || code === 4003) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

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
