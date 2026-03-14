/**
 * Realtime Sync — WebSocket (src/lib/websocket.ts) for real-time events.
 * This module is a named export for existing imports; use websocket.connect() for live data.
 */

/**
 * Start realtime feed sync.
 * Real-time updates are handled by the WebSocket service (websocket.ts).
 * This is intentionally a no-op — call websocket.connect() directly for
 * live-room events.
 */
export function startRealtimeSync(): void {
  // No-op: feed sync is driven by HTTP polling + WebSocket events.
}

/**
 * Stop realtime feed sync.
 * No-op: nothing to tear down here; WebSocket lifecycle is managed
 * by the WebSocketService singleton in websocket.ts.
 */
export function stopRealtimeSync(): void {
  // No-op.
}
