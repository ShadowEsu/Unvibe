import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceVerificationUrl } from '../src/core/deviceAuth';

test('device auth preserves the activation path and encodes only the user code', () => {
  assert.equal(
    deviceVerificationUrl('https://api.unvibe.site/activate?source=desktop', 'A B+C'),
    'https://api.unvibe.site/activate?source=desktop&user_code=A+B%2BC',
  );
});

test('device auth refuses a non-HTTPS verification page', () => {
  assert.throws(() => deviceVerificationUrl('http://localhost:8787/activate', 'ABC123'), /HTTPS/);
});
