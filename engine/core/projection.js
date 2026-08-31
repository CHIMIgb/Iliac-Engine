export function wallProjection(perpWallDist, screenHeight) {
  const lineHeight = Math.floor(screenHeight / perpWallDist);
  let drawStart = Math.floor(-lineHeight / 2 + screenHeight / 2);
  let drawEnd = Math.floor(lineHeight / 2 + screenHeight / 2);
  if (drawStart < 0) drawStart = 0;
  if (drawEnd >= screenHeight) drawEnd = screenHeight - 1;
  return { lineHeight, drawStart, drawEnd };
}
