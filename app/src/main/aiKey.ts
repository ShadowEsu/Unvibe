/**
 * Optional user-supplied AI API key. Stored encrypted with Electron safeStorage.
 * Never sent to the Unvibe backend — only used for direct provider calls from main.
 */
import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';
import { openToken, sealToken } from '../core/tokenVault';

function keyFile(): string {
  return path.join(app.getPath('userData'), 'unvibe-ai-key.bin');
}

export function hasAiKey(): boolean {
  return existsSync(keyFile());
}

export function readAiKey(): string | null {
  try {
    if (!existsSync(keyFile())) return null;
    const encoded = readFileSync(keyFile(), 'utf8').trim();
    if (!encoded) return null;
    return openToken(encoded, safeStorage);
  } catch {
    return null;
  }
}

export function writeAiKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('Paste a non-empty API key.');
  const encoded = sealToken(trimmed, safeStorage);
  mkdirSync(path.dirname(keyFile()), { recursive: true });
  writeFileSync(keyFile(), encoded, { mode: 0o600 });
}

export function clearAiKey(): void {
  try {
    if (existsSync(keyFile())) unlinkSync(keyFile());
  } catch {
    /* best-effort */
  }
}

export function aiKeyStatus(): { present: boolean; hint: string | null } {
  const key = readAiKey();
  if (!key) return { present: false, hint: null };
  const hint = key.length <= 8 ? '••••' : `${key.slice(0, 4)}…${key.slice(-4)}`;
  return { present: true, hint };
}
