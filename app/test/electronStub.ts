/**
 * Minimal Electron stand-in for unit tests that import main-process modules.
 * Every network call through `net.fetch` is recorded and fails, so a test can prove nothing was sent.
 */
import { tmpdir } from 'node:os';

export const netCalls: string[] = [];

export const net = {
  fetch: async (input: string | URL | Request): Promise<Response> => {
    netCalls.push(String(input instanceof Request ? input.url : input));
    throw new Error('Network is disabled in tests.');
  },
};

export const app = {
  getPath: (): string => tmpdir(),
  isPackaged: false,
  getVersion: (): string => '0.0.0-test',
};

export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: (value: string): Buffer => Buffer.from(value),
  decryptString: (value: Buffer): string => value.toString(),
};
