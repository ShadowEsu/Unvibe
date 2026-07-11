import * as vscode from 'vscode';
import type { SecretFinding } from '../security/secretFilter';
import type { Segment } from '../citations/citations';
import type {
  ExplanationLevel,
  HostToWebview,
  ReviewRequest,
  WebviewToHost,
} from './reviewTypes';

/**
 * The compact black-and-white review side panel (webview). It is a *view*: it renders state
 * and forwards user intents. All logic (context build, secret filter, consent, streaming)
 * lives in ReviewController.
 */
export class ReviewPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'uncode.reviewPanel';

  private view: vscode.WebviewView | undefined;
  private readonly queue: HostToWebview[] = [];
  private ready = false;

  /** Set by the controller to receive user intents from the webview. */
  public onMessage: ((message: WebviewToHost) => void) | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    this.ready = false;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToHost) => {
      if (message.type === 'ready') {
        this.ready = true;
        this.flush();
        return;
      }
      this.onMessage?.(message);
    });
  }

  reveal(): void {
    if (this.view) {
      this.view.show?.(true);
    } else {
      void vscode.commands.executeCommand(`${ReviewPanelProvider.viewId}.focus`);
    }
  }

  showContext(request: ReviewRequest): void {
    this.reveal();
    this.post({ type: 'review', request });
  }

  showPreview(text: string, suspects: SecretFinding[]): void {
    this.post({ type: 'preview', text, suspects });
  }

  showBlocked(findings: SecretFinding[]): void {
    this.post({ type: 'blocked', findings });
  }

  streamStart(): void {
    this.post({ type: 'streamStart' });
  }
  streamToken(text: string): void {
    this.post({ type: 'token', text });
  }
  showRendered(segments: Segment[], unverified: number): void {
    this.post({ type: 'rendered', segments, unverified });
  }
  streamDone(mock: boolean): void {
    this.post({ type: 'streamDone', mock });
  }
  streamError(message: string): void {
    this.post({ type: 'streamError', message });
  }
  showOffline(): void {
    this.post({ type: 'offline' });
  }
  setLevel(level: ExplanationLevel): void {
    this.post({ type: 'level', level });
  }

  private post(message: HostToWebview): void {
    if (this.view && this.ready) {
      void this.view.webview.postMessage(message);
    } else {
      this.queue.push(message);
      this.reveal();
    }
  }

  private flush(): void {
    while (this.queue.length && this.view) {
      const msg = this.queue.shift();
      if (msg) {
        void this.view.webview.postMessage(msg);
      }
    }
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
        <button class="seg" role="radio" data-level="beginner" aria-checked="false" tabindex="-1">Beginner</button>
        <button class="seg" role="radio" data-level="intermediate" aria-checked="true" tabindex="0">Intermediate</button>
        <button class="seg" role="radio" data-level="advanced" aria-checked="false" tabindex="-1">Advanced</button>
      </div>
    </section>

    <!-- Empty -->
    <section id="empty" class="state">
      <p class="state__title">Nothing to review yet</p>
      <p class="state__body">Select code, open a file, or make a change, then choose a review action.</p>
    </section>

    <!-- Transmission preview / consent -->
    <section id="preview" class="preview" hidden>
      <p class="preview__title">Review what will be sent</p>
      <p class="preview__note" id="previewNote"></p>
      <pre class="preview__code" id="previewText" tabindex="0"></pre>
      <div class="actions">
        <button id="consentCancel" class="btn" type="button">Cancel</button>
        <button id="consentSend" class="btn btn--primary" type="button">Send to Uncode</button>
      </div>
    </section>

    <!-- Secret block -->
    <section id="blocked" class="blocked" hidden>
      <p class="blocked__title">Blocked — possible secret detected</p>
      <p class="blocked__body">Nothing was sent. Remove the value or add the file to <code>.unvibeignore</code>, then try again.</p>
      <ul class="findinglist" id="blockedList"></ul>
    </section>

    <!-- Explanation (streaming target) -->
    <section id="explain" class="explanation" aria-label="Explanation" hidden>
      <div id="explainBody" class="explanation__body"></div>
      <p id="explainMeta" class="explanation__meta" hidden></p>
    </section>

    <section id="controls" class="actions" aria-label="Outcome" hidden>
      <button id="understand" class="btn" type="button">I understand</button>
      <button id="explainDiff" class="btn" type="button">Explain differently</button>
      <button id="testMe" class="btn btn--primary" type="button" title="Comprehension check arrives in Milestone 4">Test me</button>
    </section>

    <section id="followup" class="followup" hidden>
      <label class="visually-hidden" for="followupInput">Ask a follow-up question</label>
      <input id="followupInput" class="input" type="text" placeholder="Ask a follow-up…" />
    </section>
  </main>
  <script nonce="${nonce}" src="${uri('panel.js')}"></script>
</body>
</html>`;
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
