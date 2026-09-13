# Plan: Sprite Tool — Slicer + Animator + Biblioteca de Sprites

> **Reescritura desde cero de la herramienta de sprites del Studio (F5 / ROADMAP 6.5).**
> Estado: **borrador para aprobación** — no se escribe código hasta que el usuario apruebe este plan.

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
- `spriteToolUI.ts`: toda la manipulación de canvas/UI; usa las funciones puras y el middleware `/assets/sprites/upload` (reutilizado). Sin lógica de negocio.
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
- Al **Guardar**: sube los PNGs al middleware (reutilizando `/assets/sprites/upload`) y escribe `world.textures[key] = url` + `world.spriteAnims[id] = def` vía `EditorState`. Aviso si algún upload falla.

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
│ TAB Sprites ─ biblioteca de PNG individuales (sin slicer)     │
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
- Limpieza del código viejo del slicer (`AssetManager.ts` se reduce a biblioteca de assets: texturas/audio/sprites sueltos).
- **Aceptación:** subir 3 PNG sueltos → arrastrarlos al animador → crear anim y guardar; la demo usa un sprite suelto como `tex` de entidad; `npm run studio:test` y `npm run studio:typecheck` verdes; ROADMAP §12 marca F5/6.5 parcialmente `realizada` por fases.

*Orden sugerido: A → (validación usuario) → B → (validación) → C → commit final.*

---

## 8. Tests (obligatorios por regla del proyecto)

`test/studio/spriteTool/`:
- `detectSprites.test.ts`: hoja sintética con 3 sprites separados → 3 rects correctos; sprite con hueco interno (anillo) → 1 rect (gapTolerance); ruido < minPixels descartado; hoja sin transparencia → aviso/0 rects; orden row-major.
- `gridSlice.test.ts`: 4×2 → 8 rects; cell px auto-calculada; spacing resta borde; trailingEmpty elimina celdas vacías.
- `frames.test.ts`: recorte de un rect → dimensiones correctas; trim true → bounding box a opacos; trim false → celda completa; naming `textureKeyFor/urlFor`.
- `animator.test.ts`: anim con <2 frames se duplica; fps clamp; reordenar frames cambia el array sin tocar la hoja; guardado produce `textures` + `spriteAnims` válidas para `validateProject` del motor (carga real de `engine/core/validate.js`).
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
4. **AssetManager confirmado:** en Fase C se simplifica a biblioteca de assets (texturas/audio/sprites sueltos); el slicer/animator viejo se elimina.
5. **Frames sueltos:** en esta iteración quedan **solo para el animador** (consumidos dentro de la Sprite Tool); NO se toca `entityCatalog` ni el Entity Builder (6.4, aparte).

### Nota: convivencia 2D en mundo 3D
Los sprites 2D conviven en un mundo 3D y se renderizan con **billboarding** (planos que siempre miran a cámara). Eso **ya lo resuelve el motor** (`engine/three/SpriteSystem.js`: sprites billboard con animación por frames) y la colocación la hará el Entity Builder (6.4). **La Sprite Tool no toca orientación/posición/escala 3D**: solo produce texturas recortadas + `world.spriteAnims`. Es un contrato de datos, y el render lo interpreta.

---

## 11. Cómo se verifica el plan en cada fase

- Comandos: `npm run studio:typecheck` · `npm run studio:test` · `npm run test:engine` (regresión del motor — deben seguir en verde, no se toca).
- Validación visual: subir una hoja real → cortar → animar → **F5 playtest** con el guardia animado en la demo (criterio explícito del HITO F5 en ROADMAP: *"Sprite animado importado y recortado aparece en la demo"*).
- Al terminar cada fase completada se marca en `ROADMAP.md` §12 como `realizada` (F5/6.5 parcial por fases) y se espera validación del usuario antes de pasar a la siguiente.