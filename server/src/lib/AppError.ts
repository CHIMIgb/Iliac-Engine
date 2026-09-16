// AppError.ts — Error de aplicación con código de negocio (ROADMAP §5b).
// Uso en endpoints:  throw new AppError("PROJECT_NOT_FOUND", { id });
// El status/mensaje por defecto salen del diccionario `codes`; el mensaje se
// puede sobrescribir sin cambiar el código.
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { codes, type ErrorCode } from "./codes.ts";

interface ZodIssueLike {
  path: (string | number)[];
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, details?: unknown, message?: string) {
    super(message ?? codes[code].message);
    this.name = "AppError";
    this.code = code;
    this.status = codes[code].status;
    this.details = details;
  }

  // Convierte un error de Zod en un AppError 422 con los issues aplanados.
  static fromZod(error: { issues: ZodIssueLike[] }): AppError {
    return new AppError("VALIDATION_ERROR", {
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
}