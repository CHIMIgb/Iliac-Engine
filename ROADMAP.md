# ROADMAP — Motor de Juego + Editor de Niveles

> Motor 3D interno y editor de niveles ligero para desarrollar nuestro propio juego RPG retro-3D.
> Plan maestro del proyecto.

---

## 1. Visión

Construir un **motor de videojuegos 3D** (estilo Wolfenstein 3D → Doom → Daggerfall) y un **editor de niveles ligero** dedicados exclusivamente a desarrollar nuestro propio juego. El motor proporciona el renderizado 3D (Three.js/WebGL), la física cinemática de sectores poligonales, el audio espacial y la gestión de entidades. La **lógica del juego** — combate, inventario, narrativa, IA, misiones, diálogos — se programa **directamente en TypeScript**, consumiendo la API del motor.

El proyecto tiene **dos capas**:

- **Motor del juego** (`engine/`) — JS vanilla puro, aislado. Lee `project.json` y ejecuta el mundo: render 3D, física, audio, sprites, sistema de entidades.
- **Editor de niveles** (`studio/`) — TypeScript + Vite. Herramienta para crear mundos: pintar sectores, ajustar alturas, colocar entidades, gestionar assets. Escribe `project.json`.

**Principio rector:** un juego creado = un `project.json` + `assets/`. El editor escribe datos; el motor lee datos. La lógica del juego se implementa en TypeScript consumiendo la API pública del motor, no con visual scripting.

---

## 2. Decisiones y justificación técnica

| Decisión | Justificación |
|---|---|
| **Web, no escritorio** | WebGL da GPU desde el navegador. Si algún día se quiere desktop, Electron/Tauri envuelve el mismo TypeScript sin reescribir nada. |
| **Motor 3D (Three.js)** | Render en perspectiva real con verticalidad (pisos/techos con altura, rampas, portales). El `project.json` define `renderMode: '3d'` fijo. |
| **TypeScript + Vite + Vitest** | Tipado para el modelo de datos, build modular, dev-server `npm run dev` y tests integrados. |
| **Three.js para 3D** | Reutilizar librería madura. El trabajo propio es el *sector system* (verticalidad) encima del pipeline gráfico. |
| **Formato de datos propio, único** | Desacopla editor ↔ motor. El editor escribe JSON; el motor lee el mismo JSON. Schema versionado. |
| **Física cinemática ligera** | Mover-y-colisionar contra sectores + gravedad, escaleras, elevadores y triggers. Un Rigidbody completo es sobredimensionado para este género. |
| **Lógica del juego en TypeScript** | La IA, combate, inventario, misiones, diálogos y narrativa se programan en TS consumiendo la API del motor. Código directo > visual scripting para un equipo pequeño con capacidad de programar. |
| **Sistemas RPG inspirados en Daggerfall Unity** | Referencia de arquitectura para combate, quests, diálogos, facciones, clases. Blueprint de diseño, no código copiable. |
| **Fidelidad de época** | Tipografías DOS/rpg 90s y pantallas de carga definen la identidad visual retro. |
| **Compilación estática local** | Los juegos se compilan localmente a HTML autónomo o se ejecutan directamente desde el dev-server. Sin backend, sin base de datos de usuarios, sin galería cloud. |

---

## 3. Análisis de los componentes del motor

| Componente | ¿Se crea? | Forma concreta | Justificación |
|---|---|---|---|
| **Sistema de renderizado** | ✅ Sí | Motor **3D** (Three.js/WebGL) con cámara perspectiva (juego) y ortográfica (editor top-down). | Three.js evita reinventar WebGL; sector system con verticalidad propio. |
| **Motor de físicas** | ✅ Sí (ligero) | Física cinemática: mover-y-colisionar contra sectores, gravedad, escaleras, elevadores, triggers. | Cubre el 100% de mecánicas del género sin Rigidbody completo. |
| **Gestor de audio** | ✅ Sí | Web Audio API: PannerNode para sonido espacial 3D, música en loop, SFX one-shot. | Necesario en cualquier RPG. |
| **Sistema de scripting** | ✅ Como código | **TypeScript** consumiendo la API del motor. La lógica del juego se escribe directamente en TS. | Más rápido de iterar, depurar y mantener que visual scripting para un equipo que programa. |
| **Gestión de escenas / niveles** | ✅ (visión futura) | Múltiples escenas/niveles (`scenes[]` en `project.json`), transiciones entre ellas. | Multi-escena es mínimo de motor RPG completo. |
| **Sistema de cámaras** | ✅ (visión futura) | Cámara gestionable: primera persona, cinemática, vista cenital. | Mínimo para cutscenes y alternancia de vistas. |

---

## 4. Arquitectura general

```
┌─────────────── EDITOR (TypeScript + Vite) ────────────────┐
│  Level Editor · 3D Viewport · Asset Manager · Entity Builder │
│  Sprite Pipeline · Design System                            │
└────────────────────────┬──────────────────────────────────┘
                         │  escribe DATOS (project.json + assets/)
┌────────────────────────▼──────────────────────────────────┐
│  MOTOR DEL JUEGO (JS vanilla puro, aislado)                │
│  Lee project.json: render 3D · física · audio · entidades  │
│  sin TypeScript, sin build, sin framework                   │
└────────────────────────┬──────────────────────────────────┘
                         │  lee el mismo project.json
              DEMO / JUEGO (consumidor)
```

**Principio rector:** nada duplicado entre capas. El editor escribe datos; el motor los lee. La lógica del juego se programa en TS consumiendo la API del motor (fuera de estas dos capas, como un módulo del juego).

---

## 5. Modelo de datos (`project.json`)

```jsonc
{
  "meta":       { "name", "schemaVersion", "renderMode": "3d", "author" },
  "camera":     { "posX", "posY", "posZ", "yaw", "pitch" },
  "world": {
    "vertices": [ { "id", "x", "y" } ],
    "sectors":  [ { "id", "vertexIds": [...], "floorH", "ceilH",
                     "floorSlope"?: { "axis": "x"|"y", "angle" },
                     "ceilSlope"?:  { "axis", "angle" },
                     "floorTex"?, "ceilTex"?, "wallTex"? } ],
    "walls":    [ { "id", "a", "b", "sectorFront", "sectorBack"?, "tex"?, "portal"? } ],
    "ramps":    [ { "id", "type": "slope"|"stairs", "direction": { "x", "y" },
                     "rise", "run", "tex"? } ],
    "sprites":  [ { "id", "tex", "pos": { "x", "y", "z" }, "scale", "billboard"? } ],
    "textures": { "id": "ruta_o_color" }
  },
  "entities":   [ { "id", "type", "sprite", "pos": {x,y,z}, "stats": {} } ],
  "audio":      [ { "id", "src", "loop", "volume", "spatial" } ],
  "items":      [ { "id", "name", "type", "effects", "price", "icon", "stackable" } ],
  "spells":     [ { "id", "name", "school", "manaCost", "effects", "fx" } ],
  "npc":        [ { "id", "sprite", "dialogueId", "faction", "shopId" } ],
  "dialogue":   [ { "id", "nodes": [ { "text", "options", "conditions", "actions" } ] } ],
  "quests":     [ { "id", "title", "stages": [ { "step", "condition", "action" } ], "rewards" } ],
  "economy":    [ { "id", "currency", "shops": [ { "items", "prices", "restock" } ] } ],
  "progression":[ { "id", "class", "attributes", "skills", "xpCurve", "perLevel" } ],
  "localization": { "es": { ... }, "en": { ... } }
}
```

**Regla:** schema versionado + validadores. El `project.json` v3 (sectores poligonales, alturas, portales) es el contrato de datos entre el editor y el motor.

### Schema v3 (actual)

El esquema usa un modelo de **sectores poligonales 2D extruidos en 3D**:

- **Vertices** → puntos 2D del mundo.
- **Sectores** → polígonos convexos (o cóncavos con ear-clipping) con `floorH`/`ceilH` independientes, opcionalmente con `floorSlope`/`ceilSlope` para superficies inclinadas.
- **Paredes** → segmentos entre dos vértices. Cada pared pertenece a un `sectorFront` y opcionalmente un `sectorBack` (portal = pared transitable).
- **Rampas** → superficies inclinadas (`slope`) o escaleras de peldaños (`stairs`) posicionadas dentro de sectores.
- **Sprites** → entidades 2D billboard posicionadas en coordenadas 3D (`x`, `y`, `z`).
- **Textures** → mapa de id a ruta de imagen o color sólido.

Migración automatizada de versiones anteriores: un migrador Zod convierte v1/v2 a v3 al cargar.

---

## 6. Catálogo de herramientas (Editor)

El editor contiene únicamente las herramientas necesarias para crear el mundo del juego. Los sistemas RPG (combate, inventario, misiones, diálogos, magia) se programan directamente en TypeScript.

| # | Herramienta | Estado | Descripción |
|---|---|---|---|
| 6.1 | **Level Editor** (mapa + sectores + verticalidad Z + rampas) | ✅ F3 | Pintar sectores, ajustar piso/techo, portales, colocar entidades |
| 6.2 | **3D Viewport / Playtest** | ✅ F2 | Vista de juego en vivo + cámara orbit para editar |
| 6.3 | **Asset Manager** local (texturas, sprites, audio) | 🆕 | Biblioteca central: importar, organizar, previsualizar assets |
| 6.4 | **Entity Builder** básico (posicionar NPCs) | 🆕 | Elegir sprite → tipo → stats básicos → posición en el mapa |
| 6.5 | **Sprite Pipeline** simplificado (Slicer + Animator) | 🆕 | Cortar hojas de sprites en frames, definir animaciones |
| 6.6 | **Design System** / Componentes UI reutilizables | ✅ F0.7 | Paleta, tipografía, espaciado, componentes |

### 6.1 Level Editor — Primer Hito (✅ implementado)
- **Objetivo:** editar el mundo: sectores poligonales con altura de piso/techo, rampas, portales, zonas de trigger y colocación de entidades.
- **Flujo:**
  1. Vista 2D top-down (pintar sectores con cámara ortográfica).
  2. Panel de materiales (Asset Manager) → pintar suelo/paredes.
  3. Seleccionar sector → sliders de elevación piso/techo.
  4. Colocar entidades desde el Entity Builder (drag & drop al viewport).
  5. Zonas de trigger → enlazar a código TS o comportamiento predefinido.
  6. Playtest con F5 (runtime con el proyecto en memoria).

### 6.2 3D Viewport / Playtest (✅ implementado)
- **Objetivo:** vista de juego en vivo dentro del editor + vista orbit para editar.
- **Flujo:** F5 → runtime con el proyecto en memoria → WASD + ratón → F6 vuelve al editor.

### 6.3 Asset Manager — 🆕
- **Objetivo:** biblioteca local de assets (texturas 64×64, sprites, audio). Importar, organizar, previsualizar, optimizar.
- **Flujo:** importar → organizar → id autogenerado → disponible en dropdowns de todos los editores.

### 6.4 Entity Builder — 🆕 (simplificado)
- **Objetivo:** colocar entidades (NPCs, enemigos, props) en el mapa con stats básicos.
- **Flujo:** elegir sprite → tipo (enemy/npc/prop) → stats básicos (hp/damage/speed) → posición → guardar en `entities[]`.

### 6.5 Sprite Pipeline — 🆕 (simplificado)
- **Objetivo:** cortar hojas de sprites en frames y definir animaciones (idle/walk/attack/death).
- **Flujo:** PNG → detectar grilla → recortar → nombrar animación → fps/loop → exportar frames + JSON.

### 6.6 Design System — ✅ (ya implementado)
- **Objetivo:** paleta de colores (tokens CSS), tipografía, espaciado, componentes UI reutilizables.

---

## 7. Flujo de trabajo del juego

```
1. Editor: abrir Level Editor → pintar sectores con alturas y portales
2. Asset Manager: importar texturas y sprites
3. Entity Builder: colocar NPCs y enemigos con stats básicos
4. Playtest (F5): caminar por el mundo, verificar verticalidad y colisión
5. Programar lógica en TypeScript:
   - Combate, inventario, magia → módulos TS que consumen la API del motor
   - IA de enemigos → FSM/behavior trees en TS
   - Diálogos y misiones → árboles de datos en project.json + lógica TS
6. Compilar → HTML autónomo jugable (o ejecutar desde dev-server)
```

---

## 8. Fases de implementación (referencia histórica)

> Las fases originales se conservan como referencia. El esquema actual de fases está en §14–§15.

Ver §15 para la ruta crítica actual.

---

## 9. Estructura de directorios objetivo

```
motor-raycast/
├── engine/                     ← MOTOR DEL JUEGO · JS vanilla puro, aislado
│   ├── core/                   → math.js · player.js · physics.js · collision.js
│   │                            → sector.js · stairs.js · blueprint-runtime.js
│   │                            → audio.js · music.js (F4.5)
│   ├── three/                  → Renderer3D.js · WorldMesh.js · SectorGeometry.js
│   │                            → SpriteSystem.js · textures.js · StairsMesh.js
│   ├── Engine3D.js             → orquestador: carga, loop, API pública
│   └── index.js                → API pública del motor (ESModules)
├── demo/                       ← consumidor: arma un project.json y lanza el loop
│   ├── index.html              → se abre directo (<script type="module">)
│   ├── main.js                 → importa engine, lanza el juego
│   └── project.js              → mapa + texturas de la demo (datos)
├── studio/                     ← EDITOR · TypeScript + Vite
│   ├── src/
│   │   ├── main.ts · style.css
│   │   ├── ui/                 → Design System (botones, inputs, tabs, etc.)
│   │   ├── level-editor/       → Level Editor (vista 2D + canvas)
│   │   ├── blueprints/         → Blueprint Editor (LiteGraph.js) ← temporal, será reemplazado por código TS
│   │   ├── asset-manager/      → Asset Manager local
│   │   └── layout/             → AppLayout, Toolbar, StatusBar
│   ├── tests/                  → Vitest (front)
│   ├── vite.config.ts · tsconfig.json · index.html
├── test/                       ← Tests del motor (JS vanilla)
│   └── engine/                 → physics, collision, engine3d, blueprints, etc.
├── assets/                     ← Assets de prueba (NO versionado)
├── ROADMAP.md
├── AGENTS.md
├── DESIGN.md
└── package.json · opencode.json
```

> **Nota:** `engine/` y `demo/` son lo primero. El editor (`studio/`) se construye encima consumiendo el motor.

---

## 10. Principios de calidad

- **Energía por mantenimiento:** una prueba que falla = feature no cerrada.
- **Cero duplicación:** todo vive una vez. El motor no duplica lógica del editor ni viceversa.
- **Reutilizar antes que crear:** Three.js, Vitest, Web Audio API, LiteGraph.js (temporal).
- **Drag & drop como estándar de UX:** assets al viewport, entidades al mapa.
- **Fidelidad retro en cada detalle:** tipografías DOS, pantallas de carga, ruido del píxel.
- **Separación estricta de capas:** motor (JS vanilla) vs editor (TS/Vite). El motor NO importa nada del editor.

---

## 11. Estado del plan

| Fase | Estado |
|---|---|
| F1 Motor de raycast base en **JS vanilla** (de Lode) | ✅ Validada |
| F2 Verticalidad / 3D (sector system) sobre el motor F1 | ✅ Migración completada |
| F2.5 Motor de sectores poligonales: rampas/escaleras + sprites billboard + física | ✅ Validada |
| F2.6 Terreno procedural: Simplex noise + generador de grilla + texturas por pendiente | ✅ Realizada |
| F3 Studio MVP: Base + Design System (Vite+TS) | ✅ Validada |
| F3 Studio MVP: **Level Editor Mínimo** (Vite+TS) | ✅ Realizada |
| F4 Studio: **Herramientas de edición 3D** (picking, tools, ToolManager, Overlay2D, viewport interactivo) | ✅ Realizada |
| F4.5 **Audio Engine** (Web Audio API: buses, SFX espacial, música adaptativa) | ⏳ Pendiente |
| 🚀 **HITO: DEMO FUNCIONAL (Vertical Slice)** | ⏳ Pendiente |
| F5 Asset Pipeline (Asset Manager, Sprite Pipeline) | ⏳ Pendiente |
| F6 Sistemas RPG en TypeScript (Combate, IA, Inventario) | ⏳ Pendiente |
| F7 Polish (Font Manager DOS, Loading, UI runtime) | ⏳ Pendiente |
| F8 Publicación local (HTML autónomo) | ⏳ Pendiente |
| F9 Escenas múltiples + transiciones | ⏳ Visión futura |

---

## 12. Arquitectura en dos capas (rector)

> **El proyecto se organiza en dos capas separadas que se comunican solo por datos.** El editor escribe `project.json`; el motor lo lee.

```
┌─ EDITOR (TypeScript + Vite)  ─── herramientas de creación ──────┐
│  Level Editor · Asset Manager · Entity Builder · Sprite Pipeline  │
└────────────────────────┬─────────────────────────────────────────┘
                         │  escribe / prepara DATOS (project.json + assets)
┌────────────────────────▼─────────────────────────────────────────┐
│  MOTOR DEL JUEGO (JS vanilla puro, aislado e independiente)       │
│  Procesa y renderiza: Three.js + sector system + física + audio   │
│  sin TypeScript, sin build, sin framework                         │
└────────────────────────┬─────────────────────────────────────────┘
                         │  lee el mismo project.json
              DEMO / JUEGO (consumidor)
```

### Reglas de la arquitectura de capas

- **El motor es 3D (Three.js):** render exclusivamente WebGL. No hay modo retro paralelo.
- **El motor es JS vanilla puro:** sin TypeScript, sin build, sin dependencias. Se abre directo.
- **El editor escribe datos:** el Level Editor construye `project.json` con sectores, paredes, entidades, texturas.
- **La lógica del juego se programa en TypeScript:** módulos TS que importan la API del motor y definen comportamiento (combate, IA, misiones, etc.). No se usa visual scripting como sistema principal.
- **El project.json v3 es el contrato:** vertices, sectores con `floorH`/`ceilH`, paredes con portales, ramps, sprites, textures.

---

## 13. Construcción del motor por fases (JS vanilla, desde cero)

### F1 — Motor de raycast base (JS vanilla, siguiendo a Lode)

Se reconstruye el raycaster del tutorial *"Raycasting"* de Lode's Computer Graphics Tutorial en **JavaScript vanilla puro**.

**Estructura:**
```
engine/
├── core/
│   ├── math.js          ← vectores, rotación (matriz 2x2), utilidades
│   ├── camera.js        ← posición 2D + dirección + plano de cámara
│   ├── dda.js           ← algoritmo DDA (hallar muro)
│   ├── projection.js    ← perpWallDist (sin efecto ojo de pez), lineHeight
│   ├── floorcasting.js  ← suelos/techos por scanlines
│   ├── zbuffer.js       ← Z-buffer 1D por columna
│   ├── textures.js      ← carga y mapeo de texturas
│   └── sprites.js       ← sprites billboard
├── Raycaster.js         ← clase principal: consume project.json → render
└── index.js             ← API público del motor
```

**Pasos completados:** 1-6 validados (raycaster sin textura → cámara → input → texturas → suelos/techos → z-buffer). F1 operativa.

### F2 — Verticalidad / 3D puro WebGL/Three.js

Migrar de raycaster Canvas a motor 3D real con Three.js. Se abandona el render por columnas y se adopta un pipeline poligonal: geometría por sectores con `floorH`/`ceilH`, cámara perspectiva, iluminación y texturas.

```
engine/
├── core/
│   ├── math.js          → utilidades (rotación 2D)
│   └── player.js        → posición (X,Y,Z), yaw/pitch, movimiento, colisión, step height, gravedad
├── three/
│   └── Renderer3D.js    → escena Three.js, mallas por sector, cámara, luces
├── Engine3D.js          → orquestador: carga, loop, API pública
└── index.js             → API pública: Engine3D, Player, Renderer3D
```

**Verificación:** demo con mundo 3D, subida a plataforma, caída a zona baja, muros/suelos/techos con alturas. Tests pasando.

### F2.5 — Motor de sectores poligonales (estilo Build/XnGine)

Evolutión a **sectores poligonales 2D extruidos en 3D**: paredes como segmentos, pisos/techos inclinados, rampas/escaleras poligonales, sprites billboard y física continua.

#### 1. Modelo de datos: `project.json` schema v3

```jsonc
{
  "meta": { "name", "schemaVersion": 3, "renderMode": "3d" },
  "camera": { "posX", "posY", "posZ", "yaw", "pitch" },
  "world": {
    "vertices": [ { "id", "x", "y" } ],
    "sectors":  [ { "id", "vertexIds", "floorH", "ceilH",
                     "floorSlope"?, "ceilSlope"?,
                     "floorTex"?, "ceilTex"?, "wallTex"? } ],
    "walls":    [ { "id", "a", "b", "sectorFront", "sectorBack"?, "tex"?, "portal"? } ],
    "ramps":    [ { "id", "type": "slope"|"stairs", "direction", "rise", "run", "tex"? } ],
    "sprites":  [ { "id", "tex", "pos": { "x", "y", "z" }, "scale", "billboard"? } ],
    "textures": { ... }
  }
}
```

#### 2. Geometría poligonal (`engine/three/WorldMesh.js`)

- Fan triangulation para sectores convexos, ear-clipping para cóncavos.
- Quads verticales para paredes (`floorH` a `ceilH`).
- Paredes con `sectorBack` actúan como portales (sin quad sólido).
- Soporte de `floorSlope`/`ceilSlope` para superficies inclinadas.
- Un `BufferGeometry` por sector y uno por pared.

#### 3. Rampas y escaleras poligonales

- **Rampas:** sector con `floorSlope` → superficie inclinada lisa.
- **Escaleras:** campo `ramps[]` con `type: "stairs"` → trama de peldaños (cara vertical + horizontal).

#### 4. Física continua contra sectores (`physics.js` + `collision.js`)

- Cápsula vertical del jugador (`height`, `radius`, `eyeOffset`).
- Colisión círculo-segmento contra paredes sólidas + vector de deslizamiento.
- Raycast al suelo para altura (sector plano, inclinado o escalera).
- `stepHeight` para desniveles; gravedad cuando no hay suelo.
- Colisión con techo.
- Point-in-polygon para cambio de sector por portales.

#### 5. Sprites billboard (`engine/three/SpriteSystem.js`)

- Cargar texturas desde `project.json`.
- Planos billboard que miran a la cámara.
- Posición 3D real, oclusión por z-buffer, escalado, transparencia.

#### 6. Tests obligatorios

- Triangulación fan de sector convexo.
- Extrusión de paredes desde vértices.
- Point-in-polygon para sector.
- Altura en punto de suelo inclinado.
- Colisión círculo-segmento.
- Deslizamiento al chocar con pared.
- Sprite billboard mira a cámara.

#### 7. Criterio de aceptación

La demo debe permitir: caminar entre sectores poligonales, subir rampa lisa, subir escalera de peldaños, ver sprite billboard, no caer fuera del mundo. Todos los tests pasando.

### F2.6 — Terreno procedural (✅ realizada)

Simplex noise + generador de grilla + texturas por pendiente.

### F4.5 — Audio Engine (Web Audio API) — fase de ruta crítica (§14)

El **audio es una fase propia de la ruta crítica**, previa al HITO (Vertical Slice): un juego retro-3D sin sonido no se siente completo (enemigo que ataca, puerta que abre, pasos). Se implementa en `engine/core/` (JS vanilla, sin Three.js) con **Web Audio API** (nativa del navegador, sin dependencias). Técnicas según la skill `audio-design` del repo.

#### 1. Arquitectura de buses (`engine/core/audio.js`)

- Un `AudioContext` global, creado/reanudado en el primer gesto del usuario (política de autoplay).
- Mezclador por **buses** (no por sonido individual): `Master ← { Music, SFX, Ambience, Voice }`, cada uno con su `GainNode`.
- **Ganancia en decibelios**, no lineal: mapear sliders `0..1` con `linear_to_db` (`linear_to_db(clamp(v, 1e-4, 1))`), para que el volumen percibido sea logarítmico.
- **Headroom**: el Master debe picoar por debajo de 0 dBFS para evitar clipping; limiter de seguridad en Master.
- **SFX one-shot**: `AudioBufferSourceNode` + `start()`, se auto-destruye al terminar (`onended`), o pool de nodos reutilizables.
- **Música en loop**: `source.loop = true`; crossfade entre tracks con rampas de ganancia (`linearRampToValueAtTime`).

#### 2. Sonido espacial 3D

- `PannerNode` con `panningModel: 'HRTF'` para posicionar sonidos en el mundo.
- `distanceModel: 'inverse'`, `refDistance`, `rolloffFactor` para atenuación por distancia.
- Cada entidad/sprite con `audio[]` espacial se enlaza a su posición 3D; el panner se actualiza al mover la cámara/jugador.

#### 3. Ducking (sidechain) — la música baja bajo diálogos/impactos

- Compresor con sidechain en el bus Music, o rampa de ganancia: al iniciar diálogo/impacto, bajar `Music` unos ~12 dB con `attack` rápido (~10 ms) y `release` lento (~300-500 ms) para que se recupere suave, sin "pumping".
- Alternativa sin middleware: tween/cambiar el bus de Music a un `target_db` y volver al final.

#### 4. Variación de SFX — evitar el "machine gun"

- Aleatorizar `playbackRate`/pitch ±~6 % y volumen ±~20 % por disparo.
- Pools de muestras (varias tomas) por sonido: pasos, golpes, puertas.

#### 5. Música adaptativa (`engine/core/music.js`)

- **Vertical layering**: N stems sincronizados (base, batería, tensión) que arrancan juntos y solo cambian sus volúmenes por intensidad (0 calmado … 2 combate); fades de ~0.5-1.5 s. Cambia intensidad sin perder sincronía.
- **Horizontal re-sequencing** (opcional): secciones (intro, loop A, loop B, combate, outro) con cambio cuantizado al siguiente límite de barra/frase.
- **Intensidad** desde el estado del juego, suavizada (`lerp`) y con histéresis para que no oscile: `intensity_from_state(enemies_near, player_hp01)` → `level_from_intensity`.
- Sincronizar eventos de juego a la **pista del reloj de audio**, no al frame: `seconds_per_beat = 60 / BPM`, cuantizar a la siguiente barra.

#### 6. Integración en `project.json`

Los datos de audio viven en el `audio[]` del schema (§5): `{ id, src, loop, volume, spatial }`, ampliado con `bus` y `musicLayers` para música adaptativa. El **motor lee** el `audio[]`; la **demo/Studio escribe** los datos. Sin duplicar lógica. (El schema se amplía en la fase de implementación, no ahora.)

#### 7. Tests obligatorios

- `test/engine/audio.test.js`:
  - `linear_to_db` mapea 0→−∞, 0.5→≈−6 dB, 1→0 dB (y `db_to_linear` inverso).
  - Un one-shot se auto-destruye al terminar (`onended` → free/pool).
  - Cambio de intensidad → fades de los stems correctos (nivel 1 añade batería, nivel 2 añade tensión).
  - `seconds_per_beat` y `time_until_next_beat` correctos para un BPM dado.
  - Test de ducking: el bus de Music baja al activar ducking y vuelve al desactivar.

#### 8. Criterio de aceptación

La demo debe: reproducir música en loop al cargar; sonar pasos/puerta/impacto con variación y espacialidad 3D; bajar la música (ducking) al iniciar un diálogo; y cambiar la intensidad musical (layers) al entrar en combate. Todos los tests pasan.

---

## 14. Fases del proyecto (Ruta Crítica)

| Fase | Entregable | Depende de | Criterio de aceptación |
|------|-----------|-----------|------------------------|
| **F1** | Motor de raycast base JS vanilla | — | Mundo raycast con texturas y sprites |
| **F2** | Verticalidad/3D sobre motor F1 | F1 | Plataforma elevada, escaleras, objetos a distinta altura |
| **F2.5** | Motor de sectores poligonales | F2 | Sectores con rampas, portales; tests pasando |
| **F3** | Studio MVP: Level Editor Mínimo (Vite+TS) | F2.5 | Pintar mapa con sectores, guardarlo en project.json |
| **F4** | Studio: Herramientas de edición 3D (Level Editor interactivo) | F3 | Editar vértices/paredes/sectores/sprtites con el ratón en el viewport orbit; live reload |
| **F4.5** | **Audio Engine (Web Audio API)** | F2.5 | Buses y SFX espacial; música adaptativa suena al cambiar de zona/combate |
| 🚀 **HITO** | **DEMO FUNCIONAL (Vertical Slice)** | **F4 + F4.5** | **Abrir Studio, pintar nivel con sectores y entidades, dar Playtest. El core está completo.** |
| **F5** | Asset Pipeline Completo (Asset Manager, Sprite Pipeline) | HITO | Sprite animado importado y recortado aparece en la demo |
| **F6** | Sistemas RPG en TypeScript (Combate, IA, Inventario) | F5 | Enemigo persigue y ataca; loot al inventario |
| **F7** | Polish Visual (Font Manager DOS, Loading, UI runtime) | F5 | HUD retro, pantalla de carga |
| **F8** | Publicación local (HTML autónomo) | F7 | Exportar juego a HTML jugable sin servidor |
| **F9** | Escenas múltiples + transiciones (visión futura) | F8 | ≥2 escenas con viaje entre ellas |

### Sobre las fases de sistemas RPG

Los sistemas de combate, inventario, magia, diálogos, misiones y economía se implementan como **módulos TypeScript** que consumen la API del motor, no como editores visuales. Cada sistema es un archivo `.ts` con su lógica, tipos y tests:

- `src/game/combat.ts` — fórmulas de daño, armas, proyectiles, knockback
- `src/game/inventory.ts` — items, equipamiento, peso, stackeable
- `src/game/ai.ts` — FSM/behavior trees, patrulla, persecución, ataque
- `src/game/dialogue.ts` — árboles de diálogo con condiciones
- `src/game/quests.ts` — etapas, condiciones, recompensas
- `src/game/magic.ts` — hechizos, mana, cooldowns, efectos
- `src/game/economy.ts` — tiendas, moneda, restock
- `src/game/progression.ts` — clases, atributos, skills, XP

Esto permite iterrar más rápido:写代码, depurar, testear — sin la fricción de un editor visual.

---

## 15. Deuda técnica prioritaria del motor (bloqueante para avanzar)

> **🚫 Bloqueo de avance:** no se inicia ninguna fase posterior a **F2.5** (Studio TS/Vite, Level Editor, etc.) hasta que los items críticos y altos de esta sección estén resueltos, testeados y validados. El motor actual funciona, pero su deuda técnica haría progresivamente más caro y frágil construir el Studio encima.

### 15.1 Items críticos (deben resolverse antes de cualquier avance)

| # | Problema | Archivo(s) principal(es) | Solución esperada | Estado |
|---|---|---|---|---|
| C1 | `Engine3D.update()` no ejecuta la física de sectores; la demo la llama a mano. | `engine/Engine3D.js`, `demo/main.js` | `Engine3D.update(input, dt)` debe orquestar `moveWithSectorCollision` + `updateVerticalSector`. | validada |
| C2 | El índice sectorial se reconstruye en cada substep/frame. | `engine/core/physics.js` | Cachear `{ vertexMap, walls }` en `Engine3D.load()` y pasarlo a la física. | validada |
| C3 | Un draw call por superficie (suelo/techo/pared). | `engine/three/WorldMesh.js` | Mergear geometrías por textura/material. | validada |
| C4 | Sin tope de `dt` en el motor. | `engine/Engine3D.js`, `engine/core/physics.js` | Cap `dt` y clamp de substeps para evitar congelamiento. | validada |
| C5 | Movimiento separado por ejes (X, luego Y). | `engine/core/physics.js` | Mover como vector único por substep. | validada |
| C6 | Sin colisión con techos. | `engine/core/physics.js`, `engine/core/player.js` | Añadir altura de jugador y clamp contra `getCeilHeightAt`. | validada |

### 15.2 Items de alta prioridad (resolver junto con los críticos)

| # | Problema | Archivo(s) principal(es) | Solución esperada | Estado |
|---|---|---|---|---|
| H1 | `WorldMesh.clear()` no elimina sprites. | `engine/three/WorldMesh.js` | Incluir `isSprite` o agrupar mundo en un `Group` dedicado. | validada |
| H2 | Escaleras sin colisión horizontal. | `engine/core/physics.js`, `engine/core/stairs.js` | Reutilizar `resolveSegmentCollision` con `getStairSegments`. | validada |
| H3 | Geometría de paredes reconstruye mapa de vértices y hace `indexOf`. | `engine/three/SectorGeometry.js` | Pasar vertex map e índices pre-computados. | validada |
| H4 | `computeVertexNormals()` innecesario en superficies planas. | `engine/three/SectorGeometry.js` | Normales analíticas; eliminar cálculo del path caliente. | validada |
| H5 | Sin lifecycle de resize/dispose. | `engine/three/Renderer3D.js`, `engine/Engine3D.js` | Añadir `resize(w,h)` y `dispose()`. | validada |
| H6 | API pública demasiado amplia. | `engine/index.js`, `engine/Engine3D.js` | Surface mínima: `Engine3D`, `Player`, utilidades de datos. | validada |
| H7 | Faltan tests de física vertical v3. | `test/engine/` | Tests de `updateVerticalSector`, techo, `Engine3D.update`. | validada |
| H8 | Schema v2 convive como ciudadano de primera clase. | `engine/core/collision.js`, `engine/core/physics.js`, `engine/three/WorldMesh.js` | Deprecar v2; conservar solo migrador si es necesario. | validada |
| H9 | Carga de texturas secuencial + mutación de texturas en `makeMaterial`. | `engine/three/textures.js` | `Promise.all` en carga; setear filtros una sola vez. | realizada |

### 15.3 Items de prioridad media

- ✅ UVs configurables (`textureRepeat`/`uvScale`) en schema v3.
- ✅ Índice espacial para `getSectorAt` (BVH de bounding boxes).
- ✅ `getSectorAtOrNearest` más robusto.
- ✅ Gravedad basada en velocidad (`velocityZ`).
- ✅ Validador ligero de `project.json` al cargar.
- ✅ Renombrar `raycaster.test.js` → `player.test.js`.
- ✅ Manejo de `webglcontextlost`.

### 15.4 Plan de ejecución

#### Fase A — Física integrada y robusta ✅ Realizada
- Integrar `moveWithSectorCollision` + `updateVerticalSector` en `Engine3D.update()`.
- Cap `dt`, clamp de substeps, movimiento como vector único, colisión con techos.
- Cachear índice sectorial.

#### Fase B — Render eficiente y lifecycle ✅ Realizada
- Mergear geometrías por textura/material.
- Normales analíticas, cachear vertex map.
- Limpiar sprites/luces en `WorldMesh.clear()`.
- `Renderer3D.resize()` y `Engine3D.dispose()`.

#### Fase C — API pública limpia y schema v3 primero ✅ Realizada
- Reducir exports de `engine/index.js`.
- Validador de `project.json`.
- Eliminar schema v2.

#### Fase D — Física y geometría avanzada (parcial) ✅
- Triangulación robusta (ear-clipping), colisión horizontal escaleras, BVH, UVs, gravedad por velocidad.

#### Fase E — Polish y producción (parcial) ✅
- Leer settings de project.json, carga de texturas paralela, cache de texturas de color, manejo de webglcontextlost.

### 15.5 Decisiones pendientes

1. **¿Deprecar schema v2 (grid) ahora?** Recomendación: **sí**. Reducir superficie a mantener.
2. **¿Mergear geometrías manual o con `BufferGeometryUtils`?** Depende de si se quiere evitar la dependencia de `three/addons/`.
3. **¿Input por parámetro o estado interno?** Recomendación: **por parámetro** (`Engine3D.update({ dirX, dirY, speed }, dt)`).

### 15.6 Criterio de salida (para desbloquear F3)

- [x] `Engine3D.update()` orquesta física sin que la demo toque funciones internas.
- [x] Tests de física vertical y `Engine3D.update` pasando.
- [x] Draw calls reducidos (merge por material).
- [x] Sin fugas de memoria GPU (`dispose` + `clear`).
- [x] Schema v2 eliminado; API pública mínima.
- [ ] La demo sigue jugable: portales, rampas, escaleras, sprites, paredes sólidas.
- [x] Triangulación robusta para sectores cóncavos.
- [x] Leer settings de project.json en Renderer3D.
- [x] Cache de texturas de color.
