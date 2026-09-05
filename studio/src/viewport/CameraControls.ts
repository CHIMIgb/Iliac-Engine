/**
 * CameraControls — control de la cámara del editor.
 *
 * Dos modos:
 *  - 'game':  cámara de juego (WASD + pointer lock), como en la demo.
 *  - 'orbit': cámara orbital de edición (arrastrar para orbitar, rueda para zoom).
 *
 * Intercambio con Tabulador (o botón del viewport).
 */

export type CameraMode = 'game' | 'orbit';

export interface OrbitState {
  theta: number;  // azimut (rad)
  phi: number;    // elevación (rad)
  radius: number; // distancia al objetivo
  targetX: number;
  targetY: number;
  targetZ: number;
}

export class CameraControls {
  mode: CameraMode = 'orbit';
  orbit: OrbitState = { theta: 0.6, phi: 1.2, radius: 12, targetX: 0, targetY: 0, targetZ: 0 };

  // Estado del modo juego (POS no se gestiona aquí: el motor lo posee).
  // Aquí solo guardamos los ejes de movimiento.
  moveX = 0;
  moveY = 0; // profundidad (adelante/atrás)
  moveSpeed = 0;

  onModeChange?: (mode: CameraMode) => void;

  /** Cambia de modo y notifica. */
  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.onModeChange?.(mode);
  }

  toggleMode(): void {
    this.setMode(this.mode === 'game' ? 'orbit' : 'game');
  }

  /** Procesa la rueda del ratón (zoom en modo orbit). */
  onWheel(deltaY: number): void {
    if (this.mode !== 'orbit') return;
    this.orbit.radius = Math.max(2, Math.min(60, this.orbit.radius + deltaY * 0.01));
  }

  /** Procesa arrastre (orbitar en modo orbit). */
  onDrag(dx: number, dy: number): void {
    if (this.mode !== 'orbit') return;
    // Aumento de sensibilidad (de 0.005 a 0.01) e inversión del eje X (+= dx en lugar de -= dx)
    this.orbit.theta += dx * 0.01;
    this.orbit.phi = Math.max(0.05, Math.min(Math.PI * 0.49, this.orbit.phi - dy * 0.01));
  }

  /** Procesa el arrastre para mover el objetivo (panning sobre la cuadrícula X/Z). */
  onPan(dx: number, dy: number): void {
    if (this.mode !== 'orbit') return;
    const speed = this.orbit.radius * 0.005;
    const rightX = -Math.sin(this.orbit.theta);
    const rightZ = Math.cos(this.orbit.theta);
    const fwdX = -Math.cos(this.orbit.theta);
    const fwdZ = -Math.sin(this.orbit.theta);

    // dx del ratón → lateral (eje derecho), dy → profundidad (eje forward)
    this.orbit.targetX += (dx * rightX + dy * fwdX) * speed;
    this.orbit.targetZ += (dx * rightZ + dy * fwdZ) * speed;
  }

  /** Panning con teclado (WASD = horizontal, QE = vertical). */
  panWASD(dx: number, dz: number, dy = 0): void {
    if (this.mode !== 'orbit') return;
    const rightX = -Math.sin(this.orbit.theta);
    const rightZ = Math.cos(this.orbit.theta);
    const fwdX = -Math.cos(this.orbit.theta);
    const fwdZ = -Math.sin(this.orbit.theta);

    this.orbit.targetX += dx * rightX + dz * fwdX;
    this.orbit.targetZ += dx * rightZ + dz * fwdZ;
    this.orbit.targetY += dy;
  }

  /** Devuelve la posición de la cámara en modo orbit. */
  orbitPosition(): { x: number; y: number; z: number } {
    const { theta, phi, radius, targetX, targetY, targetZ } = this.orbit;
    return {
      x: targetX + radius * Math.sin(phi) * Math.cos(theta),
      y: targetY + radius * Math.cos(phi),
      z: targetZ + radius * Math.sin(phi) * Math.sin(theta),
    };
  }
}

