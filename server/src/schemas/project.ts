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
  // Opcional cuando se crea desde plantilla (nombre hereda plantilla.nombre);
  // el handler devuelve 422 si falta sin plantillaId.
  nombre: z.string().trim().min(1).max(255).optional(),
  data: z.unknown().optional(),
  // Opcional (C4): crear el proyecto a partir de una plantilla (plantilla.data).
  plantillaId: z.string().trim().min(3).max(64).optional(),
});
export const updateProjectSchema = z.object({
  nombre: z.string().trim().min(1).max(255).optional(),
  data: z.unknown().optional(),
});

// Publicación (C4): slug legible único en galería (opcional → autogenerado),
// título/descripción opcionales para la entrada pública.
export const publishSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "slug solo minúsculas, números y guiones")
    .max(100)
    .optional(),
  titulo: z.string().trim().min(1).max(255).optional(),
  descripcion: z.string().trim().max(2000).optional(),
  thumbnailPath: z.string().trim().max(255).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type PublishInput = z.infer<typeof publishSchema>;

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