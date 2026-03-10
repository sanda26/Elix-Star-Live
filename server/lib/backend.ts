/**
 * Backend client access. When no database is configured, both functions return null.
 * All server routes that need DB or admin access import from here.
 */

export function getDb(): null {
  return null;
}

export function getDbAdmin(): null {
  return null;
}
