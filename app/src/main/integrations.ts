/**
 * Local-only integration discovery for the companion setup screen.
 * It checks installed applications and Unvibe's own remembered project folder; it never edits
 * another tool's configuration and it never reports an integration as active unless detected.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { settings } from './settings';

export type IntegrationState = 'detected' | 'available' | 'not-installed';

export interface IntegrationStatus {
  id: 'cursor' | 'vscode' | 'terminal' | 'project';
  name: string;
  detail: string;
  state: IntegrationState;
}

function hasMacApp(name: string): boolean {
  return [
    `/Applications/${name}.app`,
    path.join(homedir(), 'Applications', `${name}.app`),
  ].some(existsSync);
}

export function integrationStatus(): IntegrationStatus[] {
  const isMac = process.platform === 'darwin';
  const project = settings().all().lastProjectRoot;
  const cursor = hasMacApp('Cursor');
  const vscode = hasMacApp('Visual Studio Code');
  return [
    { id: 'cursor', name: 'Cursor', detail: cursor ? 'Detected on this Mac.' : 'Install Cursor to use it alongside Unvibe.', state: cursor ? 'detected' : 'not-installed' },
    { id: 'vscode', name: 'VS Code', detail: vscode ? 'Detected on this Mac.' : 'Install VS Code to use it alongside Unvibe.', state: vscode ? 'detected' : 'not-installed' },
    { id: 'terminal', name: 'Terminal', detail: isMac ? 'Available through macOS.' : 'Terminal detection is available on macOS only.', state: isMac ? 'available' : 'not-installed' },
    { id: 'project', name: 'Project context', detail: project ? `Using ${path.basename(project)} when you request project-aware reviews.` : 'Choose a project folder when you need broader context.', state: project ? 'detected' : 'available' },
  ];
}
