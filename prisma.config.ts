import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // La CLI (migrations, db push, studio) veut une connexion directe : le
    // pooler transactionnel du runtime ne sait pas tenir une session. D'où
    // `DIRECT_URL` en priorité, `DATABASE_URL` en dernier recours.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
