-- C5d — plantilla.propietario_id (DATABASE.md §3.7).
-- NULL = plantilla del sistema (visible para todos); con dueño = plantilla
-- personal (solo su dueño la ve y la usa).
ALTER TABLE "plantilla" ADD COLUMN "propietario_id" UUID;
ALTER TABLE "plantilla" ADD CONSTRAINT "plantilla_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
CREATE INDEX "plantillas_owner_idx" ON "plantilla"("propietario_id");
