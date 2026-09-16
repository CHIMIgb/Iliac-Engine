import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Configuración de Prisma ORM 7 (DATABASE.md §6).
// - El schema vive en prisma/schema.prisma (el datasource NO lleva url: la
//   resuelve este archivo desde DATABASE_URL del .env).
// - El client se genera con el generator "prisma-client" en ./generated/prisma
//   (ver prisma/schema.prisma).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
