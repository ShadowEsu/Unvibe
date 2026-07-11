import * as vscode from 'vscode';
import { GitWatcher, type DetectedChange } from './detection/gitWatcher';
import { SelectionWatcher } from './detection/selectionWatcher';
import { StatusBar } from './ui/statusBar';
import { ReviewPanelProvider } from './panel/reviewPanelProvider';
import { ReviewController } from './review/reviewController';
import { isExcludedPath } from './config/exclusions';
import type { ExplanationLevel, ReviewRequest, ReviewScope } from './panel/reviewTypes';

let lastDetected: DetectedChange | undefined;
let lastPromptedSignature: string | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Uncode');
  log.appendLine('[uncode] activating (Milestone 2: context + secret filter + streaming)');

  const statusBar = new StatusBar();
  const panel = new ReviewPanelProvider(context.extensionUri);
  const controller = new ReviewController(panel, log, context.globalState);
  const selectionWatcher = new SelectionWatcher();

  context.subscriptions.push(
    log,
    statusBar,
    controller,
    vscode.window.registerWebviewViewProvider(ReviewPanelProvider.viewId, panel),
  );

  selectionWatcher.start();
  context.subscriptions.push(selectionWatcher);

  const gitWatcher = new GitWatcher((change) => onDetectedChange(change, statusBar, log));
  void gitWatcher.start();
  context.subscriptions.push(gitWatcher);

  // ---- Commands ----
  context.subscriptions.push(
    vscode.commands.registerCommand('uncode.openPanel', () => panel.reveal()),

    vscode.commands.registerCommand('uncode.reviewSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        void vscode.window.showInformationMessage('Uncode: select some code first.');
        return;
      }
      const path = editor.document.uri.fsPath;
      if (isExcludedPath(path)) {
        void vscode.window.showWarningMessage('Uncode: this file is excluded from review (see privacy defaults).');
        return;
      }
      const sel = editor.selection;
      void controller.review(makeRequest('selection', {
        title: 'Selected code',
        detail: `${basename(path)} · lines ${sel.start.line + 1}–${sel.end.line + 1}`,
        files: [path],
      }));
    }),

    vscode.commands.registerCommand('uncode.reviewFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage('Uncode: open a file to review.');
        return;
      }
      const path = editor.document.uri.fsPath;
      if (isExcludedPath(path)) {
        void vscode.window.showWarningMessage('Uncode: this file is excluded from review (see privacy defaults).');
        return;
      }
      void controller.review(makeRequest('file', {
        title: 'Current file',
        detail: `${basename(path)} · ${editor.document.lineCount} lines`,
        files: [path],
      }));
    }),

    vscode.commands.registerCommand('uncode.reviewDiff', () => {
      if (!lastDetected) {
        void vscode.window.showInformationMessage('Uncode: no recent changes detected.');
        return;
      }
      const c = lastDetected;
      void controller.review(makeRequest('diff', {
        title: 'Recent changes',
        detail: `${c.fileCount} changed file${c.fileCount === 1 ? '' : 's'}`,
        files: c.changedFiles,
      }));
    }),

    vscode.commands.registerCommand('uncode.reviewProject', () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      void controller.review(makeRequest('project', {
        title: 'Project overview',
        detail: folder ? folder.name : 'workspace',
        files: [],
      }));
    }),

    vscode.commands.registerCommand('uncode.dismissPrompt', () => {
      lastPromptedSignature = lastDetected?.signature;
      statusBar.setIdle();
    }),
  );

  log.appendLine('[uncode] activated.');
}

function onDetectedChange(
  change: DetectedChange | undefined,
  statusBar: StatusBar,
  log: vscode.OutputChannel,
): void {
  lastDetected = change;
  if (!change) {
    statusBar.setIdle();
    return;
  }

  const cfg = vscode.workspace.getConfiguration('uncode');
  const minFiles = cfg.get<number>('detection.minChangedFiles', 1);
  if (change.fileCount < minFiles) {
    statusBar.setIdle();
    return;
  }

  statusBar.setChanges(change.fileCount);
  log.appendLine(`[uncode] detected ${change.fileCount} changed file(s) in ${change.repoRoot}`);

  const offer = cfg.get<boolean>('notifications.offerReview', true);
  if (offer && change.signature !== lastPromptedSignature) {
    lastPromptedSignature = change.signature;
    void offerReview(change);
  }
}

async function offerReview(change: DetectedChange): Promise<void> {
  const noun = change.fileCount === 1 ? 'file' : 'files';
  const choice = await vscode.window.showInformationMessage(
    `Uncode detected ${change.fileCount} changed ${noun}. Review?`,
    'Review',
    'Dismiss',
  );
  if (choice === 'Review') {
    void vscode.commands.executeCommand('uncode.reviewDiff');
  }
}

function makeRequest(
  scope: ReviewScope,
  parts: { title: string; detail: string; files: string[] },
): ReviewRequest {
  const level = vscode.workspace
    .getConfiguration('uncode')
    .get<ExplanationLevel>('explanationLevel', 'intermediate');
  return { scope, level, ...parts };
}

function basename(fsPath: string): string {
  const norm = fsPath.replace(/\\/g, '/');
  return norm.substring(norm.lastIndexOf('/') + 1);
}

export function deactivate(): void {
  // Disposables registered in context.subscriptions are cleaned up by VS Code.
}
