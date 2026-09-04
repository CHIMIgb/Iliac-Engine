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

declare module '@engine/index.js' {
  export class Engine3D {
    constructor(project: unknown);
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
    project: unknown;
    load(canvas: HTMLCanvasElement): Promise<this>;
    resize(w: number, h: number): void;
    update(input: { dirX: number; dirY: number; speed: number }, dt: number): void;
    render(): void;
    dispose(): void;
  }
}
