// rateLimit.ts — Límite de peticiones por IP (en memoria).
// # ponytail: Map global por IP en el proceso; para multi-instancia (o rate
//   limit distribuido) migrar a Redis u otro store compartido.
import type { Context, Next } from "hono";
import { AppError } from "./AppError.ts";

interface Options {
  windowMs: number;
  max: number;
}

/** Ventanas deslizantes por IP: usamos timestamps, podamos los expirados. */
export function createLimiter({ windowMs, max }: Options) {
  const hits = new Map<string, number[]>();
  return {
    middleware: async (c: Context, next: Next) => {
      const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
      const now = Date.now();
      const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        throw new AppError("TOO_MANY_REQUESTS");
      }
      recent.push(now);
      hits.set(ip, recent);
      await next();
    },
  };
}

export const loginLimiter = createLimiter({ windowMs: 60_000, max: 5 });
// C5f: refresh token — límite holgado (renovaciones legítimas de varios tabs);
// el refresh expone el oráculo "¿es válido este token?": no abrir sin tope.
export const refreshLimiter = createLimiter({ windowMs: 60_000, max: 10 });