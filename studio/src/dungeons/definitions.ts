/**
 * Definiciones de mazmorras curadas: retículas de bloques con orientación.
 *
 * Los nombres van en serie (Mazmorra 1, 2, 3…) y el `type` describe el
 * carácter de la planta. La conectividad se comprueba en los tests de
 * ensamblaje (todo pasaje interior debe tener pareja en el vecino; los del
 * exterior se sellan solos). Los diseños que se añaden aquí procuran cero
 * bocas selladas en el interior: las salas fluyen unas en otras.
 */

import type { DungeonDef } from './types';

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'dgn-crypt',
    name: 'Mazmorra 1',
    type: 'Cripta',
    tiles: [
      { x: 0, y: 0, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-passage', rot: 90 }, // pasillo horizontal
      { x: 2, y: 0, block: 'blk-open' },
      { x: 0, y: 1, block: 'blk-open' },
      { x: 1, y: 1, block: 'blk-open' },
      { x: 2, y: 1, block: 'blk-open' },
    ],
  },
  {
    id: 'dgn-mine',
    name: 'Mazmorra 2',
    type: 'Mina',
    tiles: [
      { x: 0, y: 0, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-passage', rot: 90 }, // pasillo horizontal
      { x: 0, y: 1, block: 'blk-passage' },          // pasillo vertical
      { x: 1, y: 1, block: 'blk-open' },
    ],
  },
  {
    id: 'dgn-gallery',
    name: 'Mazmorra 3',
    type: 'Galería',
    // Línea de 80×16: salas alternadas con pasillos — flujo recto, sin
    // bocas selladas en el interior.
    tiles: [
      { x: 0, y: 0, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-passage', rot: 90 }, // pasillo horizontal
      { x: 2, y: 0, block: 'blk-open' },
      { x: 3, y: 0, block: 'blk-passage', rot: 90 }, // pasillo horizontal
      { x: 4, y: 0, block: 'blk-open' },
    ],
  },
  {
    id: 'dgn-shrine',
    name: 'Mazmorra 4',
    type: 'Santuario',
    // Cruce con plaza central y 4 salas adyacentes (48×48): cada sala solo
    // se abre hacia el centro.
    tiles: [
      { x: 1, y: 2, block: 'blk-open' },
      { x: 0, y: 1, block: 'blk-open' },
      { x: 1, y: 1, block: 'blk-open' },
      { x: 2, y: 1, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-open' },
    ],
  },
  {
    id: 'dgn-catacombs',
    name: 'Mazmorra 5',
    type: 'Catacumbas',
    // Malla 3×3 de salas abiertas (48×48): todo interior conecta con sus
    // vecinos por bocas centradas; el perímetro se sella solo.
    tiles: [
      { x: 0, y: 0, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-open' },
      { x: 2, y: 0, block: 'blk-open' },
      { x: 0, y: 1, block: 'blk-open' },
      { x: 1, y: 1, block: 'blk-open' },
      { x: 2, y: 1, block: 'blk-open' },
      { x: 0, y: 2, block: 'blk-open' },
      { x: 1, y: 2, block: 'blk-open' },
      { x: 2, y: 2, block: 'blk-open' },
    ],
  },
];