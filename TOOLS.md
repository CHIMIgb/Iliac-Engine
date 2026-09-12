# TOOLS.md — Herramientas del Studio

Cómo funcionan las herramientas de edición de RayCast Studio. Documento de referencia: **las herramientas escriben datos (`project.json`), el motor los lee** — ninguna llamada va del motor al Studio.

- Ubicación del código: `studio/src/tools/` (lógica), `studio/src/viewport/` (pintado/picking), `engine/` (solo datos y render).
- Teclas 1–7 seleccionan herramienta; **tecla 8 = popover del Cielo**; **tecla 9 = popover de Audio (MVP: bucles de ambiente)**; `Delete` elimina la selección; el clic en vacío deja orbitar la cámara.

## Cámara del viewport

| Control | Acción |
|---|---|
| `W A S D` | Desplazar (pan) en el plano |
| `Q` / `E` | Bajar / subir la altura de cámara |
| Rueda | Zoom |
| Arrastre en vacío | Orbitar |
 | `Playtest` (toolbar) / `F5` | Primera persona (WASD + ratón capturado); `Tab` o `Playtest` de nuevo vuelven al editor |

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
- **Tamaño (m)**: 8–64, paso 0,5 (idea 2). Se muestra en vivo el nº de sectores (celdas²); aviso de peso ("pesado: sube la celda") pasado de 8192.
- **Celda (m)**: 0,5–2, paso 0,25, clampeada dentro de `placeTerrainAt` (idea 1). Celda grande = terreno más ligero y menos suave; pequeña = curva casi continua.
- **Fuerza (m/s)**: velocidad del pincel (0,1–20) — los metros que sube/baja el terreno POR SEGUNDO bajo el cursor. Frame-independiente (`velocidad·dt`).
- **Radio (m)**: tamaño del pincel (0,5–20) — solo los vértices a menos de `radio` del cursor se mueven.

Modos (botones): **Colocar / Elevar / Hundir**.

### Colocar (modo "Colocar")

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

## 8 · Cielo — telón Daggerfall O cielo realista día/noche (tecla 8)

El popover del Cielo tiene **dos pestañas: «Clásico» y «Realista»** (F4.7).

### Pestaña «Clásico» — telón Daggerfall (comportamiento histórico intacto)

`world.sky: { set: 0–30, frame?: 0–31, base?: '/sky/' }` (opcional; ausente = fondo de color).
- **`set`** = carpeta `SKY00–SKY30`: el **horizonte/escenario** (paisaje distinto en cada carpeta).
- **`frame`** = franja del día **0–31** dentro de esa carpeta (`0-{frame}.PNG` de la capa 0): cambia la iluminación/hora del mismo horizonte.

`engine/core/sky.js`: `SKY_SETS`, `SKY_FRAMES`, `skyFrameLabel()`.

**Cómo funciona (engine/three/SkySystem.js)** — telón 2D, NO skybox 3D (como el de 1996): una imagen plana siempre de frente a la cámara, fija al girar el yaw; `set` elige carpeta, `frame` la franja (independientes); Y-shear por UV (el horizonte se clava al borde inferior al levantar la vista); sin z-test, dibujado primero (renderOrder -3) → la geometría lo tapa.

**Assets no versionados:** `studio/` → `npm run setup:sky` (copia `assets/.../The Sky/` a `studio/public/sky/` y `demo/sky/`).

### Pestaña «Realista» — cielo 3D con sol, luna y sombras (F4.7)

`world.sky: { style: 'realista', hour?: 0–24, dayLengthSec?: >0, shadows?: bool, sunTilt?: 0–90, sunIntensity?: 0.1–3, moonIntensity?: 0–1, stars?: bool }`
- **`hour`** — hora del día (float); el slider del popover la mueve con etiqueta HH:MM.
- **`dayLengthSec`** — duración de un día solar completo en segundos; si está presente el reloj **avanza solo durante el playtest** (el editor queda fijo). Ausente/0 = hora manual.
- **`shadows`** — sombras del sol: `DirectionalLight.castShadow` con `shadowMap` PCF 2048, caja ortográfica de 60 m que sigue al jugador. Al apagarlas sube FPS.
- **`sunTilt`** — inclinación del eje de rotación (23.5° por defecto, como la eclíptica real).
- **`sunIntensity`** — multiplicador de la intensidad del sol (0.85 por defecto = un poco atenuado sobre la curva base; 0.1–3 en el slider).
- **`moonIntensity`** — luz lunar nocturna 0–1 (0.55 por defecto). La luna (anti-solar) tiene su propia `DirectionalLight` fría, sin sombras, que solo ilumina de noche.
- **`stars`** — true = estrellas visibles de noche (default true).

**Cómo funciona (F4.7):**
- `engine/core/daylight.js` (lógica pura, sin Three): `sunDirection`/`moonDirection` (la luna es el anti-sol), `paletteFor` (curvas de color/intensidad de sol, ambiente, cielo y **niebla**), `advanceHour` (día solar), `hourLabel`.
- `engine/three/SunSystem.js`: shader atmosférico oficial de Three (`three/addons/objects/Sky.js`) → atardeceres por dispersión Rayleigh; discos de **sol y luna** visibles (sprites opacos con alphaTest, `depthTest:false` + `renderOrder` negativo → se pintan DETRÁS del mundo: nunca se cuelan en interiores); **estrellas** (Points que se encienden de noche); dos `DirectionalLight` (sol con sombras + luna nocturna) + `HemisphereLight`.
- Interiores: si el sector del jugador tiene techo real (`ceilTex !== 'sky'`) el sol baja a ×0.25 y el ambiente sube — Daggerfall-style, sin lightmapping.
- `Engine3D._setupSun()` (firma por `sunSignature`); el reloj avanza en `update()`; **los ajustes sol/luna/estrellas se aplican EN CALIENTE vía `setWorld`** (sin reconstruir el sistema); `Renderer3D` activa/desactiva sombras y tiñe la niebla con la hora.

**UI (tecla 8):** pestaña Realista = slider **Hora 0–24** (+ HH:MM), select **Avance del día** (Fijo / 10′ / 20′ / 60′), checkbox **Sombras del sol**, input **Inclinación solar (0–90°)**, slider **Intensidad del sol (×0.1–3)**, slider **Luz de la luna (0–100%)**, checkbox **Estrellas de noche**. Todo escribe `doc.setSky`. Cambiar de pestaña conserva los datos del otro estilo.

> **Retirado:** la herramienta «Pantalla» (tecla 9, resolución interna del playtest) y el efecto CRT existieron y se eliminaron por decisión del usuario: el editor vuelve a render nativo a pantalla completa. La tecla **9** se reasignó a Audio.

---

## 9 · Audio — herramienta de sonido (tecla 9)

Escribe `project.audio[]` y `project.music`. **MVP actual: solo AMBIENTE** (bucles `bus:'ambience'`, `loop:true`). Música, NPC y acciones quedan **documentados y pendientes de editor** (el motor ya los consume de datos: `layers` para stems, `spatial.follow` para bucles de NPC, `variations` para SFX).

**Popover** (icono `volume-2`): lista de ambientes, cada uno con `archivo ▾ · volumen · Probar · ×`; botón «+ Añadir ambiente».

- **Archivos sugeridos** = `fetch('/audio/manifest.json)` (dato que emite `npm run setup:audio`); si no existe el manifiesto, la ruta se escribe a mano. **Nada hardcodeado en el TS** (regla de no hardcodear).
- **Preview**: «Probar» instancia un `AudioEngine` efímero del motor y suena 3 s (el clic es el gesto que desbloquea el autoplay) → cero lógica de audio duplicada en el Studio.
- **Ciclo en playtest**: al entrar (`F5`/Playtest) `EditorViewport` llama `engine.resumeAudio()` → los `loop:true` arrancan en bucle; al salir, `engine.stopAudio()` (`AudioEngine.halt()`) los calla y el siguiente `resume()` los re-crea. Sin `audio[]` en el proyecto, todo es no-op (el audio es **opcional y nunca rompe el frame**).

Seters en `EditorState`: `addAudioDef` (id `audio_<n>` único) · `updateAudioDef` (fusión parcial) · `removeAudioDef` (si era la pista de `doc.music`, la retira) · `setMusic`. Todos `notify()` → reload → `Engine3D._setupAudio()` por firma.

---

## Por qué va fluido (arquitectura del reload en vivo)

`notify()` de cualquier mutación → `main.ts` dispara reload con **throttle** (`reloadMs()`: 120 ms normal, 250 ms con mundos >40k sectores; no debounce puro: el pincel muta cada frame y un debounce hambriento nunca dispara) → `EditorViewport.reload()` → `Engine3D.setWorld(project)`:

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
| Cielo clásico (telón) y realista (día/noche): sun/moon/niebla | `engine/core/sky.js`, `engine/three/SkySystem.js`, `engine/core/daylight.js`, `engine/three/SunSystem.js` |
| Toolbar/atajos 1–7 + teclas 8 (Cielo) y 9 (Audio) + throttle de reload | `studio/src/main.ts` |
| Motor de audio (Web Audio: buses, espacial, ducking, loops) | `engine/core/audio.js`, `engine/core/music.js` |
| Motor: alturas por vértice, BVH, mallas, slots y vía rápida | `engine/core/sector.js`, `engine/three/WorldMesh.js`, `engine/Engine3D.js` |
