import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { ToolManager } from '../src/tools/ToolManager';
import type { PickContext } from '../src/tools/ToolManager';
import {
  createVertexAt,
  moveVertexTo,
  tryCreateWall,
  closeSector,
  changeSectorHeight,
  placeSpriteAt,
  moveSpriteTo,
  findSectorAt,
  sectorsSharingEdge,
  defaultSpriteTex,
  placeTerrainAt,
  sculptTerrainAt,
  resolveTerrainPlacement,
  applyTerrainRelief,
  terrainFootprints,
  hiddenTerrainVertices,
  collectTranslateTargets,
} from '../src/tools/tools';
import { getEntityDef } from '../src/entities/entityCatalog';

/** Estado con una habitación simple 8×8 (vértices + sector). */
function makeRoom(): EditorState {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  return state;
}

describe('tools · vértices', () => {
  it('createVertexAt crea con snap a grid', () => {
    const state = new EditorState();
    const id = createVertexAt(state, 1.26, 3.7);
    const v = state.getVertex(id);
    expect(v?.x).toBe(1.5);
    expect(v?.y).toBe(3.5);
  });

  it('moveVertexTo mueve con snap', () => {
    const state = new EditorState();
    const id = state.addVertex(0, 0).id;
    expect(moveVertexTo(state, id, 1.26, 3.7)).toBe(true);
    const v = state.getVertex(id);
    expect(v?.x).toBe(1.5);
    expect(v?.y).toBe(3.5);
  });

  it('moveVertexTo devuelve false si no existe', () => {
    const state = new EditorState();
    expect(moveVertexTo(state, 'nope', 1, 1)).toBe(false);
  });
});

describe('tools · sector bajo punto', () => {
  it('findSectorAt devuelve el sector correcto', () => {
    const state = makeRoom();
    expect(findSectorAt(state, 4, 4)).toBeDefined();
    expect(findSectorAt(state, 20, 20)).toBeNull();
  });

  it('sectorsSharingEdge lista los sectores que comparten la arista', () => {
    const state = makeRoom();
    const [a, b, , ] = state.world.vertices; // a=(0,0), b=(8,0)
    const shared = sectorsSharingEdge(state, a!.id, b!.id);
    expect(shared).toHaveLength(1);
  });
});

describe('tools · paredes con portal automático', () => {
  it('crea pared sólida cuando solo hay un sector a un lado', () => {
    const state = makeRoom();
    const [a, , c] = state.world.vertices;
    const r = tryCreateWall(state, a!.id, c!.id, 4, 4); // diagonal dentro de la habitación
    expect(r.ok).toBe(true);
    const wall = state.world.walls.find((w) => w.id === r.wallId);
    expect(wall?.sectorFront).toBeDefined();
    expect(wall?.sectorBack).toBeNull();
  });

  it('crea portal cuando hay sector a ambos lados', () => {
    const state = makeRoom();
    // Segunda habitación pegada por el borde derecho (x=8..16)
    const [a, b, c, d] = state.world.vertices;
    const e = state.addVertex(16, 0);
    const f = state.addVertex(16, 8);
    state.addSector([b!.id, e.id, f.id, c!.id], 0, 3);

    const r = tryCreateWall(state, b!.id, c!.id, 12, 4); // clic en la segunda habitación
    expect(r.ok).toBe(true);
    const wall = state.world.walls.find((w) => w.id === r.wallId);
    expect(wall?.sectorFront).toBeDefined();
    expect(wall?.sectorBack).toBeDefined();
  });

  it('rechaza pared duplicada entre los mismos vértices', () => {
    const state = makeRoom();
    const [a, , c] = state.world.vertices;
    tryCreateWall(state, a!.id, c!.id, 4, 4);
    const r = tryCreateWall(state, c!.id, a!.id, 4, 4); // invertido
    expect(r.ok).toBe(false);
  });

  it('rechaza pared sin sector debajo (fuera de todo)', () => {
    const state = makeRoom();
    const a = state.addVertex(100, 100);
    const b = state.addVertex(110, 100);
    const r = tryCreateWall(state, a.id, b.id, 105, 100);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('sector');
  });
});

describe('tools · cerrar sector', () => {
  it('crea el sector, ordena el polígono y genera paredes de borde', () => {
    const state = new EditorState();
    const ids = [0, 8, 8, 0].map((x, i) => {
      // 4 vértices en desorden deliberado
      const pts = [
        [0, 0],
        [8, 0],
        [8, 8],
        [0, 8],
      ];
      return state.addVertex(pts[i]![0]!, pts[i]![1]!).id;
    });
    // Mezclar el orden
    const shuffled = [ids[2]!, ids[0]!, ids[3]!, ids[1]!];
    const r = closeSector(state, shuffled);
    expect(r.ok).toBe(true);
    const sector = state.getSector(r.sectorId!);
    expect(sector?.vertexIds).toHaveLength(4);
    // 4 paredes de borde
    expect(state.world.walls.filter((w) => w.sectorFront === r.sectorId)).toHaveLength(4);
  });

  it('rechaza menos de 3 vértices', () => {
    const state = new EditorState();
    const a = state.addVertex(0, 0);
    const b = state.addVertex(8, 0);
    const r = closeSector(state, [a.id, b.id]);
    expect(r.ok).toBe(false);
  });

  it('rechaza crear un sector con los mismos vértices que uno existente', () => {
    const state = makeRoom(); // ya tiene una habitación con los 4 vértices
    const ids = state.world.vertices.map((v) => v.id);
    expect(state.world.sectors).toHaveLength(1);

    const r = closeSector(state, ids);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('ya existe');
    expect(state.world.sectors).toHaveLength(1);
  });
});

describe('tools · alturas', () => {
  it('changeSectorHeight sube y baja el piso', () => {
    const state = makeRoom();
    const sid = state.world.sectors[0]!.id;
    expect(changeSectorHeight(state, sid, 1, false)).toBe(true);
    expect(state.world.sectors[0]!.floorH).toBe(1);
    expect(changeSectorHeight(state, sid, -1.5, false)).toBe(true);
    // El piso puede bajar por debajo del nivel base (sótano)
    expect(state.world.sectors[0]!.floorH).toBe(-0.5);
  });

  it('changeSectorHeight ajusta el techo con isCeil', () => {
    const state = makeRoom();
    const sid = state.world.sectors[0]!.id;
    expect(changeSectorHeight(state, sid, 1, true)).toBe(true);
    expect(state.world.sectors[0]!.ceilH).toBe(4);
  });

  it('clampa: el piso nunca alcanza el techo', () => {
    const state = makeRoom();
    const sid = state.world.sectors[0]!.id;
    // Subir el piso 100 unidades → debe quedar a 1 (techo 3 - mínimo 2)
    changeSectorHeight(state, sid, 100, false);
    const s = state.getSector(sid)!;
    expect(s.ceilH).toBe(3);
    expect(s.floorH).toBeLessThan(3);
    expect((s.ceilH as number) - (s.floorH as number)).toBe(2);
  });

  it('changeSectorHeight devuelve false si no existe el sector', () => {
    const state = makeRoom();
    expect(changeSectorHeight(state, 'nope', 1, false)).toBe(false);
  });

  it('respeta el techo máximo de 60 m', () => {
    const state = makeRoom();
    const sid = state.world.sectors[0]!.id;
    changeSectorHeight(state, sid, 100, true); // isCeil = true
    expect(state.world.sectors[0]!.ceilH).toBe(60);
    expect(state.world.sectors[0]!.floorH).toBe(0);
  });
});

describe('tools · sprites', () => {
  it('placeSpriteAt coloca con snap y textura por defecto', () => {
    const state = makeRoom();
    const id = placeSpriteAt(state, 1.26, 3.7);
    const sp = state.world.sprites.find((s) => s.id === id);
    expect(sp?.pos.x).toBe(1.5);
    expect(sp?.pos.y).toBe(3.5);
  });

  it('defaultSpriteTex elige la primer textura prefijada con sprite', () => {
    const state = makeRoom();
    state.world.textures = {
      wall: '/textures/muro.svg',
      sprite_blue: '/textures/azul.svg',
      sprite_tree: '/textures/sprite_arbol.svg',
    };
    expect(defaultSpriteTex(state)).toBe('sprite_blue');
  });

  it('moveSpriteTo mueve con snap y conserva la altura', () => {
    const state = makeRoom();
    const id = placeSpriteAt(state, 2, 2);
    const before = state.world.sprites.find((s) => s.id === id)!;
    before.pos.z = 1.5;

    expect(moveSpriteTo(state, id, 3.26, 4.7)).toBe(true);
    const after = state.world.sprites.find((s) => s.id === id)!;
    expect(after.pos.x).toBe(3.5);
    expect(after.pos.y).toBe(4.5);
    expect(after.pos.z).toBe(1.5);
  });

  it('moveSpriteTo devuelve false si no existe', () => {
    const state = makeRoom();
    expect(moveSpriteTo(state, 'nope', 1, 1)).toBe(false);
  });
});

// ── ToolManager: consumo de clic y rueda ───────────────────────

/** PickContext mínimo: solo el punto del suelo (sin proyecciones). */
function ctxAt(x: number, z: number): PickContext {
  return { px: 0, py: 0, world: { x, z }, screenVertices: [], screenWalls: [], screenSprites: [] };
}

describe('ToolManager · onPointerDown devuelve si consumió el clic', () => {
  it('select: clic en vacío → false (el viewport puede orbitar)', () => {
    const tm = new ToolManager(makeRoom());
    expect(tm.onPointerDown(ctxAt(20, 20))).toBe(false);
    expect(tm.selection).toHaveLength(0);
  });

  it('select: clic dentro de un sector → true y selecciona', () => {
    const tm = new ToolManager(makeRoom());
    expect(tm.onPointerDown(ctxAt(4, 4))).toBe(true);
    expect(tm.selection[0]).toMatchObject({ kind: 'sector' });
  });

  it('entity: clic en suelo sin sprite ni tipo activo → consume true, aún no coloca', () => {
    const tm = new ToolManager(makeRoom());
    tm.setTool('entity');
    expect(tm.onPointerDown(ctxAt(4, 4))).toBe(true);
    expect(tm.doc.world.sprites).toHaveLength(0);
  });

  it('entity: con tipo activo, el clic en suelo coloca la entidad', () => {
    const tm = new ToolManager(makeRoom());
    tm.setTool('entity');
    // El selector fija activeEntity al elegir; aquí se simula esa elección.
    tm.activeEntity = getEntityDef('enemy_wolf')!;
    expect(tm.onPointerDown(ctxAt(4, 4))).toBe(true);
    expect(tm.doc.world.sprites).toHaveLength(1);
    expect(tm.doc.world.sprites[0]!.entityType).toBe('enemy_wolf');
  });

  it('height: clic fuera de todo sector → false', () => {
    const tm = new ToolManager(makeRoom());
    tm.setTool('height');
    expect(tm.onPointerDown(ctxAt(20, 20))).toBe(false);
  });
});

describe('ToolManager · onWheel', () => {
  it('rueda con herramienta H y sector seleccionado sube el techo por defecto', () => {
    const state = makeRoom();
    const tm = new ToolManager(state);
    tm.setTool('height');
    tm.onPointerDown(ctxAt(4, 4));
    expect(tm.onWheel(100, false)).toBe(true);
    expect(state.world.sectors[0]!.ceilH).toBe(3.25);
  });
});

describe('ToolManager · herramienta vértices dibuja salas', () => {
  /** Clic proyectado sobre un vértice concreto (para el cierre del polígono). */
  const clickVertex = (id: string, px = 10, py = 10): PickContext => ({
    px,
    py,
    world: { x: 0, z: 0 },
    screenVertices: [{ id, x: px, y: py }],
    screenWalls: [],
    screenSprites: [],
  });

  it('3 clics colocan puntos y el clic en el primero cierra y crea el sector 3D', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    tm.setTool('vertex');

    expect(tm.onPointerDown(ctxAt(0, 0))).toBe(true);
    expect(tm.onPointerDown(ctxAt(8, 0))).toBe(true);
    expect(tm.onPointerDown(ctxAt(4, 8))).toBe(true);
    expect(state.world.vertices).toHaveLength(3);
    expect(tm.polyline).toHaveLength(3);

    // Clic izquierdo sobre el primer vértice → cierra y crea la habitación
    const first = state.world.vertices[0]!.id;
    expect(tm.onPointerDown(clickVertex(first))).toBe(true);

    expect(state.world.sectors).toHaveLength(1);
    const sectorId = state.world.sectors[0]!.id;
    expect(state.world.walls.filter((w) => w.sectorFront === sectorId)).toHaveLength(3);
    expect(tm.polyline).toHaveLength(0);
    expect(tm.selection[0]).toMatchObject({ kind: 'sector' });
  });

  it('clic sobre un vértice existente lo añade al polígono sin duplicar', () => {
    const state = makeRoom();
    const existing = state.world.vertices[0]!.id;
    const tm = new ToolManager(state);
    tm.setTool('vertex');

    expect(tm.onPointerDown(clickVertex(existing))).toBe(true);
    expect(tm.polyline).toEqual([existing]);

    expect(tm.onPointerDown(clickVertex(existing))).toBe(true);
    expect(tm.polyline).toEqual([existing]);
  });

  it('cambiar de herramienta cancela el polígono en construcción', () => {
    const tm = new ToolManager(new EditorState());
    tm.setTool('vertex');
    tm.onPointerDown(ctxAt(0, 0));
    tm.onPointerDown(ctxAt(8, 0));
    expect(tm.polyline).toHaveLength(2);

    tm.setTool('select');
    expect(tm.polyline).toHaveLength(0);
  });
});

describe('tools · terreno (placeTerrainAt)', () => {
  it('coloca una grilla de celdas que comparten vértices, plana y alineada', () => {
    const state = new EditorState();
    // 4 m / celda 0,5 m → 8×8 = 64 sectores, 9×9 = 81 vértices compartidos
    const r = placeTerrainAt(state, 2, 2, 4);
    expect(r.sectorCount).toBe(64);
    expect(state.world.sectors).toHaveLength(64);
    expect(state.world.vertices).toHaveLength(81);
    const xs = state.world.vertices.map((v) => v.x);
    expect(Math.min(...xs)).toBe(2);
    expect(Math.max(...xs)).toBe(6);
    // Suelo plano (floorH array por vértice), sin paredes, techo alto, marcado terr_
    for (const s of state.world.sectors) {
      expect(s.floorH).toEqual([0, 0, 0, 0]);
      expect(s.ceilH).toBeGreaterThanOrEqual(50);
      expect(s.id).toMatch(/^terr_/);
    }
    expect(state.world.walls).toHaveLength(0);
  });

  it('dos terrenos colocados no comparten ids ni se pisan', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 4); // 64 sectores, 81 vértices
    placeTerrainAt(state, 10, 0, 4);
    expect(state.world.sectors).toHaveLength(128);
    expect(state.world.vertices).toHaveLength(162);
    const ids = new Set(state.world.vertices.map((v) => v.id));
    expect(ids.size).toBe(162);
  });

  it('sobre un sector con piso 3, la grilla nace elevada a la base', () => {
    const state = new EditorState();
    const a = state.addVertex(0, 0);
    const b = state.addVertex(2, 0);
    const c = state.addVertex(2, 2);
    const d = state.addVertex(0, 2);
    state.addSector([a.id, b.id, c.id, d.id], 3, 8);
    const r = placeTerrainAt(state, 0, 0, 4);
    expect(r.base).toBe(3);
    for (const s of state.world.sectors.filter((s) => s.id.startsWith('terr_'))) {
      expect(s.floorH).toEqual([3, 3, 3, 3]);
    }
  });
});

describe('tools · pincel de esculpido (sculptTerrainAt)', () => {
  /** Id del vértice de terreno (o sector) situado en la coordenada dada. */
  const vertexAt = (state: EditorState, x: number, z: number) =>
    state.world.vertices.find((v) => v.x === x && v.y === z)!;
  /** Altura que las celdas que comparten un vértice le asignan (deben coincidir). */
  const heightsOfVertex = (state: EditorState, vid: string): number[] => {
    const out: number[] = [];
    for (const s of state.world.sectors) {
      const i = s.vertexIds.indexOf(vid);
      if (i >= 0 && s.id.startsWith('terr_')) {
        out.push((Array.isArray(s.floorH) ? s.floorH[i] : s.floorH) as number);
      }
    }
    return out;
  };

  it('eleva solo la zona del pincel: centro al máximo, decaimiento y esquinas intactas', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 8); // vértices en 0,2,4,6,8
    const touched = sculptTerrainAt(state, 4, 4, 1, 3); // radio 3 alrededor del centro

    // El vértice bajo el cursor sube completo (decaimiento 1 en el centro)
    expect(heightsOfVertex(state, vertexAt(state, 4, 4).id)).toEqual([1, 1, 1, 1]);
    // REGRESIÓN del bug: las esquinas lejanas (dist > radio) NO se elevan
    for (const [x, z] of [[0, 0], [8, 0], [8, 8], [0, 8]] as const) {
      expect(heightsOfVertex(state, vertexAt(state, x, z).id)).toEqual([0]);
    }
    // Decaimiento suave: un vértice a 2 m del cursor sube, pero menos de 1
    const mid = (heightsOfVertex(state, vertexAt(state, 4, 6).id)[0])!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // Coherencia: las 4 celdas que comparten el vértice central coinciden
    expect(new Set(heightsOfVertex(state, vertexAt(state, 4, 4).id)).size).toBe(1);
    expect(touched).toBeGreaterThan(0);
  });

  it('hundir baja solo la zona tocada y el terreno plano queda intacto fuera', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 8);
    sculptTerrainAt(state, 4, 4, -0.5, 3);
    expect(heightsOfVertex(state, vertexAt(state, 4, 4).id)).toEqual([-0.5, -0.5, -0.5, -0.5]);
    expect(heightsOfVertex(state, vertexAt(state, 0, 0).id)).toEqual([0]);
  });

  it('no toca sectores normales (solo terrenos terr_)', () => {
    const state = makeRoom(); // habitación 8×8 con floorH 0 (sin prefijo terr_)
    expect(sculptTerrainAt(state, 4, 4, 1)).toBe(0);
    expect(state.world.sectors[0]!.floorH).toBe(0);
  });

  it('Mover captura el terreno entero: un vértice o una celda arrastran la grilla', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 4); // 81 vértices compartidos
    const v = state.world.vertices.find((v) => v.x === 2 && v.y === 2)!;
    const cell = state.world.sectors.find((s) => s.id.startsWith('terr_'))!;
    expect(collectTranslateTargets(state, [{ kind: 'vertex', id: v.id }]).vertexIds).toHaveLength(81);
    expect(collectTranslateTargets(state, [{ kind: 'sector', id: cell.id }]).vertexIds).toHaveLength(81);
    // Una sala normal sigue moviéndose solo por sus vértices (4)
    const room = makeRoom();
    expect(
      collectTranslateTargets(room, [{ kind: 'sector', id: room.world.sectors[0]!.id }]).vertexIds,
    ).toHaveLength(4);
  });
});
describe('tools · vértices ocultos de terreno (hiddenTerrainVertices)', () => {
  const vertexId = (state: EditorState, x: number, z: number) =>
    state.world.vertices.find((v) => v.x === x && v.y === z)!.id;

  it('oculta los interiores de la grilla y deja visibles solo las 4 esquinas', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 4); // 0,5 m: 9×9 = 81 vértices, 4 esquinas
    const hidden = hiddenTerrainVertices(state);
    expect(hidden.size).toBe(81 - 4);
    for (const [x, z] of [[0, 0], [4, 0], [4, 4], [0, 4]] as const) {
      expect(hidden.has(vertexId(state, x, z))).toBe(false);
    }
    expect(hidden.has(vertexId(state, 2, 2))).toBe(true); // centro interior
    expect(hidden.has(vertexId(state, 0, 2))).toBe(true); // borde interior
  });

  it('no oculta vértices de salas normales', () => {
    const state = makeRoom();
    expect(hiddenTerrainVertices(state).size).toBe(0);
  });
});

describe('tools · terreno: celda configurable (idea 1)', () => {
  it('celda 2 da 4x menos sectores que celda 0,5 y conserva el tamaño pedido', () => {
    const a = new EditorState();
    const b = new EditorState();
    expect(placeTerrainAt(a, 0, 0, 8, 'grass', 2).sectorCount).toBe(16);
    expect(placeTerrainAt(b, 0, 0, 8, 'grass', 0.5).sectorCount).toBe(256);
    const xs = a.world.vertices.map((v) => v.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(8);
    // step decimal permitido: size 10 con celda 1,5 → 7 celdas de 1,4286…
    const c = new EditorState();
    expect(placeTerrainAt(c, 0, 0, 10, 'grass', 1.5).sectorCount).toBe(49);
    expect(Math.max(...c.world.vertices.map((v) => v.x))).toBe(10);
  });
  it('celdas fuera del rango se clampean a 0,5–2', () => {
    const s = new EditorState();
    expect(placeTerrainAt(s, 0, 0, 4, 'grass', 100).sectorCount).toBe(4); // celda 2
    const t = new EditorState();
    expect(placeTerrainAt(t, 0, 0, 2, 'grass', 0.01).sectorCount).toBe(16); // celda 0,5
  });
});

describe('tools · terreno adyacente sin solapar (idea 4)', () => {
  it('las huellas salen por colocación y un clic libre no se mueve', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 8, 'grass', 2);
    const fps = terrainFootprints(state);
    expect(fps).toHaveLength(1);
    expect(fps[0]).toMatchObject({ minX: 0, minY: 0, maxX: 8, maxY: 8 });
    const r = resolveTerrainPlacement(state, 50, 50, 8);
    expect(r).toEqual({ x: 50, z: 50, adjacent: false });
  });

  it('un clic sobre un terreno existente lo desliza al borde más cercano', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 8, 'grass', 2); // huella 0..8
    // Cuadrado 4×4 pedido en (4,4): solapa → mejor borde derecho (dist 4 vs 8/…)
    const r = resolveTerrainPlacement(state, 4, 4, 4)!;
    expect(r.adjacent).toBe(true);
    expect(r.x).toBe(8);
    expect(r.z).toBe(4);
  });

  it('encaja sin solapar encajonado entre dos terrenos', () => {
    const state = new EditorState();
    placeTerrainAt(state, 0, 0, 4, 'grass', 2); // 0..4
    placeTerrainAt(state, 8, 0, 4, 'grass', 2); // 8..12
    const r = resolveTerrainPlacement(state, 2, 0, 4)!; // solapa con el 1.º
    expect(r).not.toBeNull();
    expect(r.x).toBe(4); // hueco libre entre ambos (4..8)
    expect(r.adjacent).toBe(true);
  });
});

describe('tools · relieve inicial (applyTerrainRelief)', () => {
  it('es determinista, crea subidas y bajadas y sella vértices compartidos', () => {
    const a = new EditorState();
    placeTerrainAt(a, 0, 0, 16, 'grass', 2); // 8×8 celdas → 9×9 = 81 vértices
    const n = applyTerrainRelief(a, { seed: 1337, scale: 0.045, amplitude: 7 });
    expect(n).toBe(81);
    const heights = (a.world.sectors as { floorH: number[] }[]).flatMap((s) => s.floorH);
    expect(Math.max(...heights)).toBeGreaterThan(1); // elevaciones
    expect(Math.min(...heights)).toBeLessThan(-1);   // hundimientos
    // estanqueidad: un vértice compartido tiene la MISMA altura en todas sus celdas
    const seen = new Map<string, number>();
    for (const s of a.world.sectors) {
      s.vertexIds.forEach((vid, i) => {
        const h = (s.floorH as number[])[i]!;
        if (seen.has(vid)) expect(seen.get(vid)).toBe(h);
        else seen.set(vid, h);
      });
    }
    // determinismo: misma semilla, mismo relieve (los ids difieren, las alturas no)
    const b = new EditorState();
    placeTerrainAt(b, 0, 0, 16, 'grass', 2);
    applyTerrainRelief(b, { seed: 1337, scale: 0.045, amplitude: 7 });
    expect(b.world.sectors.map((s) => s.floorH)).toEqual(a.world.sectors.map((s) => s.floorH));
  });

  it('sin terrenos no hace nada', () => {
    const state = makeRoom();
    expect(applyTerrainRelief(state)).toBe(0);
  });
});
