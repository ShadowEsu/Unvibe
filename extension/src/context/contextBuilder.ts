import * as vscode from 'vscode';
import type { ReviewContext } from '../protocol';
import type { ReviewRequest } from '../panel/reviewTypes';
import { getWorkingTreeDiff, capHunks } from './gitDiff';
import { extractImports, detectLanguage } from './parse';

const MAX_CODE_CHARS = 12000;
const SURROUND_LINES = 20;

/**
 * Build the (still-local) review context for a request. This is what the secret filter scans
 * and what — after consent — is sent to the AI service. Only constructed context is included,
 * never the whole repo.
 */
export async function buildContext(req: ReviewRequest): Promise<ReviewContext> {
  const primaryFsPath = req.files[0];
  const ctx: ReviewContext = {
    language: detectLanguage(primaryFsPath),
    primaryFile: primaryFsPath ? vscode.workspace.asRelativePath(primaryFsPath) : undefined,
    projectStructure: await shallowStructure(),
    imports: [],
  };

  if (req.scope === 'diff') {
    const root = repoRootFor(primaryFsPath);
    if (root) {
      const hunks = await getWorkingTreeDiff(root, req.files);
      ctx.diffHunks = capHunks(hunks);
    }
    return ctx;
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return ctx;
  }
  const doc = editor.document;
  ctx.imports = extractImports(doc.getText());

  if (req.scope === 'selection') {
    const sel = editor.selection;
    const selected = doc.getText(sel);
    ctx.code = selected.slice(0, MAX_CODE_CHARS);
    ctx.truncated = selected.length > MAX_CODE_CHARS;
    ctx.enclosing = surroundingLines(doc, sel.start.line, sel.end.line, SURROUND_LINES);
    ctx.selection = {
      file: ctx.primaryFile ?? '',
      startLine: sel.start.line + 1,
      endLine: sel.end.line + 1,
    };
  } else {
    // file scope
    const text = doc.getText();
    ctx.code = text.slice(0, MAX_CODE_CHARS);
    ctx.truncated = text.length > MAX_CODE_CHARS;
  }

  return ctx;
}

/** Text blocks that the secret filter should scan before anything is sent. */
export function scanTargets(ctx: ReviewContext): Array<{ file: string; text: string }> {
  const blocks: Array<{ file: string; text: string }> = [];
  const label = ctx.primaryFile ?? 'context';
  if (ctx.code) {
    blocks.push({ file: label, text: ctx.code });
  }
  if (ctx.enclosing) {
    blocks.push({ file: label, text: ctx.enclosing });
  }
  if (ctx.imports.length) {
    blocks.push({ file: label, text: ctx.imports.join('\n') });
  }
  if (ctx.diffHunks) {
    for (const h of ctx.diffHunks) {
      blocks.push({ file: h.file, text: h.lines.join('\n') });
    }
  }
  return blocks;
}

function surroundingLines(
  doc: vscode.TextDocument,
  startLine: number,
  endLine: number,
  radius: number,
): string {
  const from = Math.max(0, startLine - radius);
  const to = Math.min(doc.lineCount - 1, endLine + radius);
  const range = new vscode.Range(from, 0, to, doc.lineAt(to).text.length);
  return doc.getText(range).slice(0, MAX_CODE_CHARS);
}

async function shallowStructure(): Promise<string[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return [];
  }
  try {
    const entries = await vscode.workspace.fs.readDirectory(folder.uri);
    return entries
      .filter(([name]) => !name.startsWith('.') && name !== 'node_modules')
      .slice(0, 60)
      .map(([name, type]) => (type === vscode.FileType.Directory ? `${name}/` : name))
      .sort();
  } catch {
    return [];
  }
}

function repoRootFor(fsPath: string | undefined): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  if (fsPath) {
    const match = folders.find((f) => fsPath.startsWith(f.uri.fsPath));
    if (match) {
      return match.uri.fsPath;
    }
  }
  return folders[0].uri.fsPath;
}
