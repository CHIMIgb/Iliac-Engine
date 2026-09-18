-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "estado_proyecto" AS ENUM ('EN_DESARROLLO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "tipo_asset" AS ENUM ('texture', 'sprite', 'audio', 'font', 'modelo');

-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(64) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(255) NOT NULL,
    "apellido" VARCHAR(255) NOT NULL,
    "email_publico" VARCHAR(254),
    "bio" TEXT,
    "avatar_path" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "persona_id" UUID,
    "rol_id" UUID NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "propietario_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100),
    "estado" "estado_proyecto" NOT NULL DEFAULT 'EN_DESARROLLO',
    "schema_version" INTEGER NOT NULL DEFAULT 3,
    "render_mode" VARCHAR(16) NOT NULL DEFAULT 'retro',
    "data" JSONB NOT NULL,
    "thumbnail_path" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "propietario_id" UUID NOT NULL,
    "proyecto_id" UUID,
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" "tipo_asset" NOT NULL,
    "mime" VARCHAR(128) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "ruta" VARCHAR(512) NOT NULL,
    "hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "galeria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proyecto_id" UUID NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "visitas" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "galeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla" (
    "id" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plantilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocado_en" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_invalido" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jti" VARCHAR(64) NOT NULL,
    "usuario_id" UUID NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_invalido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "persona_email_publico_key" ON "persona"("email_publico");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_key" ON "usuario"("persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_idx" ON "usuario"("login");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_slug_key" ON "proyecto"("slug");

-- CreateIndex
CREATE INDEX "projects_owner_idx" ON "proyecto"("propietario_id");

-- CreateIndex
CREATE INDEX "projects_state_idx" ON "proyecto"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "asset_ruta_key" ON "asset"("ruta");

-- CreateIndex
CREATE INDEX "assets_project_idx" ON "asset"("proyecto_id");

-- CreateIndex
CREATE UNIQUE INDEX "galeria_proyecto_id_key" ON "galeria"("proyecto_id");

-- CreateIndex
CREATE UNIQUE INDEX "gallery_slug_idx" ON "galeria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_usuario_idx" ON "refresh_token"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "token_invalido_jti_key" ON "token_invalido"("jti");

-- CreateIndex
CREATE INDEX "token_invalido_expira_idx" ON "token_invalido"("expira_en");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "asset" ADD CONSTRAINT "asset_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "galeria" ADD CONSTRAINT "galeria_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "token_invalido" ADD CONSTRAINT "token_invalido_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

