import type * as vscode from 'vscode';

const TOKEN_KEY = 'uncode.token';

/** Stores the backend bearer token in VS Code SecretStorage (encrypted at rest by the OS). */
export class SessionManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  getToken(): Thenable<string | undefined> {
    return this.secrets.get(TOKEN_KEY);
  }

  setToken(token: string): Thenable<void> {
    return this.secrets.store(TOKEN_KEY, token);
  }

  clear(): Thenable<void> {
    return this.secrets.delete(TOKEN_KEY);
  }
}
