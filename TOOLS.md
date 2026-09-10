# TOOLS.md — Herramientas del Studio

Cómo funcionan las herramientas de edición de RayCast Studio. Documento de referencia: **las herramientas escriben datos (`project.json`), el motor los lee** — ninguna llamada va del motor al Studio.

- Ubicación del código: `studio/src/tools/` (lógica), `studio/src/viewport/` (pintado/picking), `engine/` (solo datos y render).
- Teclas 1–7 seleccionan herramienta; **tecla 8 = popover del Cielo** (no es herramienta de canvas); `Delete` elimina la selección; el clic en vacío deja orbitar la cámara.

## Cámara del viewport

| Control | Acción |
|---|---|
| `W A S D` | Desplazar (pan) en el plano |
| `Q` / `E` | Bajar / subir la altura de cámara |
| Rueda | Zoom |
| Arrastre en vacío | Orbitar |
| `F5` | Playtest (pendiente F6 — la toolbar lo avisa por toast) |

Undo/redo: **pendiente** (botón en toolbar, stack de snapshots ya preparado en `EditorState.snapshot()`).

---

## 1 · Seleccionar (tecla 1)

Clic para seleccionar vértices, paredes, sectores o sprites (hover = resaltado amarillo; selección visible). Con `Shift`, selección múltiple. Sin objetos: clic en vacío = cámara. `Delete` elimina lo seleccionado (las paredes de borde de un sector borrado se limpian con él).

## 2 · Vértices — dibujar sala (tecla 2)

Cada clic en el suelo coloca un punto (snap a la grilla de 1 m) y lo añade al polígono; clic sobre el **primer punto** con ≥3 vértices cierra la sala: se ordena el anillo, se crean las paredes de borde y, si otro sector comparte una arista, esa pared nace como **portal** (transitable). Clic en un vértice existente lo reutiliza en el trazado. El polígono en construcción se ve como línea con puntos.

## 3 · Mover (tecla 3)

Arrastre rígido de CUALQUIER cosa: vértice (él solo), pared (sus 2 extremos), sector (todo su polígono), sprite (por su posición). `Shift` suma objetos a la selección antes de arrastrar. Snap al grid durante el arrastre (delta sobre las posiciones originales, no acumulativo).

**Terrenos:** capturar cualquier vértice o celda de una colocación mueve **todos** los vértices de esa colocación (`collectTranslateTargets` detecta el namespace `terr_<gen>_`): el terreno se desplaza entero como una pieza.

## 4 · Paredes (tecla 4)

Clic en un vértice = extremo A; clic en otro = extremo B y se crea la pared. Requiere apoyo: el punto intermedio del clic debe estar dentro de un sector (`sectorFront`). Si dos sectores comparten la arista, se detecta sola como `sectorBack` (portal). No permite pared duplicada ni degenerate (A=B).

## 5 · Alturas (tecla 5)

Clic selecciona el sector bajo el cursor; la **rueda** ajusta alturas con paso 0,25 m:
- Rueda normal → **techo** (`ceilH`).
- `Shift` + rueda → **piso** (`floorH`).

Clamp: piso mínimo 2 m de hueco, techo máximo 60 m (`clampFloorCeil`). Solo sectores; **no usar con terrenos** (los sectores de terreno tienen `floorH` array — el pincel de la tecla 7 es su herramienta; pendiente el guard de la idea 5b).

## 6 · Entidades (tecla 6)

Al igual que Terreno, el icono abre un **picker** (categorías del catálogo `entityCatalog`). Con tipo activo, cada clic en el suelo coloca un sprite-entidad (textura del catálogo o `sprite_blue` si falta). Clic sobre una entidad existente la agarra para moverla (arrastre con snap).

---

## 7 · Terreno (tecla 7) — el sistema completo

El icono abre el **popover de Terreno** con cuatro parámetros y tres modos. Estado: `ToolManager.{activeTerrainSize, terrainCell, brushSpeed, brushRadius, terrainMode}`.

### Formato de los datos

Un terreno es una **grilla de celdas de `cell` metros que comparten vértices**, cada celda es un sector con `floorH` como array de 4 alturas (por vértice) — el mismo formato que `engine/core/terrain.js`. `ceilH: 50` (cielo alto), sin paredes, `floorTex: grass`.

Ids con namespace por colocación (la idea 4 garantiza que nunca se solapan):
- vértices `terr_<gen>_v{col}_{fila}`, sectores `terr_<gen>_s{col}_{fila}`
- `<gen>` viene del primer vértice generado → único por colocación.
- El prefijo `terr_` es lo que usan pincel, oclusión, adyacencia y Mover para distinguir terreno de salas/mazmorras.

Parámetros del popover:
- **Tamaño (m)**: 8–64, paso 0,5 (idea 2). Se muestra en vivo el nº de sectores (celdas²); aviso `⚠` pasado de 8192.
- **Celda (m)**: 0,5–2, paso 0,25, clampeada dentro de `placeTerrainAt` (idea 1). Celda grande = terreno más ligero y menos suave; pequeña = curva casi continua.
- **Fuerza (m/s)**: velocidad del pincel (0,1–20) — los metros que sube/baja el terreno POR SEGUNDO bajo el cursor. Frame-independiente (`velocidad·dt`).
- **Radio (m)**: tamaño del pincel (0,5–20) — solo los vértices a menos de `radio` del cursor se mueven.

Modos (botones): **⬜ Colocar** / **⬆ Elevar** / **⬇ Hundir**.

### Colocar (modo ⬜)

Clic en la grilla: `resolveTerrainPlacement()` comprueba las huellas rectangulares de los terrenos existentes (`terrainFootprints`); si solaparía, **desliza el terreno al borde más cercano al clic** (pegado, nunca encima; hasta 8 saltos; toast "Colocado ADYACENTE"). Sin lado libre → no coloca y avisa. El suelo nace elevado a la base del sector bajo el clic (0 si es vacío).

### Moldear (⬆ / ⬇) — el pincel

1. **Clic** sobre un terreno (`findSectorAt` cae en una celda `terr_*`) → inicia `moldearGrab` con la **dirección fija del modo** (Elevar SIEMPRE sube, Hundir SIEMPRE baja; mover el ratón no invierte nada). Sin salto instantáneo.
2. **Cada frame**, el viewport llama a `ToolManager.update(dt, ctx)` → `sculptTerrainAt(state, cursorX, cursorZ, ±Fuerza·dt, Radio)`:
   - para cada vértice de terreno dentro del radio, `altura += delta·falloff` con decaimiento cosenoidal (1 en el centro → 0 en el borde);
   - cada vértice compartido se escribe con el MISMO valor en las hasta 4 celdas que lo referencian → malla estanca, sin grietas;
   - clamp por vértice (`clampFloorCeil`); fuera del radio nada cambia.
3. **Mover el ratón** desplaza el centro del pincel; sueltas (`onPointerUp`) → se apaga.
4. La statusbar muestra en vivo la altura del vértice más cercano al cursor (`Terreno: X m`).

### Vértices solo-visibles

`hiddenTerrainVertices()` oculta en overlay y picking **todos los vértices interiores** de cada grilla: el editor solo marca las **4 esquinas** de cada terreno (los interiores existen para el pincel). Los terrenos además no interfieren con el resto de herramientas.

---

## 8 · Cielo — horizonte lejano estilo Daggerfall (tecla 8)

`world.sky: { set: 0–30, stride?: 1|2, base?: '/sky/' }` (opcional; ausente = fondo de color, comportamiento histórico). Cada **set** es un horizonte distinto (hora del día/tempo de Daggerfall: SKY00–SKY30).

**Formato de assets:** 2 capas en paralaje (0 = lejana: montañas/nubes; 1 = cercana: silueta de bosque sobre el horizonte) × **32 fotogramas 512×220** — ventanas precalculadas de la panorámica: al girar se CAMBIA de fotograma (truco original de Daggerfall, sin costuras). Con `stride 2` solo se cargan los pares (14 MB→7 MB de VRAM, pasos de 22,5°).

**Cómo funciona (engine/three/SkySystem.js):**
- Dos cilindros parciales (~110° de arco) con `MeshBasicMaterial` sin luz, sin niebla, `depthTest:false`, `renderOrder −3/−2` y radio menor que el `far` de cámara: se pintan SIEMPRE detrás del mundo y **siguen a la cámara** cada frame (`Renderer3D.render → sky.update(camera)` — cubre orbit del editor y modo juego).
- Frame por capa: `skyFrameIndex(yaw)` con la cercana al 100 % y la lejana al 60 % + deriva lenta de nubes → paralaje.
- `Engine3D._loadSky` reacciona a cambios de `skySignature` en `setWorld`: cambiar de cielo no recrea el motor entero.

**Assets no versionados (copyright):** tras clonar, ejecutar en `studio/` → `npm run setup:sky` (copia `assets/.../The Sky/` a `studio/public/sky/` y `demo/sky/` con rutas limpias `SKYnn/{capa}-{frame}.PNG`). El demo trae `sky: { set: 15 }` de serie.

**UI:** tecla 8 o botón ☁ de la toolbar → «— Sin cielo — / SKY00…SKY30»; se ve al instante (el reload en vivo monta/desmonta el SkySystem).

---

## Por qué va fluido (arquitectura del reload en vivo)

`notify()` de cualquier mutación → `main.ts` dispara reload con **throttle** (`RELOAD_MS` 120 ms; no debounce puro: el pincel muta cada frame y un debounce hambriento nunca dispara) → `EditorViewport.reload()` → `Engine3D.setWorld(project)`:

1. `validateProject` (rechaza datos rotos, conserva el mundo anterior).
2. `WorldMesh.applyHeightsIfOnlyChange`: **vía rápida**. Si solo cambiaron alturas de piso de sectores con slot registrado (mismos ids/orden/vértices-XZ, sin paredes afectadas), parchea los `y` en el `BufferAttribute` mergeado + `computeVertexNormals()` + `needsUpdate` → la GPU recibe un `bufferSubData`. Nada se recrea. (~25 ms por pasada en 32 m; ~0 en 8 m).
3. Si no (topología, Mover, salas, sprites…): `WorldMesh.build` completo — `clear` reutilizando renderer y texturas.

Costes por reload a 32 m: clonar 23 ms · validar 20 ms · índice BVH 48 ms · geometría 25 ms (vía rápida).

**Limitaciones conocidas:**
- El `ceilH` fijo de 50 m genera el "techo" gris sobre cada terreno (propuesta de fix: campo `noCeil` — idea 5, pendiente).
- Texturas nuevas solo se cargan en un reload completo del viewport (el camino barato las reutiliza).
- El pincel emite un `setFloorHeight` (notify) por celda tocada; el throttle lo amortigua — batching por frame pendiente si llegara a molestar.
- Undo no captura todavía los trazos de pincel como una sola acción.

## Dónde está cada cosa

| Pieza | Archivo |
|---|---|
| Lógica pura de herramientas (crear, mover, cerrar sala, terrenos, pincel, adyacencia) | `studio/src/tools/tools.ts` |
| Máquina de estados de la herramienta activa (clics, arrastre, pincel por frame, popover) | `studio/src/tools/ToolManager.ts` |
| Picking geométrico (proyecciones, puntos-en-polígono, clamps) | `studio/src/tools/picking.ts` |
| Datos del documento y mutaciones + `notify()` | `studio/src/editor/EditorState.ts` |
| Picking con cámara + bucle de render + reload | `studio/src/viewport/EditorViewport.ts` |
| Gizmos del editor (puntos, líneas, selección) | `studio/src/viewport/Overlay2D.ts` |
| Toolbar/atajos 1–7 + throttle de reload | `studio/src/main.ts` |
| Motor: alturas por vértice, BVH, mallas, slots y vía rápida | `engine/core/sector.js`, `engine/three/WorldMesh.js`, `engine/Engine3D.js` |
