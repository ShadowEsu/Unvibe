import * as vscode from 'vscode';
import type { SessionManager } from '../auth/session';
import type { LearningEvent } from '../learning/types';
import { startDeviceAuth, pollToken, postEvents } from '../net/syncClient';

/**
 * Best-effort sync to the Uncode backend. Local-first: everything works signed-out; when a
 * token is present, review events are pushed. Failures never block the review flow.
 */
export class SyncService {
  constructor(
    private readonly session: SessionManager,
    private readonly log: vscode.OutputChannel,
  ) {}

  private backendUrl(): string {
    return vscode.workspace
      .getConfiguration('uncode')
      .get<string>('backendUrl', 'http://localhost:8787');
  }

  async isSignedIn(): Promise<boolean> {
    return !!(await this.session.getToken());
  }

  async signIn(): Promise<void> {
    const backendUrl = this.backendUrl();
    let start;
    try {
      start = await startDeviceAuth(backendUrl);
    } catch (err) {
      void vscode.window.showErrorMessage(`Uncode: could not start sign-in — ${errMessage(err)}`);
      return;
    }

    const activateUri = vscode.Uri.parse(`${start.verificationUri}?code=${start.userCode}`);
    void vscode.env.openExternal(activateUri);

    const token = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Uncode: enter code ${start.userCode} in the browser to connect…`,
        cancellable: true,
      },
      async (_progress, cancel) => {
        const maxTries = 150;
        for (let i = 0; i < maxTries; i++) {
          if (cancel.isCancellationRequested) {
            return undefined;
          }
          await delay(Math.max(1, start.interval) * 1000);
          try {
            const t = await pollToken(backendUrl, start.deviceCode);
            if (t) {
              return t;
            }
          } catch {
            // keep polling
          }
        }
        return undefined;
      },
    );

    if (token) {
      await this.session.setToken(token);
      void vscode.window.showInformationMessage('Uncode: connected. Your learning will now sync.');
    } else {
      void vscode.window.showWarningMessage('Uncode: sign-in was cancelled or timed out.');
    }
  }

  async signOut(): Promise<void> {
    await this.session.clear();
    void vscode.window.showInformationMessage('Uncode: signed out. Learning stays on this machine.');
  }

  /** Push events if signed in; swallow errors (local copy remains the source of truth). */
  async push(events: LearningEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const token = await this.session.getToken();
    if (!token) {
      return;
    }
    try {
      await postEvents(this.backendUrl(), token, events);
    } catch (err) {
      this.log.appendLine(`[sync] push failed (will retry on next review): ${errMessage(err)}`);
    }
  }

  openDashboard(): void {
    void vscode.env.openExternal(vscode.Uri.parse(this.backendUrl()));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
