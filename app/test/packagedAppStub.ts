/**
 * Imported first by a test that needs the main process to start as a packaged app: the Electron stand-in reports
 * isPackaged, the environment names a hostile backend, and the working folder holds a .env with another one,
 * all before any app module loads.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app } from './electronStub';

app.isPackaged = true;
process.env.UNVIBE_BACKEND = 'https://attacker.example.test';
const dir = mkdtempSync(join(tmpdir(), 'unvibe-packaged-'));
writeFileSync(join(dir, '.env'), 'UNVIBE_PACKAGED_DOTENV_PROBE=read\n');
process.chdir(dir);
