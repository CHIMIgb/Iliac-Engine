# RayCast Studio

Creador web de RPG **3D retro** (estilo Doom → Daggerfall).

> **Plan maestro:** [`ROADMAP.md`](ROADMAP.md) — fases F1–F13 + catálogo de herramientas (§6). Leer antes de proponer features.

---

## Estado actual (Sept 2026)

El proyecto tiene **dos capas separadas** (ver `ROADMAP.md` §13):

| Capa | Estado | Descripción |
|------|--------|-------------|
| **Motor** (`engine/`) | ✅ **Validado F1–F2.6** | JS vanilla puro, aislado. Three.js + sector system: geometría poligonal, rampas/escaleras reales, sprites billboard, física cinemática, terreno procedural (Simplex noise). **108 tests** pasan. |
| **Demo** (`demo/`) | ✅ Funcional | Consumidor mínimo: importa motor, define `project.json` v3, lanza loop. Mundo 2 pisos + exteriores, más variantes `rooms/`, `stairs/`, `terrain/`. |
| **Studio** (`studio/`) | ✅ **F3 + F4 Realizadas** | TypeScript + Vite + Vitest. Design System (Catppuccin Mocha) + **Level Editor interactivo**: viewport 3D orbit con grid y ejes, herramientas 1-6 (seleccionar/vértices/sectores/paredes/alturas/entidades), picking por ratón, alturas con rueda, **catálogo de entidades con bestiario de Daggerfall**, **generador de mazmorras**, guardar/exportar/importar (localStorage). **90 tests** pasan. |
| **Backend** (`server/`) | ⏳ Visión | Hono + Prisma + PostgreSQL (pendiente, tras Hito). |

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
# Motor (JS vanilla) — 108 tests (Node --test)
npm run test:engine

# Studio (TypeScript + Vite)
npm run studio:dev        # Dev server en http://localhost:5173
npm run studio:test       # 90 tests (Vitest)
npm run studio:typecheck  # tsc --noEmit
npm run studio:build      # Typecheck + build producción en studio/dist

# Dentro de studio/
cd studio
npm run setup:textures    # Copia texturas SVG de ../demo/textures a public/textures (1 vez)
npm test                  # 90 tests (Vitest)
npm run build             # Typecheck + build
```

> El motor F1/F2 se abre directo en el navegador (`demo/index.html`), sin build.

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

### Demo (`demo/`) — consumidor mínimo

```
demo/
├── index.html                # Abrible directo (<script type="module">), sin build
├── main.js                   # Importa Engine3D, define input (WASD + ratón) y arranca el loop
├── project.js                # project.json v3 del mundo de ejemplo (2 pisos + montaña + pozos)
├── textures/                 # Texturas SVG usadas por demo y Studio (setup:textures)
├── rooms/                    # Variante: mundo de varias salas conectadas (main.js/project.js/index.html)
├── stairs/                   # Variante: demo centrada en escaleras/peldaños
└── terrain/                  # Variante: demo de terreno procedural (Simplex + sectores)
```

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
├── public/textures/          # Texturas SVG copiadas por setup:textures (para el viewport del editor)
└── tests/                    # 8 archivos · 90 tests (Vitest): tools, toolmanager, serializer, placement,
                              # picking, entities, dungeons, camera-controls
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
DATABASE.md         # Esquema Prisma/PostgreSQL del backend (visión)
DATABASE_MVP.md     # Esquema mínimo para el Hito (visión parcial)
AGENTS.md           # Instrucciones para agentes (convenciones, entorno WSL, protocolo)
docs/ENGINE_COMPONENTS.md  # Documentación técnica del motor (API, componentes, schema v3)
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
# Motor 3D (abrir demo/index.html en navegador)
cd demo && npx serve -p 8080
# → http://localhost:8080  (WASD + ratón, F11 fullscreen)

# Studio (Level Editor interactivo)
cd studio && npm run dev
# → http://localhost:5173  (atajos 1-6 = herramientas; clic izq edita u orbita en vacío, clic der orbita, medio pan, WASD+QE pan, rueda zoom/alturas)
```

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
- `DATABASE.md` — Esquema Prisma/PostgreSQL (backend)
- `docs/ENGINE_COMPONENTS.md` — Documentación técnica del motor (API, componentes, schema v3)
- `AGENTS.md` — Instrucciones para agentes (convenciones, WSL, protocolo)