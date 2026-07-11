import * as vscode from 'vscode';

/**
 * Tracks whether the active editor has a non-empty selection and exposes it as the
 * `uncode.hasSelection` context key, so the "Review Selected Code" command/menu item only
 * appears when it is meaningful.
 */
export class SelectionWatcher implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  start(): void {
    const update = (editor: vscode.TextEditor | undefined): void => {
      const hasSelection = !!editor && !editor.selection.isEmpty;
      void vscode.commands.executeCommand('setContext', 'uncode.hasSelection', hasSelection);
    };

    update(vscode.window.activeTextEditor);
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection((e) => update(e.textEditor)),
      vscode.window.onDidChangeActiveTextEditor((editor) => update(editor)),
    );
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
