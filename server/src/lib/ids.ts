// ids.ts — Guarda de ids UUID (C5c).
//
// Los ids de proyecto y asset son UUID en la DB: un id que no lo es NO puede
// existir, así que se responde NOT_FOUND antes de tocar Prisma — un id
// malformado hacía que P2023 escapara como INTERNAL_ERROR 500 (hueco detectado
// en C5b sobre /api/projects y cerrado también en /api/assets con C5c).
import { AppError } from "./AppError.ts";
import type { ErrorCode } from "./codes.ts";

/** UUID canónico de Postgres/Prisma. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lanza `new AppError(code, { id })` si el id no es un UUID. Mismo criterio
 * que un id ajeno: 404 sin enumerar recursos.
 */
export function assertUuid(id: string, code: ErrorCode): void {
  if (!UUID_RE.test(id)) throw new AppError(code, { id });
}
