/**
 * SkySystem.js — horizonte lejano estilo Daggerfall CLÁSICO (telón 2D, capa 0).
 *
 * Como en el motor de 1996: el cielo NO es un skybox 3D. Es una imagen
 * plana 2D (billboard) siempre de frente a la cámara, anclada a la línea
 * del horizonte:
 *  - El telón es FIJO: NO cambia al girar el yaw (se retiró el scroll por los
 *    32 fotogramas-ventana: sin paralaje real solo hacía que el horizonte
 *    "avanzara" al girar).
 *  - Los assets se organizan en sets SKY00–SKY30 (horizontes/escenarios) y,
 *    dentro de cada set, 32 franjas del día (fotogramas 0–31 de la capa 0).
 *    `set` elige el horizonte; `frame` elige la franja/iluminación del día.
 *    Son independientes: cambiar la hora cambia la franja, no el horizonte.
 *  - "Y-shearing" gratis: el telón se ancla a la horizontal del mundo, así
 *    que al mirar arriba/abajo la banda se desliza en pantalla solo lo justo
 *    para mantener el horizonte pegado al terreno (como en Doom/Duke).
 * Render: el telón se dibuja con z-buffer a profundidad fija (D=150) y
 * `depthWrite:false`: todo lo más cercano del mundo lo tapa (el horizonte
 * queda "enviado al fondo", como en el original), y él nunca tapa el mapa.
 */
import * as THREE from 'three';
import { loadTextures } from './textures.js';
import { SKY_SETS, SKY_FRAMES } from '../core/sky.js';

export { SKY_SETS, SKY_FRAMES } from '../core/sky.js';

const DEG = Math.PI / 180;
const ARC = 110 * DEG;      // arco horizontal que ocupa el fotograma-ventana
const D = 500;              // distancia: más lejos que el terreno, detrás de todo
const IMG_ASPECT = 220 / 512; // alto/ancho del fotograma: altura natural del telón
const BAND_SCALE = 0.4;     // porcentaje de la textura que mostramos (crop UV);
                            // el horizonte se ve más delgado y lejano, sin deformar

/** URL del PNG de un set/capa/frame. */
export function skyFrameUrl(base, set, layer, frame) {
  return `${base}SKY${String(set).padStart(2, '0')}/${layer}-${frame}.PNG`;
}

/** Firma para detectar cambios de SET de cielo en el reload en vivo.
 *  El frame se sincroniza por separado (sin recargar texturas). */
export function skySignature(cfg) {
  return JSON.stringify(cfg ? { set: cfg.set, base: cfg.base } : null);
}

export class SkySystem {
  /**
   * @param {{set:number, frame?:number, base?:string}} cfg
   */
  constructor(cfg = {}) {
    this.set = Number.isInteger(cfg.set) ? cfg.set : null;
    this.frame = Number.isInteger(cfg.frame) ? cfg.frame : 0;
    this.base = cfg.base ?? '/sky/';
    this.textures = {};
    this.meshes = [];
    this.loaded = false;
    this._prevYaw = 0;
    this._v = new THREE.Vector3();
  }

  /** Carga las 32 franjas del día del set activo (capa 0) en paralelo. */
  async load() {
    if (this.set == null) return;
    const defs = {};
    for (let f = 0; f < SKY_FRAMES; f++) {
      defs[f] = encodeURI(skyFrameUrl(this.base, this.set, 0, f));
    }
    this.textures = await loadTextures(defs);
    for (const tex of Object.values(this.textures)) {
      tex.wrapS = THREE.RepeatWrapping; // tiling para FOV anchos
    }
    this.loaded = true;
  }

  addTo(scene) {
    if (!this.loaded) return;
    const mat = new THREE.MeshBasicMaterial({
      map: this.textures[String(this.frame)],
      transparent: true,
      depthWrite: false,
      // CON z-buffer: el telón vive a profundidad D, así que CUALQUIER
      // geometría del mundo más cercana lo tapa (el horizonte queda al fondo,
      // como en el original). depthWrite:false para que nunca tape sprites.
      depthTest: true,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = -3;               // cielo: lo primero del orden transparente
    mesh.frustumCulled = false;
    mesh.userData.isSky = true;          // WorldMesh.clear debe saltarlos
    this.meshes.push(mesh);
    scene.add(mesh);
  }

  /** Cambia la franja del día sin recargar texturas. */
  setFrame(frame) {
    if (!this.loaded || this.meshes.length === 0) return;
    this.frame = frame;
    const tex = this.textures[String(frame)];
    if (tex && this.meshes[0].material.map !== tex) {
      this.meshes[0].material.map = tex;
    }
  }

  /** Telón cada frame: billboard de frente a la cámara, anclado al horizonte. */
  update(camera) {
    if (!this.loaded || this.meshes.length === 0) return;
    const fwd = this._v.clone();
    camera.getWorldDirection(fwd);
    let hx = fwd.x;
    let hz = fwd.z;
    const hl = Math.hypot(hx, hz);
    if (hl < 1e-4) { hx = Math.cos(this._prevYaw); hz = Math.sin(this._prevYaw); } // mirando al cenit: mantener la última horizontal
    else { hx /= hl; hz /= hl; this._prevYaw = Math.atan2(hz, hx); }
    const fovH = 2 * Math.atan(Math.tan((camera.fov * DEG) / 2) * camera.aspect);
    const mesh = this.meshes[0];

    // Geometría del telón: el ancho cubre el FOV con la imagen REPETIDA
    // horizontalmente (tiling), manteniendo la escala angular exacta de la
    // ventana ARC. El alto es el ancho por la proporción del fotograma
    // multiplicado por BAND_SCALE: mostramos solo la parte baja de la textura
    // (crop UV) para que el horizonte se vea más delgado y lejano.
    const planeArc = Math.max(fovH * 1.3, ARC);
    const w = 2 * D * Math.tan(planeArc / 2);
    const h = w * IMG_ASPECT * BAND_SCALE;
    mesh.scale.set(w, h, 1);

    // Borde inferior clavado en la horizontal de cámara (el horizonte);
    // la mitad inferior del fotograma (suelo oscuro) queda tras el terreno.
    mesh.position.set(
      camera.position.x + hx * D,
      camera.position.y + h / 2,
      camera.position.z + hz * D,
    );
    mesh.rotation.set(0, Math.atan2(hx, hz) + Math.PI, 0); // de frente a la cámara, sin alabeo

    const tex = this.textures[String(this.frame)];
    if (tex) {
      tex.repeat.x = planeArc / ARC;
      // Crop vertical: solo la parte baja de la textura, sin deformar.
      tex.repeat.y = BAND_SCALE;
      tex.offset.y = 0;
    }
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.material.dispose();
      m.removeFromParent();
    }
    this.meshes = [];
    for (const tex of Object.values(this.textures)) {
      tex?.dispose?.();
    }
    this.textures = {};
    this.loaded = false;
  }
}
