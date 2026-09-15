# DESIGN.md — Sistema de Diseño UI/UX de Iliac Engine

> Referencia visual y de comportamiento para todos los componentes de la interfaz.
> Basado en editores profesionales: Unity, Unreal Engine, Godot, Blender.

---

## 1. Principios de Diseño

| Principio | Descripción |
|-----------|-------------|
| **Oscuro por defecto** | Tema dark (fondo `#1e1e2e`, paneles `#181825`). Reduce fatiga visual en sesiones largas de edición. Los colores claros solo aparecen en texto y acentos. |
| **Panel-based layout** | La UI se organiza en paneles dockables y redimensionables. Cada panel tiene un header con título, controles contextuales y un botón de colapsar. |
| **Viewport-centrado** | El canvas de trabajo (2D/3D) siempre ocupa el centro. Los paneles lo rodean: herramientas a la izquierda, propiedades a la derecha, assets abajo. |
| **Consistencia visual** | Todos los componentes siguen la misma paleta, espaciado, tipografía y comportamiento. No hay estilos ad-hoc. |
| **Keyboard-first** | Cada acción frecuente tiene atajo de teclado. Los atajos se muestran al lado de los botones y en tooltips. |
| **Feedback inmediato** | Cada acción del usuario produce feedback visual: spinners durante carga, toasts de confirmación, estados vacíos y de error claros. |

---

## 2. Paleta de Colores

### Base (tema dark)

| Token | Hex | Uso |
|-------|-----|-----|
| `bg-primary` | `#1e1e2e` | Fondo principal de la app |
| `bg-panel` | `#181825` | Fondo de paneles laterales |
| `bg-surface` | `#313244` | Superficies elevadas (cards, dropdowns) |
| `bg-hover` | `#45475a` | Estado hover de items clickeables |
| `bg-active` | `#585b70` | Estado active/seleccionado |
| `bg-input` | `#11111b` | Fondo de inputs y campos de texto |

### Texto

| Token | Hex | Uso |
|-------|-----|-----|
| `text-primary` | `#cdd6f4` | Texto principal |
| `text-secondary` | `#a6adc8` | Texto secundario, labels, hints |
| `text-muted` | `#6c7086` | Texto deshabilitado, placeholders |
| `text-inverse` | `#1e1e2e` | Texto sobre fondo de acento |

### Acentos

| Token | Hex | Uso |
|-------|-----|-----|
| `accent-primary` | `#89b4fa` | Acciones primarias, links, foco |
| `accent-success` | `#a6e3a1` | Éxito, confirmaciones |
| `accent-warning` | `#f9e2af` | Advertencias |
| `accent-danger` | `#f38ba8` | Errores, eliminaciones |
| `accent-info` | `#94e2d5` | Información, tooltips |

### Bordes y Separadores

| Token | Hex | Uso |
|-------|-----|-----|
| `border-default` | `#313244` | Bordes de paneles, inputs |
| `border-focus` | `#89b4fa` | Borde con foco (inputs, botones) |
| `border-divider` | `#1e1e2e` | Separadores entre secciones |

---

## 3. Tipografía

| Uso | Familia | Tamaño | Peso |
|-----|---------|--------|------|
| **UI General** | `'Inter', -apple-system, sans-serif` | 12px | 400 |
| **Labels / Headers** | `'Inter', -apple-system, sans-serif` | 11px | 600 |
| **Panel titles** | `'Inter', -apple-system, sans-serif` | 13px | 600 |
| **Código / Valores** | `'JetBrains Mono', 'Fira Code', monospace` | 11px | 400 |
| **Tooltips** | `'Inter', -apple-system, sans-serif` | 11px | 400 |
| **Retro (juego)** | `'Press Start 2P', 'Px437', monospace` | variable | 400 |

- Line height general: `1.5`
- Letter spacing: `0` (normal)
- Anti-aliasing: subpixel (default del navegador)

---

## 4. Espaciado y Grid

### Escala base (4px)

| Token | Valor |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |

### Layout del Studio

```
┌──────────────────────────────────────────────────────────────────┐
│  Toolbar (h: 40px)                                              │
├──────────┬───────────────────────────────────────┬───────────────┤
│  Panel   │                                       │   Panel       │
│  Left    │         Viewport / Canvas              │   Right       │
│  (w:     │         (flex: 1)                      │   (w:         │
│  240-320 │                                       │   280-360)    │
│  px)     │                                       │               │
├──────────┴───────────────────────────────────────┴───────────────┤
│  Panel Bottom (h: 180-300px, colapsable)                         │
│  [Tabs: Assets | Console | Output | Problems]                    │
└──────────────────────────────────────────────────────────────────┘
│  Status Bar (h: 24px)                                            │
└──────────────────────────────────────────────────────────────────┘
```

- **Panel Left**: Árbol de escena / herramientas / capas
- **Panel Right**: Inspector / propiedades / detalles
- **Panel Bottom**: Assets, consola, salida, problemas (tabs)
- **Viewport**: Canvas central, maximizable con F11
- **Status Bar**: Info contextual (posición del cursor, zoom, estado)

---

## 5. Componentes Reutilizables

### 5.1 Botones

| Variant | Color de fondo | Borde | Texto | Uso |
|---------|---------------|-------|-------|-----|
| **Primary** | `accent-primary` | — | `text-inverse` | Acciones principales (Guardar, Crear, Ejecutar) |
| **Secondary** | `bg-surface` | `border-default` | `text-primary` | Acciones secundarias (Cancelar, Limpiar) |
| **Danger** | `accent-danger` | — | `text-inverse` | Eliminar, destruir |
| **Ghost** | transparente | — | `text-secondary` | Acciones sutiles (icon buttons, menús) |
| **Icon** | transparente | — | `text-secondary` | Solo icono, 24×24 o 32×32 |

**Estados:** default → hover (`bg-hover`) → active (`bg-active`) → disabled (`text-muted`, `opacity: 0.5`)

**Tamaños:**
| Size | Height | Padding | Font |
|------|--------|---------|------|
| `sm` | 24px | 6px 10px | 11px |
| `md` | 30px | 8px 14px | 12px |
| `lg` | 36px | 10px 18px | 13px |

**Atajo de teclado:** se muestra al lado del label con `<kbd>`: `Guardar <kbd>Ctrl+S</kbd>`

### 5.2 Inputs

| Tipo | Descripción |
|------|-------------|
| `TextInput` | Campo de texto estándar. Fondo `bg-input`, borde `border-default`, foco `border-focus`. |
| `NumberInput` | Numérico con flechas ↑↓. Step configurable. |
| `Select` | Dropdown nativo estilizado. |
| `Checkbox` | Cuadrado 16×16, accent color al marcar. |
| `Slider` | Range input con valor numérico al lado. |
| `ColorInput` | Swatch de color + click para abrir picker nativo. |
| `FileInput` | Drop zone o botón para seleccionar archivo. |

**Label:** arriba del input, `text-secondary`, 11px, weight 600.
**Help text:** debajo del input, `text-muted`, 10px.
**Error state:** borde `accent-danger`, help text en `accent-danger`.

### 5.3 Tabs

```
┌─────────┬─────────┬─────────┐
│ Assets  │ Console │ Output  │  ← headers
├─────────┴─────────┴─────────┤
│                             │
│         contenido           │
│                             │
└─────────────────────────────┘
```

- Header: fondo `bg-panel`, borde inferior `border-default`
- Tab activo: borde inferior 2px `accent-primary`, texto `text-primary`
- Tab inactivo: texto `text-muted`, hover `text-secondary`
- Contenido: fondo `bg-panel`, scroll si excede

### 5.4 Tabla

| Elemento | Estilo |
|----------|--------|
| Header | `bg-surface`, texto `text-secondary`, weight 600, uppercase 10px |
| Row | `bg-panel`, borde `border-divider` |
| Row hover | `bg-hover` |
| Row selected | `bg-active` |
| Cell padding | 8px 12px |
| Sortable header | Icono ↑↓, cursor pointer |
| Empty state | "No hay elementos" centrado |

### 5.5 Modal / Dialog

```
┌─────────────────────────────────────┐
│  Título de la modal           [X]  │
├─────────────────────────────────────┤
│                                     │
│  Contenido                          │
│                                     │
├─────────────────────────────────────┤
│              [Cancelar]  [Aceptar]  │
└─────────────────────────────────────┘
```

- Overlay: `rgba(0, 0, 0, 0.6)` con backdrop blur 4px
- Modal: `bg-panel`, borde `border-default`, border-radius 8px, max-width 480px
- Sombra: `0 8px 32px rgba(0, 0, 0, 0.4)`
- Animación: fade-in 150ms + scale 0.95→1
- Focus trap: Tab cycle dentro de la modal
- Cierre: Escape, click en overlay, botón X

### 5.6 Toast / Notificación

```
┌──────────────────────────────────┐
│  ✓ Archivo guardado correctamente│
└──────────────────────────────────┘
```

- Posición: esquina superior derecha, stack vertical
- Variantes: `success` (verde), `warning` (amarillo), `error` (rojo), `info` (azul)
- Auto-dismiss: 3s (success/info), 5s (warning), manual (error)
- Animación: slide-in desde la derecha, fade-out
- Icono a la izquierda del mensaje
- Botón X para cerrar manualmente

### 5.7 Spinner / Loading

| Tipo | Uso |
|------|-----|
| `Spinner` (circular) | Carga inline, botones con loading |
| `Skeleton` | Placeholder de contenido cargando |
| `Progress bar` | Progreso conocido (upload, build) |

- Spinner: 16px o 24px, borde `accent-primary`, animación rotate 1s
- Skeleton: `bg-surface` con shimmer gradient animado
- Progress bar: track `bg-surface`, fill `accent-primary`, texto centrado

### 5.8 Estados de la UI

#### Estado Vacío

```
┌─────────────────────────────────┐
│                                 │
│           [icono 48px]          │
│                                 │
│      No hay [elementos] aún     │
│                                 │
│    [Crear primer elemento]      │
│                                 │
└─────────────────────────────────┘
```

- Icono: 48px, `text-muted`
- Título: 14px, `text-secondary`
- Descripción: 12px, `text-muted`
- Acción: botón Primary centrado

#### Estado de Error

```
┌─────────────────────────────────┐
│                                 │
│           [⚠ icono 48px]       │
│                                 │
│      Algo salió mal             │
│    No se pudo cargar el nivel   │
│                                 │
│    [Reintentar]  [Detalles]     │
│                                 │
└─────────────────────────────────┘
```

- Icono: 48px, `accent-danger`
- Título: 14px, `text-primary`
- Descripción: 12px, `text-secondary`
- Acciones: Reintentar (Primary) + Detalles (Ghost, expande stack trace)

#### Estado de Carga

```
┌─────────────────────────────────┐
│                                 │
│           [spinner 32px]        │
│                                 │
│      Cargando nivel...          │
│                                 │
└─────────────────────────────────┘
```

- Spinner centrado
- Texto descriptivo debajo, `text-secondary`

### 5.9 Iconos

Sistema de iconos basado en **lucide** (SVG inline, 16×16 y 20×20).

| Categoría | Ejemplos |
|-----------|----------|
| Archivo | `file`, `folder`, `save`, `download`, `upload`, `trash` |
| Edición | `undo`, `redo`, `copy`, `paste`, `cut`, `search` |
| Vistas | `eye`, `eye-off`, `maximize`, `minimize`, `grid`, `list` |
| Herramientas | `move`, `rotate`, `scale`, `cursor`, `brush` |
| Estado | `check`, `x`, `alert-triangle`, `info`, `loader` |
| Navegación | `chevron-down`, `chevron-right`, `arrow-left`, `arrow-right` |
| Media | `play`, `pause`, `stop`, `skip-forward`, `volume` |

**Regla:** todos los iconos son SVG inline, no icon fonts. Color hereda del padre (`currentColor`).

### 5.10 Layout Helpers

| Componente | Descripción |
|------------|-------------|
| `Panel` | Contenedor con header colapsable, border, padding |
| `SplitView` | División redimensionable horizontal o vertical (drag handle) |
| `Stack` | Layout vertical u horizontal con gap |
| `Grid` | CSS Grid responsive con columnas configurables |
| `ScrollArea` | Contenedor con scroll custom (no scrollbar nativo) |
| `Divider` | Línea separadora horizontal o vertical |

---

## 6. Comportamiento General

### Redimensionar paneles
- Handle de 4px entre paneles, cursor `col-resize` o `row-resize`
- Al hacer drag: overlay semi-transparente mostrando la posición
- Doble-click en handle: resetear al tamaño default
- Mínimo: 200px, máximo: 50% del viewport

### Atajos de teclado globales

| Atajo | Acción |
|-------|--------|
| `Ctrl+S` | Guardar |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Shift+Z` | Rehacer |
| `Ctrl+N` | Nuevo proyecto/elemento |
| `Delete` | Eliminar seleccionado |
| `F5` | Playtest |
| `F11` | Maximizar viewport |
| `Esc` | Cerrar modal / deselect |
| `Ctrl+P` | Command palette (búsqueda de acciones) |

### Command Palette (Ctrl+P)
- Búsqueda fuzzy de acciones, herramientas y archivos
- Resultados con icono + categoría + atajo de teclado
- Navegación con ↑↓, Enter para ejecutar
- Estilo: modal centrada, max-width 560px, sin overlay oscuro

---

## 7. Patrones de Página

### Página de Herramienta (ej: Sprite Slicer)

```
┌──────────────────────────────────────────────────────────────────┐
│  [icon] Sprite Slicer                        [?] [⚙] [← Volver]│
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│  Panel   │              Viewport / Canvas                        │
│  Config  │              (preview de sprites)                     │
│          │                                                       │
│  [inputs]│                                                       │
│  [sliders]│                                                      │
│  [buttons]│                                                      │
│          │                                                       │
├──────────┴───────────────────────────────────────────────────────┤
│  [Tab: Frames detectados] [Tab: Animaciones] [Tab: Exportar]    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│  │ #1 │ │ #2 │ │ #3 │ │ #4 │ │ #5 │ │ #6 │ │ #7 │ │ #8 │      │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘      │
├──────────────────────────────────────────────────────────────────┤
│  Frame 3/16 │ Animation: walk │ Size: 359×188px │ Zoom: 200%   │
└──────────────────────────────────────────────────────────────────┘
```

### Página de Lista (ej: Game Library)

```
┌──────────────────────────────────────────────────────────────────┐
│  [icon] Game Library                    [Buscar...] [+ Nuevo]   │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ [thumb] │ │ [thumb] │ │ [thumb] │ │ [thumb] │               │
│  │ Nombre  │ │ Nombre  │ │ Nombre  │ │ Nombre  │               │
│  │ 3D · 2h │ │ retro·1d│ │ 3D · 5h │ │ retro·3h│               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│  Empty state si no hay proyectos                                 │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Referencias

| Editor | Lo que tomamos |
|--------|---------------|
| **Unity** | Layout de paneles (Hierarchy/Inspector/Project/Console), inspector contextual, drag & drop al viewport |
| **Unreal Engine** | Content Browser con thumbnails, Blueprint Editor (nodos + cables), dark theme profesional |
| **Godot** | Dock system, scene tree, output panel, tamaño ligero y responsive |
| **Blender** | N-panel para propiedades, space types, headers contextuales |
| **VS Code** | Command palette, activity bar, breadcrumb, status bar |
| **Figma** | Inspect panel, component properties, auto-layout |

---

## 9. Notas de Implementación

- **CSS:** usar CSS custom properties (variables) para todos los tokens. Un solo archivo `tokens.css` define la paleta.
- **Componentes:** framework-agnostic (vanilla JS → migrable a Lit/Svelte si se necesita). Cada componente es una función que retorna HTML string o DOM nodes.
- **Naming:** BEM simplificado: `.panel`, `.panel__header`, `.panel--collapsed`, `.btn`, `.btn--primary`, `.btn--sm`.
- **Responsive:** el Studio se usa en desktop (1280px+). No se optimiza para mobile (el Level Editor en tablet no tiene sentido).
- **Accesibilidad:** ARIA labels en botones/inputs, focus visible, contraste WCAG AA mínimo.

---

## 10. Evolución UI: Tweakpane — look & feel técnico (decidido 2026-09-15)

> **Estado: ⏳ PENDIENTE — se implementa DESPUÉS de cerrar `SPRITE_TOOL_PLAN.md` (F5 completo,
> fases D/E).** Vinculado en ROADMAP §12. No tocar componentes existentes hasta entonces.

### 10.1 Decisión

Sustituir los componentes de UI existentes y parte de la UX actual por el lenguaje visual de
**Tweakpane** (https://tweakpane.github.io/docs/) para lograr el **look & feel técnico y
profesional de un motor 3D**: sobrio, oscuro, **muy compacto** y **orientado a datos**
(referencias: Blender, Unity).

- **Tweakpane** se adopta como librería para paneles de parámetros / inspector (propiedades).
- El **resto de componentes vanilla** (botones, modales, tabs, toasts, tooltips, menús) **se
  inspira en su estilo** — misma densidad, radios, bordes y tratamientos — para que todo el
  Studio se sienta cohesivo, como una herramienta profesional.
- No cambia la arquitectura framework-agnostic (vanilla JS): Tweakpane es una librería de
  paneles, no un framework de UI.

### 10.2 Principios de estilo Tweakpane (para aplicar a TODO el Studio)

| Principio | Detalle |
|-----------|---------|
| **Border-radius bajo** | Esquinas rectas: `2px`–`4px`, nunca `8px+` en controles. |
| **Bordes sutiles** | Separadores casi del color del fondo; sin bordes de alto contraste. Divisores `border-divider`. |
| **Tipografía compacta** | `11px`–`12px` (ya definidos en §3) para maximizar superficie de trabajo. |
| **Inputs fundidos** | Campos numéricos con `bg-input` (`#11111b`), sin bordes gruesos ni blancos. Foco con borde fino `accent-primary`. |
| **Alta densidad** | Controles apilados verticalmente, espaciado `space-2`/`space-3`; paneles colapsables por sección. |
| **Orientado a datos** | Valores en `JetBrains Mono`; cada panel = un grupo de parámetros con su folder. |

### 10.3 Integración de tema (Tweakpane lee los tokens de DESIGN.md)

En lugar de duplicar colores, se inyectan los tokens existentes en las variables `--tp-*`:

```css
:root {
  /* Tweakpane lee los colores del DESIGN.md */
  --tp-base-background-color: var(--bg-panel);
  --tp-base-shadow-color: rgba(0, 0, 0, 0.4);
  --tp-button-background-color: var(--bg-surface);
  --tp-button-background-color-hover: var(--bg-hover);
  --tp-button-background-color-active: var(--bg-active);
  --tp-button-foreground-color: var(--text-primary);
  --tp-label-foreground-color: var(--text-secondary);
  --tp-input-background-color: var(--bg-input);
  --tp-input-foreground-color: var(--text-primary);
  --tp-base-font-family: 'Inter', sans-serif;

  /* Acento principal (azul de accent-primary) */
  --tp-container-background-color-active: var(--accent-primary);
  --tp-container-background-color-focus: var(--border-focus);
}
```

### 10.4 Guía para actualizar componentes existentes al estilo Tweakpane

- **Botones:** `border-radius: 2px`; fondos `bg-surface`/`bg-hover`/`bg-active`, texto
  `text-primary`; estado activo con acento.
- **Inputs:** fondo `bg-input` sin borde grueso; foco con borde `1px solid border-focus`.
- **Tabs:** separador inferior sutil `border-divider`; activo con acento de 2px (como hoy).
- **Paneles:** header colapsable estilo *folder* de Tweakpane (chevrón + título 11px semibold).
- **Modales:** radio bajo (`4px`), sombra suave, header compacto.
- **Density general:** revisar paddings para que todo quepa en menos espacio (gap `4px`–`8px`).

### 10.5 Qué NO cambia

Paleta Catppuccin Mocha (tokens de §2), tipografías de §3, escala 4px de §4, layout de
paneles, atajos de teclado §6, iconos lucide §5.9, ni la arquitectura del Studio. Solo cambia
el **lenguaje visual y la densidad** de los componentes, y la UX de paneles de parámetros.
