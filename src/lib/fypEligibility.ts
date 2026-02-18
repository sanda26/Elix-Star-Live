/**
 * FYP Eligibility Engine
 *
 * Calculates an engagement score for a video and decides whether it
 * should appear on the For You Page.
 *
 * Score formula:
 *   likes × 10  +  comments × 8  +  shares × 15  +  views × 1
 *
 * Threshold:
 *   A video becomes FYP-eligible when its score ≥ FYP_THRESHOLD.
 *   New uploads start with a small "new-video boost" so they get
 *   initial impressions before engagement kicks in.
 */

import { supabase } from './supabase';

// ── Weights ──────────────────────────────────────────────────────
const WEIGHT_WATCH_TIME = 2;
const WEIGHT_LIKE    = 5;
const WEIGHT_COMMENT = 6;
const WEIGHT_SHARE   = 8;
const WEIGHT_COMPLETION = 10;
const WEIGHT_VIEW    = 1;

/** Score a video must reach before the algorithm shows it on FYP */
export const FYP_THRESHOLD = 50;

/** Boost given to every newly-uploaded video so it gets initial exposure */
export const NEW_VIDEO_BOOST = 50;

// ── Public helpers ───────────────────────────────────────────────

/** Calculate raw engagement score from stats */
export function calculateEngagementScore(stats: {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  watch_time?: number;
  completions?: number;
}): number {
  return (
    (stats.watch_time || 0) * WEIGHT_WATCH_TIME +
    stats.likes    * WEIGHT_LIKE +
    stats.comments * WEIGHT_COMMENT +
    stats.shares   * WEIGHT_SHARE +
    (stats.completions || 0) * WEIGHT_COMPLETION +
    stats.views    * WEIGHT_VIEW
  );
}

/** Check if a score qualifies for FYP */
export function isEligibleForFyp(score: number): boolean {
  return score >= FYP_THRESHOLD;
}

/**
 * Recalculate engagement_score + is_eligible_for_fyp in Supabase
 * for a single video row.  Safe to call frequently – it's a single
 * UPDATE query.
 */
export async function refreshVideoFypStatus(
  videoId: string,
  stats: { likes: number; comments: number; shares: number; views: number }
): Promise<void> {
  const score = calculateEngagementScore(stats);
  const eligible = isEligibleForFyp(score);

  try {
    await supabase
      .from('videos')
      .update({ engagement_score: score, is_eligible_for_fyp: eligible })
      .eq('id', videoId);
  } catch (err) {
    console.error('refreshVideoFypStatus failed:', err);
  }
}

/**
 * Give a freshly-uploaded video an initial engagement boost
 * so it starts appearing in FYP feeds right away.
 */
export async function boostNewVideo(videoId: string): Promise<void> {
  try {
    await supabase
      .from('videos')
      .update({
        engagement_score: NEW_VIDEO_BOOST,
        is_eligible_for_fyp: NEW_VIDEO_BOOST >= FYP_THRESHOLD,
      })
      .eq('id', videoId);
  } catch (err) {
    console.error('boostNewVideo failed:', err);
  }
}
