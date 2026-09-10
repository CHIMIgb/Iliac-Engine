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

declare module '@engine/core/noise.js' {
  export function createNoise(seed?: number): unknown;
  export function fbm2(
    noise: unknown,
    x: number,
    y: number,
    opts?: { octaves?: number; lacunarity?: number; gain?: number },
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
      /** CRT activo en el pase de post-proceso (el viewport lo conmuta por modo). */
      crt: boolean;
      render(): void;
      resize(w: number, h: number): void;
    };
    project: unknown;
    load(canvas: HTMLCanvasElement): Promise<this>;
    resize(w: number, h: number): void;
    update(input: { dirX: number; dirY: number; speed: number }, dt: number): void;
    render(): void;
    dispose(): void;
  }
}
