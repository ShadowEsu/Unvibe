import type { Event, Uri } from 'vscode';

/**
 * Minimal subset of the built-in `vscode.git` extension API that Uncode uses.
 * The full API is not published in @types/vscode, so we declare only what we need.
 * Source of truth: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
 */

export interface GitExtension {
  readonly enabled: boolean;
  getAPI(version: 1): API;
}

export interface API {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: Event<Repository>;
  readonly onDidCloseRepository: Event<Repository>;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly state: RepositoryState;
}

export interface RepositoryState {
  readonly workingTreeChanges: Change[];
  readonly indexChanges: Change[];
  readonly mergeChanges: Change[];
  readonly HEAD: Branch | undefined;
  readonly onDidChange: Event<void>;
}

export interface Branch {
  readonly name?: string;
  readonly commit?: string;
}

export interface Change {
  readonly uri: Uri;
  readonly originalUri: Uri;
  readonly status: number;
}
