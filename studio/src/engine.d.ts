/**
 * Declaraciones de tipos para el motor (JS vanilla, sin types).
 * El motor se importa via alias `@engine/*`. La API pública es Engine3D.
 */

declare module '@engine/core/validate.js' {
  export function validateProject(project: unknown): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

declare module '@engine/core/sky.js' {
  export const SKY_SETS: 31;
  export const SKY_FRAMES: 32;
  /** Etiqueta "HH:MM" para una franja del día 0–31. */
  export function skyFrameLabel(frame: number): string;
  /** Set 0–30 que corresponde a una hora del día 0–23 (etiqueta opcional). */
  export function skySetForHour(hour: number): number;
  /** Hora 0–23 más cercana a un set (etiqueta opcional). */
  export function skyHourForSet(set: number): number;
}

declare module '@engine/core/daylight.js' {
  export function sunDirection(hour: number, tiltDeg?: number): { x: number; y: number; z: number };
  export function moonDirection(hour: number, tiltDeg?: number): { x: number; y: number; z: number };
  export function sunElevation(hour: number, tiltDeg?: number): number;
  export function paletteFor(hour: number): {
    sunColor: number;
    sunIntensity: number;
    ambientColor: number;
    ambientIntensity: number;
    skyColor: number;
    groundColor: number;
    fogColor: number;
    night: number;
  };
  export function advanceHour(hour: number, dt: number, dayLengthSec: number): number;
  /** Etiqueta "HH:MM" para una hora float 0–24. */
  export function hourLabel(hour: number): string;
}

declare module '@engine/core/noise.js' {
  export function createNoise(seed?: number): unknown;
  export function fbm2(
    noise: unknown,
    x: number,
    y: number,
    opts?: { octaves?: number; lacunarity?: number; gain?: number },
  ): number;
}

declare module '@engine/core/audio.js' {
  export class AudioEngine {
    constructor(defs?: unknown[], opts?: { ctxFactory?: () => AudioContext });
    resume(): Promise<boolean>;
    playSfx(id: string, pos?: { x: number; y: number; z: number } | null): boolean;
    halt(): void;
    dispose(): void;
  }
  export function linearToDb(v: number): number;
  export function dbToLinear(db: number): number;
}

declare module '@engine/core/sector.js' {
  export function buildSectorIndex(world: unknown): {
    vertexMap: Map<string, { x: number; y: number }>;
    wallsBySector: Map<string, unknown[]>;
    bvh: unknown;
  };
  export function pointInSector(
    world: unknown,
    sector: unknown,
    x: number,
    y: number,
    vertexMap: Map<string, { x: number; y: number }>,
  ): boolean;
  export function getFloorHeightAt(
    world: unknown,
    sector: unknown,
    x: number,
    y: number,
    vertexMap: Map<string, { x: number; y: number }>,
  ): number;
}

declare module '@engine/index.js' {
  export class Engine3D {
    constructor(project: unknown);
    /** Cambia el mundo sin recrear renderer/texturas; false si el proyecto es inválido. */
    setWorld(project: unknown): boolean;
    loaded: boolean;
    player: {
      posX: number;
      posY: number;
      posZ: number;
      yaw: number;
      pitch: number;
      rotateYaw(delta: number): void;
      rotatePitch(delta: number): void;
    };
    renderer: {
      camera: import('three').PerspectiveCamera;
      scene: import('three').Scene;
      render(): void;
      resize(w: number, h: number): void;
    };
    /** AudioEngine del motor o null si el proyecto no declara audio[]. */
    audio: {
      resume(): Promise<boolean>;
      playSfx(id: string, pos?: { x: number; y: number; z: number } | null): boolean;
      duckMusic(on: boolean, db?: number): void;
      setBusVolume(bus: 'music' | 'sfx' | 'ambience' | 'voice', slider01: number): void;
      setListener(x: number, y: number, z: number, yaw?: number): void;
    } | null;
    /** AdaptiveMusic activo si project.music apunta a un def con layers. */
    music: { setIntensity(level: number, immediate?: boolean): void; level: number } | null;
    resumeAudio(): Promise<boolean>;
    /** Silencia los bucles al salir del playtest (no-op sin audio). */
    stopAudio(): void;
    /** Muestra/oculta la brújula HUD (rosa N/E/S/O) del playtest. */
    setCompass(on: boolean, container?: HTMLElement): void;
    project: unknown;
    load(canvas: HTMLCanvasElement): Promise<this>;
    resize(w: number, h: number): void;
    update(input: { dirX: number; dirY: number; speed: number }, dt: number): void;
    render(): void;
    dispose(): void;
  }
}
