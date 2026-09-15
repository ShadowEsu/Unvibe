/**
 * Local-only discovery of apps Unvibe can sit beside.
 * Detection never writes another tool's config. A row is never marked detected unless the app
 * is present on this Mac, or Unvibe already has a remembered project folder.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';
import { settings } from './settings';

const execFileAsync = promisify(execFile);
type EditorId = 'cursor' | 'vscode';

export type IntegrationState = 'detected' | 'available' | 'not-installed';
export type IntegrationGroup = 'Editors' | 'Agents' | 'Shell' | 'Workspace';

export interface IntegrationStatus {
  id: string;
  name: string;
  group: IntegrationGroup;
  detail: string;
  blurb: string;
  state: IntegrationState;
  bridgeInstalled?: boolean;
  bridgeAvailable?: boolean;
}

const EDITORS: Record<EditorId, { appName: string; extensionDir: string; cliPaths: string[] }> = {
  cursor: {
    appName: 'Cursor',
    extensionDir: path.join(homedir(), '.cursor', 'extensions'),
    cliPaths: ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
  },
  vscode: {
    appName: 'Visual Studio Code',
    extensionDir: path.join(homedir(), '.vscode', 'extensions'),
    cliPaths: ['/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code', '/usr/local/bin/code'],
  },
};

function desktopBridgePath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'Unvibe Desktop Bridge.vsix'),
    path.resolve(app.getAppPath(), '..', 'extension', 'release', 'unvibe-desktop-bridge-0.1.2.vsix'),
  ];
  return candidates.find(existsSync) ?? null;
}

function editorCli(id: EditorId): string | null {
  return EDITORS[id].cliPaths.find(existsSync) ?? null;
}

function hasDesktopBridge(id: EditorId): boolean {
  try {
    return readdirSync(EDITORS[id].extensionDir).some((name) => /^uncode\.uncode-(?:\d|v)/i.test(name));
  } catch {
    return false;
  }
}

export async function installDesktopBridge(id: EditorId): Promise<{ ok: boolean; error?: string }> {
  const editor = EDITORS[id];
  if (!hasMacApp(editor.appName)) return { ok: false, error: `${id === 'cursor' ? 'Cursor' : 'VS Code'} is not installed on this Mac.` };
  const cli = editorCli(id);
  const vsix = desktopBridgePath();
  if (!cli) return { ok: false, error: `Could not find the ${id === 'cursor' ? 'Cursor' : 'VS Code'} command-line tool.` };
  if (!vsix) return { ok: false, error: 'The Desktop Bridge package is missing. Reinstall Unvibe and try again.' };
  try {
    await execFileAsync(cli, ['--install-extension', vsix, '--force'], { timeout: 30_000, maxBuffer: 512_000 });
    return hasDesktopBridge(id)
      ? { ok: true }
      : { ok: false, error: 'The editor finished without confirming the bridge. Open Extensions and look for Unvibe.' };
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : '';
    return { ok: false, error: message || 'Could not install the Desktop Bridge.' };
  }
}

function hasMacApp(name: string): boolean {
  return [
    `/Applications/${name}.app`,
    path.join(homedir(), 'Applications', `${name}.app`),
  ].some(existsSync);
}

function hasAnyApp(...names: string[]): boolean {
  return names.some(hasMacApp);
}

function row(
  id: string,
  name: string,
  group: IntegrationGroup,
  present: boolean,
  presentDetail: string,
  missingDetail: string,
  blurb: string,
  fallback: IntegrationState = 'not-installed',
): IntegrationStatus {
  return {
    id,
    name,
    group,
    blurb,
    detail: present ? presentDetail : missingDetail,
    state: present ? 'detected' : fallback,
  };
}

export function integrationStatus(): IntegrationStatus[] {
  const isMac = process.platform === 'darwin';
  const project = settings().all().lastProjectRoot;
  const cursor = hasMacApp('Cursor');
  const vscode = hasMacApp('Visual Studio Code');
  const zed = hasMacApp('Zed');
  const windsurf = hasMacApp('Windsurf');
  const claude = hasAnyApp('Claude', 'Claude Code');
  const iterm = hasAnyApp('iTerm', 'iTerm2');
  const warp = hasMacApp('Warp');
  const github = hasMacApp('GitHub Desktop');

  const cursorRow = row(
      'cursor', 'Cursor', 'Editors', cursor,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Install Cursor if that is where you write. Unvibe never edits Cursor settings.',
      'Frontmost selection and file context.',
    );
  cursorRow.bridgeInstalled = cursor && hasDesktopBridge('cursor');
  cursorRow.bridgeAvailable = cursor && Boolean(editorCli('cursor') && desktopBridgePath());
  const vscodeRow = row(
      'vscode', 'VS Code', 'Editors', vscode,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Install VS Code if that is where you write. Unvibe never edits VS Code settings.',
      'Frontmost selection and file context.',
    );
  vscodeRow.bridgeInstalled = vscode && hasDesktopBridge('vscode');
  vscodeRow.bridgeAvailable = vscode && Boolean(editorCli('vscode') && desktopBridgePath());

  return [
    cursorRow,
    vscodeRow,
    row(
      'zed', 'Zed', 'Editors', zed,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Not installed. Unvibe can still explain a selection if Zed is the frontmost app later.',
      'Frontmost selection.',
    ),
    row(
      'windsurf', 'Windsurf', 'Editors', windsurf,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Not installed. Unvibe can still explain a selection if Windsurf is the frontmost app later.',
      'Frontmost selection.',
    ),
    row(
      'claude', 'Claude', 'Agents', claude,
      'Detected on this Mac. Unvibe stays beside it. It does not send chats into Claude.',
      'Not installed. You can still chat inside Unvibe from the Chat page.',
      'Sits beside the agent. Does not rewrite its config.',
    ),
    row(
      'terminal', 'Terminal', 'Shell', isMac,
      'Available through macOS. Copy a snippet, then explain it with the Unvibe shortcut.',
      'Terminal detection is available on macOS only.',
      'Copied snippets and selected text.',
      isMac ? 'available' : 'not-installed',
    ),
    row(
      'iterm', 'iTerm', 'Shell', iterm,
      'Detected on this Mac. Copy a snippet, then explain it with the Unvibe shortcut.',
      'Not installed. The system Terminal still works for copied snippets.',
      'Copied snippets.',
    ),
    row(
      'warp', 'Warp', 'Shell', warp,
      'Detected on this Mac. Copy a snippet, then explain it with the Unvibe shortcut.',
      'Not installed. Any terminal that can copy text still works.',
      'Copied snippets.',
    ),
    row(
      'github', 'GitHub Desktop', 'Workspace', github,
      'Detected on this Mac. Unvibe does not sync GitHub for you. Diffs still come from your local git.',
      'Not installed. Git diffs still work from any local repository Unvibe can see.',
      'Local git diffs, not GitHub.com.',
    ),
    {
      id: 'project',
      name: 'Project folder',
      group: 'Workspace',
      blurb: 'Nearby files when you ask for a broader review.',
      detail: project
        ? `Using ${path.basename(project)} when you request project-aware reviews.`
        : 'Choose a project folder when you need broader context. Unvibe never uploads the whole repo.',
      state: project ? 'detected' : 'available',
    },
  ];
}
