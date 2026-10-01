import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdapter = any;

function createAdapter(databaseUrl: string): AnyAdapter {
  if (databaseUrl.startsWith("file:")) {
    // Desktop / local mode: embedded SQLite via better-sqlite3 driver adapter.
    // Lazy require keeps pg-only web deployments from needing the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
    return new PrismaBetterSqlite3({ url: databaseUrl });
  }
  return new PrismaPg({ connectionString: databaseUrl });
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return new PrismaClient({
    adapter: createAdapter(databaseUrl),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getDb(): PrismaClient {
  if (!globalThis.prisma) {
    globalThis.prisma = createPrismaClient();
  }
  return globalThis.prisma;
}

/**
 * Lazy Prisma singleton.
 * - Importing this module no longer throws at module-evaluation time
 *   (fixes bare `next build` without DATABASE_URL).
 * - Driver adapter is chosen by DATABASE_URL scheme:
 *     file:...          -> better-sqlite3 (desktop / local dev)
 *     postgresql://...  -> pg (optional server mode)
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
