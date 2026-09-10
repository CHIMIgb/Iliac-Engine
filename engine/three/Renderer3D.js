import * as THREE from 'three';
import { createFog } from './fog.js';

/**
 * Pantalla de salida del motor: buffer intermedio (WebGLRenderTarget) +
 * quad a pantalla completa con el shader CRT. Sin dependencias extra
 * (solo three puro): así el demo sin build también puede usarlo.
 * Config desde project.json → render: { resolution: [w,h] | null, crt: bool }.
 */
const CRT_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const CRT_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uRes;      // tamaño del buffer interno (para scanlines por fila)
uniform float uOn;      // 1 = CRT, 0 = pase directo
uniform vec3 uBg;       // color de fondo fuera de la pantalla curvada
varying vec2 vUv;
void main() {
  if (uOn < 0.5) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }
  vec2 p = vUv * 2.0 - 1.0;
  float r2 = dot(p, p);
  vec2 q = p * (1.0 + 0.12 * r2);          // curvatura barrel (CRT)
  vec2 uv2 = q * 0.5 + 0.5;
  if (uv2.x < 0.0 || uv2.x > 1.0 || uv2.y < 0.0 || uv2.y > 1.0) {
    gl_FragColor = vec4(uBg, 1.0);
    return;
  }
  vec3 c = texture2D(tDiffuse, uv2).rgb;
  c *= 0.82 + 0.18 * sin(uv2.y * uRes.y * 3.14159265); // scanlines por fila
  float vig = smoothstep(1.15, 0.35, length(q));       // viñeteado
  c *= mix(0.65, 1.0, vig);
  gl_FragColor = vec4(c, 1.0);
}`;

export class Renderer3D {
  constructor(canvas, renderSettings = {}) {
    this.canvas = canvas;
    this.renderSettings = renderSettings;
    this.createRenderer = renderSettings.createRenderer || this._defaultCreateRenderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(renderSettings.backgroundColor ?? 0x202020);

    // Niebla atmosférica opcional: la lee de project.json (render.fog).
    this.scene.fog = createFog(renderSettings.fog, renderSettings.backgroundColor ?? 0x202020);

    this.camera = new THREE.PerspectiveCamera(
      renderSettings.fov ?? 75,
      canvas.width / canvas.height,
      renderSettings.near ?? 0.05,
      renderSettings.far ?? 200,
    );

    // Resolución del playtest (ej. [480,300]) y CRT: render: { resolution, crt }.
    this.fixedRes = Array.isArray(renderSettings.resolution) && renderSettings.resolution.length === 2
      ? [Math.round(renderSettings.resolution[0]), Math.round(renderSettings.resolution[1])]
      : null;
    this.crt = !!renderSettings.crt;

    this._createRenderer();
    this._addLights(renderSettings);
    this._bindContextLost();
    this.sky = null; // SkySystem asignado por Engine3D; actualiza en render()
  }

  _defaultCreateRenderer(canvas) {
    return new THREE.WebGLRenderer({ canvas, antialias: false });
  }

  _createRenderer() {
    this.renderer = this.createRenderer(this.canvas);
    if (this.fixedRes) {
      // Buffer fijo bajo: el navegador estira el canvas al CSS con píxeles
      // duros = look retro. El aspect de cámara sigue al buffer, no a la ventana.
      this.renderer.setSize(this.fixedRes[0], this.fixedRes[1], false);
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.imageRendering = 'pixelated';
      this.camera.aspect = this.fixedRes[0] / this.fixedRes[1];
    } else {
      this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    }
    this.camera.updateProjectionMatrix();
  }

  _addLights(settings = {}) {
    const ambientCfg = settings.ambientLight ?? { color: 0xffffff, intensity: 0.6 };
    const ambient = new THREE.AmbientLight(ambientCfg.color, ambientCfg.intensity);
    this.scene.add(ambient);

    const dirCfg = settings.directionalLight ?? { color: 0xffffff, intensity: 0.7, position: [5, 10, 5] };
    const dir = new THREE.DirectionalLight(dirCfg.color, dirCfg.intensity);
    dir.position.set(...dirCfg.position);
    this.scene.add(dir);
  }

  // Manejo de webglcontextlost: Three.js necesita poder restaurar el contexto
  // (preventDefault) y recrear el renderer al restaurarse.
  _bindContextLost() {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      // Los bufos de geometría se re-suben en el próximo render; solo hace
      // falta recrear el renderer sobre el contexto restaurado.
      this._createRenderer();
      this.resize(this.canvas.width, this.canvas.height);
    });
  }

  syncCamera(player) {
    const px = player.posX;
    const py = player.posZ;
    const pz = player.posY;

    const fx = Math.cos(player.pitch) * Math.cos(player.yaw);
    const fy = Math.sin(player.pitch);
    const fz = Math.cos(player.pitch) * Math.sin(player.yaw);

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(px + fx, py + fy, pz + fz);
  }

  render() {
    if (this.contextLost) return;
    // El cielo sigue a la cámara real (orbit del editor o jugador): mismo
    // punto de enganche para ambos modos.
    this.sky?.update(this.camera);

    const post = this.crt ? this._ensurePost() : null;
    if (!post) { this.renderer.render(this.scene, this.camera); return; }

    // Pase 1: la escena al buffer interno. Pase 2: quad CRT a pantalla.
    this.renderer.setRenderTarget(post.rt);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    const u = post.mat.uniforms;
    u.tDiffuse.value = post.rt.texture;
    u.uOn.value = this.crt ? 1 : 0;
    u.uRes.value.set(post.rt.width, post.rt.height);
    this.renderer.render(post.scene, post.camera);
  }

  /**
   * Escena de post-proceso (buffer + quad con shader CRT). Se crea una vez
   * y se redimensiona solo cuando cambia el tamaño del buffer.
   */
  _ensurePost() {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const [w, h] = [size.x || this.canvas.width, size.y || this.canvas.height];
    if (!this._post) {
      const rt = new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: this.crt ? THREE.LinearFilter : THREE.NearestFilter,
        depthBuffer: true,
      });
      const mat = new THREE.ShaderMaterial({
        vertexShader: CRT_VERT,
        fragmentShader: CRT_FRAG,
        uniforms: {
          tDiffuse: { value: rt.texture },
          uRes: { value: new THREE.Vector2(w, h) },
          uOn: { value: 0 },
          uBg: { value: this.scene.background?.clone?.() ?? new THREE.Color(0x202020) },
        },
        depthTest: false,
        depthWrite: false,
      });
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this._post = { rt, mat, scene, camera: new THREE.Camera() };
    } else if (this._post.rt.width !== w || this._post.rt.height !== h) {
      this._post.rt.setSize(w, h);
      this._post.mat.uniforms.uRes.value.set(w, h);
    }
    return this._post;
  }

  resize(width, height) {
    if (this.contextLost) return;
    if (this.fixedRes) return; // buffer fijo del playtest: la ventana no lo cambia
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this._post) {
      this._post.rt.dispose();
      this._post.mat.dispose();
      this._post.scene.children[0]?.geometry?.dispose();
      this._post = null;
    }
    if (this.contextLost) return;
    this.renderer.dispose();
    this.contextLost = true;
  }
}
