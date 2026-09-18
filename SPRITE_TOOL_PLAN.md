# Plan: Sprite Tool — Slicer + Animator + Biblioteca de Sprites

> **Reescritura desde cero de la herramienta de sprites del Studio (F5 / ROADMAP 6.5).**
> Estado: **borrador para aprobación** — no se escribe código hasta que el usuario apruebe este plan.
>
> **C5c (2026-09-17):** este plan se escribió cuando la subida de frames vivía en el middleware de Vite (`POST /assets/sprites/upload`). Desde C5c el guardado real pasa por la API (`POST /api/assets`, sesión obligatoria, dedupe por hash) y el documento guarda la URL servida `/api/assets/<id>/file` (pública). El middleware de Vite quedó solo como servido estático de `assets/` (compatibilidad con rutas locales antiguas). Las referencias al middleware en este plan son históricas salvo donde se anota C5c explícitamente.

---

## 1. Ubicación en el ROADMAP

- **Fase:** F5 — *Asset Pipeline (Asset Manager, Sprite Pipeline)* → **⏳ Pendiente** (ROADMAP §12, línea 281).
- **Catálogo de herramientas (ROADMAP §6):**
  - **6.3** Asset Manager local (texturas, sprites, audio) — 🆕
  - **6.5** Sprite Pipeline simplificado (Slicer + Animator) — 🆕
    > *Objetivo:* cortar hojas de sprites en frames y definir animaciones (idle/walk/attack/death). *Flujo:* PNG → detectar grilla → recortar → nombrar animación → fps/loop → exportar frames + JSON.
- **Ruta crítica:** F5 es el **primer HITO** después de F4.7 (cielo realista, ✅ validada). F6 (Sistemas RPG) *depende* de F5. No hay trabajo posterior que bloquee.
- **Estado actual de lo que NO se toca (validado):**
  - Motor (`engine/three/SpriteSystem.js`): ya reproduce animaciones por frames y direcciones. **No se toca.**
  - Contrato `world.spriteAnims`: `{ [id]: { frames: string[], fps?, loop? } }` con validador que exige **≥2 texturas por animación** (`engine/core/validate.js`). **No se toca** — la herramienta debe cumplirlo.
  - Middleware de Vite `GET/POST /assets/sprites/` (sube y sirve PNGs). **No se toca.**
  - Conventiones de nombres `textureKeyFor`/`urlFor` (key `asset_f0`, URL `/assets/sprites/asset_f0.png`). **Se conservan** (ya las consume el middleware, son mínimas y no son "la herramienta").

### Qué significa "desde cero" aquí
Se **reescribe la herramienta del Studio** (UI + lógica del slicer/animator): el modal Assets de sprites, la detección de celdas por similitud (flood-fill de color), la segmentación por gaps, el recorte semiautomático y la asignación de animaciones. Ese código (`studio/src/ui/AssetManager.ts`, parte de `studio/src/editor/spritePipeline.ts`) se **sustituye** por una arquitectura nueva. Lo que era correcto se reutiliza; lo que era frágil se elimina.

---

## 2. Análisis de herramientas de referencia (lo que ofrecen)

### 2.1 The Spriters Toolkit — tools.spriters-resource.com
- Es la **mayor base de datos de rips de sprites** (hojas de juegos clásicos).
- No es una herramienta de corte: es repositorio + enlaces a utilidades de la comunidad.
- **Qué tomamos:** es la *fuente de hojas de prueba* ideal para validar el pipeline (rips reales, hojas irregulares, transparentes). Nada de código.

### 2.2 GDS — Spritesheet slicing & player (gamedeveloperstudio.com)
- **Solo modo grilla manual:** `cols × rows` + «¿últimos frames vacíos?» para recortar celdas vacías del final.
- Nombres de salida configurables (número al frente `01_sprite_walk.png` o al final `sprite_walk_01.png`).
- Escala de salida (%) y toggle de **antialias** (para pixel art hay que desactivarlo).
- **Preview integrada del corte:** líneas dibujadas + botones play/pause/stop **y slider de FPS** para probar LA ANIMACIÓN antes de exportar.
- Exporta frames individuales PNG.
- **Qué tomamos:**
  - Visualización en vivo de las líneas de corte con **numeración** de celdas.
  - *Trailing empty frames* (celdas vacías al final de la hoja se descartan).
  - **Preview animada con FPS** dentro del propio slicer (concepto "two in one").
  - Toggle de suavizado (image-rendering) para pixel art.
  - **Limitación detectada:** sin auto-detección → solo grilla. Nosotros sí la tendremos.

### 2.3 Spritesheet Generator — Sprite Sheet Splitter (spritesheetgenerator.online)
Es la referencia más completa para nuestro caso. Ofrece:
1. **Grid mode:** tamaño de celda en px **o** cols×rows — «the right mode for uniform sheets, which is most of them».
2. **Auto-detection:** «scans for islands of non-transparent pixels and boxes each one» — para hojas sin grilla uniforme. *Aviso clave: necesita transparencia real entre sprites; un fondo sólido es trabajo de grid mode* → **ese aviso lo incorporamos como UX**.
3. **Atlas file slicing:** lee TexturePacker JSON / Sparrow XML / Cocos2d plist (incluye frames rotados y trimmed). **→ lo marcamos fuera de alcance inicial (YAGNI)**.
4. **GIF frame extraction** → fuera de alcance inicial.
5. **Live preview no destructivo:** las líneas se mueven al cambiar números; el original nunca se modifica.
6. **Straight to editor:** los frames extraídos caen al editor donde se **reordenan**, corrigen o re-empaquetan.
7. **Pivoting/trim:** documenta que recortar a píxeles opacos rompe el *registro* entre frames (wobble en la animación); alinear los frames dentro de una celda común después arregla el tambaleo.
8. **Tilesets:** auto-detect NO sirve (tiles contiguos sin transparencia) → grilla obligatoria; avisar del gap de 1px con borde.
- **Qué tomamos:**
  - **Doble modo Auto / Grid** como eje central de la herramienta.
  - Live preview no destructivo + numeración.
  - Alerta contextual: «esto parece tileset / no hay transparencia → usa modo manual».
  - Trim opcional con toggle (off por defecto para preservar registro) + aviso de wobble.

### 2.4 Reddit r/gamemaker — "Tools to split spritesheets into single sprites"
- El thread recomienda (consenso comunitario):
  - **Leshy SpriteSheet Tool** (leshylabs.com/apps/sstool) — el estándar de facto gratuito: auto-detect por transparencia + grilla, remap/optimize/repack, export individual + ZIP + JSON/XML, todo client-side.
  - Aseprite / TexturePacker (comerciales), Shoebox, scripts Python+OpenCV (p.ej. `slicesheet`), PixelSlicer.
- **Qué tomamos:** la idea de **remap** (reordenar/eliminar sprites tras la detección) y el **orden de frames editable** (Las hojas no siempre están en orden temporal; el animador debe poder reordenar arrastrando). Todo client-side (ya lo somos).

### Tabla resumen: features por herramienta → decisión

| Feature | SpritersRes | GDS | SS-Generator | Leshy/Reddit | **Decisión** |
|---|---|---|---|---|---|
| Modo grilla manual (cols×rows / celda px) | — | ✅ | ✅ | ✅ | ✅ **Sí** (obligatorio) |
| Auto-detección por transparencia | — | ❌ | ✅ | ✅ | ✅ **Sí** (obligatorio, pedido) |
| Preview de corte en vivo + números | — | ✅ | ✅ | ✅ | ✅ **Sí** |
| Preview de animación con FPS | — | ✅ | ✅ | ✅ | ✅ **Sí** ("animator" integrado) |
| Celdas vacías finales (trailing empty) | — | ✅ | — | ~ | ✅ **Sí** (barato) |
| Reordenar frames tras cortar | — | — | ✅ | ✅ | ✅ **Sí** (clave para el animador) |
| Sprites ya recortados → animador | — | — | ~ | ~ | ✅ **Sí** (pedido: biblioteca) |
| Trim a píxeles opacos | — | — | ✅ | ✅ | ✅ **Sí, con toggle** (off por defecto) |
| Atlas JSON/Plist/XML | — | — | ✅ | ✅ | ❌ **No** (YAGNI; se añade si alguien lo pide) |
| GIF → frames | — | — | ✅ | — | ❌ **No** (YAGNI) |
| Escala de salida % | — | ✅ | ✅ | ✅ | ❌ **No** (el motor escala; no aporta) |
| Detección de «parece tileset» | — | — | ✅(doc) | — | ✅ **Sí** (aviso UX) |

---

## 3. Requisitos (del usuario)

1. **Sprite Splitter** con **dos modos**:
   - **Auto:** detectar automáticamente los sprites de la hoja (islas de píxeles no transparentes) y cortarlos.
   - **Manual:** controlar columnas/filas (o tamaño de celda) para adaptarse a la hoja, con líneas visibles en vivo.
2. **Sprite Animator:** combinar los frames recortados en secuencias con fps/loop y preview en vivo.
3. **Biblioteca de sprites ya recortados:** administrar PNG individuales (subir varios) para añadirlos **directo al animador** sin pasar por el slicer.
4. *(General del Studio)*: drag & drop, Design System (DESIGN.md), comentarios en español, tests, contrato `project.json` intacto.

---

## 4. Arquitectura propuesta

Mismo patrón del proyecto: **lógica pura testeable** (sin DOM) + **vista/envoltura** (canvas/UI). Todo nuevo bajo `studio/src/`:

```
studio/src/
├── spriteTool/
│   ├── detectSprites.ts      # Pura. Auto: componentes conexas por alpha → rects
│   ├── gridSlice.ts          # Pura. Manual: grilla cols×rows / cell px → rects
│   ├── frames.ts             # Pura. Recorte a canvas, trim, naming, orden
│   ├── animator.ts           # Pura. Línea de tiempo: anims {frames, fps, loop} + orden
│   ├── spriteToolUI.ts       # Vista. Modal/page Orquestador: 3 pasos (cargar→cortar→animar)
│   └── spriteToolUI.css      # Estilos con tokens de DESIGN.md
└── ui/
    └── AssetManager.ts       # SE SIMPLIFICA: solo biblioteca de assets (texturas/audio/sprites
                              #   individuales); los sprites viven en SpriteTool (botón en toolbar)
```

**Principios:**
- `detectSprites.ts`, `gridSlice.ts`, `frames.ts`, `animator.ts`: **funciones puras** — testables en `test/studio/spriteTool/*.test.ts` con vitest, sin jsdom.
- `spriteToolUI.ts`: toda la manipulación de canvas/UI; usa las funciones puras y la API de assets para guardar (**C5c**: `POST /api/assets`, el middleware `/assets/sprites/upload` ya no existe). Sin lógica de negocio.
- El **motor no se toca**: la salida es `world.textures` + `world.spriteAnims` (contrato ya validado).

### 4.1 Detección automática (`detectSprites.ts`)
1. Leer `imageData` de la hoja.
2. Marcar píxel "activo" si `alpha > umbral` (ej. 8/255).
3. **Componentes conexas 4-vecindad** (BFS/flood fill) → conjunto de píxeles por sprite.
4. Bounding box por componente → `Rect { x, y, w, h }` en píxeles de la hoja.
5. **Filtros configurables:**
   - `minPixels`: descartar ruido (ej. 4 px por defecto, editable).
   - `gapTolerance`: fusionar cajas separadas por menos de N px (sprites con huecos internos, p.ej. un anillo de pixel art — 4 vecindad rompe en diagonales; se fusionan cajas cuyo gap < tolerancia).
   - `maxSprites`: límite de seguridad (ej. 512) para no colgar el navegador.
6. **Orden row-major** (fila-mayor por su ventana) y numeración 0..n → estos índices son los IDs de frame iniciales; el usuario podrá reordenarlos en el animador.
7. Salida: `Rect[]`.

**Casos límite (con mensaje UX):**
- 0 componentes → «no hay transparencia: usa modo manual (tileset o fondo sólido)».
- Hoja con cajas que tocan los bordes → aviso (sprites recortados).
- Rendimiento: BFS en un `ImageData` de hasta ~2048×2048 es factible; se itera una vez y se usa `Int32Array` para marcar visitados.

### 4.2 Modo manual (`gridSlice.ts`)
- Entrada: `cols × rows` **o** `cellW × cellH` (el <input> sin usar se auto-rellena).
- `Rect[]` = celdas de la grilla; soporta `trailingEmpty` (quita las N últimas celdas vacías por alpha o las que el usuario marque).
- Ajuste fino **spacing** (hojas con borde/gap entre celdas) — resta la separación al tamaño de celda. Barato y resuelve el caso «tileset con borde de 1 px».
- Live preview: las líneas se redibujan en cada cambio de inputs (canvas overlay sobre la hoja + números de celda).

### 4.3 Recorte y frames (`frames.ts`)
- `renderFrames(sheet, rects, opts) → { key, dataUrl }[]`:
  - recorta cada rect a un `<canvas>` (sin escalado → sin pérdida),
  - `trim: boolean` (por defecto **false**): recorta a píxeles opacos; al activarlo se avisa del riesgo de wobble (pivot/distinto registro entre frames).
  - nombre por convención conservada: `key = textureKeyFor(assetId, idx)`, `url = urlFor(assetId, idx)`.
- `order/frames` reordenables (el animador edita el array de rects, no la hoja).

### 4.4 Animador (`animator.ts` + UI)
- Modelo: `SpriteAnimDef { name, frames: string[], fps, loop }` (exactamente el contrato del motor).
- UI (canvas grande + controles):
  - Lista de frames (thumbs 48px) en orden actual; **drag & drop para reordenar**.
  - Preview con **play/pause + slider FPS (1–30) + toggle loop** + "step" (frame a frame) — mismo concepto que GDS, reusando la lógica ya probada de `animFrameAt` (extraída a `frames.ts`/`animator.ts`, sin DOM).
  - Definir anim nombrada: nombre (idle/walk/attack/death por defecto, editable) + rango de frames (arrastrar selección o inputs start/count) + fps + loop.
  - Validaciones: **≥2 frames por anim** (contrato motor) — si el usuario define 1 solo frame, se duplica automáticamente con aviso (ya hay precedente).
- Al **Guardar**: sube los PNGs a la API (**C5c**: `POST /api/assets` tipo `sprite`, sesión obligatoria — antes middleware `/assets/sprites/upload`) y escribe `world.textures[key] = url` (`/api/assets/<id>/file`) + `world.spriteAnims[id] = def` vía `EditorState`. Aviso si algún upload falla.

### 4.5 Biblioteca de sprites recortados (tab "Sprites")
- Subida **múltiple** de PNG individuales (drag & drop o selector) → se procesan por `frames.ts` (sin slicer) → aparecen en la lista de frames disponibles del animador con id `sprite_<nombre>`.
- Vista en grid con hover (preview), quitar, renombrar.
- Feed directo al animador: se pueden arrastrar a cualquier animación o dejar sueltos (como `tex` directo de una entidad).

---

## 5. Flujo UX (3 pasos, un solo modal/page)

```
┌─────────────────────────────────────────────────────────────┐
│ Sprite Tool  ·  [1 Cargar]  [2 Cortar]  [3 Animar]  [Sprites] │
├─────────────────────────────────────────────────────────────┤
│ PASO 1 ─ Cargar                                              │
│   Drop zone: "Arrastra tu hoja PNG" (o seleccionar)          │
│   → se muestra la hoja + se elige Modo: Auto | Manual        │
│                                                                │
│ PASO 2 ─ Cortar (si viene de hoja)                            │
│   Auto:  preview de cajas detectadas + minPixels/gap sliders  │
│   Manual: cols × rows (o cell px), spacing, trailingEmpty     │
│   → líneas + números en vivo, no destructivo                  │
│   [Recortar → N frames]                                       │
│                                                                │
│ PASO 3 ─ Animar                                                │
│   Frames (thumbs, drag para reordenar)                         │
│   Preview: [▶/⏸] fps─── loop[✓] [step]                        │
│   Anims: idle/walk/attack/death (+nueva) con rango/fps/loop    │
│   [Guardar en el proyecto]  → textures + spriteAnims          │
│ TAB Biblioteca ─ sprites guardados + sus anims (ver §Fase D)  │  ⚠ actualizado 2026-09-15:
│   "Sprites" (sueltos) se ELIMINA; pasa a "Biblioteca" (ver Fase D) │  los sueltos viven en el Paso 3
└─────────────────────────────────────────────────────────────┘
```

- **Drag & drop** es el estándar del Studio: hoja al drop zone, frames al animador, PNGs a la biblioteca.
- **Entrada:** **botón propio en la toolbar** (decisión aprobada 1) — patrón `toolbar.addAction({ icon })` con Icon lucide; la Sprite Tool se abre como modal/page propia, sin tocar la tecla 0 (Assets).
- **No destructivo:** la hoja original nunca se modifica; "Recortar" solo produce frames en memoria hasta "Guardar".

---

## 6. Modelo de datos (contrato con el motor — sin cambios)

Salida al proyecto (vía `EditorState`):

```jsonc
// world.textures (aditivo)
"guard_f0": "/assets/sprites/guard_f0.png",
// ...
// world.spriteAnims (aditivo)
"spriteAnims": {
  "idle":   { "frames": ["guard_f0", "guard_f1"],        "fps": 4, "loop": true  },
  "walk":   { "frames": ["guard_f2", "guard_f3", "guard_f4", "guard_f5"], "fps": 8, "loop": true },
  "attack": { "frames": ["guard_f6", "guard_f6"],        "fps": 10, "loop": false },
  "death":  { "frames": ["guard_f7", "guard_f7"],        "fps": 6, "loop": false }
}
```

- **Nada nuevo en el schema.** El motor (SpriteSystem) ya lee esto.
- Los PNGs viven en `assets/sprites/` vía middleware (no versionado en git, igual que ahora).

---

## 7. Fases de implementación (con criterio de aceptación)

### Fase A — Slicer (auto + manual) con preview en vivo
- `detectSprites.ts` + `gridSlice.ts` + `frames.ts` + tests.
- Sprite Tool con **botón propio en la toolbar** (Icon lucide); Passo 1 (Cargar) y Paso 2 (Cortar) de la UI.
- **Aceptación:** el botón de la toolbar abre la Sprite Tool; subir una hoja real (p.ej. `demo_walk.png` o un rip de Daggerfall si el usuario lo importa) → auto-detect recorta los N sprites; modo manual con cols/rows/spacing/trailingEmpty recorta correctamente; las líneas se ven en vivo; cero cambios en el motor.

### Fase B — Animator
- `animator.ts` + UI Paso 3: reordenar frames, preview con fps/loop, definir anims, guardar.
- **Aceptación:** crear idle/walk/attack/death desde los frames; playtest (F5) muestra al guardia animado en la demo; validación del motor pasa (≥2 frames).

### Fase C — Biblioteca de sprites recortados + integración final
- Tab "Sprites": subida múltiple de PNG individuales → animador directo.
- **Añadido por solicitud del usuario (7d/7e/7f):**
  - Editor de frames por anim: **quitar frames** (mínimo 2) y **añadir frames de la hoja**
    que no estén ya en la anim (7d).
  - **Añadir frames desde archivo…** — PNG sueltos múltiples dentro del Paso 3, disponibles
    para cualquier anim, preservados al re-cortar (7e).
  - **Espejo de animaciones** — botón "Espejar anim" genera frames volteados
    (`{key}_mirror`) y la animación `{name}_mirror` (mismos fps/loop) para animar "hacia la
    izquierda" sin tocar el motor (7f).
- Limpieza del código viejo del slicer: **no aplica** — el Sprite Tool sustituyó desde el inicio la arquitectura planificada (`AssetManager.ts`/`spritePipeline.ts` nunca existieron).
- **Aceptación:** subir 3 PNG sueltos → arrastrarlos al animador → crear anim y guardar; espejar una anim y verla en playtest girando/atacando a la izquierda; la demo usa un sprite suelto como `tex` de entidad; `npm run studio:test` y `npm run studio:typecheck` verdes; ROADMAP §12 marca F5/6.5 parcialmente `realizada` por fases.

*Orden sugerido: A → (validación usuario) → B → (validación) → C → commit final.*
*(Desglose detallado de los sub-pasos: §12 más abajo.)*

---

## 8. Tests (obligatorios por regla del proyecto)

`test/studio/spriteTool/`:
- `detectSprites.test.ts`: hoja sintética con 3 sprites separados → 3 rects correctos; sprite con hueco interno (anillo) → 1 rect (gapTolerance); ruido < minPixels descartado; hoja sin transparencia → aviso/0 rects; orden row-major.
- `gridSlice.test.ts`: 4×2 → 8 rects; cell px auto-calculada; spacing resta borde; trailingEmpty elimina celdas vacías.
- `frames.test.ts`: recorte de un rect → dimensiones correctas; trim true → bounding box a opacos; trim false → celda completa; naming `textureKeyFor/urlFor`.
- `animator.test.ts`: anim con <2 frames se duplica; fps clamp; reordenar frames cambia el array sin tocar la hoja; guardado produce `textures` + `spriteAnims` válidas para `validateProject` del motor (carga real de `engine/core/validate.js`); **frameKeys mixtas (hoja + sueltos); `mirrorAnimName` y `buildMirroredAnim` (sufijo `_mirror`, mismos fps/loop, válido para `validateProject`)**
- `frames.test.ts` (extra, 7e/7f): `frameKeyFromFile` (sanitización) y `spritePath`; `mirrorPixelImage` (2×1 `[R,G]` → `[G,R]`, alfa preservado).
- Regresión: 181 tests actuales del Studio siguen pasando (solo se toca `AssetManager.ts` en Fase C).

---

## 9. Explícitamente NO (YAGNI)

- Atlas JSON/Sparrow XML/Plist (TexturePacker) — se añade si se pide.
- GIF → frames.
- Escala/reescalado de salida (el motor escala).
- Empaquetar frames de vuelta en hoja (repack).
- Recorte por "clic dibujando rectángulos a mano" (el drag del animador cubre el ajuste fino).
- Editor de píxeles (paleta, recolor).

---

## 10. Decisiones aprobadas (usuario, 2026-09-13)

1. **Punto de entrada:** **botón propio en la toolbar** (patrón `toolbar.addAction` + Icon lucide). La Sprite Tool se abre como modal/page propia; no ocupa la tecla 0.
2. **Asset id:** campo editable **"nombre del asset" en el Paso 1**, autocompletado con el nombre del archivo de la hoja (p.ej. `guard` → keys `guard_f0`…).
3. **Animaciones:** sí — **plantilla idle/walk/attack/death + anims libres** (crear/renombrar/eliminar animaciones personalizadas).
4. **AssetManager:** el Sprite Tool reemplazó desde el inicio a la biblioteca de assets planificada; `AssetManager.ts`/`spritePipeline.ts` jamás se crearon, así que no hay slicer viejo que limpiar en Fase C.
5. **Frames sueltos:** en esta iteración quedan **solo para el animador** (consumidos dentro de la Sprite Tool); NO se toca `entityCatalog` ni el Entity Builder (6.4, aparte).

### Nota: convivencia 2D en mundo 3D
Los sprites 2D conviven en un mundo 3D y se renderizan con **billboarding** (planos que siempre miran a cámara). Eso **ya lo resuelve el motor** (`engine/three/SpriteSystem.js`: sprites billboard con animación por frames) y la colocación la hará el Entity Builder (6.4). **La Sprite Tool no toca orientación/posición/escala 3D**: solo produce texturas recortadas + `world.spriteAnims`. Es un contrato de datos, y el render lo interpreta.

---

## 11. Cómo se verifica el plan en cada fase

- Comandos: `npm run studio:typecheck` · `npm run studio:test` · `npm run test:engine` (regresión del motor — deben seguir en verde, no se toca).
- Validación visual: subir una hoja real → cortar → animar → **F5 playtest** con el guardia animado en la demo (criterio explícito del HITO F5 en ROADMAP: *"Sprite animado importado y recortado aparece en la demo"*).
- Al terminar cada fase completada se marca en `ROADMAP.md` §12 como `realizada` (F5/6.5 parcial por fases) y se espera validación del usuario antes de pasar a la siguiente.

---

## 12. Desglose de ejecución paso a paso (acordado 2026-09-14)

> **Decisión clave antes de Fase B:** el motor **no consumía** `spriteAnims` todavía
> (`SpriteSystem.js` era estático: un sprite = una textura). El usuario aprobó la
> **Opción 1**: extensión mínima del motor para cumplir el HITO F5 ("sprite animado
> aparece en la demo"). El plan original asumía que el motor ya lo leía; se corrige aquí.

Cada paso = **commit propio** + **verificación verde** antes de pasar al siguiente.
El usuario valida cada paso cerrado; solo entonces se continúa.

### Sub-paso 6 — Motor consume `spriteAnims` (extensión mínima, atrás compatible)

**Contrato (sin cambios de schema):** `world.spriteAnims = { [id]: { frames: string[], fps?, loop? } }`
con **≥2 frames** que existen en `world.textures`. Un sprite animado lleva el campo
opcional `anim` (`sprite.anim = 'idle'`); **sin `anim` → comportamiento actual idéntico**.

#### 6a — Lógica pura de frames (`engine/core/anims.js`)
- [CREAR] `engine/core/anims.js` — sin Three.js, testeable aislado:
  - `animFrameIndex(anim, elapsed)` → índice de frame según `fps`/`loop`/fin de anim.
  - `loop:false` → se clampa al último frame al terminar (no reinicia).
  - `fps` por defecto (si falta) → 1. `frames.length` ≥ 1 siempre.
- [CREAR] `test/engine/anims.test.js` — node:test puro:
  - avance por fps (elapsed 0 → frame 0; `1/fps` → frame 1…)
  - loop:false se queda en el último frame
  - loop:true reinicia (wrap)
  - fps mínimo/clamp si aplica
- **Verificación 6a:** `npm run test:engine` con los nuevos tests en verde + regresión 162.

#### 6b — Render animado + orquestación + validación
- [MODIFICAR] `engine/three/SpriteSystem.js` — `buildSprites(scene, world, textures)`:
  - Sprite sin `anim` (o anim inexistente) → **exactamente igual que hoy** (compatibilidad).
  - Sprite con `anim` válida → un `THREE.Sprite` por entidad cuyo `material.map` cambia
    por frame; el animator mantiene `{ sprite, animDef, clock }` por entidad.
  - Devuelve un objeto `SpriteAnimator` con `update(dt)` (o `null` si no hay anims).
- [MODIFICAR] `engine/Engine3D.js` — solo orquestación (no implementa frames):
  - `this.spriteAnimator = null` en constructor.
  - En `load()` y `setWorld()`: capturar el animator de `WorldMesh.build(...)`.
  - En `update(dt)`: `this.spriteAnimator?.update(safeDt)`.
  - En `dispose()`: `this.spriteAnimator = null`.
- [MODIFICAR] `engine/core/validate.js` — reglas **aditivas** (atrás compatible):
  - `world.spriteAnims`: debe ser objeto; cada anim: `frames` array de ≥2 strings que
    **existen en `world.textures`**; `fps` número > 0 (si se declara); `loop` booleano.
  - Sprites con `anim` que no existe en `spriteAnims` → error.
- [CREAR/MODIFICAR] tests de validación: `spriteAnims` inválido da error (frames <2,
  frame inexistente, fps ≤ 0, anim de sprite inexistente); válido pasa.
- **Verificación 6b:** `npm run test:engine` verde + Studio 179 regresión. Playtest manual
  corto: un sprite con `anim` se ve animado en la demo/Studio; sin `anim` se ve estático.

### Sub-paso 7 — Fase B: Animator (Paso 3) + guardado en el proyecto

**Aceptación de Fase B (plan §7):** crear idle/walk/attack/death desde los frames;
playtest (F5) muestra al guardia animado en la demo; validación del motor pasa (≥2 frames).

#### 7a — Lógica pura del animator (`studio/src/spriteTool/animator.ts`)
- [CREAR] `studio/src/spriteTool/animator.ts` — sin canvas, testable en Node:
  - `defaultAnimTemplate(nFrames)` → reparte los frames en **idle/walk/attack/death**
    (idle 1º, walk siguientes, etc.); cada anim con duplicado si <2 frames.
  - `buildAnimDef(frames, fps, loop)` → `{ frames, fps, loop }` con **≥2** frames
    (duplica el único) y `fps` clamp 1–60.
  - `reorderFrames(frames, from, to)` → reordena sin tocar la hoja.
  - `buildSpriteAnims(anims)` → devuelve `{ textures, spriteAnims }` listos para guardar
    y **validados con `validateProject` real** (carga `engine/core/validate.js`).
- [CREAR] `studio/tests/spriteTool/animator.test.ts`:
  - template con 8 frames → idle/walk/attack/death con ≥2 frames y cobertura total.
  - anim con 1 frame → se duplica.
  - fps clamp (0 → 1, 999 → 60).
  - reorder mantiene los mismos keys, orden cambiado.
  - `buildSpriteAnims` → `validateProject` devuelve `valid:true`; versiones rotas
    (frames < 2, frame inexistente) → `valid:false`.
- **Verificación 7a:** `npm run studio:typecheck` + `npm run studio:test` (179 + nuevos).

#### 7b — UI Paso 3 «Animar» (`spriteToolUI.ts` + CSS)
- [MODIFICAR] `studio/src/spriteTool/spriteToolUI.ts`:
  - Activar la pestaña "3 · Animar" al tener frames.
  - Lista de frames con **drag & drop HTML5 nativo** (reordenar sin tocar la hoja).
  - **Preview ▶/⏸** (setInterval/requestAnimationFrame en el modal): slider `fps`,
    checkbox `loop`, botón **step** (frame a frame).
  - Lista de anims: plantilla idle/walk/attack/death precargada
    (`defaultAnimTemplate`), botón "＋ Nueva anim" (nombre libre), editar frames/`fps`/`loop`,
    eliminar anim.
  - Footer: botón "Guardar en el proyecto" (deshabilitado sin anims válidas).
- [MODIFICAR] `studio/src/style.css` — estilos del Paso 3 (frames draggables, preview,
  lista de anims) con tokens de DESIGN.md.
- **Verificación 7b:** typecheck + tests Studio 179 (regresión) verdes; manual visual
  del Paso 3 con `demo_walk.png`.

#### 7c — Guardado real + asignación al playtest
- [MODIFICAR] `studio/src/editor/EditorState.ts`:
  - `setWorldTextures(patch)` → fusiona en `world.textures` (notify).
  - `setSpriteAnims(anims)` → fusiona en `world.spriteAnims` (notify).
  - **No** toca `entityCatalog` (decisión 5 del plan).
- [MODIFICAR] `studio/src/main.ts` (wiring del guardado):
  - Al pulsar Guardar: por cada frame → `POST /api/assets`
    (C5c: multipart con sesión, el server detecta el MIME y deduplica por hash;
    antes era el middleware `/assets/sprites/upload`, ya eliminado — ver `assetApi.uploadSpriteFrames`).
  - `EditorState.setWorldTextures` + `setSpriteAnims` + toast success/error.
  - **Asignación al playtest (puente hasta 6.4):** menú "Asignar a sprite del mundo ▾"
    con los `world.sprites` del doc + botón "Asignar anim idle" → escribe `sprite.anim`
    en un sprite existente. El HITO "guardia animado en el playtest" se valida sin
    esperar al Entity Builder.
- [MODIFICAR] ROADMAP.md §12 → F5 marca **Fase B realizada** (falta C: biblioteca de
  PNGs individuales).
- **Verificación 7c:** typecheck + Studio tests verdes + motor regresión verde. Manual:
  F5 → Sprites → cargar `demo_walk.png` → Cortar → Animar → Guardar → asignar a un
  sprite → playtest F5 → **guardia animado**.

#### 7d — Editor de frames con añadir/quitar (solicitud del usuario)
- [MODIFICAR] `studio/src/spriteTool/spriteToolUI.ts` — Paso 3, editor de la anim activa:
  - **Quitar frame:** botón ✕ (lucide `x`) en cada thumb → splice de `frameIndices`.
    **Guardia:** no se puede bajar de 2 frames (el contrato del motor exige ≥2) —
    aviso toast, no se elimina.
  - **Añadir frame de la hoja:** fila "Añadir frame ►" con un `select` de los frames
    de la hoja (`cutFrames`) que NO están en la anim activa (label `key — WxH`) +
    botón Añadir → `push` al final (después se reordena con drag & drop). Si no hay
    disponibles: opción "— todos los frames ya están en la animación —".
  - *Ajuste UX (solicitud del usuario):* el select nativo no muestra imágenes → se
    sustituyó por un **menú desplegable con thumbs** (botón "Añadir frame" → panel con
    miniaturas numeradas 1‑based igual que al cortar la hoja, previsualización + click
    para añadir al final).
  - Sin cambios en `animator.ts` (reorderFrames sigue; buildAnimDef ya garantiza ≥2).
- **Verificación 7d:** typecheck + Studio (195) + motor (187) verdes; manual: quitar
  frames hasta el mínimo 2 y comprobar el aviso, añadir desde la hoja.

#### 7e — PNGs sueltos desde archivos — ▶ **en ejecución como Fase C** (decisión del usuario)
> El usuario validó 7f y ordenó continuar la Fase C "dividida en pasos pequeños".
> Desglose en curso (cada paso con commit propio + suite verde + validación):
>
> - **C1 — lógica pura ✅ (commit `ab3ce16`):**
>   - [CREAR] `frameKeyFromFile(assetId, fileName)` en `frames.ts` →
>     `{assetId}_{nombre_sanitizado_sin_ext}` (reutiliza `assetIdFromFileName`).
>   - [CREAR] `spritePath(key)` → `/assets/sprites/{key}.png`; `buildSpriteAnims`
>     pasa a usarla (centraliza la URL).
>   - Tests en `frames.test.ts` (2 nuevos): key limpia con espacios/acentos/rutas;
>     `spritePath` para keys de hoja, sueltas y espejadas.
> - **C2 — PNGs sueltos en el animador ✅ (en curso de validación):**
>   - [MODIFICAR] `spriteToolUI.ts`: botón "Añadir frames desde archivo…" (lucide
>     `image-plus`) → `<input type=file accept="image/png, image/webp" multiple>`; por
>     cada archivo: `PixelImage` → dataURL → `{ key: frameKeyFromFile(assetId, nombre),
>     dataUrl, w, h, pixel }`. Guardia: key duplicada → skip + toast.
>   - Se guardan en `this.looseFrames` (lista separada) que **sobrevive al re-cortar**
>     (Paso 2: `cutFramesFromSheet` la respeta; `loadFile` la vacía con hoja nueva).
>   - `allFrames()` = `[...cutFrames, ...looseFrames]` (getter) usado por
>     `renderAddFrameMenu`, la grilla del Paso 3, `initAnimsIfNeeded`, `addAnim`,
>     `goToAnimate`, `mirrorActiveAnim` (los espejados pasan a `looseFrames`) y
>     `handleSave` (que pasa `allFrames().map(f => f.key)` a `buildSpriteAnims`).
>   - `main.ts` NO cambia: el guardado ya sube cada key con su dataURL.
>   - Manual: subir 3 PNG sueltos → crear anim nueva → añadirlos → guardar → asignar
>     → playtest.
> - **C3 — pestaña "Sprites" + limpieza ✅ (Fase C cerrada, en curso de validación):**
>   - Pestaña "Sprites" (4ª tab): biblioteca visual de los `looseFrames` (grilla de
>     thumbs `w×h` + botón añadir archivos + click para añadir a la anim activa
>     como índice global `cutFrames.length + pos`).
>   - La tab se habilita al añadir sueltos y se deshabilita al cargar hoja nueva.
>   - **Limpieza no aplica:** `AssetManager.ts`/`spritePipeline.ts` del plan jamás
>     se crearon (git log vacío); el Sprite Tool nació con la arquitectura nueva
>     `spriteTool/`. No hay slicer viejo que eliminar.
>   - ROADMAP §12 → Fase C realizada.
>
> - **Fase D — Biblioteca (decidida por el usuario el 2026-09-15, a implementar mañana):**
>   - **La tab "Sprites" actual SE ELIMINA** y se sustituye por la tab **"Biblioteca"**
>     (STEPS[3] = 'Biblioteca'). Se eliminan `renderSpritesStep`, `spritesGrid` y su
>     wiring (habilitar/deshabilitar la tab en `addLooseFiles`/`loadFile`, click para añadir).
>   - **Los `looseFrames` se mantienen intactos internamente** (el Paso 3 los sigue
>     usando: botón "Añadir frames desde archivo…" y menú "Añadir frame"); solo cambia
>     el contenido de la pestaña.
>   - La pestaña es una **vista transversal de "guardado de cosas utilizadas"**:
>     lista los sprites que ya se guardaron en el proyecto (thumb real del frame +
>     `assetId`) y, por cada sprite, sus **animaciones guardadas** (nombre, fps, loop,
>     nº de frames, mini-thumbs de cada frame desde las texturas del proyecto).
>   - **2 acciones (y nada más; no editar anims aquí, eso vive en el Paso 3):**
>     1. **Reasignar** una anim guardada a otro sprite del mundo (reutiliza el puente
>        `onAssignSprite` del Paso 3).
>     2. **Cargar al animador** una anim guardada: reconstruye sus frames desde las
>        texturas guardadas (dataURL → `PixelImage`), los añade como `looseFrames`
>        (guardia de keys duplicadas), copia la anim en `animSpecs` y salta al Paso 3
>        para duplicarla/editarla.
>   - **Regla de la Biblioteca:** es LECTURA + las 2 acciones. No hay corte, no hay
>     animación, no hay preview de frames individuales, no hay drag & drop de frames,
>     no hay edición. Todo eso vive en los Pasos 1-3.
>   - **D1 — acceso al proyecto:** pasar a la Sprite Tool una snapshot de
>     `textures` + `spriteAnims` guardadas (revisar `EditorState`/`Serializer` en
>     `main.ts`; si no hay nada guardado → estado vacío con mensaje). La herramienta
>     recibe un nuevo callback/field opcional (p. ej. `onProjectSnapshot`).
>     ✅ **implementado 2026-09-16** — `getSpriteLibrarySnapshot()` en EditorState
>     (foto ligera con copia de `textures` + `spriteAnims`), `SpriteLibrarySnapshot`
>     en types.ts, campo `onProjectSnapshot` + `getProjectSnapshot()` en SpriteToolUI,
>     wiring en main.ts al abrir el modal, test en serializer.test.ts (211).
>     ✅ **validado por el usuario**.
>   - **D2 — sustituir la tab:** renombrar STEPS[3], borrar el Paso 4 de sueltos
>     (campos, `renderSpritesStep`, wiring) y dejar el esqueleto del Paso 4 Biblioteca.
>     ✅ **implementado 2026-09-16** — STEPS[3] = 'Biblioteca'; tab siempre habilitada
>     (solo lectura); eliminado Paso 4 de sueltos (spritesFileInput, constructor,
>     wiring en loadFile/addLooseFiles); `spritesGrid` → `libraryGrid`; esqueleto
>     `renderLibraryStep()` (estado vacío / contador). Typecheck + suite verde (211).
>     ✅ **validado por el usuario**.
>   - **D3 — vista:** `renderLibraryStep()`: cards por sprite guardado + anims con
>     mini-thumbs (frames desde `world.textures`).
>     ✅ **implementado 2026-09-16** — cards por animación guardada (nombre +
>     meta frames/fps/bucle + mini-thumbs 24px desde `world.textures`), estados
>     de Biblioteca (sin conexión / vacío / solo texturas), clase
>     `sprite-tool__library*` nueva, helper puro `visibleFrameKeys()` en
>     frames.ts con test (212). ✅ **validado por el usuario**.
>     **Mock (2026-09-16):** como aún no hay backend ni assets, `sample-project.ts`
>     ahora instala sprites mock (dataURLs SVG de color sólido: guard rojo, lobo,
>     poción) + anims `*_idle` y el guardián usa `guard_idle`, para que la
>     Biblioteca se vea poblada y se pueda validar. Test landscape actualizado.
>   - **D4 — reasignar:** por anim guardada, botón "Asignar a sprite…" → reutiliza
>     `onAssignSprite`/`spriteSelect` existente.
>     ✅ **implementado 2026-09-15** — fila de acción en cada card de la Biblioteca
>     (`renderLibraryAssignRow`): select de sprites del mundo (misma fuente que
>     `setWorldSprites` → `worldSpriteOptions`, sin duplicar datos ni lógica) +
>     botón «Asignar a sprite…» que llama al callback `onAssignSprite` ya conectado
>     por main.ts (→ `doc.assignSpriteAnim`, toasts de resultado incluidos); sin
>     sprites en el mundo → aviso muted en la card. **Mock ampliado:** el proyecto
>     inicial ahora tiene 3 sprites del mundo animados (guardián, lobo, poción)
>     para validar «reasignar a OTRO sprite» sin backend. Test en
>     landscape.test.ts (213). ✅ **validado por el usuario**.
>   - **D5 — cargar al animador:** helper puro en `frames.ts`
>     `collectMissingFrameKeys()` (mapeo frameKeys → a cargar, dedupe por key,
>     omitiendo colores puros) con su test en `frames.test.ts`; decode de las
>     texturas guardadas (dataURL/ruta) → `PixelImage` en la capa UI
>     (`loadPixelFromDataUrl`, mismo patrón canvas que `addLooseFiles` — el
>     entorno de tests es Node sin canvas, así que el decode vive en
>     `spriteToolUI.ts` y lo testeable queda puro en `frames.ts`); añade los
>     frames faltantes a `looseFrames`, copia la anim en `animSpecs` (nombre
>     único si colisiona, mismos fps/loop) y `this.setStep(2)`.
>     ✅ **implementado 2026-09-15** — botón «Cargar al animador» en cada card de
>     la Biblioteca (siempre disponible, sin depender de sprites del mundo):
>     reconstruye los frames desde `world.textures` (solo los que faltan),
>     los añade como frames sueltos, duplica la anim en el Paso 3 y salta a
>     Animar para editarla/duplicarla; toasts de éxito/omitidos/error. Test
>     `collectMissingFrameKeys` en frames.test.ts (217 suite Studio). ✅ **validado por el usuario**.
>     **Fase D cerrada ✅ validada (D1–D5).**
>   - **Aceptación:** tab "Biblioteca" lista guardados con thumbs reales; reasignar
>     una anim a otro sprite; cargar una anim al animador y editarla/duplicarla; el tab
>     "Sprites" viejo ya no existe; `studio:test` + `studio:typecheck` verdes; commit
>     por sub-paso (D1→D2→D3→D4→D5) y validación del usuario entre sub-pasos.
>
> - **Fase E — Colocar animaciones de sprites en entidades del editor (Entity Builder
>   mínimo, 6.4; decidida por el usuario el 2026-09-15 — mismo bloque que Fase D):**
>   - **Objetivo:** hoy el puente F5→6.4 solo ASIGNA una anim a un sprite YA EXISTENTE
>     (`onAssignSprite` → `doc.assignSpriteAnim(spriteId, anim)`). No hay forma de
>     **colocar un sprite/entidad nuevo** con su anim (tex + anim) desde el editor.
>     Esta fase crea ese flujo: **colocar, seleccionar, reasignar y arrastrar** anims
>     a entidades, con **billboard garantizado en todas**.
>   - **Modelo ya listo:** `EditableSprite` tiene `billboard?` (default `true` en
>     `addSprite`), `anim?`, `entityType/entityName/collisionType/collisionBox`;
>     `world.spriteAnims` guarda las anims (`{ frames: string[], fps?, loop? }`);
>     el motor renderiza TODOS los sprites del mundo como billboard 2D sobre 3D
>     (`engine/three/SpriteSystem.js`, estilo Doom).
>   - **E1 — `addSprite` con anim + puente de colocación:** [MODIFICAR]
>     `EditorState.addSprite(...)` para aceptar `anim?`; [MODIFICAR] `main.ts`:
>     nuevo callback `spriteTool.onPlaceSprite(opts)` → crea un sprite nuevo en el
>     punto de colocación (centro del viewport / sector activo), lo selecciona en el
>     editor y le asigna tex+anim.
>   - **E2 — Botón "Colocar en el mundo ▾":** en la Sprite Tool (Paso 3 junto a
>     "Asignar anim activa" y en la Biblioteca de la Fase D) → lista de anims
>     guardadas; al elegir una se crea la entidad (tex del frame + anim +
>     `billboard: true`). El sprite aparece en el viewport (marcador 2D en
>     `Overlay2D` + preview 3D) y queda seleccionado para mover/escalar con las
>     herramientas existentes (ToolManager ya soporta selección kind `sprite`).
>   - **E3 — Inspector de sprite en el editor:** al seleccionar un sprite, panel con
>     sus propiedades editables: tex, **anim (dropdown con TODAS las anims de
>     `world.spriteAnims`)**, scale, pos, collisionType/collisionBox (reutilizar el
>     panel de propiedades existente; añadir solo lo que falte).
>   - **E4 — Reasignar anim a cualquier sprite** (generaliza el puente actual):
>     el "Asignar anim activa" deja de usar SOLO la anim activa y pasa a un
>     dropdown de anims guardadas (se coordina con el botón "Asignar a sprite…" de la
>     Fase D-Biblioteca). `assignSpriteAnim` ya acepta cualquier nombre.
>   - **E5 — Billboarding garantizado (requisito del usuario):** [MODIFICAR]
>     `validate.js` para exigir `billboard !== false` en todo sprite de entidad (o
>     documentar que el motor fuerza billboard); `addSprite` ya pone `billboard: true`
>     por defecto → TODAS las entidades colocadas son billboard; test motor que
>     verifique que cualquier sprite/entidad con anim se renderiza orientada a cámara.
>   - **E6 — Drag & drop (estándar UX):** arrastrar una anim guardada (de la
>     Biblioteca o del catálogo de anims) sobre el viewport → crea una entidad con esa
>     anim en la posición del cursor (coordenada 2D/3D del drop); reposicionar luego
>     con la herramienta de mover existente.
>   - **E7 — Tests:** `EditorState.addSprite` con anim + billboard true; selector de
>     anims del inspector; validate con sprite.anim inexistente → error; regresión
>     SpriteSystem del motor (anim + billboard).
>   - **Aceptación:** desde la Sprite Tool se coloca un sprite NUEVO con su anim;
>     aparece en viewport (2D + 3D billboard) y en playtest anima orientado a cámara
>     desde cualquier ángulo; el Inspector permite cambiarle la anim con dropdown de
>     todas las guardadas; drag & drop de una anim al viewport crea la entidad; todas
>     las entidades respetan billboard (validate lo exige); suites verdes; commit y
>     validación por sub-paso.
>
> > ⚠️ **Nota de nomenclatura:** la "Fase E" del ROADMAP/SPRITE_TOOL_PLAN es la de
> > colocar animaciones en entidades (arriba, ⏳ pendiente). La tab **«Mis Sprites»**
> > implementada el 2026-09-18 se etiqueta **Fase F** para no chocar con ella.
>
> - **Fase F — Tab «Mis Sprites»: sprites físicos de la cuenta en el Sprite Tool
>   (decidida por el usuario el 2026-09-18: tab SEPARADA, no fusionada con la Biblioteca):**
>   - **Objetivo (bug del usuario):** la Biblioteca mostraba «solo mocks» y no
>     reflejaba lo que se guardaba; no había forma de ver los sprites subidos a la
>     cuenta. Tras el backend C3 (ASSET_UPLOAD_PLAN cerrado ✅), `GET /api/assets
>     ?tipo=sprite`, `DELETE /api/assets/:id` y `asset.ruta` ya existían → la Fase F
>     es SOLO Studio + tests (cero backend, cero schema).
>   - **F1 — Quitar mocks:** borrar `MOCK_FRAMES`/`mockTextureDataUrl`/
>     `installMockSprites` y los 3 sprites del mundo mock (`npc_guardian`,
>     `npc_lobo`, `prop_pocion`) de `sample-project.ts` — el proyecto inicial
>     arranca sin texturas ni anims; la Biblioteca muestra solo lo guardado de
>     verdad. Actualizar `landscape.test.ts` (test que exigía `mock_*` y ≥2 sprites
>     del mundo).
>   - **F2 — Helpers API:** `assetApi.listSpriteAssets()` (GET `?tipo=sprite`) y
>     `assetApi.deleteSpriteAsset(id)` (DELETE por id); `api.apiDeleteAsset(id)`.
>   - **F3 — Tab en el modal:** `STEPS` gana 'Mis Sprites' (5ª vista, index 4);
>     `step5`+`mySpritesGrid` (hija del modal como la Biblioteca); `setStep(4)` →
>     vista exclusiva con `renderMySpritesStep()` (cards con thumb del blob
>     público `assetUrl(id)`, «Cargar al animador» y «Eliminar» con `confirm()`;
>     mensaje de estado vacío / sin conexión a la API). Callbacks inyectados por
>     main.ts: `onListMySprites`/`onDeleteSprite`.
>   - **F4 — Botón Refrescar en la Biblioteca:** `refresh-cw` repinta la Biblioteca
>     sin cambiar de tab (header `sprite-tool__library-header`).
>   - **F5 — Wiring:** `main.ts` conecta `onListMySprites = () => listSpriteAssets()`
>     y `onDeleteSprite = (id) => deleteSpriteAsset(id)` al abrir el modal; CSS para
>     header/refrescar; docs (TOOLS.md nueva sección Sprites, ARCHITECTURA §5.3,
>     ROADMAP §12 F5-Fase F, SPRITE_TOOL_PLAN historial). Tests: `asset-api.test.ts`
>     gana listado/borrado de sprites de la cuenta.
>   - **Aceptación:** la Biblioteca lista solo anims reales del proyecto (jamás
>     mocks); la nueva tab «Mis Sprites» lista los PNG de la cuenta con thumbs;
>     «Cargar al animador» reconstruye y salta al Paso 3; «Eliminar» pide
>     confirmación y refresca; suite Studio 258/258.
>   - ✅ **implementado 2026-09-18 (Studio 258/258 + typecheck OK).**
>
> - **Fase G — Botón «Eliminar» en la Biblioteca (2026-09-18):** limpieza de
>   residuos de mocks. Al validar la Fase F, el usuario seguía viendo en su
>   proyecto guardado en la nube `guard_idle`, `wolf_idle` y `potion_idle` (los
>   sprites mock del commit 5c649f1, ya eliminados del código) y pidió poder
>   quitarlos de la Biblioteca **y del mundo**.
>   - **G1 — `EditorState.removeSpriteAnim(name)`:** borra la anim de
>     `world.spriteAnims`, los sprites del mundo con `anim === name`, y las
>     texturas de sus frames solo si quedan huérfanas (ni otra anim ni otro
>     sprite `sp.tex` las usan). Devuelve `{ ok, removedSprites, removedTextures }`.
>   - **G2 — UI:** icono papelera (`trash`, rojo en hover) en el head de cada
>     card de la Biblioteca → `window.confirm` (avisa que también se eliminan
>     los sprites del mundo y texturas huérfanas) → callback `onDeleteAnim`
>     (nuevo, inyectado por main.ts) → al terminar repinta la Biblioteca.
>   - **G3 — Wiring:** `main.ts` — `onDeleteAnim` hace `requireSession` →
>     `doc.removeSpriteAnim(name)` → `saveCurrent(true)` (persiste la limpieza
>     en la nube) → toast con el nº de sprites del mundo eliminados; si el
>     guardado falla avisa que quedó en memoria (Ctrl+S).
>   - **G4 — Tests (entities.test.ts, 2026-09-18):** borra anim + sprite + 2
>     texturas huérfanas; conserva sprites/texturas compartidas; `ok:false`
>     para anim inexistente sin mutar nada. Suite Studio 261/261.
>   - **Aceptación:** al pulsar Eliminar en `guard_idle`/`wolf_idle`/
>     `potion_idle` desaparecen de la Biblioteca y del viewport, el proyecto
>     limpio se guarda en la nube y la Biblioteca se repinta al instante.
>
> - **Después de cerrar SPRITE_TOOL_PLAN.md (fases D/E) → Evolución UI del Studio con
>   Tweakpane (look & feel técnico):** documentado en `DESIGN.md` §10 y vinculado en
>   ROADMAP §12. Reemplaza componentes existentes + parte de la UX actual.
- [MODIFICAR] `studio/src/spriteTool/frames.ts`:
  - NUEVO `frameKeyFromFile(assetId, fileName)` → `{assetId}_{nombre_sanitizado_sin_ext}`
    (reutiliza la sanitización existente: minúsculas + `[A-Za-z0-9._-]`).
  - NUEVO `spritePath(key)` → `/assets/sprites/{key}.png` (URL genérica por key,
    no por índice).
- [MODIFICAR] `studio/src/spriteTool/animator.ts` — **cambio de firma** (validada en 7a):
  - `buildSpriteAnims(assetId, frameCount, anims)` → `buildSpriteAnims(assetId, frameKeys: string[], anims)`.
    Genera `textures[key] = spritePath(key)` para cada key disponible y valida que
    cada frame de cada anim exista en `frameKeys` (errores legibles en español).
  - Actualizar los tests de 7a a la nueva firma en el mismo commit.
- [MODIFICAR] `studio/src/spriteTool/spriteToolUI.ts`:
  - Botón "Añadir frames desde archivo…" (lucide `image-plus`) → `<input type=file
    accept="image/png, image/webp" multiple>` → por cada PNG: `loadFile`-like →
    `PixelImage` → dataURL → `{ key: frameKeyFromFile(assetId, nombre), dataUrl, w, h }`.
  - Se guardan en `this.looseFrames` (lista separada) y **nunca se pierden al
    re-cortar** la hoja en el Paso 2 (`cutFramesFromSheet` respeta `looseFrames`;
    `loadFile` los vacía con la hoja nueva).
  - `allFrames()` = `[...cutFrames, ...looseFrames]` (getter): usado por renderFrames,
    select de añadir-frame y handleSave → el guardado real (7c) ya sube TODAS las keys
    con el middleware; main.ts NO cambia.
  - Key duplicada (mismo archivo dos veces) → skip + toast warning.
- [MODIFICAR] `studio/tests/spriteTool/animator.test.ts` — adaptar a `frameKeys`; nuevo
  test con keys mixtas (hoja `_f0` + suelta `_sword`) y error por key inexistente.
- [MODIFICAR] `studio/tests/spriteTool/frames.test.ts` — `frameKeyFromFile`
  (espacios/acentos/mayúsculas → key limpia minúscula) y `spritePath`.
- **Verificación 7e:** typecheck + Studio (195 + nuevos) + motor (187) verdes. Manual:
  subir 3 PNG sueltos → crear anim nueva → añadirlos → guardar → asignar → playtest.

#### 7f — Espejo de animaciones (solicitud del usuario)
- **Concepto:** los sprites del motor son billboards con textura; "espejo" = voltear
  horizontalmente cada frame. En vez de modificar el motor, el Studio **genera texturas
  espejadas nuevas** (`{key}_mirror`) y una **animación espejada nueva** (`{name}_mirror`)
  con los mismos fps/loop. El contrato `world.spriteAnims` ya lo soporta sin cambios de
  motor: un sprite en el puente "Asignar a sprite del mundo" elige `walk_mirror` para
  moverse a la izquierda.
- [MODIFICAR] `studio/src/spriteTool/frames.ts`:
  - NUEVO `mirrorPixelImage(img: PixelImage): PixelImage` — voltea horizontalmente
    (invirtiendo el orden de columnas RGBA); puro, testeable en Node.
- [MODIFICAR] `studio/src/spriteTool/animator.ts`:
  - NUEVO `mirrorAnimName(name)` → `${name}_mirror` (convención de sufijo).
  - NUEVO `buildMirroredAnim(name, sourceFrames: { key, pixel }[], fps, loop)` → dado
    un espec de una anim (nombre, fps, loop) y los `CutFrame` con su `PixelImage`, genera:
    los frames espejados deduplicados por key (`${frameKey}_mirror`, PixelImage volteado)
    y un `AnimSpec` nuevo (`name_mirror`, misma estructura de índices con duplicados,
    mismos fps/loop). Sin canvas: la UI convierte los pixels a dataURL.
  - `buildSpriteAnims(assetId, frameCount, anims, frameKeys?)` — parámetro NUEVO
    opcional `frameKeys: string[]` (mínimo técnico de 7e necesario para el espejo): si se
    pasa, los índices de las anims apuntan a esa lista y las texturas se generan para
    CADA key (`/assets/sprites/{key}.png`). Sin él, comportamiento anterior `_f{index}`.
- [MODIFICAR] `studio/src/spriteTool/spriteToolUI.ts`:
  - Botón "Espejar anim <activ>" junto a la anim activa (lucide `flip-horizontal-2`).
  - Al pulsar: genera frames espejados + anim `_mirror` vía `buildMirroredAnim`, los añade
    a `looseFrames`/`allFrames`, crea y **selecciona** la anim espejada. Guardia: si ya
    existe `{name}_mirror` → toast aviso y no duplicar.
  - `CutFrame` gana `pixel?: PixelImage` (los frames recortados y los sueltos guardan su
    PixelImage para poder espejarse; la UI lo descarta en la serialización).
- [MODIFICAR] `studio/tests/spriteTool/frames.test.ts` — `mirrorPixelImage`: 2×1
  `[R,G]` → `[G,R]`, alfa preservado, imagen 1×1 sin cambio relevante.
- [MODIFICAR] `studio/tests/spriteTool/animator.test.ts` — `mirrorAnimName` y
  `buildMirroredAnim`: keys con sufijo `_mirror`, anim nueva con mismos fps/loop,
  y `buildSpriteAnims` con keys espejadas → `validateProject` `valid:true`.
- [MODIFICAR] ROADMAP.md §12 → F5: **espejo queda cubierto dentro del Paso 3**; la Fase C
  (PNGs sueltos 7e + pestaña "Sprites"/biblioteca) **queda pendiente** para su momento.
- **Verificación 7f:** typecheck + Studio (200 + nuevos) + motor (187) verdes. Manual:
  hoja → cortar → "Espejar anim walk" → la anim `walk_mirror` aparece y reproduce → guardar
  → asignar a un sprite del mundo → playtest F5 → el sprite camina hacia la izquierda.

### Orden de ejecución acordado
`6a → (valida) → 6b → (valida) → 7a → (valida) → 7b → (valida) → 7c → (valida) → 7d → (validado) → 7f → (valida)`
*(7e queda pospuesto y se ejecutará dentro de la Fase C.)*

- Cada paso cerrado con su suite verde (`test:engine` en 6a/6b; `studio:typecheck` +
  `studio:test` en 7a/7b/7c) y commit propio sin `push` (convención del usuario).
- Comentarios en español, iconos lucide (sin emojis), tokens DESIGN.md, cero cambios
  de schema, cero toques a lo validado sin permiso.