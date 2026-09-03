# ROADMAP — RayCast Studio

> Creador web de RPG 2.5D/3D retro (estilo Wolfenstein 3D → Doom → Daggerfall).
> Plan maestro del proyecto. Sustituye a `SPRITE_TOOLS_PLAN.md` (ver §9 Herencia).

---

## 1. Visión

Convertir **RayCast.js** en una plataforma web tipo *RPG Maker* para construir videojuegos de rol en primera persona con estética retro-3D. El producto tiene **tres caras**:

- **Studio** — conjunto de herramientas web (editor de niveles 3D, pipeline de sprites, IA, misiones, diálogos, combate, magia, comercio, progresión, visual scripting).
- **Runtime** — doble motor de render que ejecuta los juegos: modo **retro** (raycaster Canvas clásico) y modo **3d** (WebGL con verticalidad/eje Z, estilo XnGine/Daggerfall).
- **Player/Publisher** — exporta un juego terminado a un **HTML autónomo** jugable en cualquier navegador, sin servidor ni instalación.

**Un juego creado = una carpeta de proyecto** (`project.json` + `assets/`). Todo es datos: las herramientas escriben datos, los motores leen datos. *(Visión a futuro:)* esa carpeta podrá vivir también en un servidor (`/api/projects` + `/api/assets`, backend §15) para trabajar contra la API y exportar/importar `*.ragproj`; hoy el motor (`engine/`) lee el `project.json` directamente.

**Principio de UX rector:** todo en el Studio es **arrastrar y unir** — assets sobre el viewport, bloques predefinidos sobre entidades, y bloques entre sí con cables en los blueprints. El scripting por código queda excluido del alcance (decisión del usuario): la creación debe ser fácil, sin escribir una línea.

---

## 2. Decisiones y justificación técnica

| Decisión | Justificación |
|---|---|
| **Web, no escritorio** | El XnGine original es propietario de Bethesda y su código nunca llegó a publicarse; `kevinmkchin/XNGINE` es un renderer C++ sin relación con él. No hay motor C++ que incrustar → se escribe uno propio. WebGL da GPU desde el navegador y la app entera corre sin instalación. Si algún día se quiere desktop, Electron/Tauri envuelve el mismo TypeScript sin reescribir nada. |
| **Motor 3D (Three.js)** | El motor usa Three.js para renderizar todo en perspectiva real con verticalidad (pisos/techos con altura, rampas, pisos superpuestos, terreno ondulado). El modo retro/Canvas se elimina del motor para evitar duplicidad de lógica y consistencia del mundo. El `project.json` define `renderMode: '3d'` fijo. |
| **TypeScript + Vite + Vitest** | El proyecto pasará de ~500 líneas a decenas de miles. Tipado para el modelo de datos (un cambio en `project.json` se propaga a todas las herramientas), build modular, dev-server `npm run dev` y tests integrados. |
| **Three.js para 3D (no WebGL a mano)** | Reutilizar una librería madura en lugar de escribir un renderer propio: escena, cámara, mallas, texturas, raycasting del editor. El trabajo propio es el *sector system* (verticalidad) encima, no el pipeline gráfico. |
| **Formato de datos propio, único** | Desacopla herramientas ↔ motores. Un editor escribe JSON; otro motor puede leer el mismo JSON sin tocar las herramientas. Schema versionado. |
| **Física cinemática ligera de género (no Rigidbody completo)** | Mover-y-colisionar contra sectores + gravedad (saltos, caídas), escaleras, elevadores y triggers. Un Rigidbody físico-realista (masa, fricción, joints) es sobredimensionado para un FPS 2.5D retro: complica y no aporta nada visible. `cannon-es` queda como opción futura solo para props dinámicos/proyectiles. |
| **Visual Scripting (blueprints), nunca C#/C++** | La lógica del juego se diseña con grafos de nodos conectados por cables (estilo Unreal Blueprints). Un mismo runtime ejecuta IA, misiones, diálogos, eventos de mapa y cutscenes. |
| **Sistemas RPG inspirados en Daggerfall Unity** | Proyecto open-source MIT con 10 años resolviendo exactamente estos sistemas (quests `QRC/QBN`, diálogos, facciones, clases). Es el blueprint de arquitectura, no código copiable. |
| **Fidelidad de época** | Tipografías MS-DOS/rpg 90s y pantallas de carga son parte del producto, no decoración: definen la identidad visual retro. |
| **Backend desde el inicio (API REST + Postgres)** | La biblioteca de juegos del creador y sus preferencias viven en servidor: multidispositivo, backup centralizado y galería pública. No contradice al Publisher: el HTML autónomo sigue siendo la exportación sin cuenta; la galería es una vía adicional de publicar/jugar. |
| **Stack API: Node + Hono + Prisma + Postgres** | Hono (liviano, TypeScript end-to-end, validación Zod nativa). **Prisma** como ORM sobre PostgreSQL con `projects` como **JSONB** (documento v2 completo), migraciones versionadas (`prisma migrate`) y Prisma Studio para inspección. Auth **JWT propios + bcrypt**, sesión stateless, sin proveedor OAuth por ahora. Blobs en filesystem del servidor (S3/R2 opcional en el futuro). |

---

## 3. Análisis de los componentes del motor

| Componente | ¿Se crea? | Forma concreta | Justificación |
|---|---|---|---|
| **Sistema de renderizado** | ✅ Sí | Motor **3D** (Three.js/WebGL) con cámara **perspectiva** (juego) y **ortográfica** (vista top-down del editor). Three.js evita reinventar WebGL y une retro+3d en un solo pipeline consistente. |
| **Motor de físicas** | ✅ Sí (ligero) | Módulo `src/core/physics` **cinemático para el género**: mover-y-colisionar contra sectores (muros, alturas piso/techo), gravedad para saltos, escaleras/elevadores, zonas trigger. | Ver §2: física *de género* cubre el 100% de las mecánicas pedidas (saltos, rampas, pisos) sin el costo de un Rigidbody completo. |
| **Gestor de audio** | ✅ Sí | Módulo `src/core/audio` sobre **Web Audio API** (stdio del navegador, sin librería): `PannerNode` para **sonido espacial 3D**, música de fondo en loop, SFX one-shot, mixers por categoría. | Nunca se había contemplado; necesario en cualquier RPG. |
| **Sistema de scripting** | ❌ NO como código | **Visual Scripting Engine + Blueprint Editor**: grafos de nodos (Eventos/Condiciones/Acciones/Variables/Flujo) unidos con cables. **Nunca C#/C++.** | Requisito del usuario: arrastrar bloques y unirlos, no escribir código. |

---

## 4. Arquitectura general

```
┌─────────────────────────────── STUDIO (SPA Vite, herramientas) ───────────────────────────┐
│ Game Library │ Launcher │ Asset Manager │ Level Editor │ Blueprint │ AI │ Quest │ …        │
│ Dialogue │ Font Manager │ Loading Editor │ Publisher (HTML · galería)                      │
└──────────────────────────────────────┬────────────────────────────────────────────────────┘
                                       │  fetch → /api/* (REST; en dev el proxy del dev-server)
┌──────────────────────────────────────▼──────────────────── API (Node + Hono) ─────────────┐
│ /auth (JWT) │ /projects CRUD │ /assets (blobs) │ /templates (seed) │ /gallery (/play/:slug) │
└──────────────────────────────────────┬──────────────────────────────┬──────────────────────┘
                                       ▼                              ▼
        ┌──────────────── Postgres ──────────────┐    ┌── almacén de blobs ──┐
        │ users · projects (JSONB) · assets ·    │    │ filesystem del       │
        │ gallery · templates (plantillas seed)  │    │ servidor (S3/R2 fut.)│
        └────────────────────────────────────────┘    └──────────────────────┘

RUNTIME (motor único) — leen el mismo project.json v2 (local en el Studio o servido por /gallery)
Core: ECS, game loop, eventos, input, física cinemática, audio, save/load
Render: 3D (Three.js + sector system + terrain)
Systems: player, ai, combat, magic, inventory/trade, quests, dialogue, progression,
         visualscript (blueprints)
```

**Principio rector:** nada duplicado entre motores salvo el render; todo lo demás vive una vez en Core/Systems y sirve a ambos.

---

## 5. Modelo de datos (`project.json`)

```jsonc
{
  "meta":       { "name", "schemaVersion", "renderMode": "retro" | "3d", "author" },
  "settings":   { "resolution", "fov", "playerStart", "dayNight" },       // por mapa
  "textures":   [ { "id", "src", "repeat", "isTransparent" } ],
  "sprites":    [ { "id", "sheet", "frames", "animations", "scale" } ],   // salida del sprite pipeline
  "fonts":      [ { "id", "atlas", "glyphsSz", "baseline" } ],            // tipografías DOS (bitmap)
  "textStyles": [ { "id", "fontId", "sizePx", "color", "shadow" } ],
  "audio":      [ { "id", "src", "loop", "volume", "spatial": true } ],
  "loading":    [ { "id", "bg", "progressBar", "tips": [ ... ] } ],       // pantallas de carga
  "map":        {
    "size", "grid": [],                          // solo retro: ids de tiles
    "sectors": [ { "id", "floorH", "ceilH",      // retro-vertical + 3d
                   "floorTex", "ceilTex",
                   "walls": [ { "a", "b", "tex", "portalsTo" } ] } ],
    "terrain":  [ { "x", "y", "h" } ],           // 3d exterior (xnGine-outdoor)
    "zones":    [ { "id", "trigger", "blockId" | "blueprintId" } ]
  },
  "entities":   [ { "id", "type", "sprite", "pos": {x,y,z},
                    "behavior" | "blockId" | "blueprintId", "stats" } ],
  "blocks":     [ { "id", "category": "doors|ai|combat|motion|ambient",
                    "graph": "<blueprintId>", "params": [...] } ],        // bloques predefinidos
  "blueprints": [ { "id", "nodes": [ ... ], "wires": [ ... ] } ],          // visual scripting
  "behaviors":  [ { "id", "fsm": { estados y transiciones } } ],
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

Regla: **schema versionado + validadores (Zod)**. Una herramienta o motor que reciba un proyecto de versión distinta avisa y migra.

### Schema v2 (aditivo, retrocompatible con v1)

El de-hardcoding del motor pasa estas constantes a *datos del juego* (elimina índices y magia dura del código):

- `settings.floorTexture` / `settings.ceilingTexture` → ids de textura (reemplazan los índices fijos 3/4/6 del raycaster).
- `sprites[].flags { translucent?, kind? }` → reemplaza el `texture === 10` (luz) y la coloración por índice en el minimapa.
- `settings.minimap { enabled?, colors { wall, player, sprite } }` → reemplaza los colores fijos del HUD.

Migración automatizada v1→v2 (migrator Zod): un proyecto v1 se carga y se normaliza a v2 sin intervención.

### Entidades del servidor (Postgres)

> **Esquema completo en `DATABASE.md`** (fuente de verdad del esquema; de ahí se genera `server/db/schema.prisma`).

| Tabla | Campos clave | Uso |
|---|---|---|
| `persona` | id, nombre, apellido, email_publico, bio, avatar_path | Datos reales del individuo (públicos) |
| `usuario` | id, persona_id (1:1), rol_id (N:1), login (único), password_hash | Credenciales de acceso y sesión JWT |
| `rol` | id, nombre (único: admin/creador), descripcion | Tipos de usuario |
| `proyecto` | id, propietario_id (→usuario), nombre, slug, **estado** (`EN_DESARROLLO`/`PUBLICADO`), schema_version, render_mode, data (**JSONB** con el documento v2 completo), thumbnail_path, published_at | Biblioteca de juegos del creador; **todo el juego vive en `data`** |
| `asset` | id, propietario_id, proyecto_id, nombre, tipo (texture/sprite/audio/font/modelo), mime, tamano_bytes, ruta (único), hash | Blobs: metadatos en DB, **bytes en filesystem**, ruta en `asset.ruta` |
| `galeria` | id, proyecto_id (1:1), slug (único), titulo, descripcion, visitas | Publicación pública `/play/:slug` (proyecto con `estado=PUBLICADO`) |
| `plantilla` | id, nombre, descripcion, data (JSONB v2) | Plantillas semilla (incluye el demo) |

**Regla transversal:** **toda la data del juego se persiste en la DB** (Postgres vía Prisma): el `project.json` completo en `proyecto.data` (JSONB) y las rutas de assets en `asset.ruta`. Nada hardcodeado ni almacenado solo local/flags. El único disco es el filesystem de blobs para los bytes de los assets.

---

## 5b. Contrato de comunicación Front ⇄ Backend

Todo `fetch` de la SPA hacia `/api/*` devuelve la **misma estructura JSON**. Es el único contrato de respuesta entre front y backend: los componentes de UI solo leen `success`, `data` y `error`, nunca la forma interna del endpoint.

### Envoltorio estándar de respuesta

```jsonc
{
  "success": true,                // boolean
  "data":     { ... },            // object | null — payload en caso de éxito (null en POST sin cuerpo)
  "error":    null                // null en caso de éxito
}
```

```jsonc
{
  "success": false,
  "data":     null,
  "error": {
    "code":    "PROJECT_NOT_FOUND",   // código estable (string), clave del diccionario
    "message": "El proyecto no existe", // mensaje legible para el usuario final
    "details": { "id": "abc123" }       // any — opcional, contexto técnico para depurar
  }
}
```

**Reglas del contrato:**
- `success: true` ⇒ `data` = payload (nunca `null` salvo en acciones sin retorno) y `error = null`.
- `success: false` ⇒ `data = null` y `error` siempre presente con `code` + `message`.
- El cliente NUNCA parsea el body según el endpoint; **siempre** lee el envoltorio.
- HTTP status: 200/201/204 en éxito; 400/401/403/404/409/422/500 en error (el status HTTP complementa, pero el flujo real lo decide `success`/`code`).

### Códigos de error (diccionario centralizado)

Todos los códigos viven en un **único archivo** del servidor (`server/src/errors/codes.ts`) y del cliente (`src/api/errors.ts`), tipo-enlazados. Tabla no exhaustiva:

| Código | HTTP | Mensaje | Cuándo |
|--------|------|---------|--------|
| `VALIDATION_ERROR` | 422 | Datos inválidos | Zod falla (schema de entrada) |
| `UNAUTHORIZED` | 401 | No autenticado | Falta/expira el JWT |
| `FORBIDDEN` | 403 | Sin permiso | Autenticado pero sin acceso al recurso |
| `NOT_FOUND` | 404 | No encontrado | Recurso genérico inexistente |
| `PROJECT_NOT_FOUND` | 404 | Proyecto no existe | `id` de proyecto inválido |
| `ASSET_NOT_FOUND` | 404 | Asset no existe | `id` de asset inválido |
| `EMAIL_IN_USE` | 409 | Email ya registrado | Register con email duplicado |
| `INVALID_CREDENTIALS` | 401 | Credenciales incorrectas | Login fallido |
| `SLUG_TAKEN` | 409 | Slug de galería ocupado | Publish con slug duplicado |
| `STORAGE_WRITE_ERROR` | 500 | No se pudo escribir el archivo | Fallo en blobs del filesystem |
| `INTERNAL_ERROR` | 500 | Error interno | Cualquier fallo no categorizado |

### Arquitectura del manejo de errores (3 piezas)

```
server/src/
├── errors/
│   ├── codes.ts              ← diccionario de códigos + mensajes (fuente única)
│   ├── AppError.ts           ← clase AppError{ code, message, status, details }
│   └── handler.ts            ← interceptor global (Hono app.onError)
└── routes/                   ← cada endpoint lanza AppError o usa handler; NUNCA responde JSON suelto
```

1. **`codes.ts`** — diccionario: `export const ERRORS = { VALIDATION_ERROR: { status: 422, message: '...' }, ... }`. Un cambio aquí añade/edita un código y su mensaje en un solo lugar (también sirve como documentación viva de la API).

2. **`AppError`** — clase con `{ code, message, status, details }`. Los endpoints `throw new AppError('PROJECT_NOT_FOUND', { id })`. También hay helpers: `throwBadRequest(msg)` … o `AppError.fromZod(zodError)` que mapea el error de Zod a `VALIDATION_ERROR` con `details.issues`.

3. **`handler.ts`** — **interceptor global** registrado en Hono (`app.onError((err, c) => ...)`). Atrapa:
   - `AppError` → responde su `{ success:false, data:null, error:{ code, message, details } }` con su `status`.
   - `AppError.fromZod` / errores de validación → `VALIDATION_ERROR` (422).
   - cualquier otro `Error` → `log error` y responde `INTERNAL_ERROR` (500), **sin filtrar stack trace ni datos internos** al front.
   - not-found de ruta no existente → `NOT_FOUND` (404).

**Flujo de un endpoint:**
```ts
// routes/projects.ts
app.get('/api/projects/:id', async (c) => {
  const project = await db.project.findUnique({ where: { id: c.req.param('id') } });
  if (!project) throw new AppError('PROJECT_NOT_FOUND', { id: c.req.param('id') });
  return c.json(ok(project));
});
```
El endpoint solo se preocupa de: validar, llamar a la DB y `throw` cuando algo no cuadra. **Toda la respuesta de error la unifica el interceptor** → cero JSON suelto `{ error: '...' }` repartido por el código.

### Cliente tipado (front)

`src/api/client.ts` expone un `apiFetch<T>(...)` que desenvuelve el contrato y lanza excepciones tipadas del lado cliente:

```ts
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json();
  if (!body.success) throw new ApiError(body.error);   // ApiError{ code, message, details }
  return body.data as T;
}
```

Así la UI hace `const project = await apiFetch('/api/projects/1')` y el **toast/interceptor global del front** captura `ApiError` para mostrar el mensaje al usuario (ver `DESIGN.md` §5.6). El front puede traducir `code` → mensaje localizado sin depender del `message` inglés del server si lo desea.

---

## 6. Catálogo de herramientas

Para cada una: **objetivo · justificación · flujo de uso · entradas/salidas · estado**.

| # | Herramienta | Estado | Fase |
|---|---|---|---|
| 6.1 | Sprite Slicer + Background Remover (SpriteSplicer) | 🆕 desde cero | F3 |
| 6.2 | Sprite Animator | 🆕 desde cero | F3 |
| 6.3 | Entity Builder | 🆕 desde cero | F3 |
| 6.4 | Asset Manager (texturas, sprites, audio, fuentes, modelos) | 🆕 | F3 |
| 6.5 | Level Editor (mapa + sectores + altura Z + rampas) | 🆕 **primer hito** | F1 |
| 6.6 | 3D Viewport / Playtest (perspectiva + orto) | 🆕 | F1–F2 |
| 6.7 | Behavior / AI Editor (sobre blueprint runtime) | 🆕 | F4 |
| 6.8 | 5.Quest Editor (genera blueprints) | 🆕 | F8 |
| 6.9 | Dialogue Editor (genera blueprints) | 🆕 | F7 |
| 6.10 | Combat Editor (armas, proyectiles, anims de combate) | 🆕 | F5 |
| 6.11 | Magic / Skills Editor | 🆕 | F6 |
| 6.12 | Items / Economy Editor | 🆕 | F5/F9 |
| 6.13 | Progression / Class Editor | 🆕 | F10 |
| 6.14 | **Visual Scripting / Blueprint Editor** | 🆕 **central** | F4 |
| 6.15 | Tipografías DOS / Font Manager | 🆕 | F3 |
| 6.16 | Pantallas de carga / Loading Editor | 🆕 | F3 |
| 6.17 | Bloques predefinidos reutilizables (catálogo) | 🆕 | F4 (catálogo base) · F11 (editor de bloques) |
| 6.18 | Project Manager / Launcher | 🆕 | F3+ |
| 6.19 | Publisher (Player + pantalla de carga) | 🆕 | F12 |
| 6.20 | **Game Library / DB Manager** 🆕 | 🆕 (visión: backend) | F6+ |
| 6.21 | **Cloud Gallery (publicar online)** 🆕 | 🆕 API y reproductor listos; publicación desde F12 | F12 |
| 6.22 | **Design System / Componentes reutilizables** 🆕 | 🆕 | F0.7 |

### 6.1 Sprite Slicer + Background Remover (SpriteSplicer) — 🆕 DESDE CERO
- **Objetivo:** cortar hojas de sprites (p.ej. Daedroth 718×1509px) en frames y eliminar fondo.
- **Justificación:** puerta de entrada del asset 2D; sin sprites no hay entidades (todo en este género es billboard).
- **Flujo:** arrastrar PNG → detectar grilla/frames → ajustar tolerancia, flood-fill/color key, trim → exportar frames + `sprites.json`.
- **I/O:** PNG → frames PNG + JSON.
- **Implementación:** crear desde cero bajo `studio/sprite-tools/`, conectarlo al Asset Manager y aceptar las hojas grandes de `assets/daggerfall/`.

### 6.2 Sprite Animator — 🆕 DESDE CERO
- **Objetivo:** definir animaciones (idle/walk/attack/death) sobre frames, con fps y loop, y previsualizarlas.
- **Justificación:** el datum de animación es la base de la IA y del combate.
- **Flujo:** seleccionar frames → nombrar anim → marcar fps/loop → previsualizar ▶ → guardar en `sprites[].animations`.

### 6.3 Entity Builder — 🆕 DESDE CERO
- **Objetivo:** convertir sprite animado + configuración en una entidad colocable (enemy/npc/prop).
- **Justificación:** puente sprites→mundo; define stats y comportamiento sin tocar código.
- **Flujo:** elegir sprite → tipo → stats (hp/damage/speed/sight) → comportamiento → posición → guardar en `entities[]`.

### 6.4 Asset Manager — 🆕 (ampliado)
- **Objetivo:** biblioteca central (texturas 64×64, sprites, audio, fuentes, modelos). Importar, organizar, previsualizar, optimizar.
- **Justificación:** un solo lugar que resuelve `id → archivo` y asegura que las exportaciones solo incluyan lo usado.
- **Flujo:** importar → organizar → id autogenerado → disponible en dropdowns de todos los editores → informe de assets sin usar.

### 6.5 Level Editor (mapa + verticalidad) — 🆕 PRIMER HITO
- **Objetivo:** editar el mundo: grid de tiles (retro), sectores con altura de piso/techo, rampas, zonas de trigger y colocación de entidades.
- **Justificación:** corazón del creador; todo lo demás pende de tener un mundo recorrible en 3D.
- **Flujo:**
  1. Abrir vista 2D (top-down, pintar por tiles) o 3D (viewport Three.js, cámara orbit).
  2. Panel de materiales (Asset Manager) → pintar suelo/paredes.
  3. Seleccionar sector → arrastrar elevación de piso/techo → rampas y pisos superiores (portales).
  4. Colocar entidades desde el Entity Builder, ajustar rotación/z (drag & drop al viewport).
  5. Zonas de trigger (entrar/colisionar/activar) → enlazar blueprint o bloque.
  6. Playtest dentro del editor (F5).
- **I/O:** `map` + `entities`.

### 6.6 3D Viewport / Playtest — 🆕
- **Objetivo:** vista de juego en vivo dentro del Studio + vista orbit para editar.
- **Justificación:** sin playtest en vivo no se valida verticalidad, colisión ni dificultad.
- **Flujo:** F5 → runtime con el proyecto en memoria → WASD + ratón → F6 vuelve al editor manteniendo la posición (edición en vivo).

### 6.7 Behavior / AI Editor — 🆕
- **Objetivo:** diseñar el cerebro de enemigos y NPC: máquina de estados con condiciones y acciones, ejecutándose sobre el runtime de blueprints.
- **Justificación:** la IA varía de juego a juego; editor visual ≫ código por entidad.
- **Flujo:** estado → transición (condición) → acción → asignar a entidad, o arrastrar un **bloque de IA predefinido** (patrulla, emboscada).
- **I/O:** `behaviors[]` + `entities[].behavior`.

### 6.8 Quest Editor — 🆕
- **Objetivo:** misiones en etapas (trigger → condición → acción → recompensa), patrón Daggerfall `QRC/QBN` simplificado. Se genera un blueprint por detrás.
- **Justificación:** columna vertebral del RPG.
- **Flujo:** crear quest → título/descripción → lista de etapas (condición + acción) → recompensas → probar con consola de depuración (`startquest`).
- **I/O:** `quests[]` + `blueprints[]`.

### 6.9 Dialogue Editor — 🆕
- **Objetivo:** árboles de diálogo por nodos: texto, opciones, retratos, condiciones y acciones.
- **Justificación:** NPCs sin diálogo no son NPCs.
- **Flujo:** nodo raíz → ramas/opciones → condiciones en aristas → acciones al llegar → previsualizar.
- **I/O:** `npc[]` + `dialogue[]` + `blueprints[]`.

### 6.10 Combat Editor — 🆕
- **Objetivo:** armas cuerpo a cuerpo y a distancia, proyectiles, anims de combate, daño, alcance, cadencia.
- **Justificación:** el combate es mecánica central; definirlo por datos permite balancear sin código.
- **Flujo:** crear arma → stats → sprite/anim → sonido → proyectil (si aplica) → asignar.
- **I/O:** `items[]` (type: weapon) + `entities[].stats`.

### 6.11 Magic / Skills Editor — 🆕
- **Objetivo:** hechizos y habilidades: escuela, coste de mana, efectos, FX.
- **Justificación:** un editor de efectos reutilizables ahorra reimplementar cada spell.
- **Flujo:** crear spell → escuela/stat → coste → efecto(s) → FX → balancear.
- **I/O:** `spells[]`.

### 6.12 Items / Economy Editor — 🆕
- **Objetivo:** items, moneda y tiendas con restock.
- **Justificación:** comercio y loot dan el loop de progresión.
- **Flujo:** crear item → tipo/stats/icono/precio → tienda → inventario → NPC vendedor enlaza tienda.
- **I/O:** `items[]` + `economy[]`.

### 6.13 Progression / Class Editor — 🆕
- **Objetivo:** clases, atributos, skills, curva XP y ganancias por nivel.
- **Justificación:** el sistema de niveles es el contrato de combate/skills/magia.
- **Flujo:** clase → atributos base → skills entrenables → curva XP → beneficios por nivel → XP que otorgan los enemigos.
- **I/O:** `progression[]`.

### 6.14 Visual Scripting / Blueprint Editor — 🆕 CENTRAL
- **Objetivo:** programar la lógica del juego **sin escribir una línea**: grafo de nodos conectados por cables (estilo **Unreal Blueprints**).
- **Justificación:** requisito central del usuario; **unifica** IA, misiones, diálogos, eventos de mapa y cutscenes en un solo runtime.
- **Flujo:**
  1. Panel de nodos: *Eventos* (onEnterZona, onInteract, onKill, onTimer), *Condiciones* (distancia, hp, switch/var, questStage), *Acciones* (mover, atacar, dar item, sonido, diálogo, flag), *Variables/Flujo* (branch, wait, for, math).
  2. Crear nodos con clic/drag → arrastrar pin → soltar en pin para conectar.
  3. Guardar como **bloque reutilizable** → aparece en la librería predefinida (6.17).
- **Dos niveles de dificultad:**
  - **Modo fácil:** formulario tipo RPG Maker ("en esta zona → al entrar → mostrar diálogo") que **genera el grafo** por detrás.
  - **Modo avanzado:** editor de grafos completo.
- **I/O:** `blueprints[]`; referenciado desde quests, diálogos, AI, zones y cutscenes.
- **Runtime compartido:** `src/game/visualscript/` ejecutado por ambos motores.

### 6.15 Tipografías DOS / Font Manager — 🆕
- **Objetivo:** caja de fuentes pixeladas y gestor de tipografía para HUD, diálogos, banners y menús.
- **Justificación:** el 90% de la identidad visual retro es la letra (VGA 8×16, menús DOS). Sin tipos de época el juego no "se siente" de los 90.
- **Contenido incluido:** bundle de fuentes de dominio público/OFL — `Px437` (DOS VGA), `VT323`, `Press Start 2P` — empotradas en el motor.
- **Flujo:** elegir fuente → crear "estilos de texto" (tamaño, color, sombra) → aplicar a HUD/diálogo/banners → **convertidor TTF→bitmap** (rasteriza a atlas pixelado con `imageSmoothing=false`).
- **I/O:** `fonts[]` + `textStyles[]` + atlas → Asset Manager. El runtime dibuja texto con canvas sobre atlas bitmap (sin CSS en los juegos).

### 6.16 Pantallas de carga / Loading Editor — 🆕
- **Objetivo:** editor de pantallas de carga: splash + barra de progreso + consejos.
- **Justificación:** todo RPG de la época tiene pantalla de carga; además el Player muestra algo mientras precarga texturas/audio.
- **Flujo:** imagen o color → barra de progreso / ruleta / "tips aleatorios" → tiempo mínimo de display → previsualizar.
- **I/O:** `loading[]`. El runtime precarga mostrándola; el Publisher la usa como pantalla del HTML autónomo.

### 6.17 Bloques predefinidos reutilizables — 🆕
- **Objetivo:** bloques listos que combinan **animación + comportamiento**: abrir/cerrar puertas, movimientos de enemigos (patrulla, zigzag, emboscada), movimientos de combate (carga, retroceso, crítico), saltos, elevador, antorcha parpadeante, teletransporte, cofre al abrir.
- **Justificación:** "fácil = arrastrar y unir". El creador no monta puertas/IA de cero.
- **Flujo:** Entity Builder o Level Editor → "Añadir bloque predefinido" → buscar por categoría → arrastrar sobre entidad → configurar pocos parámetros.
- **Implementación:** sub-grafos de blueprint o animation clips empaquetados en `src/data/blocks/` (biblioteca incorporada + extensible). El editor los muestra como fichas de puzzle.
- **I/O:** `blocks[]` / `prefabs[]`, referenciados desde `entities[]` y `map.zones[]`.

### 6.18 Project Manager / Launcher — 🆕
- **Objetivo:** crear, abrir, duplicar, importar/exportar y configurar proyectos (renderMode, resolución, autor).
- **Justificación:** organización de la unidad de trabajo; con el backend (visión §15) la unidad vive en el servidor y es multidispositivo.
- **Flujo:** landing → nuevo proyecto (plantilla del servidor) → elegir modo (`retro`/`3d`) → proyecto de arranque con assets de ejemplo → guardar en la API.
- **Persistencia:** CRUD vía `/api/projects` + `/api/assets` (visión §15); export/import a `*.ragproj` (zip) para backup, compartir y commitear.

### 6.19 Publisher — 🆕
- **Objetivo:** exportar el juego a un HTML autónomo (bundle JS + assets usados + audio + fuentes + pantalla de carga) **y**, con cuenta, publicarlo en la galería.
- **Justificación:** el "cierre" del creador; el HTML sigue funcionando sin cuenta ni servidor.
- **Flujo:** seleccionar proyecto → build optimizado (tree-shake del motor dual según `renderMode`) → descarga `mi-juego.html` → jugar/compartir; o **Publicar en galería** → el juego queda jugable en `/play/:slug`.

### 6.20 Game Library / DB Manager — 🆕
- **Objetivo:** biblioteca personal de juegos del creador, servida por la API: listar, buscar, duplicar, respaldar y borrar proyectos de cualquier dispositivo con la misma cuenta.
- **Justificación:** el multidispositivo es la razón del backend; sin una biblioteca gestionable, los proyectos quedarían dispersos.
- **Flujo:** grid de proyectos (thumbnail, nombre, `renderMode`, fecha, tamaño) → filtro/búsqueda → crear/duplicar/renombrar → abrir en editor → **backup/restore `.ragproj`** → borrar con confirmación.
- **I/O:** `/api/projects` (CRUD), `/api/assets` (blobs), thumbnail autogenerado por el runtime.

### 6.21 Cloud Gallery — 🆕
- **Objetivo:** publicar juegos en una galería pública con URL jugable (`/play/:slug`), portada y estadísticas.
- **Justificación:** el backend habilita que los juegos se *jueguen online* sin que el autor tenga servidor propio; convive con el HTML autónomo.
- **Flujo:** Publish → "Publicar en galería" (slug, descripción, portada) → vista pública jugable (mismo runtime que el editor) → contador de visitas → despublícar cuando se quiera.
- **I/O:** `gallery` (slug, description, visits) + el `project.json` v2 de la fila de `projects`. Reutiliza el build optimizado de 6.19.

### 6.22 Design System / Componentes reutilizables — 🆕
- **Objetivo:** paleta de colores (tokens CSS), tipografía, espaciado, y catálogo completo de componentes UI reutilizables para todo el Studio.
- **Justificación:** sin un design system, cada herramienta inventa su UI → inconsistencia visual, duplicación de código, y más trabajo para mantener. Un sistema de componentes unificado permite construir herramientas rápidamente con look profesional.
- **Componentes:**
  - **Botones:** Primary, Secondary, Danger, Ghost, Icon (5 variantes × 3 tamaños × 4 estados)
  - **Inputs:** TextInput, NumberInput, Select, Checkbox, Slider, ColorInput, FileInput
  - **Tabs:** headers con contenido, scrollable si exceden
  - **Tablas:** sortable, selectables, empty state
  - **Modales:** overlay + dialog con focus trap, animaciones
  - **Toasts:** success, warning, error, info con auto-dismiss
  - **Loading:** Spinner circular, Skeleton shimmer, Progress bar
  - **Estados:** Vacío (icono + acción), Error (detalle + reintentar), Carga (spinner + texto)
  - **Iconos:** lucide SVG inline (16×16, 20×20), hereda color del padre
  - **Layout:** Panel (header colapsable), SplitView (redimensionable), Stack, ScrollArea, Divider
- **Flujo:** ver `DESIGN.md` para paleta, tipografía, espaciado y patrones de comportamiento.
- **I/O:** `src/studio/ui/` — componentes vanilla JS, migrables a Lit/Svelte.
- **Entregable:** demo page (`/components`) que muestra todos los componentes en todos sus estados.

---

## 7. Flujo end-to-end del creador

```
1. Game Library: login → nuevo proyecto desde plantilla (elijo "3d")
2. Asset Manager: arrastro texturas + sprites Daggerfall
3. Sprite pipeline: slicer → animator → entity builder
4. Level Editor: pinto muros, doy altura al piso, hago una rampa, coloco la cámara
5. Playtest (F5): camino por la rampa y subo de planta  ✔ verticalidad
6. Blueprint: arrastro nodos → enemigo idle→chase→attack (o uso un bloque predefinido)
7. Dialogue/Quest/Items: NPC con tienda y una misión de entrega
8. Font Manager: tipografía DOS para el HUD
9. Loading Editor: pantalla de carga con el logo
10. Publisher → HTML jugable con su pantalla de carga, o Publicar en galería (/play/:slug)
```

---

## 8. Fases de implementación (histórico / visión)

> **Este orden fue sustituido por el nuevo esquema de §14–§15 (motor JS vanilla primero, Studio después).** Las fases originales se conservan aquí como parte de la *visión a largo plazo* del Studio y los sistemas RPG; no reflejan trabajo ya hecho (el repo aún no tiene código).

| Fase | Entregable | Depende de | Criterio de aceptación |
|------|-----------|-----------|------------------------|
| **F0** | *(histórica)* Toolchain Vite+TS+Vitest; migrar raycaster a `src/render/retro/`; mapa a `project.json`; tests base; Launcher mínimo | — | *(reformulado: ver objetivo del Studio en §15, F3)* |
| **F0.5** | *(histórica)* **Backend + base de datos**: API Hono+**Prisma**+Postgres (auth JWT, CRUD de `/api/projects` y `/api/assets`, `/api/templates` seed, `/api/gallery`); **Game Library 6.20**; migración a **schema v2** + de-hardcoding del motor (piso/techo, flags de sprite, minimapa) | F0 | *(reformulado: parte de la visión a largo plazo, tras el motor JS vanilla)* |
| **F0.7** | **Design System + componentes reutilizables**: paleta de colores (tokens CSS), tipografía, espaciado, y componentes UI: botones (5 variantes), inputs (text, number, select, checkbox, slider, color, file), tabs, tablas, modales, toasts, spinners, skeletons, progress bars, estados (vacío, error, carga), iconos (lucide SVG), layout helpers (Panel, SplitView, Stack, ScrollArea, Divider). Ver `DESIGN.md`. | F0.5 | Todos los componentes renderizados en una **demo page** (`/components`); paleta dark consistente; cada componente con 3+ estados (default, hover, disabled); atajos de teclado documentados |
| **F1** | **Level Editor + viewport 3D + playtest** | F0.7 | Pinto un mapa con rampas/pisos, lo camino en 3D y guardo/cargo (por API) |
| **F2** | Motor 3D jugable: sector system, colisión por altura, gravedad/saltos (física cinemática), sprites billboard, minimapa 3D, **módulo de audio** (Web Audio espacial) | F1 | Rampa, escaleras y piso superior en vivo; sprites bien ocluidos; sonido espacial |
| **F3** | *(visión)* Sprite Splicer + Animator + Entity Builder (6.1–6.3); Asset Manager (texturas/sprites/audio/fuentes); **Font Manager DOS** + convertidor TTF→bitmap; **pantallas de carga** | F0 | Daedroth animado en el editor; HUD con tipo DOS; pantalla de carga configurable |
| **F4** | **Blueprint Editor completo + runtime**; pathfinding A*; IA construida sobre blueprints; **catálogo base de bloques** (puertas, patrulla, carga de combate, salto, antorcha, teletransporte); puertas/llaves/elevadores via bloques | F2, F3 | Enemigo con IA de blueprints persigue/ataca; puerta con llave; bloque predefinido arrastrado a una entidad |
| **F5** | Combate + inventario/equipo (sobre blueprints) | F4 | Matar enemigo → loot al inventario |
| **F6** | Magia y habilidades (spells, mana, efectos, FX) | F5 | Hechizo de fuego hace daño y cuesta mana |
| **F7** | Diálogos (nodos + condiciones/acciones → blueprints) | F4 | NPC con árbol de diálogo y condición |
| **F8** | Misiones (etapas/condiciones/recompensas → blueprints) | F5, F7 | Quest completa de inicio a fin con consola de depuración |
| **F9** | Comercio (tiendas, moneda, restock, NPC vendedor) | F5 | Compra/venta en tienda con moneda y restock |
| **F10** | Progresión (clases, atributos, XP, skills, subida de nivel) | F6, F8 | Subir de nivel, puntos de skill, curva XP |
| **F11** | Editor de **catálogo de bloques propios** (publicar bloques reutilizables); cutscenes/eventos avanzados | F4 | Creador agrupa nodos como bloque y lo reutiliza en otro mapa |
| **F12** | **Publisher**: HTML autónomo con pantalla de carga y solo lo usado (tipos, audio, fuentes, blueprints) + **publicación en la galería** (`/play/:slug`) | todas | HTML exportado juega igual que el dev; y un proyecto publicado en la galería es jugable online |

Verificación continua: `vitest run` + demo jugable; cada fase cierra con una demo en `localhost:8080`.

---

## 9. Herencia de `SPRITE_TOOLS_PLAN.md` (visión histórica, se construye desde cero)

El plan anterior era *solo* herramientas de sprites para un motor estático. Su intención se conserva como **visión**: las herramientas de sprites y el sprite system del motor se construyen desde cero (no existe `tools/` ni código previo), integrados en el Studio TS y en el motor JS vanilla (§13–§15):

| Antes (SPRITE_TOOLS_PLAN) | Estado | Ahora (ROADMAP) |
|---|---|---|
| Fase 1 — Sprite Slicer + background removal | 🆕 **DESDE CERO** (no existe `tools/sprite-slicer.js`) | **6.1** → **SpriteSplicer**: crear desde cero en TS bajo `studio/sprite-tools/` |
| Fase 2 — Sprite Animator | 🆕 **DESDE CERO** | **6.2** |
| Fase 3 — Entity Builder | 🆕 **DESDE CERO** | **6.3** |
| Fase 4 — SpriteSystem del motor | ⏳ pendiente | Pasa a **engine/ sprites.js** (sprites billboard con Z-buffer) en F1–F2 |
| Fase 5 — UI de herramientas | ⏳ pendiente | Su layout se reutiliza como *chrome* base del Studio (paneles / viewport), §15 |
| Fase 6 — Mapa de ejemplo | ⏳ pendiente | Se convierte en la **plantilla de arranque** de proyectos nuevos |

La diferencia estructural: el pipeline de sprites pasa de ser el fin a ser **una fase temprana de un sistema completo de creación de RPG**, con el modelo de datos unificado como columna vertebral.

---

## 10. Estructura de directorios objetivo

> **Estructura de dos capas (ver §13).** El **motor del juego vive aislado en `engine/` en JS vanilla puro** (sin TS, sin build, sin dependencias; la demo se abre directo). El **Studio vive en `src/` con TypeScript + Vite** y consume el motor como una biblioteca más. No hay `tools/` "heredado": los asset-tools son parte del Studio.

```
raycastjs/
├── engine/                     ← MOTOR DEL JUEGO · JS vanilla puro, aislado
│   ├── core/                   → math.js · camera.js · dda.js · projection.js
│   │                            → textures.js · sprites.js (un archivo por pieza)
│   ├── Raycaster.js            → clase principal (consume project.json → render)
│   └── index.js                → API público del motor (ESModules)
├── demo/                       ← consumidor: arma un project.json y el loop
│   ├── index.html              → se abre directo (<script type="module">)
│   ├── main.js                 → importa engine, lanza el juego
│   └── project.json            → mapa + texturas de la demo (datos, no lógica)
├── studio/  (src/)             ← STUDIO · TypeScript + Vite (herramientas de creación)
│   ├── src/
│   │   ├── main.ts · style.css · api/client.ts
│   │   ├── data/               → schemas (Zod), loaders, migraciones, blocks/
│   │   ├── ui/                 → 6.22 Design System (botones, inputs, tabs, tablas, modales, toasts, spinners, iconos, layout)
│   │   ├── asset-manager/      → 6.4
│   │   ├── sprite-tools/       → 6.1 SpriteSplicer + 6.2 animator + 6.3 entity builder
│   │   ├── level-editor/       → 6.5 vista 2D + viewport + playtest (consume engine)
│   │   ├── blueprints/         → 6.14 editor de grafos (Unreal-style)
│   │   ├── ai-editor/ quest-editor/ dialogue-editor/
│   │   ├── combat-editor/ magic-editor/ economy-editor/
│   │   ├── progression-editor/ events/  blocks-catalog/
│   │   ├── font-manager/       → 6.15 tipografías DOS + convertidor TTF→bitmap
│   │   ├── loading-editor/     → 6.16
│   │   └── publisher/          → 6.19 HTML autónomo + 6.21 galería
│   ├── vite.config.ts · tsconfig.json · index.html
│   └── tests/                  → Vitest (front)
├── public/
│   ├── textures/
│   └── projects-demo/          → ejemplos exportados
├── assets/
│   ├── images/daggerfall/      → referencia de prueba (NO versionado)
│   └── fonts/                  → fuentes DOS empotradas (Px437, VT323, Press Start 2P)
├── server/                     → visión: API + Postgres (backend del Studio y Game Library)
│   ├── src/                    → index.ts · auth/ · routes/ · middleware/
│   ├── db/                     → Prisma schema + migraciones + cliente
│   ├── storage/uploads/        → blobs
│   └── tests/                  → tests de API (Vitest + app Hono)
├── docker-compose.yml          → postgres + api + web (visión)
├── .env.example                → DATABASE_URL · JWT_SECRET · PORT · PUBLIC_URL
├── package.json · opencode.json
└── ROADMAP.md
```

> Nota: `engine/` y `demo/` son lo primero (F1–F2). El resto (Studio `src/`, `server/`, Docker, etc.) es visión a largo plazo (§15).

---

## 11. Principios de calidad

- **Energía por mantenimiento:** una prueba que falla = feature no cerrada.
- **Cero duplicación retro/3d:** todo, salvo render, vive una vez.
- **Assets bajo demanda:** el Publisher solo empaqueta lo usado.
- **Reutilizar antes que crear:** Three.js, Vitest, Zod, Web Audio API, Hono, Prisma, PostgreSQL… (regla ponytail: no reinventar stdlib).
- **Servidor desacoplado por API REST:** el Studio habla solo con `/api/*`; cambiar de host/base de datos no toca el front (la SPA es estática y sirve desde cualquier lugar).
- **Drag & drop como estándar de UX:** assets al viewport, bloques a entidades, nodos conectados con cables.
- **Fidelidad retro en cada detalle:** tipografías DOS, pantallas de carga, ruido del píxel.

---

## 12. Estado del plan

> **Reinicio desde cero.** El repositorio aún no contiene código (no hay commits). La documentación previa describía un estado F0/F0.5 que no existe en el código; el plan se reformula con el **motor del juego en JS vanilla puro aislado** y el **Studio en TypeScript/Vite** como dos capas separadas que se comunican por datos (`project.json`). Ver §13.

| Fase | Estado |
|---|---|
| F1 Motor de raycast base en **JS vanilla** (de Lode) | ✅ Validada |
| F2 Verticalidad / 3D (sector system) sobre el motor F1 | ✅ Migración completada |
| **F2.5 Motor de sectores poligonales: rampas/escaleras reales + sprites billboard + física de rampa** | **✅ Validada** |
| **F2.6 Terreno procedural: Simplex noise + generador de grilla + texturas por pendiente** | **✅ Realizada** |
| F3 Studio TypeScript/Vite: Asset Manager + Sprite tools + Fonts + Loading | ⏳ Pendiente |
| F4 Studio: Level Editor + viewport + playtest | ⏳ Pendiente |
| F5 Blueprints + IA + bloques predefinidos | ⏳ Pendiente |
| F6–F13 Sistemas RPG y Publisher | ⏳ Pendiente |

Ver `README.md` para el estado real del repo y la estructura de capas.

---

## 13. Arquitectura en dos capas (rector)

> **El proyecto se organiza en dos capas separadas que se comunican solo por datos.** La regla del ROADMAP se mantiene: *las herramientas escriben datos, los motores leen datos* (§1). El `project.json` es el contrato desacoplado entre ambas.

```
┌─ STUDIO (TypeScript + Vite)  ─── herramientas de creación / interfaz ─┐
│  Asset Manager · Sprite tools · Level Editor · Blueprint Editor ·      │
│  Quest/Dialogue/Combat/Fonts/Loading/Publisher · Design System         │
└───────────────┬───────────────────────────────────────────────────────┘
                │  escribe / prepara DATOS (project.json + assets)
┌───────────────▼───────────────────────────────────────────────────────┐
│  MOTOR DEL JUEGO (JS vanilla puro, aislado e independiente)           │
│  procesa y renderiza: Three.js + sector system · ECS · física ·     │
│  audio · visualscript · sistemas RPG                                   │
│  sin TypeScript, sin build, sin framework; sin acoplarse a ninguna UI  │
└───────────────┬───────────────────────────────────────────────────────┘
                │  lee el mismo project.json
        DEMO / PLAYER  (consumidor)  ← también el Studio consumirá el motor
```

### Reglas de la arquitectura de capas

- **El motor es 3D (Three.js)**: el render es exclusivamente Three.js/WebGL. No hay modo retro paralelo en el motor; el look and feel es de perspectiva real con verticalidad. Si en el futuro se quiere un modo retro, se implementaría como un modo de render alternativo sobre el mismo core, no como motor dual independiente.
- **Consumidores del motor**: primero la **demo** (`demo/`), después el **Studio** (`studio/`) y el **Player/Publisher**. Todos tienen el mismo rol: alimentar datos al motor y orquestar el loop; ninguno contiene lógica de motor.
- **La demo** solo importa el motor y llama a sus funciones/clases para construir la escena: construye un `project.json` de ejemplo, instancia la clase del motor y lanza el loop. No reimplementa nada del renderizado.
- **El Studio (TS/Vite) es otro consumidor** que, a partir de *arrastrar y unir* (principio de UX §1), construye el `project.json` y se lo pasa al motor. El creador de juegos nunca escribe código.
- **Interfaz del motor = datos + clase**: el motor expone una clase principal que consume el `project.json` declarativo y hace todo el procesado aislado. No expone funciones puras que obliguen al consumidor a conocer el flujo interno, porque eso contradice el objetivo *sin código* (un editor visual no debe saber el "cómo" del motor).

### Dudas y decisiones

Para aprender el motor a fondo se rehace en JS vanilla el motor clásico de **Wolfenstein 3D** siguiendo el tutorial de **Lode** (raycasting en C++ → portado a JS vanilla). A partir de ahí se le añade **verticalidad** para convertirlo en un motor 2.5D/3D (estilo Doom → Daggerfall).

---

## 14. Construcción del motor por fases (JS vanilla, desde cero)

### F1 — Motor de raycast base (JS vanilla, siguiendo a Lode)

Se reconstruye el raycaster del tutorial *"Raycasting"* de Lode's Computer Graphics Tutorial ([raycasting.html](https://lodev.org/cgtutor/raycasting.html), continuado en [raycasting2.html](https://lodev.org/cgtutor/raycasting2.html) y [raycasting3.html](https://lodev.org/cgtutor/raycasting3.html)) en **JavaScript vanilla puro**, para conocer cada concepto a fondo que se va a extrapolar a la verticalidad después.

**Estructura (motor aislado en `engine/` + consumidor en `demo/`):**
```
engine/                  ← lógica del motor, aislada (ESModules, import/export)
├── core/                ← piezas puras del algoritmo
│   ├── math.js          ← vectores, rotación (matriz 2x2), utilidades
│   ├── camera.js        ← posición 2D + dirección + plano de cámara del jugador
│   ├── dda.js           ← algoritmo DDA: sideDist/deltaDist/step/map (hallar muro)
│   ├── projection.js    ← perpWallDist (sin efecto ojo de pez), lineHeight
│   ├── floorcasting.js  ← suelos/techos por scanlines (posZ, rowDistance)
│   ├── zbuffer.js       ← Z-buffer 1D por columna (base de oclusión y sprites)
│   ├── textures.js      ← carga y mapeo de texturas (wallX, texX/texY)
│   └── sprites.js       ← sprites billboard (proyección, ordenado por distancia, Z)
├── Raycaster.js         ← clase principal: consume project.json → render(ctx)
└── index.js             ← exporta el API público del motor

demo/                    ← consumidor de solo "pegado"
├── index.html           ← abrible directo en el navegador (ESModules)
├── main.js              ← importa el motor, arma un project.json de ejemplo y el loop
└── project.js (o data)  ← mapa + texturas de la demo (datos, no lógica)
```

**Pasos de F1 (mapeados al tutorial de Lode), cada uno con su demo verificable. Todo incremental, cada paso suma una pieza y deja la demo jugable. **[PASOS 1-6 COMPLETADOS Y VALIDADOS]**. El paso 7 (sprites con oclusión zbuffer, escalado y desplazamiento vertical) y el paso 8 (refactor API + project.json) están planeados para completar F1, pero el núcleo funcional del motor ya está operativo con los pasos 1-6. Véase la fase F2 para la continuación del proyecto con sistemas de sprites, IA y nivelador.
1. **Raycaster sin textura** — mapa 2D grid (`0`=vacío, `>0`=muro), DDA para colisión de rayos por columna, `perpWallDist` (distancia al plano de cámara, sin fisheye), `lineHeight`/`drawStart`/`drawEnd`, color por tile + oscurecido según lado (x/y).
2. **Cámara y FOV vectoriales** — dirección + plano de cámara perpendiculares, `cameraX = 2x/w - 1`, rayos `dir + plane*cameraX`, rotación con la matriz 2x2.
3. **Input y colisión** — mover (adelante/atrás) y rotar (izq/der) con `frameTime` (velocidad independiente de la CPU), colisión simple contra muros.
4. **Con texturas** — buffer de pantalla, texturas 64×64, `wallX`, `texX`/`texY` con `step` y `texPos` (affine mapping), oscurecer lados "y". **El motor acepta dos fuentes de textura por tile** (definidas en `project.json`): (a) un **color base** → genera textura sintética (sombreado procedimental, sin assets) y (b) una **ruta de imagen** → carga un PNG/SVG real (`<img>` + canvas → matriz de píxeles 64×64). La carga es asíncrona (`Raycaster.load()` → `render()`). Esto sienta la base de que **cada superficie (pared, suelo, techo, puerta, sprite, objeto) pueda tener su propia textura** referenciada por datos en el `project.json`, que es como lo consumirá el Studio (F6.x Asset Manager + Level Editor) más adelante.
5. **Suelo y techo (floor/ceiling casting)** — *[Lode II]* suelos y techos con textura por **scanlines horizontales**: `posZ` (altura del ojo en el eje Z), `rowDistance = posZ / p`, `floorStep`, mapeo de texel (`cellX/cellY`, `tx/ty`, checkerboard). **Introduce el eje Z y la altura del jugador**, la base sobre la que F2 construye toda la verticalidad.
6. **Z-buffer 1D** — mientras se raycastan muros, guardar `perpWallDist` por columna en `zbuffer[]`. No es visual por sí solo; es la herramienta de oclusión que usan los sprites (y luego la verticalidad).
7. **Sprites** — *[Lode III]* sprites billboard (enemigos/objetos 2D): proyectar con la inversa de la cámara, ordenar de lejos a cerca por distancia, y dibujar **solo donde `transformY < ZBuffer[stripe]`** (ocluidos por muros). Incluye: **escalado `uDiv`/`vDiv`**, **desplazamiento vertical `vMove`/`vMoveScreen`** (ancla el sprite a una altura Z: flota, cuelga, se hunde), **transparencia/translucidez** y color invisible.
8. **Refactor a API de clase + project.json** — extraer toda la lógica a `engine/` y dejar `demo/` como mero consumidor de la clase `Raycaster`. El `project.json` pasa a describir el mundo (mapa, alturas, sprites con `pos.z`, flags) en vez de datos embutidos.

**Alcance explícito (JS vanilla puro):** sin TypeScript, sin build, sin framework, sin librerías. La demo se abre directo con `<script type="module">`.

### F2 — Verticalidad / 3D puro WebGL/Three.js

Migrar el motor de un **raycaster Canvas** a un **motor 3D real con WebGL/Three.js**. Se abandona el render por columnas (DDA/floorcasting) y se adopta un pipeline poligonal único: geometría por sectores con `floorH`/`ceilH`, cámara en perspectiva real, iluminación básica y texturas SVG. El objetivo es eliminar la duplicidad de render y tener una sola representación del mundo.

> **Decisión:** motor único 3D (Three.js). No hay modo retro paralelo. El look and feel es perspectiva real con verticalidad.

**Estructura del motor 3D:**

```
engine/
├── core/
│   ├── math.js          → utilidades (rotación 2D)
│   └── player.js        → posición (X,Y,Z), yaw/pitch, movimiento, colisión, step height, gravedad
├── three/
│   └── Renderer3D.js    → escena Three.js, mallas por sector, cámara sincronizada, luces
├── Engine3D.js          → orquestador: carga texturas, construye mundo, expone player + renderer
└── index.js             → API pública: Engine3D, Player, Renderer3D
```

**Pasos de implementación (realizados):**

1. **Core 3D del jugador** — `Player` reemplaza al modelo `dir/plane` 2D del raycaster. Usa `{posX,posY,posZ,yaw,pitch}`, movimiento relativo a la orientación, colisión contra tile y física vertical (`stepHeight` + `gravity` + `updateZ`).
2. **Renderer Three.js por sectores** — por cada tile se genera una malla: muros como cajas con altura `ceilH - floorH`, suelo/techo como planos a la altura del sector. Las texturas SVG se cargan con `THREE.TextureLoader`.
3. **Orquestador `Engine3D`** — consume `project.json`, instancia `Player` y `Renderer3D`, y expone `update()` + `render()` para el loop de juego.
4. **Eliminación del path retro** — se borran `Raycaster.js`, `core/dda.js` (`castRay`), `core/projection.js`, `core/floorcasting.js`, `core/textures.js` (ImageData) y `core/camera.js` 2D.
5. **Demo 3D** — `demo/main.js` usa WASD + ratón (pointer lock) para mover al jugador en el mundo 3D; `demo/project.js` define sectores con alturas variables (plataforma elevada, zona baja).

**Verificación de F2:** la demo `demo/index.html` muestra un mundo 3D en perspectiva real donde el jugador recorre el mapa, **sube a una plataforma elevada** (`stepHeight`), **cae a una zona más baja** (`gravity`) y los muros/suelos/techos respetan las alturas de sector. Los tests del engine pasan (`npm run test:engine`).

> **Nota técnica:** aunque F1 se aprendió con el tutorial de Lode (raycasting), F2 lo abandona como renderer. El conocimiento adquirido (cámara vectorial, DDA, proyección) se traduce al modelo 3D: la física de colisión sigue siendo tile-based, pero el dibujado es poligonal vía Three.js. El `project.json` mantiene `map`, `sectorMap` y `sectors` como fuente de verdad.

---

### F2.5 — Motor de sectores poligonales (estilo Build/XnGine)

> **Objetivo:** evolucionar el motor 3D actual (grid de tiles con alturas) hacia un sistema de **sectores poligonales 2D extruidos en 3D**, con paredes como segmentos de línea, pisos/techos inclinados, rampas/escaleras poligonales reales, sprites billboard y física continua contra la geometría. Estos cambios mejorarán la base del motor y sentarán las bases reales para el estilo Daggerfall/XnGine.
>
> **Alcance explícito:** generación procedural y streaming quedan fuera de esta fase (se abordarán más adelante).

#### 1. Nuevo modelo de datos: `project.json` schema v3

Reemplazar el grid `map`/`sectorMap` por un modelo de sectores y paredes:

```jsonc
{
  "meta": { "name", "schemaVersion": 3, "renderMode": "3d" },
  "camera": { "posX", "posY", "posZ", "yaw", "pitch" },
  "world": {
    "vertices": [ { "id", "x", "y" } ],
    "sectors": [
      {
        "id",
        "vertexIds": [ ... ],
        "floorH": 0.0,
        "ceilH": 3.0,
        "floorSlope": { "axis": "x"|"y", "angle": 0 }, // opcional
        "ceilSlope": { "axis", "angle" },
        "floorTex": "id",
        "ceilTex": "id",
        "wallTex": "id"
      }
    ],
    "walls": [
      {
        "id",
        "a": "vertexId",
        "b": "vertexId",
        "sectorFront": "sectorId",
        "sectorBack": "sectorId"|null,  // null = sólido
        "tex": "id",
        "portal": false
      }
    ],
    "ramps": [
      {
        "id",
        "sectorId": "...",
        "type": "slope"|"stairs",
        "direction": { "x", "y" },
        "rise": 1.0,
        "run": 2.0,
        "tex": "id"
      }
    ],
    "sprites": [
      {
        "id",
        "tex": "id",
        "pos": { "x", "y", "z" },
        "scale": 1.0,
        "billboard": true
      }
    ],
    "textures": { ... }
  }
}
```

Tareas concretas:
- Definir schema v3 en la documentación del motor.
- Crear migrador automático v2 → v3 que convierta el grid actual en sectores cuadrados con paredes.
- Validar que cada pared referencie vértices y sectores existentes.

#### 2. Geometría poligonal (`engine/three/WorldMesh.js`)

Rehacer `WorldMesh` para construir mallas a partir de sectores y paredes:

- Triangulación de sectores mediante **fan triangulation** (solo sectores convexos).
- Generación de quads verticales para cada pared, desde `sector.floorH` hasta `sector.ceilH`.
- Si una pared tiene `sectorBack`, actúa como portal: no se genera quad sólido.
- Soportar pisos y techos inclinados aplicando `floorSlope`/`ceilSlope` a los vértices del polígono.
- Un `BufferGeometry` por sector (suelo/techo) y uno por pared.
- Materiales por superficie según `project.json`.

Tareas concretas:
- Crear `engine/three/SectorGeometry.js`.
- Implementar triangulación fan para sectores convexos.
- Implementar extrusión de paredes con portales.
- Tests unitarios de triangulación y extrusión.

#### 3. Rampas y escaleras poligonales reales

Dos estrategias, igual que Daggerfall:

- **Rampas como sector con slope:** superficie inclinada lisa generada por `floorSlope`. Opcionalmente se le aplica una textura que dibuje peldaños 2D ("textura engañosa") para ahorrar polígonos.
- **Escaleras como entidad poligonal:** campo `ramps[]` con `type: "stairs"`. `WorldMesh` genera una trama de peldaños, cada uno con cara vertical y horizontal, combinados en una sola malla.

Tareas concretas:
- Añadir soporte de `floorSlope`/`ceilSlope` en sectores.
- Crear `engine/three/StairsMesh.js`.
- Añadir campo `ramps[]` al schema v3.
- Demo con una rampa lisa y una escalera de peldaños reales.

#### 4. Física continua contra sectores (`engine/core/physics.js` + `collision.js`)

Reemplazar la física tile-based por física de sectores:

- **Bounding box/cápsula vertical del jugador:** `height`, `radius`, `eyeOffset`. La posición representa la base de la cápsula.
- **Colisión horizontal:** círculo del jugador contra segmentos de pared sólida del sector actual, con vector de deslizamiento.
- **Raycast al suelo:** desde la base de la cápsula hacia abajo, calcular altura del suelo en `(posX, posY)`:
  - Sector plano: `sector.floorH`.
  - Sector inclinado: interpolar altura sobre el triángulo bajo el jugador.
  - Escalera: altura del peldaño bajo el jugador.
- **Subida/bajada:** `stepHeight` para pequeños desniveles; gravedad cuando no hay suelo; al subir una rampa se proyecta el movimiento sobre el plano inclinado; al bajar se sigue la superficie.
- **Colisión con techo:** bloquear movimiento vertical si la cápsula intersecta el techo.
- **Cambio de sector:** point-in-polygon para determinar sector actual; cruzar portales cambia al sector trasero.

Tareas concretas:
- Crear `engine/core/sector.js` (point-in-polygon, altura en punto, etc.).
- Reescribir `collision.js` para colisión círculo-segmento.
- Reescribir `physics.js` con deslizamiento, raycast al suelo y gravedad.
- Tests unitarios por cada mecánica.

#### 5. Sprites billboard (`engine/three/SpriteSystem.js`)

- Cargar texturas de sprites desde `project.json`.
- Crear `THREE.Sprite` o planos billboard que siempre miren a la cámara.
- Posicionar en coordenadas 3D reales (`x`, `y`, `z`).
- Oclusión por z-buffer de WebGL.
- Escalado y transparencia.

Tareas concretas:
- Crear `engine/three/SpriteSystem.js`.
- Cargar sprites en `Engine3D.load()`.
- Actualizar orientación de billboards en cada frame.
- Demo con al menos un sprite.

#### 6. Integración con `Engine3D.js` y demo

- `Engine3D` consume el nuevo `project.json` v3.
- `WorldMesh.build` recibe sectores/paredes en lugar de grid.
- El loop de juego usa la nueva física.
- La demo debe incluir: 2–3 sectores poligonales conectados por portales, una rampa lisa, una escalera de peldaños y un sprite billboard.

Tareas concretas:
- Actualizar `Engine3D.js`.
- Actualizar `demo/project.js` a schema v3.
- Asegurar que la demo se abre directo sin build.

#### 7. Tests (`test/engine/`)

Mínimos obligatorios:

- Triangulación fan de sector convexo.
- Extrusión de paredes desde vértices.
- Point-in-polygon para determinar sector.
- Altura en punto de suelo inclinado.
- Colisión círculo-segmento.
- Deslizamiento al chocar con pared.
- Raycast al suelo sobre escalera.
- Sprite billboard mira a cámara.

#### 8. Criterio de aceptación de F2.5

La demo `demo/index.html` debe permitir que el jugador:

- Camine entre sectores poligonales conectados por portales.
- Suba una rampa lisa sin atascarse ni atravesar geometría.
- Suba una escalera de peldaños reales.
- Vea un sprite billboard siempre de frente.
- No caiga fuera del mundo ni atraviese paredes.
- Todos los tests de `test/engine/` pasen.

> **Nota:** generación procedural, streaming y culling por portales/PVS quedan fuera de esta fase. Three.js ya realiza frustum culling por GPU, lo cual es suficiente para el alcance actual.

---

## 15. Fases del proyecto (reformuladas desde cero)

> El stack grande documentado antes (TypeScript+Vite+Vitest, backend Hono+Prisma+Postgres, Game Library, Design System, Publisher) se **reformula como visión a largo plazo** que nace *después* del motor JS vanilla. El orden real de trabajo ahora es:

| Fase | Entregable | Depende de | Criterio de aceptación |
|------|-----------|-----------|------------------------|
| **F1** | **Motor de raycast base JS vanilla** (engine/ + demo/, según §14) | — | La demo `demo/index.html` muestra y recorre un mundo raycast con texturas y sprites, abriéndola directo, sin build; toda la lógica vive en `engine/` aislada |
| **F2** | **Verticalidad/3D** sobre el motor F1 (incremental: suelos/techos por sector → colisión por altura/pasos → escaleras → aberturas/portales → rampas → iluminación) | F1 | Se sube a una plataforma elevada, se sube/baja una escalera, hay objetos anclados a distinta altura y se ve otro sector por una abertura; el motor sigue aislado, sin dependencias |
| **F2.5** | **Motor de sectores poligonales** (estilo Build/XnGine): rampas/escaleras reales, sprites billboard, física de rampa | F2 | Se recorren sectores poligonales conectados por portales, se sube una rampa lisa, una escalera de peldaños, se ven sprites billboard; todos los tests del engine pasan |
| **F3** | **Studio TS/Vite arranca**: toolchain (Vite+TS+Vitest), Asset Manager, Sprite tools, Font manager, Loading editor | F2.5 | El Studio (TS) consume el motor JS vanilla; un asset se importa y aparece en la demo/playtest |
| **F4** | Studio: **Level Editor** (mapa + sectores + verticalidad) + viewport + playtest en vivo | F3 | Pinto un mapa con rampas/pisos en TS, lo camino en el motor JS vanilla y guardo/cargo `project.json` |
| **F5** | **Blueprint Editor + runtime** (visual scripting, sin código) + IA + catálogo de bloques | F4 | Un enemigo con blueprints persigue/ataca; bloque predefinido arrastrado a una entidad |
| **F6–F13** | **Sistemas RPG** (combate, magia, inventario, diálogos, misiones, comercio, progresión) y **Publisher** | F5+ | Véase §8 original reformulado |

*(La antigua numeración F0–F12 queda sustituida por esta. La tabla y el catálogo de herramientas de §6 mantienen vigencia como visión, con las herramientas construidas sobre el motor JS vanilla.)*

Ver también: desglose conceptual original en las secciones → §1 Visión, §2 Decisiones, §5 Modelo de datos, §6 Catálogo de herramientas, §8 (histórico), §11 Principios de calidad.

---

## 16. Deuda técnica prioritaria del motor (bloqueante para avanzar)

> **🚫 Bloqueo de avance:** no se inicia ninguna fase posterior a **F2.5** (Studio TS/Vite, Level Editor, Blueprints, sistemas RPG, Publisher) hasta que los items críticos y altos de esta sección estén resueltos, testeados y validados. El motor actual funciona, pero su deuda técnica operativa (integración, eficiencia, API pública, tests y limpieza de legacy) haría progresivamente más caro y frágil construir el Studio encima.
>
> La arquitectura de capas y el sector system son sólidos; la deuda es de **ejecución y acabado**, no de diseño. Saldarla convierte al motor en una base estable para F3+.

### 16.1 Items críticos (deben resolverse antes de cualquier avance)

| # | Problema | Archivo(s) principal(es) | Solución esperada | Estado |
|---|---|---|---|---|
| C1 | `Engine3D.update()` no ejecuta la física de sectores; la demo la llama a mano. | `engine/Engine3D.js`, `demo/main.js` | `Engine3D.update(input, dt)` debe orquestar `moveWithSectorCollision` + `updateVerticalSector`. | validada |
| C2 | El índice sectorial se reconstruye en cada substep/frame. | `engine/core/physics.js` | Cachear `{ vertexMap, walls }` en `Engine3D.load()` y pasarlo a la física. | validada |
| C3 | Un draw call por superficie (suelo/techo/pared). | `engine/three/WorldMesh.js` | Mergear geometrías por textura/material. | validada |
| C4 | Sin tope de `dt` en el motor. | `engine/Engine3D.js`, `engine/core/physics.js` | Cap `dt` y clamp de substeps para evitar congelamiento. | validada |
| C5 | Movimiento separado por ejes (X, luego Y). | `engine/core/physics.js` | Mover como vector único por substep. | validada |
| C6 | Sin colisión con techos. | `engine/core/physics.js`, `engine/core/player.js` | Añadir altura de jugador y clamp contra `getCeilHeightAt`. | validada |

### 16.2 Items de alta prioridad (resolver junto con los críticos)

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

### 16.3 Items de prioridad media (pueden entrar tras los críticos/altos)

- ✅ UVs configurables (`textureRepeat`/`uvScale`) en schema v3. — **validada**
- ✅ Índice espacial para `getSectorAt` (BVH de bounding boxes de sectores). — **realizada**
- `getSectorAtOrNearest` más robusto (no devolver sector no adyacente).
- Gravedad basada en velocidad (`velocityZ`) en lugar de velocidad de caída constante.
- Validador ligero de `project.json` al cargar.
- ✅ Renombrar `raycaster.test.js` → `player.test.js`.
- Manejo de `webglcontextlost`.

### 16.4 Plan de ejecución propuesto

Las tareas se agrupan en **5 fases**. Cada fase termina con tests pasando, demo jugable y commit.

#### Fase A — Física integrada y robusta
1. Integrar `moveWithSectorCollision` + `updateVerticalSector` en `Engine3D.update(input, dt)`.
2. Cap `dt` y clamp de substeps.
3. Movimiento como vector único por substep.
4. Colisión con techos.
5. Cachear índice sectorial.

**Tests nuevos:** `test/engine/physics-vertical.test.js`, `test/engine/engine3d.test.js`.

#### Fase B — Render eficiente y lifecycle
1. Mergear geometrías por textura/material.
2. Normales analíticas.
3. Cachear vertex map en builders.
4. Limpiar sprites y luces en `WorldMesh.clear()`.
5. `Renderer3D.resize()` y `Engine3D.dispose()`.

**Tests nuevos:** limpieza de escena, conteo de meshes/draw calls.

#### Fase C — API pública limpia y schema v3 primero
1. Reducir exports de `engine/index.js`.
2. Validador de `project.json`.
3. Marcar/mover código v2 a `engine/legacy/`.
4. Renombrar `raycaster.test.js`.

#### Fase D — Física y geometría avanzada
1. Triangulación robusta para sectores cóncavos (ear-clipping).
2. Colisión horizontal contra escaleras.
3. Índice espacial de sectores.
4. UVs configurables.
5. Gravedad por velocidad.

#### Fase E — Polish y producción
1. Leer settings de `project.json` en `Renderer3D`.
2. Carga de texturas con `Promise.all`.
3. Cache de texturas de color.
4. Manejo de `webglcontextlost`.
5. Actualizar `docs/ENGINE_COMPONENTS.md`.

### 16.5 Decisiones pendientes que desbloquean el plan

1. **¿Deprecar schema v2 (grid) ahora?** Recomendación: **sí**. Reduce la superficie a mantener y enfoca el motor en sectores poligonales. Si se necesita compatibilidad, se implementa un migrador v2→v3, no se mantienen dos físicas.
2. **¿Mergear geometrías manualmente o con `BufferGeometryUtils`?** Si se quiere evitar dependencia de `three/addons/`, se implementa merge manual. De lo contrario, `BufferGeometryUtils.mergeGeometries` es la opción más corta.
3. **¿Input por parámetro o estado interno en `Engine3D`?** Recomendación: **por parámetro** (`Engine3D.update({ dirX, dirY, speed }, dt)`), manteniendo el motor desacoplado del DOM.

### 16.6 Criterio de salida (para desbloquear F3)

Se considera saldada la deuda cuando:

- [ ] `Engine3D.update()` orquesta física de sectores sin que la demo toque funciones internas.
- [ ] Todos los tests actuales siguen pasando y se añaden tests de física vertical y `Engine3D.update`.
- [ ] El número de draw calls se reduce drásticamente (merge por material).
- [ ] No hay fugas de memoria GPU al recargar mundos (`dispose` + `clear` robusto).
- [ ] Schema v2 está marcado como legacy o eliminado; la API pública es mínima.
- [ ] La demo sigue jugable: portales, rampas, escaleras, sprites y paredes sólidas.

**Hasta que estos checks no estén todos marcados, NO se avanza a F3 (Studio TS/Vite).**