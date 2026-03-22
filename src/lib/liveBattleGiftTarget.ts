/** MVP team side: host+P3 = one team, opponent+P4 = other (server stores four per-player buckets). */
export type BattleGiftSide = "host" | "opponent";

export function normalizeBattleGiftTarget(raw: unknown): BattleGiftSide | null {
  if (raw === "host" || raw === "me" || raw === "player3") return "host";
  if (raw === "opponent" || raw === "player4") return "opponent";
  return null;
}
