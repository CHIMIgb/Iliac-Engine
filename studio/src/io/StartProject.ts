/**
 * io/StartProject.ts — Documento de partida del Studio (C5d).
 *
 * El proyecto inicial ya no vive en el código (`sample-project.ts`): se pide a
 * la API. Con sesión se abre el último proyecto de la cuenta o, si está vacía,
 * se crea desde su plantilla (C4 acepta `plantillaId` — no se sube el árbol
 * entero desde el navegador). Sin sesión se carga la plantilla del sistema
 * (pública) para explorar el editor; guardar sigue exigiendo sesión.
 *
 * D-C: el arranque depende del backend — si no responde, `loadStartProject`
 * lanza y el main avisa; el Studio nunca arranca con un mundo vacío inventado.
 */
import { apiCreateProject, apiGetTemplate, apiListTemplates, type TemplateMeta } from './api';
import { isAuthenticated } from './session';
import { loadCloudMostRecent } from './CloudProject';
import { fromProjectJson } from './Serializer';
import type { EditorState } from '../editor/EditorState';

/** Plantilla preferida con sesión (la personal del usuario). */
const PREFERRED = 'tpl-studio';
/** Plantilla del sistema de respaldo. */
const FALLBACK = 'tpl-demo';

export interface StartProject {
  /** Estado editable con el que arranca el Studio. */
  state: EditorState;
  /** Proyecto de la nube asociado (null sin sesión: no hay nada que guardar). */
  projectId: string | null;
}

/** Plantilla a usar: la preferida, la de respaldo o la primera disponible. */
function pickTemplate(templates: TemplateMeta[]): TemplateMeta {
  const t =
    templates.find((x) => x.id === PREFERRED) ??
    templates.find((x) => x.id === FALLBACK) ??
    templates[0];
  if (!t) throw new Error('no hay ninguna plantilla de arranque en el servidor');
  return t;
}

export async function loadStartProject(): Promise<StartProject> {
  // Con sesión: último proyecto propio o, si la cuenta está vacía, uno nuevo
  // creado desde la plantilla (el JSON pesa ~720 KB: que lo copie el server).
  if (isAuthenticated()) {
    const recent = await loadCloudMostRecent();
    if (recent) return { state: recent.state, projectId: recent.projectId };

    const { templates } = await apiListTemplates();
    const { project } = await apiCreateProject({ plantillaId: pickTemplate(templates).id });
    return { state: fromProjectJson(project.data), projectId: project.id };
  }

  // Sin sesión: solo las plantillas del sistema (públicas).
  const { templates } = await apiListTemplates();
  const { template } = await apiGetTemplate(pickTemplate(templates).id);
  return { state: fromProjectJson(template.data), projectId: null };
}
