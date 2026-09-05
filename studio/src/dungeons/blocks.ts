/**
 * Bloques pre-fabricados para mazmorras (celda 16×16).
 *
 * Reglas de autoría:
 * - El mundo local vive en [0, size]×[0, size] (x derecha, y profundidad).
 * - Los pasajes son huecos SIN pared en la boca; el ensamblador sella las
 *   bocas que quedan hacia el exterior o hacia un vecino sin pasaje.
 * - Todas las bocas tienen 4 unidades de ancho y están centradas en su lado,
 *   así los pasajes de bloques adyacentes coinciden siempre.
 */

import type { DungeonBlock } from './types';

export const BLOCKS: DungeonBlock[] = [
  {
    id: 'blk-open',
    name: 'Sala abierta',
    size: 16,
    // Pasajes en los 4 lados (el ensamblador sella los que no tengan vecino).
    passages: [
      { side: 's', from: 'sn', to: 's2', sector: 's' },
      { side: 'e', from: 'en', to: 'e2', sector: 's' },
      { side: 'n', from: 'nn', to: 'n2', sector: 's' },
      { side: 'w', from: 'wn', to: 'w2', sector: 's' },
    ],
    world: {
      vertices: [
        { id: 'v0', x: 0, y: 0 },
        { id: 'v1', x: 16, y: 0 },
        { id: 'v2', x: 16, y: 16 },
        { id: 'v3', x: 0, y: 16 },
        // Bocas: centro de cada lado (±2 → 4 u de paso)
        { id: 'sn', x: 6, y: 0 },
        { id: 's2', x: 10, y: 0 },
        { id: 'en', x: 16, y: 6 },
        { id: 'e2', x: 16, y: 10 },
        { id: 'nn', x: 6, y: 16 },
        { id: 'n2', x: 10, y: 16 },
        { id: 'wn', x: 0, y: 6 },
        { id: 'w2', x: 0, y: 10 },
      ],
      sectors: [{ id: 's', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 3 }],
      walls: [
        // Perímetro con huecos en el centro de cada lado
        { a: 'v0', b: 'sn', sectorFront: 's', sectorBack: null },
        { a: 's2', b: 'v1', sectorFront: 's', sectorBack: null },
        { a: 'v1', b: 'en', sectorFront: 's', sectorBack: null },
        { a: 'e2', b: 'v2', sectorFront: 's', sectorBack: null },
        { a: 'v2', b: 'n2', sectorFront: 's', sectorBack: null },
        { a: 'nn', b: 'v3', sectorFront: 's', sectorBack: null },
        { a: 'v3', b: 'wn', sectorFront: 's', sectorBack: null },
        { a: 'w2', b: 'v0', sectorFront: 's', sectorBack: null },
      ],
    },
  },
  {
    id: 'blk-passage',
    name: 'Pasaje',
    size: 16,
    // Pasillo central de 4 u de ancho, abierto a norte y sur.
    passages: [
      { side: 's', from: 'p0', to: 'p1', sector: 's' },
      { side: 'n', from: 'p3', to: 'p2', sector: 's' },
    ],
    world: {
      vertices: [
        { id: 'p0', x: 6, y: 0 },
        { id: 'p1', x: 10, y: 0 },
        { id: 'p2', x: 10, y: 16 },
        { id: 'p3', x: 6, y: 16 },
      ],
      sectors: [{ id: 's', vertexIds: ['p0', 'p1', 'p2', 'p3'], floorH: 0, ceilH: 3 }],
      walls: [
        // Laterales del pasillo (las tapas n/s son los propios pasajes)
        { a: 'p0', b: 'p3', sectorFront: 's', sectorBack: null },
        { a: 'p1', b: 'p2', sectorFront: 's', sectorBack: null },
      ],
    },
  },
  {
    id: 'blk-room',
    name: 'Sala sellada',
    size: 16,
    passages: [],
    world: {
      vertices: [
        { id: 'v0', x: 0, y: 0 },
        { id: 'v1', x: 16, y: 0 },
        { id: 'v2', x: 16, y: 16 },
        { id: 'v3', x: 0, y: 16 },
      ],
      sectors: [{ id: 's', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 3 }],
      walls: [
        { a: 'v0', b: 'v1', sectorFront: 's', sectorBack: null },
        { a: 'v1', b: 'v2', sectorFront: 's', sectorBack: null },
        { a: 'v2', b: 'v3', sectorFront: 's', sectorBack: null },
        { a: 'v3', b: 'v0', sectorFront: 's', sectorBack: null },
      ],
    },
  },
];