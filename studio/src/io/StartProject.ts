/**
 * io/StartProject.ts — Documento de partida del Studio (C5d).
 *
 * El proyecto inicial ya no vive en el código (`sample-project.ts`): se pide a
 * la API. Con sesión se abre el último proyecto de la cuenta o, si está vacía,
 * se crea desde su plantilla (C4 acepta `plantillaId` — no se sube el árbol
 * entero desde el navegador).
 *
 * Sin sesión **no hay nada cargado**: el editor arranca con un documento vacío
 * (ni plantilla ni proyectos ajenos) y sin tocar la API. Guardar sigue exigiendo
 * sesión, y al iniciar sesión la nube toma el relevo (`initCloudProject`).
 *
 * D-C: con sesión el arranque depende del backend — si no responde,
 * `loadStartProject` lanza y el main avisa; el Studio nunca arranca con un mundo
 * inventado. Sin sesión no hay petición, así que no hay nada que pueda fallar.
 */
import { apiCreateProject, apiListTemplates, type TemplateMeta } from './api';
import { isAuthenticated } from './session';
import { loadCloudMostRecent } from './CloudProject';
import { fromProjectJson } from './Serializer';
import type { EditorState } from '../editor/EditorState';

/** Plantilla preferida con sesión (la personal del usuario). */
const PREFERRED = 'tpl-studio';

/** Documento vacío: mismo esqueleto que el default del server (mundo sin nada). */
const EMPTY_PROJECT: Record<string, unknown> = {
  world: { vertices: [], sectors: [], walls: [] },
};

export interface StartProject {
  /** Estado editable con el que arranca el Studio. */
  state: EditorState;
  /** Proyecto de la nube asociado (null sin sesión: no hay nada que guardar). */
  projectId: string | null;
}

/** Plantilla a usar: la preferida o la primera del servidor. */
function pickTemplate(templates: TemplateMeta[]): TemplateMeta {
  const t = templates.find((x) => x.id === PREFERRED) ?? templates[0];
  if (!t) throw new Error('no hay ninguna plantilla de arranque en el servidor');
  return t;
}

/** ¿El documento está vacío (nada dibujado)? */
export function isEmptyDoc(state: EditorState): boolean {
  return state.world.sectors.length === 0;
}

/**
 * Crea el primer proyecto de la cuenta a partir de la plantilla preferida y
 * devuelve su documento. Lo usan el arranque con sesión y el login en caliente.
 */
export async function createFromTemplate(): Promise<StartProject> {
  const { templates } = await apiListTemplates();
  const { project } = await apiCreateProject({ plantillaId: pickTemplate(templates).id });
  return { state: fromProjectJson(project.data), projectId: project.id };
}

export async function loadStartProject(): Promise<StartProject> {
  // Sin sesión: documento vacío, sin peticiones (el editor se explora igual).
  if (!isAuthenticated()) {
    return { state: fromProjectJson(EMPTY_PROJECT), projectId: null };
  }

  // Con sesión: último proyecto propio o, si la cuenta está vacía, uno nuevo
  // creado desde la plantilla (el JSON pesa ~720 KB: que lo copie el server).
  const recent = await loadCloudMostRecent();
  if (recent) return { state: recent.state, projectId: recent.projectId };
  return createFromTemplate();
}
