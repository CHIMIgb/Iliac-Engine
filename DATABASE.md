# DATABASE.md — Esquema de Base de Datos (PostgreSQL + Prisma)

> **Visión a largo plazo.** El backend (API + Postgres) aún no existe (no hay código; el motor del juego es JS vanilla, ver `ROADMAP.md` §13–§15). Este documento describe la **arquitectura prevista** del servidor del Studio; el `server/db/schema.prisma` se creará a partir de aquí cuando se arranque el backend.
>
> Esquema de datos del servidor de RayCast Studio. El ORM es **Prisma** sobre **PostgreSQL**.
> Este documento es la **fuente de verdad del esquema**: de aquí se generará `server/db/schema.prisma` cuando exista backend.
>
> Regla rectora: **toda la información del juego (mapas, texturas, sprites, entidades, rutas de assets, estado) vive en la base de datos. Nada hardcodeado ni almacenado solo localmente.**
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
                    │ plantilla │   (independiente, seed)
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
| `plantilla` | standalone |

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
| `data` | `JSONB` | NOT NULL | **`project.json` v2 COMPLETO**: `meta`, `settings`, `textures`, `sprites`, `map`, `entities`, `...` |
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

**Sprite Tool (F5):** los frames recortados/sueltos que la herramienta sube (`POST /assets/sprites/upload` en desarrollo) se registran aquí como `tipo: sprite` — **una fila por frame**, `nombre` = clave de textura (`guard_f0`), `ruta` = ubicación del blob; `world.textures["guard_f0"]` referencia la misma ruta. En producción, toda dataURL o ruta embebida en `project.data` se materializa como fila `asset` + blob antes de guardar/publicar (el Publisher solo empaqueta lo referenciado).

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
| `id` | `TEXT` | PK (slug legible, p.ej. `tpl-demo`) | Identificador único |
| `nombre` | `TEXT` | NOT NULL | Nombre de la plantilla |
| `descripcion` | `TEXT` | NOT NULL, default '' | |
| `data` | `JSONB` | NOT NULL | `project.json` de la plantilla (incluye el demo) |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |

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
| `gallery_slug_idx` | `galeria.slug` (unique) | Resolver `/play/:slug` |
| `refresh_token_usuario_idx` | `refresh_token.usuario_id` | Sesiones de un usuario (logout rotación) |
| `token_invalido_expira_idx` | `token_invalido.expira_en` | Purgar denylist vencida |

---

## 6. Generación de Prisma

El `server/db/schema.prisma` se genera a partir de las tablas anteriores. Esquema base:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Rol {
  id          String   @id @default(uuid()) @db.Uuid
  nombre      String   @unique
  descripcion String?
  usuarios    Usuario[]
}

model Persona {
  id           String   @id @default(uuid()) @db.Uuid
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
  id           String     @id @default(uuid()) @db.Uuid
  personaId    String?    @unique @map("persona_id") @db.Uuid
  persona      Persona?   @relation(fields: [personaId], references: [id], onDelete: Cascade)
  rolId        String     @map("rol_id") @db.Uuid
  rol          Rol        @relation(fields: [rolId], references: [id])
  login        String     @unique
  passwordHash String     @map("password_hash")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")
  proyectos    Proyecto[]
  assets       Asset[]
  refreshTokens RefreshToken[]
  tokensInvalidos TokenInvalido[]

  @@map("usuario")
}

model RefreshToken {
  id          String    @id @default(uuid()) @db.Uuid
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
  id          String   @id @default(uuid()) @db.Uuid
  jti         String   @unique
  usuarioId   String   @map("usuario_id") @db.Uuid
  usuario     Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  expiraEn    DateTime @map("expira_en")
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([expiraEn])
  @@map("token_invalido")
}

model Proyecto {
  id            String          @id @default(uuid()) @db.Uuid
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
  updatedAt     DateTime        @updatedAt @map("updated_at")
  assets        Asset[]
  galeria       Galeria?

  @@index([propietarioId])
  @@index([estado])
  @@map("proyecto")
}

model Asset {
  id            String    @id @default(uuid()) @db.Uuid
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
  id          String   @id @default(uuid()) @db.Uuid
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
  id          String   @id
  nombre      String
  descripcion String   @default("")
  data        Json
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("plantilla")
}

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

### A1 — Escribir el SQL completo del esquema

| | |
|---|---|
| **Qué se crea** | `server/db/schema.sql` — el esquema Postgres **escrito a mano** desde §3: `CREATE TYPE` (enums `EstadoProyecto`, `TipoAsset`), `CREATE TABLE` de `rol`, `persona`, `usuario`, `proyecto`, `asset`, `galeria`, `plantilla` (con FKs, UNIQUE, defaults, `ON DELETE CASCADE`), índices de §5, + seeds en SQL (`raíz` `admin`/`creador`, plantilla `tpl-demo`). Idempotente (re-ejecutable con `DROP ... IF EXISTS` al inicio). |
| **Criterio de aceptación** | El SQL es completo (todas las tablas de §3, todos los índices de §5); comentado en español; sin dependencias del ORM (Postgres plano sirve). Se valida en A2 al ejecutarlo de verdad. |

### A2 — Levantar Postgres y ejecutar el SQL

| | |
|---|---|
| **Qué se crea** | Postgres local (Docker Compose `postgres:16` o instalación WSL) + base de datos `raycast`; ejecución de `schema.sql` (psql) que crea tablas, enums, índices y seeds. |
| **Criterio de aceptación** | `psql \dt` lista las 7 tablas; `\d proyecto` muestra `data JSONB` y FKs; consultar `rol` devuelve `admin` y `creador`; re-ejecutar `schema.sql` no da error (idempotencia). |

### A3 — Migración Prisma desde el SQL

| | |
|---|---|
| **Qué se crea** | `schema.prisma` **espejo 1:1 del SQL** (mismos modelos, enums, únicos, índices — §6 ya lo esboza, ahora se ajusta a lo que A1/A2 dejaron en Postgres); tooling Prisma en `server/`; migración inicial versionada `prisma migrate dev --name init`. |
| **Criterio de aceptación** | `prisma migrate dev` genera y aplica la migración sin ningún cambio pendiente (`migrate status` limpio); `prisma generate` compila el client; el esquema Prisma equivale al SQL (comprobación: sin `--create-only`, la DB ya tenía las tablas gracias a A2 → Prisma la reconcilia y queda en sync). |

> **Por qué SQL primero y luego Prisma:** Prisma versiona y genera SQL por sí mismo, pero escribirlo a mano primero deja el modelo mental explícito (tipos, FKs, índices) y un artefacto consultable fuera del ORM; la migración Prisma después lo fija como fuente versionada. El `schema.prisma` y el `schema.sql` deben hablar el mismo lenguaje — si divergen, gana el que esté migrado (`schema.prisma`).

---

### Fase B — Estructura de carpetas y archivos (sin lógica de negocio)

### B1 — Esqueleto del servidor

| | |
|---|---|
| **Qué se crea** | Carpeta `server/` con: `package.json` (scripts `dev`, `build`, `test`, `typecheck`), `tsconfig.json` (strict), `.env` + `.env.example` (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `PUBLIC_URL`), `.gitignore` (node_modules, `.env`, `storage/`), `src/index.ts` (Hono app vacía con middleware básico), `src/db.ts` (singleton PrismaClient), `storage/uploads/` (blobs). |
| **Criterio de aceptación** | `npm install` sin errores; `npm run typecheck` limpio; la app arranca y escucha en el puerto configurado. |

### B2 — Contrato de respuesta y salud (la estructura respira)

| | |
|---|---|
| **Qué se crea** | Las 3 piezas de errores (ROADMAP §5b): `src/lib/codes.ts` (diccionario de códigos), `src/lib/AppError.ts`, `src/lib/handler.ts` (interceptor global `onError` — nunca filtra stacks); logger con request id; CORS; y los únicos endpoints de infraestructura: `GET /health` (liveness) y `GET /ready` (readiness, chequea DB). |
| **Criterio de aceptación** | `curl.exe http://localhost:3000/health` → `{"success":true,"data":{"status":"ok"},"error":null}`; `curl.exe http://localhost:3000/ready` responde `ok` solo con DB conectada; una ruta inexistente responde con el contrato `{success:false, error}` en vez de HTML plano. |

---

### Fase C — Backend (endpoints, uno por paso)

### C1 — Auth: `registro` e `inicio de sesión`

| | |
|---|---|
| **Qué se crea** | `POST /auth/register` y `POST /auth/login` sobre las tablas de A1–A3 (`rol`, `persona`, `usuario`): bcrypt 12 rounds, JWT access (15 min) + refresh (7 días), rate limit en login, validación Zod de todos los inputs. |
| **Criterio de aceptación** | Registrar → login → token desencripta con `JWT_SECRET`; password nunca viaja en claro ni se loguea; contrato `{success,data,error}` en toda respuesta; test Vitest de registro/login verde. |

### C2 — Proyectos: `proyecto` (data JSONB v3)

| | |
|---|---|
| **Qué se crea** | CRUD de proyectos sobre la tabla `proyecto` (auth, solo propietario): `POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id` (merge parcial del JSONB), `DELETE /api/projects/:id`; validación del `data` con Zod + `validateProject` del motor; seed `tpl-demo` desde `demo/project.js`. |
| **Criterio de aceptación** | Crear proyecto → el JSONB v3 completo (`world`, `audio`, …) se persiste y `GET` devuelve el mismo árbol; proyecto ajeno → `PROJECT_NOT_FOUND` (404); endpoints protegidos por auth. |

### C3 — Assets: `asset` + blobs en filesystem

| | |
|---|---|
| **Qué se crea** | Subida/lectura/borrado de assets sobre la tabla `asset` (tipo enum `TipoAsset`): `POST /api/assets` (multipart), `GET /api/assets/:id` (metadata), `GET /api/assets/:id/file` (bytes), `DELETE /api/assets/:id`; blob en `storage/uploads/`; MIME real (no solo extensión), tamaño máximo, dedupe por `hash`. |
| **Criterio de aceptación** | Subir el PNG del Sprite Tool (`guard_f0`) → fila `asset` (`tipo: sprite`) + blob servido por `/file`; re-subir el mismo archivo reusa bytes por hash; borrar elimina fila + archivo. |

### C4 — Galería y plantillas: `galeria`, `plantilla`

| | |
|---|---|
| **Qué se crea** | Publicación/despublicación transaccional (estado + fila en `galeria`): `PATCH /api/projects/:id/publish` (+ `unpublish`); galería pública: `GET /api/gallery`, `GET /api/gallery/:slug`; plantillas: `GET /api/templates`, `GET /api/templates/:id`. |
| **Criterio de aceptación** | Publicar → aparece públicamente con slug único (`SLUG_TAKEN` en conflicto); despublícar → desaparece; crear proyecto desde `tpl-demo` carga el demo jugable. |

### C5 — Integración del Studio (frente real)

| | |
|---|---|
| **Qué se crea** | Cliente tipado `apiFetch<T>` (contrato §5b) + sesión; reemplazo de `localStorage` por la API como fuente de verdad: guardar/cargar el proyecto del editor en `proyecto.data`; lista de proyectos del usuario (abrir/crear/borrar); frames del Sprite Tool → `POST /api/assets`. |
| **Criterio de aceptación** | Diseñar un nivel → Guardar → recargar la página → el nivel vuelve de la DB; el Sprite Tool guarda y re-lee frames desde la API (fin de los toasts "Guardado real pendiente"). ⚠️ Este paso **toca flujos ya validados del Studio**: requiere tu validación explícita antes de ejecutarse. |

### Hueco futuro (fuera de estas fases)

Refresco de sesión robusto, roles `admin` vs `creador` aplicados por endpoint, thumbnails/galería con imágenes reales, rate limits globales, tests e2e Studio↔API, despliegue (Docker Compose completo). Nada de esto bloquea las fases A–C.

---

## 9. Referencias cruzadas

| Pieza del plan | Dónde se define |
|---|---|
| Contrato de respuesta API (`{success,data,error}`) y errores | ROADMAP.md §5b |
| Reglas del entorno WSL (node.exe, curl.exe, taskkill por puerto) | AGENTS.md §Entorno |
| Schema v3 del motor (árbol `proyecto.data`) | ROADMAP.md §5, `docs/ENGINE_COMPONENTS.md` §4 |
| Herramientas del Studio que consumirán la API | `TOOLS.md`, `DESIGN.md` |
