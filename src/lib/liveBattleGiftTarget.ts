/** Align with server `normalizeBattleTarget` in server/index.ts — maps WS payload to host vs opponent team. */
export type BattleGiftSide = "host" | "opponent";

export function normalizeBattleGiftTarget(raw: unknown): BattleGiftSide | null {
  if (raw === "host" || raw === "me" || raw === "player3") return "host";
  if (raw === "opponent" || raw === "player4") return "opponent";
  return null;
}
