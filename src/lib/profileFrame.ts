/** CSS px per mm (1in = 25.4mm, 1in = 96px). */
const CSS_PX_PER_MM = 96 / 25.4;

/**
 * Increase gold profile ring outer diameter by `mm` (avatar scales with {@link PROFILE_RING_INNER_RATIO}).
 */
export function profileRingOuterAddMm(baseOuterPx: number, mm: number): number {
  return Math.max(16, Math.round(baseOuterPx + mm * CSS_PX_PER_MM));
}

/** Extra outer diameter for live/spectator MVP rings vs previous 36 / 35 / 24px bases. */
export const PROFILE_RING_SIZE_BUMP_MM = 3;

/** Live host + chat: was 36px outer. */
export const LIVE_MVP_PROFILE_RING_PX = profileRingOuterAddMm(36, PROFILE_RING_SIZE_BUMP_MM);

/** Spectator top bar MVP row: was 35px outer. */
export const SPECTATOR_MVP_PROFILE_RING_PX = profileRingOuterAddMm(35, PROFILE_RING_SIZE_BUMP_MM);

/** Spectator battle split rows: was 24px outer. */
export const SPECTATOR_BATTLE_PROFILE_RING_PX = profileRingOuterAddMm(24, PROFILE_RING_SIZE_BUMP_MM);

/** Chat LV pill `size` — scaled with {@link LIVE_MVP_PROFILE_RING_PX} vs old 36px ring. */
export const CHAT_LEVEL_BADGE_SIZE_PX = Math.round((32 * LIVE_MVP_PROFILE_RING_PX) / 36);

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
export const PROFILE_RING_IMAGE_LIFT_MM = 0.8;

export function profileRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * PROFILE_RING_INNER_RATIO));
}

export function storyRingInnerPx(outerPx: number): number {
  return Math.max(2, Math.round(outerPx * STORY_RING_INNER_RATIO));
}
