/**
 * Definiciones de mazmorras curadas: retículas de bloques con orientación.
 *
 * La conectividad se comprueba en los tests de ensamblaje (todo pasaje
 * interior debe tener pareja en el vecino; los del exterior se sellan solos).
 */

import type { DungeonDef } from './types';

export const DUNGEONS: DungeonDef[] = [
  {
    id: 'dgn-crypt',
    name: 'Cripta del guardián',
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
    name: 'Mina de la colina',
    type: 'Mina',
    tiles: [
      { x: 0, y: 0, block: 'blk-open' },
      { x: 1, y: 0, block: 'blk-passage', rot: 90 }, // pasillo horizontal
      { x: 0, y: 1, block: 'blk-passage' },          // pasillo vertical
      { x: 1, y: 1, block: 'blk-open' },
    ],
  },
];