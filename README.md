# RayCast Studio

Creador web de RPG **3D retro** (estilo Doom → Daggerfall).

> **Plan maestro:** [`ROADMAP.md`](ROADMAP.md) — fases F1–F13 + catálogo de herramientas (§6). Leer antes de proponer features.

---

## Estado actual (Sept 2026)

El proyecto tiene **dos capas separadas** (ver `ROADMAP.md` §13):

| Capa | Estado | Descripción |
|------|--------|-------------|
| **Motor** (`engine/`) | ✅ **Validado F1–F2.6** | JS vanilla puro, aislado. Three.js + sector system: geometría poligonal, rampas/escaleras reales, sprites billboard, física cinemática, terreno procedural (Simplex noise). **108 tests** pasan. |
| **Studio** (`studio/`) | ✅ **F3 + F4 Realizadas** | TypeScript + Vite + Vitest. Design System (Catppuccin Mocha) + **Level Editor interactivo**: viewport 3D orbit con grid y ejes, herramientas 1-6 (seleccionar/vértices/sectores/paredes/alturas/entidades), picking por ratón, alturas con rueda, **catálogo de entidades con bestiario de Daggerfall**, **generador de mazmorras**, guardar/exportar/importar (localStorage), **C5a: cuenta/sesión backend (cookie)**. **226 tests** pasan. |
| **Backend** (`server/`) | ✅ **A1–A3 + B1–B2 + C1–C4 + C5a** | Hono + Prisma 7 + PostgreSQL: DB `iliac_engine` (9 tablas + enums + seeds), auth JWT + bcrypt, CRUD proyectos (`data` JSONB v3), assets (blobs), galería/plantillas, contrato `{success,data,error}`. **48 tests** pasan. Detalle y fases en `DATABASE.md §8`. |

**Contrato:** `project.json` schema v3 — el Studio escribe datos, el motor los lee. Sin duplicación de lógica.

---

## Arquitectura de capas

```
┌─ STUDIO (TypeScript + Vite) ───── herramientas de creación ─────┐
│  Design System · Layout · Level Editor · Dungeon Browser ·      │
│  Catálogo de entidades · (futuro) Blueprints · Assets · RPG     │
└────────────────┬────────────────────────────────────────────────┘
                 │  escribe / prepara DATOS (project.json + assets)
┌────────────────▼────────────────────────────────────────────────┐
│  MOTOR DEL JUEGO (JS vanilla puro, aislado e independiente)     │
│  Three.js + sector system · ECS · física · audio · visualscript │
│  Sin TypeScript, sin build, sin framework; sin acoplarse a UI   │
└────────────────┬────────────────────────────────────────────────┘
                 │  lee el mismo project.json
         DEMO / PLAYER (consumidor)  ← también el Studio consumirá el motor
```

---

## Comandos

```bash
# TODO A LA VEZ: Studio (Vite :5173) + Backend (Hono :3000), misma terminal
npm run dev

# Motor (JS vanilla) — tests (Node --test)
npm run test:engine

# Studio (TypeScript + Vite)
npm run studio:dev        # Dev server en http://localhost:5173
npm run studio:test       # Tests (Vitest)
npm run studio:typecheck  # tsc --noEmit
npm run studio:build      # Typecheck + build producción en studio/dist

# Backend (Node + Hono + Prisma)
npm run server:dev        # Dev server en http://localhost:3000 (tsx watch)

# Dentro de studio/
cd studio
npm test                  # Tests (Vitest)
npm run build             # Typecheck + build

# Dentro de server/
cd server
npm run dev               # tsx watch http://localhost:3000
npm run typecheck         # tsc --noEmit
npm test                  # Tests (node --test + tsx)
npm run build             # tsc → dist/
```

> El motor se valida con el playtest del Studio (F5) y con `npm run test:engine`.

---

## Estructura real y explicación por archivo

### Motor (`engine/`) — JS vanilla puro

```
engine/
├── index.js                  # API pública: export { Engine3D } — lo único que importan los consumidores
├── Engine3D.js               # Orquestador: ciclo de vida (constructor, load, update, render, dispose). NO implementa física ni render; delega en core/ y three/
├── core/                     # Lógica de juego PURA — sin Three.js, testeable aislada
│   ├── math.js               # Utilidades matemáticas (vectores, distancias, ángulos)
│   ├── player.js             # Entidad jugador: posición, orientación (yaw/pitch), getters
│   ├── physics.js            # Física cinemática: movimiento + colisión con sectores + gravedad (v3)
│   ├── sector.js             # Geometría sectorial: point-in-polygon, alturas piso/techo, índices espaciales (BVH)
│   ├── stairs.js             # Altura y geometría de escaleras de peldaños (poligonales)
│   ├── noise.js              # Ruido Simplex 2D + FBM reproducible (semilla)
│   ├── terrain.js            # Generador procedural de terreno por sectores (heightmap → sectores)
│   ├── validate.js           # Validador ligero de project.json (schema v3) al cargar
│   └── triangulate.js        # (sin uso actual) ear-clipping; SectorGeometry usa THREE.ShapeUtils
└── three/                    # Todo lo que toca Three.js/WebGL
    ├── Renderer3D.js         # Escena, cámara, luces, render loop (configurable vía project.render)
    ├── WorldMesh.js          # Construye la escena 3D desde project.json; merge por material, dispose limpio
    ├── SectorGeometry.js     # Geometría de suelos, techos y paredes poligonales (triangulación)
    ├── GeometryMerge.js      # Merge de BufferGeometry para reducir draw calls
    ├── StairsMesh.js         # Geometría 3D de escaleras de peldaños
    ├── SpriteSystem.js       # Sprites billboard (animación por frames, dirección 8 sentidos)
    └── textures.js           # Carga de texturas (Promise.all, NearestFilter), cache de colores, materiales
```

Regla (AGENTS.md): `core/` nunca importa Three.js; `three/` nunca contiene lógica de juego; `Engine3D.js` solo orquesta.

### Studio (`studio/`) — TypeScript + Vite + Vitest

```
studio/
├── index.html                # Punto de entrada de Vite
├── package.json · tsconfig.json · vite.config.ts
├── src/
│   ├── main.ts               # Bootstrap: AppLayout + toolbar (atajos 1-6) + atajos globales + wiring del editor
│   ├── style.css             # Design System completo: tokens CSS (Catppuccin Mocha) + componentes
│   ├── sample-project.ts     # Proyecto de muestra para abrir al iniciar
│   ├── engine.d.ts           # Declaración de tipos de Engine3D para el Studio (puente motor ↔ Studio)
│   ├── editor/
│   │   ├── types.ts          # Tipos del documento editable (sector/wall/sprite/entidad/colisión)
│   │   └── EditorState.ts    # Estado del proyecto editable (mutaciones, undo-friendly, serialización)
│   ├── tools/
│   │   ├── ToolManager.ts    # Enrutador de herramientas (1-6): pointerdown/up/move, wheel, delete. Selector de entidades
│   │   ├── tools.ts          # Operaciones geométricas puras: vértices, paredes, sectores, alturas, sprites/entidades
│   │   └── picking.ts        # Hitting test 2D→3D (proyección de cursor sobre vértices/paredes/sectores), límites de altura
│   ├── viewport/
│   │   ├── EditorViewport.ts # Viewport 3D: canvas, controles de cámara, pinta Overlay2D + preview de entidades
│   │   ├── Overlay2D.ts      # Overlay 2D: grid, ejes X/Y/Z, selección, snapping al grid
│   │   ├── CameraControls.ts # Cámara orbit (clic der, medio pan, WASD+QE, rueda zoom)
│   │   └── EntityPreviewMesh.ts  # Cubos 3D de preview de entidades (color y caja según catálogo) — solo editor
│   ├── io/
│   │   ├── Serializer.ts     # project.json ↔ EditorState (export/import, schema v3)
│   │   └── FileManager.ts    # Guardar/exportar/importar (localStorage + descarga JSON)
│   ├── layout/
│   │   ├── AppLayout.ts      # Layout de paneles (toolbar + viewport + statusbar, colapsables)
│   │   ├── Toolbar.ts        # Toolbar superior con acciones (icono + label + atajo)
│   │   └── StatusBar.ts      # Barra de estado (info contextual del cursor/zoom)
│   ├── ui/
│   │   ├── Panel.ts          # Panel con header, controles contextuales y colapsar
│   │   ├── Icon.ts           # Iconos lucide (SVG inline, 16/20px, currentColor)
│   │   ├── Toast.ts          # Notificaciones (success/warning/error/info, auto-dismiss)
│   │   └── DungeonBrowser.ts # Modal para generar mazmorras procedurales desde DUNGEONS
│   ├── dungeons/
│   │   ├── types.ts          # Tipos del generador: bloques, pasajes, orientaciones, definiciones
│   │   ├── definitions.ts    # DUNGEONS: plantillas de mazmorra (nombre, tamaño, bloques)
│   │   ├── blocks.ts         # BLOCKS: bloques prefabricados (salas, pasillos, cruces) con conectores
│   │   ├── placement.ts      # findSpot(): coloca bloques en el grid evitando solapes
│   │   └── assemble.ts       # assemble(): arma la mazmorra y mergeDungeon(): la vuelca al EditorState
│   └── entities/
│       └── entityCatalog.ts  # Catálogo de entidades colocables (NPCs + bestiario Daggerfall df_* en 6 categorías)
├── public/textures/          # Texturas SVG del viewport del editor (copia local, no versionada)
└── tests/                    # 8 archivos · 90 tests (Vitest): tools, toolmanager, serializer, placement,
                              # picking, entities, dungeons, camera-controls
```

### Backend (`server/`) — Node + Hono + Prisma 7

```
server/
├── package.json · tsconfig.json (strict) · prisma.config.ts · .env.example
├── db/schema.sql              # SQL canónico (A1) — aplicado y verificado
├── prisma/
│   ├── schema.prisma          # Espejo 1:1 del SQL (A3): 9 modelos + 2 enums
│   └── migrations/0_init/     # Baseline (la DB ya tenía las tablas de A1/A2)
├── src/
│   ├── app.ts                 # App Hono (logger + GET /) — testeable con app.request()
│   ├── index.ts               # Arranque @hono/node-server en PORT (3000)
│   └── db.ts                  # PrismaClient singleton con adapter PrismaPg
├── storage/uploads/           # Blobs de assets (C3) — contenido no versionado
└── tests/                     # prisma-schema.test.js (A3) + app.test.ts (B1)
```

### Tests del motor (`test/engine/`) — 19 archivos · 108 tests (Node --test)

```
test/engine/
├── engine3d.test.js      # Ciclo de vida de Engine3D (load/update/dispose)
├── public-api.test.js    # index.js expone solo Engine3D
├── validate.test.js      # Validador de project.json
├── physics-sector.test.js / physics-vertical.test.js  # Física y gravedad
├── player.test.js        # Entidad jugador
├── sector.test.js        # Geometría de sectores (point-in-polygon, alturas)
├── sector-geometry.test.js / world-mesh.test.js / renderer3d.test.js  # Render y mallas
├── stairs.test.js / stairs-sprites.test.js  # Escaleras
├── terrain.test.js / noise.test.js          # Terreno procedural
├── textures.test.js      # Carga/colores de texturas
└── triangulate.test.js   # (para el módulo sin uso actual)
```

### Raíz

```
ROADMAP.md          # Plan maestro: fases F1–F13, §12 estado, §13 capas, §15 ruta crítica, §16 deuda
DESIGN.md           # Design System del Studio (paleta Catppuccin, tipografía, componentes, layout)
DATABASE.md         # Backend: esquema Prisma/PostgreSQL + plan por fases (A1–C5)
DATABASE_MVP.md     # Esquema mínimo para el Hito (visión parcial)
AGENTS.md           # Instrucciones para agentes (convenciones, entorno WSL, protocolo)
docs/ARCHITECTURA.md        # Arquitectura del producto completo (todas las capas, flujo de datos)
docs/API_ENDPOINTS.md       # Endpoints HTTP del backend, con ejemplos de petición/respuesta
docs/ENGINE_COMPONENTS.md   # Documentación técnica del motor (API, componentes, schema v3)
opencode.json       # Configuración de opencode (plugins, MCP)
package.json        # Scripts raíz (test:engine, studio:*) + three
```

---

## Modelo de datos: `project.json` schema v3

```jsonc
{
  "meta": { "name": "Demo", "schemaVersion": 3, "renderMode": "3d" },
  "render": { "fov": 80, "near": 0.1, "far": 500, "backgroundColor": 0x1a1a2e },
  "camera": { "posX": 4, "posY": 4, "posZ": 0.6, "yaw": 1.57, "pitch": 0 },
  "world": {
    "vertices": [ { "id": "v0", "x": 0, "y": 0 }, ... ],
    "sectors": [
      { "id": "room", "vertexIds": ["v0","v1","v2","v3"], "floorH": 0, "ceilH": 3, "floorTex": "wood", "ceilTex": "ceil", "wallTex": "wall" }
    ],
    "walls": [ { "id": "w0", "a": "v0", "b": "v1", "sectorFront": "room", "sectorBack": null, "tex": "wall" } ],
    "ramps": [ { "id": "stairs", "type": "stairs", "pos": { "x": 4, "y": 8 }, "direction": { "x": 0, "y": 1 }, "rise": 3, "run": 8, "steps": 12, "tex": "stone" } ],
    "sprites": [ { "id": "lamp", "tex": "sprite", "pos": { "x": 4, "y": 4, "z": 0.8 }, "scale": 0.7 } ],
    "textures": { "wall": "./textures/muro.svg", "sky": 0x87CEEB }
  }
}
```

Los sprites de entidad añaden campos opcionales (retrocompatibles): `entityType`, `entityName`, `collisionType` (`npc|human|animal`) y `collisionBox` (`{w,d,h}` en metros). El motor los renderiza como billboard; la colisión por caja es del editor/blueprints.

Ver `ROADMAP.md` §5 para esquema completo y `docs/ENGINE_COMPONENTS.md` para API del motor.

---

## Roadmap — Ruta Crítica (Vertical Slice)

| Fase | Entregable | Estado |
|------|-----------|--------|
| **F1** | Motor raycast base (JS vanilla) | ✅ Validada |
| **F2** | Verticalidad / 3D (Three.js) | ✅ Validada |
| **F2.5** | Motor sectores poligonales (rampas, escaleras, sprites) | ✅ Validada |
| **F3** | Studio MVP: Level Editor Mínimo (Vite+TS) | ✅ Realizada |
| **F4** | Studio: Herramientas de edición 3D (Level Editor interactivo) | ✅ **Realizada** |
| **F4.5** | Audio Engine (Web Audio API) | ⏳ Pendiente |
| 🚀 **HITO** | **DEMO FUNCIONAL (Vertical Slice)** — requiere F4 + F4.5 | ⏳ Pendiente |
| **F5** | Asset Pipeline (Asset Manager, Sprite Pipeline) | ⏳ Pendiente |
| **F6** | Sistemas RPG en TypeScript (Combate, IA, Inventario) | ⏳ Pendiente |
| **F7** | Polish Visual (Font Manager DOS, Loading, UI runtime) | ⏳ Pendiente |
| **F8** | Publicación local (HTML autónomo) | ⏳ Pendiente |
| **F9+** | Escenas múltiples, sistemas RPG avanzados, Cloud Gallery | ⏳ Visión futura |

> **Próximo objetivo:** F4.5 Audio Engine — buses Web Audio API, SFX espacial y música adaptativa (prerrequisito del HITO).

---

## Demo rápida

```bash
# Todo: Studio + Backend a la vez (misma terminal)
npm run dev
# → Studio http://localhost:5173 (atajos 1-6 = herramientas; playtest F5 ejecuta el motor)
# → Backend http://localhost:3000 (API)
```

---

## Cuenta de desarrollo (C5a)

El Studio autentica contra el backend real (botón **Cuenta** en la toolbar). Cuenta creada para desarrollo local en la DB `iliac_engine`:

| Campo | Valor |
|---|---|
| Nombre | Chimi GB |
| Usuario (login) | `chimi` |
| Contraseña | `raycast-2026` |

> **Solo desarrollo local** — no usar en producción. La sesión se guarda en una **cookie** (`raycast_session`, 7 días = TTL del refresh token), no en localStorage.

---

## Notas importantes

- **Nunca versionar:** `assets/` (sprites Daggerfall copyright) ni `.env`.
- **Dos capas estrictas:** `engine/` = JS vanilla puro (sin TS, sin build); `studio/` = TypeScript + Vite. El motor NO importa nada del Studio.
- **Contrato único:** `project.json` — herramientas escriben, motor lee.
- **Tests obligatorios:** Cada feature nueva → test. Un test que falla = feature no cerrada.
- **Energía por mantenimiento:** Una prueba que falla = feature no cerrada.

---

## Referencias

- `ROADMAP.md` — Plan maestro (§12 estado, §13 arquitectura, §15 ruta crítica, §16 deuda técnica)
- `DESIGN.md` — Design System (Catppuccin Mocha, componentes, layout, atajos)
- `DATABASE.md` — Backend: esquema Prisma/PostgreSQL + plan por fases A1–C5
- `docs/ARCHITECTURA.md` — Arquitectura del producto completo (motor, contrato, studio, server)
- `docs/API_ENDPOINTS.md` — Endpoints del backend documentados
- `docs/ENGINE_COMPONENTS.md` — Documentación técnica del motor (API, componentes, schema v3)
- `AGENTS.md` — Instrucciones para agentes (convenciones, WSL, protocolo)