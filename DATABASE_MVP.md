# Catálogo de Datos Hardcodeados (MVP)

Este documento registra los valores "hardcodeados" en el código fuente del proyecto (`motor-raycast`). Estos datos constituyen el modelo de dominio que, en una fase posterior, debería migrarse a una base de datos real (PostgreSQL, SQLite, etc.) o a un sistema de assets dinámico para que el usuario pueda crear sus propios elementos sin tocar el código.

---

## 1. Plantilla de Proyecto (Mapas pre-hechos)
**Ruta del archivo:** `studio/src/sample-project.ts`

El proyecto inicial que se carga cuando un usuario abre el Studio. Actualmente inicializa un mundo vacío con valores predeterminados para el render y la cámara.

**Datos clave:**
- **Render:** FOV: 80, Near: 0.1, Far: 500
- **Luz:** Luz ambiental (`intensity: 0.5`), Luz direccional (`intensity: 0.8`)
- **Cámara (Spawn):** `posX: 0`, `posY: 0`, `posZ: 0.6`

*(En el futuro, esto sería el `schema` de los niveles y se podrían guardar "Plantillas de Mapas" en la DB).*

---

## 2. Alturas y Parámetros del Mundo (Métricas)
**Rutas de los archivos:** 
- `studio/src/editor/EditorState.ts`
- `studio/src/dungeons/blocks.ts`

Las alturas de los sectores (habitaciones) y la escala del grid tienen valores hardcodeados por defecto al crearse.

- **Altura mínima predeterminada (Suelo / Floor):** `0`
- **Altura máxima predeterminada (Techo / Ceil):** `3`
- **Caja de colisión Humanoide (Alto):** `1.8` metros.

---

## 3. Catálogo de Entidades y Tamaños (Bestiario)
**Ruta del archivo:** `studio/src/entities/entityCatalog.ts`

El archivo define las categorías y todas las entidades instanciables, incluyendo sus cajas de colisión físicas (`collisionBox: { w, d, h }`). Estos deberían ser registros en una tabla `entities`.

### Categorías Actuales:
1. `npc` (NPCs)
2. `enemy-human` (Enemigos — Humanos)
3. `enemy-animal` (Enemigos — Animales)
4. `enemy-undead` (Enemigos — No Muertos)
5. `enemy-daedra` (Enemigos — Daedra)
6. `enemy-monster` (Enemigos — Criaturas)

### Entidades Registradas:

| ID | Nombre | Categoría | Tamaño (W x D x H) | Tipo Colisión |
| :--- | :--- | :--- | :--- | :--- |
| **npc_villager** | Aldeano | NPC | 0.5 x 0.5 x 1.8 | npc |
| **npc_merchant** | Comerciante | NPC | 0.5 x 0.5 x 1.8 | npc |
| **npc_guard** | Guardia | NPC | 0.5 x 0.5 x 1.8 | npc |
| **enemy_bandit** | Bandido | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **enemy_soldier** | Soldado | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_acrobat** | Acróbata | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_archer** | Arquero | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_assassin** | Asesino | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_barbarian** | Bárbaro | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_bard** | Bardo | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_battlemage** | Magibrujo | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_burglar** | Ladrón | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_healer** | Clérigo | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_knight** | Caballero | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_mage** | Mago | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_monk** | Monje | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_nightblade** | Hoja Nocturna | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_orc** | Orco | Enemigo (Humano) | 0.6 x 0.6 x 2.0 | human |
| **df_orc_sergeant** | Sargento Orco | Enemigo (Humano) | 0.6 x 0.6 x 2.0 | human |
| **df_orc_shaman** | Chamán Orco | Enemigo (Humano) | 0.6 x 0.6 x 2.0 | human |
| **df_orc_warlord** | Señor Guerra Orco | Enemigo (Humano) | 0.6 x 0.6 x 2.0 | human |
| **df_ranger** | Explorador | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_rogue** | Pícaro | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_sorcerer** | Hechicero | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_spellsword** | Espad. Arcano | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_thief** | Ladronzuelo | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **df_warrior** | Guerrero | Enemigo (Humano) | 0.5 x 0.5 x 1.8 | human |
| **enemy_wolf** | Lobo | Enemigo (Animal) | 0.6 x 1.1 x 0.9 | animal |
| **enemy_rat** | Rata | Enemigo (Animal) | 0.3 x 0.6 x 0.35| animal |
| **enemy_bear** | Oso | Enemigo (Animal) | 0.9 x 1.6 x 1.4 | animal |
| **df_giant_bat** | Murciélago Gigante | Enemigo (Animal) | 0.6 x 0.9 x 0.5 | animal |
| **df_giant_scorpion** | Escorpión Gigante| Enemigo (Animal) | 0.6 x 1.2 x 0.6 | animal |
| **df_grizzlybear** | Oso Pardo | Enemigo (Animal) | 0.9 x 1.6 x 1.4 | animal |
| **df_sabertooth** | Tigre D. de Sable | Enemigo (Animal) | 0.7 x 1.2 x 1.0 | animal |
| **df_slaughterfish** | Pez Carnicero | Enemigo (Animal) | 0.4 x 0.5 x 0.4 | animal |
| **df_spider** | Araña | Enemigo (Animal) | 0.5 x 0.7 x 0.5 | animal |
| **df_ghost** | Fantasma | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_lich** | Lich | Enemigo (No Muerto)| 0.6 x 0.6 x 2.0 | human |
| **df_ancient_lich** | Lich Ancestral | Enemigo (No Muerto)| 0.6 x 0.6 x 2.0 | human |
| **df_mummy** | Momia | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_skeleton** | Esqu. Guerrero | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_vampire** | Vampiro | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_vampire_ancient**| Vampiro Ancestral| Enemigo (No Muerto)| 0.6 x 0.6 x 2.0 | human |
| **df_wraith** | Espectro | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_zombie** | Zombi | Enemigo (No Muerto)| 0.5 x 0.5 x 1.8 | human |
| **df_daedra_lord** | Señor Daedra | Enemigo (Daedra) | 0.7 x 0.7 x 2.0 | human |
| **df_daedra_seducer**| Daedra Seductor | Enemigo (Daedra) | 0.5 x 0.5 x 1.8 | human |
| **df_daedroth** | Daedroth | Enemigo (Daedra) | 0.8 x 1.2 x 1.6 | animal |
| **df_atronach_fire** | Atronach Fuego | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_atronach_ice** | Atronach Hielo | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_atronach_iron** | Atronach Hierro | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_atronach_flesh**| Atronach Carne | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_fire_daedra** | Daedra de Fuego | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_frost_daedra** | Daedra Escarcha | Enemigo (Daedra) | 0.6 x 0.6 x 2.0 | human |
| **df_imp** | Imp | Enemigo (Daedra) | 0.4 x 0.4 x 1.0 | animal |
| **df_centaur** | Centauro | Criatura | 0.7 x 1.3 x 1.7 | animal |
| **df_dragon** | Dragón | Criatura | 2.4 x 3.2 x 1.8 | animal |
| **df_dreugh** | Dreugh | Criatura | 0.8 x 1.2 x 1.4 | animal |
| **df_gargoyle** | Gárgola | Criatura | 0.7 x 0.7 x 1.8 | human |
| **df_giant** | Gigante | Criatura | 1.2 x 1.2 x 2.5 | human |
| **df_harpy** | Arpía | Criatura | 0.6 x 0.6 x 1.7 | animal |
| **df_lamia** | Lamia | Criatura | 0.6 x 0.9 x 1.5 | animal |
| **df_nymph** | Ninfa | Criatura | 0.5 x 0.5 x 1.8 | human |
| **df_spriggan** | Spriggan | Criatura | 0.5 x 0.5 x 1.8 | human |
| **df_wereboar** | Hombre Jabalí | Criatura | 0.7 x 1.2 x 1.4 | animal |
| **df_werewolf** | Hombre Lobo | Criatura | 0.6 x 1.1 x 1.5 | animal |

---

## 4. Texturas y Tipos de Materiales (WIP)
**Rutas probables de crecimiento:** 
- `engine/three/textures.js`
- Directorios en `assets/`

Actualmente las texturas referenciadas en las entidades (`sprite_npc_villager`, `sprite_enemy_dragon`, etc.) asumen que el motor o el cliente resolverán esos identificadores hacia imágenes reales. En un sistema de Base de Datos, habría una tabla de `assets` vinculada a las entidades.
