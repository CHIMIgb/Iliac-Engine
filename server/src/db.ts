// db.ts — Singleton de Prisma Client (DATABASE.md §8 B1).
// Prisma 7 con driver adapter `pg`: la conexión se resuelve aquí desde
// DATABASE_URL. El generator "prisma-client" NO carga .env en runtime, por eso
// importamos "dotenv/config" antes de leer la variable.
// Crear el client NO abre conexión: se conecta de forma perezosa en la primera query.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL en el entorno. Copia server/.env.example a server/.env y rellénalo.",
  );
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });
