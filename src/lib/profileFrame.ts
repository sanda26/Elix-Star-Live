/**
 * Inner photo diameter vs outer box for stacks using `/Icons/Profile icon.png`.
 * Tuned so the face fills the ring opening (avoids grey gap around the avatar).
 */
export const PROFILE_RING_INNER_RATIO = 0.78;

export function profileRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * PROFILE_RING_INNER_RATIO));
}
