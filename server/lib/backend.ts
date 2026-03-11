/**
 * Single backend DB access. No duplicate or broken connections.
 * When no DB is configured (e.g. no Postgres on Hetzner), both return null.
 * Routes should do: const db = getDb(); if (!db) return res.status(501).json(...); then use db.
 */

export function getDb(): null {
  return null;
}

export function getDbAdmin(): null {
  return null;
}
