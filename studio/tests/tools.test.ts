import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
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
    // Subir el piso 100 unidades → debe quedar a 2.6 (techo 3 - mínimo 0.4)
    changeSectorHeight(state, sid, 100, false);
    const s = state.getSector(sid)!;
    expect(s.ceilH).toBe(3);
    expect(s.floorH).toBeLessThan(3);
    expect((s.ceilH as number) - (s.floorH as number)).toBeCloseTo(0.4, 5);
  });

  it('changeSectorHeight devuelve false si no existe el sector', () => {
    const state = makeRoom();
    expect(changeSectorHeight(state, 'nope', 1, false)).toBe(false);
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