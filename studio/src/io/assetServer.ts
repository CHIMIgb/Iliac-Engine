/**
 * assetServer.ts — lógica pura del servido estático de assets del dev server.
 *
 * C5c: la SUBIDA de assets ya no pasa por aquí (vive en la API: `POST
 * /api/assets`). El middleware de Vite solo sirve archivos locales bajo
 * `/assets/<subruta>` para los proyectos antiguos que guardaban rutas como
 * `/assets/audio/wind.wav` o `/assets/sprites/guard_f0.png`.
 *
 * Regla de seguridad: jamás salir de assets/ (bloquear traversal `..`, barras,
 * rutas absolutas, nombres raros).
 */

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
