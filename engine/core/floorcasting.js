export function castFloorCeiling(map, camPosX, camPosY, camDirX, camDirY, camPlaneX, camPlaneY, screenWidth, screenHeight, floorTexNum, ceilTexNum, textures) {
  const floorColor = textures && textures[floorTexNum] ? textures[floorTexNum] : null;
  const ceilColor = textures && textures[ceilTexNum] ? textures[ceilTexNum] : null;

  // Altura del ojo del jugador (en unidades de mapa). Usar 1.0 como altura estándar.
  const posZ = 1.0;

  // Crear buffer de salida: array de colores por píxel (RGBA)
  const buffer = new Uint32Array(screenWidth * screenHeight);

  // Ray direction vectors for left and right edges
  const rayDirX0 = camDirX - camPlaneX;
  const rayDirY0 = camDirY - camPlaneY;
  const rayDirX1 = camDirX + camPlaneX;
  const rayDirY1 = camDirY + camPlaneY;

  // Para cada scanline vertical (suelo: de la mitad de pantalla hacia abajo)
  // y es el píxel actual, contando desde 0 hasta screenHeight-1
  for (let y = screenHeight / 2; y < screenHeight; ++y) {
    // Posición vertical relativa al centro de la pantalla
    const p = y - screenHeight / 2;

    // Distancia horizontal desde la cámara hasta el suelo para esta fila
    // Si p es 0 (horizonte), evitar división por cero
    const rowDistance = (p !== 0) ? posZ / p : 0;

    // Vector paso por cada píxel horizontal (avanzar un píxel en x)
    const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / screenWidth;
    const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / screenWidth;

    // Posición inicial en el mundo para el píxel más a la izquierda
    let floorX = camPosX + rowDistance * rayDirX0;
    let floorY = camPosY + rowDistance * rayDirY0;

    for (let x = 0; x < screenWidth; ++x) {
      // Coordenada de celda del mapa
      const cellX = Math.floor(floorX);
      const cellY = Math.floor(floorY);

      // Verificar límites del mapa
      const isValid = cellY >= 0 && cellY < map.length && cellX >= 0 && cellX < map[0].length;

      // Obtener color de textura o color base
      let color = 0;
      if (isValid && map[cellY][cellX] > 0) {
        // Usar textura si está disponible
        if (floorTexNum !== undefined && textures && textures[floorTexNum]) {
          const tex = textures[floorTexNum];
          // Coordenada de textura: parte fraccionaria del suelo
          const texX = Math.floor((floorX % 1) * 64) & 63;
          const texY = Math.floor((floorY % 1) * 64) & 63;
          const texIdx = texY * 64 + texX;
          color = tex[texIdx];
        } else {
          // Color sintético por defecto (color del tile)
          color = map[cellY][cellX];
        }
      } else {
        // Suelo vacío (fuera del mapa o fuera de límites)
        color = 0x202020; // color oscuro por defecto
      }

      // Índice en el buffer (y va de abajo hacia arriba en el bucle invertido)
      const bufferIdx = x + y * screenWidth;
      buffer[bufferIdx] = color;

      // Avanzar al siguiente píxel horizontal
      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  // Para el techo: dibujar desde la línea del horizonte hasta la parte superior
  // El techo es simétrico al suelo, usando las mismas coordenadas pero invirtiendo el y
  for (let y = 0; y < screenHeight / 2; ++y) {
    const p = y - screenHeight / 2; // negativo (arriba del centro)

    const rowDistance = (p !== 0) ? posZ / p : 0;

    const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / screenWidth;
    const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / screenWidth;

    let floorX = camPosX + rowDistance * rayDirX0;
    let floorY = camPosY + rowDistance * rayDirY0;

    for (let x = 0; x < screenWidth; ++x) {
      const cellX = Math.floor(floorX);
      const cellY = Math.floor(floorY);

      const isValid = cellY >= 0 && cellY < map.length && cellX >= 0 && cellX < map[0].length;

      let color = 0x404040; // color oscuro por defecto para techo

      if (isValid && map[cellY][cellX] > 0) {
        if (ceilTexNum !== undefined && textures && textures[ceilTexNum]) {
          const tex = textures[ceilTexNum];
          const texX = Math.floor((floorX % 1) * 64) & 63;
          const texY = Math.floor((floorY % 1) * 64) & 63;
          const texIdx = texY * 64 + texX;
          color = tex[texIdx];
        } else {
          // Si no hay textura, usar color gris en lugar del valor del tile (0 = negro)
          color = 0x202020;
        }
      }

      // El techo se dibuja en la posición simétrica: screenHeight - y - 1
      const bufferIdx = x + (screenHeight - y - 1) * screenWidth;
      buffer[bufferIdx] = color;

      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  return buffer;
}