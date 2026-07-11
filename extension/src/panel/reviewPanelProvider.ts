import * as vscode from 'vscode';
import type {
  ExplanationLevel,
  HostToWebview,
  ReviewRequest,
  WebviewToHost,
} from './reviewTypes';

/**
 * The compact black-and-white review side panel (webview). In Milestone 1 it renders the
 * review context, the level selector, and the three outcome actions as a UI shell. The
 * explanation area is explicitly labelled as landing in Milestone 2 — no mock output is
 * presented as real.
 */
export class ReviewPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'uncode.reviewPanel';

  private view: vscode.WebviewView | undefined;
  private pending: ReviewRequest | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly log: vscode.OutputChannel,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToHost) => {
      switch (message.type) {
        case 'ready':
          if (this.pending) {
            this.post({ type: 'review', request: this.pending });
          }
          break;
        case 'levelChanged':
          void vscode.workspace
            .getConfiguration('uncode')
            .update('explanationLevel', message.level, vscode.ConfigurationTarget.Global);
          this.log.appendLine(`[panel] level changed -> ${message.level}`);
          break;
        case 'action':
          // Milestone 2 wires these to the AI layer + persistence. For now, log honestly.
          this.log.appendLine(`[panel] action: ${message.action} (not yet wired — Milestone 2)`);
          void vscode.window.setStatusBarMessage(
            `Uncode: "${message.action}" arrives in Milestone 2`,
            2500,
          );
          break;
        case 'openDashboard':
          this.log.appendLine('[panel] open dashboard (Milestone 5)');
          void vscode.window.setStatusBarMessage('Uncode: dashboard arrives in Milestone 5', 2500);
          break;
      }
    });
  }

  /** Show a review request in the panel, revealing the view if needed. */
  requestReview(request: ReviewRequest): void {
    this.pending = request;
    if (this.view) {
      this.view.show?.(true);
      this.post({ type: 'review', request });
    } else {
      void vscode.commands.executeCommand(`${ReviewPanelProvider.viewId}.focus`);
      // The view will pull `pending` when it fires 'ready'.
    }
  }

  setLevel(level: ExplanationLevel): void {
    this.post({ type: 'level', level });
  }

  private post(message: HostToWebview): void {
    void this.view?.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const uri = (file: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', file));
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource}`,
      `img-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${uri('panel.css')}" />
  <title>Uncode Review</title>
</head>
<body>
  <main class="panel" aria-live="polite">
    <header class="panel__head">
      <span class="brand">Uncode</span>
      <button id="dashboard" class="linkbtn" type="button">Dashboard</button>
    </header>

    <section id="context" class="context" hidden>
      <div class="context__title" id="ctxTitle"></div>
      <div class="context__detail" id="ctxDetail"></div>
      <ul class="filelist" id="ctxFiles"></ul>
    </section>

    <section class="levels" aria-label="Explanation level">
      <div class="levels__label">Level</div>
      <div class="segmented" role="radiogroup" aria-label="Explanation level">
        <button class="seg" role="radio" data-level="beginner" aria-checked="false">Beginner</button>
        <button class="seg" role="radio" data-level="intermediate" aria-checked="true">Intermediate</button>
        <button class="seg" role="radio" data-level="advanced" aria-checked="false">Advanced</button>
      </div>
    </section>

    <section class="explanation" aria-label="Explanation">
      <div id="empty" class="state">
        <p class="state__title">Nothing to review yet</p>
        <p class="state__body">Select code, open a file, or make a change, then choose a review action.</p>
      </div>
      <div id="explainBody" class="explanation__body" hidden>
        <p class="notice">Explanations stream here in <strong>Milestone 2</strong> (AI layer + context builder).</p>
      </div>
    </section>

    <section class="actions" aria-label="Outcome">
      <button id="understand" class="btn" type="button">I understand</button>
      <button id="explainDiff" class="btn" type="button">Explain differently</button>
      <button id="testMe" class="btn btn--primary" type="button">Test me</button>
    </section>

    <section class="followup">
      <label class="visually-hidden" for="followupInput">Ask a follow-up question</label>
      <input id="followupInput" class="input" type="text"
             placeholder="Ask a follow-up… (Milestone 2)" disabled />
    </section>
  </main>
  <script nonce="${nonce}" src="${uri('panel.js')}"></script>
</body>
</html>`;
  }

  dispose(): void {
    // WebviewView lifecycle is owned by VS Code; nothing to dispose explicitly here.
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
