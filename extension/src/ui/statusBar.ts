import * as vscode from 'vscode';

/**
 * Non-disruptive status-bar presence. This is Uncode's primary "quiet prompt" surface in v1:
 * it never steals focus and only changes text when there is something to review.
 */
export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'uncode.openPanel';
    this.setIdle();
    this.item.show();
  }

  setIdle(): void {
    this.item.text = '$(book) Uncode';
    this.item.tooltip = 'Uncode — no changes to review';
  }

  setChanges(fileCount: number): void {
    const noun = fileCount === 1 ? 'change' : 'changes';
    this.item.text = `$(eye) Review ${fileCount} ${noun}`;
    this.item.tooltip = 'Uncode detected recent changes — click to review';
  }

  dispose(): void {
    this.item.dispose();
  }
}
