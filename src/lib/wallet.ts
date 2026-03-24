import { apiUrl } from "./api";
import { useAuthStore } from "../store/useAuthStore";

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchWalletBalance(): Promise<number> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return 0;

  const res = await fetch(apiUrl("/api/wallet"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch wallet balance");
  }

  const body = (await res.json().catch(() => ({}))) as { coins?: number };
  return Math.max(0, Number(body.coins || 0));
}
