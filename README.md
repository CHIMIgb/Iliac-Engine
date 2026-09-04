# RayCast Studio

Creador web de RPG **3D retro** (estilo Doom → Daggerfall).

> **Plan maestro:** [`ROADMAP.md`](ROADMAP.md) — fases F1–F13 + catálogo de herramientas (§6). Leer antes de proponer features.

---

## Estado actual (Sept 2026)

El proyecto tiene **dos capas separadas** (ver `ROADMAP.md` §13):

| Capa | Estado | Descripción |
|------|--------|-------------|
| **Motor** (`engine/`) | ✅ **Validado F1–F2.6** | JS vanilla puro, aislado. Three.js + sector system: geometría poligonal, rampas/escaleras reales, sprites billboard, física cinemática, terreno procedural (Simplex noise). 108 tests pasan. |
| **Demo** (`demo/`) | ✅ Funcional | Consumidor mínimo: importa motor, define `project.json` v3, lanza loop. Mundo 2 pisos + montaña exterior con pozos. |
| **Studio** (`studio/`) | ✅ **F3 + F4 Realizadas** | TypeScript + Vite + Vitest. Design System (Catppuccin Mocha) + **Level Editor interactivo**: viewport 3D orbit con grid y ejes (X rojo, Y verde, Z azul), herramientas 1-6 (seleccionar/vértices/sectores/paredes/alturas/entidades), picking por ratón, rueda para alturas, guardar/exportar/importar (localStorage). 57 tests pasan. |
| **Backend** (`server/`) | ⏳ Visión | Hono + Prisma + PostgreSQL (pendiente, tras Hito). |

**Contrato:** `project.json` schema v3 — el Studio escribe datos, el motor los lee. Sin duplicación de lógica.

---

## Arquitectura de capas

```
┌─ STUDIO (TypeScript + Vite) ───── herramientas de creación ─────┐
│  Design System · Layout · Level Editor · Blueprints · Assets ·  │
│  AI/Quest/Dialogue Editors · Font Manager · Publisher           │
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
# Motor (JS vanilla)
npm run test:engine    # 108 tests del motor (Node --test)

# Studio (TypeScript + Vite)
cd studio
npm run dev            # Dev server en http://localhost:5173
npm run setup:textures # Copia texturas SVG de demo/textures a public/textures (1 vez)
npm run test           # 57 tests (Vitest)
npm run build          # Typecheck + build producción en studio/dist

# Raíz (conveniencia)
npm run test:engine      # Desde raíz
npm run studio:dev       # Studio dev server
npm run studio:test      # Studio tests
npm run studio:typecheck # Typecheck del Studio
npm run studio:build     # Studio build
```

> El motor F1/F2 se abre directo en el navegador (`demo/index.html`), sin build.

---

## Estructura real

```
raycastjs/
├── engine/                     ← MOTOR · JS vanilla puro
│   ├── core/                   → math.js · player.js · physics.js · sector.js
│   │                            → stairs.js · noise.js · terrain.js · validate.js
│   │                            → triangulate.js
│   └── three/                  → Renderer3D.js · WorldMesh.js · SectorGeometry.js
│                                → GeometryMerge.js · StairsMesh.js · SpriteSystem.js
│                                → textures.js
│   ├── Engine3D.js             → Orquestador (load, update, render, dispose)
│   └── index.js                → API público: Engine3D
├── demo/                       ← CONSUMIDOR MÍNIMO
│   ├── index.html              → Abrible directo (<script type="module">)
│   ├── main.js                 → Importa motor, loop WASD+ratón
│   └── project.js              → Mundo: 2 pisos + montaña + pozos (schema v3)
├── studio/                     ← STUDIO · TypeScript + Vite
│   ├── src/
│   │   ├── main.ts             → Bootstrap AppLayout + herramientas (atajos 1-6)
│   │   ├── style.css · tokens.css  → Design System (Catppuccin Mocha)
│   │   ├── editor/             → EditorState (proyecto editable) + tipos
│   │   ├── tools/              → ToolManager · picking.ts · tools.ts (mutaciones)
│   │   ├── viewport/           → EditorViewport (3D orbit) · Overlay2D · CameraControls
│   │   ├── io/                 → Serializer (project.json ↔ EditorState) · FileManager (guardar/exportar)
│   │   ├── layout/             → AppLayout, Toolbar, StatusBar
│   │   └── ui/                 → Componentes UI (Button, Tabs, Table, Modal, Toast, ...)
│   ├── public/textures/        → Texturas SVG (npm run setup:textures)
│   ├── tests/                  → 57 tests (Vitest)
│   ├── vite.config.ts · tsconfig.json · index.html
│   └── package.json
├── server/                     ← VISIÓN: API + Postgres (tras Hito)
├── docs/
│   └── ENGINE_COMPONENTS.md    → Documentación técnica del motor
├── test/
│   └── engine/                 → 108 tests motor (Node --test)
├── ROADMAP.md                  ← Plan maestro: fases F1–F13, Ruta Crítica §15
├── DESIGN.md                   ← Design System (paleta, tipografía, componentes, layout)
├── DATABASE.md                 ← Esquema Prisma/PostgreSQL
├── AGENTS.md                   ← Instrucciones para agentes
└── package.json
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