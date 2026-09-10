/**
 * setup-sky.mjs — Copia los 31 sets de cielo de Daggerfall (assets NO
 * versionados por copyright) a las rutas limpias que esperan el Studio y el
 * demo:  studio/public/sky/SKYnn/{capa}-{frame}.PNG  y  demo/sky/SKYnn/…
 *
 * Uso:  cd studio && npm run setup:sky
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const src = path.join(repo, 'assets', 'images', 'daggerfall', 'Environment', 'The Sky');
const dests = [
  path.join(repo, 'studio', 'public', 'sky'),
  path.join(repo, 'demo', 'sky'),
];

if (!fs.existsSync(src)) {
  console.error(`[setup:sky] Faltan los assets en: ${src}`);
  console.error('           (la carpeta assets/ no se versiona: importar Daggerfall localmente)');
  process.exit(1);
}

let sets = 0;
let files = 0;
for (const dir of fs.readdirSync(src)) {
  const m = /^SKY(\d{2})\.DAT/.exec(dir);
  if (!m) continue;
  const from = path.join(src, dir);
  if (!fs.statSync(from).isDirectory()) continue;
  for (const dest of dests) {
    const outDir = path.join(dest, `SKY${m[1]}`);
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(from)) {
      if (!f.toUpperCase().endsWith('.PNG')) continue;
      fs.copyFileSync(path.join(from, f), path.join(outDir, f));
      files++;
    }
  }
  sets++;
}
console.log(`[setup:sky] ${sets} sets · ${files / dests.length} PNG copiados a studio/public/sky y demo/sky`);
