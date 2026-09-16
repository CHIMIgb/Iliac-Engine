// Re-export del contrato: el validador del project.json vive en contract/.
// Este shim mantiene la ruta interna del motor estable (Engine3D, tests y el
// d.ts del Studio importan aqui); no hay logica duplicada, solo delegacion.
export { validateProject } from '../../contract/project-schema.js';