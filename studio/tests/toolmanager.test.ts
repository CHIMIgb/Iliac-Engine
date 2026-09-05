import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { ToolManager } from '../src/tools/ToolManager';

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

describe('ToolManager.onWheel — herramienta Alturas', () => {
  it('deltaY > 0 sube el piso 0.25 (y consume)', () => {
    const { state, tm } = roomWithSector();
    expect(tm.onWheel(100, false)).toBe(true);
    expect(state.world.sectors[0]!.floorH).toBe(0.25);
  });

  it('deltaY < 0 baja el piso 0.25 (y consume)', () => {
    const { state, tm } = roomWithSector();
    expect(tm.onWheel(-100, false)).toBe(true);
    expect(state.world.sectors[0]!.floorH).toBe(-0.25);
  });

  it('sin sector seleccionado no consume la rueda', () => {
    const { state, tm } = roomWithSector();
    tm.select(null);
    expect(tm.onWheel(-100, false)).toBe(false);
  });
});

describe('ToolManager.onWheel — sprite (cualquier herramienta)', () => {
  it('deltaY < 0 baja su altura, sin pasar de 0', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    const spId = state.addSprite('sprite_blue', 4, 4, 1).id;
    tm.select({ kind: 'sprite', id: spId });
    expect(tm.onWheel(-100, false)).toBe(true);
    expect(state.world.sprites[0]!.pos.z).toBe(0.75);
    // No puede bajar del suelo
    expect(tm.onWheel(-1000, false)).toBe(true);
    expect(state.world.sprites[0]!.pos.z).toBe(0.5);
    tm.onWheel(-1000, false);
    expect(state.world.sprites[0]!.pos.z).toBe(0.25);
  });

  it('sprite sin seleccionar no consume la rueda', () => {
    const state = new EditorState();
    const tm = new ToolManager(state);
    expect(tm.onWheel(100, false)).toBe(false);
  });
});