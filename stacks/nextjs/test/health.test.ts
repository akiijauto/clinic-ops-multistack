import { test } from 'node:test';
import assert from 'node:assert/strict';
import { health } from '../src/lib/health.ts';

test('health() returns the documented payload', () => {
  assert.deepEqual(health(), { status: 'ok' });
});
