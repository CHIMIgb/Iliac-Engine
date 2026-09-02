import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../../engine/core/player.js';

test('Player rota yaw y conserva forward perpendicular al right', () => {
  const p = new Player(0, 0, 0.5, 0, 0);
  p.rotateYaw(Math.PI / 2);
  assert.ok(Math.abs(p.forwardX - 0) < 1e-9 && Math.abs(p.forwardY - 1) < 1e-9, 'forward rotado 90° apunta a (0,1)');
  assert.ok(Math.abs(p.forwardX * p.rightX + p.forwardY * p.rightY) < 1e-9, 'forward y right son perpendiculares');
});
