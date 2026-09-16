// lib/parseBody.ts — Lectura y validación Zod del body de un request (C2+).
// Centraliza el patrón usado en auth.ts: JSON inválido → 422 VALIDATION_ERROR,
// fallo de schema → AppError.fromZod (issues aplanados al contrato).
// Nota: auth.ts tiene su propia copia local (validada en C1); unificar el uso
// de este helper es deuda pendiente (ROADMAP §16) sin tocar lo validado.
import type { Context } from "hono";
import type { z } from "zod";
import { AppError } from "./AppError.ts";

export async function parseBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw AppError.fromZod({ issues: [{ path: [], message: "Body JSON inválido" }] });
  }
  const result = schema.safeParse(json);
  if (!result.success) throw AppError.fromZod(result.error);
  return result.data;
}