import './packagedAppStub';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKEND } from '../src/main/backend';

// Security 5o: started as a packaged app with UNVIBE_BACKEND set and a .env in the working folder, the main process
// keeps the backend it was built for (the test build bakes none, so the local default) and reads no .env file.
test('a packaged app ignores UNVIBE_BACKEND and .env files', () => {
  assert.equal(BACKEND, 'http://localhost:8787');
  assert.equal(process.env.UNVIBE_PACKAGED_DOTENV_PROBE, undefined);
});
