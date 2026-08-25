import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // La CLI (migrations, db push, studio) tient une session : elle doit
    // passer par la connexion directe, pas par le pooler transactionnel que
    // le runtime utilise. `DATABASE_URL` ne sert que de filet si `DIRECT_URL`
    // n'est pas encore renseignée.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
