/**
 * io/MyProjects.ts — Selector de proyectos del usuario autenticado (C5e).
 *
 * Lógica pura del selector «Mis proyectos» (testeable sin DOM, mismo patrón
 * que CloudProject.ts): la UI (ui/ProjectPicker.ts) solo consume estas
 * funciones, nunca la API ni el Serializer directamente.
 *
 * C5b abre siempre el último proyecto y no había forma de elegir otro; aquí
 * vive la pieza de datos que el modal necesita: lista con nombre/fecha
 * (updatedAt), abrir un proyecto por id (árbol v3 → EditorState) y borrarlo.
 * Sin cambios de schema ni de contrato: reutiliza los endpoints de C2.
 */
import { apiDeleteProject, apiGetProject, apiListProjects, type ProjectMeta } from './api';
import { fromProjectJson } from './Serializer';
import type { EditorState } from '../editor/EditorState';

/** Re-export: los consumidores de MyProjects (UI) no tocan la API directamente. */
export type { ProjectMeta } from './api';

/** Lista los proyectos de la cuenta (el server ordena por updatedAt desc). */
export async function listMyProjects(): Promise<ProjectMeta[]> {
  const { projects } = await apiListProjects();
  return projects;
}

/** Abre un proyecto por id → estado editable del editor (árbol v3 completo). */
export async function openMyProject(id: string): Promise<{ projectId: string; state: EditorState }> {
  const { project } = await apiGetProject(id);
  return { projectId: project.id, state: fromProjectJson(project.data) };
}

/** Borra un proyecto de la cuenta (fila + assets vinculados en cascada). */
export async function deleteMyProject(id: string): Promise<void> {
  await apiDeleteProject(id);
}