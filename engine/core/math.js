export const PI2 = Math.PI * 2;

export function rotate(vx, vy, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vx * cos - vy * sin,
    y: vx * sin + vy * cos,
  };
}
