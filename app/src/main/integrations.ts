/**
 * Local-only discovery of apps Unvibe can sit beside.
 * Detection never writes another tool's config. A row is never marked detected unless the app
 * is present on this Mac, or Unvibe already has a remembered project folder.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { settings } from './settings';

export type IntegrationState = 'detected' | 'available' | 'not-installed';
export type IntegrationGroup = 'Editors' | 'Agents' | 'Shell' | 'Workspace';

export interface IntegrationStatus {
  id: string;
  name: string;
  group: IntegrationGroup;
  detail: string;
  blurb: string;
  state: IntegrationState;
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

  return [
    row(
      'cursor', 'Cursor', 'Editors', cursor,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Install Cursor if that is where you write. Unvibe never edits Cursor settings.',
      'Frontmost selection and file context.',
    ),
    row(
      'vscode', 'VS Code', 'Editors', vscode,
      'Detected on this Mac. Select code there and Unvibe can explain it.',
      'Install VS Code if that is where you write. Unvibe never edits VS Code settings.',
      'Frontmost selection and file context.',
    ),
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
