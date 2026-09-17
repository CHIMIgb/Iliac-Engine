// contract/api-response.ts — CONTRATO DE RESPUESTA API (única fuente de verdad).
// Fin: que backend y front compartan UN solo archivo y no haya contratos duplicados.
// Este archivo SOLO exporta tipos (sin lógica en runtime): los secundarios usarán
// `import type` — se borra en compilación, no hay dependencia en ejecución.
//
// Estándar pinnado 2026-09-16 (aprobado por el usuario):
//   éxito  → { success: true,  data: T,        error: null }
//   error  → { success: false, data: null, error: { code, message, details } }
//
// `details` SIEMPRE está presente (null si no hay detalle) — el front NO hace
// undefined-checks sobre error.details.

/** Detalle de error transportado por la API (siempre presente, null sin detalle). */
export interface ApiError {
  code: string;
  message: string;
  details: unknown;
}

/** Envoltorio de éxito: data es lo que devuelva cada endpoint (objeto o null). */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  error: null;
}

/** Envoltorio de error: data siempre null, error describe el fallo. */
export interface ApiFailure {
  success: false;
  data: null;
  error: ApiError;
}

/** Unión discriminada por `success`: la respuesta canónica de TODA la API. */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;