# API del Backend — Endpoints Documentados

> API REST de Iliac Engine / RayCast Studio (`server/`, Node + Hono + Prisma 7 + PostgreSQL).
> Base URL: `http://localhost:3000` (configurable via `PORT`). Todo endpoint protegido exige el header `Authorization: Bearer <accessToken>`.

---

## 1. Contrato de respuesta estándar

**ESTÁNDAR PINNED (2026-09-16)** — Toda respuesta (éxito o error) usa el mismo envoltorio, sin excepción. **El shape se define UNA sola vez en `contract/api-response.d.ts`** (única fuente de verdad): `server/src/lib/handler.ts` lo importa con `import type` y el cliente tipado del Studio (`apiFetch<T>`, fase C5) hará lo mismo — sin contratos duplicados entre capas (ROADMAP §5b).

```jsonc
// Éxito
{ "success": true, "data": { ... }, "error": null }

// Error  (error.details SIEMPRE presente: null si no hay detalle)
{
  "success": false,
  "data": null,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "El proyecto no existe",
    "details": { "id": "abc123" }  // o null cuando el código no aporta detalle
  }
}
```

**Shape canónico** (el front NO hace undefined-checks sobre `error.details`):

| Campo | Éxito | Error |
|---|---|---|
| `success` | `true` | `false` |
| `data` | objeto | `null` |
| `error` | `null` | `{ code, message, details }` (claves siempre presentes) |

**Reglas:**
- Los errores de validación Zod devuelven `422 VALIDATION_ERROR` con `details.issues: [{ path, message }]`.
- Las rutas que verifican propiedad (proyectos, assets) devuelven **404** si el recurso no existe o es ajeno (nunca 403: no se enumeran recursos).
- Nunca se exponen stack traces al cliente.

## 2. Códigos de error (`server/src/lib/codes.ts`)

| Código | HTTP | Mensaje | Cuándo |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | mensaje del validador | Input Zod inválido o contenido que no coincide con el tipo |
| `UNAUTHORIZED` | 401 | no autenticado | Falta o es inválido el token |
| `FORBIDDEN` | 403 | sin permisos | Rol sin acceso (reservado) |
| `NOT_FOUND` | 404 | recurso no encontrado | Ruta inexistente |
| `PROJECT_NOT_FOUND` | 404 | El proyecto no existe | GET/PATCH/DELETE de proyecto ajeno o inexistente |
| `ASSET_NOT_FOUND` | 404 | El asset no existe | GET/DELETE de asset ajeno o inexistente; blob huérfano |
| `TEMPLATE_NOT_FOUND` | 404 | La plantilla no existe | `GET /api/templates/:id` o `POST /api/projects` con `plantillaId` inexistente **o personal ajena** (C4/C5d) |
| `EMAIL_IN_USE` | 409 | email ya registrado | `emailPublico` duplicado (reservado) |
| `LOGIN_IN_USE` | 409 | login ya registrado | Register con login existente |
| `INVALID_CREDENTIALS` | 401 | credenciales inválidas | Login con login/password incorrectos |
| `SLUG_TAKEN` | 409 | slug en uso | Publicación con slug duplicado (C4) |
| `ASSET_TOO_LARGE` | 413 | archivo supera el tope (20 MB) | Subida de asset mayor al máximo |
| `TOO_MANY_REQUESTS` | 429 | demasiados intentos | Rate limit (login: 5/min por IP) |
| `STORAGE_WRITE_ERROR` | 500 | no se pudo escribir el archivo | Fallo de filesystem al escribir blob |
| `DB_UNAVAILABLE` | 503 | base de datos no disponible | Falla la sonda de `/ready` |
| `INTERNAL_ERROR` | 500 | error interno | Error no clasificado |

**Ratas/Rips:** `createLimiter` aplica 100 req/min general por IP (en memoria; a Redis cuando haya multi-instancia).

---

## 3. Infraestructura (sin auth)

### `GET /` — Bienvenida

**200**
```json
{ "success": true, "data": { "message": "Iliac Engine API" }, "error": null }
```

### `GET /health` — Liveness

El proceso responde (no toca la DB). **200**
```json
{ "success": true, "data": { "status": "ok" }, "error": null }
```

### `GET /ready` — Readiness

Sondea la DB (`SELECT 1`). **200** si DB responde:
```json
{ "success": true, "data": { "status": "ok", "db": "up" }, "error": null }
```
**503** si la DB no responde: `error.code = "DB_UNAVAILABLE"`.

---

## 4. Auth (`/auth`)

### `POST /auth/register` — Crear usuario

Rate limit: 5/min por IP. Body (JSON):

| Campo | Tipo | Reglas |
|---|---|---|
| `login` | string | 3–64 chars, `^[a-zA-Z0-9._-]+$` |
| `password` | string | 8–100 chars |
| `nombre` | string | 1–255 |
| `apellido` | string | 1–255 |
| `emailPublico` | string·opcional | email válido, máx 254 |

Crea `Persona` + `Usuario` (rol `creador`) en transacción, hashea password con bcrypt (12 rounds) y guarda el refresh hasheado.

**201**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "login": "alice", "nombre": "Alicia", "apellido": "G.", "emailPublico": null, "rol": "creador" },
    "accessToken": "eyJ...",     // válido 15 min
    "refreshToken": "eyJ..."     // válido 7 días
  },
  "error": null
}
```

**Errores:** `409 LOGIN_IN_USE` (`{ login }`) · `422 VALIDATION_ERROR` · `500 INTERNAL_ERROR` (falta rol seed).

### `POST /auth/login` — Iniciar sesión

Rate limit: 5/min por IP. Body: `{ login, password }`.

**200**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "login": "alice", "nombre": "Alicia", "apellido": "G.", "emailPublico": null, "rol": "creador" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "error": null
}
```

**Errores:** `401 INVALID_CREDENTIALS` (login o password incorrectos; el mismo error para ambos casos — no se enumeran usuarios) · `429 TOO_MANY_REQUESTS`.

---

## 5. Proyectos (`/api/projects`) — requiere JWT

Todas las rutas exigen `Authorization: Bearer <accessToken>`. El `data` es el `project.json` completo (schema v3) y se valida con el MISMO validador del contrato.

### `GET /api/projects` — Listar mis proyectos

Lista del usuario autenticado, ordenada por `updatedAt` desc. **Sin `data`** (solo metadata, evita transferir JSONB grandes).

**200**
```json
{
  "success": true,
  "data": {
    "projects": [
      { "id": "uuid", "nombre": "Mi juego", "estado": "EN_DESARROLLO", "schemaVersion": 3, "renderMode": "retro", "createdAt": "...", "updatedAt": "..." }
    ]
  },
  "error": null
}
```

### `POST /api/projects` — Crear proyecto

Body:

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string · opcional | (1–255). **Opcional si se crea desde plantilla** (hereda `plantilla.nombre`) |
| `data` | object · opcional | `project.json` v3; si se omite (y no hay `plantillaId`) → esqueleto mínimo `{ world: { vertices: [], sectors: [], walls: [] } }` |
| `plantillaId` | string · opcional | **C4:** crea el proyecto con `data` = `plantilla.data` (p. ej. `tpl-demo`). **C5d:** solo plantillas del sistema o propias |

**201** — devuelve el proyecto **completo** (con `data`), `renderMode: "retro"`, `schemaVersion: 3`.

**Errores:** `422 VALIDATION_ERROR` (con `details.issues` del validador del contrato si `data` inválido) · `404 TEMPLATE_NOT_FOUND` (plantilla inexistente) · `401 UNAUTHORIZED`.

### `GET /api/projects/:id` — Obtener proyecto completo

Devuelve el `data` **completo** (el árbol igual al que se guardó; deepEqual en tests).

**200** → `{ project: { id, nombre, estado, schemaVersion, renderMode, createdAt, updatedAt, data } }`

**Errores:** `404 PROJECT_NOT_FOUND` (inexistente o ajeno) · `401`.

### `PATCH /api/projects/:id` — Actualizar proyecto

Body (parcial):

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string · opcional | renombra |
| `data` | object · opcional | **REEMPLAZA** el árbol completo (no hay merge profundo; el editor guarda el documento entero) |

**200** → `{ project: {...completo} }`. `updatedAt` se actualiza.

**Errores:** `404` · `422` (data inválida incluso en PATCH) · `401`.

### `DELETE /api/projects/:id` — Eliminar proyecto

**200**
```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Errores:** `404 PROJECT_NOT_FOUND` · `401`.

### `PATCH /api/projects/:id/publish` — Publicar en galería (C4)

Transacción: `estado → PUBLICADO` + `publishedAt` + fila en `galeria` (upsert: re-publicar actualiza la entrada). El `data` se **revalida** contra el contrato antes de publicar (no se publican juegos rotos). `. thumbnailPath` va al proyecto (`proyecto.thumbnail_path`).

Body:

| Campo | Tipo | Notas |
|---|---|---|
| `slug` | string · opcional | `^[a-z0-9][a-z0-9-]*$` (minúsculas, números, guiones), ≤ 100. Si se omite → autogenerado desde `nombre` con sufijo `-2/-3` si está ocupado |
| `titulo` | string · opcional | default `nombre` |
| `descripcion` | string · opcional | default `""` |
| `thumbnailPath` | string · opcional | ruta del thumbnail del proyecto |

**200:**
```json
{ "success": true, "data": { "published": { "proyectoId": "uuid", "slug": "mi-juego", "titulo": "Mi juego", "visitas": 0 } }, "error": null }
```

**Errores:** `409 SLUG_TAKEN` (slug explícito ya usado por otra publicación) · `404 PROJECT_NOT_FOUND` (inexistente/ajeno) · `422 VALIDATION_ERROR` (data inválida o body malo) · `401`.

### `PATCH /api/projects/:id/unpublish` — Despublicar (C4)

Reverte la transacción: `estado → EN_DESARROLLO` + borra la fila de `galeria`. **Idempotente**: despublicar un proyecto ya despublicado devuelve éxito igual (el estado final es el que importa).

**200:** `{ "unpublished": true }`

**Errores:** `404 PROJECT_NOT_FOUND` · `401`.

---

## 6. Assets (`/api/assets`)

Blobs en `storage/uploads/<assetId>.<ext>`. El **MIME se detecta por magic bytes** (`file-type`); el campo `tipo` debe coincidir con el contenido detectado.

> **C5c (2026-09-17):** solo la **metadata** (GET `/:id`), el **listado** (GET `/`) y el **borrado** (DELETE) exigen JWT. `GET /:id/file` es **PÚBLICO (D1)** — el motor del juego carga texturas/audio sin sesión; la galería pública servirá assets a anónimos.

### `POST /api/assets` — Subir asset (multipart)

Body `multipart/form-data`:

| Campo | Tipo | Notas |
|---|---|---|
| `file` | binary | requerido, > 0 bytes, ≤ **20 MB** |
| `tipo` | string | uno de: `texture` · `sprite` · `audio` · `font` · `modelo` |
| `proyectoId` | string · opcional | uuid; debe ser un proyecto del mismo usuario |

**Correspondencia tipo → MIME aceptado:** `texture` → `image/png` \| `image/webp` · `sprite` → `image/png` · `audio` → `application/ogg` \| `audio/ogg` \| `audio/wav` \| `audio/mpeg` \| `audio/flac` \| `audio/mp4` \| `audio/x-m4a` \| `audio/aac` \| `video/webm` (C5c: mp3/flac/m4a/aac/webm añadidos — los formatos que ya admitía el middleware viejo del Studio) · `font` → `font/ttf` · `modelo` → `model/gltf-binary`.

**Dedupe:** si el hash sha256 ya existe, NO se escribe nada y se devuelve el asset existente.

**201** (nuevo) o **200** (reutilizado):
```json
{
  "success": true,
  "data": {
    "asset": { "id": "uuid", "nombre": "guard_f0.png", "tipo": "sprite", "mime": "image/png", "tamanoBytes": 70, "hash": "sha256-hex", "createdAt": "..." },
    "reused": false
  },
  "error": null
}
```

**Errores:** `401` · `422 VALIDATION_ERROR` (falta `file`, `tipo` inválido, contenido no coincide con el tipo, `proyectoId` ajeno) · `413 ASSET_TOO_LARGE`.

### `GET /api/assets` — Lista los assets de la cuenta (C5c, D6)

Requiere JWT. Solo los del usuario autenticado (nunca ajenos), sin paginación (metadatos únicamente).

Query opcional: `?tipo=audio` (uno del enum `texture|sprite|audio|font|modelo`; otro valor → `422 VALIDATION_ERROR`).

**200:**
```json
{
  "success": true,
  "data": {
    "assets": [
      { "id": "uuid", "nombre": "guard_f0.png", "tipo": "sprite", "mime": "image/png", "tamanoBytes": 70, "hash": "sha256-hex", "createdAt": "..." }
    ]
  },
  "error": null
}
```

**Errores:** `401` · `422 VALIDATION_ERROR` (`?tipo` inválido).

### `GET /api/assets/:id` — Metadata

**200** → `{ asset: { id, nombre, tipo, mime, tamanoBytes, hash, createdAt } }` (sin bytes).

**Errores:** `404 ASSET_NOT_FOUND` · `401`.

### `GET /api/assets/:id/file` — Descargar el blob (PÚBLICO, C5c D1)

**No requiere JWT**: el motor del juego carga las texturas/audio referenciados en `project.json` (`/api/assets/<id>/file`) con `TextureLoader`/`fetch` y no conoce sesiones. Un id no-UUID → `404 ASSET_NOT_FOUND` (nunca 500).

**200** — bytes del archivo con headers:
- `Content-Type`: el MIME real del asset.
- `Content-Disposition`: `inline` para imágenes, `attachment; filename="<nombre>"` para el resto.

**Errores:** `404 ASSET_NOT_FOUND` (id inexistente o blob huérfano).

### `DELETE /api/assets/:id` — Eliminar asset

Borra la fila + el archivo del filesystem.

**200** → `{ deleted: true }`

**Errores:** `404 ASSET_NOT_FOUND` · `401`.

---

## 7. Galería pública (`/api/gallery`) — sin auth (C4)

Juegos con `estado: PUBLICADO` (publicados con `PATCH /:id/publish`).

### `GET /api/gallery` — Lista pública de juegos

**200** → `{ games: [{ slug, titulo, descripcion, visitas, publicadoEn, autor }], total }` (sin `data`, ordenado por `publishedAt desc`; `autor` = nombre público o login).

### `GET /api/gallery/:slug` — Juego completo (para cargar en el motor)

Devuelve el `data` íntegro + **incrementa `visitas`** (una visita = abrir el juego).

**200:**
```json
{
  "success": true,
  "data": {
    "juego": {
      "slug": "mi-juego", "titulo": "Mi juego", "descripcion": "",
      "visitas": 3, "publicadoEn": "...", "renderMode": "retro",
      "schemaVersion": 3, "nombre": "Mi juego", "data": { "world": { ... } }
    }
  },
  "error": null
}
```

**Errores:** `404 NOT_FOUND` (slug no publicado o despublicado).

---

## 8. Plantillas (`/api/templates`) — público (C4 + C5d)

Visibilidad (C5d): sin sesión solo las **del sistema** (`propietario_id` NULL, p.ej. `tpl-demo`); con `Authorization: Bearer` también las **propias** (`tpl-studio` es la personal del usuario `chimi`).

### `GET /api/templates` — Lista (sin `data`)

**200** → `{ templates: [{ id, nombre, descripcion }] }` (siempre incluye el seed `tpl-demo`).

### `GET /api/templates/:id` — Plantilla completa

**200** → `{ template: { id, nombre, descripcion, propietarioId, data } }` — `data` válido según `validateProject`. Una plantilla personal solo la ve su dueño; para el resto (anónimos incluidos) es como si no existiera.

**Errores:** `404 TEMPLATE_NOT_FOUND` (inexistente **o** personal ajena).

---

## 9. Ejemplos rápidos (curl)

```bash
# Register + login (token de acceso)
curl.exe -X POST http://localhost:3000/auth/register -H "content-type: application/json" \
  -d '{"login":"alice","password":"secreto-123","nombre":"Alicia","apellido":"G."}'
curl.exe -X POST http://localhost:3000/auth/login -H "content-type: application/json" \
  -d '{"login":"alice","password":"secreto-123"}'   # → data.accessToken

# Proyectos
curl.exe -X POST http://localhost:3000/api/projects -H "Authorization: Bearer <TOKEN>" \
  -H "content-type: application/json" -d '{"nombre":"Mi juego"}'
curl.exe http://localhost:3000/api/projects -H "Authorization: Bearer <TOKEN>"

# Assets (multipart; en WSL usar rutas C:/... porque curl.exe es Windows)
curl.exe -X POST http://localhost:3000/api/assets -H "Authorization: Bearer <TOKEN>" \
  -F "file=@C:/ruta/guard_f0.png;type=image/png" -F "tipo=sprite"
curl.exe http://localhost:3000/api/assets/<ID>/file -o salida.png     # PÚBLICO (sin token, D1)
curl.exe http://localhost:3000/api/assets -H "Authorization: Bearer <TOKEN>"  # listar
curl.exe http://localhost:3000/api/assets?tipo=audio -H "Authorization: Bearer <TOKEN>"  # filtrar audio

# Galería + plantillas (público)
curl.exe -X PATCH http://localhost:3000/api/projects/<ID>/publish -H "Authorization: Bearer <TOKEN>" \
  -H "content-type: application/json" -d '{"titulo":"Mi juego","descripcion":"Demo de C4"}'
curl.exe http://localhost:3000/api/gallery
curl.exe http://localhost:3000/api/gallery/<SLUG>          # incrementa visitas
curl.exe http://localhost:3000/api/templates/tpl-demo
curl.exe http://localhost:3000/api/templates -H "Authorization: Bearer <TOKEN>"  # + las propias (C5d)
curl.exe -X POST http://localhost:3000/api/projects -H "Authorization: Bearer <TOKEN>" \
  -H "content-type: application/json" -d '{"plantillaId":"tpl-demo"}'
```

---

## 10. Estado por fase

| Fase | Endpoints | Estado |
|---|---|---|
| B2 | `/`, `/health`, `/ready` | realizada |
| C1 | `/auth/register`, `/auth/login` | realizada |
| C2 | `/api/projects` CRUD | realizada |
| C3 | `/api/assets` CRUD + `/file` (requiere JWT) | realizada |
| C4 | `publish`/`unpublish`, `/api/gallery`, `/api/templates` | realizada |
| C5d | `/api/templates` con dueño (`propietario_id`; seed `tpl-studio`) | realizada |
| C5a | Autenticación integrada en el Studio (C5a) | realizada |
| C5b | Guardar/Cargar el proyecto por API | realizada |
| C5c | `GET /api/assets` (list+tipo), `GET /:id/file` público (D1), audio MIME ampliado (D5), sin localStorage | realizada |

Detalle del plan y criterios de aceptación: `DATABASE.md §8`.