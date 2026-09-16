-- =============================================================================
-- schema.sql — Esquema Postgres de RayCast Studio (Iliac Engine)
-- -----------------------------------------------------------------------------
-- Fuente de verdad: DATABASE.md §3–§5 (tablas, enums, índices).
-- Este archivo es la FASE A1 del plan §8: el SQL se escribe primero a mano
-- y la migración Prisma (A3) lo versiona después. Antes de la FASE A2 (ejecutar
-- el SQL sobre Postgres) nada de esto está "vivo".
--
-- Requisitos: PostgreSQL 13+ (usa gen_random_uuid(), nativo desde PG13).
-- Idempotente: se puede re-ejecutar sin error (dropea y recrea todo).
-- Los IDs de seeds son UUIDs literales fijos para que las referencias de
-- código/plantillas sean estables (no se generan al azar).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) Limpieza (idempotencia): se dropea en orden seguro y luego los tipos.
--    CASCADE por si hay objetos dependientes; no debería haber datos reales.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS refresh_token, token_invalido, plantilla, galeria, asset, proyecto, usuario, persona, rol CASCADE;
DROP TYPE IF EXISTS estado_proyecto CASCADE;
DROP TYPE IF EXISTS tipo_asset CASCADE;

-- -----------------------------------------------------------------------------
-- 1) Tipos ENUM (DATABASE.md §4)
-- -----------------------------------------------------------------------------
CREATE TYPE estado_proyecto AS ENUM (
  'EN_DESARROLLO',
  'PUBLICADO'
);

CREATE TYPE tipo_asset AS ENUM (
  'texture',
  'sprite',
  'audio',
  'font',
  'modelo'
);

-- -----------------------------------------------------------------------------
-- 2) rol — tipos de usuario (DATABASE.md §3.3)
-- -----------------------------------------------------------------------------
CREATE TABLE rol (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(64)  NOT NULL UNIQUE,          -- 'admin' | 'creador'
  descripcion TEXT
);

COMMENT ON TABLE  rol                 IS 'Tipos de usuario: admin (acceso total) y creador (sus propios proyectos)';
COMMENT ON COLUMN rol.nombre          IS 'Identificador único del rol';

-- -----------------------------------------------------------------------------
-- 3) persona — datos reales del individuo (DATABASE.md §3.1)
-- -----------------------------------------------------------------------------
CREATE TABLE persona (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        VARCHAR(255) NOT NULL,               -- Nombre de pila
  apellido      VARCHAR(255) NOT NULL,               -- Apellido(s)
  email_publico VARCHAR(254) UNIQUE,                 -- Email visible (portfolio/CV)
  bio           TEXT,                                -- Breve biografía
  avatar_path   TEXT,                                -- Ruta al avatar en blobs
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  persona              IS 'Datos personales (públicos); separados de las credenciales (usuario)';
COMMENT ON COLUMN persona.email_publico IS 'Email visible en el perfil; único, nullable';

-- -----------------------------------------------------------------------------
-- 4) usuario — credenciales y acceso (DATABASE.md §3.2) — 1:1 persona, N:1 rol
-- -----------------------------------------------------------------------------
CREATE TABLE usuario (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    UUID UNIQUE REFERENCES persona (id) ON DELETE CASCADE, -- 1:1, nullable
  rol_id        UUID NOT NULL REFERENCES rol (id),
  login         VARCHAR(64)  NOT NULL,               -- Identificador de login (email o usuario)
  password_hash VARCHAR(255) NOT NULL,               -- Hash bcrypt (60 chars hoy)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  usuario              IS 'Credenciales de acceso; una persona = un único login (UNIQUE en persona_id)';
COMMENT ON COLUMN usuario.persona_id   IS 'FK 1:1 a persona; nullable (un usuario puede no tener persona vinculada)';
COMMENT ON COLUMN usuario.login        IS 'Identificador único de login (email o nombre de usuario)';
COMMENT ON COLUMN usuario.password_hash IS 'Hash bcrypt del password; nunca se guarda el texto plano';

-- Índice único de login (DATABASE.md §5: users_login_idx → login O(1))
CREATE UNIQUE INDEX users_login_idx ON usuario (login);

-- -----------------------------------------------------------------------------
-- 5) proyecto — el juego completo (DATABASE.md §3.4) — relacionado a usuario
-- -----------------------------------------------------------------------------
CREATE TABLE proyecto (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE CASCADE, -- Dueño
  nombre         VARCHAR(255) NOT NULL,              -- Título del juego
  slug           VARCHAR(100) UNIQUE,                -- URL amigable (galería)
  estado         estado_proyecto NOT NULL DEFAULT 'EN_DESARROLLO',
  schema_version INTEGER      NOT NULL DEFAULT 3,    -- project.json v3 (sectores poligonales)
  render_mode    VARCHAR(16)  NOT NULL DEFAULT 'retro', -- 'retro' | '3d'
  data           JSONB        NOT NULL,              -- project.json v3 COMPLETO (el juego)
  thumbnail_path TEXT,                               -- Portada del juego
  published_at   TIMESTAMPTZ,                        -- Fecha de publicación
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  proyecto               IS 'El proyecto ES project.json (data JSONB); las columnas de metadatos solo listan/filtran';
COMMENT ON COLUMN proyecto.data          IS 'Árbol completo del project.json v3: meta, camera, render, world, audio, music, blueprints...';
COMMENT ON COLUMN proyecto.schema_version IS 'Versión del project.json (3 = sectores poligonales)';

-- Índices (DATABASE.md §5)
CREATE INDEX projects_owner_idx ON proyecto (propietario_id);   -- listar proyectos de un usuario
CREATE INDEX projects_state_idx ON proyecto (estado);           -- filtrar publicados/en desarrollo

-- -----------------------------------------------------------------------------
-- 6) asset — cada archivo del juego (DATABASE.md §3.5)
--    Metadatos en DB, bytes en blobs del servidor (asset.ruta los localiza).
-- -----------------------------------------------------------------------------
CREATE TABLE asset (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propietario_id UUID NOT NULL REFERENCES usuario (id) ON DELETE CASCADE, -- Quién lo subió
  proyecto_id    UUID REFERENCES proyecto (id) ON DELETE SET NULL,        -- Proyecto al que pertenece (o global/null)
  nombre         VARCHAR(255) NOT NULL,               -- Nombre del archivo (ej. clave de textura 'guard_f0')
  tipo           tipo_asset   NOT NULL,               -- texture | sprite | audio | font | modelo
  mime           VARCHAR(128) NOT NULL,               -- image/png, audio/ogg, ...
  tamano_bytes   INTEGER      NOT NULL CHECK (tamano_bytes >= 0),
  ruta           VARCHAR(512) NOT NULL UNIQUE,        -- Path real en blobs del servidor
  hash           VARCHAR(64),                         -- Hash de contenido (deduplicación)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  asset              IS 'Metadatos de cada archivo del juego; los BYTES viven en el filesystem de blobs (asset.ruta)';
COMMENT ON COLUMN asset.proyecto_id  IS 'Nullable: un asset con proyecto_id nulo = biblioteca personal del usuario, compartible entre juegos';
COMMENT ON COLUMN asset.tipo         IS 'Tipo del asset; los frames del Sprite Tool se registran como sprite, el audio como audio';
COMMENT ON COLUMN asset.ruta         IS 'Ruta única del blob en el servidor; el project.data la referencia';

-- Índice (DATABASE.md §5: assets de un proyecto)
CREATE INDEX assets_project_idx ON asset (proyecto_id);

-- -----------------------------------------------------------------------------
-- 7) galeria — publicación pública (DATABASE.md §3.6) — 1:1 con proyecto
-- -----------------------------------------------------------------------------
CREATE TABLE galeria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id  UUID NOT NULL UNIQUE REFERENCES proyecto (id) ON DELETE CASCADE, -- El proyecto publicado
  slug         VARCHAR(100) NOT NULL,                -- URL jugable /play/:slug
  titulo       VARCHAR(255) NOT NULL,                -- Título en la galería
  descripcion  TEXT         NOT NULL DEFAULT '',     -- Descripción pública
  visitas      INTEGER      NOT NULL DEFAULT 0 CHECK (visitas >= 0),
  published_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  galeria             IS 'Publicación pública: solo un proyecto con estado PUBLICADO debería tener fila aquí';
COMMENT ON COLUMN galeria.proyecto_id IS 'UNIQUE → un proyecto, una entrada en galería';

-- Índice único de slug (DATABASE.md §5: resolver /play/:slug)
CREATE UNIQUE INDEX gallery_slug_idx ON galeria (slug);

-- -----------------------------------------------------------------------------
-- 8) plantilla — seed de proyectos nuevos (DATABASE.md §3.7) — standalone
-- -----------------------------------------------------------------------------
CREATE TABLE plantilla (
  id          VARCHAR(64) PRIMARY KEY,                -- Slug legible: 'tpl-demo'
  nombre      VARCHAR(255) NOT NULL,
  descripcion TEXT         NOT NULL DEFAULT '',
  data        JSONB        NOT NULL,                  -- project.json de la plantilla
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  plantilla         IS 'Plantillas de proyectos nuevos (seeds); id es un slug legible, no un UUID';
COMMENT ON COLUMN plantilla.data    IS 'project.json v3 de la plantilla (incluye el demo)';

-- -----------------------------------------------------------------------------
-- 9) refresh_token — sesión de larga duración (DATABASE.md §3.8)
--    Rotable (login/refresh) y revocable (logout). Se guarda el SHA-256 del
--    token opaco, NUNCA el token en claro (si se filtra la DB, no hay sesiones
--    válidas expuestas).
-- -----------------------------------------------------------------------------
CREATE TABLE refresh_token (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   UUID NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  token_hash   VARCHAR(64) NOT NULL UNIQUE,    -- SHA-256 del token opaco (48 bytes aleatorios)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en    TIMESTAMPTZ NOT NULL,           -- now() + 7 días
  revocado_en  TIMESTAMPTZ                     -- NOT NULL = invalidado (logout o rotación)
);

COMMENT ON TABLE  refresh_token          IS 'Refresh tokens opacos (7 días); validación: existe + no revocado + no expirado; rotación = revocar el viejo y crear uno nuevo';
COMMENT ON COLUMN refresh_token.token_hash IS 'SHA-256 del token; almacenar el hash permite invalidar sin exponer el valor';
COMMENT ON COLUMN refresh_token.revocado_en IS 'Marca de invalidación: logout o cuando se rota creando uno nuevo';

-- Índice por usuario (listar/limpiar sesiones de un usuario)
CREATE INDEX refresh_token_usuario_idx ON refresh_token (usuario_id);

-- -----------------------------------------------------------------------------
-- 10) token_invalido — denylist de access JWT revocados antes de expirar
--     (DATABASE.md §3.8). Caso típico: logout o cambio de password; el access
--     token sigue vivo 15 min por firma y hay que invalidarlo a mano.
-- -----------------------------------------------------------------------------
CREATE TABLE token_invalido (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jti         VARCHAR(64) NOT NULL UNIQUE,     -- claim jti del JWT revocado
  usuario_id  UUID NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  expira_en   TIMESTAMPTZ NOT NULL,            -- expiración original del JWT (para purgar)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  token_invalido         IS 'Denylist de access tokens JWT revocados antes de expirar; se purga perezosamente al insertar/consultar (DELETE WHERE expira_en < now())';
COMMENT ON COLUMN token_invalido.jti     IS 'Identificador único del JWT (claim jti); al validar un access token se rechaza si su jti está aquí';

-- Índice para la purga de filas vencidas
CREATE INDEX token_invalido_expira_idx ON token_invalido (expira_en);

-- -----------------------------------------------------------------------------
-- 11) Seeds de infraestructura (solo roles y plantilla; los datos de juego
--    NO se siembran en SQL: vienen de demo/ y se cargan por la API en C2/C5).
--    ON CONFLICT DO NOTHING → idempotente también al ejecutar varias veces.
-- -----------------------------------------------------------------------------
INSERT INTO rol (id, nombre, descripcion) VALUES
  ('00000000-0000-4000-8000-000000000001', 'admin',   'Acceso total: usuarios, proyectos, galería, plantillas'),
  ('00000000-0000-4000-8000-000000000002', 'creador', 'Crea y gestiona sus propios proyectos y assets')
ON CONFLICT (nombre) DO NOTHING;

-- Plantilla base: cáscara mínima válida de project.json v3.
-- El contenido real (mundo demo) se reemplazará al cargar demo/project.js en C2.
INSERT INTO plantilla (id, nombre, descripcion, data) VALUES (
  'tpl-demo',
  'Demo base',
  'Proyecto inicial con el demo de referencia (schema v3)',
  '{"meta":{"name":"Mi juego","schemaVersion":3,"renderMode":"3d"},"camera":{"posX":5,"posY":5,"posZ":0.6,"yaw":0.78,"pitch":0},"render":{"fov":70,"backgroundColor":0,"fog":{"color":0,"density":0.01}},"world":{"vertices":[],"sectors":[],"walls":[],"ramps":[],"sprites":[],"textures":{},"sky":{"style":"classic"},"spriteAnims":{}},"audio":[],"music":null}'
)
ON CONFLICT (id) DO NOTHING;