import { contextBridge, ipcRenderer } from 'electron';

/** Bridge exposed to sandboxed renderers as window.unvibe. No node, no network. */
const api = {
  // bar + companion
  reviewSelection: () => ipcRenderer.send('bar:review'),
  openCompanion: () => ipcRenderer.send('bar:openCompanion'),
  companionReview: () => ipcRenderer.send('companion:review'),
  appInfo: (): Promise<{ version: string; user: string; shortcut: string }> => ipcRenderer.invoke('app:info'),
  onBarNotify: (cb: (msg: string) => void) => ipcRenderer.on('bar:notify', (_e, m) => cb(m)),

  // widget review
  widgetReady: () => ipcRenderer.send('widget:ready'),
  request: (opts: unknown) => ipcRenderer.send('widget:request', opts),
  cancel: () => ipcRenderer.send('widget:cancel'),
  useClipboard: (opts: unknown) => ipcRenderer.send('widget:useClipboard', opts),
  testMe: () => ipcRenderer.send('widget:testMe'),
  answer: (choice: number) => ipcRenderer.send('widget:answer', choice),
  pin: (pinned: boolean) => ipcRenderer.send('widget:pin', pinned),
  collapse: (collapsed: boolean) => ipcRenderer.send('widget:collapse', collapsed),
  closeWidget: () => ipcRenderer.send('widget:close'),
  openStudy: () => ipcRenderer.send('widget:openStudy'),
  onReviewEvent: (cb: (ev: unknown) => void) => ipcRenderer.on('review:event', (_e, ev) => cb(ev)),
  onAutocollapse: (cb: (v: boolean) => void) => ipcRenderer.on('widget:autocollapse', (_e, v) => cb(v)),

  // learning (companion)
  profile: () => ipcRenderer.invoke('learning:profile'),
  feed: (limit: number) => ipcRenderer.invoke('learning:feed', limit),

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),

  // permissions
  accessibility: () => ipcRenderer.invoke('perms:accessibility'),
  promptAccessibility: () => ipcRenderer.invoke('perms:promptAccessibility'),
  openAccessibility: () => ipcRenderer.invoke('perms:openAccessibility'),

  // privacy
  openPrivacy: () => ipcRenderer.invoke('app:openPrivacy'),

  // onboarding
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),
  onShortcutFired: (cb: () => void) => ipcRenderer.on('shortcut:fired', () => cb()),

  // account
  account: () => ipcRenderer.invoke('account:get'),
  signIn: (email: string) => ipcRenderer.invoke('account:signIn', email),
  signUp: (email: string) => ipcRenderer.invoke('account:signUp', email),
  startDeviceAuth: () => ipcRenderer.invoke('account:startDevice'),
  onDeviceAuth: (cb: (result: { ok: boolean; email?: string; error?: string }) => void) => ipcRenderer.on('account:device', (_e, r) => cb(r)),
  signOut: () => ipcRenderer.invoke('account:signOut'),
  deleteAccount: () => ipcRenderer.invoke('account:delete'),
};

contextBridge.exposeInMainWorld('unvibe', api);
export type UnvibeApi = typeof api;
