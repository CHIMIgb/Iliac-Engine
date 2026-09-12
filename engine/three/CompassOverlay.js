/**
 * CompassOverlay — brújula HUD: cinta de rumbo HORIZONTAL (heading tape).
 *
 * Es un overlay 2D del MOTOR (vive en three/ porque es render/HUD del viewport):
 * los consumidores (demo, Studio playtest) solo llaman `engine.setCompass(on)`.
 * La cinta se desliza con el yaw del jugador: el norte del mundo es -Z de Three,
 * que coincide con el polo de la aurora boreal (SunSystem). Sin Three.js y sin
 * canvas: DOM + CSS (una barra con marcas cada 5° que se mueve con
 * translateX(-rumbo × 4px), marcador central fijo).
 *
 * Anclaje: position:absolute + contenedor. El Studio pasa el viewport del
 * editor (.editor-viewport, position:relative) → la cinta queda DENTRO del
 * juego en el playtest; la demo usa el body (quedó centrada abajo igualmente).
 */

/**
 * Convierte el yaw del motor (rad, forward = (cos yaw, sin yaw) sobre X/Z,
 * norte = -Z) al RUMBO NÁUTICO en grados 0–360 (0 = N, 90 = E, 180 = S,
 * 270 = O, sentido horario). Derivación: yaw 0 mira a +X (este) → 90°;
 * yaw -π/2 a -Z (norte) → 0°; yaw +π/2 a +Z (sur) → 180°, o sea
 * heading = 90° + yaw. Exportada para tests.
 * @param {number} yaw radianes
 * @returns {number} 0–360
 */
export function headingDeg(yaw) {
  return (((yaw * 180) / Math.PI + 90) % 360 + 360) % 360;
}

const SPACING = 4; // píxeles por grado (la cinta se mueve 4px por cada grado)
const WIDTH = 400;
const HEIGHT = 56;
const HALF = 250; // marcas de -90° a +450° para no dejar huecos al girar

const CSS = `
  .rc-compass{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;border:1px solid rgba(137,180,250,.5);background:rgba(30,30,46,.72);box-shadow:0 4px 12px rgba(0,0,0,.5);z-index:10;pointer-events:none;user-select:none}
  .rc-compass::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 18px rgba(0,0,0,.55);pointer-events:none}
  .rc-tape{position:absolute;left:50%;height:100%;display:flex;align-items:flex-end;padding-bottom:5px;box-sizing:border-box}
  .rc-mark{position:absolute;top:0;display:flex;flex-direction:column;align-items:center;width:8px;transform:translateX(-50%)}
  .rc-mark::before{content:'';width:2px;height:10px;background:#6c7086}
  .rc-mark.major::before{height:18px;background:#cdd6f4}
  .rc-mark .txt{font:700 12px 'Inter',sans-serif;color:#a6adc8;line-height:18px;white-space:nowrap}
  .rc-mark.cardinal .txt{color:#89b4fa;font-size:14px}
  .rc-marker{position:absolute;top:0;left:50%;transform:translateX(-50%);width:4px;height:100%;background:#f38ba8;z-index:10}
  .rc-marker::after{content:'';position:absolute;left:50%;top:-8px;transform:translateX(-50%);border:6px solid transparent;border-top:8px solid #f38ba8}
`;

export class CompassOverlay {
  /**
   * @param {HTMLElement} [container=document.body] dónde anclar la cinta.
   */
  constructor(container = document.body) {
    if (!document.getElementById('rc-compass-style')) {
      const st = document.createElement('style');
      st.id = 'rc-compass-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }

    this.el = document.createElement('div');
    this.el.className = 'rc-compass';

    this.tape = document.createElement('div');
    this.tape.className = 'rc-tape';
    this.el.appendChild(this.tape);

    const marker = document.createElement('div');
    marker.className = 'rc-marker';
    this.el.appendChild(marker);

    // Marcas de -90° a +450° (con envoltura para que al girar la cinta nunca
    // quede vacía en los extremos). Cardinales 0/90/180/270, números cada 30°,
    // tick grande cada 15°.
    const cardinals = { 0: 'N', 90: 'E', 180: 'S', 270: 'O', 360: 'N' };
    for (let i = -90; i <= 450; i += 5) {
      let g = ((i % 360) + 360) % 360;
      if (g === 0 && i > 360) g = 360;
      const m = document.createElement('div');
      m.className = 'rc-mark';
      m.style.left = `${i * SPACING}px`;
      if (cardinals[g] !== undefined) {
        m.classList.add('major', 'cardinal');
        m.insertAdjacentHTML('beforeend', `<span class="txt">${cardinals[g]}</span>`);
      } else if (g % 30 === 0) {
        m.classList.add('major');
        m.insertAdjacentHTML('beforeend', `<span class="txt">${g}</span>`);
      } else if (g % 15 === 0) {
        m.classList.add('major');
      }
      this.tape.appendChild(m);
    }

    this._lastYaw = null;
    container.appendChild(this.el);
  }

  /**
   * Desliza la cinta si el yaw cambió. Llamada por Engine3D.render().
   * @param {number} yaw yaw del jugador (radianes)
   */
  update(yaw) {
    if (yaw === this._lastYaw) return;
    this._lastYaw = yaw;
    const h = headingDeg(yaw);
    this.tape.style.transform = `translateX(${-h * SPACING}px)`;
  }

  /** Quita la brújula del DOM (necesario si se recrea el motor). */
  dispose() {
    this.el.remove();
  }
}