// app.ts — Instancia de la app Hono (DATABASE.md §8 B2).
// Separada de index.ts para poder testearla con `app.request()` sin levantar
// un servidor real. Expone:
//  - createApp(deps): fabrica la app con el contrato {success,data,error}
//    (ROADMAP §5b), CORS, request-id, y los endpoints de infraestructura
//    GET /health (liveness) y GET /ready (readiness, sonda de DB inyectable).
//  - app: instancia por defecto usada por index.ts y los tests.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { codes } from "./lib/codes.ts";
import { errorHandler, errorResponse, ok } from "./lib/handler.ts";
import { authRoutes } from "./routes/auth.ts";
import { projectsRoutes } from "./routes/projects.ts";

export interface AppDeps {
  /** Sonda de readiness: solo "ok" cuando la DB responde. Inyectable en tests. */
  probeDb?: () => Promise<unknown>;
}

/** Sonda por defecto: SELECT 1 contra PostgreSQL vía Prisma (lazy import). */
const defaultProbeDb = () =>
  import("./db.ts").then((m) => m.prisma.$queryRaw`SELECT 1`);

export function createApp(deps: AppDeps = {}): Hono {
  const app = new Hono();

  app.use(logger());
  app.use(requestId());
  app.use(
    cors({
      // CORS con origen explícito (WEB_URL/PUBLIC_URL); en dev sin variable
      // se permite todo (los proyectos del Studio se sirven en otros puertos).
      origin: process.env.PUBLIC_URL ?? "*",
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  // Interceptor global: AppError / Zod / desconocidos → contrato estándar.
  app.onError(errorHandler);
  // Ruta inexistente: contrato de error en vez de HTML plano.
  app.notFound((c) =>
    errorResponse(c, "NOT_FOUND", codes.NOT_FOUND.message, 404),
  );

  app.get("/", (c) => ok(c, { message: "Iliac Engine API" }));

  // Auth (C1): /auth/register y /auth/login.
  app.route("/auth", authRoutes);

  // Proyectos (C2): CRUD protegido por JWT sobre proyecto.data (JSONB v3).
  app.route("/api/projects", projectsRoutes);

  // Liveness: el proceso responde (no toca DB).
  app.get("/health", (c) => ok(c, { status: "ok" }));

  // Readiness: la DB responde. 503 con contrato si no.
  app.get("/ready", async (c) => {
    const probe = deps.probeDb ?? defaultProbeDb;
    try {
      await probe();
      return ok(c, { status: "ok", db: "up" });
    } catch {
      return errorResponse(c, "DB_UNAVAILABLE", codes.DB_UNAVAILABLE.message, 503);
    }
  });

  return app;
}

// Instancia por defecto (index.ts y tests de humo).
export const app = createApp();