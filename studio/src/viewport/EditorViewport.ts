/**
 * EditorViewport — canvas WebGL integrado con el motor.
 *
 * Embeje Engine3D del motor (JS vanilla) y gestiona dos modos de cámara:
 *  - 'game':  cámara de juego (WASD + pointer lock).
 *  - 'orbit': cámara orbital de edición (arrastrar para orbitar, rueda zoom).
 *
 * En modo game delegamos en engine.update()/render().
 * En modo orbit NO tocamos al jugador; reposicionamos directamente la cámara
 * del renderer y llamamos a renderer.render() (saltando syncCamera).
 *
 * El canvas del motor vive dentro de un contenedor que es lo que se monta en
 * el layout.
 */

import { Engine3D } from '@engine/index.js';
import { CameraControls, CameraMode } from './CameraControls';
import { sampleProject } from '../sample-project';

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const MOVE_SPEED = 3.0;

export class EditorViewport {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private engine: Engine3D | null = null;
  private controls: CameraControls = new CameraControls();
  private keys: Record<string, boolean> = {};
  private raf = 0;
  private last = 0;
  private dragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private disposed = false;

  /** Callbacks opcionales */
  onCoordsChange?: (x: number, y: number, z: number) => void;
  onModeChange?: (mode: CameraMode) => void;

  constructor() {
    // Contenedor
    this.el = document.createElement('div');
    this.el.className = 'editor-viewport';
    this.el.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;';

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;image-rendering:pixelated;';
    this.el.appendChild(this.canvas);

    this._bindEvents();
  }

  /** Inicializa el motor con un proyecto. */
  async init(project = sampleProject): Promise<void> {
    // Construir y cargar ANTES de asignarlo, para no dejar estado parcial si falla.
    const engine = new Engine3D(project);
    await engine.load(this.canvas);
    this.engine = engine;
    // El canvas se redimensiona con ResizeObserver (el engine.resize usa clientWidth).
    this._setupResize();
    this.controls.onModeChange = (mode) => this.onModeChange?.(mode);

    // Iniciar bucle
    this.last = performance.now();
    this._frame(this.last);
  }

  /**
   * Recarga el mundo desde un project.json (tras editar/importar).
   * Destruye el motor actual y crea uno nuevo, conservando el modo de cámara.
   */
  async reload(project: unknown): Promise<void> {
    const mode = this.controls.mode;
    const engine = new Engine3D(project as unknown);
    await engine.load(this.canvas);
    this.engine?.dispose();
    this.engine = engine;
    this.controls.setMode(mode);
    this.last = performance.now();
  }

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

  private _ro: ResizeObserver | null = null;
  private _resizeHandler: (() => void) | null = null;

  private _frame(now: number): void {
    if (this.disposed) return;
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;

    if (this.engine) {
      if (this.controls.mode === 'game') {
        this._updateGame(now, dt);
      } else {
        this._updateOrbit();
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

    let dirX = 0;
    let dirY = 0;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) { dirX += fwdX; dirY += fwdY; }
    if (this.keys['ArrowDown'] || this.keys['KeyS']) { dirX -= fwdX; dirY -= fwdY; }
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) { dirX -= rightX; dirY -= rightY; }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) { dirX += rightX; dirY += rightY; }

    this.engine!.update({ dirX, dirY, speed: MOVE_SPEED }, dt);
    this.engine!.render();

    this.onCoordsChange?.(p.posX, p.posY, p.posZ);
  }

  private _updateOrbit(): void {
    const r = this.engine!.renderer;
    const pos = this.controls.orbitPosition();
    const { targetX, targetY, targetZ } = this.controls.orbit;

    r.camera.position.set(pos.x, pos.y, pos.z);
    r.camera.lookAt(targetX, targetY, targetZ);

    r.render();
    this.onCoordsChange?.(targetX, targetY, targetZ);
  }

  /** Cambia el modo de cámara. */
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

  get mode(): CameraMode {
    return this.controls.mode;
  }

  get player() {
    return this.engine?.player ?? null;
  }

  /** Devuelve el project que tiene cargado el motor. */
  get project() {
    return this.engine?.project ?? null;
  }

  private _bindEvents(): void {
    // Teclado
    this.canvas.tabIndex = 0;

    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    // Pointer lock change
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    document.addEventListener('mousemove', this._onMouseMove);

    // Ratón en modo orbit
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onOrbitMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });

    // Doble clic para entrar en modo game
    this.canvas.addEventListener('dblclick', this._onDblClick);
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;

    // Tab → alternar modo
    if (e.key === 'Tab') {
      e.preventDefault();
      this.toggleMode();
      return;
    }

    // En modo game, activar pointer lock con teclas de movimiento
    const c = this.controls;
    if (c.mode === 'game' && !this.canvas.ownerDocument.pointerLockElement && MOVE_KEYS.includes(e.code)) {
      this.canvas.requestPointerLock();
    }

    // Escape salir de pointer lock en modo game
    if (e.key === 'Escape' && this.canvas.ownerDocument.pointerLockElement) {
      this.canvas.ownerDocument.exitPointerLock();
    }
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private _onPointerLockChange = (): void => {
    const locked = this.canvas.ownerDocument.pointerLockElement === this.canvas;
    if (!locked) {
      this.keys = {};
    }
  };

  private _onMouseMove = (e: MouseEvent): void => {
    const locked = this.canvas.ownerDocument.pointerLockElement === this.canvas;
    if (!locked || this.controls.mode !== 'game') return;
    const p = this.engine?.player;
    if (!p) return;
    p.rotateYaw(e.movementX * 0.002);
    p.rotatePitch(-e.movementY * 0.002);
  };

  private _onMouseDown = (e: MouseEvent): void => {
    if (this.controls.mode !== 'orbit') return;
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.canvas.style.cursor = 'grabbing';
  };

  private _onOrbitMouseMove = (e: MouseEvent): void => {
    if (!this.dragging || this.controls.mode !== 'orbit') return;
    const dx = e.clientX - this.lastDragX;
    const dy = e.clientY - this.lastDragY;
    this.lastDragX = e.clientX;
    this.lastDragY = e.clientY;
    this.controls.onDrag(dx, dy);
  };

  private _onMouseUp = (): void => {
    this.dragging = false;
    this.canvas.style.cursor = '';
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this.controls.mode !== 'orbit') return;
    e.preventDefault();
    this.controls.onWheel(e.deltaY);
  };

  private _onDblClick = (e: MouseEvent): void => {
    // Doble clic en modo orbit → activar modo game
    if (this.controls.mode === 'orbit') {
      this.setMode('game');
      this.canvas.requestPointerLock();
    }
  };

  /** Libera recursos del motor. */
  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onOrbitMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.canvas.removeEventListener('dblclick', this._onDblClick);
    this._ro?.disconnect();
    if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
    this.engine?.dispose();
    this.engine = null;
  }
}
