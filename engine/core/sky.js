/**
 * sky.js — lógica pura del cielo Daggerfall (sin Three.js).
 *
 * - Los 31 sets SKY00–SKY30 son horizontes/escenarios distintos.
 * - Dentro de cada set hay 32 franjas del día (capa 0, fotogramas 0–31):
 *   cada franja es una iluminación diferente del mismo horizonte.
 * - `world.sky = { set: 0–30, frame?: 0–31 }`: el horizonte y la franja son
 *   independientes; cambiar `frame` solo cambia la iluminación del set.
 */

export const SKY_SETS = 31;
export const SKY_FRAMES = 32;

/** Etiqueta "HH:MM" para una franja 0–31 (32 franjas en 24 h). */
export function skyFrameLabel(frame) {
  const min = Math.round((frame * 1440) / SKY_FRAMES);
  const hh = String(Math.floor(min / 60)).padStart(2, '0');
  const mm = String(min % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Set 0–30 que corresponde a una hora del día 0–23 (etiqueta opcional). */
export function skySetForHour(hour) {
  return Math.min(SKY_SETS - 1, Math.max(0, Math.round((hour * SKY_SETS) / 24)));
}

/** Hora 0–23 más cercana a un set (etiqueta opcional). */
export function skyHourForSet(set) {
  return Math.round((set * 24) / SKY_SETS) % 24;
}
