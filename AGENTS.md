# AGENTS.md — RayCast Studio

Creador web de RPG 3D retro (estilo Doom→Daggerfall).
**Plan maestro y estado de fases: `ROADMAP.md`** (leer antes de proponer features; secciones clave §13 arquitectura de capas, §14–§15 fases).

## Arquitectura (dos capas, ver `ROADMAP.md` §13)

- **Motor del juego (`engine/`) = JS vanilla puro, aislado e independiente.** Toda la lógica de procesado y render (3D WebGL/Three.js, física cinemática, audio, visual scripting) vive sin TypeScript, sin build, sin framework y sin acoplarse a ninguna UI. Expone una API pública mínima (ESModules). **No mezclarlo con el Studio.**
- **Demo (`demo/`) = consumidor.** Solo importa el motor, arma un `project.json` de ejemplo y lanza el loop. No contiene lógica de motor.
- **Studio (`studio/`) = TypeScript + Vite (visión futura).** Herramientas de creación / interfaz para construir juegos sin escribir código (arrastrar y unir). Otro consumidor del motor: escribe `project.json` y se lo pasa al motor.
- **Contrato = `project.json`**: las herramientas escriben datos, los motores leen datos. Nunca duplicar esa lógica en ambas capas.
- **UI/Design System**: `DESIGN.md` define la paleta, tipografía, espaciado y componentes reutilizables del Studio. **Leer `DESIGN.md` antes de crear cualquier componente UI.** Los componentes son framework-agnostic (vanilla JS → migrable a Lit/Svelte).

## Estado actual

- **F1 validada:** motor de raycast base en JS vanilla (tutorial de Lode).
- **F2 realizada:** migración a **motor 3D puro con WebGL/Three.js**. Se eliminó el raycaster Canvas; el render es ahora poligonal con sectores de altura (`floorH`/`ceilH`), cámara perspectiva real e iluminación. Ver `ROADMAP.md` §14.
- El backend (API + Postgres), la Game Library, el Design System y el Publisher son **visión a largo plazo** (F3+), no trabajo hecho.
- `opencode.json` declara el plugin `@dietrichgebert/ponytail` y MCP `context7`: reutilizar librerías antes que reinventar (regla del plan).

## Entorno (WSL con Node de Windows)

- `node` no existe en PATH como tal: solo `node.exe` en `/mnt/c/Program Files/nodejs/`. Si `node` deja de resolver, restaurar el symlink:
  `ln -sf "/mnt/c/Program Files/nodejs/node.exe" ~/.opencode/bin/node`
- npm funciona (su script resuelve `node.exe`), pero los binarios de scripts usan `node`.
- **Los procesos lanzados desde el tool corren como procesos Windows (node.exe): no se ven en `ss`/`pkill`/`curl` de Linux.** Para verificar un servidor usar `curl.exe` (en vez de `curl`). Para limpiar huérfanos de puertos:
  `for pid in $(netstat.exe -ano | grep -i listen | grep -E ':3000|:8080' | awk '{print $NF}' | sort -u); do taskkill.exe '/F' '/PID' $pid; done`
  Vite huérfano lanzado desde WSL tampoco responde a `pkill -f vite` (auto-match): el patrón `node_modules/.bin/[v]ite` sí lo mataba cuando corría como proceso Linux; ahora con proceso Windows lo robusto es `taskkill.exe` por puerto.

## Convenciones

- **Comentarios y mensajes de commit en español.** Estilo de commits en el historial: `feat: ...` (rama `main`).
- Identidad git ya configurada a nivel global: `CHIMIgb` / `adriangallardobuenrostro@gmail.com`.
- **`assets/` NO se versiona** (`.gitignore`): sprites de Daggerfall con copyright. Nunca commitear; importar localmente bajo demanda.
- `.env` está gitignored (guardará `DATABASE_URL`/`JWT_SECRET` cuando exista backend). No commitear.

## Reglas

- **Cada fase, tarea o implementación del ROADMAP se marca como `realizada`** en la tabla de "Estado del plan" (`ROADMAP.md` §12) en cuanto termina la implementación. No quedarse en código: el plan debe reflejar el avance.
- **El flujo de trabajo es paso-a-paso:** implemento una fase/tarea → la marco `realizada` → el usuario la valida (abriendo la demo/verificando) → **solo entonces** cambio su estado a `validada`. No se avanza al siguiente paso hasta que el usuario valida el actual.
- **Nunca tocar lo que ya está realizado.** Si una tarea/fase está completada y es necesario modificarla, **preguntar primero** y explicar exactamente qué modificaciones se harán antes de actuar; no proceder sin la aprobación del usuario.
- **Toda implementación nueva lleva su test.** Cada fase, tarea o feature nueva debe incluir al menos un test que compruebe que funciona. Los tests viven en la carpeta raíz `test/`, divididos en `test/engine/` (para el motor JS vanilla) y `test/studio/` (para el Studio TS, cuando exista). Un test que falla = feature no cerrada.
- **No hardcodear valores.** Toda constante que sea dato del juego (mapa, texturas, sprites, config) debe declararse en el `project.json` (datos), no embutirse en el código del motor ni en la UI. Los únicos datos permitidos en código son configuración de infraestructura y constantes sin representación en el modelo.
- **El motor JS vanilla no debe depender del Studio TS** ni de ninguna UI; ambas capas solo se comunican por datos (`project.json`).
