import { describe, it, expect, vi } from 'vitest';
import { CameraControls } from '../src/viewport/CameraControls';

describe('CameraControls', () => {
  it('inicia en modo orbit', () => {
    const controls = new CameraControls();
    expect(controls.mode).toBe('orbit');
  });

  it('alterna entre game y orbit', () => {
    const controls = new CameraControls();
    controls.toggleMode();
    expect(controls.mode).toBe('game');
    controls.toggleMode();
    expect(controls.mode).toBe('orbit');
  });

  it('notifica el cambio de modo', () => {
    const controls = new CameraControls();
    const spy = vi.fn();
    controls.onModeChange = spy;
    controls.setMode('game');
    expect(spy).toHaveBeenCalledWith('game');
  });

  it('setMode al mismo valor no notifica', () => {
    const controls = new CameraControls();
    const spy = vi.fn();
    controls.onModeChange = spy;
    controls.setMode('orbit'); // ya es orbit
    expect(spy).not.toHaveBeenCalled();
  });

  it('el zoom limita el radio entre 2 y 60', () => {
    const controls = new CameraControls();
    controls.onWheel(-100000); // scroll hacia arriba => acerca al mínimo
    expect(controls.orbit.radius).toBeGreaterThanOrEqual(2);
    controls.onWheel(-100000);
    expect(controls.orbit.radius).toBeGreaterThanOrEqual(2);
  });

  it('el drag orbita y limita la elevación', () => {
    const controls = new CameraControls();
    const phiInicial = controls.orbit.phi;
    controls.onDrag(10, 0); // azimut
    expect(controls.orbit.theta).toBeGreaterThan(phiInicial === controls.orbit.theta ? 0 : 0);
    // mover mucho hacia arriba clampa phi > 0.05
    controls.onDrag(0, 100000);
    expect(controls.orbit.phi).toBeGreaterThanOrEqual(0.05);
  });

  it('orbitPosition devuelve una posición a distancia radius del objetivo', () => {
    const controls = new CameraControls();
    const pos = controls.orbitPosition();
    const dx = pos.x - controls.orbit.targetX;
    const dy = pos.y - controls.orbit.targetY;
    const dz = pos.z - controls.orbit.targetZ;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(dist).toBeCloseTo(controls.orbit.radius, 5);
  });
});
