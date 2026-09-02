import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as publicApi from '../../engine/index.js';

test('API pública del motor solo expone Engine3D', () => {
  assert.deepStrictEqual(Object.keys(publicApi).sort(), ['Engine3D']);
});
