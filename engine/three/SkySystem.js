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
 *  - "Y-shear" real: el horizonte de la imagen (v=0 del fotograma) se ancla a
 *    la horizontal del mundo desplazando la UV vertical: al levantar la vista
 *    el horizonte baja por pantalla y se clava en el borde inferior (siempre
 *    visible), y por encima la franja superior del fotograma (cenit) se estira
 *    (wrapT ClampToEdge). Nunca se ve el fondo detras del cielo.
 * Render: el quad se dibuja PRIMERO del pase opaco, sin test de profundidad
 * (depthTest:false, depthWrite:false): asi NUNCA se recorta por el plano far
 * ni tiene borde superior alcanzable, y toda la geometria del mundo (que va
 * despues) lo tapa (el horizonte queda "enviado al fondo", como en el original).
 */
import * as THREE from 'three';
import { loadTextures } from './textures.js';
import { SKY_SETS, SKY_FRAMES } from '../core/sky.js';

export { SKY_SETS, SKY_FRAMES } from '../core/sky.js';

const DEG = Math.PI / 180;
const ARC = 110 * DEG;      // arco horizontal que ocupa el fotograma-ventana
const QUAD_DIST = 10;       // distancia del quad anclado a la camara (sin z-test: arbitraria)
const MARGIN = 1.04;        // pequeno margen para que el frustum nunca vea el borde del quad
const IMG_ASPECT = 220 / 512; // alto/ancho del fotograma: altura natural del telon
const BAND_SCALE = 0.7;     // escala del crop UV vertical (conserva la altura angular de la banda)

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
      tex.wrapT = THREE.ClampToEdgeWrapping; // por encima de la franja: el cenit se estira, no se repite
    }
    this.loaded = true;
  }

  addTo(scene) {
    if (!this.loaded) return;
    const mat = new THREE.MeshBasicMaterial({
      map: this.textures[String(this.frame)],
      depthWrite: false,
      // Sin test de profundidad y dibujado primero (renderOrder -3 en el pase
      // opaco): el cielo cubre SIEMPRE todo el viewport (nada de caja de fondo
      // al levantar la camara ni recorte por el plano far) y el mundo, que se
      // dibuja despues, lo tapa por completo donde hay geometria.
      depthTest: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = -3;               // cielo: lo primero del pase opaco
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

  /** Quad anclado a la camara cada frame: cubre TODO el viewport, horizonte anclado por UV. */
  update(camera) {
    if (!this.loaded || this.meshes.length === 0) return;
    const mesh = this.meshes[0];
    const tex = this.textures[String(this.frame)];
    if (!tex) return;
    const fwd = this._v;
    camera.getWorldDirection(fwd);

    // Quad perpendicular a la vista, a distancia fija, del tamano exacto de la
    // seccion del frustum (+margen): por mucho que se levante la camara nunca
    // se ve el fondo detras del cielo (sin z-test tampoco lo recorta el far).
    const fovV = camera.fov * DEG;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const w = 2 * QUAD_DIST * Math.tan(fovH / 2) * MARGIN;
    const h = 2 * QUAD_DIST * Math.tan(fovV / 2) * MARGIN;
    mesh.scale.set(w, h, 1);
    mesh.position.copy(camera.position).addScaledVector(fwd, QUAD_DIST);
    mesh.quaternion.copy(camera.quaternion); // de frente a la camara, sin alabeo

    // Y-shear: la linea v=0 del fotograma (horizonte de la imagen) se coloca a
    // la altura de la horizontal del mundo (y = -d*tan(pitch)), acotada al quad:
    // mirando arriba el horizonte queda clavado en el borde inferior de pantalla
    // (siempre visible) y el cielo llena el resto; la franja > 1 se estira (ClampToEdge).
    const cosP = Math.max(Math.sqrt(Math.max(0, 1 - fwd.y * fwd.y)), 1e-3);
    const yH = Math.max(-h / 2, Math.min(h / 2, -QUAD_DIST * (fwd.y / cosP)));

    // Escala angular constante: cada copia del tile horizontal ocupa ARC y la
    // banda vertical termina a la misma elevacion que el antiguo telon (h/D).
    const planeArc = Math.max(fovH * MARGIN, ARC);
    const bandH = QUAD_DIST * 2 * IMG_ASPECT * BAND_SCALE * Math.tan(planeArc / 2);
    tex.repeat.x = (fovH * MARGIN) / ARC;
    tex.offset.x = 0;
    tex.repeat.y = (BAND_SCALE * h) / bandH;
    tex.offset.y = -(BAND_SCALE * (h / 2 + yH)) / bandH;
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
