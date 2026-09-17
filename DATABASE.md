# DATABASE.md — Esquema de Base de Datos (PostgreSQL + Prisma)

> **Visión a largo plazo.** El backend (API + Postgres) aún no existe (no hay código; el motor del juego es JS vanilla, ver `ROADMAP.md` §13–§15). Este documento describe la **arquitectura prevista** del servidor del Studio; el `server/db/schema.prisma` se creará a partir de aquí cuando se arranque el backend.
>
> Esquema de datos del servidor de RayCast Studio. El ORM es **Prisma** sobre **PostgreSQL**.
> Este documento es la **fuente de verdad del esquema**: de aquí se generará `server/db/schema.prisma` cuando exista backend.
>
> Regla rectora: **toda la información del juego (mapas, texturas, sprites, entidades, rutas de assets, estado) vive en la base de datos. Nada hardcodeado ni almacenado solo localmente.**
>
> **Actualizado 2026-09-16:** Fases **A1 + A2 + A3 ejecutadas y validadas** — `server/db/schema.sql` aplicado sobre la base **`iliac_engine`** (PostgreSQL 18.4 en Windows): 9 tablas + enums + índices + seeds, idempotente y verificado; y **Prisma (ORM 7)** introspeccionado como espejo 1:1 con **baseline `0_init`** (`migrate status` limpio, client generado, tests verdes). **B1 realizada:** esqueleto del servidor (Hono + tsx + tsconfig strict + Prisma singleton + blobs). **B2 realizada:** contrato de respuesta `{success,data,error}` + `GET /health` + `GET /ready`. **C1 realizada:** auth — `POST /auth/register` + `POST /auth/login` (bcrypt 12, JWT access 15 min + refresh 7 días hasheado+`jti`). **C2 realizada:** CRUD de proyectos — `POST/GET/GET:id/PATCH/DELETE /api/projects` con `data` JSONB v3 validado por `validateProject` del contrato (sin duplicar validación) y JWT obligatorio. Fix 2026-09-16: un `:id` no-UUID devolvía 500 (P2023 escapaba como INTERNAL_ERROR); ahora `assertProjectId` responde **404 PROJECT_NOT_FOUND** igual que un id ajeno (tests 49/49). **C3 realizada:** assets — `POST/GET/GET:id/file/DELETE /api/assets` (multipart, MIME por magic bytes con `file-type`, tope 20 MB, dedupe por hash sha256, blobs en `storage/uploads/<id>.<ext>`). **C4 realizada:** galería y plantillas — `PATCH publish/unpublish` + `GET /api/gallery` + `GET /api/gallery/:slug` (visitas) + `GET /api/templates` + `POST /api/projects {plantillaId}`; seed `tpl-demo` → sala v3 jugable; **48/48 tests**. **C5a realizada (2026-09-16):** autenticación integrada en el Studio (apiFetch + sesión + AuthModal + proxy dev; verificado end-to-end; Studio 226/226). **C5b realizada (2026-09-16):** guardar/cargar el proyecto por API (nube = fuente de verdad con sesión; Studio 232/232). **C5c validada (2026-09-17):** assets del Studio por API — sprites y audio suben a `POST /api/assets` (multipart, dedupe por hash) y el documento guarda su URL servida `/api/assets/<id>/file` **pública (D1)**; `GET /api/assets` lista por `?tipo` (D6); MIMEs de audio ampliados a mp3/flac/m4a/aac/webm (D5); **localStorage eliminado** — todo guardado exige sesión (`requireSession`); el middleware de Vite queda solo como servido estático de `assets/`. Tests: server 55/55 + Studio 227/227. **C5d realizada (2026-09-17):** arranque desde la API vinculado a **`chimi`** (`plantilla.propietario_id`; sin sesión el editor abre vacío) — el Studio ya no arranca con `sample-project.ts`; tests server **59/59** + Studio **235/235** + motor **192/192**. Detalle en §8 sub-bloques C5c y C5d.
>
> **C5d y C5e (2026-09-17):** C5d = arranque del Studio desde la API (`plantilla.propietario_id`, seed `tpl-studio` a `chimi`; sin sesión el editor abre vacío) — implementada y pendiente de validación del usuario (ver sub-bloque en §8). C5e = selector de proyectos del usuario autenticado (abrir/nuevo/borrar con confirmación) — **realizada** (ver sub-bloque en §8).
>
> **C5f (2026-09-17):** renovación de sesión con rotación del refresh — `POST /auth/refresh` (reuso ⇒ revoca todas las sesiones) + auto-renovación con reintento único en `apiFetch` (deduplicada). **Realizada**, pendiente de validación del usuario (ver sub-bloque en §8).
>
> **Actualizado 2026-09-15:** alineado con el `project.json` **schema v3** real (sectores poligonales) + lo añadido por audio (F4.5), cielo realista (F4.7) y el **Sprite Tool (F5)**.
>
> **¿Por dónde empiezo?** Mirar **§8 (Plan de construcción por pasos)** — pequeños pasos verificables para montar DB + backend poco a poco; las tablas están en §3 y el esquema Prisma en §6.

---

## 1. Principios de persistencia

| Principio | Descripción |
|-----------|-------------|
| **DB = fuente única de verdad** | Todo dato de usuario, proyecto, asset y publicación se persiste en Postgres vía Prisma. |
| **El juego completo en el proyecto** | El `project.json` **v3** (vértices, sectores, paredes, rampas, sprites, texturas, animaciones, audio, cielo, ajustes — todo el juego) se guarda entero en `proyecto.data` (JSONB). No existe "mapa local sólo en el navegador". |
| **Assets: metadatos en DB, bytes en filesystem** | Cada archivo registrado en tabla `asset` (ruta, mime, tamaño, hash). Los **bytes** van al filesystem de blobs del servidor; la **ruta** se guarda en `asset.ruta`. El `project.json` referencia assets por su ruta/clave (ej. `world.textures["guard_f0"]` → ruta del blob). |
| **Propiedad en cascada** | Todo cuelga de un `usuario`: `proyecto.propietario_id` y `asset.propietario_id`. Un asset con `proyecto_id` nulo pertenece a la biblioteca personal del usuario (compartible entre juegos). Nunca hay datos huérfanos. |
| **Estado del proyecto** | Vive en `proyecto.estado`: `EN_DESARROLLO` o `PUBLICADO`. Transición controlada por la API. |

---

## 2. Diagrama de relaciones

```
                    ┌─────────┐
                    │   rol   │
                    └────┬────┘
                         │ 1
                         │
                         │ N
┌──────────┐ 1      1 ┌──┴───────┐ 1         N ┌────────────┐
│ persona  ├──────────┤  usuario ├────────────│  proyecto   │
└──────────┘          └──────────┘            └─────┬──────┘
                                                    │ 1
                                                    │
                                             N      │
                    ┌───────────┐  N ───────────────┘
                    │   asset   │◄──────── 1
                    └───────────┘          (proyecto 1 ─ N asset)
                                                    │
                                            N       │ 1
                    ┌───────────┐◄──────────────────┘
                    │  galeria  │   (proyecto 1 ─ 1 galeria)
                    └───────────┘

                    ┌───────────┐
                    │ plantilla │   (usuario 1 ─ N plantilla; NULL = del sistema)
                    └───────────┘
```

### Resumen de cardinalidades

| Relación | Cardinalidad |
|----------|--------------|
| `persona` → `usuario` | 1 : 1 (una persona, un login) |
| `usuario` → `rol` | N : 1 (muchos usuarios, un rol) |
| `usuario` → `proyecto` | 1 : N (un usuario, muchos proyectos) |
| `usuario` → `asset` | 1 : N |
| `proyecto` → `asset` | 1 : N |
| `proyecto` → `galeria` | 1 : 1 (sólo si publicado) |
| `usuario` → `plantilla` | 1 : N (`propietario_id` NULL = plantilla del sistema) |

---

## 3. Tablas

### 3.1 `persona` — datos reales del individuo

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | Identificador único |
| `nombre` | `TEXT` | NOT NULL | Nombre de pila |
| `apellido` | `TEXT` | NOT NULL | Apellido(s) |
| `email_publico` | `TEXT` | unique, nullable | Email visible (portfolio/CV) |
| `bio` | `TEXT` | nullable | Breve biografía |
| `avatar_path` | `TEXT` | nullable | Ruta al avatar en blobs |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default ahora | |

**Notas:** separa los datos personales (públicos) de las credenciales de acceso (`usuario`).
Un usuario de la plataforma puede tener o no persona vinculada (p.ej. un creador).

### 3.2 `usuario` — credenciales y acceso (1:1 persona, N:1 rol)

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | |
| `persona_id` | `UUID` | FK → `persona.id`, **UNIQUE**, onDelete cascade | Los datos personales |
| `rol_id` | `UUID` | FK → `rol.id`, NOT NULL | Rol del usuario |
| `login` | `TEXT` | **UNIQUE**, NOT NULL | Identificador de login (email o usuario) |
| `password_hash` | `TEXT` | NOT NULL | Hash bcrypt |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | |

**Relación 1:1:** `persona_id` tiene constraint `UNIQUE` ⇒ una persona = un solo login.

### 3.3 `rol` — tipos de usuario

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | |
| `nombre` | `TEXT` | **UNIQUE**, NOT NULL | `admin`, `creador` |
| `descripcion` | `TEXT` | nullable | Qué le está permitido |

**Seed sugerido:**
```sql
INSERT INTO rol (id, nombre, descripcion) VALUES
  (gen_random_uuid(), 'admin',   'Acceso total: usuarios, proyectos, galería, plantillas'),
  (gen_random_uuid(), 'creador', 'Crea y gestiona sus propios proyectos y assets');
```

### 3.4 `proyecto` — el juego completo (relacionado a usuario, con estado)

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | |
| `propietario_id` | `UUID` | FK → `usuario.id`, NOT NULL, onDelete cascade | Dueño del proyecto |
| `nombre` | `TEXT` | NOT NULL | Título del juego |
| `slug` | `TEXT` | unique, nullable | URL amigable (galería) |
| `estado` | `ENUM` | NOT NULL, default `EN_DESARROLLO` | `EN_DESARROLLO` \| `PUBLICADO` |
| `schema_version` | `INT` | NOT NULL, default `3` | Versión del `project.json` (v3 = sectores poligonales) |
| `render_mode` | `TEXT` | NOT NULL, default `retro` | `retro` \| `3d` |
| `data` | `JSONB` | NOT NULL | **`project.json` v3 COMPLETO**: `meta`, `camera`, `render`, `world`, `audio`, `music`, `blueprints`, `...` |
| `thumbnail_path` | `TEXT` | nullable | Portada del juego |
| `published_at` | `TIMESTAMPTZ` | nullable | Fecha de publicación |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | |

**`data` (JSONB)** guarda íntegramente el `project.json` **schema v3** — el juego completo:
- `meta` (nombre, `schemaVersion: 3`, renderMode)
- `camera` (posX, posY, posZ, yaw?, pitch?)
- `render` (fov, near/far, backgroundColor, luces, niebla)
- `world` → el mundo en sí (vértices, sectores, paredes, rampas, sprites, texturas, cielo, anims; ver §3.4.1)
- `audio[]` (id, src, bus, loop, volume, spatial, variations, layers) y `music` (id, intensity, bpm) — F4.5
- `blueprints[]` (visual scripting, futuro)
- sistemas RPG: `items[]`, `spells[]`, `npc[]`, `dialogue[]`, `quests[]`, `economy[]`, `progression[]` — futuro
- `localization` (es/en) — futuro

Cualquier dato nuevo del juego se añade dentro de este JSONB **sin migrar tablas**: las columnas de metadatos (`nombre`, `estado`, `render_mode`) solo sirven para listar, filtrar y publicar.

> **Filosofía:** el `project.json` ES el juego. Almacenado como JSONB en Postgres, cualquier herramienta o motor lo lee completo desde la DB. Las consultas de filtrado/búsqueda usan las columnas de metadatos (`nombre`, `estado`, `render_mode`); el contenido vive en `data`.

### 3.4.1 El árbol de `proyecto.data` (schema v3) — lo que añadió el Sprite Tool (F5)

Estructura real del `project.json` v3 tal como lo escriben las herramientas y lo lee el motor:

```jsonc
{
  "meta":   { "name": "Mi juego", "schemaVersion": 3, "renderMode": "3d" },
  "camera": { "posX": 5, "posY": 5, "posZ": 0.6, "yaw": 0.78, "pitch": 0 },
  "render": { "fov": 70, "backgroundColor": 0x000000, "fog": { "color": 0x000000, "density": 0.01 } },
  "world": {
    "vertices":   [{ "id": "v0", "x": 0, "y": 0 }],
    "sectors":    [{ "id": "s0", "vertexIds": ["v0","v1","v2","v3"], "floorH": 0, "ceilH": 3, "floorTex": "floor", "ceilTex": "ceil", "wallTex": "wall" }],
    "walls":      [{ "id": "w0", "a": "v0", "b": "v1", "sectorFront": "s0", "sectorBack": null, "tex": "wall" }],
    "ramps":      [{ "id": "r0", "type": "stairs", "pos": { "x": 2, "y": 2 }, "direction": { "x": 1, "y": 0 }, "width": 4, "rise": 3, "run": 6, "steps": 8 }],
    "sprites":    [{ "id": "sp1", "tex": "guard_f0", "pos": { "x": 10, "y": 10, "z": 0 }, "scale": 1, "billboard": true, "anim": "guard_idle", "entityType": "npc" }],
    "textures":   { "wall": 0x887766, "floor": "/assets/textures/floor.png" },   // string = ruta de asset, number = color puro
    "sky":        { "style": "realista", "hour": 14, "dayLengthSec": 120, "shadows": true },
    "spriteAnims": { "guard_idle": { "frames": ["guard_f0","guard_f1","guard_f2","guard_f3"], "fps": 4, "loop": true } }
  },
  "audio":  [{ "id": "door", "src": "/assets/audio/door.ogg", "bus": "sfx", "loop": false }],
  "music":  { "id": "tema", "intensity": 0, "bpm": 120 }
}
```

**Qué añadió el Sprite Tool (F5, Fases A–D ya cerradas):**

| Pieza | Dónde vive | Tipo de dato |
|-------|-----------|--------------|
| Frames recortados / sueltos | `world.textures[key]` | `string` = dataURL o ruta del asset (`/assets/sprites/guard_f0.png`) |
| Colores puros (sin archivo) | `world.textures[key]` | `number` (0xRRGGBB) — **no** generan fila `asset` |
| Animaciones de sprites | `world.spriteAnims[name]` | `{ frames: string[], fps?, loop? }` — los frames son claves de `world.textures` |
| Sprite animado | `world.sprites[].anim` | id de anim en `world.spriteAnims`; `billboard` (default true) garantiza render 2D orientado a cámara |
| Entidades | `world.sprites[]` + `entityType/entityName/collisionType/collisionBox` | el editor trata entidad y sprite como el mismo objeto |
| Audio | `audio[].src`, `variations[]`, `layers[]` | rutas a assets `tipo: audio` |
| Cielo | `world.sky` | `style: "classic"` (telón Daggerfall) o `"realista"` (día/noche F4.7) |

### 3.5 `asset` — cada archivo del juego

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | |
| `propietario_id` | `UUID` | FK → `usuario.id`, NOT NULL | Quién lo subió |
| `proyecto_id` | `UUID` | FK → `proyecto.id`, nullable | Proyecto al que pertenece (o global) |
| `nombre` | `TEXT` | NOT NULL | Nombre del archivo |
| `tipo` | `ENUM` | NOT NULL | `texture` \| `sprite` \| `audio` \| `font` \| `modelo` |
| `mime` | `TEXT` | NOT NULL | `image/png`, `audio/ogg`, ... |
| `tamano_bytes` | `INT` | NOT NULL | Tamaño en bytes |
| `ruta` | `TEXT` | **UNIQUE**, NOT NULL | Path real en blobs del servidor |
| `hash` | `TEXT` | nullable | Hash de contenido (deduplicación) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |

**Regla:** los **bytes** viven en el filesystem de blobs; `asset.ruta` los localiza. El `proyecto.data` referencia el asset por ruta/clave (ej. `world.textures["guard_f0"]` → `/assets/sprites/guard_f0.png`). Así no se infla la DB con binarios y se puede servir por HTTP estático.

**Sprite Tool (F5) + C5c:** los frames recortados/sueltos que la herramienta sube se registran aquí como `tipo: sprite` — **una fila por frame**, `nombre` = clave de textura (`guard_f0`), `ruta` = ubicación del blob; `world.textures["guard_f0"]` referencia la misma ruta. Desde **C5c** la subida es por la API (`POST /api/assets`, multipart, dedupe por hash) y el documento guarda la URL servida `/api/assets/<id>/file` (blob público — el motor la carga sin sesión); el middleware de Vite (`POST /assets/sprites/upload`) ya no existe. En producción, toda dataURL o ruta embebida en `project.data` se materializa como fila `asset` + blob antes de guardar/publicar (el Publisher solo empaqueta lo referenciado).

**Audio (F4.5):** `tipo: audio` para `.ogg`/`.wav`; `audio[].src`, `variations[]` (pools SFX) y `layers[]` (stems de música adaptativa) referencian estas rutas. Mismo patrón para `texture` (texturas de sector), `font` y `modelo`.

### 3.6 `galeria` — publicación pública (proyecto 1:1)

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `UUID` | PK | |
| `proyecto_id` | `UUID` | FK → `proyecto.id`, **UNIQUE**, onDelete cascade | El proyecto publicado |
| `slug` | `TEXT` | **UNIQUE**, NOT NULL | URL jugable `/play/:slug` |
| `titulo` | `TEXT` | NOT NULL | Título en la galería |
| `descripcion` | `TEXT` | NOT NULL, default '' | Descripción pública |
| `visitas` | `INT` | NOT NULL, default `0` | Contador de visitas |
| `published_at` | `TIMESTAMPTZ` | NOT NULL, default | |

**Nota:** solo un proyecto con `estado = PUBLICADO` debería tener fila en `galeria` (coherencia de estado ∉ galería).

### 3.7 `plantilla` — seed de proyectos nuevos

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `TEXT` | PK (slug legible, p.ej. `tpl-studio`) | Identificador único |
| `propietario_id` | `UUID` | FK → `usuario.id`, **nullable**, onDelete cascade | Dueño de la plantilla. `NULL` = plantilla **del sistema** (visible para todos) |
| `nombre` | `TEXT` | NOT NULL | Nombre de la plantilla |
| `descripcion` | `TEXT` | NOT NULL, default '' | |
| `data` | `JSONB` | NOT NULL | `project.json` de la plantilla (proyecto de ejemplo) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |

**Notas:**
- `NULL` = plantilla del sistema (p.ej. `tpl-demo`, la sala mínima): la lista cualquier visitante.
- Con dueño = plantilla personal (p.ej. `tpl-studio`, el escenario de trabajo de `chimi`): solo la ve y la usa su dueño (C5d).

### 3.8 `refresh_token` y `token_invalido` — sesión (tokens)

**Modelo de sesión:** access token = **JWT stateless de corta duración (15 min)**, validado por firma + expiración (no necesita tabla). El refresh token = **token opaco de 7 días**, guardado como **SHA-256** (nunca el valor en claro); solo así puede rotarse e invalidarse individualmente. La denylist existe para invalidar un access JWT que sigue vivo antes de expirar (logout, cambio de password).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| §3.8a `refresh_token` | | | |
| `id` | `UUID` | PK | |
| `usuario_id` | `UUID` | FK → `usuario.id`, NOT NULL, onDelete cascade | Dueño de la sesión |
| `token_hash` | `TEXT` | **UNIQUE**, NOT NULL | SHA-256 del token opaco (48 bytes aleatorios) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |
| `expira_en` | `TIMESTAMPTZ` | NOT NULL | `now() + 7 días` |
| `revocado_en` | `TIMESTAMPTZ` | nullable | NOT NULL = invalidado (logout o rotación) |
| §3.8b `token_invalido` | | | |
| `id` | `UUID` | PK | |
| `jti` | `TEXT` | **UNIQUE**, NOT NULL | claim `jti` del JWT revocado |
| `usuario_id` | `UUID` | FK → `usuario.id`, NOT NULL, onDelete cascade | |
| `expira_en` | `TIMESTAMPTZ` | NOT NULL | expiración original del JWT (para purgar) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |

**Validación de refresh:** existe (`token_hash`), no revocado (`revocado_en IS NULL`), no expirado (`expira_en > now()`). **Rotación:** al refrescar se revoca el viejo (`revocado_en = now()`) y se crea uno nuevo. **Logout:** revoca la fila refresh + inserta el `jti` del access en `token_invalido`. **Purga:** perezosa — al insertar/consultar se borran las filas con `expira_en < now()` (sin cron por ahora).

---

## 4. Enums

```prisma
enum EstadoProyecto {
  EN_DESARROLLO
  PUBLICADO
}

enum TipoAsset {
  texture
  sprite
  audio
  font
  modelo
}
```

---

## 5. Índices recomendados

| Índice | Tabla / columnas | Por qué |
|--------|------------------|---------|
| `users_login_idx` | `usuario.login` (unique) | Login O(1) |
| `projects_owner_idx` | `proyecto.propietario_id` | Listar proyectos de un usuario |
| `projects_state_idx` | `proyecto.estado` | Filtrar publicados/en desarrollo |
| `assets_project_idx` | `asset.proyecto_id` | Assets de un proyecto |
| `plantillas_owner_idx` | `plantilla.propietario_id` | Listar plantillas propias de un usuario |
| `gallery_slug_idx` | `galeria.slug` (unique) | Resolver `/play/:slug` |
| `refresh_token_usuario_idx` | `refresh_token.usuario_id` | Sesiones de un usuario (logout rotación) |
| `token_invalido_expira_idx` | `token_invalido.expira_en` | Purgar denylist vencida |

---

## 6. Generación de Prisma

El `server/prisma/schema.prisma` se generó en A3 a partir de la DB real (Prisma ORM 7) y es **espejo 1:1 del SQL de §3**. Boceto de su estructura:

> **Fidelidad a la DB (no al boceto original):** los `@id` usan `@default(dbgenerated("gen_random_uuid()"))`, `created_at`/`updated_at` usan `@default(now())` (la DB no tiene trigger de updated_at), los strings llevan `@db.VarChar(n)` y los enums `@@map("estado_proyecto")`/`@@map("tipo_asset")`. El archivo `server/prisma/schema.prisma` es la fuente de verdad exacta; este bloque es una guía.

```prisma
// Prisma 7: provider "prisma-client" con output explícito; la conexión la
// resuelve prisma.config.ts desde DATABASE_URL (el datasource ya no lleva url).
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Rol {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nombre      String    @unique @db.VarChar(64)
  descripcion String?
  usuarios    Usuario[]

  @@map("rol")
}

model Persona {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  nombre       String
  apellido     String
  emailPublico String?  @unique @map("email_publico")
  bio          String?
  avatarPath   String?  @map("avatar_path")
  createdAt    DateTime @default(now()) @map("created_at")
  usuario      Usuario?

  @@map("persona")
}

model Usuario {
  id           String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personaId    String?    @unique @map("persona_id") @db.Uuid
  persona      Persona?   @relation(fields: [personaId], references: [id], onDelete: Cascade)
  rolId        String     @map("rol_id") @db.Uuid
  rol          Rol        @relation(fields: [rolId], references: [id])
  login        String     @unique
  passwordHash String     @map("password_hash")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @default(now()) @map("updated_at")
  proyectos    Proyecto[]
  assets       Asset[]
  plantillas   Plantilla[]
  refreshTokens RefreshToken[]
  tokensInvalidos TokenInvalido[]

  @@map("usuario")
}

model RefreshToken {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  usuarioId   String    @map("usuario_id") @db.Uuid
  usuario     Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tokenHash   String    @unique @map("token_hash")
  createdAt   DateTime  @default(now()) @map("created_at")
  expiraEn    DateTime  @map("expira_en")
  revocadoEn  DateTime? @map("revocado_en")

  @@index([usuarioId])
  @@map("refresh_token")
}

model TokenInvalido {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jti         String   @unique
  usuarioId   String   @map("usuario_id") @db.Uuid
  usuario     Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiraEn    DateTime @map("expira_en")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([expiraEn])
  @@map("token_invalido")
}

model Proyecto {
  id            String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  propietarioId String          @map("propietario_id") @db.Uuid
  propietario   Usuario         @relation(fields: [propietarioId], references: [id], onDelete: Cascade)
  nombre        String
  slug          String?         @unique
  estado        EstadoProyecto  @default(EN_DESARROLLO)
  schemaVersion Int             @default(3) @map("schema_version")
  renderMode    String          @default("retro") @map("render_mode")
  data          Json
  thumbnailPath String?         @map("thumbnail_path")
  publishedAt   DateTime?       @map("published_at")
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @default(now()) @map("updated_at")
  assets        Asset[]
  galeria       Galeria?

  @@index([propietarioId])
  @@index([estado])
  @@map("proyecto")
}

model Asset {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  propietarioId String    @map("propietario_id") @db.Uuid
  propietario   Usuario   @relation(fields: [propietarioId], references: [id], onDelete: Cascade)
  proyectoId    String?   @map("proyecto_id") @db.Uuid
  proyecto      Proyecto? @relation(fields: [proyectoId], references: [id], onDelete: SetNull)
  nombre        String
  tipo          TipoAsset
  mime          String
  tamanoBytes   Int       @map("tamano_bytes")
  ruta          String    @unique
  hash          String?
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([proyectoId])
  @@map("asset")
}

model Galeria {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  proyectoId  String   @unique @map("proyecto_id") @db.Uuid
  proyecto    Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  slug        String   @unique
  titulo      String
  descripcion String   @default("")
  visitas     Int      @default(0)
  publishedAt DateTime @default(now()) @map("published_at")

  @@map("galeria")
}

model Plantilla {
  id            String   @id
  propietarioId String?  @map("propietario_id") @db.Uuid
  propietario   Usuario? @relation(fields: [propietarioId], references: [id], onDelete: Cascade)
  nombre        String
  descripcion   String   @default("")
  data          Json
  createdAt     DateTime @default(now()) @map("created_at")

  @@index([propietarioId])
  @@map("plantilla")
}

enum EstadoProyecto {
  EN_DESARROLLO
  PUBLICADO

  @@map("estado_proyecto")
}

enum TipoAsset {
  texture
  sprite
  audio
  font
  modelo

  @@map("tipo_asset")
}
```

---

## 7. Notas de coherencia

- **Un proyecto publicado** debe tener `estado = PUBLICADO` Y una fila en `galeria`; despublícar ⇒ `estado = EN_DESARROLLO` y borrar la fila de `galeria`.
- **Nada local**: el editor nunca persiste el mapa en `localStorage`/memoria como fuente de verdad; siempre lee/escribe `proyecto.data` en la DB (vía API).
- **Assets compartidos / huérfanos**: un asset con `proyecto_id` nulo pertenece a la biblioteca personal del usuario y puede referenciarse desde varios proyectos.
- **Sprite Tool (F5):** `world.sprites[].anim` debe existir como clave de `world.spriteAnims` (lo valida `validate.js` del motor); `world.textures` con valor string debe existir como `asset` (o ruta servida) antes de publicar — los colores puros (number) no necesitan `asset`.
- **Audio (F4.5):** `audio[].src`, `variations[]` y `layers[]` referencian assets `tipo: audio`; `music.id` debe existir en `audio[]` (también lo valida el motor).

---

## 8. Plan de construcción por pasos (poco a poco)

Orden de ejecución para montar el backend + DB en **pasos pequeños, verificables e independientes**. Cada paso deja algo funcional y se marca como `✅` en `ROADMAP.md` (§12) al terminar; se valida con el usuario antes de pasar al siguiente.

> Regla de avance: **un paso = un commit**. No pasar de paso hasta que el anterior esté `✅` y validado.
>
> Orden maestro: **1) base de datos (SQL → migración Prisma) → 2) estructura de carpetas y archivos → 3) backend (endpoints uno a uno)**. La DB es el cimiento: primero el SQL que la describe, luego Prisma lo versiona; sin DB no se escribe una línea de endpoints.

---

### Fase A — Base de datos (primero el SQL, después Prisma)

### A1 — Escribir el SQL completo del esquema — ✅ realizada

| | |
|---|---|
| **Qué se crea** | `server/db/schema.sql` — el esquema Postgres **escrito a mano** desde §3: `CREATE TYPE` (enums `EstadoProyecto`, `TipoAsset`), `CREATE TABLE` de `rol`, `persona`, `usuario`, `proyecto`, `asset`, `galeria`, `plantilla` (con FKs, UNIQUE, defaults, `ON DELETE CASCADE`), índices de §5, + seeds en SQL (`raíz` `admin`/`creador`, plantilla `tpl-demo`). Idempotente (re-ejecutable con `DROP ... IF EXISTS` al inicio). |
| **Criterio de aceptación** | El SQL es completo (todas las tablas de §3, todos los índices de §5); comentado en español; sin dependencias del ORM (Postgres plano sirve). Se valida en A2 al ejecutarlo de verdad. |

### A2 — Levantar Postgres y ejecutar el SQL — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se crea** | Postgres local + base de datos **`iliac_engine`**; ejecución de `schema.sql` (psql) que crea tablas, enums, índices y seeds. **Entorno real:** PostgreSQL **18.4 instalado en Windows** (`C:\Program Files\PostgreSQL\18\bin`), puerto `5432`, usuario `postgres`. Desde WSL los binarios de Postgres NO resuelven por ruta absoluta `/mnt/c/...` (interop); se invocan con `cd` a la carpeta `bin` + `cmd.exe /c` (ver nota). |
| **Criterio de aceptación** | `psql \dt` lista las 9 tablas (7 de dominio + `refresh_token`/`token_invalido`); `\d proyecto` muestra `data JSONB` y FKs; consultar `rol` devuelve `admin` y `creador`; re-ejecutar `schema.sql` no da error (idempotencia). **Verificado 2026-09-16:** 9 tablas, `data jsonb NOT NULL`, FKs `proyecto→usuario` (CASCADE) y `asset/galeria→proyecto`, seeds `admin`/`creador` + `tpl-demo`, re-ejecución `exit 0`. |

> **Cómo ejecutar psql desde WSL (PostgreSQL de Windows):** los `.exe` de Postgres no están en el PATH de Windows, así que el interop de WSL no los resuelve por ruta absoluta. Patrón que funciona:
> ```bash
> cd "/mnt/c/Program Files/PostgreSQL/18/bin" && \
>   cmd.exe /c 'set PGPASSWORD=<pw>&& set PGCLIENTENCODING=UTF8&& psql.exe -w -U postgres -h 127.0.0.1 -p 5432 -d iliac_engine -f C:\ruta\al\script.sql'
> ```
> `createdb.exe -U postgres -h 127.0.0.1 iliac_engine` crea la base; `psql -f <ruta sin espacios>` ejecuta scripts; para consultas por stdin, pipe desde bash (`printf '...' \| cmd.exe /c '...'`). La contraseña va en el `.env` (B1), nunca al repo.

### A3 — Migración Prisma desde el SQL — ✅ validada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | Tooling **Prisma 7** en `server/` (`package.json`, `prisma.config.ts`, `.env`/`.env.example`; deps `prisma` + `@prisma/client` + `@prisma/adapter-pg` + `pg` + `dotenv`). `server/prisma/schema.prisma` **espejo 1:1 del SQL** (introspección `db pull` + normalización a PascalCase/camelCase con `@@map`/`@map`; enums `EstadoProyecto`/`TipoAsset` mapeados). Baseline `prisma/migrations/0_init/migration.sql`. Test `server/tests/prisma-schema.test.js`. |
| **Criterio de aceptación** | ✅ `migrate diff --from-config-datasource --to-schema` → *empty migration* (cero diferencias con la DB); `migrate status` → *Database schema is up to date*; `prisma generate` compila el client **7.10.0**; `prisma validate` OK; `npm test` en `server/` **3/3 verde**. |
| **Nota (por qué baseline y no `migrate dev`)** | La DB ya tenía las tablas de A2, así que `migrate dev` habría fallado. Se usó **baseline**: `migrate diff --from-empty --to-schema` genera `0_init`, y `migrate resolve --applied 0_init` lo registra en `_prisma_migrations` sin re-ejecutar DDL. |

> **Por qué SQL primero y luego Prisma:** Prisma versiona y genera SQL por sí mismo, pero escribirlo a mano primero deja el modelo mental explícito (tipos, FKs, índices) y un artefacto consultable fuera del ORM; la migración Prisma después lo fija como fuente versionada. El `schema.prisma` y el `schema.sql` deben hablar el mismo lenguaje — si divergen, gana el que esté migrado (`schema.prisma`).

---

### Fase B — Estructura de carpetas y archivos (sin lógica de negocio)

### B1 — Esqueleto del servidor

> **Nota (C2):** `npm start` ejecuta `tsx src/index.ts` en vez de `node dist/src/index.js`. El server importa el validador del contrato en `contract/` (fuera de `server/`) y la emisión de tsc a `dist/` añade un nivel de directorio que rompe esa ruta relativa (dev resuelve con 3 `../`, dist necesita 4). Con tsx, producción y dev comparten resolución de imports y no hay que duplicar el validador. `npm run build` queda como chequeo de compilación (`--noEmit`). Si algún día se quiere `dist/` de verdad, usar un bundler (tsup/esbuild) que embeba el contrato en el bundle. — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | `package.json` (scripts `dev` tsx watch, `start`, `build` tsc, `typecheck`, `test` node+tsx), `tsconfig.json` (strict, NodeNext, `rewriteRelativeImportExtensions`), `.env` real con `PORT`/`JWT_SECRET`/`PUBLIC_URL` (+ `.env.example` de A3), `src/app.ts` (Hono con `logger()` + `GET /`), `src/index.ts` (`@hono/node-server` escucha en PORT), `src/db.ts` (singleton PrismaClient con adapter `PrismaPg`, fail-fast si falta `DATABASE_URL`), `storage/uploads/` (`.gitkeep`, blobs de C3). |
| **Criterio de aceptación** | ✅ `npm install` sin errores; `npm run typecheck` limpio; `npm run build` (chequeo de compilación); `npm test` 5/5 verde; arranca y escucha: `curl.exe http://localhost:3000/` → «Iliac Engine API» (200), ruta inexistente → 404. Proceso verificado y limpiado por puerto. |

### B2 — Contrato de respuesta y salud (la estructura respira) — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | `src/lib/codes.ts` (diccionario: 12 códigos → status + mensaje en español, única fuente del mapeo), `src/lib/AppError.ts` (clase con `code/status/details` + `fromZod` → 422), `src/lib/handler.ts` (`ok()`, `errorResponse()`, `errorHandler()` global en `app.onError` — nunca filtra stacks en producción), `src/app.ts` → `createApp({ probeDb? })` con CORS (`PUBLIC_URL`), request-id (`X-Request-Id`), `notFound` con contrato, `GET /` envuelto en contrato, `GET /health` (liveness) y `GET /ready` (sonda inyectable; por defecto `SELECT 1` vía Prisma). |
| **Criterio de aceptación** | ✅ `curl.exe /health` → `{"success":true,"data":{"status":"ok"},"error":null}`; `/ready` → `{"success":true,"data":{"status":"ok","db":"up"}}` con DB real (503 `DB_UNAVAILABLE` con DB caída); ruta inexistente → 404 con contrato (no HTML plano); `AppError`/`Zod` → contrato. `npm run typecheck` limpio, `npm test` 11/11, build OK. |

---

### Fase C — Backend (endpoints, uno por paso)

### C1 — Auth: `registro` e `inicio de sesión` — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | `src/schemas/auth.ts` (Zod: register/login), `src/lib/password.ts` (bcrypt 12 rounds, bcryptjs), `src/lib/jwt.ts` (hono/jwt HS256: access 15 min, refresh 7 días; `sha256hex` para el hash del refresh), `src/lib/rateLimit.ts` (`createLimiter` en memoria, `loginLimiter` 5/min por IP), `src/routes/auth.ts` (`POST /auth/register` crea Persona + Usuario rol `creador` en transacción; `POST /auth/login` → INVALID_CREDENTIALS genérico sin enumerar usuarios; refresh guardado hasheado en `RefreshToken`); `codes.ts` +`LOGIN_IN_USE` (409) y `TOO_MANY_REQUESTS` (429); rutas montadas en `app.ts` (`/auth`). |
| **Criterio de aceptación** | ✅ `register` → 201 contrato + tokens verificados con `JWT_SECRET` (sub/login/rol, exp futuro; el hash nunca viaja); duplicado → 409 `LOGIN_IN_USE`; password corta → 422 `VALIDATION_ERROR` con issue `password`; `login` ok → 200; password mala / usuario inexistente → 401 `INVALID_CREDENTIALS` (idéntico); rate limit → 429 `TOO_MANY_REQUESTS`; `npm run typecheck` limpio, `npm test` 18/18, build OK, verificado por curl contra DB real. Los tests de auth requieren Postgres local (skip con motivo si no hay DB). |

### C2 — Proyectos: `proyecto` (data JSONB v3) — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | CRUD protegido por JWT sobre `proyecto` (`src/routes/projects.ts` + `src/lib/auth.ts` `requireAuth` + `src/schemas/project.ts` + `src/lib/parseBody.ts`): `POST /api/projects` (201, `data` opcional → esqueleto v3 mínimo), `GET /api/projects` (lista metadata sin `data`), `GET /api/projects/:id` (árbol completo), `PATCH /api/projects/:id` (nombre y/o `data` — **reemplazo** del JSONB, no merge; decisión del plan), `DELETE /api/projects/:id`. El `data` se valida con **`validateProject` del contrato** (`contract/project-schema.js` importado desde el server — cero duplicación de validación). Bonificación: `allowJs` en tsconfig; `start` pasa a correr con **tsx** (el build tsc no puede resolver `contract/` fuera de `server/` — ver nota B1); se corrigió un bug de C1: tokens sin `jti` colisionaban en `token_hash` si dos sesiones del mismo usuario caían en el mismo segundo (500 intermitente). |
| **Criterio de aceptación** | ✅ Crear proyecto → el JSONB v3 completo se persiste y `GET /:id` devuelve el MISMO árbol (deepEqual en tests); `data` inválido → 422 `VALIDATION_ERROR` con detalle del validador; proyecto ajeno → `404 PROJECT_NOT_FOUND`; sin token/token malo → 401 `UNAUTHORIZED`; `npm run typecheck` limpio y `npm test` **27/27** (9 nuevos de proyectos, integración contra DB local, skip con motivo si no hay DB); verificado por curl contra el server de producción. Seed `tpl-demo` **diferido a C4** (decisión: sin consumidor en C2; `sample-project.ts` depende del Studio). |

### C3 — Assets: `asset` + blobs en filesystem — ✅ realizada (2026-09-16)

| | |
|---|---|
| **Qué se creó** | Subida/lectura/borrado de assets sobre la tabla `asset` (`src/routes/assets.ts` + `src/lib/storage.ts` + `src/schemas/assets.ts`): `POST /api/assets` (multipart: `file`+`tipo`+`proyectoId?`), `GET /api/assets/:id` (metadata), `GET /api/assets/:id/file` (bytes con `Content-Type` real), `DELETE /api/assets/:id` (fila + archivo). El **MIME se detecta por magic bytes** (`file-type`, nueva dep) — nunca se confía en la extensión ni en el header del navegador — y el `tipo` declarado debe encajar con él (422 si no). **Tope 20 MB** → `413 ASSET_TOO_LARGE` (nuevo código). **Dedupe por hash sha256**: re-subir el mismo archivo devuelve el asset existente (200) sin duplicar bytes ni fila (equivale al criterio "reusa bytes"; nota: no hay content-addressed storage porque `asset.ruta` es `@unique` — dos filas no pueden compartir archivo). **Blob en `storage/uploads/<id>.<ext>`** (ruta resuelta con `import.meta.dirname`, configurable por `STORAGE_PATH` — los tests usan un `mkdtemp` limpio). |
| **Criterio de aceptación** | ✅ Subir el PNG del Sprite Tool (`guard_f0`) → fila `asset` (`tipo: sprite`, `mime: image/png`, hash sha256) + blob servido por `/file` con **bytes idénticos** (round-trip verificado por curl y por test); re-subir el mismo archivo → `reused: true` con el mismo id; borrar elimina fila + archivo (GET posterior → 404 `ASSET_NOT_FOUND`). Tests: **36/36** (9 nuevos de assets, con storage temporal). Verificado en producción: POST → GET `/file` (cmp) → re-subir (dedupe) → DELETE → 404. |

### C4 — Galería y plantillas: `galeria`, `plantilla` — ✅ realizada

| | |
|---|---|
| **Qué se creó** | Publicación/despublicación transaccional en `routes/projects.ts`: `PATCH /api/projects/:id/publish` (upsert en `galeria` + `estado=PUBLICADO` + `publishedAt`; slug autogenerado desde `nombre` o explícito; conflicto → `SLUG_TAKEN`; **revalida `data` con `validateProject`** antes de publicar) y `PATCH /api/projects/:id/unpublish` (revertir, **idempotente**). Galería pública sin auth en `routes/gallery.ts`: `GET /api/gallery` (lista con autor, sin `data`) y `GET /api/gallery/:slug` (data completo para el motor + **incrementa `visitas`**). Plantillas públicas en `routes/templates.ts`: `GET /api/templates` (sin data) y `GET /api/templates/:id` (con data; inexistente → `404 TEMPLATE_NOT_FOUND`, código nuevo). `POST /api/projects` acepta `plantillaId` → crea con `plantilla.data` (nombre hereda). El seed `tpl-demo` pasó de ser un cascarón a una **sala v3 jugable** (sector 10×10, 4 paredes, texturas color, `sky.set/frame`) que valida contra el contrato. |
| **Criterio de aceptación** | ✅ Publicar → aparece públicamente con slug único (`SLUG_TAKEN` en conflicto; autogenerado con sufijo `-2/-3` si colisiona); despúblicar → desaparece de la galería (y `GET /:slug` → 404); crear proyecto desde `tpl-demo` carga la sala jugable (validada por el contrato y probada por API). Tests: **48/48** (11 nuevos en `gallery-templates.test.ts`: publish, slug en conflicto, visitas 1→2, unpublish idempotente, ajeno → 404, plantilla válida, POST con plantillaId, 404 plantilla inexistente, público sin token). |

### C5 — Integración del Studio (frente real)

| | |
|---|---|
| **Qué se crea** | Cliente tipado `apiFetch<T>` (contrato §5b) + sesión; reemplazo de `localStorage` por la API como fuente de verdad: guardar/cargar el proyecto del editor en `proyecto.data`; lista de proyectos del usuario (abrir/crear/borrar); frames del Sprite Tool → `POST /api/assets`. |
| **Criterio de aceptación** | Diseñar un nivel → Guardar → recargar la página → el nivel vuelve de la DB; el Sprite Tool guarda y re-lee frames desde la API (fin de los toasts "Guardado real pendiente"). ⚠️ Este paso **toca flujos ya validados del Studio**: requiere tu validación explícita antes de ejecutarse. |

**Sub-bloques:**
- **C5a ✅ (2026-09-16) — Autenticación integrada (prerrequisito):** `studio/src/io/api.ts` (apiFetch tipado que importa `ApiResponse` de `contract/api-response.d.ts` — contrato único, sin duplicados; Bearer automático; `ApiError {code,message,details}`), `studio/src/io/session.ts` (sesión en **cookie** `raycast_session` Path=/ 7 días — decisión del usuario, no localStorage; store inyectable), `studio/src/ui/AuthModal.ts` (login/registro, DESIGN.md), botón Cuenta en la toolbar, proxy dev `/api`+`/auth` → 3000 (same-origin). Verificado end-to-end contra el server real (registro/login → `/api/projects` 401 sin token / 200 con token). Tests: `studio/tests/api.test.ts` + `session.test.ts` (server 48/48 + Studio **226**). Cuenta dev `chimi` documentada en `README.md`.
- **C5b ✅ (2026-09-16) — Guardar/cargar el proyecto por API (fuente de verdad):** endpoints tipados del CRUD en `api.ts` (`apiListProjects`/`apiGetProject`/`apiCreateProject`/`apiUpdateProject`/`apiDeleteProject` + tipos `ProjectMeta`/`FullProject`); `studio/src/io/CloudProject.ts` (pegamento editor↔API: `createCloudProject` POST, `saveCloudProject` PATCH `{nombre, data}` — data reemplaza el árbol v3 completo y `nombre`/`data.meta.name` se mantienen sincronizados, `loadCloudMostRecent` abre el último por `updatedAt` descendente; prevalida con `validateProjectJson` del contrato, sin duplicar la validación del server). `main.ts`: arranque con sesión → abre el último proyecto o crea uno con el documento actual; Guardar (Ctrl+S/botón) → nube con sesión / localStorage con aviso sin sesión; 401 → sesión expirada (logout + toast + fallback local). Importar JSON también persiste a la nube con sesión. Verificado end-to-end vía API real (POST → PATCH nombre+data → GET :id → DELETE; la data inválida se rechaza tanto cliente como server). Tests: `studio/tests/cloud-project.test.ts` (Studio **232/232**). Sin cambios de schema ni de contrato.
- **C5c ✅ validada (2026-09-17) — Assets del Studio por API (sprites + audio, fin del guardado local):** el guardado de assets (frames del Sprite Tool y audios del popover) sale del middleware de Vite y pasa al backend. **Server** (`routes/assets.ts`): `GET /api/assets/:id/file` ahora es **PÚBLICO** — D1, el motor carga `TextureLoader`/`fetch` sin sesión (la metadata `GET /:id` y el borrado siguen exigiendo JWT+propiedad); nuevo `GET /api/assets` (D6) lista solo los del usuario con filtro opcional `?tipo=audio` (422 si el tipo no es del enum) y orden `createdAt desc`; MIMEs de audio ampliados (D5): `application/ogg`/`audio/ogg`/`wav`/`mpeg`/`flac`/`mp4`/`x-m4a`/`aac`/`video/webm` (lo que ya admitía el middleware viejo); `assertUuid` extraído a `server/src/lib/ids.ts` y aplicado también en assets (id no-UUID → 404 ASSET_NOT_FOUND, nunca 500; misma guarda que C2 hizo en proyectos). **Studio**: `io/assetApi.ts` (nuevo) — `uploadSpriteFrames` (key→dataURL → `POST /api/assets` tipo sprite, `dataUrlToBlob`), `uploadAudioFiles` (File[] → tipo audio), `listAudioUrls`, `assetUrl(id)` = `/api/assets/<id>/file`; `api.ts` añade `apiUploadAsset` (multipart) y `apiListAssets` + fix: con `FormData` NO se fuerza `Content-Type` (el navegador pone el boundary — forzarlo a JSON rompía la subida); **FileManager.ts pierde localStorage** (`saveToLocal`/`loadFromLocal`/`clearLocal` eliminados; queda solo export/import `.json`); `main.ts` introduce `requireSession(accion)` — **todo guardado (proyecto, exportar, importar, sprites, audio) exige sesión**: sin sesión → toast + modal de Cuenta y se aborta (decisión C5c, sin fallback local); `ToolManager` recibe puente `AudioAssetBridge` (inyectado por main: `requireSession`/`upload`/`listUrls`) y el popover de Audio sube/lista por la API — el def guarda `/api/assets/<id>/file` y marca en rojo los `src` que ya no existen en la cuenta; middleware de Vite (`vite.config.ts` + `assetServer.ts`) reducido a servido estático de `assets/` (compatibilidad con proyectos antiguos que guardaban rutas locales) — `POST /assets/audio|sprites/upload` y `GET /assets/audio|sprites/list` eliminados. Tests: server `assets.test.ts` **55/55** (blob público sin token = round-trip idéntico, metadata/borrado 401, id no-UUID 404, MP3 → `audio/mpeg`, listado + `?tipo` + 422, nunca assets ajenos) y Studio `asset-api.test.ts` **227/227** (dataUrl→Blob, POST multipart por frame, dedupe `reused`, fallo por frame sin lanzar, listado de audios). Sin cambios de schema ni de contrato (los assets se referencian por URL servida en `world.textures`/`audio[].src`).

- **C5d ✅ realizada (2026-09-17) — Plantilla de arranque desde la API (el documento de partida deja de ser código):** el Studio ya no arranca con `studio/src/sample-project.ts` (721 KB generados en código, siempre el mismo mundo): el documento de partida lo sirve la API.
  - **Schema (aplicado):** `plantilla` gana **`propietario_id`** (`UUID` nullable, FK → `usuario.id` onDelete cascade; índice `plantillas_owner_idx`). `NULL` = plantilla **del sistema** (visible para todos, p.ej. `tpl-demo`); con dueño = plantilla **personal** (p.ej. `tpl-studio`, el escenario de trabajo del usuario **`chimi`**). Aplicado en `schema.sql`, `prisma/schema.prisma` y migración `prisma/migrations/20260917000000_plantilla_propietario`.
  - **Server (hecho):** `optionalAuth` en `lib/auth.ts`; `GET /api/templates` filtra por dueño — sin auth solo las del sistema (`propietario_id IS NULL`); con auth, las del sistema + las propias. `GET /api/templates/:id` respeta la propiedad: del sistema → público; personal → solo su dueño (ajena → `404 TEMPLATE_NOT_FOUND`); `POST /api/projects {plantillaId}` busca con `OR (propietario_id IS NULL OR propietario_id = userId)`. Seed del escenario en `server/db/seeds/tpl-studio.json` (~721 KB, generado por `studio/scripts/export-template.ts`) + `server/src/scripts/seed-templates.ts` (`npm run seed:templates`, idempotente con `ON CONFLICT DO UPDATE`, resuelve el dueño por login — `chimi` por defecto vía `SEED_OWNER_LOGIN`; si el usuario no existe, avisa y **no** inserta la plantilla). Sembrado y verificado contra la DB real.
  - **Studio (hecho):** `apiListTemplates` en `io/api.ts`; `io/StartProject.ts` (`loadStartProject` → `{state, projectId}`: con sesión abre el último proyecto o crea uno desde `tpl-studio`; **sin sesión devuelve un documento vacío y no llama a la API** — el editor se explora en vacío); `main.ts` con arranque **async** (top-level await → `vite.config.ts` con `build.target: 'esnext'`) y `initCloudProject` (login en caliente: último proyecto, o subir lo dibujado sin sesión, o primer proyecto desde la plantilla); `EditorViewport.init(project: unknown)` sin default hardcodeado; `sample-project.ts` sale del runtime y queda como script de autoría (solo regenera la plantilla). **Con sesión, si el backend no responde o la sesión caducó (401 → `clearSession`), el editor abre igual vacío con un toast de aviso** (la UI nunca se queda en blanco).
  - **Criterio de aceptación (cumplido):** con la sesión de `chimi` el Studio arranca con `tpl-studio`; **sin sesión arranca vacío, sin peticiones a la API**; editar el JSON de la plantilla en la DB cambia el mundo al recargar **sin recompilar** el Studio; cuenta nueva → primer proyecto con `POST /api/projects {plantillaId}` (no se suben 721 KB desde el navegador); backend caído con sesión → el editor abre igual vacío con aviso (nunca pantalla en blanco). Tests: server **59/59** (`gallery-templates.test.ts`: lista filtrada por dueño, `:id` ajeno → 404, crear desde plantilla personal) + Studio **235/235** (`start-project.test.ts`: vacío sin fetch, plantilla con sesión, `isEmptyDoc`, backend caído y 401 → vacío con aviso y sesión limpiada) + motor **192/192** (`WorldMesh.build` y `Engine3D.update` con mundo vacío) + fixtures `landscape.test.ts`/`serializer.test.ts` sin tocar; `npx vite build` OK y `sample-project` tree-shaken del bundle (0 rastros de `prop_pocion` en `dist/`).
- **C5e ✅ realizada (2026-09-17) — Mis proyectos: selector del usuario autenticado (abrir/nuevo/borrar):** C5b solo abría el último proyecto; ahora se puede elegir otro. **Lógica pura** `studio/src/io/MyProjects.ts` (testeable sin DOM, mismo patrón que CloudProject): `listMyProjects()` (wrapper de `GET /api/projects` con `updatedAt`), `openMyProject(id)` (`GET /api/projects/:id` → árbol v3 completo → `fromProjectJson`) y `deleteMyProject(id)` (`DELETE /api/projects/:id`). **UI** `studio/src/ui/ProjectPicker.ts` (modal patrón DungeonBrowser, sin lógica de negocio): filas con **nombre + fecha de edición** + acciones **Abrir** (`folder-open`) y **Borrar** (`trash-2`) con **diálogo de confirmación** reutilizable `ui/ConfirmDialog.ts`; al borrar la lista se **refresca**; pie con **Nuevo proyecto** (crea desde plantilla personal vía `createFromTemplate()` y lo abre). `main.ts` gana **`openProject(id)`** reutilizable por el arranque (`initCloudProject` ahora lo usa para el más reciente) y por el selector, con **aviso si hay cambios sin guardar** (`dirty` flag via `doc.onChange` — decisión del usuario: confirmar antes de descartar; se resetea en `applyDoc`/`saveCurrent`); botón de toolbar `folder-open` «Mis proyectos» (`Ctrl+Shift+O`, antes del `Ctrl+O` de importar que ahora excluye Shift). Sin sesión el selector **no aparece**: `requireSession('ver tus proyectos')` pide iniciar sesión (toast + modal de Cuenta). **Sin cambios de schema ni de contrato** — los endpoints ya existían (C2). Tests: Studio **240/240** (`my-projects.test.ts`: lista con nombre/fecha, abrir distinto del último, 404 → ApiError, DELETE, cuenta vacía) + `typecheck` limpio + `vite build` OK. Criterio de aceptación: abrir un proyecto distinto del último carga su árbol v3 completo; borrar pide confirmación y refresca la lista; sin sesión el selector no aparece (pide iniciar sesión). **Fix 2026-09-17 (detectado en la validación): los botones de fila nacían `disabled`** — `refresh()` pintaba la lista con `busy = true` y `item()` copiaba ese estado a Abrir/Borrar; `setBusy(false)` solo re-habilitaba «Nuevo proyecto», así que las filas quedaban muertas y el cursor salía «prohibido» (`.btn:disabled { cursor: not-allowed }`). Se quitaron las dos asignaciones (el `busy` solo gobierna el botón de crear) + test de regresión `studio/tests/project-picker.test.ts` (stub de DOM mínimo, sin jsdom: comprueba que las filas nacen habilitadas y que Abrir llama a `onOpen` con el id). Studio **246/246**.

- **C5f ✅ realizada (2026-09-17) — Renovación de sesión con rotación del refresh (el access de 15 min deja de dejar la app muerta):** síntoma reportado: pasados ~15 min, «Mis proyectos» fallaba al abrir/borrar (401 `UNAUTHORIZED`) y solo se arreglaba volviendo a iniciar sesión; el backend no tenía `POST /auth/refresh` y el Studio no renovaba nada.
  - **Server (hecho):** nuevo **`POST /auth/refresh`** en `routes/auth.ts` (rate limit `refreshLimiter` 10/min en `lib/rateLimit.ts`; `refreshSchema` `{ refreshToken: string 1..4096 }` en `schemas/auth.ts`): verifica el JWT refresh (firma + expiración), busca la fila por `sha256hex(token)` (**sin `sid` en el payload** — `tokensFor()` nunca lo firmó; el hash unique identifica la sesión y evita acoplarse al plan original de `jwt.ts`), y: fila inexistente/expirada → 401; fila **ya revocada** → **reuso/robo**: revoca TODAS las sesiones del usuario + 401; fila viva → **rotación atómica** (`$transaction`: revoca el refresco viejo por `tokenHash` + crea el nuevo con `expiraEn` a 7 días) y responde con el mismo shape de login (`user`, `accessToken`, `refreshToken`, `refreshTokenId`). Sin cambios de schema (las tablas `refresh_token`/`token_invalido` ya existían) ni de contrato.
  - **Studio (hecho):** `io/api.ts` **`apiRefresh(refreshToken)`** + auto-renovación en `apiFetch`: ante `error.code === 'UNAUTHORIZED'` (y sin `_retried`, y fuera de `/auth/login`/`/auth/register`/`/auth/refresh`) renueva con el refresh de la cookie, **re-guarda la sesión** (`setSession`) y **reintenta UNA vez** (`_retried`); si la renovación falla → `clearSession()` + se lanza el 401 original (el caller ya hace logout/toast). Las renovaciones son **deduplicadas** (promesa compartida `renewPromise`): una ráfaga de 401 concurrentes hace **un solo** POST `/auth/refresh`. Ningún flujo del editor cambia (mismo `apiFetch`).
  - **Verificación end-to-end (contra el server real):** login → `POST /auth/refresh` **200** con tokens nuevos → el refresh viejo → **401 `UNAUTHORIZED`** → `GET /api/projects` con el **access rotado** → **200** (5 proyectos de `chimi`). Reinicio del server con el código nuevo y `curl.exe`, según el entorno WSL.
  - **Tests:** server **67/67** (`tests/auth-refresh.test.ts`: refresh válido + rotación del sid, encadenado, token inexistente/malformado/expirado → 401, **reuso revoca todas las sesiones**, 422 sin token, 429 al 11º intento con IP aislada) + Studio **244/244** (`tests/api-refresh.test.ts`: 401+refresh OK → reintenta con el access nuevo, 401+refresh KO → `ApiError` + cookie limpia, login no se auto-renueva, ráfaga concurrente → **una sola** renovación) + `typecheck` limpio en ambos + `vite build` OK.
  - **Criterio de aceptación:** con el access caducado, abrir/borrar en «Mis proyectos» funciona sin volver a iniciar sesión; el refresh viejo deja de servir tras rotar; un refresh robado revoca todas las sesiones del usuario.

### Hueco futuro (fuera de estas fases)

Roles `admin` vs `creador` aplicados por endpoint, thumbnails/galería con imágenes reales, rate limits globales, tests e2e Studio↔API, despliegue (Docker Compose completo). Nada de esto bloquea las fases A–C.

---

## 9. Referencias cruzadas

| Pieza del plan | Dónde se define |
|---|---|
| Contrato de respuesta API (`{success,data,error}`) y errores | ROADMAP.md §5b |
| Reglas del entorno WSL (node.exe, curl.exe, taskkill por puerto) | AGENTS.md §Entorno |
| Schema v3 del motor (árbol `proyecto.data`) | ROADMAP.md §5, `docs/ENGINE_COMPONENTS.md` §4 |
| Herramientas del Studio que consumirán la API | `TOOLS.md`, `DESIGN.md` |
