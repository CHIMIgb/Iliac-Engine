/**
 * sky-style.test.ts — estilos de cielo (F4.7): el Studio escribe
 * { style:'realista', hour, dayLengthSec, shadows, sunTilt } y el motor lo
 * lee. Diezmo el round-trip por el Serializer (contrato de datos) y la
 * retrocompatibilidad: sin `style` el cielo sigue siendo clásico.
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { toProjectJson, fromProjectJson, validateProjectJson } from '../src/io/Serializer';

function fresh(): EditorState {
  const s = new EditorState();
  // El constructor de EditorState usa el proyecto de ejemplo sin sky: añadimos
  // uno clásico para probar el cambio de estilo.
  s.setSky({ set: 15, frame: 17 });
  return s;
}

describe('EditorState · estilos de cielo (herramienta 8, F4.7)', () => {
  it('setSky escribe un cielo realista con hora y avanza', () => {
    const s = fresh();
    let changes = 0;
    s.onChange(() => changes++);

    s.setSky({ style: 'realista', hour: 12.5, dayLengthSec: 1200, shadows: true, sunTilt: 23.5 });
    expect(s.world.sky).toEqual({ style: 'realista', hour: 12.5, dayLengthSec: 1200, shadows: true, sunTilt: 23.5 });
    expect(changes).toBe(1);
  });

  it('el cielo realista no arrastra set/frame (contrato del validate)', () => {
    const s = fresh();
    s.setSky({ style: 'realista', hour: 20 });
    const sky = s.world.sky;
    expect(sky).not.toBeNull();
    expect(sky!.style).toBe('realista');
    expect(sky!.set).toBeUndefined();
    expect(sky!.frame).toBeUndefined();
  });

  it('round-trip por el Serializer conserva el estilo realista', () => {
    const s = fresh();
    s.setSky({ style: 'realista', hour: 6.25, dayLengthSec: 600, shadows: false, sunTilt: 30 });
    const json = toProjectJson(s);
    expect(validateProjectJson(json)).toEqual([]); // sin errores de schema

    const s2 = fromProjectJson(json);
    expect(s2.world.sky).toEqual({ style: 'realista', hour: 6.25, dayLengthSec: 600, shadows: false, sunTilt: 30 });
  });

  it('sin style el cielo sigue siendo clásico con set/frame', () => {
    const s = fresh();
    const json = toProjectJson(s);
    expect(json.world.sky).toEqual({ set: 15, frame: 17 });
    expect(fromProjectJson(json).world.sky).toEqual({ set: 15, frame: 17 });
  });
});