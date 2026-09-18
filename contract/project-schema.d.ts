/**
 * Declaraciones de tipos para el contrato `project.json` (schema v3).
 * El .js implementa `validateProject` (JS vanilla puro); este .d.ts solo
 * declara tipos, para que las capas TypeScript (Studio, Backend) consuman
 * el contrato sin duplicar lógica.
 *
 * NOTA: el Studio aún modela su documento editable con tipos propios
 * (`studio/src/editor/types.ts`, `Editable*`); unificar con estos tipos es
 * deuda pendiente anotada en ROADMAP §16.
 */

export interface ProjectMeta {
  name?: string;
  version?: string | number;
  author?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ProjectVertex {
  id: string;
  x: number;
  y: number;
  z?: number;
}

export interface ProjectSector {
  id: string;
  vertexIds: string[];
  floorH?: number;
  ceilH?: number;
  floorTex?: string;
  ceilTex?: string;
  wallTex?: string;
  floorSlope?: { axis: 'x' | 'y'; angle: number };
}

export interface ProjectWall {
  id: string;
  sectorFront: string;
  sectorBack?: string | null;
  a: string;
  b: string;
  tex?: string;
  solid?: boolean;
  portal?: boolean;
}

export interface ProjectRamp {
  id: string;
  sector: string;
  fromH?: number;
  toH?: number;
  axis?: 'x' | 'y';
}

export interface ProjectSprite {
  id: string;
  name?: string;
  tex?: string;
  anim?: string;
  x: number;
  y: number;
  z?: number;
  scale?: number;
  type?: 'npc' | 'enemy' | 'prop' | 'item';
  [key: string]: unknown;
}

export interface ProjectSky {
  set: number;
  frame?: number;
  base?: number;
  style?: 'realista';
  hour?: number;
  dayLengthSec?: number;
  shadows?: boolean;
  sunTilt?: number;
  sunIntensity?: number;
  moonIntensity?: number;
  stars?: boolean;
  aurora?: boolean;
  auroraIntensity?: number;
  auroraColor?: string;
}

export interface ProjectAudioDef {
  id: string;
  src: string;
  bus?: 'music' | 'sfx' | 'ambience' | 'voice';
  loop?: boolean;
  volume?: number;
  spatial?: { x?: number; y?: number; z?: number; follow?: string };
  variations?: string[];
  layers?: string[];
}

export interface ProjectMusic {
  id: string;
  intensity?: 0 | 1 | 2;
  bpm?: number;
}

export interface ProjectWorld {
  vertices: ProjectVertex[];
  sectors: ProjectSector[];
  walls: ProjectWall[];
  ramps?: ProjectRamp[];
  sprites?: ProjectSprite[];
  textures?: Record<string, string>;
  spriteAnims?: Record<string, { frames: string[]; fps?: number; loop?: boolean }>;
  camera?: { start?: { x: number; y: number; yaw?: number; pitch?: number } };
  render?: { fov?: number; fog?: number; fogColor?: number; sky?: number };
  sky?: ProjectSky;
}

export interface ProjectJson {
  meta?: ProjectMeta;
  world: ProjectWorld;
  audio?: ProjectAudioDef[];
  music?: ProjectMusic | null;
  [key: string]: unknown;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProject(project: unknown): ValidateResult;