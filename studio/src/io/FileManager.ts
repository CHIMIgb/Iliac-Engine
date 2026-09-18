/**
 * FileManager — exportar/importar el proyecto como archivo `.json`.
 *
 * C5c: NO hay guardado local. Guardar (proyecto, sprites, audio) vive en la API
 * con sesión obligatoria; aquí solo quedan los archivos externos del usuario:
 *
 *  - Exportar: descarga un project.json portable.
 *  - Importar: carga un project.json desde archivo (y el editor lo persiste).
 *
 * Ambos exigen sesión en main.ts (todo lo que guarda pasa por la API).
 */

import { EditorState } from '../editor/EditorState';
import { fromProjectJson, toProjectJson, validateProjectJson } from './Serializer';

export type FileResult = { ok: true; state: EditorState } | { ok: false; error: string };

/** Descarga el proyecto actual como project.json. */
export function exportJson(state: EditorState, filename?: string): void {
  const json = toProjectJson(state);
  const name = filename ?? `${sanitizeName(state.meta.name)}.json`;
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Abre un selector de archivo y devuelve el project.json importado. */
export function importJson(): Promise<FileResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ ok: false, error: 'No se seleccionó archivo' });
        return;
      }
      try {
        const text = await file.text();
        const json = JSON.parse(text) as Record<string, unknown>;
        const errors = validateProjectJson(json);
        if (errors.length > 0) {
          resolve({ ok: false, error: `project.json inválido:\n- ${errors.join('\n- ')}` });
          return;
        }
        resolve({ ok: true, state: fromProjectJson(json) });
      } catch (e) {
        resolve({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    };
    input.click();
  });
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_') || 'proyecto';
}
