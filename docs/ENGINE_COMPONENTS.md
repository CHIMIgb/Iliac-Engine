# Componentes del motor RayCast Studio

> Documentación técnica de la capa `engine/` (motor de juego) en su estado actual. El motor es **JavaScript vanilla puro**, sin build, sin TypeScript y sin dependencias de UI. Solo expone una API pública de ESModules.

## 1. Arquitectura general

El motor sigue una arquitectura de **dos capas desacopladas** definida en `ROADMAP.md` §13:

- **`engine/` — Motor del juego**: JS vanilla puro. Contiene toda la lógica de juego (matemáticas, física, sectores) y todo lo que toca Three.js/WebGL (render, mallas, materiales).
- **Studio (`studio/`) — Consumidor y creador**: TypeScript + Vite. Importa el motor (bridge de tipos `engine.d.ts`), escribe/edita un `project.json` (schema v3) y lo ejecuta en playtest (F5). La antigua carpeta `demo/` se eliminó en 2026-09-16; el motor se valida con el playtest del Studio y `test/engine/`.
- **Backend (`server/`) — Persistencia**: Node + Hono + Prisma + PostgreSQL. Guarda `project.json` (JSONB) y blobs de assets; valida con el mismo `validateProject` del contrato.

El contrato entre capas es únicamente **`project.json`**. Las herramientas escriben datos; el motor los lee y renderiza. Nunca se duplica lógica de motor en la UI ni viceversa.

### Separación de responsabilidades dentro de `engine/`

```
engine/
├── Engine3D.js          # Orquestación: ciclo de vida, carga, update, render
├── index.js             # API pública: qué se exporta al consumidor
├── core/                # Lógica de juego pura, SIN Three.js
│   ├── math.js          # Utilidades matemáticas
│   ├── player.js        # Entidad jugador (posición, orientación, getters)
│   ├── physics.js       # Física: movimiento + gravedad (v3)
│   ├── sector.js        # Geometría sectorial: point-in-polygon, alturas, índices, BVH
│   ├── stairs.js        # Altura y geometría de escaleras de peldaños
│   ├── anims.js         # Animación de sprites por frames (fps/loop, puro)
│   ├── noise.js         # Ruido Simplex 2D + FBM reproducible
│   ├── terrain.js       # Generador procedural de terreno por sectores
│   ├── validate.js      # Validador ligero de project.json (schema v3)
│   ├── triangulate.js   # Ear-clipping para triangulación de polígonos cóncavos
│   ├── sky.js           # Lógica del cielo clásico Daggerfall (sets 0–30 × 32 franjas)
│   ├── daylight.js      # Lógica pura del ciclo día/noche realista (sol/luna/paleta)
│   ├── audio.js         # AudioEngine (Web Audio API): buses, dB, SFX, ducking
│   └── music.js         # Música adaptativa por layering (AdaptiveMusic)
└── three/               # Todo lo que toca Three.js/WebGL
    ├── Renderer3D.js    # Escena, cámara, luces, render loop (configurable vía project.render)
    ├── WorldMesh.js     # Construye la escena 3D desde project.json (merge por material)
    ├── SectorGeometry.js# Geometría de suelos, techos y paredes poligonales (usa triangulate.js)
    ├── GeometryMerge.js # Merge de BufferGeometries para reducir draw calls
    ├── StairsMesh.js    # Geometría de escaleras de peldaños
    ├── SpriteSystem.js  # Sprites billboard (aplica anims.js al material)
    ├── textures.js      # Carga de texturas (Promise.all, NearestFilter), cache de color, materiales
    ├── SkySystem.js     # Cielo clásico Daggerfall: telón 2D del horizonte (sets × franjas)
    ├── SunSystem.js     # Cielo realista: shader atmosférico, sol/luna, estrellas, aurora, sombras
    ├── fog.js           # Niebla atmosférica (THREE.FogExp2 desde render.fog)
    └── CompassOverlay.js# Brújula HUD (heading tape, DOM+CSS) — setCompass()
```

Regla: **nunca importar Three.js dentro de `core/`, ni poner lógica de juego dentro de `three/`**.

---

## 2. API pública (`engine/index.js`)

```js
export { Engine3D } from './Engine3D.js';
```

El punto de entrada público expone **solo la clase `Engine3D`**. Todos los demás módulos (`core/*`, `three/*`) son internos del motor; los tests los importan directamente, pero los consumidores (Studio) no deben depender de ellos.

---

## 3. Componentes del motor

### 3.1 `Engine3D.js` — Orquestador

Responsabilidad: ciclo de vida del motor. No implementa física ni render; delega en los módulos.

| Método | Descripción |
|--------|-------------|
| `constructor(project)` | Valida `project.json` (lanza error claro si es inválido), lee `project.camera` y `project.world`; crea el `Player`. En schema v3 construye y cachea el índice sectorial (`vertexMap`, `wallsBySector`, `solidWalls`). |
| `async load(canvas)` | Carga texturas, crea `Renderer3D`, `WorldMesh`, el cielo (`SkySystem` clásico o `SunSystem` realista según `world.sky.style`) y, si el proyecto declara `audio[]`, el `AudioEngine` + `AdaptiveMusic`. |
| `setWorld(project)` | Recarga en caliente (edición en vivo del Studio). Si solo cambió el mundo no recrea el renderer (camino barato); swap de cielo por JSON con mismo horizonte/franja se aplica sin recargar. |
| `update(input, dt)` | Orquesta la física de sectores poligonales. Capa `dt` a 50 ms para evitar inestabilidad. Llama a `moveWithSectorCollision` y `updateVerticalSector` pasándoles el índice sectorial cacheado. Avanza animaciones de sprites, el sonido espacial y el reloj solar (interiores —`ceilTex != 'sky'`— atenúan el sol). |
| `resumeAudio()` / `stopAudio()` | Gate del `AudioContext` por gesto del usuario (política autoplay). `stopAudio` también lo detiene al salir del playtest. |
| `setCompass(on, container?)` | Activa/desactiva la brújula HUD (heading tape de `CompassOverlay`). El Studio la ancla a su viewport en el playtest. |
| `render()` | Sincroniza la cámara del renderer con el jugador y renderiza. |
| `resize(width, height)` | Actualiza el tamaño del renderer y la relación de aspecto de la cámara. |
| `dispose()` | Limpia el `WorldMesh`, libera texturas y destruye el renderer. |

Campos de orquestación: `player`, `renderer`, `audio` (`AudioEngine`, null sin audio), `music` (`AdaptiveMusic`, null sin `music.layers`), `compass`, `spriteAnimator`, `sectorIndex`.

### 3.2 `core/math.js` — Utilidades matemáticas

- `PI2`: constante `Math.PI * 2`.
- `rotate(vx, vy, angle)`: rota un vector 2D.

### 3.3 `core/player.js` — Entidad jugador

Propiedades:
- `posX`, `posY`, `posZ`: posición en el mundo.
- `yaw`, `pitch`: orientación en radianes.
- `eyeHeight = 0.5`, `height = 1.8` (altura total de la cápsula), `stepHeight = 0.6`, `gravity = 9.0` (aceleración en u/s²), `velocityZ = 0` (velocidad vertical acumulada por la gravedad), `currentSector = null` (sector habitado, para `getSectorAtOrNearest`).

Getters:
- `forwardX/Y`, `rightX/Y`: vectores de dirección a partir del `yaw`.

Métodos:
- `rotateYaw(delta)`, `rotatePitch(delta)` (con clamp del pitch).

### 3.4 `core/physics.js` — Física

Schema v3 (sectores poligonales):
- `moveWithSectorCollision(player, world, dirX, dirY, speed, dt, radius=0.25, sectorIndex)`: movimiento con sub-steps (máx. 10) como vector único (X e Y simultáneos), colisión círculo-segmento contra paredes sólidas y **caras frontales de escaleras demasiado altas**. Si se le pasa `sectorIndex` (cacheado en `Engine3D`), evita reconstruirlo en cada frame.
- `updateVerticalSector(player, world, dt, sectorIndex)`: ajusta `posZ` según `getFloorHeightAt` + `getStairHeightAt`, sube escaleras automáticamente (`climbSpeed = 5.0`), aplica **gravedad acelerada** (`velocityZ += gravity * dt`) y **colisiona con el techo** usando `getCeilHeightAt` y `player.height`. Acepta `sectorIndex` cacheado. Trackea `player.currentSector`.

### 3.5 `core/sector.js` — Geometría sectorial

Funciones principales:
- `buildSectorIndex(world)`: construye `vertexMap`, `wallsBySector` y `solidWalls`.
- `getSectorVertices(world, sector, vertexMap)`: resuelve vértices de un sector.
- `pointInPolygon(polygon, x, y)` / `pointInSector(world, sector, x, y)`: test de punto dentro de polígono (ray casting).
- `getSectorAt(world, x, y, vertexMap)`: devuelve el sector que contiene un punto (usa el índice BVH). Acepta `vertexMap` cacheado.
- `getSectorAtOrNearest(world, x, y, vertexMap, lastSector)`: si el punto queda fuera de todos los sectores, fallback al centroide más cercano **solo entre sectores adyacentes a `lastSector`** (el sector actual del jugador), evitando saltos a sectores no conectados. Acepta `vertexMap` cacheado.
- `getFloorHeightAt(world, sector, x, y, vertexMap)` / `getCeilHeightAt(world, sector, x, y, vertexMap)`: altura interpolada baricéntricamente (soporta `floorH`/`ceilH` como array de alturas por vértice o slope uniforme). Aceptan `vertexMap` cacheado.
- `getSolidWalls(world, sectorId)`: segmentos sólidos de un sector.
- `closestPointOnSegment(px, py, a, b)` / `distancePointToSegment(px, py, a, b)`: utilidades de proyección sobre segmentos.

### 3.6 `core/stairs.js` — Escaleras

- `getStairHeightAt(world, x, y)`: devuelve la altura del peldaño bajo el punto `(x,y)` o `null`.
- `getStairSegments(ramp)`: genera los segmentos de las caras frontales de cada peldaño (usado previamente para colisión horizontal, ahora deprecado en favor de ajuste vertical).

### 3.7 `core/noise.js` — Ruido procedural

- `createNoise(seed=0)`: instancia de Simplex noise 2D reproducible.
  - `simplex2(x, y)`: valor en `[-1, 1]`.
- `fbm2(noise, x, y, opts)`: Fractal Brownian Motion con `octaves`, `lacunarity`, `gain`, `frequency`, `amplitude`.

### 3.8 `core/terrain.js` — Generador de terreno

- `generateTerrain(options)`: produce `vertices`, `sectors` y `walls` compatibles con schema v3.
  - Parámetros: `cols`, `rows`, `cellSize`, `seed`, `noiseScale`, `heightScale`, `octaves`, `textures`, `slopeThresholds`, `ceilH`, `ceilTex`, `wallTex`.
  - Cada celda es un sector convexo de 4 vértices con `floorH` como array de alturas por vértice.
  - Asigna textura según pendiente (`flat`, `slope`, `steep`).
  - Genera paredes de borde sólidas y paredes internas como portales.
- `sectorSlopeAngle(heights, cellSize)`: ángulo máximo de pendiente de un sector cuadrilátero.

### 3.9 `three/Renderer3D.js` — Renderizador

Encapsula la escena Three.js:
- `PerspectiveCamera` (FOV/near/far configurables vía `project.render`, por defecto 75°/0.05/200).
- `WebGLRenderer`.
- `AmbientLight` + `DirectionalLight` (configurables vía `project.render`).
- Color de fondo configurable (`backgroundColor` en `project.render`).
- `syncCamera(player)`: convierte la posición del motor (`X,Y` plano, `Z` altura) al espacio de Three.js (`X,Y,Z` con Y arriba).
- `render()`: dibuja la escena. **No renderiza si el contexto WebGL está perdido**.
- Manejo de `webglcontextlost` / `webglcontextrestored`: hace `preventDefault` (permite restauración), marca `contextLost`, y al restaurarse recrea el `WebGLRenderer` y re-renderiza. El constructor acepta `options.createRenderer` (inyectable para tests).
- `project.render` acepta: `fov`, `near`, `far`, `backgroundColor`, `ambientLight` (color, intensity), `directionalLight` (color, intensity, position).

### 3.10 `three/WorldMesh.js` — Constructor del mundo

- `WorldMesh.build(scene, project, textures)`: construye el mundo schema v3 (`vertices` + `sectors`) o no hace nada si faltan.
- `WorldMesh.buildSectorWorld(scene, world, textures)`: para cada sector crea suelo, techo y paredes sólidas, **mergea geometrías por textura/material** para reducir draw calls, y luego añade escaleras y sprites.
- `WorldMesh.clear(scene)`: limpia meshes y sprites anteriores, liberando geometrías y materiales.
- `WorldMesh.applyHeightsIfOnlyChange(scene, oldWorld, newWorld)`: vía rápida de edición en vivo del Studio — si SOLO cambiaron alturas de piso (`floorH`) de sectores con slot registrado, parchea los `y` del buffer mergeado y recalcula normales. Devuelve `false` (exige rebuild) si cambió la topología/posición XY de vértices o **cualquier sprite** (`anim`/`tex`/`scale`/`pos`): asignar una animación a una entidad debe reconstruir el mundo para que `buildSprites` materialice el billboard (corrección 2026-09-18).

### 3.11 `three/GeometryMerge.js` — Merge de geometrías

- `mergeGeometries(geometries)`: combina un array de `BufferGeometry` indexadas en una sola, asumiendo atributos `position` y `uv` compatibles. Usado por `WorldMesh` para reducir draw calls.

### 3.12 `three/SectorGeometry.js` — Geometría poligonal

- `createSectorFloorGeometry(world, sector, vertexMap)`: `BufferGeometry` del suelo usando **ear-clipping** (`triangulate.js`), soporta alturas por vértice y slopes. Acepta `vertexMap` cacheado.
- `createSectorCeilingGeometry(world, sector, vertexMap)`: igual que el suelo pero con índices invertidos para que la normal apunte hacia abajo. Acepta `vertexMap` cacheado.
- `createWallGeometry(wall, world, sector, vertexMap, vertexIndexMap)`: quad vertical entre los puntos `a` y `b`, desde `floorH` hasta `ceilH` (con slopes). Acepta `vertexMap` e índices de vértice cacheados para evitar `indexOf` por pared.
- **Soporta sectores cóncavos** gracias a la triangulación ear-clipping en `core/triangulate.js`.

### 3.13 `core/triangulate.js` — Triangulación ear-clipping

- `triangulate(points)`: algoritmo ear-clipping O(n²) para triangulación robusta de polígonos simples (convexos y cóncavos). Detecta winding (CW/CCW) y evita crear triángulos degenerados. Usado por `SectorGeometry.js` para suelos y techos.

### 3.14 `three/StairsMesh.js` — Escaleras visuales

- `buildStairsMeshes(scene, world, textures)`: para cada rampa de tipo `stairs` genera una caja por peldaño (`BoxGeometry`) con la textura indicada.

### 3.15 `three/SpriteSystem.js` — Sprites billboard

- `buildSprites(scene, world, textures)`: para cada sprite crea un `THREE.Sprite` siempre orientado a la cámara, con escala configurable. `sprite.pos.z` es la altura del **pie** (suelo): el billboard se dibuja apoyado, con el centro en `pos.z + scale/2` (misma disciplina que las cajas de colisión del editor).

### 3.16 `three/textures.js` — Texturas y materiales

- `loadTextures(textureDefs)`: carga texturas desde URL o genera texturas de color a partir de un hex. Usa `Promise.all` para carga paralela. Aplica `NearestFilter` + `SRGBColorSpace` una sola vez por textura tras la carga completa.
- `colorTexture(hex)`: textura plana de 64×64 generada en canvas. **Cache por hex** (Map module-level): el mismo hex reutiliza la misma instancia de `CanvasTexture`.
- `makeMaterial(textures, id, fallbackColor, side)`: material `MeshStandardMaterial` con la textura o color de fallback; fuerza filtro `NearestFilter` para estilo pixelado.

### 3.17 `core/validate.js` — Validador de `project.json`

- `validateProject(project)`: devuelve `{ valid, errors, warnings }`. Comprueba estructura esencial: `world.vertices`/`world.sectors` presentes y con elementos mínimos, vértices con `id`/`x`/`y`, sectores con `vertexIds` referenciando vértices existentes, paredes con `a`/`b`/`sectorFront` válidos, `world.sky` (clásico con set/frame o realista), `audio` (buses válidos, id únicos, `music.id` referenciando existencia), etc. `Engine3D` lo llama en el constructor y lanza un error claro si `valid` es `false`. El mismo validador lo usan el Studio (`Serializer`) y el Backend (`validateProjectData`).

### 3.18 `core/anims.js` — Animación de sprites

- `animFrameIndex(anim, elapsed)`: índice de frame para una animación `{ frames, fps?, loop? }` dado un tiempo acumulado (puro). `DEFAULT_FPS = 1`, `MIN_FPS = 0.0001`.
- `SpriteSystem` (three/) solo aplica el resultado cambiando el `map` del material.

### 3.19 `core/sky.js` — Cielo clásico Daggerfall (lógica pura)

- `SKY_SETS = 31`, `SKY_FRAMES = 32`: 31 horizontes × 32 franjas del día.
- `skyFrameLabel(frame)`: etiqueta "HH:MM" de la franja. `skySetForHour(hour)`, `skyHourForSet(set)`.
- El render lo hace `three/SkySystem.js`; esta capa solo decide set/frame.

### 3.20 `core/daylight.js` — Ciclo día/noche realista (lógica pura)

- `sunDirection(hour, tiltDeg=23.5)`: dirección unitaria del sol (órbita sobre XZ con inclinación eclíptica). `moonDirection` (anti-solar). `sunElevation`.
- `paletteFor(hour, ...)`: paleta de iluminación completa (color de luz, intensidades, niebla) por hora. `advanceHour(hour, dt, dayLengthSec)`: avanza el reloj de día (solo con `dayLengthSec > 0`). `hourLabel(hour)`.
- Quien la representa en 3D es `three/SunSystem.js`.

### 3.21 `core/audio.js` — Audio engine (Web Audio API)

- `AudioEngine` con buses `music|sfx|ambience|voice` → master → limiter. Volumen en dB (`linearToDb`/`dbToLinear`; `setBusVolume`), SFX one-shot con variación de pitch, loops simultáneos, sonido espacial (`PannerNode`, ejes mundo→Web Audio: X=x, Y=z, Z=y) y `duckMusic` (la música baja bajo la voz).
- **Opcional y a prueba de fallos:** si el navegador quirkéa, se marca `_dead`, se silencia con una warning y ningún frame se rompe. El `AudioContext` se construye con fábrica inyectable (`ctxFactory`) para testear sin navegador; nada suena hasta `resume()` (autoplay).

### 3.22 `core/music.js` — Música adaptativa por layering

- `AdaptiveMusic(engine, def)`: reproduce `src` + `layers` como N stems arrancados en el mismo instante del reloj de audio (sincronía garantizada por loop); la intensidad 0..N-1 **solo mueve ganancias** con fades (`setIntensity`), nunca reinicia fuentes → no se desincroniza.
- Helpers: `secondsPerBeat(bpm)`, `timeUntilNextBeat(posSec, spb)`, `levelFromIntensity(x, maxLevel)`.

### 3.23 `three/SkySystem.js` — Cielo clásico (telón 2D)

- Como el motor de 1996: el cielo NO es un skybox 3D, es una imagen plana que siempre mira a la cámara, anclada a la línea del horizonte. El `set` elige el horizonte (SKY00–30) y el `frame` la iluminación (0–31); son independientes.
- **Y-shear real** (la UV vertical se desplaza con el pitch) y el quad se dibuja primero del pase opaco sin depth (`depthTest:false, depthWrite:false`) para quedar siempre al fondo.
- API: `addTo(scene) / update(camera, set, frame) / dispose()`.

### 3.24 `three/SunSystem.js` — Cielo realista (F4.7)

- Alternativa moderna al telón clásico: shader atmosférico de Three (`three/addons/objects/Sky.js`, dispersión Rayleigh) + `DirectionalLight` de sol con **sombras PCF 2048** que se mueve con la hora (`daylight.js`), luna anti-solar, estrellas nocturnas (`Points`), **aurora boreal** (domo interior con GLSL procedural aditivo; color e intensidad configurables) con su propia luz direccional nocturna.
- `update(camera, hour, dt)` avanza la hora solo si `dayLengthSec > 0` (en el editor se queda fija; en playtest avanza). API simétrica a SkySystem: `addTo/update/dispose`.

### 3.25 `three/fog.js` — Niebla atmosférica

- `createFog(fogConfig, bgColor)`: traduce `render.fog = { color?, density? }` a `THREE.FogExp2`; sin config → `null` (render idéntico a antes). El color vacío hereda `backgroundColor` (fundido perfecto). Densidad por defecto `0.005`.

### 3.26 `three/CompassOverlay.js` — Brújula HUD

- Brújula de cinta horizontal (heading tape) en **DOM + CSS** (sin canvas): marcas cada 5° que se deslizan con `translateX(-rumbo × 4px)` y marcador central fijo. Activada por el consumidor con `engine.setCompass(true, container)` (la demo usa body; el Studio ancla al viewport del playtest).
- `headingDeg(yaw)`: convierte el yaw del motor (norte = -Z) al rumbo náutico 0–360 (exportada para tests).

---

## 4. Modelo de datos: `project.json` schema v3

El motor consume actualmente el schema v3 (sectores poligonales). Ejemplo mínimo:

```jsonc
{
  "meta": { "name": "Demo", "schemaVersion": 3, "renderMode": "3d" },
  "camera": { "posX": 3, "posY": 3, "posZ": 1, "yaw": -1.57, "pitch": 0 },
  "world": {
    "vertices": [ { "id": "v0", "x": 0, "y": 0 }, ... ],
    "sectors": [
      {
        "id": "s0",
        "vertexIds": ["v0", "v1", "v2", "v3"],
        "floorH": 0,
        "ceilH": 3,
        "floorTex": "stone",
        "ceilTex": "ceil",
        "wallTex": "wall"
      }
    ],
    "walls": [
      {
        "id": "w0",
        "a": "v0", "b": "v1",
        "sectorFront": "s0",
        "sectorBack": null,
        "tex": "wall"
      }
    ],
    "ramps": [
      { "id": "r0", "type": "stairs", "direction": { "x": 1, "y": 0 }, "rise": 2, "run": 2, "width": 4, "tex": "stone" }
    ],
    "sprites": [
      { "id": "tree", "tex": "tree", "pos": { "x": 5, "y": 5, "z": 0 }, "scale": 1.5 }
    ],
    "textures": {
      "stone": "assets/stone.svg",
      "wall": 0xcc0000
    },
    "spriteAnims": {
      "guard_idle": { "frames": ["guard_f0", "guard_f1", "guard_f2", "guard_f3"], "fps": 8, "loop": true }
    },
    "sky": { "style": "realista", "hour": 12.5, "dayLengthSec": 600, "shadows": true,
             "aurora": true, "auroraColor": "#a6e3a1" }
  },
  "audio": [
    { "id": "wind", "src": "assets/audio/wind.ogg", "bus": "ambience", "loop": true, "volume": 0.4 },
    { "id": "sfx_step", "src": "assets/audio/step.ogg", "bus": "sfx", "variations": ["assets/audio/step2.ogg"] },
    { "id": "boss_theme", "src": "assets/audio/boss_base.ogg", "bus": "music", "loop": true,
      "layers": ["assets/audio/boss_drums.ogg", "assets/audio/boss_tension.ogg"] }
  ],
  "music": { "id": "boss_theme", "intensity": 0, "bpm": 120 }
}
```

Características soportadas:
- Sectores convexos arbitrarios (lista de `vertexIds`).
- Pisos/techos planos o inclinados (`floorSlope`/`ceilSlope`).
- Pisos/techos con alturas por vértice (`floorH`/`ceilH` como array).
- Paredes sólidas y portales (`sectorBack` + `portal: true`).
- Escaleras de peldaños (`ramps[]` tipo `stairs`).
- Sprites billboard **con animación por frames** (`spriteAnims`).
- Texturas por URL o color hex.
- Cielo clásico Daggerfall (`sky = { set, frame }`) o realista (`sky = { style: "realista", hour, ... }` con sombras, estrellas y aurora).
- Audio Web Audio API: buses, SFX espacial y música adaptativa por layering (`audio[]` + `music`).

---

## 5. ¿Es buena base para seguir avanzando?

**Sí, pero con deuda técnica conocida.**

### Fortalezas
1. **Separación de capas clara**: motor puro vs. consumidores (Studio). El contrato por `project.json` es sólido.
2. **Sector system funcional**: point-in-polygon, portales, alturas por vértice, slopes y física continua círculo-segmento están implementados y testeados.
3. **Generación procedural**: `noise.js` + `terrain.js` permiten generar mundos exteriores automáticamente.
4. **Audio opcional y a prueba de fallos**: buses Web Audio, SFX espacial, música adaptativa por capas (F4.5) — el juego nunca se rompe si el navegador falla.
5. **Dos cielos**: telón clásico Daggerfall (`SkySystem`) y cielo realista con ciclo día/noche, sombras y aurora (`SunSystem`, F4.7).
6. **Tests**: 190 tests pasan cubriendo física, geometría, sectores, escaleras, ruido, terreno, UV repeat, animaciones, cielo y brújula.
7. **Render simple y funcional**: Three.js evita reinventar WebGL; el estilo pixelado se conserva con `NearestFilter`.

### Deuda técnica / limitaciones actuales
1. **Sprites sin culling ni sorting**: se dibujan todos, sin orden por profundidad.
2. **Código legacy v2 eliminado**: el runtime de schema v2 (`collision.js`, física tile-based y `WorldMesh.buildGridWorld`) ya no existe. Un migrador v2 → v3 es opción futura si aparecen proyectos antiguos.
3. **AI, quests, inventory, blueprints, etc.**: aún no existen; son fases futuras (F6+).

**Resueltas en deuda técnica (§16):**
- ✅ `Engine3D.update()` orquesta física v3 (C1).
- ✅ Sectores cóncavos soportados via ear-clipping (D.1, `core/triangulate.js`).
- ✅ Colisión con techo implementada (C6).
- ✅ Normales analíticas en superficies planas (H4).
- ✅ Índice espacial BVH para `getSectorAt` (prioridad media).
- ✅ `getSectorAtOrNearest` restringido a adyacentes (prioridad media).
- ✅ Gravedad acelerada por `velocityZ` (prioridad media).
- ✅ Validador de `project.json` (prioridad media).
- ✅ Manejo `webglcontextlost`/`restored` (prioridad media).
- ✅ Carga `Promise.all` + filtros una vez (H9).
- ✅ Cache de texturas de color (E.3).
- ✅ Settings de `project.render` en `Renderer3D` (E.1).

### Veredicto
La base es **sólida para continuar hacia el HITO** (demo vertical: motor + audio + sky + playtest del Studio). F1–F4.7 realizadas/validadas; la deuda técnica del motor (Fases A–E de §16) está **saldada**.

Siguiente paso crítico: **F5 — Asset Pipeline** (Asset Manager, Sprite Pipeline) y el **HITO demo funcional** (requiere F4 + F4.5).

---

## 6. ¿Se pueden modelar los mundos/sectores como indican las herramientas del roadmap?

**Sí.** El schema v3 del motor está diseñado exactamente para ser escrito por herramientas de edición:

- **Level Editor** del Studio (F6.5) podría crear `vertices`, `sectors`, `walls`, `ramps` y `sprites` arrastrando puntos en un canvas 2D top-down.
- **Asset Manager** (F6.4) podría poblar `world.textures` y `world.sprites`.
- El motor **solo lee** esos datos, por lo que cualquier herramienta que genere `project.json` v3 funcionará sin cambios en el motor.

### Qué falta del lado de herramientas
Actualmente el Studio (F3/F4) ya edita sectores, alturas, entidades y mazmorras; los consumidores escriben `project.json` v3. Para cumplir la visión completa del ROADMAP hace falta:
- Editor visual de sectores (vista top-down, arrastrar vértices, crear portales).
- Inspector de propiedades por sector (alturas, slopes, texturas).
- Previsualización 3D en tiempo real.
- Validador de schema v3 (paredes sin vértice, sectores no convexos, etc.).
- Migrador v2 → v3 y guardado/serializado de `project.json`.

### Nota sobre "modelar los motores"
Si la pregunta se refiere a si se pueden modelar **múltiples motores/renderers** (retro + 3d) como indica el roadmap: actualmente solo existe el motor 3D. El modo retro/raycaster Canvas fue eliminado deliberadamente para evitar duplicidad. Reintroducirlo requeriría un segundo renderer que consuma el mismo `project.json`, pero duplicaría lógica de render. La decisión actual (solo 3D) es coherente con el principio de no duplicar representaciones del mundo.

---

## 7. Tests

Ubicación: `test/engine/`

Comando:

```bash
node --test test/engine/*.test.js
```

Resultado actual: **190 tests pasan, 0 fallan** (27 archivos, `node --test test/engine/*.test.js`).

Cobertura:
- Física v3 (`physics-sector.test.js`, `physics-vertical.test.js`).
- Geometría sectorial (`sector-geometry.test.js`).
- Matemáticas de sectores (`sector.test.js`).
- Escaleras (`stairs.test.js`).
- Sprites (`sprites.test.js`, `stairs-sprites.test.js`).
- Animaciones de sprites (`anims.test.js`).
- Ruido y terreno (`noise.test.js`, `terrain.test.js`).
- Instanciación del motor (`engine3d.test.js`).
- Jugador (`player.test.js`).
- Texturas (`textures.test.js`).
- UV repeat (`sector-geometry.test.js`).
- Triangulación ear-clipping (`triangulate.test.js`).
- Cielo clásico (`sky.test.js`, `SkySystem.test.js`) y realista (`daylight.test.js`, `SunSystem.test.js`).
- Audio (`audio.test.js`, `music.test.js`) y brújula (`compass.test.js`).

---

## 8. Referencias

- `docs/ARCHITECTURA.md` — arquitectura del producto completo (todas las capas, flujo de datos).
- `docs/API_ENDPOINTS.md` — endpoints HTTP del backend documentados con ejemplos.
- `ROADMAP.md` §2 (decisiones técnicas: LiteGraph.js), §5 (schema `project.json`), §13 (arquitectura de capas), §14–§15 (fases F1–F13, HITO tras F4), §16 (deuda técnica saldada).
- `README.md`: visión de dos capas y modelo de datos.
- `AGENTS.md`: convenciones del proyecto.
- `DESIGN.md`: design system Catppuccin Mocha para Studio.
- `DATABASE.md`: esquema Prisma/PostgreSQL para backend.
