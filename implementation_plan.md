# Plan: Cielo/environment — horizonte lejano estilo Daggerfall (31 sets según hora del día)

## Qué hay en los assets (verificado)

`assets/images/daggerfall/Environment/The Sky/` contiene **31 sets (SKY00–SKY30)** — en Daggerfall clásico cada set es un aspecto de cielo según hora del día/tiempo. Cada set trae:

- **2 capas en paralaje**: `0-*.PNG` = capa LEJANA (montañas nubladas/cielo alto), `1-*.PNG` = capa CERCANA (silueta de bosque/horizonte negro que has señalando en tus capturas).
- **32 fotogramas por capa** (`{capa}-{0..31}.PNG`, 512×220 RGBA): son VENTANAS PRECALCULADAS de la panorámica — el truco original de Daggerfall: al girar, no se desplaza el UV, se **cambia de fotograma**. Cero costuras, cero stitching.

⚠ `assets/` está en `.gitignore` (copyright) → el juego solo verá el cielo si el usuario importa estos PNG localmente (igual que sprites/texturas ya). Para publicar, el Publisher empaquetará lo referenciado.

## Diseño propuesto

### Datos (contrato project.json)

Nuevo campo OPCIONAL en `world`:

```jsonc
"sky": { "set": 15 }   // 0–30; ausente = sin cielo (comportamiento actual)
```

- `validate.js`: aceptar/validar entero 0–30 (fuera → error).
- `sector.js` nada. Renderer intacto: `scene.background`/fog siguen siendo el color de fondo — bajo el horizonte se ve exactamente como hoy (niebla a lo lejos), y por encima aparece el anillo de siluetas. Eso ES el look de tus capturas.

### Motor — `engine/three/SkySystem.js` (nuevo)

- 2 cilindros abiertos (BackSide, sin niebla, `depthWrite:false`, `renderOrder` bajísimo) que **siguen a la cámara** cada frame → se ven "a distancia infinita", no colisionan ni se interponen (radio visual efectivo = horizonte lejano).
- Capa LEJANA ocupa desde el horizonte hacia arriba; capa CERCANA sentada EN el horizonte (su franja inferior es la silueta negra). Altura de cada cilindro derivada del aspect 512:220 para que la textura no se deforme: `h = R · 220/512` con R grande (≈400) → banda ~26° — el ángulo clásico de Daggerfall.
- `update(yaw)`: `frame = round((yaw/2π · 32) mod 32)` por capa → `material.map = frames[layer][frame]` (todas precargadas en `loadTextures` estilo actual). La capa lejana con **parallax 0,6×** y un drift lento (uv scroll mínimo) = viento de nubes (F5+ lo hará por hora del día).
- VRAM por set: 2 capas × 32 frames × 512×220×4 ≈ **29 MB** → opción `stride` (usar frames pares = 14 MB) si alguien lo nota pesado en móviles.
- `Engine3D`: si `project.world.sky` existe, monta SkySystem en `load()` y llama `sky.update(player.yaw)` en `update()`; `dispose()` lo libera. Sin sky, todo igual que hoy.

### Studio — selector de hora del día

- Nuevo botón toolbar `sky` (icono `cloud`/`sun`, **tecla 8**) → popover simple: dropdown `Sin cielo / SKY00 (amanecer) … SKY30 (noche estrellada)` con los nombres de hora según la tabla canónica de Daggerfall, + toggle previsualización.
- `EditorState.world.sky` tipado; se serializa con el resto; el reload en vivo lo pinta al instante (topología nueva → rebuild completo, barato: son +2 meshes).
- Registro en la paleta de texturas NO: el cielo no usa el registry `textures{}` — son recursos del sistema SkySystem con rutas fijas bajo `assets/images/daggerfall/Environment/The Sky/` (constante de infraestructura, no dato del juego → permitido en código).

### Demo

- `demo/project.js` pone `sky: { set: 15 }` para que F5 lo muestre de serie (el playtest es la validación visual).

## Archivos

```
[CREAR]  engine/three/SkySystem.js          — cilindros + frame por yaw + dispose
[CREAR]  test/engine/sky.test.js            — skyFrameIndex(yaw,32) envolvente; sin sky no monta
[MODIF.] engine/Engine3D.js                 — montar/update/dispose sky (aditivo)
[MODIF.] engine/core/validate.js             — campo sky opcional 0–30
[MODIF.] studio/src/editor/EditorState.ts   — tipo world.sky + get/set
[MODIF.] studio/src/engine.d.ts              — declaración sky
[MODIF.] studio/src/tools/ToolManager.ts    — skyMode popover (dropdown)
[MODIF.] studio/src/main.ts                  — action tecla 8 + callback setSky
[MODIF.] demo/project.js                     — sky set 15
```

## Orden

1. Core: validate + skyFrameIndex puro + tests. 2. SkySystem + Engine3D. 3. Studio tipo+popover+tecla. 4. Demo + playtest visual. 5. TOOLS.md/ROADMAP §12 (nueva línea F4+ "Cielo Daggerfall" — pediré añadirla).

## Riesgos / no hecho (fuera de alcance ahora)

- Ciclo día/noche automático con reloj de juego (mapea sets a horas y hace crossfade) → fase futura; aquí el usuario elige el set.
- Estrellas/luna animadas, relámpagos por clima → futuro.
- Los PNG con alpha canal: si alguna capa tuviera relleno opaco hasta abajo, se corrige con `alphaTest` tras el playtest (lo dirá la primera captura).

## Verificación

`node --test` + vitest + playtest F5: girar 360° y comprobar (a) el cambio de fotograma no produce costura, (b) la capa cercana se apoya en el horizonte tapando montañas lejanas con paralaje, (c) al mirar arriba no hay banda negra, (d) `Sin cielo` = estado actual idéntico.
