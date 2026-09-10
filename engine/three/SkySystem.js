/**
 * SkySystem.js — horizonte lejano estilo Daggerfall CLÁSICO (telón 2D).
 *
 * Como en el motor de 1996: el cielo NO es un skybox 3D. Son DOS imágenes
 * planas 2D (billboards) siempre de frente a la cámara, ancladas a la línea
 * del horizonte:
 *  - Scroll horizontal por yaw: 32 fotogramas precalculados por capa
 *    (ventanas de la panorámica) + micro-desplazamiento UV entre fotogramas
 *    → giro continuo sin costuras ni saltos.
 *  - "Y-shearing" gratis: el telón se ancla a la horizontal del mundo, así
 *    que al mirar arriba/abajo la banda se desliza en pantalla solo lo justo
 *    para mantener el horizonte pegado al terreno (como en Doom/Duke).
 *  - Dos capas en BANDAS complementarias que no se solapan: 0 = lejana (sus
 *    montañas/nubes cuelgan SOBRE la línea de árboles), 1 = cercana (silueta
 *    del bosque pegada al horizonte). Ambas scrollean 1:1 con el yaw: tras
 *    360° todo vuelve a su sitio (nada de "avanza el tiempo al girar").
 * Render: el telón se dibuja con z-buffer a profundidad fija (D=150/160) y
 * `depthWrite:false`: todo lo más cercano del mundo lo tapa (el horizonte
 * queda "enviado al fondo", como en el original), y él nunca tapa el mapa.
 */
import * as THREE from 'three';
import { loadTextures } from './textures.js';

export const SKY_SETS = 31;
export const SKY_FRAMES = 32;

const DEG = Math.PI / 180;
const ARC = (110 * DEG);      // arco horizontal que ocupa cada fotograma-ventana
const D_NEAR = 150;          // distancias arbitrarias: el z-buffer las ordena
const D_FAR = 160;
// Bandas VERTICALES complementarias, NO superpuestas (los PNG de cada capa
// contienen cielo+silueta completos; apilar dos columnas era lo que duplicaba
// e "achataba" el horizonte). La lejana cuelga SOBRE la cercana: las dos
// comparten un par de grados de solape (se oculta con renderOrder/depth).
// ponytail: TOP/BOTTOM a ojo en playtest.
const TOP_FAR = 68 * DEG;    // nubes/cielo del telón lejano, hasta casi el cénit
const BOTTOM_FAR = 8 * DEG;  // sus montañas arrancan sobre la línea de árboles
const TOP_NEAR = 13 * DEG;   // banda corta: la silueta del bosque
const BOTTOM_NEAR = -2 * DEG;
// Las dos capas scrollean 1:1 con el yaw: tras 360° exactos TODO vuelve al
// mismo fotograma. (Un 0,5× de "paralaje" hacía que media vuelta corriera el
// cielo y pareciera que "avanza el tiempo" al girar — eliminado.)

/** Índice de fotograma [0,frames) para un yaw (rad), envolvente y para negativos. */
export function skyFrameIndex(yaw, frames = SKY_FRAMES) {
  const TAU = Math.PI * 2;
  const norm = ((yaw % TAU) + TAU) % TAU;
  return Math.floor((norm / TAU) * frames) % frames;
}

/** URL del PNG de un set/capa/frame (con stride, frames se mapean a 0,2,4…). */
export function skyFrameUrl(base, set, layer, frame) {
  return `${base}SKY${String(set).padStart(2, '0')}/${layer}-${frame}.PNG`;
}

/** Firma para detectar cambios de cielo en el reload en vivo. */
export function skySignature(cfg) {
  return JSON.stringify(cfg ?? null);
}

export class SkySystem {
  /**
   * @param {{set:number, stride?:1|2, base?:string}} cfg
   */
  constructor(cfg = {}) {
    this.set = Number.isInteger(cfg.set) ? cfg.set : null;
    this.stride = cfg.stride === 2 ? 2 : 1;
    this.base = cfg.base ?? '/sky/';
    this.textures = {};
    this.meshes = [];
    this.loaded = false;
    this._prevYaw = 0;
    this._v = new THREE.Vector3();
  }

  /** Carga todas las texturas del set (una vez, en paralelo). */
  async load() {
    if (this.set == null) return;
    const n = Math.floor(SKY_FRAMES / this.stride);
    const defs = {};
    for (let l = 0; l < 2; l++) {
      for (let f = 0; f < n; f++) {
        defs[`${l}:${f}`] = encodeURI(skyFrameUrl(this.base, this.set, l, f * this.stride));
      }
    }
    this.textures = await loadTextures(defs);
    for (const tex of Object.values(this.textures)) {
      tex.wrapS = THREE.RepeatWrapping; // micro-scroll UV dentro de la ventana
    }
    this.loaded = true;
  }

  addTo(scene) {
    if (!this.loaded) return;
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let l = 0; l < 2; l++) {
      const near = l === 1;
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures[`${l}:0`],
        transparent: true,
        depthWrite: false,
        // CON z-buffer: el telón vive a profundidad D (150/160), así que
        // CUALQUIER geometría del mundo más cercana lo tapa (antes, con
        // depthTest:false, Three pintaba lo transparente después del mundo
        // y el horizonte tapaba el mapa). depthWrite:false para que el cielo
        // nunca tape a otros transparentes (sprites).
        depthTest: true,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo.clone(), mat);
      mesh.renderOrder = near ? -2 : -3;      // cielo: primero lo lejos, luego lo cerca
      mesh.frustumCulled = false;
      mesh.userData.isSky = true;             // WorldMesh.clear debe saltarlos
      mesh.userData.layer = l;
      mesh.userData.dist = near ? D_NEAR : D_FAR;
      mesh.userData.top = near ? TOP_NEAR : TOP_FAR;
      mesh.userData.bottom = near ? BOTTOM_NEAR : BOTTOM_FAR;
      this.meshes.push(mesh);
      scene.add(mesh);
    }
  }

  /** Telón cada frame: anclarse a la horizontal de cámara, elegir fotograma y scrollear. */
  update(camera) {
    if (!this.loaded || this.meshes.length === 0) return;
    const fwd = this._v.clone();
    camera.getWorldDirection(fwd);
    let hx = fwd.x;
    let hz = fwd.z;
    const hl = Math.hypot(hx, hz);
    if (hl < 1e-4) { hx = Math.cos(this._prevYaw); hz = Math.sin(this._prevYaw); } // mirando al cenit: mantener la última horizontal
    else { hx /= hl; hz /= hl; this._prevYaw = Math.atan2(hz, hx); }
    const yaw = Math.atan2(hz, hx);          // convención Engine3D: (cos yaw, sin yaw)
    const n = Math.floor(SKY_FRAMES / this.stride);
    const step = (Math.PI * 2) / n;
    const fovH = 2 * Math.atan(Math.tan((camera.fov * DEG) / 2) * camera.aspect);

    for (const mesh of this.meshes) {
      const near = mesh.userData.layer === 1;
      const D = mesh.userData.dist;
      const topRad = mesh.userData.top;
      const botRad = mesh.userData.bottom;
      const norm = ((yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const f = skyFrameIndex(yaw, n);

      // Geometría del telón: el ancho cubre el FOV con la imagen REPETIDA
      // horizontalmente (tiling, como en el original: "imágenes planas que se
      // repiten"), manteniendo la escala angular exacta de la ventana ARC.
      const planeArc = Math.max(fovH * 1.3, ARC);
      const w = 2 * D * Math.tan(planeArc / 2);
      const topY = D * Math.tan(topRad);
      const botY = D * Math.tan(botRad);
      mesh.scale.set(w, topY - botY, 1);

      // Centrado a media altura de la banda, a D en la horizontal de cámara.
      const cy = camera.position.y + (topY + botY) / 2;
      mesh.position.set(
        camera.position.x + hx * D,
        cy,
        camera.position.z + hz * D,
      );
      mesh.rotation.set(0, Math.atan2(hx, hz) + Math.PI, 0); // de frente a la cámara, sin alabeo

      const tex = this.textures[`${mesh.userData.layer}:${f}`];
      if (tex) {
        if (mesh.material.map !== tex) mesh.material.map = tex;
        // Tiling + scroll sub-paso: la imagen llena la ventana ARC y se repite
        // para cubrir el FOV; el offset UV desliza de forma CONTINUA el tramo
        // recorrido dentro de la ventana (scrolleo 2D del original, sin saltos
        // al cambiar de fotograma).
        tex.repeat.x = planeArc / ARC;
        tex.offset.x = -(norm - f * step) / ARC;
      }
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
      tex.dispose?.();
    }
    this.textures = {};
    this.loaded = false;
  }
}
