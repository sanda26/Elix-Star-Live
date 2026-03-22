/**
 * Inner photo diameter vs outer box for stacks using `/Icons/Profile icon.png`.
 * Canonical ratio used app-wide so every gold-frame avatar centers identically.
 */
export const PROFILE_RING_INNER_RATIO = 0.68;

/**
 * Keep story rings on the same inner-hole geometry as profile rings so all circles
 * match visually across Profile/Friends/Following/Search/Live surfaces.
 */
export const STORY_RING_INNER_RATIO = PROFILE_RING_INNER_RATIO;

export function profileRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * PROFILE_RING_INNER_RATIO));
}

export function storyRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * STORY_RING_INNER_RATIO));
}
