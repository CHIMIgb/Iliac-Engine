/**
 * CompassOverlay — brújula HUD (rosa N/E/S/O) en la esquina inferior derecha.
 *
 * Es un overlay 2D del MOTOR (vive en three/ porque es render/HUD del viewport):
 * los consumidores (demo, Studio playtest) solo llaman `engine.setCompass(on)`.
 * La rosa rota con el yaw del jugador: el norte del mundo es -Z de Three, que
 * coincide con el polo de la aurora boreal (SunSystem). No usa Three.js: dibuja
 * con el canvas 2D plano (cero objetos 3D, cero coste por frame).
 */

/** Ángulo de pantalla (rad) para que la N quede arriba cuando el jugador mira
 *  al norte (yaw = -π/2 en el motor: forward = (cos yaw, sin yaw) sobre X/Z,
 *  norte = -Z). Derivación: la N debe apuntar hacia -Z del mundo, que en
 *  coordenadas de la rosa es atan2(-cos yaw, -sin yaw). Exportada para tests. */
export function compassRotation(yaw) {
  return Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}

const SIZE = 96;
const S = SIZE / 2; // centro

export class CompassOverlay {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.canvas.style.cssText =
      'position:fixed;right:12px;bottom:12px;width:96px;height:96px;' +
      'pointer-events:none;z-index:10;';
    this.ctx = this.canvas.getContext('2d');
    this._lastYaw = null;
  }

  /**
   * Redibuja la brújula si el yaw cambió. Llamada por Engine3D.render().
   * @param {number} yaw yaw del jugador (radianes)
   */
  update(yaw) {
    if (yaw === this._lastYaw || !this.ctx) return;
    this._lastYaw = yaw;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, SIZE, SIZE);
    // Fondo translúcido + anillo.
    ctx.beginPath();
    ctx.arc(S, S, S - 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,30,46,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(137,180,250,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(S, S);
    ctx.rotate(compassRotation(yaw));

    // Marcas de 8 rumbos.
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r1 = i % 2 === 0 ? 34 : 30;
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
    }
    ctx.strokeStyle = 'rgba(205,214,244,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Letras N/E/S/O (norte destacado en azul).
    ctx.font = 'bold 13px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = [
      ['N', 0, -27, 'rgba(137,180,250,1)'],
      ['E', 27, 0, 'rgba(166,173,200,0.9)'],
      ['S', 0, 27, 'rgba(166,173,200,0.9)'],
      ['O', -27, 0, 'rgba(166,173,200,0.9)'],
    ];
    for (const [txt, x, y, col] of labels) {
      ctx.fillStyle = col;
      ctx.fillText(txt, x, y);
    }
    ctx.restore();
  }

  /** Quita la brújula del DOM (necesario si se recrea el motor). */
  dispose() {
    this.canvas.remove();
  }
}