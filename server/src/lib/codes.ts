// codes.ts — Diccionario centralizado de códigos de error (ROADMAP §5b).
// Cada entrada define el status HTTP y el mensaje por defecto en español.
// Los endpoints lanzan AppError con un código; aquí vive el único lugar donde
// se mapea código → status + mensaje (evita duplicar literales).
export const codes = {
  VALIDATION_ERROR: { status: 422, message: "Datos inválidos" },
  UNAUTHORIZED: { status: 401, message: "No autenticado" },
  FORBIDDEN: { status: 403, message: "Sin permisos" },
  NOT_FOUND: { status: 404, message: "Recurso no encontrado" },
  PROJECT_NOT_FOUND: { status: 404, message: "El proyecto no existe" },
  ASSET_NOT_FOUND: { status: 404, message: "El asset no existe" },
  EMAIL_IN_USE: { status: 409, message: "El email ya está registrado" },
  LOGIN_IN_USE: { status: 409, message: "El login ya está registrado" },
  INVALID_CREDENTIALS: { status: 401, message: "Credenciales inválidas" },
  SLUG_TAKEN: { status: 409, message: "El slug ya está en uso" },
  ASSET_TOO_LARGE: { status: 413, message: "El archivo supera el tamaño máximo (20 MB)" },
  TOO_MANY_REQUESTS: { status: 429, message: "Demasiados intentos, espera un momento" },
  STORAGE_WRITE_ERROR: { status: 500, message: "No se pudo escribir el archivo" },
  DB_UNAVAILABLE: { status: 503, message: "Base de datos no disponible" },
  INTERNAL_ERROR: { status: 500, message: "Error interno del servidor" },
} as const;

export type ErrorCode = keyof typeof codes;