// schemas/project.ts — Validación de proyectos (DATABASE.md §8 C2).
// El `data` JSONB v3 se valida con el MISMO validador del contrato
// (contract/project-schema.js → contract/project-schema.d.ts): nunca duplicar
// la lógica de validación entre capas (ROADMAP §5).
import { z } from "zod";
import { validateProject } from "../../../contract/project-schema.js";
import { AppError } from "../lib/AppError.ts";

// Esqueleto v3 mínimo que pasa validateProject con solo warnings:
// un mundo vacío (sin vértices, sectores ni paredes).
export const DEFAULT_PROJECT_DATA: Record<string, unknown> = {
  world: { vertices: [], sectors: [], walls: [] },
};

export const createProjectSchema = z.object({
  nombre: z.string().trim().min(1).max(255),
  data: z.unknown().optional(),
});
export const updateProjectSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  data: z.unknown().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** Valida `data` contra el contrato; 422 con el detalle si no es válido. */
export function validateProjectData(data: unknown): Record<string, unknown> {
  const result = validateProject(data);
  if (!result.valid) {
    throw new AppError("VALIDATION_ERROR", {
      issues: result.errors.map((message) => ({ path: "data", message })),
    });
  }
  return data as Record<string, unknown>;
}