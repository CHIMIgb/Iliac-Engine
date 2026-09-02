/**
 * noise.js — Ruido Simplex 2D con semilla reproducible.
 *
 * Basado en el algoritmo de Stefan Gustavson (Simplex noise demystified).
 * Genera ruido coherente en 2D con valores en [-1, 1].
 * Incluye FBM (Fractal Brownian Motion) para terreno natural.
 */

// Gradientes 2D para simplex (12 direcciones uniformes)
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

// Constantes del simplex 2D
const F2 = 0.5 * (Math.sqrt(3) - 1); // Factor de skew
const G2 = (3 - Math.sqrt(3)) / 6;   // Factor de unskew

/**
 * PRNG simple (Mulberry32) para generar tablas de permutación reproducibles.
 * @param {number} seed — Semilla entera.
 * @returns {function} Función que devuelve un número pseudo-aleatorio en [0, 1).
 */
function mulberry32(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Construye la tabla de permutación (512 entradas) a partir de una semilla.
 * @param {number} seed
 * @returns {Uint8Array}
 */
function buildPerm(seed) {
  const rng = mulberry32(seed);
  // Tabla base 0..255 mezclada con Fisher-Yates
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  // Duplicar para evitar módulo en acceso
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  return perm;
}

/**
 * Crea una instancia de noise Simplex 2D con semilla.
 * @param {number} [seed=0] — Semilla para reproducibilidad.
 * @returns {{ simplex2: (x: number, y: number) => number }}
 */
export function createNoise(seed = 0) {
  const perm = buildPerm(seed);

  /**
   * Evalúa el ruido simplex 2D en (x, y).
   * @param {number} x
   * @param {number} y
   * @returns {number} Valor en [-1, 1].
   */
  function simplex2(x, y) {
    // Skew: transformar al espacio simplex
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew: volver al espacio original
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    // Determinar en qué triángulo del simplex estamos
    let i1, j1;
    if (x0 > y0) {
      i1 = 1; j1 = 0; // Triángulo inferior
    } else {
      i1 = 0; j1 = 1; // Triángulo superior
    }

    // Offsets para las otras dos esquinas del triángulo
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // Índices en tabla de permutación
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = perm[ii + perm[jj]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

    // Contribución de cada esquina
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
    }

    // Escalar a [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  return { simplex2 };
}

/**
 * Fractal Brownian Motion — superpone varias octavas de simplex noise
 * para generar terreno con detalle a múltiples escalas.
 *
 * @param {{ simplex2: function }} noise — Instancia creada con createNoise().
 * @param {number} x — Coordenada X.
 * @param {number} y — Coordenada Y.
 * @param {object} [opts] — Parámetros de FBM.
 * @param {number} [opts.octaves=4] — Número de capas de detalle.
 * @param {number} [opts.lacunarity=2.0] — Multiplicador de frecuencia por octava.
 * @param {number} [opts.gain=0.5] — Multiplicador de amplitud por octava (persistencia).
 * @param {number} [opts.frequency=1.0] — Frecuencia base.
 * @param {number} [opts.amplitude=1.0] — Amplitud base.
 * @returns {number} Valor acumulado (rango aprox. [-1, 1] normalizado).
 */
export function fbm2(noise, x, y, opts = {}) {
  const {
    octaves = 4,
    lacunarity = 2.0,
    gain = 0.5,
    frequency: freqBase = 1.0,
    amplitude: ampBase = 1.0,
  } = opts;

  let value = 0;
  let freq = freqBase;
  let amp = ampBase;
  let maxAmp = 0; // Para normalizar

  for (let i = 0; i < octaves; i++) {
    value += noise.simplex2(x * freq, y * freq) * amp;
    maxAmp += amp;
    freq *= lacunarity;
    amp *= gain;
  }

  // Normalizar al rango [-1, 1]
  return value / maxAmp;
}
