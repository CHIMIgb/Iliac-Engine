# RayCast Studio

Creador web de RPG **2.5D / 3D retro** (estilo Wolf3D → Doom → Daggerfall).

> **Reinicio desde cero.** El repositorio aún no contiene código. El plan maestro vive en [`ROADMAP.md`](ROADMAP.md) (leer antes de proponer features).

## Estado actual

El proyecto se organiza en **dos capas separadas** (ver `ROADMAP.md` §13):

- **Motor del juego** (`engine/`) — **JS vanilla puro, aislado e independiente**. Toda la lógica (raycasting, verticalidad/3D, física, audio, visual scripting) vive sin TypeScript, sin build, sin framework y sin acoplarse a ninguna UI. La **demo** (`demo/`) es solo un consumidor que importa el motor y arma la escena.
- **Studio** (`studio/`, TypeScript + Vite) — las **herramientas de creación / interfaz** para construir juegos sin escribir código (arrastrar y unir): bloque futuro del plan.

Ambas capas se comunican **solo por datos** (`project.json`): el Studio escribe datos; el motor los lee y renderiza.

### Primer hito (F1)

Motor de **raycast base en JS vanilla**, reconstruido desde el tutorial de [Lode](https://lodev.org/cgtutor/raycasting.html) para aprenderlo a fondo, y luego con **verticalidad/3D** (F2). Ver `ROADMAP.md` §14–§15 para la estructura de fases.

## Comandos

*(Pasos previstos para cuando exista el toolchain del Studio TS/Vite; el motor F1 se abre directo en el navegador, sin build.)*

```bash
npm test          # Vitest (Studio TS + API), una pasada
npm run typecheck # tsc --noEmit (Studio) + tsc -p server/tsconfig.json (server)
npm run build     # typecheck + build de producción en dist/
npm run dev       # dev completo: API (:3000) + SPA (:8080)
```

## Estructura objetivo

```
raycastjs/
├── engine/     ← MOTOR DEL JUEGO · JS vanilla puro, aislado (F1–F2)
│   ├── core/   → math.js · camera.js · dda.js · projection.js · textures.js · sprites.js
│   ├── Raycaster.js  → clase principal (consume project.json → render)
│   └── index.js      → API público (ESModules)
├── demo/       ← consumidor: index.html + main.js + project.json (datos, no lógica)
├── studio/     ← Studio TS + Vite: herramientas de creación (visión §15)
├── server/     ← vista: API + Postgres (backend del Studio y Game Library)
└── ROADMAP.md  ← Plan maestro: fases F1–F13 y catálogo de herramientas
```

## Modelo de datos

Un juego = una carpeta de proyecto (`project.json` + `assets/`). Todo es datos: las herramientas escriben datos, los motores leen datos. El esquema completo del `project.json` se documenta en `ROADMAP.md` §5.

## Notas

- **Nunca versionar**: `assets/` (sprites de Daggerfall con copyright) ni `.env`.
- El **motor** es JS vanilla puro; el **Studio** es TypeScript/Vite. No confundir las dos capas.
