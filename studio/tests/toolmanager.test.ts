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