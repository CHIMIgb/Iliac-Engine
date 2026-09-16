// handler.ts — Contrato de respuesta estándar (ROADMAP §5b) + interceptor.
//
//  éxito  → { success: true,  data,                         error: null }
//  error  → { success: false, data: null, error: { code, message, details? } }
//
// errorHandler se registra con app.onError() y transforma AppError, ZodError y
// errores desconocidos al contrato. NUNCA filtra stack traces en producción.
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "./AppError.ts";

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json({ success: true, data, error: null }, status);
}

export function errorResponse(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode,
  details?: unknown,
) {
  return c.json(
    {
      success: false,
      data: null,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    },
    status,
  );
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return errorResponse(c, err.code, err.message, err.status, err.details);
  }
  // ZodError de validación de rutas futuras (body/params/query).
  const issues = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues;
  if (Array.isArray(issues)) {
    return errorResponse(c, "VALIDATION_ERROR", "Datos inválidos", 422, {
      issues: issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  // Último recurso: 500 genérico. Solo en desarrollo mostramos el mensaje real.
  const message =
    process.env.NODE_ENV === "production" ? "Error interno del servidor" : err.message;
  return errorResponse(c, "INTERNAL_ERROR", message, 500);
}