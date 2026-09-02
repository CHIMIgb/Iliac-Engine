/**
 * terrain.js — Generador de grilla de terreno procedural.
 *
 * Produce datos (vértices, sectores, paredes) compatibles con project.json.
 * Cada celda de la grilla es un sector convexo de 4 vértices con floorH
 * como array, lo que permite alturas individuales por vértice y terreno
 * irregular renderizado mediante fan triangulation.
 */

import { createNoise, fbm2 } from './noise.js';

/**
 * Calcula el ángulo de pendiente máxima de un sector cuadrilátero
 * a partir de sus 4 alturas de vértice y el tamaño de celda.
 *
 * @param {number[]} heights — Array de 4 alturas [h0, h1, h2, h3].
 * @param {number} cellSize — Tamaño de la celda en unidades mundo.
 * @returns {number} Ángulo de pendiente máxima en radianes.
 */
export function sectorSlopeAngle(heights, cellSize) {
  if (!heights || heights.length < 4) return 0;
  // Diferencias en X (aristas horizontales) y Y (aristas verticales)
  const dxBottom = Math.abs(heights[1] - heights[0]) / cellSize;
  const dxTop = Math.abs(heights[2] - heights[3]) / cellSize;
  const dyLeft = Math.abs(heights[3] - heights[0]) / cellSize;
  const dyRight = Math.abs(heights[2] - heights[1]) / cellSize;
  const maxSlope = Math.max(dxBottom, dxTop, dyLeft, dyRight);
  return Math.atan(maxSlope);
}

/**
 * Asigna la textura de suelo según el ángulo de pendiente.
 *
 * @param {number} angle — Ángulo en radianes.
 * @param {object} textures — { flat, slope, steep }.
 * @param {number[]} thresholds — [umbral_flat_slope, umbral_slope_steep] en radianes.
 * @returns {string} Nombre de la textura.
 */
function pickTexture(angle, textures, thresholds) {
  if (angle < thresholds[0]) return textures.flat;
  if (angle < thresholds[1]) return textures.slope;
  return textures.steep;
}

/**
 * Genera un terreno como grilla de sectores con alturas procedurales.
 *
 * @param {object} options — Configuración del terreno.
 * @param {number} [options.cols=16] — Número de celdas en X.
 * @param {number} [options.rows=16] — Número de celdas en Y.
 * @param {number} [options.cellSize=2] — Tamaño de cada celda en unidades.
 * @param {number} [options.seed=42] — Semilla para noise reproducible.
 * @param {number} [options.noiseScale=0.08] — Frecuencia del noise.
 * @param {number} [options.heightScale=6] — Amplitud máxima del terreno.
 * @param {number} [options.octaves=4] — Capas de detalle para FBM.
 * @param {object} [options.textures] — Texturas por pendiente.
 * @param {string} [options.textures.flat='grass'] — Textura de terreno plano.
 * @param {string} [options.textures.slope='dirt'] — Textura de pendiente moderada.
 * @param {string} [options.textures.steep='rock'] — Textura de pendiente fuerte.
 * @param {number[]} [options.slopeThresholds] — Umbrales de pendiente en radianes.
 * @param {number} [options.ceilH=50] — Altura del techo.
 * @param {string} [options.ceilTex='sky'] — Textura del techo.
 * @param {string} [options.wallTex='rock'] — Textura de paredes de borde.
 * @returns {{ vertices: object[], sectors: object[], walls: object[] }}
 */
export function generateTerrain(options = {}) {
  const {
    cols = 16,
    rows = 16,
    cellSize = 2,
    seed = 42,
    noiseScale = 0.08,
    heightScale = 6,
    octaves = 4,
    textures = { flat: 'grass', slope: 'dirt', steep: 'rock' },
    slopeThresholds = [0.3, 0.7],
    ceilH = 50,
    ceilTex = 'sky',
    wallTex = 'rock',
  } = options;

  const noise = createNoise(seed);
  const fbmOpts = { octaves, lacunarity: 2.0, gain: 0.5 };

  // --- 1. Grilla de vértices ---
  const vertCols = cols + 1;
  const vertRows = rows + 1;
  const vertices = [];
  // Mapa para acceso rápido: heightMap[row][col] = altura
  const heightMap = [];

  for (let r = 0; r < vertRows; r++) {
    heightMap[r] = [];
    for (let c = 0; c < vertCols; c++) {
      const wx = c * cellSize;
      const wy = r * cellSize;
      // FBM para altura natural; clampear a >= 0
      const raw = fbm2(noise, wx * noiseScale, wy * noiseScale, fbmOpts);
      const h = Math.max(0, ((raw + 1) / 2) * heightScale); // Normalizar [−1,1]→[0,heightScale]
      heightMap[r][c] = h;
      vertices.push({
        id: `t_v${c}_${r}`,
        x: wx,
        y: wy,
      });
    }
  }

  // --- 2. Sectores (una celda = un sector) ---
  const sectors = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Vértices en orden: esquina SW, SE, NE, NW (sentido horario en plano XY)
      const v0 = `t_v${c}_${r}`;
      const v1 = `t_v${c + 1}_${r}`;
      const v2 = `t_v${c + 1}_${r + 1}`;
      const v3 = `t_v${c}_${r + 1}`;

      const h0 = heightMap[r][c];
      const h1 = heightMap[r][c + 1];
      const h2 = heightMap[r + 1][c + 1];
      const h3 = heightMap[r + 1][c];

      const heights = [h0, h1, h2, h3];
      const angle = sectorSlopeAngle(heights, cellSize);
      const floorTex = pickTexture(angle, textures, slopeThresholds);

      sectors.push({
        id: `t_s${c}_${r}`,
        vertexIds: [v0, v1, v2, v3],
        floorH: heights,
        ceilH,
        floorTex,
        ceilTex,
      });
    }
  }

  // --- 3. Paredes ---
  const walls = [];
  let wallIdx = 0;

  // Paredes horizontales (entre filas r y r+1, para cada columna c)
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = `t_v${c}_${r}`;
      const b = `t_v${c + 1}_${r}`;

      if (r === 0) {
        // Borde inferior — pared sólida
        walls.push({
          id: `t_wh${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c}_${r}`,
          sectorBack: null,
          tex: wallTex,
        });
      } else if (r === rows) {
        // Borde superior — pared sólida
        walls.push({
          id: `t_wh${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c}_${r - 1}`,
          sectorBack: null,
          tex: wallTex,
        });
      } else {
        // Interna — portal
        walls.push({
          id: `t_wh${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c}_${r - 1}`,
          sectorBack: `t_s${c}_${r}`,
          tex: wallTex,
          portal: true,
        });
      }
    }
  }

  // Paredes verticales (entre columnas c y c+1, para cada fila r)
  for (let c = 0; c <= cols; c++) {
    for (let r = 0; r < rows; r++) {
      const a = `t_v${c}_${r}`;
      const b = `t_v${c}_${r + 1}`;

      if (c === 0) {
        // Borde izquierdo — pared sólida
        walls.push({
          id: `t_wv${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c}_${r}`,
          sectorBack: null,
          tex: wallTex,
        });
      } else if (c === cols) {
        // Borde derecho — pared sólida
        walls.push({
          id: `t_wv${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c - 1}_${r}`,
          sectorBack: null,
          tex: wallTex,
        });
      } else {
        // Interna — portal
        walls.push({
          id: `t_wv${wallIdx++}`,
          a, b,
          sectorFront: `t_s${c - 1}_${r}`,
          sectorBack: `t_s${c}_${r}`,
          tex: wallTex,
          portal: true,
        });
      }
    }
  }

  return { vertices, sectors, walls };
}
