/**
 * io/CloudProject.ts — Persistencia en la nube del proyecto del editor (C5b).
 *
 * Con sesión, la API es la fuente de verdad: el documento se guarda en
 * `proyecto.data` (PATCH reemplaza el árbol completo — semántica del server
 * C2) y `proyecto.nombre` se mantiene sincronizado con `data.meta.name`.
 * Sin sesión el Studio no usa estas funciones (flujo local F3/F4 intacto).
 *
 * La validación previa en el cliente reutiliza `validateProjectJson` del
 * Serializer (el server revalida igual con el contrato): evita un 422 de
 * ida y vuelta. Si la API falla, la excepción (ApiError) se propaga para que
 * el main la muestre y detecte sesiones expiradas (401 → UNAUTHORIZED).
 */
import { fromProjectJson, toProjectJson, validateProjectJson, type ProjectJson } from './Serializer';
import { apiCreateProject, apiGetProject, apiListProjects, apiUpdateProject } from './api';
import type { EditorState } from '../editor/EditorState';

function assertValid(state: EditorState): ProjectJson {
  const json = toProjectJson(state);
  const errors = validateProjectJson(json);
  if (errors.length > 0) {
    throw new Error(`project.json inválido:\n- ${errors.join('\n- ')}`);
  }
  return json;
}

/**
 * Último proyecto del usuario (el server ordena por updatedAt desc), listo
 * para abrir. null si la cuenta no tiene proyectos.
 */
export async function loadCloudMostRecent(): Promise<{ projectId: string; state: EditorState } | null> {
  const { projects } = await apiListProjects();
  if (projects.length === 0) return null;
  const { project } = await apiGetProject(projects[0]!.id);
  return { projectId: project.id, state: fromProjectJson(project.data) };
}

/** Crea un proyecto en la nube con el documento actual → id. */
export async function createCloudProject(state: EditorState): Promise<string> {
  const json = assertValid(state);
  const { project } = await apiCreateProject({ nombre: state.meta.name, data: json });
  return project.id;
}

/** Guarda el documento en el proyecto dado (PATCH data + nombre). */
export async function saveCloudProject(state: EditorState, projectId: string): Promise<void> {
  const json = assertValid(state);
  await apiUpdateProject(projectId, { nombre: state.meta.name, data: json });
}