/**
 * Realtime Sync — Hetzner WebSocket backend.
 *
 * Legacy Supabase-based realtime feed sync has been fully removed.
 * The app now uses the custom WebSocket service (src/lib/websocket.ts)
 * connected to the Hetzner Node/Fastify backend for all real-time events.
 *
 * This module is kept as a named export so existing import sites
 * continue to compile without changes.
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
