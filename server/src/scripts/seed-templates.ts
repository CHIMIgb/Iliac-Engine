/**
 * seed-templates.ts — Siembra las plantillas de `db/seeds/*.json` (C5d).
 *
 *   npm run seed:templates
 *
 * Idempotente: upsert por `id` (re-ejecutar actualiza la data). El dueño se
 * resuelve por login (`SEED_OWNER_LOGIN`, por defecto 'chimi'); si la cuenta no
 * existe, avisa y no inserta nada (mejor que una plantilla huérfana).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../db.ts';

const SEEDS_DIR = resolve(import.meta.dirname, '../../db/seeds');
const LOGIN = process.env.SEED_OWNER_LOGIN ?? 'chimi';

const usuario = await prisma.usuario.findUnique({ where: { login: LOGIN } });
if (!usuario) {
  console.error(
    `✖ No existe el usuario '${LOGIN}'. Regístralo (POST /auth/register) o pasa SEED_OWNER_LOGIN=<login>.`,
  );
  await prisma.$disconnect();
  process.exit(1);
}

const files = readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const seed = JSON.parse(readFileSync(resolve(SEEDS_DIR, file), 'utf8'));
  const campos = {
    propietarioId: usuario.id,
    nombre: seed.nombre,
    descripcion: seed.descripcion ?? '',
    data: seed.data,
  };
  await prisma.plantilla.upsert({
    where: { id: seed.id },
    create: { id: seed.id, ...campos },
    update: campos,
  });
  console.log(`✔ ${seed.id} → usuario ${usuario.login}`);
}

console.log(`Listo: ${files.length} plantilla(s) sembrada(s).`);
await prisma.$disconnect();
