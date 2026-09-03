# RayCast Studio

Creador web de RPG **3D retro** (estilo Doom → Daggerfall).

> **Plan maestro:** [`ROADMAP.md`](ROADMAP.md) — fases F1–F13 + catálogo de herramientas (§6). Leer antes de proponer features.

---

## Estado actual (Sept 2026)

El proyecto tiene **dos capas separadas** (ver `ROADMAP.md` §13):

| Capa | Estado | Descripción |
|------|--------|-------------|
| **Motor** (`engine/`) | ✅ **Validado F1–F2.6** | JS vanilla puro, aislado. Three.js + sector system: geometría poligonal, rampas/escaleras reales, sprites billboard, física cinemática, terreno procedural (Simplex noise). 107 tests pasan. |
| **Demo** (`demo/`) | ✅ Funcional | Consumidor mínimo: importa motor, define `project.json` v3, lanza loop. Mundo 2 pisos + montaña exterior con pozos. |
| **Studio** (`studio/`) | ✅ **F0.7 Validado** | TypeScript + Vite + Vitest. Design System (Catppuccin Mocha): 18 componentes UI, layout principal (toolbar, split view 3 paneles, bottom tabs, status bar), demo page `/components`, atajos globales, cliente API tipado. 39 tests pasan. |
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
npm run test:engine    # 107 tests del motor (Node --test)

# Studio (TypeScript + Vite)
cd studio
npm run dev            # Dev server en http://localhost:5173
npm run test           # 39 tests (Vitest + jsdom)
npm run build          # Typecheck + build producción en ../public/studio

# Raíz (conveniencia)
npm run test:engine    # Desde raíz
npm run studio:dev     # Studio dev server
npm run studio:build   # Studio build
npm run studio:test    # Studio tests
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
│   │   ├── main.ts             → Bootstrap AppLayout
│   │   ├── style.css · tokens.css  → Design System (Catppuccin Mocha)
│   │   ├── ui/                 → 18 componentes (Button, Input, Tabs, Table, Modal, Toast, ...)
│   │   ├── layout/             → AppLayout, Toolbar, StatusBar, BottomTabs
│   │   ├── components/         → ComponentsDemo (/components)
│   │   └── api/client.ts       → apiFetch<T> tipado (contrato {success,data,error})
│   ├── tests/                  → 39 tests (Vitest)
│   ├── vite.config.ts · tsconfig.json · index.html
│   └── package.json
├── server/                     ← VISIÓN: API + Postgres (tras Hito)
├── docs/
│   └── ENGINE_COMPONENTS.md    → Documentación técnica del motor
├── test/
│   └── engine/                 → 107 tests motor (Node --test)
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
| **F2.6** | Terreno procedural (Simplex noise) | ✅ Realizada |
| **F0.7** | Design System + Studio base (Vite+TS) | ✅ **Validada** |
| **F3** | **Level Editor Mínimo** (vista 2D/3D, playtest F5/F6) | 🎯 **Siguiente** |
| **F4** | **Blueprints Mínimos (LiteGraph.js)** | ⏳ Pendiente |
| 🚀 **HITO** | **DEMO FUNCIONAL (Vertical Slice)** | ⏳ Pendiente |
| F5 | Asset Pipeline (Sprite tools, Asset Manager) | ⏳ Pendiente |
| F6 | Blueprints Avanzados + IA + Catálogo bloques | ⏳ Pendiente |
| F7–F8 | Polish Visual (Font Manager DOS, Loading Editor) | ⏳ Pendiente |
| F9–F12 | Sistemas RPG (Combate, Magia, Diálogos, Misiones, Economía) | ⏳ Pendiente |
| F13 | Publisher + Cloud Gallery | ⏳ Pendiente |

> **Próximo objetivo:** F3 Level Editor Mínimo — vista 2D top-down + viewport 3D orbit, materiales, playtest F5/F6 en vivo.

---

## Demo rápida

```bash
# Motor 3D (abrir demo/index.html en navegador)
cd demo && npx serve -p 8080
# → http://localhost:8080  (WASD + ratón, F11 fullscreen)

# Studio (Design System demo)
cd studio && npm run dev
# → http://localhost:5173  (F11 maximiza viewport, /components para demo UI)
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