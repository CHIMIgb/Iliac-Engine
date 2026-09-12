/**
 * daylight.js — lógica pura del ciclo día/noche (sin Three.js).
 *
 * F4.7: el cielo REALISTA usa un reloj de hora 0–24 para mover el sol, la luna
 * (anti-solar), el color de la luz y la niebla. Esta lógica es 100% prueba de
 * unidad contemplada en físico puro (sin Three): quien la representa en 3D es
 * SunSystem (engine/three).
 *
 * Convenciones:
 *  - hour es un float 0–24 (12.5 = mediodía).
 *  - El sol sale al Este (elevación baja) a las 06:00, toca el cenit a las
 *    12:00 y se pone al Oeste a las 18:00; a las 00:00 está bajo el horizonte.
 *  - La luna ocupa el punto ANTI-SOLAR: sale cuando se pone el sol.
 *  - La orientación usa el mismo eje de cámara del mundo (y=arriba): el sol
 *    orbita sobre el plano XZ con una inclinación (tilt, por defecto 23.5°).
 *  - El tiempo avanza con advanceHour(): ciclo de día solar en segundos.
 */

export const DEG = Math.PI / 180;

/**
 * Dirección unitaria del sol para una hora 0–24.
 * El sol orbita alrededor del eje Y con inclinación `tiltDeg` (como la
 * eclíptica real). Vuelve { x, y, z } con y=arriba.
 * @param {number} hour 0–24
 * @param {number} [tiltDeg=23.5] inclinación del eje de rotación en grados
 */
export function sunDirection(hour, tiltDeg = 23.5) {
  // Ángulo de rotación: 06:00 este → 12:00 cenit → 18:00 oeste.
  const angle = ((hour - 6) / 24) * Math.PI * 2;
  const tilt = tiltDeg * DEG;
  const x = Math.cos(angle) * Math.cos(tilt);
  const y = Math.sin(angle);
  const z = Math.sin(angle) * Math.sin(tilt);
  return norm3(x, y, z);
}

/** La luna es el punto exactamente opuesto al sol (anti-solar). */
export function moonDirection(hour, tiltDeg = 23.5) {
  const s = sunDirection(hour, tiltDeg);
  return { x: -s.x, y: -s.y, z: -s.z };
}

/**
 * Elevación del sol en grados sobre el horizonte (-90..90). Valores < 0 =
 * noche.
 */
export function sunElevation(hour, tiltDeg = 23.5) {
  const d = sunDirection(hour, tiltDeg);
  return Math.asin(d.y) / DEG;
}

/**
 * Paleta de luz para una hora. Devuelve colores en formato número (0xRRGGBB)
 * e intensidades 0..1 listas para Three:
 *  - sunColor/sunIntensity: la DirectionalLight del sol.
 *  - ambientColor/ambientIntensity: la luz ambiental (Hemisphere en 3D).
 *  - skyColor/groundColor: colores para la luz hemisférica (cielo/piso).
 *  - fogColor: color de la niebla — la niebla tiñe todo el aire con la hora.
 * La curva es continua: amanecer ámbar, mediodía blanco, atardecer naranja,
 * noche azul profundo con luna fría.
 * @param {number} hour 0–24
 */
export function paletteFor(hour) {
  const elev = sunElevation(hour);
  // F4.7: día/noche con curva en S de 16° de crepúsculo (≈ 1 h real a 15°/h):
  //  - elev ≥ +11° → día pleno (day 1, night 0).
  //  - elev ≤  -5° → noche plena (day 0, night 1).
  //  - entre medias la curva S hace que la noche (y con ella la aurora boreal,
  //    la luna y las estrellas) APAREZCA POCO A POCO, no de golpe.
  const day = smooth((elev + 5) / 16); // 0 noche, 1 día pleno
  const dawn = smooth((elev + 4) / 8); // transición amanecer/atardecer
  const night = 1 - day;

  // Curvas de color del sol: ámbar al amanecer, blanco-cálido al mediodía,
  // naranja al atardecer. Se mezclan con la luz de la luna por la noche.
  const sunColor = lerpColor(0x2a2a55, 0xffcc77, dawn);   // luna fría → amanecer
  const noonColor = lerpColor(0xffcc77, 0xfff4e0, clamp(elev / 30, 0, 1));
  const sunFinal = lerpColor(sunColor, noonColor, 0.5 + 0.5 * Math.sin(Math.PI * day));
  const moonColor = 0x5560aa;

  const sunIntensity = 0.12 + 0.88 * day * (0.6 + 0.4 * Math.sin(Math.PI * day));
  const ambientIntensity = 0.18 + 0.5 * day;
  const ambientColor = night > 0.5 ? moonColor : sunFinal;

  // Cielo y niebla: el día es azul despejado, el atardecer anaranjado, la
  // noche azul-negro profundo.
  const daySky = 0x87ceeb;
  const duskSky = 0xffa66b;
  const nightSky = 0x0a1030;
  const skyColor = lerp3(daySky, duskSky, nightSky, day, dawn, night);
  const fogColor = lerp3(daySky, duskSky, nightSky, day * 0.9, dawn, night);

  return {
    sunColor: sunFinal,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    skyColor,
    groundColor: lerpColor(daySky, 0x2a3a2a, night),
    fogColor,
    night,
  };
}

/**
 * Avanza la hora según un día solar de `dayLengthSec` segundos.
 * @param {number} hour hora actual 0–24
 * @param {number} dt delta time en segundos
 * @param {number} dayLengthSec duración de un día completo en segundos (>0)
 * @returns {number} nueva hora 0–24 (siempre envuelta)
 */
export function advanceHour(hour, dt, dayLengthSec) {
  if (!(dayLengthSec > 0)) return hour % 24;
  const delta = (dt / dayLengthSec) * 24;
  return (hour + delta) % 24;
}

/**
 * Etiqueta HH:MM para una hora float (p.ej. 12.5 → "12:30").
 */
export function hourLabel(hour) {
  const totalMin = Math.round((((hour % 24) + 24) % 24) * 60);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ── Internos (matemática) ──────────────────────────────────────

function norm3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Curva suave 0..1 (smoothstep). */
function smooth(v) {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Mezcla dos colores 0xRRGGBB con t 0..1. */
function lerpColor(a, b, t) {
  const t2 = clamp(t, 0, 1);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(lerp(ar, br, t2));
  const g = Math.round(lerp(ag, bg, t2));
  const bl = Math.round(lerp(ab, bb, t2));
  return (r << 16) | (g << 8) | bl;
}

/** Mezcla TRES colores por dominios separados (día / atardecer / noche). */
function lerp3(day, dusk, night, dayT, duskT, nightT) {
  const c = lerpColor(day, dusk, clamp(duskT, 0, 1));
  return lerpColor(c, night, clamp(nightT, 0, 1));
}