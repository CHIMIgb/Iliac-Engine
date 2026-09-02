# Componentes del motor RayCast Studio

> Documentación técnica de la capa `engine/` (motor de juego) en su estado actual. El motor es **JavaScript vanilla puro**, sin build, sin TypeScript y sin dependencias de UI. Solo expone una API pública de ESModules.

## 1. Arquitectura general

El motor sigue una arquitectura de **dos capas desacopladas** definida en `ROADMAP.md` §13:

- **`engine/` — Motor del juego**: JS vanilla puro. Contiene toda la lógica de juego (matemáticas, física, sectores) y todo lo que toca Three.js/WebGL (render, mallas, materiales).
- **`demo/` — Consumidor de ejemplo**: importa el motor, define un `project.json` (schema v3) y ejecuta el loop de juego.
- **`studio/` — Herramientas de creación** (visión futura): TypeScript + Vite. Será otro consumidor que escribe `project.json` y se lo pasa al motor.

El contrato entre capas es únicamente **`project.json`**. Las herramientas escriben datos; el motor los lee y renderiza. Nunca se duplica lógica de motor en la UI ni viceversa.

### Separación de responsabilidades dentro de `engine/`

```
engine/
├── Engine3D.js          # Orquestación: ciclo de vida, carga, update, render
├── index.js             # API pública: qué se exporta al consumidor
├── core/                # Lógica de juego pura, SIN Three.js
│   ├── math.js          # Utilidades matemáticas
│   ├── player.js        # Entidad jugador (posición, orientación, getters)
│   ├── collision.js     # Colisión tile-based legacy (schema v2)
│   ├── physics.js       # Física: movimiento + gravedad (v2 y v3)
│   ├── sector.js        # Geometría sectorial: point-in-polygon, alturas, índices
│   ├── stairs.js        # Altura y geometría de escaleras de peldaños
│   ├── noise.js         # Ruido Simplex 2D + FBM reproducible
│   └── terrain.js       # Generador procedural de terreno por sectores
└── three/               # Todo lo que toca Three.js/WebGL
    ├── Renderer3D.js    # Escena, cámara, luces, render loop
    ├── WorldMesh.js     # Construye la escena 3D desde project.json
    ├── SectorGeometry.js# Geometría de suelos, techos y paredes poligonales
    ├── StairsMesh.js    # Geometría de escaleras de peldaños
    ├── SpriteSystem.js  # Sprites billboard
    └── textures.js      # Carga de texturas y creación de materiales
```

Regla: **nunca importar Three.js dentro de `core/`, ni poner lógica de juego dentro de `three/`**.

---

## 2. API pública (`engine/index.js`)

```js
export { Engine3D, Player, moveWithCollision, updateVertical } from './Engine3D.js';
export { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
export { Renderer3D } from './three/Renderer3D.js';
export { WorldMesh } from './three/WorldMesh.js';
export {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from './three/SectorGeometry.js';
export { buildStairsMeshes } from './three/StairsMesh.js';
export { buildSprites } from './three/SpriteSystem.js';
export { checkCollision } from './core/collision.js';
export * from './core/math.js';
export * from './core/sector.js';
export * from './core/noise.js';
export { generateTerrain, sectorSlopeAngle } from './core/terrain.js';
```

La API expone lo suficiente para que `demo/main.js` monte un juego sin tocar archivos internos del motor.

---

## 3. Componentes del motor

### 3.1 `Engine3D.js` — Orquestador

Responsabilidad: ciclo de vida del motor. No implementa física ni render; delega en los módulos.

| Método | Descripción |
|--------|-------------|
| `constructor(project)` | Lee `project.camera` y `project.world`; crea el `Player`. En schema v3 construye y cachea el índice sectorial (`vertexMap`, `wallsBySector`, `solidWalls`). |
| `async load(canvas)` | Carga texturas, crea `Renderer3D` y construye el `WorldMesh`. |
| `update(input, dt)` | Orquesta la física. Capa `dt` a 50 ms para evitar inestabilidad. En schema v3 llama a `moveWithSectorCollision` y `updateVerticalSector` pasándoles el índice cacheado. En schema v2 llama a `updateVertical`. |
| `render()` | Sincroniza la cámara del renderer con el jugador y renderiza. |

Exporta también `Player`, `moveWithCollision`, `updateVertical` por compatibilidad con consumidores legacy.

### 3.2 `core/math.js` — Utilidades matemáticas

- `PI2`: constante `Math.PI * 2`.
- `rotate(vx, vy, angle)`: rota un vector 2D.

### 3.3 `core/player.js` — Entidad jugador

Propiedades:
- `posX`, `posY`, `posZ`: posición en el mundo.
- `yaw`, `pitch`: orientación en radianes.
- `eyeHeight = 0.5`, `height = 1.8` (altura total de la cápsula), `stepHeight = 0.6`, `gravity = 9.0`.

Getters:
- `forwardX/Y`, `rightX/Y`: vectores de dirección a partir del `yaw`.

Métodos:
- `rotateYaw(delta)`, `rotatePitch(delta)` (con clamp del pitch).

### 3.4 `core/collision.js` — Colisión legacy (schema v2)

- `checkCollision(map, x, y)`: consulta si una celda del grid es sólida.
- `getSectorAt(sectorMap, x, y)`: devuelve el id de sector de una celda.

Usado por la física v2 tile-based. El schema v3 usa `core/sector.js` + `core/physics.js`.

### 3.5 `core/physics.js` — Física

Contiene dos sistemas de física:

#### Schema v2 (tile grid)
- `moveWithCollision(player, map, dirX, dirY, speed, dt, radius=0.2)`: movimiento con sub-steps y colisión contra celdas sólidas.
- `updateVertical(player, sectorMap, sectors, dt)`: ajusta `posZ` según `floorH` del sector actual (gravedad + subida por `stepHeight`).

#### Schema v3 (sectores poligonales)
- `moveWithSectorCollision(player, world, dirX, dirY, speed, dt, radius=0.25, sectorIndex)`: movimiento con sub-steps (máx. 10) como vector único (X e Y simultáneos), colisión círculo-segmento contra todas las paredes sólidas del mundo y vector de deslizamiento. Si se le pasa `sectorIndex` (cacheado en `Engine3D`), evita reconstruirlo en cada frame.
- `updateVerticalSector(player, world, dt, sectorIndex)`: ajusta `posZ` según `getFloorHeightAt` + `getStairHeightAt`, sube escaleras automáticamente (`climbSpeed = 5.0`), aplica gravedad y **colisiona con el techo** usando `getCeilHeightAt` y `player.height`. Acepta `sectorIndex` cacheado.

### 3.6 `core/sector.js` — Geometría sectorial

Funciones principales:
- `buildSectorIndex(world)`: construye `vertexMap`, `wallsBySector` y `solidWalls`.
- `getSectorVertices(world, sector, vertexMap)`: resuelve vértices de un sector.
- `pointInPolygon(polygon, x, y)` / `pointInSector(world, sector, x, y)`: test de punto dentro de polígono (ray casting).
- `getSectorAt(world, x, y, vertexMap)`: devuelve el sector que contiene un punto. Acepta `vertexMap` cacheado.
- `getSectorAtOrNearest(world, x, y, vertexMap)`: fallback al centroide más cercano si el punto queda fuera. Acepta `vertexMap` cacheado.
- `getFloorHeightAt(world, sector, x, y, vertexMap)` / `getCeilHeightAt(world, sector, x, y, vertexMap)`: altura interpolada baricéntricamente (soporta `floorH`/`ceilH` como array de alturas por vértice o slope uniforme). Aceptan `vertexMap` cacheado.
- `getSolidWalls(world, sectorId)`: segmentos sólidos de un sector.
- `closestPointOnSegment(px, py, a, b)` / `distancePointToSegment(px, py, a, b)`: utilidades de proyección sobre segmentos.

### 3.7 `core/stairs.js` — Escaleras

- `getStairHeightAt(world, x, y)`: devuelve la altura del peldaño bajo el punto `(x,y)` o `null`.
- `getStairSegments(ramp)`: genera los segmentos de las caras frontales de cada peldaño (usado previamente para colisión horizontal, ahora deprecado en favor de ajuste vertical).

### 3.8 `core/noise.js` — Ruido procedural

- `createNoise(seed=0)`: instancia de Simplex noise 2D reproducible.
  - `simplex2(x, y)`: valor en `[-1, 1]`.
- `fbm2(noise, x, y, opts)`: Fractal Brownian Motion con `octaves`, `lacunarity`, `gain`, `frequency`, `amplitude`.

### 3.9 `core/terrain.js` — Generador de terreno

- `generateTerrain(options)`: produce `vertices`, `sectors` y `walls` compatibles con schema v3.
  - Parámetros: `cols`, `rows`, `cellSize`, `seed`, `noiseScale`, `heightScale`, `octaves`, `textures`, `slopeThresholds`, `ceilH`, `ceilTex`, `wallTex`.
  - Cada celda es un sector convexo de 4 vértices con `floorH` como array de alturas por vértice.
  - Asigna textura según pendiente (`flat`, `slope`, `steep`).
  - Genera paredes de borde sólidas y paredes internas como portales.
- `sectorSlopeAngle(heights, cellSize)`: ángulo máximo de pendiente de un sector cuadrilátero.

### 3.10 `three/Renderer3D.js` — Renderizador

Encapsula la escena Three.js:
- `PerspectiveCamera` (75° FOV, near 0.05, far 200).
- `WebGLRenderer`.
- `AmbientLight` + `DirectionalLight`.
- `syncCamera(player)`: convierte la posición del motor (`X,Y` plano, `Z` altura) al espacio de Three.js (`X,Y,Z` con Y arriba).
- `render()`: dibuja la escena.

### 3.11 `three/WorldMesh.js` — Constructor del mundo

- `WorldMesh.build(scene, project, textures)`: decide si el mundo es schema v3 (tiene `vertices` y `sectors`) o schema v2 (`map`/`sectorMap`) y delega.
- `WorldMesh.buildSectorWorld(scene, world, textures)`: para cada sector crea suelo, techo y paredes sólidas, **mergea geometrías por textura/material** para reducir draw calls, y luego añade escaleras y sprites.
- `WorldMesh.buildGridWorld(...)`: legacy, grid de cajas y planos (schema v2).
- `WorldMesh.clear(scene)`: limpia meshes y sprites anteriores, liberando geometrías y materiales.

### 3.12 `three/GeometryMerge.js` — Merge de geometrías

- `mergeGeometries(geometries)`: combina un array de `BufferGeometry` indexadas en una sola, asumiendo atributos `position` y `uv` compatibles. Usado por `WorldMesh` para reducir draw calls.

### 3.13 `three/SectorGeometry.js` — Geometría poligonal

- `createSectorFloorGeometry(world, sector)`: `BufferGeometry` del suelo por fan triangulation, soporta alturas por vértice y slopes.
- `createSectorCeilingGeometry(world, sector)`: igual que el suelo pero con índices invertidos para que la normal apunte hacia abajo.
- `createWallGeometry(wall, world, sector)`: quad vertical entre los puntos `a` y `b`, desde `floorH` hasta `ceilH` (con slopes).

**Limitación actual**: solo sectores convexos; la fan triangulation falla en cóncavos.

### 3.14 `three/StairsMesh.js` — Escaleras visuales

- `buildStairsMeshes(scene, world, textures)`: para cada rampa de tipo `stairs` genera una caja por peldaño (`BoxGeometry`) con la textura indicada.

### 3.15 `three/SpriteSystem.js` — Sprites billboard

- `buildSprites(scene, world, textures)`: para cada sprite crea un `THREE.Sprite` siempre orientado a la cámara, con escala configurable.

### 3.16 `three/textures.js` — Texturas y materiales

- `loadTextures(textureDefs)`: carga texturas desde URL o genera texturas de color a partir de un hex.
- `colorTexture(hex)`: textura plana de 64×64 generada en canvas.
- `makeMaterial(textures, id, fallbackColor, side)`: material `MeshStandardMaterial` con la textura o color de fallback; fuerza filtro `NearestFilter` para estilo pixelado.

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
    }
  }
}
```

Características soportadas:
- Sectores convexos arbitrarios (lista de `vertexIds`).
- Pisos/techos planos o inclinados (`floorSlope`/`ceilSlope`).
- Pisos/techos con alturas por vértice (`floorH`/`ceilH` como array).
- Paredes sólidas y portales (`sectorBack` + `portal: true`).
- Escaleras de peldaños (`ramps[]` tipo `stairs`).
- Sprites billboard.
- Texturas por URL o color hex.

---

## 5. ¿Es buena base para seguir avanzando?

**Sí, pero con deuda técnica conocida.**

### Fortalezas
1. **Separación de capas clara**: motor puro vs. demo vs. futuro Studio. El contrato por `project.json` es sólido.
2. **Sector system funcional**: point-in-polygon, portales, alturas por vértice, slopes y física continua círculo-segmento están implementados y testeados.
3. **Generación procedural**: `noise.js` + `terrain.js` permiten generar mundos exteriores automáticamente.
4. **Tests**: 53 tests pasan cubriendo física, geometría, sectores, escaleras, ruido y terreno.
5. **Render simple y funcional**: Three.js evita reinventar WebGL; el estilo pixelado se conserva con `NearestFilter`.

### Deuda técnica / limitaciones actuales
1. **`Engine3D.update()` no integra física v3**: la demo llama manualmente a `moveWithSectorCollision` y `updateVerticalSector`. El orquestador debería hacerlo.
2. **Solo sectores convexos**: los sectores cóncavos requieren triangulación más robusta (ear-clipping).
3. **Colisión vertical básica**: no hay colisión con techos; el jugador no puede chocar con un techo bajo.
4. **Falta migrador v2 → v3**: el schema v2 (grid) sigue vivo en `WorldMesh.buildGridWorld`; debería poder convertirse automáticamente a sectores.
5. **Sprites sin culling ni sorting**: se dibujan todos, sin orden por profundidad.
6. **Audio, AI, quests, inventory, etc.**: aún no existen; son fases futuras (F3+).

### Veredicto
La base es **sólida para continuar hacia F3+** (sistemas RPG, audio, visual scripting) porque el núcleo de mundo 3D sectorial ya funciona. Lo prioritario antes de añadir grandes sistemas es:
1. Integrar la física v3 en `Engine3D.update()`.
2. Soportar sectores cóncavos.
3. Añadir colisión con techos.
4. Eliminar o migrar el código legacy v2.

---

## 6. ¿Se pueden modelar los mundos/sectores como indican las herramientas del roadmap?

**Sí.** El schema v3 del motor está diseñado exactamente para ser escrito por herramientas de edición:

- **Level Editor** del Studio podría crear `vertices`, `sectors`, `walls`, `ramps` y `sprites` arrastrando puntos en un canvas 2D top-down.
- **Asset Manager** podría poblar `world.textures` y `world.sprites`.
- El motor **solo lee** esos datos, por lo que cualquier herramienta que genere `project.json` v3 funcionará sin cambios en el motor.

### Qué falta del lado de herramientas
Actualmente no existe `studio/`; la única forma de crear mundos es editar `demo/project.js` o generarlos con `generateTerrain()`. Para cumplir la visión del ROADMAP hace falta:
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

Resultado actual: **53 tests pasan, 0 fallan**.

Cobertura:
- Física v2 y v3 (`physics.test.js`, `physics-sector.test.js`).
- Geometría sectorial (`sector-geometry.test.js`).
- Matemáticas de sectores (`sector.test.js`).
- Escaleras (`stairs.test.js`).
- Sprites (`sprites.test.js`).
- Ruido y terreno (`noise.test.js`, `terrain.test.js`).
- Instanciación del motor (`engine.test.js`).

---

## 8. Referencias

- `ROADMAP.md` §2 (decisiones técnicas), §5 (schema `project.json`), §13 (arquitectura de capas), §14–§15 (fases F2–F3), F2.5 (motor de sectores poligonales).
- `README.md`: visión de dos capas y modelo de datos.
- `AGENTS.md`: convenciones del proyecto.
