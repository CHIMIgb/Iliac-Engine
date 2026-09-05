import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { ToolManager } from '../src/tools/ToolManager';
import type { PickContext } from '../src/tools/ToolManager';

function roomWithSector(): { state: EditorState; tm: ToolManager; sectorId: string } {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  const tm = new ToolManager(state);
  tm.setTool('height');
  tm.select({ kind: 'sector', id: state.world.sectors[0]!.id });
  return { state, tm, sectorId: state.world.sectors[0]!.id };
}

/** Habitación base 0..8 para los tests de Mover/multi-selección. */
function room(): {
  state: EditorState;
  tm: ToolManager;
  ids: { a: string; b: string; c: string; d: string };
  wallAB: string;
} {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  const tm = new ToolManager(state);
  // addSector no genera paredes: crear la arista a-b explícitamente.
  const wallAB = state.addWall(a.id, b.id, state.world.sectors[0]!.id, null).id;
  return {
    state,
    tm,
    ids: { a: a.id, b: b.id, c: c.id, d: d.id },
    wallAB,
  };
}

function ctx(worldX: number, worldZ: number, shiftKey = false): PickContext {
  return {
    px: 0, py: 0,
    world: { x: worldX, z: worldZ },
    screenVertices: [], screenWalls: [], screenSprites: [],
    shiftKey,
  };
}

describe('ToolManager.onWheel — herramienta Alturas', () => {
  it('deltaY > 0 sube el TECHO 0.25 sin Shift (piso queda igual)', () => {
    const { state, tm } = roomWithSector();
    expect(tm.onWheel(100, false)).toBe(true);
    expect(state.world.sectors[0]!.ceilH).toBe(3.25);
    expect(state.world.sectors[0]!.floorH).toBe(0);
  });

  it('deltaY < 0 baja el TECHO 0.25 (y consume)', () => {
    const { state, tm } = roomWithSector();
    expect(tm.onWheel(-100, false)).toBe(true);
    expect(state.world.sectors[0]!.ceilH).toBe(2.75);
  });

  it('con Shift, la rueda mueve el PISO en su lugar', () => {
    const { state, tm } = roomWithSector();
    expect(tm.onWheel(100, true)).toBe(true);
    expect(state.world.sectors[0]!.floorH).toBe(0.25);
    expect(state.world.sectors[0]!.ceilH).toBe(3);
  });

  it('sin sector seleccionado no consume la rueda', () => {
    const { state, tm } = roomWithSector();
    tm.select(null);
    expect(tm.onWheel(-100, false)).toBe(false);
  });
});

describe('ToolManager.onWheel — sprite seleccionado ya no cambia altura', () => {
  it('la rueda con sprite seleccionado no consume → el viewport hace zoom', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    state.addSprite('sprite_blue', 4, 4, 1);
    // Seleccionar el sprite (cualquier herramienta) y girar la rueda
    tm.select({ kind: 'sprite', id: state.world.sprites[0]!.id });
    expect(tm.onWheel(100, false)).toBe(false);
    expect(state.world.sprites[0]!.pos.z).toBe(1);
  });
});

describe('ToolManager — Herramienta Mover (tecla 3): traslación rígida', () => {
  it('arrastrar una pared mueve sus 2 extremos juntos (sin deformar)', () => {
    const { state, tm, ids, wallAB } = room();
    tm.setTool('move');
    const wallCtx = (wx: number, wz: number): PickContext => ({
      px: 5, py: 5, // sobre el segmento proyectado (0,0)-(10,10)
      world: { x: wx, z: wz },
      screenWalls: [{ id: wallAB, x1: 0, y1: 0, x2: 10, y2: 10 }],
      screenVertices: [], screenSprites: [],
    });
    expect(tm.onPointerDown(wallCtx(2, 0))).toBe(true);
    tm.onPointerMove(wallCtx(5, 0)); // delta +3 en X
    expect(state.getVertex(ids.a)).toMatchObject({ x: 3, y: 0 });
    expect(state.getVertex(ids.b)).toMatchObject({ x: 11, y: 0 });
  });

  it('clic en el suelo de un sector lo arrastra completo (todo el polígono)', () => {
    const { state, tm, ids } = room();
    tm.setTool('move');
    expect(tm.onPointerDown(ctx(4, 4))).toBe(true); // punto interior del sector
    tm.onPointerMove(ctx(6, 6));                    // delta +2,+2
    expect(state.getVertex(ids.a)).toMatchObject({ x: 2, y: 2 });
    expect(state.getVertex(ids.b)).toMatchObject({ x: 10, y: 2 });
    expect(state.getVertex(ids.d)).toMatchObject({ x: 2, y: 10 });
  });

  it('arrastrar un sprite lo traslada en el plano (mantiene altura)', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    const sp = state.addSprite('sprite_blue', 4, 4, 1);
    tm.setTool('move');
    tm.onPointerDown({ ...ctx(4, 4), px: 0, py: 0, screenSprites: [{ id: sp.id, x: 0, y: 0 }] });
    tm.onPointerMove(ctx(6, 6)); // delta +2,+2
    expect(state.world.sprites[0]!.pos).toEqual({ x: 6, y: 6, z: 1 });
  });

  it('mover un vértice suelto no arrastra al resto del sector', () => {
    const { state, tm, ids } = room();
    tm.setTool('move');
    tm.onPointerDown({ ...ctx(2, 2), px: 0, py: 0, screenVertices: [{ id: ids.a, x: 0, y: 0 }] });
    tm.onPointerMove(ctx(4, 2));
    expect(state.getVertex(ids.a)).toMatchObject({ x: 2, y: 0 });
    expect(state.getVertex(ids.c)).toMatchObject({ x: 8, y: 8 }); // intocado
  });
});

describe('ToolManager — selección múltiple con Shift', () => {
  const pickVertexCtx = (
    ids: { a: string; b: string },
    px: number,
    py: number,
    wx: number,
    wz: number,
    shiftKey = false,
  ): PickContext => ({
    px, py,
    world: { x: wx, z: wz },
    screenVertices: [
      { id: ids.a, x: 0, y: 0 },
      { id: ids.b, x: 10, y: 0 },
    ],
    screenWalls: [], screenSprites: [],
    shiftKey,
  });

  it('Shift+clic añade al conjunto; arrastrar un miembro mueve el grupo completo', () => {
    const { state, tm, ids } = room();
    tm.setTool('move');
    // Seleccionar a (sin Shift) → [a]
    expect(tm.onPointerDown(pickVertexCtx(ids, 0, 0, 2, 2))).toBe(true);
    expect(tm.selection).toHaveLength(1);
    // Shift+clic en b → [a, b]
    expect(tm.onPointerDown(pickVertexCtx(ids, 10, 0, 4, 2, true))).toBe(true);
    expect(tm.selection).toHaveLength(2);
    // Agarrar el grupo desde a (Shift: ya está, no duplica) y arrastrar +5
    tm.onPointerDown(pickVertexCtx(ids, 0, 0, 2, 2, true));
    tm.onPointerMove(pickVertexCtx(ids, 0, 0, 7, 2, true));
    expect(state.getVertex(ids.a)).toMatchObject({ x: 5, y: 0 });
    expect(state.getVertex(ids.b)).toMatchObject({ x: 13, y: 0 });
    expect(tm.selection).toHaveLength(2);
  });

  it('clic en vacío sin Shift limpia la selección (y deja orbitar al viewport)', () => {
    const { tm, ids } = room();
    tm.setTool('move');
    tm.onPointerDown(pickVertexCtx(ids, 0, 0, 2, 2));
    expect(tm.selection).toHaveLength(1);
    // Punto fuera de la habitación (0..8) y sin objetos → no consume, limpia todo
    expect(tm.onPointerDown(ctx(20, 20))).toBe(false);
    expect(tm.selection).toHaveLength(0);
  });

  it('clic vacío CON Shift conserva la selección múltiple', () => {
    const { tm, ids } = room();
    tm.setTool('move');
    tm.onPointerDown(pickVertexCtx(ids, 0, 0, 2, 2));
    tm.onPointerDown(pickVertexCtx(ids, 10, 0, 4, 2, true));
    expect(tm.onPointerDown(ctx(20, 20, true))).toBe(false);
    expect(tm.selection).toHaveLength(2);
  });

  it('Delete borra TODOS los objetos seleccionados', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    const sp1 = state.addSprite('sprite_blue', 1, 1, 0);
    const sp2 = state.addSprite('sprite_blue', 3, 3, 0);
    tm.select([{ kind: 'sprite', id: sp1.id }, { kind: 'sprite', id: sp2.id }]);
    expect(tm.onDelete()).toBe(true);
    expect(state.world.sprites.length).toBe(0);
    expect(tm.selection).toHaveLength(0);
  });
});