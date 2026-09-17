/**
 * export-template.ts — Autoría de la plantilla de arranque del Studio (C5d).
 *
 * Genera `server/db/seeds/tpl-studio.json` desde el escenario de código
 * (`src/sample-project.ts`). NO lo ejecuta el navegador ni el runtime del
 * Studio: es un script de autoría que se corre a mano cuando cambia el
 * escenario de partida.
 *
 *   npx vite-node scripts/export-template.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { sampleProject } from '../src/sample-project';

const DEST = resolve(import.meta.dirname, '../../server/db/seeds/tpl-studio.json');

// El seed incluye la metadata que consume `npm run seed:templates` del server.
const seed = {
  id: 'tpl-studio',
  nombre: 'Escenario Studio',
  descripcion: 'Proyecto inicial del Studio: terreno 100×100 con montaña y río (schema v3)',
  data: sampleProject,
};

mkdirSync(dirname(DEST), { recursive: true });
const json = JSON.stringify(seed);
writeFileSync(DEST, json);
console.log(`tpl-studio → ${DEST} (${json.length} bytes)`);
