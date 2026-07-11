import * as vscode from 'vscode';
import type { API, GitExtension, Repository } from '../types/git';
import { isExcludedPath } from '../config/exclusions';

export interface DetectedChange {
  repoRoot: string;
  changedFiles: string[];
  fileCount: number;
  /** Stable signature of the current change set, used to dedupe repeat prompts. */
  signature: string;
}

/**
 * Watches git working-tree state via the built-in `vscode.git` API and reports when the set
 * of changed files changes. Debounced; excludes secret/dependency/build paths so we never
 * offer to review something we would never send to a model.
 */
export class GitWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private api: API | undefined;
  private readonly lastSignature = new Map<string, string>();
  private debounce: NodeJS.Timeout | undefined;

  constructor(private readonly onChange: (change: DetectedChange | undefined) => void) {}

  async start(): Promise<void> {
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!ext) {
      // No git extension (rare). Selection/file review still works.
      return;
    }
    const gitExt = ext.isActive ? ext.exports : await ext.activate();
    if (!gitExt.enabled) {
      return;
    }
    this.api = gitExt.getAPI(1);
    this.api.repositories.forEach((repo) => this.track(repo));
    this.disposables.push(this.api.onDidOpenRepository((repo) => this.track(repo)));
    this.evaluate();
  }

  private track(repo: Repository): void {
    this.disposables.push(repo.state.onDidChange(() => this.schedule()));
  }

  private schedule(): void {
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
    this.debounce = setTimeout(() => this.evaluate(), 400);
  }

  private evaluate(): void {
    if (!this.api) {
      return;
    }
    let latest: DetectedChange | undefined;

    for (const repo of this.api.repositories) {
      const root = repo.rootUri.fsPath;
      const changes = [...repo.state.workingTreeChanges, ...repo.state.indexChanges];
      const files = changes
        .map((c) => c.uri.fsPath)
        .filter((p) => !isExcludedPath(p))
        .sort();

      if (files.length === 0) {
        this.lastSignature.delete(root);
        continue;
      }

      const signature = files.join('|');
      if (signature !== this.lastSignature.get(root)) {
        this.lastSignature.set(root, signature);
        latest = {
          repoRoot: root,
          changedFiles: files,
          fileCount: files.length,
          signature,
        };
      }
    }

    this.onChange(latest);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    if (this.debounce) {
      clearTimeout(this.debounce);
    }
  }
}
