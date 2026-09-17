# Arquitectura de RayCast Studio / Iliac Engine

> Documento maestro de arquitectura. Describe **todas las capas del producto** y cómo se comunican, hasta nivel de archivo. Complementa (no reemplaza) al resto de la documentación:
> - `docs/ENGINE_COMPONENTS.md` — API interna del motor (`engine/`), archivo por archivo.
> - `docs/API_ENDPOINTS.md` — endpoints HTTP del backend, con ejemplos de petición/respuesta.
> - `DESIGN.md` — design system del Studio (paleta, componentes, atajos).
> - `DATABASE.md` — esquema Prisma/PostgreSQL y plan de fases del backend.
> - `ROADMAP.md` — plan maestro del producto (§12 estado, §13 capas, §15 ruta crítica).

---

## 1. Visión general

RayCast Studio es un **creador web de RPG 3D retro** (estilo Doom → Daggerfall) con tres capas que solo se comunican por **datos**, nunca por código:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STUDIO (studio/) — TypeScript + Vite                                   │
│  Herramientas de creación: edita el documento, genera contenidos        │
│  (terreno, mazmorras, sprites, audio), playtest con el motor real.      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ escribe / lee
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  CONTRATO — contract/project.json (schema v3)                           │
│  El ÚNICO puente entre capas. Herramientas escriben datos; el motor     │
│  los lee y renderiza. La validación vive UNA vez (contract/).           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ lee en playtest (F5, en memoria)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MOTOR (engine/) — JavaScript vanilla puro, sin build, sin UI           │
│  Render 3D (Three.js), física cinemática, sectores, audio Web Audio,    │
│  sprites animados, cielo clásico/realista. API pública: Engine3D.       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ persiste (guardar proyecto, subir assets)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BACKEND (server/) — Node + Hono + Prisma 7 + PostgreSQL                │
│  API REST: auth JWT, CRUD de proyectos (JSONB v3), blobs de assets,     │
│  (futuro) galería pública y plantillas. Fuente única de verdad.         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Regla de oro:** escribe los datos de una manera que el motor los pueda leer; nunca dupliques lógica de motor en las herramientas, ni de las herramientas en el backend. La validación de `project.json` es el ejemplo canónico: vive **una vez** en `contract/` y la reutilizan Studio (`validateProjectJson`) y Backend (`validateProjectData`).

---

## 2. Capas y comunicación

| Capa | Dirección | Estado (sept 2026) |
|---|---|---|
| `engine/` | Motor de juego JS vanilla puro (sin TS, sin build). Expone `Engine3D`. | F1–F4.7 realizadas/validadas |
| `contract/` | `project-schema.js` + `.d.ts` (validador + tipos). Punto único de verdad del schema. | usado por motor, Studio y server |
| `studio/` | Editor TS + Vite. Consume el motor vía alias `@engine/*` (types en `engine.d.ts`). | F3 + F4 + F4.5/F4.6/F4.7 realizadas |
| `server/` | API Node + Hono + Prisma. Persiste proyectos y assets. | A1–A3, B1–B2, C1–C3 realizadas |

Los consumidores del motor importan **solo** `engine/index.js` (`export { Engine3D }`). Los módulos internos (`core/*`, `three/*`) son privados del motor; los tests los importan directamente, los consumidores no.

### Flujo de datos end-to-end (editar → jugar → guardar)

1. **Editar:** el usuario dibuja en el viewport del Studio (herramientas 1–7). `ToolManager` muta `EditorState` (el documento en memoria = `project.json` v3 editable).
2. **Recarga en vivo:** `EditorState.onChange` → throttle (`reloadMs()`: 120 ms, 250 ms si > 40.000 sectores) → `validateProjectJson` (contrato) → `viewport.reload(raw)` → `Engine3D.setWorld(project)` **sin recrear el renderer** (camino barato si solo cambió el mundo) o `new Engine3D` si cambió el bloque `render`/cielo.
3. **Playtest (F5):** `EditorViewport.setMode('game')` → pointer lock, `engine.resumeAudio()` (gesto del usuario desbloquea el AudioContext), `engine.setCompass(true, viewport)` (brújula HUD). WASD + ratón → `engine.update(input, dt)`. F5 otra vez / Tab → vuelve al modo orbit (editor), `stopAudio()`.
4. **Guardar:** `FileManager.localSave()` (localStorage `raycast-studio:project`) o `exportJson()` (descarga `.json`). El backend es la **fuente única de verdad** a largo plazo: el Studio hablará por `GET/PATCH /api/projects` para persistir el mismo documento (C5, futura integración).
5. **Assets:** el Sprite Tool sube frames por el middleware de Vite (`POST /assets/sprites/upload` → `assets/`, gitignored). El backend (ya operativo desde C3) sube los mismos archivos vía `POST /api/assets` y los sirve por `GET /api/assets/:id/file`.

---

## 3. El contrato: `project.json` (schema v3)

Vive en `contract/` como **JS vanilla puro** (`project-schema.js`, 216 líneas) + **tipos TypeScript** (`project-schema.d.ts`) para que Studio y Backend lo consuman sin duplicar lógica.

**Estructura:**

```
{
  meta:    { name, schemaVersion: 3, renderMode: '3d', ... }
  camera:  { posX, posY, posZ, yaw, pitch }          // definido por el EditorState
  render:  { fov, near, far, backgroundColor, ambientLight, directionalLight, fog }
  world: {
    vertices:  [{ id, x, y, z? }]
    sectors:   [{ id, vertexIds[], floorH, ceilH, floorTex, ceilTex, wallTex, floorSlope? }]
    walls:     [{ id, a, b, sectorFront, sectorBack|null, tex?, solid?, portal? }]
    ramps?:    [{ id, sector, fromH, toH, axis }]
    sprites?:  [{ id, tex, x, y, z?, scale?, type?, entityType?, collisionType?, collisionBox?, anim? }]
    textures?: { [key]: ruta | color hex }
    spriteAnims?: { [id]: { frames: string[], fps?, loop? } }
    sky?:      { set, frame?, style: 'classic' } | { style: 'realista', hour, dayLengthSec, ... }
  }
  audio?:  [{ id, src, bus: music|sfx|ambience|voice, loop?, volume?, spatial?, variations?, layers? }]
  music?:  { id, intensity: 0|1|2, bpm? }
}
```

**`validateProject(project)`** devuelve `{ valid, errors, warnings }` y comprueba: estructura esencial del mundo (vértices/sectores/paredes con referencias existentes), sky clásico (set 0–30, frame 0–31) o realista (hora, valores de sol/luna/aurora), audio (buses válidos, id únicos, `music.id` referenciando un audio existente), entre otros. Se usa en: motor (`Engine3D` constructor lanza si `valid === false`), Studio (`Serializer.validateProjectJson`), Backend (`schemas/project.ts → validateProjectData` al POST/PATCH de proyectos).

---

## 4. Capa MOTOR (`engine/`)

JS vanilla puro: **sin TypeScript, sin build, sin framework, sin dependencia de ninguna UI**. Solo ESModules. Two-subcapas estrictas:

- `core/` = lógica de juego **pura** — sin Three.js ni DOM; testeable en Node aislado.
- `three/` = todo lo que toca **Three.js/WebGL** — render, mallas, materiales, HUD.
- `Engine3D.js` = **orquestación solamente** (ciclo de vida, delegación). No implementa física ni render. `index.js` re-exporta `Engine3D` (única puerta pública).

### 4.1 Orquestador — `Engine3D`

```js
constructor(project)   // valida el contrato, construye el índice sectorial cacheado
async load(canvas)     // texturas → Renderer3D → WorldMesh → cielo → sol → audio
setWorld(project)      // recarga en caliente; si solo cambió el mundo no recrea renderer
update(input, dt)      // física (sub-steps, cap dt 50ms), sprites animados, audio espacial, sol
render()               // sincroniza cámara y dibuja
resize(w, h) / dispose()
setCompass(on, container?)  // brújula HUD (heading tape) — usa en playtest
resumeAudio() / stopAudio() // AudioContext gated por gesto del usuario (autoplay)
```

Campos de orquestación: `player`, `renderer`, `audio` (AudioEngine, null sin `audio[]`), `music` (AdaptiveMusic, null sin `music.layers`), `compass` (CompassOverlay), `spriteAnimator`, `sectorIndex` (vertexMap + wallsBySector + BVH cacheado).

### 4.2 `core/` — lógica pura

| Archivo | Responsabilidad | Funciones clave |
|---|---|---|
| `math.js` | Utilidades matemáticas | `PI2`, `rotate(vx, vy, ang)` |
| `player.js` | Entidad jugador | `posX/Y/Z`, `yaw/pitch`, `eyeHeight 0.5`, `height 1.8`, `stepHeight 0.6`, `gravity 9.0`, `rotateYaw/Pitch`, getters `forward/right` |
| `physics.js` | Física cinemática v3 | `moveWithSectorCollision(player, world, dirX, dirY, speed, dt, radius, sectorIndex)` (sub-steps ≤10, vector único, círculo-segmento vs paredes sólidas), `updateVerticalSector(...)` (altura de piso/techo, escaleras, gravedad acelerada por `velocityZ`, colisión de techo, trackea `currentSector`) |
| `sector.js` | Geometría sectorial | `buildSectorIndex` (vertexMap/wallsBySector/BVH), `pointInPolygon`, `getSectorAt`, `getSectorAtOrNearest` (solo adyacentes al último sector), `getFloorHeightAt/getCeilHeightAt` (interp. baricéntrica, alturas por vértice o slope), `getSolidWalls`, `closestPointOnSegment/distancePointToSegment` |
| `stairs.js` | Escaleras de peldaños | `getStairHeightAt(x,y)` (altura del peldaño), `getStairSegments` (deprecado para colisión horizontal) |
| `anims.js` | Animación de sprites por frames | `animFrameIndex(anim, elapsed)` (fps/loop, puro), `DEFAULT_FPS 1`, `MIN_FPS 0.0001` |
| `noise.js` | Ruido procedural | `createNoise(seed)` (Simplex 2D reproducible), `fbm2(noise, x, y, opts)` (octaves/lacunarity/gain) |
| `terrain.js` | Generador de terreno | `generateTerrain(opts)` → `{vertices, sectors, walls}` v3 (celdas convexas con `floorH` array, textura por pendiente, portales internos), `sectorSlopeAngle` |
| `validate.js` | Validador del contrato | `validateProject(project)` → `{valid, errors, warnings}` — el motor lo llama en el constructor |
| `triangulate.js` | Triangulación ear-clipping | `triangulate(points)` — usada por SectorGeometry para suelos/techos cóncavos |
| `sky.js` | Lógica del cielo clásico Daggerfall | `SKY_SETS 31`, `SKY_FRAMES 32`, `skyFrameLabel(frame)` ("HH:MM"), `skySetForHour`, `skyHourForSet` |
| `daylight.js` | Lógica pura día/noche realista | `sunDirection(hour, tilt)`, `moonDirection` (anti-solar), `sunElevation`, `paletteFor` (paleta de iluminación), `advanceHour`, `hourLabel` |
| `audio.js` | Audio engine (Web Audio API) | `AudioEngine` (buses music/sfx/ambience/voice, `linearToDb`/`dbToLinear`, SFX one-shot con variación, loops simultáneos, ducking de música bajo voz, `playSfx/setBusVolume/duckMusic/setListener/resume/halt/dispose`; **opcional y a prueba de fallos**: si el navegador quirkéa, se auto-silencia sin romper el frame). Ejes mundo → Web Audio: X=x, Y=z, Z=y |
| `music.js` | Música adaptativa por layering | `AdaptiveMusic(engine, def)` — N stems del mismo arranque sincronizados, la intensidad 0..N-1 solo mueve ganancias (fades sin desincronizar), `setIntensity`; helpers `secondsPerBeat`, `timeUntilNextBeat`, `levelFromIntensity` |

### 4.3 `three/` — render (Three.js)

| Archivo | Responsabilidad |
|---|---|
| `Renderer3D.js` | Escena + cámara perspectiva + `WebGLRenderer` + luces fijas + manejo de `webglcontextlost/restored` (recrea el renderer); `syncCamera(player)` (X,Y plano → X,Y,Z con Y arriba); `setDefaultLights(false)` cuando el sol realista sustituye luces fijas; `project.render` configurable (fov/near/far/backgroundColor/luces) |
| `WorldMesh.js` | Construye el mundo v3 desde `world`: suelos/techos/paredes por sector, **merge por textura/material** (reducir draw calls), escaleras y sprites, `clear(scene)` con dispose limpio |
| `SectorGeometry.js` | Geometrías de suelo/techo (ear-clipping vía triangulate.js) y paredes (quad vertical con slopes) |
| `GeometryMerge.js` | `mergeGeometries(geometries)` — BufferGeometries indexadas en una sola |
| `StairsMesh.js` | Cajas por peldaño (`BoxGeometry`) para rampas tipo `stairs` |
| `SpriteSystem.js` | Sprites billboard (`THREE.Sprite`), animación por frames (aplica `animFrameIndex` al `map` del material) |
| `textures.js` | `loadTextures` (Promise.all, NearestFilter+SRGB una vez), `colorTexture(hex)` (cache por hex, 64×64), `makeMaterial` (MeshStandardMaterial, filtro pixelado) |
| `SkySystem.js` | Cielo **clásico** Daggerfall: telón plano 2D (billboard del horizonte, sets SKY00–30 × 32 franjas), Y-shear real, dibujado primero sin depth |
| `SunSystem.js` | Cielo **realista** (F4.7): shader atmosférico de Three (dispersión Rayleigh), sol+luna con luz direccional + sombras PCF 2048, estrellas (Points), **aurora boreal** (domo GLSL procedural aditivo), avance del reloj `dayLengthSec` (en editor queda fija, en playtest avanza); API simétrica: `addTo/update(camera, hour, dt)/dispose` |
| `fog.js` | Niebla atmosférica | `createFog({color?, density?}, bgColor)` → `THREE.FogExp2` o `null` |
| `CompassOverlay.js` | Brújula HUD (heading tape): DOM+CSS (sin canvas), `headingDeg(yaw)` (yaw → rumbo náutico), cinta con marcas cada 5°, se activa con `engine.setCompass(true, container)` |

### 4.4 Ciclo de vida y bucle

```
load(canvas) → TextureLoader → Renderer3D → WorldMesh → cielo (SkySystem|SunSystem) → audio (si hay)
update(input, dt):
  dt' = min(dt, 50 ms)                  // cap anti-inestabilidad
  moveWithSectorCollision(...)          // horizontal, sub-steps
  updateVerticalSector(...)             // vertical: piso/techo/escaleras/gravedad
  spriteAnimator.advance(dt')           // frames de animaciones
  audio.update(...)                     // oído espacial, emisores que siguen sprites; a prueba de fallos
  sun.update(camera, dt)                // reloj día/noche (interiores atenúan el sol: data-driven por ceilTex != 'sky')
render(): syncCamera(player) → renderer.render()
```

---

## 5. Capa STUDIO (`studio/`)

TypeScript + Vite + Vitest. Editor documental: el **`EditorState` es la fuente de verdad en memoria**; `main.ts` conecta las piezas; todo viaja como `project.json` v3.

### 5.1 Estructura

```
studio/src/
├── main.ts               # Bootstrap: layout, toolbar, atajos, wiring, persistencia, reload en vivo
├── style.css             # Design System (tokens Catppuccin Mocha en CSS)
├── sample-project.ts     # Proyecto demo: montaña + río + terreno procedural (2.500 sectores)
├── engine.d.ts           # Tipos del motor (`@engine/*`) para el editor + playtest
├── editor/               # editor/types.ts (Editable*) + editor/EditorState.ts (documento + mutadores + onChange)
├── tools/                # tools/ToolManager.ts (1493 líneas: 7 herramientas + pickers + entorno F4.7)
│                         # tools/tools.ts (operaciones geométricas puras) + tools/picking.ts (hit-test 2D)
├── viewport/             # EditorViewport.ts (Engine3D + grid + overlays + playtest F5)
│                         # CameraControls.ts (orbit/game) + Overlay2D.ts (gizmos) + EntityPreviewMesh.ts (cajas)
├── spriteTool/           # Pipeline F4.6: detectSprites (componentes conexas), gridSlice, frames, animator, spriteToolUI
├── dungeons/             # Generador de mazmorras por bloques 16×16: definitions, blocks, placement, assemble
├── io/                   # FileManager (localStorage + export/import), Serializer (↔ project.json v3), assetServer (lógica pura del middleware)
├── ui/                   # Panel, Icon (lucide SVG), Toast, DungeonBrowser (preview automap)
└── entities/             # entityCatalog.ts — NPCs + bestiario Daggerfall (~60 enemigos en 6 categorías)
```

### 5.2 Herramientas del editor (teclas 1–7) y acciones

| Tecla | Herramienta | Qué hace |
|---|---|---|
| 1 | Select | Seleccionar vértices/paredes/sprites; Delete/Backspace borra |
| 2 | Vertex | Crear/mover vértices (snap a grid, `createVertexAt`, `moveVertexTo`) |
| 3 | Move | Trasladar selección (traduce vértices/paredes/sectores/sprites; el terreno se mueve entero por prefijo) |
| 4 | Wall | Dibujar paredes con portales automáticos (`tryCreateWall`, `closeSector`) |
| 5 | Height | Rueda ±0.25 m techo/piso (`changeSectorHeight`); esculpido continuo con `ToolManager.update` |
| 6 | Entity | `openEntityPicker` — catálogo de entidades, coloca con textura/caja del catálogo |
| 7 | Terrain | `openTerrainSizePicker` — genera terreno por celda 0.5 m (`placeTerrainAt`, `sculptTerrainAt`, `applyTerrainRelief` FBM) |
| 8 | Cielo | Popover clásico (set/frame) / realista (hora, día, sombras, sol/luna/aurora) |
| 9 | Audio | `openAudioPicker` — añade definiciones `audio[]`/`music` |
| — | Sprites | Modal Sprite Tool (slicer + animator + biblioteca) |
| — | Mazmorras | DungeonBrowser → ensambla bloques y los vierte al documento |
| — | F5 / Playtest | `viewport.setMode('game')` — pointer lock, motor real, brújula |

**Reload en vivo:** `doc.onChange` → throttle → validar → `viewport.reload(raw)`. Si solo cambió el `world` → `engine.setWorld` (no recrea renderer); si cambió `render`/cielo → recrea `Engine3D`.

### 5.3 Sprite Tool (F4.6) — pipeline completo

Cargar hoja/frames → **detectar** (`detectSprites`: componentes conexas 4-vecindad; o grilla `gridSlice`) → **cortar/recortar** (trim, regiones) → **animar** (`animator.ts`: plantilla idle/walk/attack/death, fps 1–60, espejo, ≥2 frames) → **guardar** (`buildSpriteAnims` → `{textures, spriteAnims}` validado contra `validateProject` del motor real) → subir frames al middleware de Vite → `setWorldTextures` + `setSpriteAnims` al documento.

### 5.4 Mazmorras (dungeons/)

Bloques prefabricados 16×16 (`blk-open`, `blk-passage`, `blk-room`) con conectores por lado (n/s/e/w). `assemble(def, blocks)` genera los tiles con prefijos únicos, **sella bocas sin vecino recíproco** (`seal_{id}`) y vierte al documento con `mergeDungeon(state, dun, ox, oy)`. `findSpot` coloca la mazmorra en el primer hueco en espiral sin solape (AABB).

### 5.5 IO

- `FileManager`: localStorage (`raycast-studio:project`), descarga `${nombre}.json`, importación.
- `Serializer`: `toProjectJson(state)` / `fromProjectJson(json)` (normaliza, ignora desconocidos) / `validateProjectJson` (usa el validador del contrato).
- `assetServer.ts`: lógica pura del middleware Vite (`vite.config.ts`): POST `/assets/audio|sprites/upload` y GET `/assets/*` con anti-traversal (`resolveAssetPath`), límites de tamaño (audio 50 MB, sprites 20 MB), saneado de nombres. Sirve desde `assets/` (gitignored).

---

## 6. Capa BACKEND (`server/`)

Node + **Hono** + **Prisma 7** (driver `pg`) + **PostgreSQL 18**. Fuente única de verdad. Ver `DATABASE.md §8` para el plan completo y `docs/API_ENDPOINTS.md` para los endpoints con ejemplos.

### 6.1 Estructura

```
server/
├── src/
│   ├── index.ts        # Arranque @hono/node-server en PORT (tsx)
│   ├── app.ts          # createApp(): logger, requestId, CORS, onError, notFound, rutas (/, /auth, /api/projects, /api/assets, /health, /ready)
│   ├── db.ts           # PrismaClient singleton + adapter PrismaPg (lazy connect)
│   ├── lib/
│   │   ├── AppError.ts   # Error de negocio {code, status, message, details}; fromZod()
│   │   ├── codes.ts      # Diccionario de 15 códigos de error (código → status+mensaje)
│   │   ├── handler.ts    # ok() / errorResponse() / errorHandler — contrato {success,data,error}
│   │   ├── jwt.ts        # signToken/verifyToken (HS256, access 15 min, refresh 7 días, jti aleatorio)
│   │   ├── password.ts   # bcryptjs 12 rounds (hash/verify)
│   │   ├── rateLimit.ts  # createLimiter por IP en memoria (ventana deslizante) — # ponytail: multi-instancia → Redis
│   │   ├── auth.ts       # requireAuth middleware (JWT → c.get('userId'))
│   │   ├── parseBody.ts  # parseBody(c, schema): lee JSON y valida con Zod → AppError 422
│   │   └── storage.ts    # Blobs: writeBlob/readBlob/removeBlob (STORAGE_PATH o <server>/storage/uploads por import.meta.dirname)
│   ├── routes/
│   │   ├── auth.ts       # POST /auth/register, POST /auth/login (con loginLimiter 5/min)
│   │   ├── projects.ts   # CRUD /api/projects (JWT, propietario, data JSONB v3 validado por el contrato)
│   │   └── assets.ts     # POST/GET/GET:file/DELETE /api/assets (multipart, MIME magic bytes, dedupe hash)
│   └── schemas/
│       ├── auth.ts       # registerSchema, loginSchema (Zod)
│       └── project.ts    # createProjectSchema, updateProjectSchema, validateProjectData (→ contract), DEFAULT_PROJECT_DATA
├── tests/               # node --test: auth (7), projects (9), assets (9) + infra (B) = 36 tests
├── db/schema.sql        # SQL canónico (A1)
├── prisma/              # schema.prisma espejo 1:1 + baseline 0_init
├── storage/uploads/     # Blobs <assetId>.<ext> (gitignored, solo .gitkeep)
└── .env.example         # DATABASE_URL, JWT_SECRET, PORT, PUBLIC_URL, STORAGE_PATH
```

### 6.2 Decisiones clave del backend

- **Contrato uniforme:** toda respuesta es `{success, data, error}`; todo error pasa por `AppError` + `codes.ts` (validación con Zod en todos los inputs, nunca stack traces al cliente).
- **Business-regla:** rutas que verifican propiedad → `404` (PROJECT_NOT_FOUND / ASSET_NOT_FOUND), nunca `403` (no enumerar recursos).
- **Prisma 7 + tsx:** el server importa el validador de `contract/` (fuera de `server/`); `tsc → dist/` rompería la ruta relativa, así que producción corre con **tsx** y `build` = `tsc --noEmit` (chequeo). Alternativa futura: bundler (tsup/esbuild).
- **JWT:** HS256 con `jti` aleatorio (fix C2 — dos sesiones en el mismo segundo colisionaban el unique `token_hash`), refresh hasheado en DB para rotación/revocación.
- **Assets:** MIME detectado por magic bytes (`file-type`), nunca por extensión/header; tope 20 MB (413 `ASSET_TOO_LARGE`); dedupe por hash sha256 reutiliza el asset existente (200) — no hay content-addressed storage porque `asset.ruta` es `@unique` (nota ponytail en DATABASE.md §8 C3).
- **Rate limit:** 5/min en login, 100/min general (en memoria por IP; a Redis cuando haya varias instancias).

---

## 7. Mapa de dependencias entre capas

```
engine/  ──(nada)───────────────────────────►  (0 deps; tres/ usa Three.js como peer)
studio/  ──importa──►  @engine/index.js (Engine3D) + @engine/core/{validate,sky,daylight,noise,audio,sector}.js
          ──usa──────►  contract/project-schema.js (vía Serializer)
          ──npm──────►  three, lucide (dev: vite, vitest, typescript)
server/  ──importa──►  contract/project-schema.js (vía schemas/project.ts)
          ──npm──────►  hono, @hono/node-server, @hono/jwt, prisma, @prisma/adapter-pg, zod, bcryptjs, dotenv, file-type (dev: tsx, typescript)
NUNCA:  engine ← studio;  engine ← server;  studio ← server (código).
```

---

## 8. Convenciones que sostienen la arquitectura

1. `core/` jamás importa Three.js; `three/` jamás contiene lógica de juego; `Engine3D` solo orquesta.
2. El motor no depende del Studio ni del backend; solo se comunican por datos (`project.json` + API REST).
3. Cero duplicación de validación de datos: el contrato es el único validador.
4. Cada cosa nueva se documenta en su archivo respectivo (regla AGENTS.md).
5. No hardcodear datos de juego: todo en `project.json`; solo config de infraestructura en código.
6. Sin emojis como iconos de UI: lucide SVG inline.
7. Tests obligatorios por feature (una prueba que falla = feature no cerrada).

---

## 9. Referencias

- `ROADMAP.md` §12 (estado), §13 (arquitectura de capas), §14–§15 (fases y ruta crítica), §16 (deuda técnica).
- `docs/ENGINE_COMPONENTS.md` — componentes del motor en detalle.
- `docs/API_ENDPOINTS.md` — endpoints HTTP documentados.
- `DESIGN.md` — design system del Studio.
- `DATABASE.md` — esquema y plan de fases del backend (A1–C5).
- `AGENTS.md` — reglas del proyecto y entorno WSL.