# ASSET_UPLOAD_PLAN.md — Persistencia, aislamiento y organización de assets subidos

Plan de implementación para arreglar los problemas detectados en el flujo
"Importar sprite → guardar en proyecto" y reorganizar el almacenamiento de
archivos subidos.

**Estado: ✅ completado (2026-09-18, pasos 1–6 ejecutados)** — storage ordenado `<userId>/<tipo>/`, dedupe por usuario, migración one-shot ejecutada (57 blobs), auto-guardado de sprites + toast honesto en el Studio, test de aislamiento multi-usuario (77/77 server), docs actualizadas (`API_ENDPOINTS.md`, `DATABASE.md §8`, `ARCHITECTURA.md`). La nota ponytail del dedupe global quedó resuelta en `DATABASE.md §8 C3`.

---

## 1. Ubicación en el ROADMAP

| Dimensión | Valor |
|---|---|
| Fase | **F5** (Sprite Tool) + **C3** (Backend: almacenamiento de assets en blobs) |
| Ruta crítica | C3 ya está `realizada`; esto es **deuda técnica** (sección §16) detectada al auditar el flujo real |
| Nota ponytail | El dedupe global por hash ya quedó marcado en `assets.ts` como "ver nota ponytail en el plan C3 — verificar aislamiento multi-usuario". Este plan la resuelve. |
| Estado actual | F5 Sprite Tool: fases A–D ✅. Los sprites **importados desde fuera** ya van a la API (`POST /api/assets` → `server/storage/uploads/`), pero: (1) el toast de la Sprite Tool miente ("Guardado" sin persistir), (2) el dedupe por hash es global (un asset de otro usuario se reutiliza), (3) la carpeta `uploads/` está **plana y desordenada** (58 archivos con UUID sueltos). La carpeta raíz `assets/` (predeterminados, servida por Vite en `/assets/...`) debe quedar SOLO para sprites predeterminados. |

---

## 2. Resumen del Cambio

### Problemas a resolver

1. **Toast "Guardado" engañoso + falta auto-guardado** (`studio/src/main.ts`):
   al pulsar "Guardar en el proyecto" en la Sprite Tool, el toast anuncia
   "Guardado: N frames + M animaciones", pero **nada persistió en la nube**.
   Solo se subieron los PNGs a la API y se mutó el documento en memoria. Si el
   usuario cierra el navegador sin `Ctrl+S`, pierde todas las animaciones.
2. **Dedupe global por hash rompe aislamiento multi-usuario**
   (`server/src/routes/assets.ts` línea 153): `findFirst({ where: { hash } })`
   sin filtrar por `propietarioId`. Si A y B suben el mismo archivo, B recibe
   el asset de A: no puede borrarlo, no puede listarlo, y la URL de B muere si
   A borra su asset.
3. **Carpeta de uploads desordenada** (`server/src/lib/storage.ts` +
   `server/storage/uploads/`): blobs con nombre `<uuid>.<ext>` sueltos en una
   sola carpeta. El requisito del usuario: `/assets/` (raíz) queda para
   **sprites predeterminados**; todo lo **importado desde fuera** se guarda en
   otra carpeta **separada y ordenada**.

### Decisiones de diseño

- **Nueva estructura de storage (orden por usuario + tipo):**
  ```
  server/storage/uploads/
    <userId>/
      sprite/<assetId>.<ext>
      audio/<assetId>.<ext>
      texture/<assetId>.<ext>
      font/<assetId>.<ext>
      modelo/<assetId>.<ext>
  ```
  Refuerza el aislamiento (cada usuario tiene su árbol) y es autodocumentada
  (sabes qué es cada archivo sin abrirlo). Alternativa considerada:
  solo `<tipo>/` sin usuario — descartada porque no refuerza el aislamiento
  del problema 2 y no separaría cuentas que suban el mismo archivo.

- **El dedupe por hash pasa a ser POR USUARIO**: `findFirst({ where: { hash,
  propietarioId: userId } })`. El mismo usuario re-subiendo su archivo sigue
  reutilizándolo (cero bytes duplicados); usuarios distintos obtienen filas y
  blobs independientes (duplica bytes en disco, aceptable: prioridad es
  aislamiento).

- **`onSaveRequested` persiste el proyecto automáticamente**: tras
  `setWorldTextures` + `setSpriteAnims` se llama a `await saveCurrent()` y el
  toast pasa a informar de la realidad. Si `saveCurrent()` falla, el toast es
  claro ("Los frames se subieron pero el proyecto NO se guardó").

- **Migración one-shot**: script que mueve los ~58 blobs existentes desde
  `uploads/<id>.<ext>` a la nueva estructura según `asset.propietarioId` y
  `asset.tipo`, y actualiza la columna `asset.ruta`.

---

## 3. Archivos Afectados (por capa)

```
=== MOTOR (engine/) — sin cambios ===
(Ninguno: el motor solo lee URLs `/api/assets/<id>/file`, que no cambian)

=== STUDIO (studio/) ===

[MODIFICAR] studio/src/main.ts
  - Líneas ~274–296 (`onSaveRequested`): tras `doc.setWorldTextures(urls)` y
    `doc.setSpriteAnims(out.spriteAnims)`, añadir `await saveCurrent()` para
    persistir el proyecto con las animaciones.
  - Ajustar el toast: éxito real → "Frames subidos y proyecto guardado";
    fallo de saveCurrent → aviso explícito de que las animaciones NO
    persistieron y cómo recuperarlas (no cerrar el navegador).

=== BACKEND (server/) ===

[MODIFICAR] server/src/lib/storage.ts
  - `blobPath` pasa a recibir `userId` y `tipo`: estructura
    `uploads/<userId>/<tipo>/<id>.<ext>`.
  - Firmas: `writeBlob(userId, tipo, id, mime, data)`,
    `readBlob(userId, tipo, id, mime)`, `removeBlob(userId, tipo, id, mime)`.

[MODIFICAR] server/src/routes/assets.ts
  - Línea 153: dedupe por `{ hash, propietarioId: userId }`.
  - Actualizar las 3 llamadas a storage (writeBlob en POST con los datos de la
    fila; readBlob en GET /:id/file usando `asset.propietarioId` y
    `asset.tipo` de la fila — es público y no conoce el userId del request;
    removeBlob en DELETE con la fila).

[CREAR] server/scripts/migrate-uploads.ts
  - Migración one-shot: recorre `prisma.asset.findMany()`, mueve cada blob de
    `uploads/<id>.<ext>` a `uploads/<propietarioId>/<tipo>/<id>.<ext>` con
    fs.rename (mismo filesystem) y actualiza `asset.ruta`.
  - Idempotente: si el destino ya existe, no duplica ni peta.
  - Registro en package.json: `npm run migrate:uploads`.

=== TESTS ===

[MODIFICAR] server/tests/assets.test.ts
  - Test nuevo: dos usuarios suben el MISMO contenido → cada uno recibe su
    propio asset (`reused: false`, ids distintos), puede borrarlo, y borrar el
    del usuario A no rompe el de B (el blob de B sigue sirviéndose).
  - Test existente de dedupe (mismo usuario) debe seguir pasando igual.

=== DATOS / DOCUMENTACIÓN ===

[MODIFICAR] docs/API_ENDPOINTS.md
  - Nota en `POST /api/assets`: dedupe es por usuario, no global.

[MODIFICAR] DATABASE.md §8 (C3)
  - Nueva estructura de carpetas de storage + dedupe por usuario.
```

---

## 4. Cambios al Schema / project.json

- **`project.json`: SIN cambios.** Las texturas del proyecto siguen
  guardando la URL `/api/assets/<id>/file`, que no depende de la estructura
  del filesystem.
- **Base de datos: SIN cambios de esquema Prisma.** Solo cambia el VALOR de
  la columna `asset.ruta` (relativo a `STORAGE_PATH`), igual que ya se hacía
  (`uploads/<id>.<ext>` → `uploads/<userId>/<tipo>/<id>.<ext>`).

---

## 5. Dependencias

- **Ninguna nueva dependencia npm.** `node:fs/promises` + Prisma ya están en
  el proyecto.
- No se reutilizan librerías nuevas (Context7 no es necesario: solo
  `fs.rename` y Prisma).

---

## 6. Orden de Ejecución

1. **`server/src/lib/storage.ts`** — cambiar firma y `blobPath` (el resto
   depende de esto).
2. **`server/src/routes/assets.ts`** — dedupe por usuario + llamadas a
   storage actualizadas.
3. **`server/scripts/migrate-uploads.ts`** — crearlo y ejecutarlo una vez
   contra la DB real (mueve los 58 blobs y actualiza `ruta`).
4. **`studio/src/main.ts`** — auto-guardado en `onSaveRequested` + toast
   honesto.
5. **Tests** — nuevo test de aislamiento multi-usuario en `assets.test.ts`.
6. **Docs** — `docs/API_ENDPOINTS.md` + `DATABASE.md §8`.

Orden lógico: backend primero (storage → rutas → migración), luego Studio
(usa la API que ya quedó consistente), luego tests y docs.

---

## 7. Impacto y Verificación

### Impacto
- **F5 (Sprite Tool):** el guardado de animaciones deja de perder trabajo y
  el mensaje al usuario es honesto.
- **C3 (assets backend):** aislamiento real entre cuentas; storage ordenado.
- **Nada validado se rompe:** el test existente de dedupe del mismo usuario
  sigue pasando; las URLs públicas `/api/assets/:id/file` no cambian.

### Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Migración mueve blobs y algo falla a mitad | Script idempotente y transaccional por fila; si un rename falla, se registra y continúa; se reporta al final. Backups de la carpeta antes de migrar. |
| Blob huérfano (fila sin archivo) que ya existía | El script lo salta con warning; `GET /:id/file` ya devuelve 404 en ese caso. |
| El auto-guardado de Studio falla (red/sesión) | Toast explícito: "frames subidos, proyecto NO guardado — pulsa Ctrl+S"; no se pierden datos silenciosamente. |

### Verificación
1. `npm test` en `server/tests/` (el test de aislamiento + los existentes).
2. `npm run migrate:uploads` contra la DB real → `ls server/storage/uploads/`
   muestra `<userId>/sprite/...`, `<userId>/audio/...`, y `asset.ruta` en la
   BD apunta a la nueva estructura.
3. **Manual (Studio):** importar un sprite → Guardar en la Sprite Tool → el
   toast dice "guardado" y, sin pulsar Ctrl+S, recargar la página → el
   proyecto trae las animaciones de la nube.
4. Playtest con un sprite subido: la imagen carga (URL pública sigue
   funcionando).

### Marcar en ROADMAP §12
- La nota de deuda técnica asociada (dedupe global) se marca como resuelta
  en el apartado de deuda (§16) — no es una fase nueva.

---

## 8. Checklist de Calidad

- [ ] Tests nuevos escritos y pasando (aislamiento multi-usuario en assets).
- [ ] El test EXISTENTE de dedupe del mismo usuario sigue pasando.
- [ ] Demo/Studio sigue jugable: importar sprite + guardar + recargar
      recupera las animaciones (verificación manual).
- [ ] No se tocó código validado sin permiso (este plan ES la petición de
      permiso).
- [ ] Separación de capas respetada: motor no cambia; Studio.js usa
      `saveCurrent()` que ya existía; backend aísla por usuario.
- [ ] Sin valores hardcodeados (userId/tipo salen de la fila de Prisma).
- [ ] Comentarios en español.
- [ ] Docs actualizadas: `docs/API_ENDPOINTS.md`, `DATABASE.md §8`.
- [ ] La carpeta raíz `assets/` queda solo con predeterminados; los
      imports externos viven en `server/storage/uploads/<userId>/<tipo>/`.