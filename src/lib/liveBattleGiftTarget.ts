/**
 * MVP columns (2- or 4-player): map server `battleTarget` to red vs blue team for leaderboards.
 * Server buckets: P1=host, P2=opponent, P3=player3, P4=player4.
 * Red team = host + player3; blue = opponent + player4 (2-player: only P1/P2; P3/P4 absent).
 */
export type BattleGiftSide = "host" | "opponent";

export function normalizeBattleGiftTarget(raw: unknown): BattleGiftSide | null {
  if (raw === "host" || raw === "me" || raw === "player3") return "host";
  if (raw === "opponent" || raw === "player4") return "opponent";
  return null;
}
