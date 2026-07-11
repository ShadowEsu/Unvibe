import * as vscode from 'vscode';
import type { ReviewPanelProvider } from '../panel/reviewPanelProvider';
import type { ReviewRequest, WebviewToHost } from '../panel/reviewTypes';
import type { ReviewContext, ReviewRequestPayload } from '../protocol';
import { buildContext, scanTargets } from '../context/contextBuilder';
import { scanBlocks, hasBlocking, type SecretFinding } from '../security/secretFilter';
import { streamReview } from '../net/reviewClient';
import { toSegments, basename } from '../citations/citations';

interface ActiveReview {
  request: ReviewRequest;
  context: ReviewContext;
  repoKey: string;
}

/**
 * Orchestrates a review: build local context -> secret filter -> per-repo consent preview ->
 * stream explanation into the panel. Also handles follow-ups, "explain differently", and the
 * consent decision coming back from the webview.
 */
export class ReviewController {
  private active: ActiveReview | undefined;
  private abort: AbortController | undefined;
  /** Files (rel path + basename) actually sent in the current context — for citation validation. */
  private readonly contextFiles = new Set<string>();

  constructor(
    private readonly panel: ReviewPanelProvider,
    private readonly log: vscode.OutputChannel,
    private readonly memento: vscode.Memento,
  ) {
    this.panel.onMessage = (m) => this.onWebviewMessage(m);
  }

  /** Entry point from a command. */
  async review(request: ReviewRequest): Promise<void> {
    this.panel.showContext(request);
    let context: ReviewContext;
    try {
      context = await buildContext(request);
    } catch (err) {
      this.panel.streamError(`Could not read the code: ${errMessage(err)}`);
      return;
    }

    const findings = scanBlocks(scanTargets(context));
    if (hasBlocking(findings)) {
      this.log.appendLine(`[review] blocked: ${findings.map((f) => f.rule).join(', ')}`);
      this.panel.showBlocked(findings.filter((f) => f.severity === 'block'));
      return;
    }

    this.rememberContextFiles(context);
    const repoKey = repoKeyFor(request.files[0]);
    this.active = { request, context, repoKey };
    const suspects = findings.filter((f) => f.severity === 'suspect');

    if (this.hasConsent(repoKey) && suspects.length === 0) {
      await this.send();
    } else {
      // Show exactly what will be transmitted before first send (or when suspects exist).
      this.panel.showPreview(previewText(request, context), suspects);
    }
  }

  private async send(question?: string, variant?: 'default' | 'different'): Promise<void> {
    if (!this.active) {
      return;
    }
    const backendUrl = vscode.workspace
      .getConfiguration('uncode')
      .get<string>('backendUrl', 'http://localhost:8787');

    const payload: ReviewRequestPayload = {
      scope: this.active.request.scope,
      level: this.active.request.level,
      context: this.active.context,
      question,
      variant,
    };

    this.abort?.abort();
    this.abort = new AbortController();
    this.panel.streamStart();

    let full = '';
    await streamReview(
      backendUrl,
      payload,
      (event) => {
        switch (event.type) {
          case 'token':
            full += event.text;
            this.panel.streamToken(event.text);
            break;
          case 'done':
            this.renderCitations(full);
            this.panel.streamDone(event.mock);
            break;
          case 'error':
            this.panel.streamError(event.message);
            break;
        }
      },
      this.abort.signal,
    );
    if (!full) {
      this.log.appendLine('[review] stream produced no tokens');
    }
  }

  /** Parse citations from the completed explanation, validate them, and render clickable refs. */
  private renderCitations(full: string): void {
    const segments = toSegments(full, (file) => this.verifyCitation(file));
    const unverified = segments.filter((s) => s.type === 'cite' && !s.verified).length;
    if (unverified > 0) {
      this.log.appendLine(`[review] ${unverified} citation(s) referenced files not in the sent context`);
    }
    this.panel.showRendered(segments, unverified);
  }

  private verifyCitation(file: string): boolean {
    return this.contextFiles.has(file) || this.contextFiles.has(basename(file));
  }

  private rememberContextFiles(context: ReviewContext): void {
    this.contextFiles.clear();
    const add = (p: string | undefined) => {
      if (p) {
        const clean = p.replace(/\/$/, '');
        this.contextFiles.add(clean);
        this.contextFiles.add(basename(clean));
      }
    };
    add(context.primaryFile);
    add(context.selection?.file);
    context.diffHunks?.forEach((h) => add(h.file));
    context.projectStructure.forEach((p) => add(p.trim()));
  }

  private async openCitation(file: string, startLine: number): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      return;
    }
    let uri = vscode.Uri.joinPath(folder.uri, file);
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      const found = await vscode.workspace.findFiles(`**/${basename(file)}`, '**/node_modules/**', 1);
      if (found.length === 0) {
        void vscode.window.showInformationMessage(`Uncode: could not locate ${file}.`);
        return;
      }
      uri = found[0];
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });
    const pos = new vscode.Position(Math.max(0, startLine - 1), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  private onWebviewMessage(message: WebviewToHost): void {
    switch (message.type) {
      case 'levelChanged':
        void vscode.workspace
          .getConfiguration('uncode')
          .update('explanationLevel', message.level, vscode.ConfigurationTarget.Global);
        if (this.active) {
          this.active.request.level = message.level;
        }
        break;
      case 'consent':
        if (message.granted && this.active) {
          void this.memento.update(consentStoreKey(this.active.repoKey), true);
          void this.send();
        } else {
          this.panel.showContext(this.active?.request ?? emptyRequest());
        }
        break;
      case 'question':
        if (message.text.trim()) {
          void this.send(message.text.trim());
        }
        break;
      case 'action':
        if (message.action === 'explainDifferently') {
          void this.send(undefined, 'different');
        } else if (message.action === 'understand') {
          // Persistence of the outcome lands in Milestone 4 (dashboard sync).
          this.log.appendLine('[review] marked understood (persisted in Milestone 4)');
          void vscode.window.setStatusBarMessage('Uncode: saved locally — sync arrives in Milestone 4', 2500);
        } else if (message.action === 'testMe') {
          void vscode.window.setStatusBarMessage('Uncode: comprehension check arrives in Milestone 4', 2500);
        }
        break;
      case 'openCitation':
        void this.openCitation(message.file, message.startLine);
        break;
      case 'openDashboard':
        void vscode.window.setStatusBarMessage('Uncode: dashboard arrives in Milestone 5', 2500);
        break;
    }
  }

  private hasConsent(repoKey: string): boolean {
    return this.memento.get<boolean>(consentStoreKey(repoKey), false);
  }

  dispose(): void {
    this.abort?.abort();
  }
}

function previewText(request: ReviewRequest, context: ReviewContext): string {
  const lines: string[] = [];
  lines.push(`scope: ${request.scope}`);
  lines.push(`level: ${request.level}`);
  lines.push(`language: ${context.language}`);
  if (context.primaryFile) {
    lines.push(`file: ${context.primaryFile}`);
  }
  lines.push(`project: ${context.projectStructure.join(', ') || '(none)'}`);
  if (context.imports.length) {
    lines.push('', 'imports:', ...context.imports.slice(0, 20));
  }
  if (context.diffHunks?.length) {
    lines.push('', `diff hunks: ${context.diffHunks.length}`);
    for (const h of context.diffHunks.slice(0, 6)) {
      lines.push(`  ${h.file} @@ -${h.oldStart} +${h.newStart}`);
    }
  }
  if (context.code) {
    lines.push('', 'code:', context.code.slice(0, 2000));
    if (context.truncated) {
      lines.push('… (truncated)');
    }
  }
  return lines.join('\n');
}

function repoKeyFor(fsPath: string | undefined): string {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (fsPath) {
    const match = folders.find((f) => fsPath.startsWith(f.uri.fsPath));
    if (match) {
      return match.uri.fsPath;
    }
  }
  return folders[0]?.uri.fsPath ?? 'workspace';
}

function consentStoreKey(repoKey: string): string {
  return `uncode.consent:${repoKey}`;
}

function emptyRequest(): ReviewRequest {
  return { scope: 'file', title: '', detail: '', files: [], level: 'intermediate' };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type { SecretFinding };
