import * as vscode from 'vscode';
import type { ReviewPanelProvider } from '../panel/reviewPanelProvider';
import type { ReviewRequest, WebviewToHost } from '../panel/reviewTypes';
import type { ReviewContext, ReviewRequestPayload } from '../protocol';
import { buildContext, scanTargets } from '../context/contextBuilder';
import { scanBlocks, hasBlocking, type SecretFinding } from '../security/secretFilter';
import { streamReview } from '../net/reviewClient';
import { fetchComprehension } from '../net/comprehensionClient';
import { toSegments, basename } from '../citations/citations';
import type { LearningStore } from '../learning/learningStore';
import type { LearningEvent } from '../learning/types';
import type { ComprehensionQuestion, ReviewRequestPayload as Payload } from '../protocol';

interface ActiveReview {
  request: ReviewRequest;
  context: ReviewContext;
  repoKey: string;
  eventId?: string;
}

/**
 * Orchestrates a review: build local context -> secret filter -> per-repo consent preview ->
 * stream explanation into the panel. Also handles follow-ups, "explain differently", and the
 * consent decision coming back from the webview.
 */
export class ReviewController {
  private active: ActiveReview | undefined;
  private abort: AbortController | undefined;
  private pendingQuestion: ComprehensionQuestion | undefined;
  /** Files (rel path + basename) actually sent in the current context — for citation validation. */
  private readonly contextFiles = new Set<string>();

  constructor(
    private readonly panel: ReviewPanelProvider,
    private readonly log: vscode.OutputChannel,
    private readonly memento: vscode.Memento,
    private readonly store: LearningStore,
  ) {
    this.panel.onMessage = (m) => this.onWebviewMessage(m);
  }

  /** Show the local progress summary in the panel. */
  showProgress(): void {
    this.panel.showStats(this.store.progress());
  }

  private backendUrl(): string {
    return vscode.workspace
      .getConfiguration('uncode')
      .get<string>('backendUrl', 'http://localhost:8787');
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
    const backendUrl = this.backendUrl();

    // Record the review once, on the initial explanation (not follow-ups / re-explains).
    if (!this.active.eventId && !question && variant !== 'different') {
      const id = genId();
      this.active.eventId = id;
      void this.store.addReview(makeEvent(id, this.active.request, this.active.context.primaryFile));
    }

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

  private async startComprehension(): Promise<void> {
    if (!this.active) {
      return;
    }
    this.panel.comprehensionLoading();
    const payload: Payload = {
      scope: this.active.request.scope,
      level: this.active.request.level,
      context: this.active.context,
    };
    try {
      const question = await fetchComprehension(this.backendUrl(), payload);
      this.pendingQuestion = question;
      this.panel.showComprehension(question.question, question.options);
    } catch (err) {
      this.pendingQuestion = undefined;
      this.panel.streamError(`Could not create a comprehension question: ${errMessage(err)}`);
    }
  }

  private gradeComprehension(selectedIndex: number): void {
    const q = this.pendingQuestion;
    if (!q) {
      return;
    }
    const pass = selectedIndex === q.answerIndex;
    if (this.active?.eventId) {
      void this.store.setOutcome(
        this.active.eventId,
        pass ? 'understood' : 'needs_review',
        q.concept,
        q.conceptLabel,
      );
    }
    this.panel.showComprehensionResult(pass, q.rationale);
    this.log.appendLine(`[review] comprehension ${pass ? 'pass' : 'fail'} — concept ${q.concept}`);
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
          if (this.active?.eventId) {
            void this.store.setOutcome(this.active.eventId, 'understood');
          }
          void vscode.window.setStatusBarMessage('Uncode: saved. Open the panel menu → Test me, or run Uncode: Show Progress.', 3000);
        } else if (message.action === 'testMe') {
          void this.startComprehension();
        }
        break;
      case 'comprehensionAnswer':
        this.gradeComprehension(message.selectedIndex);
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

function makeEvent(id: string, request: ReviewRequest, file: string | undefined): LearningEvent {
  return {
    id,
    ts: new Date().toISOString(),
    scope: request.scope,
    level: request.level,
    file,
    outcome: 'reviewed',
  };
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
