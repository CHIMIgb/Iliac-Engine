/**
 * viewport/renderSignature.ts — firma estable del bloque `render` (puro).
 *
 * `EditorViewport.reload` decide entre el camino barato (solo `setWorld`) y el
 * caro (recrear el motor entero) comparando el `render` del proyecto. Un
 * `JSON.stringify` directo es sensible al ORDEN de las claves: Postgres (JSONB)
 * devuelve las claves ordenadas por longitud+alfabeto, mientras el EditorState
 * las escribe en orden de constructor. Los MISMOS valores daban firmas
 * distintas → camino caro en cada carga desde la API, que recreaba el motor con
 * el viejo aún vivo (dos WebGLRenderer sobre el mismo canvas → viewport muerto).
 *
 * La firma ordena las claves en profundidad, así que solo cambia cuando cambia
 * algún valor real (fov, color de fondo, niebla…).
 */
export function renderSignature(render: unknown): string {
  return JSON.stringify(sortKeys(render ?? null));
}

/**
 * worldTextureSignature — firma estable de `world.textures` (puro).
 *
 * `EditorViewport.reload` la usa además de la firma de `render`: el motor NO
 * recodifica texturas nuevas en `setWorld` (limitación documentada en
 * `Engine3D.js`), así que al guardar una animación (cuyos frames se suben con
 * `setWorldTextures`) hay que recrear el motor para llevarlas al GPU — si no,
 * `SpriteSystem` salta el sprite animado (textura ausente → invisible).
 * Misma estabilidad que `renderSignature` frente al orden de claves de JSONB.
 */
export function worldTextureSignature(world: unknown): string {
  const textures = (world as { textures?: unknown } | null)?.textures ?? null;
  return JSON.stringify(sortKeys(textures));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}
