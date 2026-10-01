/**
 * JSON-as-text helpers for SQLite-backed columns.
 *
 * SQLite has no native JSON column type in our Prisma schema, so columns
 * that used to be Postgres `Json` are stored as TEXT. These helpers are
 * the single serialization boundary for those columns.
 */

export function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJsonText<T>(text: string | null | undefined, fallback?: T): T {
  if (text === null || text === undefined || text === "") {
    return fallback as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback as T;
  }
}
