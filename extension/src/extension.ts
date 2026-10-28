import * as vscode from 'vscode';
import { isExcludedPath } from './config/exclusions';

/**
 * The Desktop Bridge does one thing: hand the editor's selection to the Unvibe desktop app.
 * The app explains it, so this extension makes no network calls and keeps no state.
 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('uncode.reviewSelectionInDesktop', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        void vscode.window.showInformationMessage('Unvibe: select some code first, then press ⌘U.');
        return;
      }
      const path = editor.document.uri.fsPath;
      if (isExcludedPath(path)) {
        void vscode.window.showWarningMessage('Unvibe: this file is excluded from review by your privacy defaults.');
        return;
      }

      const selectedCode = editor.document.getText(editor.selection);
      // Keep the selected text on this machine. The URL carries only an intent flag; the desktop
      // app immediately reads this fresh local clipboard value and runs its secret filter before
      // any remote request. This avoids the focus race caused when macOS foregrounds Unvibe.
      await vscode.env.clipboard.writeText(selectedCode);
      const opened = await vscode.env.openExternal(vscode.Uri.parse('unvibe://review?source=ide'));
      if (!opened) {
        void vscode.window.showErrorMessage('Unvibe could not open the desktop app. Install or open Unvibe, then try ⌘U again.');
      }
    }),
  );
}

export function deactivate(): void {
  // Disposables registered in context.subscriptions are cleaned up by VS Code.
}
