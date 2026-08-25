import { Pool } from "pg";
import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Le client et son pool, en un seul exemplaire.
 *
 * `DATABASE_URL` doit viser le pooler **transactionnel** de Supabase (port
 * 6543, `?pgbouncer=true`) : le pooler de session (port 5432) garde une
 * connexion serveur par client et plafonne à quinze, d'où le
 * `(EMAXCONNSESSION) max clients reached in session mode`. Une connexion
 * Google ou une analyse GEO lancent une dizaine de requêtes de front — le
 * plafond tombe alors en quelques secondes. La CLI Prisma, elle, garde le
 * port 5432 via `DIRECT_URL` : migrations et Studio ont besoin d'une vraie
 * session.
 *
 * Le pool est épinglé sur `globalThis` au même titre que le client : en
 * développement, chaque rechargement à chaud réévalue ce module, et un pool
 * neuf par rechargement finit par tenir plus de connexions que prévu.
 *
 * Les délais sont explicites parce que les défauts du driver `pg` ne
 * conviennent pas ici : `connectionTimeoutMillis` vaut zéro par défaut, soit
 * une requête qui attend indéfiniment son tour au lieu d'échouer.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
