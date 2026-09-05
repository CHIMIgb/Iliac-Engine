/**
 * Ensamblador de mazmorras.
 *
 * `assemble()` coloca los bloques de una definición en la retícula, rota y
 * fusiona sus mundos en un único world, y sella con paredes sólidas las bocas
 * de pasaje que apuntan al exterior o a un vecino sin pasaje recíproco.
 * `mergeDungeon()` vierte el resultado en un EditorState (con offset) usando
 * solo su API pública, por lo que dispara onChange y el viewport recarga solo.
 */

import type { AssembledDungeon, ConnectorSide, DungeonBlock, DungeonDef, Rot } from './types';
import { BLOCKS } from './blocks';
import type { EditorState } from '../editor/EditorState';

/** Rotación de un punto alrededor del centro de la celda. */
function rotateLocal(x: number, y: number, size: number, rot: Rot): [number, number] {
  const c = size / 2;
  switch (rot) {
    case 90: return [c - (y - c), c + (x - c)];
    case 180: return [c - (x - c), c - (y - c)];
    case 270: return [c + (y - c), c - (x - c)];
    default: return [x, y];
  }
}

/** Lado real de un pasaje tras aplicar la rotación (giro horario). */
const SIDE_ROT: Record<Rot, Record<ConnectorSide, ConnectorSide>> = {
  0: { n: 'n', s: 's', e: 'e', w: 'w' },
  90: { n: 'e', s: 'w', e: 's', w: 'n' },
  180: { n: 's', s: 'n', e: 'w', w: 'e' },
  270: { n: 'w', s: 'e', e: 'n', w: 's' },
};

/** Desplazamiento de vecino por lado en la retícula (y crece hacia el norte). */
const DIR: Record<ConnectorSide, [number, number]> = {
  n: [0, 1],
  s: [0, -1],
  e: [1, 0],
  w: [-1, 0],
};

const OPPOSITE: Record<ConnectorSide, ConnectorSide> = { n: 's', s: 'n', e: 'w', w: 'e' };

export function assemble(def: DungeonDef, blocks: DungeonBlock[] = BLOCKS): AssembledDungeon {
  const first = def.tiles[0];
  const size = first ? (blocks.find((b) => b.id === first.block)?.size ?? 16) : 16;

  // Normalizar la retícula para que empiece en (0,0)
  const minX = Math.min(...def.tiles.map((t) => t.x));
  const minY = Math.min(...def.tiles.map((t) => t.y));

  const vertices: AssembledDungeon['vertices'] = [];
  const sectors: AssembledDungeon['sectors'] = [];
  const walls: AssembledDungeon['walls'] = [];
  const passages: AssembledDungeon['passages'] = [];
  const openPassages: { id: string; side: ConnectorSide; tx: number; ty: number; from: string; to: string; sector: string }[] = [];

  for (const tile of def.tiles) {
    const block = blocks.find((b) => b.id === tile.block);
    if (!block) continue;
    const rot = tile.rot ?? 0;
    const ox = (tile.x - minX) * size;
    const oy = (tile.y - minY) * size;
    // Prefijo único por tile para reindexar ids del bloque.
    const P = (local: string): string => `${tile.x}_${tile.y}_${local}`;

    // Vértices
    const vMap = new Map<string, string>();
    for (const v of block.world.vertices) {
      const [rx, ry] = rotateLocal(v.x, v.y, size, rot);
      const nid = P(v.id);
      vMap.set(v.id, nid);
      vertices.push({ id: nid, x: ox + rx, y: oy + ry });
    }

    // Sectores
    const sMap = new Map<string, string>();
    for (const s of block.world.sectors) {
      const nid = P(s.id);
      sMap.set(s.id, nid);
      sectors.push({ id: nid, vertexIds: s.vertexIds.map((v) => vMap.get(v) ?? ''), floorH: s.floorH, ceilH: s.ceilH });
    }

    // Paredes
    for (const w of block.world.walls) {
      const a = vMap.get(w.a);
      const b = vMap.get(w.b);
      if (!a || !b) continue;
      walls.push({
        id: P(`w${walls.length}`),
        a,
        b,
        sectorFront: w.sectorFront ? (sMap.get(w.sectorFront) ?? null) : null,
        sectorBack: w.sectorBack ? (sMap.get(w.sectorBack) ?? null) : null,
      });
    }

    // Pasajes (rotados)
    for (const p of block.passages) {
      const side = SIDE_ROT[rot][p.side];
      const pid = `p${openPassages.length}`;
      openPassages.push({
        id: pid,
        side,
        tx: tile.x - minX,
        ty: tile.y - minY,
        from: vMap.get(p.from) ?? '',
        to: vMap.get(p.to) ?? '',
        sector: sMap.get(p.sector) ?? '',
      });
    }
  }

  // Resolver conectividad: un pasaje queda abierto solo si el vecino en su
  // lado tiene un pasaje recíproco; si no (exterior o pared del vecino) se
  // sella con una pared sólida en la boca.
  const hasPassage = (tx: number, ty: number, side: ConnectorSide): boolean =>
    openPassages.some((p) => p.tx === tx && p.ty === ty && p.side === side);

  for (const p of openPassages) {
    const [dx, dy] = DIR[p.side];
    const open = hasPassage(p.tx + dx, p.ty + dy, OPPOSITE[p.side]);
    if (!open) {
      walls.push({ id: `seal_${p.id}`, a: p.from, b: p.to, sectorFront: p.sector, sectorBack: null });
    }
    passages.push({ id: p.id, side: p.side, tx: p.tx, ty: p.ty, open });
  }

  const gw = Math.max(...def.tiles.map((t) => t.x)) - minX + 1;
  const gh = Math.max(...def.tiles.map((t) => t.y)) - minY + 1;

  return {
    id: def.id,
    name: def.name,
    type: def.type,
    vertices,
    sectors,
    walls,
    passages,
    width: gw * size,
    height: gh * size,
  };
}

/**
 * Vierte una mazmorra ensamblada en un EditorState en la posición (ox, oy).
 * Usa la API pública para que los ids se generen frescos (sin colisiones) y
 * las notificaciones de cambio recarguen el viewport automáticamente.
 */
export function mergeDungeon(state: EditorState, dun: AssembledDungeon, ox: number, oy = 0): void {
  const vMap = new Map<string, string>();
  for (const v of dun.vertices) {
    vMap.set(v.id, state.addVertex(v.x + ox, v.y + oy).id);
  }
  const sMap = new Map<string, string>();
  for (const s of dun.sectors) {
    sMap.set(s.id, state.addSector(s.vertexIds.map((v) => vMap.get(v) ?? ''), s.floorH, s.ceilH).id);
  }
  for (const w of dun.walls) {
    const a = vMap.get(w.a);
    const b = vMap.get(w.b);
    if (!a || !b) continue;
    const sf = w.sectorFront ? (sMap.get(w.sectorFront) ?? null) : null;
    const sb = w.sectorBack ? (sMap.get(w.sectorBack) ?? null) : null;
    state.addWall(a, b, sf, sb);
  }
}