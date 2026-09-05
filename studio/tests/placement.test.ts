import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { assemble } from '../src/dungeons/assemble';
import { DUNGEONS } from '../src/dungeons/definitions';
import { findSpot } from '../src/dungeons/placement';
import { GRID } from '../src/tools/picking';

const CRYPT = assemble(DUNGEONS[0]!); // cripta 3×2 → 48×32

function roomAt(x: number, y: number, size = 8): EditorState {
  const state = new EditorState();
  const a = state.addVertex(x, y);
  const b = state.addVertex(x + size, y);
  const c = state.addVertex(x + size, y + size);
  const d = state.addVertex(x, y + size);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  return state;
}

describe('findSpot', () => {
  it('mundo vacío → centro (0,0)', () => {
    expect(findSpot(new EditorState(), CRYPT)).toEqual({ x: 0, y: 0 });
  });

  it('centro ocupado → primer hueco libre de la espiral, alineado a la cuadrícula', () => {
    const state = roomAt(0, 0); // sala 8×8 en el centro
    const spot = findSpot(state, CRYPT);
    expect(spot).not.toBeNull();
    if (!spot) throw new Error('esperaba un hueco libre');
    expect(spot).toEqual({ x: 16, y: -16 }); // primer libre del anillo 1
    expect(Math.abs(spot.x % GRID)).toBe(0);
    expect(Math.abs(spot.y % GRID)).toBe(0);
    // La cripta colocada ahí no solapa la sala
    const xMin = spot.x, xMax = spot.x + CRYPT.width;
    const yMin = spot.y, yMax = spot.y + CRYPT.height;
    expect(xMax <= 0 || xMin >= 8 || yMax <= 0 || yMin >= 8).toBe(true);
  });

  it('sin hueco dentro del límite → null', () => {
    // Sala gigante centrada que cubre todo el rango de la espiral (±640+48)
    const state = roomAt(-1000, -1000, 2000);
    expect(findSpot(state, CRYPT)).toBeNull();
  });

  it('todas las definiciones devuelven offsets alineados a la cuadrícula', () => {
    for (const def of DUNGEONS) {
      const spot = findSpot(new EditorState(), assemble(def));
      expect(spot, def.id).toEqual({ x: 0, y: 0 });
    }
  });
});