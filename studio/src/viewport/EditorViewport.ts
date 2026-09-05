/**
 * EditorViewport — canvas WebGL integrado con el motor + herramientas de edición.
 *
 * Embeje Engine3D y gestiona dos modos de cámara:
 *  - 'game':  WASD + pointer lock.
 *  - 'orbit': cámara orbital de edición + herramientas activas con el ratón.
 *
 * En modo orbit:
 *  - botón izquierdo = herramienta activa (ToolManager).
 *  - botón derecho / medio = orbitar la cámara (CameraControls).
 *  - Overlay2D dibuja vértices/paredes/selección sobre el WebGL.
 *
 * Este archivo SÍ toca Three.js (proyección, raycaster, cámara);
 * la lógica de picking propiamente dicha vive en tools/picking.ts (puro).
 */

import { Engine3D } from '@engine/index.js';
import * as THREE from 'three';
import { CameraControls, CameraMode } from './CameraControls';
import { Overlay2D } from './Overlay2D';
import { ToolManager, type PickContext } from '../tools/ToolManager';
import { sampleProject } from '../sample-project';
import { buildEntityBoxes } from './EntityPreviewMesh';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const MOVE_SPEED = 3.0;

const _v3 = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _target = new THREE.Vector3();

export class EditorViewport {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private engine: Engine3D | null = null;
  private controls: CameraControls = new CameraControls();
  private overlay: Overlay2D = new Overlay2D();
  private keys: Record<string, boolean> = {};
  private raf = 0;
  private last = 0;
  private disposed = false;

  // ── Control de cámara (órbita/pan) ──────────────────────────
  private controlDrag = false;
  private controlDragButton = -1;
  private lastDragX = 0;
  private lastDragY = 0;

  // ── Posición del cursor en canvas (para picking) ─────────────
  private lastCanvasX = 0;
  private lastCanvasY = 0;
  private lastClientX = 0;
  private lastClientY = 0;

  /** Herramientas de edición. Se asigna desde main.ts antes de init(). */
  toolManager: ToolManager | null = null;

  /** Callbacks opcionales */
  onCoordsChange?: (x: number, y: number, z: number) => void;
  onModeChange?: (mode: CameraMode) => void;

  constructor() {
    // Contenedor
    this.el = document.createElement('div');
    this.el.className = 'editor-viewport';
    this.el.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';

    // Canvas WebGL
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;';
    this.el.appendChild(this.canvas);

    // Canvas de overlay (gizmos 2D)
    this.el.appendChild(this.overlay.canvas);

    this._bindEvents();
  }

  // ── Ciclo de vida ────────────────────────────────────────────

  /** Inicializa el motor con un proyecto. */
  async init(project = sampleProject): Promise<void> {
    const engine = new Engine3D(project);
    await engine.load(this.canvas);
    this.engine = engine;
    this._addEditorGrid();
    this._addEntityBoxes();
    this._setupResize();
    this.controls.onModeChange = (mode) => this.onModeChange?.(mode);
    this.last = performance.now();
    this._frame(this.last);
  }

  async reload(project: unknown): Promise<void> {
    const mode = this.controls.mode;
    const engine = new Engine3D(project as unknown);
    await engine.load(this.canvas);
    this.engine?.dispose();
    this.engine = engine;
    this._addEditorGrid();
    this._addEntityBoxes();
    this.controls.setMode(mode);
    this.last = performance.now();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onGameMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onCanvasMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onControlDragMove);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('dblclick', this._onDblClick);
    this._ro?.disconnect();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this.engine?.dispose();
    this.engine = null;
  }

  get mode(): CameraMode { return this.controls.mode; }
  get player() { return this.engine?.player ?? null; }
  get project() { return this.engine?.project ?? null; }

  setMode(mode: CameraMode): void {
    const wasGame = this.controls.mode === 'game';
    this.controls.setMode(mode);
    if (wasGame && this.canvas.ownerDocument.pointerLockElement === this.canvas) {
      this.canvas.ownerDocument.exitPointerLock();
    }
  }

  toggleMode(): void {
    this.setMode(this.controls.mode === 'game' ? 'orbit' : 'game');
  }

  // ── Bucle principal ──────────────────────────────────────────

  private _frame = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    if (this.engine) {
      if (this.controls.mode === 'game') {
        this._updateGame(now, dt);
      } else {
        this._updateOrbit(dt);
      }
    }
    this.raf = requestAnimationFrame(this._frame);
  }

  private _updateGame(now: number, dt: number): void {
    const p = this.engine!.player;
    const fwdX = Math.cos(p.yaw);
    const fwdY = Math.sin(p.yaw);
    const rightX = Math.cos(p.yaw + Math.PI / 2);
    const rightY = Math.sin(p.yaw + Math.PI / 2);
    let dirX = 0, dirY = 0;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) { dirX += fwdX; dirY += fwdY; }
    if (this.keys['ArrowDown'] || this.keys['KeyS']) { dirX -= fwdX; dirY -= fwdY; }
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) { dirX -= rightX; dirY -= rightY; }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) { dirX += rightX; dirY += rightY; }
    this.engine!.update({ dirX, dirY, speed: MOVE_SPEED }, dt);
    this.engine!.render();
    this.onCoordsChange?.(p.posX, p.posY, p.posZ);
  }

  private _updateOrbit(dt: number): void {
    const r = this.engine!.renderer;

    let panX = 0, panZ = 0, panY = 0;
    const speed = 15 * dt;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) panZ -= speed;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) panZ += speed;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) panX -= speed;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) panX += speed;
    if (this.keys['KeyQ']) panY -= speed;
    if (this.keys['KeyE']) panY += speed;

    if (panX !== 0 || panZ !== 0 || panY !== 0) {
      this.controls.panWASD(panX, panZ, panY);
    }

    const pos = this.controls.orbitPosition();
    const { targetX, targetY, targetZ } = this.controls.orbit;
    r.camera.position.set(pos.x, pos.y, pos.z);
    r.camera.lookAt(targetX, targetY, targetZ);
    r.render();
    this.onCoordsChange?.(targetX, targetY, targetZ);

    // Overlay: dibujar gizmos si hay toolManager y doc
    const tm = this.toolManager;
    if (tm) {
      const w = this.canvas.clientWidth || 1;
      const h = this.canvas.clientHeight || 1;
      this.overlay.resize(w, h);
      this.overlay.draw(tm.doc, r.camera, tm.selection, tm.hoverId, tm.polyline);
    }
  }

  // ── Resize ───────────────────────────────────────────────────

  private _ro: ResizeObserver | null = null;
  private _resizeHandler: (() => void) | null = null;

  private _setupResize(): void {
    const resize = () => {
      if (!this.engine) return;
      const w = this.canvas.clientWidth || 1;
      const h = this.canvas.clientHeight || 1;
      this.canvas.width = w;
      this.canvas.height = h;
      this.engine.resize(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(this.canvas);
    this._ro = ro;
    window.addEventListener('resize', resize);
    this._resizeHandler = resize;
  }

  // ── Grid de referencia ──────────────────────────────────────

  /** Añade una grilla de referencia al escenario 3D para orientación espacial. */
  private _addEditorGrid(): void {
    if (!this.engine) return;
    const scene = this.engine.renderer.scene;
    // Grilla 100×100 con divisiones de 1 unidad
    const grid = new THREE.GridHelper(100, 100, 0x444466, 0x333355);
    grid.name = '__editor_grid__';
    scene.add(grid);
    // Ejes de color (rojo=X, verde=Y/up, azul=Z)
    const axes = new THREE.AxesHelper(5);
    axes.name = '__editor_axes__';
    scene.add(axes);
  }

  /** Añade los cubos de colisión de las entidades (solo editor). */
  private _addEntityBoxes(): void {
    if (!this.engine || !this.toolManager) return;
    const scene = this.engine.renderer.scene;
    const boxes = buildEntityBoxes(this.toolManager.doc.world.sprites);
    scene.add(boxes);
  }

  // ── Eventos ──────────────────────────────────────────────────

  private _bindEvents(): void {
    this.canvas.tabIndex = 0;
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onGameMouseMove); // pointer lock modo game
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onCanvasMouseMove);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('dblclick', this._onDblClick);
  }

  // ── Keyboard ─────────────────────────────────────────────────

  private _onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (e.key === 'Tab') { e.preventDefault(); this.toggleMode(); return; }
    const c = this.controls;
    if (c.mode === 'game' && !this.canvas.ownerDocument.pointerLockElement && MOVE_KEYS.includes(e.code)) {
      this.canvas.requestPointerLock();
    }
    if (e.key === 'Escape' && this.canvas.ownerDocument.pointerLockElement) {
      this.canvas.ownerDocument.exitPointerLock();
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => { this.keys[e.code] = false; };

  private _onPointerLockChange = (): void => {
    if (this.canvas.ownerDocument.pointerLockElement !== this.canvas) this.keys = {};
  };

  // ── Mouse · modo game (pointer lock) ─────────────────────────

  private _onGameMouseMove = (e: MouseEvent): void => {
    const locked = this.canvas.ownerDocument.pointerLockElement === this.canvas;
    if (!locked || this.controls.mode !== 'game') return;
    const p = this.engine?.player;
    if (!p) return;
    p.rotateYaw(e.movementX * 0.002);
    p.rotatePitch(-e.movementY * 0.002);
  };

  /**
   * Reparto de botones en modo orbit:
   *  - Izquierdo (0): herramienta activa. Si no consume → pan (desplazamiento X/Y).
   *  - Medio (1): orbitar (rotar la cámara).
   *  - Derecho (2): orbitar (rotar la cámara).
   */
  private _onMouseDown = (e: MouseEvent): void => {
    if (this.controls.mode !== 'orbit') return;

    if (e.button === 0) {
      if (this.toolManager && this.engine) {
        const consumed = this.toolManager.onPointerDown(this._buildPickContext(e.clientX, e.clientY));
        if (!consumed) this._startControlDrag(e.button, e.clientX, e.clientY);
      }
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      this._startControlDrag(e.button, e.clientX, e.clientY);
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      this._startControlDrag(e.button, e.clientX, e.clientY);
    }
  };

  private _startControlDrag(button: number, clientX: number, clientY: number): void {
    this.controlDrag = true;
    this.controlDragButton = button;
    this.lastDragX = clientX;
    this.lastDragY = clientY;
    this.canvas.style.cursor = button === 0 ? 'move' : 'grabbing';
    // Escuchar en window: el arrastre no se corta al salir del canvas.
    window.addEventListener('mousemove', this._onControlDragMove);
  }

  private _stopControlDrag(): void {
    this.controlDrag = false;
    this.controlDragButton = -1;
    this.canvas.style.cursor = this.toolManager?.hoverId ? 'pointer' : '';
    window.removeEventListener('mousemove', this._onControlDragMove);
  }

  private _onControlDragMove = (e: MouseEvent): void => {
    if (!this.controlDrag) return;
    const dx = e.clientX - this.lastDragX;
    const dy = e.clientY - this.lastDragY;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    if (this.controlDragButton === 0) {
      this.controls.onPan(dx, dy);   // botón izquierdo → pan (X/Y)
    } else {
      this.controls.onDrag(dx, dy);  // botón medio/derecho → órbita
    }
  };

  private _onCanvasMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.lastCanvasX = e.clientX - rect.left;
    this.lastCanvasY = e.clientY - rect.top;
    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    // Durante órbita/pan el drag se procesa en window; aquí solo hover/cursor.
    if (this.controlDrag) return;

    // Herramienta: hover + drag tool (si hay toolManager y estamos en modo orbit)
    if (this.toolManager && this.controls.mode === 'orbit' && this.engine) {
      this.toolManager.onPointerMove(this._buildPickContext());
      this.canvas.style.cursor = this.toolManager.hoverId ? 'pointer' : '';
    }
  };

  private _onMouseUp = (e: MouseEvent): void => {
    if (e.button === this.controlDragButton) {
      this._stopControlDrag();
    }
    if (e.button === 0 && this.toolManager) {
      this.toolManager.onPointerUp();
    }
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this.controls.mode !== 'orbit') return;
    e.preventDefault();
    // Primero intentar herramienta (H: cambio de altura)
    if (this.toolManager?.onWheel(e.deltaY, e.shiftKey)) return;
    // Si no consumió → zoom órbita
    this.controls.onWheel(e.deltaY);
  };

  private _onDblClick = (): void => {
    if (this.controls.mode === 'orbit') {
      this.setMode('game');
      this.canvas.requestPointerLock();
    }
  };

  // ── Pick context (proyección 3D→2D con Three.js) ─────────────

  private _buildPickContext(clientX?: number, clientY?: number): PickContext {
    const px = this.lastCanvasX;
    const py = this.lastCanvasY;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;

    // Si no hay motor, devolver ctx vacío
    if (!this.engine || !this.toolManager) {
      return { px, py, world: null, screenVertices: [], screenWalls: [], screenSprites: [] };
    }

    const camera = this.engine.renderer.camera;
    const doc = this.toolManager.doc;

    // World pick: intersección del rayo del cursor con el plano suelo (y=0 de Three).
    const ndcX = (px / w) * 2 - 1;
    const ndcY = -(py / h) * 2 + 1;
    _raycaster.setFromCamera({ x: ndcX, y: ndcY } as THREE.Vector2, camera);
    const intersect = _raycaster.ray.intersectPlane(_suelo, _target);
    const world = intersect ? { x: _target.x, z: _target.z } : null;

    // Proyectar vértices del mundo (suelo y=0) a pantalla.
    const screenVertices = doc.world.vertices.map((v) => {
      _v3.set(v.x, 0, v.y);
      const p = _v3.clone().project(camera);
      return { id: v.id, x: (p.x + 1) * 0.5 * w, y: (1 - p.y) * 0.5 * h };
    });

    // Proyectar paredes (segmentos a y b) a pantalla.
    const screenWalls = doc.world.walls.map((wa) => {
      const va = doc.getVertex(wa.a);
      const vb = doc.getVertex(wa.b);
      if (!va || !vb) return { id: wa.id, x1: 0, y1: 0, x2: 0, y2: 0 };
      _v3.set(va.x, 0, va.y); const pa = _v3.clone().project(camera);
      _v3.set(vb.x, 0, vb.y); const pb = _v3.clone().project(camera);
      return {
        id: wa.id,
        x1: (pa.x + 1) * 0.5 * w, y1: (1 - pa.y) * 0.5 * h,
        x2: (pb.x + 1) * 0.5 * w, y2: (1 - pb.y) * 0.5 * h,
      };
    });

    // Proyectar sprites (posición 3D) a pantalla.
    const screenSprites = doc.world.sprites.map((sp) => {
      _v3.set(sp.pos.x, sp.pos.z, sp.pos.y); // Three: x=altura=z del doc, z=profundidad=y del doc
      const p = _v3.clone().project(camera);
      return { id: sp.id, x: (p.x + 1) * 0.5 * w, y: (1 - p.y) * 0.5 * h };
    });

    return {
      px, py,
      clientX: clientX ?? this.lastClientX,
      clientY: clientY ?? this.lastClientY,
      world,
      screenVertices, screenWalls, screenSprites,
    };
  }
}