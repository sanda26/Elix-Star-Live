/**
 * Single place for API and LiveKit URLs. No duplicate or broken connections.
 * Uses VITE_* from build or window.__ENV from /env.js at runtime.
 */

const env = typeof window !== 'undefined' ? (window as any).__ENV as Record<string, string> | undefined : undefined;

/** In dev build we use same-origin so Vite proxy (or backend on 8080) handles /api */
function isLocalDev(): boolean {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
}

export function getApiBase(): string {
  if (isLocalDev()) return "";
  const base = (import.meta.env.VITE_API_URL ?? env?.VITE_API_URL ?? "").toString().trim();
  return base ? base.replace(/\/$/, "") : "";
}

export function getLiveKitUrl(): string {
  return (import.meta.env.VITE_LIVEKIT_URL ?? env?.VITE_LIVEKIT_URL ?? '').toString().trim();
}

export function getWsUrl(): string {
  if (isLocalDev()) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  let ws = (import.meta.env.VITE_WS_URL ?? env?.VITE_WS_URL ?? "").toString().trim();
  if (!ws && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = `${proto}//${window.location.host}`;
  }
  if (ws.startsWith('https://')) ws = ws.replace('https://', 'wss://');
  else if (ws.startsWith('http://')) ws = ws.replace('http://', 'ws://');
  if (!isLocalDev() && ws.startsWith("ws://")) ws = ws.replace("ws://", "wss://");
  return ws;
}

/** Full URL for an API path (e.g. apiUrl('/api/live/streams')) */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
