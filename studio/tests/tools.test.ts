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
} from '../src/tools/tools';

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
    expect(tm.selection).toBeNull();
  });

  it('select: clic dentro de un sector → true y selecciona', () => {
    const tm = new ToolManager(makeRoom());
    expect(tm.onPointerDown(ctxAt(4, 4))).toBe(true);
    expect(tm.selection?.kind).toBe('sector');
  });

  it('entity: clic en suelo sin sprite → crea sprite y consume (true)', () => {
    const tm = new ToolManager(makeRoom());
    tm.setTool('entity');
    expect(tm.onPointerDown(ctxAt(4, 4))).toBe(true);
    expect(tm.selection?.kind).toBe('sprite');
    expect(tm.doc.world.sprites).toHaveLength(1);
  });

  it('height: clic fuera de todo sector → false', () => {
    const tm = new ToolManager(makeRoom());
    tm.setTool('height');
    expect(tm.onPointerDown(ctxAt(20, 20))).toBe(false);
  });
});

describe('ToolManager · onWheel con sprite seleccionado ajusta la altura', () => {
  it('rueda sobre sprite seleccionado cambia pos.z y consume', () => {
    const state = makeRoom();
    const id = placeSpriteAt(state, 4, 4);
    const tm = new ToolManager(state);
    // Seleccionar el sprite con un clic proyectado
    tm.onPointerDown({ px: 10, py: 10, world: null, screenVertices: [], screenWalls: [], screenSprites: [{ id, x: 10, y: 10 }] });
    expect(tm.selection?.kind).toBe('sprite');

    const before = state.world.sprites.find((s) => s.id === id)!.pos.z;
    expect(before).toBe(0); // nacen en el suelo
    tm.onWheel(100, false); // deltaY > 0 → sube (y consume)
    const up = state.world.sprites.find((s) => s.id === id)!.pos.z;
    expect(up).toBe(0.25);
    tm.onWheel(-100, false); // deltaY < 0 → baja
    expect(state.world.sprites.find((s) => s.id === id)!.pos.z).toBe(0);
    tm.onWheel(-100, false); // clamp: sin altura negativa
    expect(state.world.sprites.find((s) => s.id === id)!.pos.z).toBe(0);
  });

  it('rueda sin selección sprite → false (el viewport hace zoom)', () => {
    const tm = new ToolManager(makeRoom());
    expect(tm.onWheel(100, false)).toBe(false);
  });

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
    expect(tm.selection?.kind).toBe('sector');
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