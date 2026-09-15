/**
 * assetServer.ts — logica pura del middleware de assets del Studio (F4.6.a).
 *
 * El navegador NO puede escribir en el disco del usuario; el dev server de Vite
 * hace de puente: el Studio sube el archivo (base64 en JSON via POST) y este
 * modulo valida y produce la ruta + buffer con los que el middleware escribe en
 * `assets/`. Todo es puro (sin fs) para poder testearse aislado.
 *
 * Regla de seguridad: jamas salir de assets/ (bloquear traversal `..`, barras,
 * rutas absolutas, nombres raros). Solo extensiones admitidas por tipo.
 */

/** Extensiones de audio admitidas (wav, mp3, mp4 y otros formatos comunes). */
export const AUDIO_EXTS = ['wav', 'mp3', 'mp4', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'webm'];

/** Tope de tamano por archivo subido (bytes): 50 MB. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

/** Extensiones de sprites admitidas por el Sprite Tool (F5): solo PNG. */
export const SPRITE_EXTS = ['png'];

/** Tope de tamano por frame de sprite (bytes): 20 MB. */
export const MAX_SPRITE_BYTES = 20 * 1024 * 1024;

/** Limpia un nombre de archivo: solo [A-Za-z0-9._-], sin barras ni `..`. */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const clean = base.replace(/[^A-Za-z0-9._-]/g, '_');
  return clean.startsWith('..') ? `_${clean}` : clean;
}

/** Devuelve la extension (sin punto, minusculas) de un nombre de archivo. */
export function extFromName(name: string): string {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

/** True si el nombre tiene una extension de audio admitida. */
export function isAudioName(name: string): boolean {
  return AUDIO_EXTS.includes(extFromName(name));
}

/** True si el nombre tiene una extension de sprite admitida. */
export function isSpriteName(name: string): boolean {
  return SPRITE_EXTS.includes(extFromName(name));
}

/**
 * Decodifica base64 (tolera prefijo data:...;base64 y espacio/URL encoding) en
 * bytes. Devuelve null si el base64 esta mal formado o excede maxBytes.
 */
function decodeBase64(data: string, maxBytes: number): Uint8Array | null {
  let b64 = data;
  const comma = b64.indexOf(',');
  if (comma !== -1) b64 = b64.slice(comma + 1);
  b64 = b64.replace(/\s/g, '');
  if (b64.length === 0 || b64.length % 4 !== 0) return null;

  // Chequeo temprano de tamaño (estimación base64 → bytes) antes de decodificar:
  // evita decodificar archivos gigantes contra el límite.
  if ((b64.length / 4) * 3 > maxBytes) return null;

  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    return null; // base64 mal formado
  }
  const len = bin.length;
  if (len > maxBytes) return null;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = bin.charCodeAt(i);
  return buffer;
}

/**
 * Convierte un payload de subida { name, data(base64) } en { fileName, buffer },
 * validando contra una lista de extensiones y un tope de tamaño. Devuelve null
 * si el nombre no es valido, la extension no esta admitida o excede el tamaño.
 */
export function assetUploadToBuffer(
  payload: { name?: unknown; data?: unknown },
  exts: string[],
  maxBytes: number,
): { fileName: string; buffer: Uint8Array } | null {
  if (typeof payload.name !== 'string' || typeof payload.data !== 'string') return null;
  const fileName = sanitizeFileName(payload.name);
  if (fileName === '' || !exts.includes(extFromName(fileName))) return null;
  const buffer = decodeBase64(payload.data, maxBytes);
  return buffer ? { fileName, buffer } : null;
}

/** Idem para audio (F4.6.a). */
export function audioUploadToBuffer(
  payload: { name?: unknown; data?: unknown },
): { fileName: string; buffer: Uint8Array } | null {
  return assetUploadToBuffer(payload, AUDIO_EXTS, MAX_AUDIO_BYTES);
}

/** Idem para sprites del Sprite Tool (F5). */
export function spriteUploadToBuffer(
  payload: { name?: unknown; data?: unknown },
): { fileName: string; buffer: Uint8Array } | null {
  return assetUploadToBuffer(payload, SPRITE_EXTS, MAX_SPRITE_BYTES);
}

/**
 * Normaliza una URL de asset `/assets/<subruta>` a una ruta relativa dentro de
 * assets/. Devuelve null si sale del arbol (traversal, ruta absoluta, `..`).
 * Ej: '/assets/audio/wind.wav' -> 'audio/wind.wav'.
 */
export function resolveAssetPath(url: string): string | null {
  const raw = url.split('?')[0]?.split('#')[0] ?? '';
  // Solo rutas servidas bajo /assets/ y sin prefijos raros.
  if (!raw.startsWith('/assets/')) return null;
  const rel = raw.slice('/assets/'.length);
  const parts = rel.split('/').filter((p) => p !== '' && p !== '.');
  if (parts.length === 0) return null;
  for (const p of parts) {
    // Decodificar antes de validar: '..%2F', '%5C', '%3A'... no deben colarse.
    let seg: string;
    try {
      seg = decodeURIComponent(p);
    } catch {
      return null; // % malformado
    }
    // Un segmento no puede contener ni slashes (reales u ocultos) ni separadores.
    if (seg === '..' || seg.includes('/') || seg.includes('\\') || seg.includes(':')) return null;
  }
  return parts.join('/');
}