/**
 * engine/core/anims.js — lógica pura de animaciones de sprites (frames).
 *
 * El motor de animación por frames vive aquí SIN Three.js (regla de la capa
 * core/): dado una animación `{ frames, fps?, loop? }` y un tiempo acumulado,
 * devuelve el índice de frame a mostrar. SpriteSystem (three/) solo aplica el
 * resultado cambiando el `map` del material.
 *
 * Contrato (world.spriteAnims, SPRITE_TOOL_PLAN §6):
 *   spriteAnims = { [id]: { frames: string[], fps?, loop? } }
 *   - frames: keys de world.textures, con ≥2 entradas (lo valida validate.js).
 *   - fps: fotogramas por segundo (opcional, default 1).
 *   - loop: true = ciclo infinito; false/ausente = se queda en el último frame.
 */

/** FPS por defecto cuando la animación no lo declara. */
export const DEFAULT_FPS = 1;

/** FPS mínimo admisible (evita división por cero / avance instantáneo). */
export const MIN_FPS = 0.0001;

/**
 * Índice de frame para un tiempo acumulado `elapsed` (segundos).
 * @param {{ frames: unknown[], fps?: number, loop?: boolean }} anim
 * @param {number} elapsed segundos desde el inicio de la animación (≥ 0)
 * @returns {number} índice entero 0..frames.length-1 (0 si frames vacío)
 */
export function animFrameIndex(anim, elapsed) {
  const frames = anim?.frames;
  const n = Array.isArray(frames) ? frames.length : 0;
  if (n === 0) return 0;
  const fps = typeof anim.fps === 'number' && anim.fps > MIN_FPS ? anim.fps : DEFAULT_FPS;
  const t = Math.max(0, typeof elapsed === 'number' ? elapsed : 0);
  const frame = Math.floor(t * fps);
  return anim.loop === true ? frame % n : Math.min(frame, n - 1);
}