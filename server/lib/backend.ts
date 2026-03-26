/**
 * Backend database entrypoint.
 *
 * **Neon (Neon Console)** — this app talks to Neon as ordinary Postgres using `DATABASE_URL`
 * and the `pg` pool in `postgres.ts`. Use `getNeonPool()` / `isNeonConfigured()` below for that.
 * Credentials stay server-side only.
 *
 * **getDb() / getDbAdmin()** — legacy hooks that expected a PostgREST-style chain API (`.from()`).
 * This codebase does not use Supabase. Those clients are not wired; these still return `null` so
 * existing `if (!getDb())` branches keep their current JSON/file fallbacks without breaking.
 */

export function getDb(): null {
  return null;
}

export function getDbAdmin(): null {
  return null;
}

export {
  getPool as getNeonPool,
  isPostgresConfigured as isNeonConfigured,
} from "./postgres";
