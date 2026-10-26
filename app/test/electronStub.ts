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

/** windows.ts imports these; unit tests never open a window, so any real use fails loudly. */
export class BrowserWindow {
  constructor() {
    throw new Error('Windows are not available in tests.');
  }

  static getAllWindows(): BrowserWindow[] {
    return [];
  }

  static fromWebContents(): null {
    return null;
  }
}

export const screen = {
  getPrimaryDisplay: (): never => {
    throw new Error('Displays are not available in tests.');
  },
};

export const shell = {
  openExternal: async (): Promise<never> => {
    throw new Error('Opening external links is disabled in tests.');
  },
};

/** Records what was cleared from the default session (renderer storage, HTTP cache). */
export const sessionCalls: Array<{ call: 'clearStorageData' | 'clearCache'; options?: Electron.ClearStorageDataOptions }> = [];

export const session = {
  defaultSession: {
    clearStorageData: async (options?: Electron.ClearStorageDataOptions): Promise<void> => {
      sessionCalls.push({ call: 'clearStorageData', options });
    },
    clearCache: async (): Promise<void> => {
      sessionCalls.push({ call: 'clearCache' });
    },
  },
};
