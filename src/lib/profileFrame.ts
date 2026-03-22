/**
 * Inner photo diameter vs outer box for stacks using `/Icons/Profile icon.png`.
 * Tuned so the face fills the ring opening (avoids grey gap around the avatar).
 */
export const PROFILE_RING_INNER_RATIO = 0.78;

/**
 * Story / inbox horizontal rings at 85px: hole in the PNG is slightly smaller than
 * the generic ratio; keeps the clipped photo under the gold rim when the frame is on top.
 */
export const STORY_RING_INNER_RATIO = 0.74;

export function profileRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * PROFILE_RING_INNER_RATIO));
}

export function storyRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * STORY_RING_INNER_RATIO));
}
