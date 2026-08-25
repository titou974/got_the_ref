import { Pool } from "pg";
import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Le pool et le client sont épinglés sur `globalThis`.
 *
 * En développement, chaque rechargement à chaud réévalue ce module : sans ce
 * cache, un pool neuf naît à chaque fois et les anciens gardent leurs sockets
 * ouvertes. Le pooler Supabase en mode session plafonne à quinze clients et
 * répond alors `(EMAXCONNSESSION) max clients reached in session mode`.
 *
 * `max` reste volontairement bas : une analyse GEO lance plusieurs requêtes en
 * parallèle, mais toutes passent par ce pool ; mieux vaut attendre son tour
 * qu'ouvrir une connexion de plus vers un pooler déjà saturé.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
