/**
 * Broadcast to all For You feed subscribers so live creators appear in realtime.
 * When a stream starts (POST /api/live/start) or ends (host disconnect / POST /api/live/end),
 * we push to every client subscribed to the "feed" WebSocket channel.
 */

import { WebSocket } from "ws";

const feedSubscribers = new Set<WebSocket>();

export function addFeedSubscriber(ws: WebSocket): void {
  feedSubscribers.add(ws);
}

export function removeFeedSubscriber(ws: WebSocket): void {
  feedSubscribers.delete(ws);
}

export function broadcastToFeedSubscribers(event: string, data: Record<string, unknown>): void {
  const message = JSON.stringify({
    event,
    data,
    timestamp: new Date().toISOString(),
  });
  for (const ws of feedSubscribers) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[feedBroadcast] send error:", err);
        }
      }
    }
  }
}
