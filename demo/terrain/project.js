// project.js — Demo 3: Terreno Irregular

// Matriz de alturas Z (5x5 para una grilla de 4x4 sectores)
const heightMap = [
  [ 2, 4, 3, 2, 1 ],
  [ 1, 3, 5, 4, 2 ],
  [ 0, 2, 8, 5, 3 ],
  [ 1, 3, 4, 2, 1 ],
  [ 0, 1, 2, 1, 0 ]
];

const gridV = [];
// Creamos los 25 vértices
for (let y = 0; y <= 4; y++) {
  for (let x = 0; x <= 4; x++) {
    gridV.push({ id: `v_${x}_${y}`, x: x * 8, y: y * 8 });
  }
}

const sectors = [];
const walls = [];
const sprites = [];

// Función auxiliar para determinar la textura del suelo basada en la altura media
function getTexForHeight(h) {
  if (h >= 6) return 'rock';
  if (h >= 3) return 'dirt';
  return 'grass';
}

// Crear los 16 sectores
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    const id = `s_${x}_${y}`;
    // Vértices en orden (SW, SE, NE, NW) -> (x, y), (x+1, y), (x+1, y+1), (x, y+1)
    const vIds = [
      `v_${x}_${y}`,
      `v_${x+1}_${y}`,
      `v_${x+1}_${y+1}`,
      `v_${x}_${y+1}`
    ];
    
    // Alturas correspondientes
    const h = [
      heightMap[y][x],
      heightMap[y][x+1],
      heightMap[y+1][x+1],
      heightMap[y+1][x]
    ];
    
    const avgH = (h[0] + h[1] + h[2] + h[3]) / 4;
    
    sectors.push({
      id,
      vertexIds: vIds,
      floorH: h,
      ceilH: 50, // cielo abierto
      floorTex: getTexForHeight(avgH),
      ceilTex: 'sky',
      wallTex: 'rock'
    });
    
    // Plantar algunos árboles y rocas aleatoriamente
    if (Math.random() > 0.6) {
      sprites.push({
        id: `tree_${x}_${y}`,
        tex: 'tree',
        pos: { x: x * 8 + 4 + (Math.random()*4-2), y: y * 8 + 4 + (Math.random()*4-2), z: avgH + 1.5 },
        scale: 1.5 + Math.random(),
        billboard: true
      });
    } else if (Math.random() > 0.7) {
      sprites.push({
        id: `rock_${x}_${y}`,
        tex: 'rock_sp',
        pos: { x: x * 8 + 4, y: y * 8 + 4, z: avgH + 0.5 },
        scale: 1.0 + Math.random(),
        billboard: true
      });
    }
  }
}

// Agregar paredes perimetrales y portales internos
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    const sId = `s_${x}_${y}`;
    
    // Borde Sur (y)
    if (y === 0) {
      walls.push({ id: `w_s_${x}_${y}`, a: `v_${x}_${y}`, b: `v_${x+1}_${y}`, sectorFront: sId, sectorBack: null });
    } else {
      // Portal hacia el sector sur
      walls.push({ id: `w_p_s_${x}_${y}`, a: `v_${x}_${y}`, b: `v_${x+1}_${y}`, sectorFront: sId, sectorBack: `s_${x}_${y-1}`, portal: true });
    }
    
    // Borde Norte (y+1)
    if (y === 3) {
      walls.push({ id: `w_n_${x}_${y}`, a: `v_${x+1}_${y+1}`, b: `v_${x}_${y+1}`, sectorFront: sId, sectorBack: null });
    } else {
      // Portal hacia el sector norte
      walls.push({ id: `w_p_n_${x}_${y}`, a: `v_${x+1}_${y+1}`, b: `v_${x}_${y+1}`, sectorFront: sId, sectorBack: `s_${x}_${y+1}`, portal: true });
    }
    
    // Borde Oeste (x)
    if (x === 0) {
      walls.push({ id: `w_w_${x}_${y}`, a: `v_${x}_${y+1}`, b: `v_${x}_${y}`, sectorFront: sId, sectorBack: null });
    } else {
      // Portal hacia el sector oeste
      walls.push({ id: `w_p_w_${x}_${y}`, a: `v_${x}_${y+1}`, b: `v_${x}_${y}`, sectorFront: sId, sectorBack: `s_${x-1}_${y}`, portal: true });
    }
    
    // Borde Este (x+1)
    if (x === 3) {
      walls.push({ id: `w_e_${x}_${y}`, a: `v_${x+1}_${y}`, b: `v_${x+1}_${y+1}`, sectorFront: sId, sectorBack: null });
    } else {
      // Portal hacia el sector este
      walls.push({ id: `w_p_e_${x}_${y}`, a: `v_${x+1}_${y}`, b: `v_${x+1}_${y+1}`, sectorFront: sId, sectorBack: `s_${x+1}_${y}`, portal: true });
    }
  }
}

export const project = {
  meta: { name: 'Demo Terreno', schemaVersion: 3, renderMode: '3d' },
  render: {
    fov: 85, near: 0.1, far: 500, backgroundColor: 0x87ceeb,
    ambientLight: { color: 0xffffff, intensity: 0.5 },
    directionalLight: { color: 0xffddaa, intensity: 1.0, position: [30, 50, 10] },
  },
  camera: { posX: 4, posY: 4, posZ: 3.5, yaw: 0.78, pitch: -0.2 },
  world: {
    vertices: gridV,
    sectors,
    walls,
    ramps: [],
    sprites,
    textures: {
      grass: '../../demo/textures/pasto.svg',
      dirt: '../../demo/textures/suelo2.svg',
      rock: '../../demo/textures/roca.svg',
      tree: '../../demo/textures/sprite_arbol.svg',
      rock_sp: '../../demo/textures/sprite_roca.svg',
      sky: 0x87CEEB,
    },
  },
};
