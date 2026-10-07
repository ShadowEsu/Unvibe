/**
 * Local-only discovery of apps Unvibe can sit beside.
 * Detection never writes another tool's config. A row is never marked detected unless the app
 * is present on this computer (macOS or Windows), or Unvibe already has a remembered project folder.
 */
import { execFile, spawnSync } from 'node:child_process';
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

const IS_WIN = process.platform === 'win32';
const LOCAL = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
const PROGRAMS = path.join(LOCAL, 'Programs');
const PROGRAM_FILES = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((p): p is string => Boolean(p));

/** Where each app lives on Windows. macOS apps are found in /Applications by name. */
const WINDOWS_APPS: Record<string, string[]> = {
  Cursor: [path.join(PROGRAMS, 'cursor', 'Cursor.exe')],
  'Visual Studio Code': [
    path.join(PROGRAMS, 'Microsoft VS Code', 'Code.exe'),
    ...PROGRAM_FILES.map((dir) => path.join(dir, 'Microsoft VS Code', 'Code.exe')),
  ],
  Zed: [path.join(PROGRAMS, 'Zed', 'Zed.exe')],
  Windsurf: [path.join(PROGRAMS, 'Windsurf', 'Windsurf.exe')],
  Claude: [path.join(LOCAL, 'AnthropicClaude', 'claude.exe'), path.join(PROGRAMS, 'Claude', 'Claude.exe')],
  Warp: [path.join(PROGRAMS, 'Warp', 'warp.exe'), ...PROGRAM_FILES.map((dir) => path.join(dir, 'Warp', 'warp.exe'))],
  'GitHub Desktop': [path.join(LOCAL, 'GitHubDesktop', 'GitHubDesktop.exe')],
};

const EDITORS: Record<EditorId, { appName: string; extensionDir: string; cliPaths: string[] }> = {
  cursor: {
    appName: 'Cursor',
    extensionDir: path.join(homedir(), '.cursor', 'extensions'),
    cliPaths: IS_WIN
      ? [path.join(PROGRAMS, 'cursor', 'resources', 'app', 'bin', 'cursor.cmd')]
      : ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor'],
  },
  vscode: {
    appName: 'Visual Studio Code',
    extensionDir: path.join(homedir(), '.vscode', 'extensions'),
    cliPaths: IS_WIN
      ? [
          path.join(PROGRAMS, 'Microsoft VS Code', 'bin', 'code.cmd'),
          ...PROGRAM_FILES.map((dir) => path.join(dir, 'Microsoft VS Code', 'bin', 'code.cmd')),
        ]
      : ['/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code', '/usr/local/bin/code'],
  },
};

const PLACE = process.platform === 'darwin' ? 'this Mac' : 'this computer';

function desktopBridgePath(): string | null {
  const candidates = [
    path.join(process.resourcesPath, 'Unvibe Desktop Bridge.vsix'),
    path.resolve(app.getAppPath(), '..', 'extension', 'release', 'unvibe-desktop-bridge-0.1.2.vsix'),
  ];
  return candidates.find(existsSync) ?? null;
}

function editorCli(id: EditorId): string | null {
  const fixed = EDITORS[id].cliPaths.find(existsSync);
  if (fixed) return fixed;
  // The editor may live outside /Applications (Downloads, an external drive); use its real path.
  const bundle = macAppPath(EDITORS[id].appName);
  if (!bundle) return null;
  const cli = path.join(bundle, 'Contents', 'Resources', 'app', 'bin', id === 'cursor' ? 'cursor' : 'code');
  return existsSync(cli) ? cli : null;
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
  if (!hasMacApp(editor.appName)) return { ok: false, error: `${id === 'cursor' ? 'Cursor' : 'VS Code'} is not installed on ${PLACE}.` };
  const cli = editorCli(id);
  const vsix = desktopBridgePath();
  if (!cli) return { ok: false, error: `Could not find the ${id === 'cursor' ? 'Cursor' : 'VS Code'} command-line tool.` };
  if (!vsix) return { ok: false, error: 'The Desktop Bridge package is missing. Reinstall Unvibe and try again.' };
  try {
    if (IS_WIN) {
      // Editor CLIs on Windows are .cmd scripts, which must run through cmd.exe with quoted paths.
      await execFileAsync('cmd.exe', ['/d', '/s', '/c', `""${cli}" --install-extension "${vsix}" --force"`], {
        timeout: 30_000, maxBuffer: 512_000, windowsHide: true, windowsVerbatimArguments: true,
      });
    } else {
      await execFileAsync(cli, ['--install-extension', vsix, '--force'], { timeout: 30_000, maxBuffer: 512_000 });
    }
    return hasDesktopBridge(id)
      ? { ok: true }
      : { ok: false, error: 'The editor finished without confirming the bridge. Open Extensions and look for Unvibe.' };
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : '';
    return { ok: false, error: message || 'Could not install the Desktop Bridge.' };
  }
}

/** Bundle ids, so Spotlight can find an app wherever it lives (Downloads, external drives). */
const MAC_BUNDLE_IDS: Record<string, string> = {
  Cursor: 'com.todesktop.230313mzl4w4u92',
  'Visual Studio Code': 'com.microsoft.VSCode',
  Zed: 'dev.zed.Zed',
  Windsurf: 'com.exafunction.windsurf',
  Claude: 'com.anthropic.claudefordesktop',
  iTerm: 'com.googlecode.iterm2',
  iTerm2: 'com.googlecode.iterm2',
  Warp: 'dev.warp.Warp-Stable',
  'GitHub Desktop': 'com.github.GitHubClient',
};
const appPathCache = new Map<string, { at: number; path: string | null }>();

/** Where a Mac app is installed, or null. Checks the usual folders, then asks Spotlight. */
function macAppPath(name: string): string | null {
  const usual = [`/Applications/${name}.app`, path.join(homedir(), 'Applications', `${name}.app`)].find(existsSync);
  if (usual) return usual;
  const id = MAC_BUNDLE_IDS[name];
  if (!id || process.platform !== 'darwin') return null;
  const cached = appPathCache.get(name);
  if (cached && Date.now() - cached.at < 60_000) return cached.path;
  let found: string | null = null;
  try {
    const out = spawnSync('mdfind', [`kMDItemCFBundleIdentifier == '${id}'`], { timeout: 2500, encoding: 'utf8' });
    found = (out.stdout ?? '').split('\n').map((line) => line.trim()).find((line) => line.endsWith('.app') && !line.startsWith('/Volumes/') && existsSync(line)) ?? null;
  } catch {
    found = null;
  }
  appPathCache.set(name, { at: Date.now(), path: found });
  return found;
}

/** True when the app is installed: anywhere Spotlight knows on macOS, the usual install folders on Windows. */
function hasMacApp(name: string): boolean {
  if (IS_WIN) return (WINDOWS_APPS[name] ?? []).some(existsSync);
  return macAppPath(name) !== null;
}

let gitCache: boolean | null = null;
function hasGit(): boolean {
  if (gitCache !== null) return gitCache;
  try {
    gitCache = spawnSync('git', ['--version'], { timeout: 2000, windowsHide: true }).status === 0;
  } catch {
    gitCache = false;
  }
  return gitCache;
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
  const hasTerminal = isMac || IS_WIN;
  const project = settings().all().lastProjectRoot;
  const cursor = hasMacApp('Cursor');
  const vscode = hasMacApp('Visual Studio Code');
  const zed = hasMacApp('Zed');
  const windsurf = hasMacApp('Windsurf');
  const claude = hasAnyApp('Claude', 'Claude Code');
  const iterm = hasAnyApp('iTerm', 'iTerm2');
  const warp = hasMacApp('Warp');
  const githubDesktop = hasMacApp('GitHub Desktop');
  const git = hasGit();
  const github = githubDesktop || git;

  const cursorRow = row(
      'cursor', 'Cursor', 'Editors', cursor,
      `Detected on ${PLACE}. Select code there and Unvibe can explain it.`,
      'Install Cursor if that is where you write. Unvibe never edits Cursor settings.',
      'Frontmost selection and file context.',
    );
  cursorRow.bridgeInstalled = cursor && hasDesktopBridge('cursor');
  cursorRow.bridgeAvailable = cursor && Boolean(editorCli('cursor') && desktopBridgePath());
  const vscodeRow = row(
      'vscode', 'VS Code', 'Editors', vscode,
      `Detected on ${PLACE}. Select code there and Unvibe can explain it.`,
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
      `Detected on ${PLACE}. Select code there and Unvibe can explain it.`,
      'Not installed. Unvibe can still explain a selection if Zed is the frontmost app later.',
      'Frontmost selection.',
    ),
    row(
      'windsurf', 'Windsurf', 'Editors', windsurf,
      `Detected on ${PLACE}. Select code there and Unvibe can explain it.`,
      'Not installed. Unvibe can still explain a selection if Windsurf is the frontmost app later.',
      'Frontmost selection.',
    ),
    row(
      'claude', 'Claude', 'Agents', claude,
      `Detected on ${PLACE}. Unvibe stays beside it. It does not send chats into Claude.`,
      'Not installed. You can still chat inside Unvibe from the Chat page.',
      'Sits beside the agent. Does not rewrite its config.',
    ),
    row(
      'terminal', IS_WIN ? 'Windows Terminal' : 'Terminal', 'Shell', hasTerminal,
      IS_WIN
        ? 'Available on Windows. Select or copy a snippet in PowerShell or Windows Terminal, then press the Unvibe shortcut.'
        : 'Available through macOS. Copy a snippet, then explain it with the Unvibe shortcut.',
      'Copy a snippet from any terminal, then explain it with the Unvibe shortcut.',
      'Copied snippets and selected text.',
      hasTerminal ? 'available' : 'not-installed',
    ),
    row(
      'iterm', 'iTerm', 'Shell', iterm,
      `Detected on ${PLACE}. Copy a snippet, then explain it with the Unvibe shortcut.`,
      'Not installed. The system Terminal still works for copied snippets.',
      'Copied snippets.',
    ),
    row(
      'warp', 'Warp', 'Shell', warp,
      `Detected on ${PLACE}. Copy a snippet, then explain it with the Unvibe shortcut.`,
      'Not installed. Any terminal that can copy text still works.',
      'Copied snippets.',
    ),
    row(
      'github', 'GitHub and git', 'Workspace', github,
      git
        ? `git is ready on ${PLACE}${githubDesktop ? ', with GitHub Desktop' : ''}. Change Briefs and diff reviews read your local repositories.`
        : `GitHub Desktop is on ${PLACE}. Install git (or open a repo once in GitHub Desktop) so Change Briefs can read diffs.`,
      'Install git or GitHub Desktop so Change Briefs and diff reviews can read your local repositories.',
      'Local git diffs. Your code is never uploaded to GitHub by Unvibe.',
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
