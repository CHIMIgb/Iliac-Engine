# DATABASE.md — Esquema de Base de Datos (PostgreSQL + Prisma)

> **Visión a largo plazo.** El backend (API + Postgres) aún no existe (no hay código; el motor del juego es JS vanilla, ver `ROADMAP.md` §13–§15). Este documento describe la **arquitectura prevista** del servidor del Studio; el `server/db/schema.prisma` se creará a partir de aquí cuando se arranque el backend.
>
> Esquema de datos del servidor de RayCast Studio. El ORM es **Prisma** sobre **PostgreSQL**.
> Este documento es la **fuente de verdad del esquema**: de aquí se generará `server/db/schema.prisma` cuando exista backend.
>
> Regla rectora: **toda la información del juego (mapas, texturas, sprites, entidades, rutas de assets, estado) vive en la base de datos. Nada hardcodeado ni almacenado solo localmente.**

---

## 1. Principios de persistencia

| Principio | Descripción |
|-----------|-------------|
| **DB = fuente única de verdad** | Todo dato de usuario, proyecto, asset y publicación se persiste en Postgres vía Prisma. |
| **El juego completo en el proyecto** | El `project.json` v2 (texturas, sprites, mapa, entidades, ajustes, todo) se guarda entero en `proyecto.data` (JSONB). No existe "mapa local sólo en el navegador". |
| **Assets: metadatos en DB, bytes en filesystem** | Cada archivo registrado en tabla `asset` (ruta, mime, tamaño, hash). Los **bytes** van al filesystem de blobs del servidor; la **ruta** se guarda en `asset.ruta`. El `project.json` referencia assets por su `id`/path. |
| **Estado del proyecto** | Vive en `proyecto.estado`: `EN_DESARROLLO` o `PUBLICADO`. Transición controlada por la API. |
| **Propiedad** | Todo proyecto/asset pertenece a un `usuario`. Nunca hay datos huérfanos. |

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
| `schema_version` | `INT` | NOT NULL, default `2` | Versión del `project.json` |
| `render_mode` | `TEXT` | NOT NULL, default `retro` | `retro` \| `3d` |
| `data` | `JSONB` | NOT NULL | **`project.json` v2 COMPLETO**: `meta`, `settings`, `textures`, `sprites`, `map`, `entities`, `...` |
| `thumbnail_path` | `TEXT` | nullable | Portada del juego |
| `published_at` | `TIMESTAMPTZ` | nullable | Fecha de publicación |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, default | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | |

**`data` (JSONB)** guarda íntegramente el `project.json`, que incluye:
- `settings` (resolución, playerStart, piso/techo, minimapa)
- `textures[]` (id, src/ruta, flags)
- `sprites[]` (posición, textura, flags)
- `map` (size, grid / sectores, zonas)
- `entities[]` (tipo, sprite, posición, comportamiento)
- `items[]`, `spells[]`, `npc[]`, `dialogue[]`, `quests[]`, `economy[]`, `progression[]`
- `blueprints[]` (visual scripting)
- `localization` (es/en)
- y cualquier dato futuro del juego

> **Filosofía:** el `project.json` ES el juego. Almacenado como JSONB en Postgres, cualquier herramienta o motor lo lee completo desde la DB. Las consultas de filtrado/búsqueda usan las columnas de metadatos (`nombre`, `estado`, `render_mode`); el contenido vive en `data`.

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

**Regla:** los **bytes** viven en el filesystem de blobs; `asset.ruta` los localiza. El `proyecto.data` referencia el asset por `id` o ruta. Así no se infla la DB con binarios y se puede servir por HTTP estático.

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

  @@map("usuario")
}

model Proyecto {
  id            String          @id @default(uuid()) @db.Uuid
  propietarioId String          @map("propietario_id") @db.Uuid
  propietario   Usuario         @relation(fields: [propietarioId], references: [id], onDelete: Cascade)
  nombre        String
  slug          String?         @unique
  estado        EstadoProyecto  @default(EN_DESARROLLO)
  schemaVersion Int             @default(2) @map("schema_version")
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
