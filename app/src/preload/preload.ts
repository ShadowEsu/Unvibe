import { contextBridge, ipcRenderer } from 'electron';

/** Bridge exposed to sandboxed renderers as window.unvibe. No node, no network. */
const api = {
  // bar + companion
  reviewSelection: () => ipcRenderer.send('bar:review'),
  openCompanion: () => ipcRenderer.send('bar:openCompanion'),
  companionReview: () => ipcRenderer.send('companion:review'),
  appInfo: (): Promise<{ version: string; user: string; shortcut: string }> => ipcRenderer.invoke('app:info'),
  onBarNotify: (cb: (msg: string) => void) => ipcRenderer.on('bar:notify', (_e, m) => cb(m)),

  // widget review (single panel + tabs)
  widgetReady: () => ipcRenderer.send('widget:ready'),
  setActiveTab: (tabId: string) => ipcRenderer.send('widget:setActiveTab', tabId),
  addTab: (tabId: string) => ipcRenderer.send('widget:addTab', tabId),
  closeTab: (tabId: string) => ipcRenderer.send('widget:closeTab', tabId),
  request: (opts: unknown) => ipcRenderer.send('widget:request', opts),
  cancel: () => ipcRenderer.send('widget:cancel'),
  useClipboard: (opts: unknown) => ipcRenderer.send('widget:useClipboard', opts),
  pickFile: (opts?: unknown): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> =>
    ipcRenderer.invoke('widget:pickFile', opts),
  usePaste: (opts: unknown) => ipcRenderer.send('widget:usePaste', opts),
  explainDiff: (opts?: unknown) => ipcRenderer.invoke('review:explainDiff', opts),
  explainCompare: (opts?: unknown) => ipcRenderer.invoke('review:explainCompare', opts),
  pickProjectRoot: () => ipcRenderer.invoke('project:pickRoot'),
  reviewQueue: (limit: number) => ipcRenderer.invoke('learning:queue', limit),
  reopenLearningItem: (item: unknown) => ipcRenderer.invoke('review:reopenItem', item),
  testMe: () => ipcRenderer.send('widget:testMe'),
  answer: (choice: number) => ipcRenderer.send('widget:answer', choice),
  gotIt: () => ipcRenderer.send('widget:gotIt'),
  pin: (pinned: boolean) => ipcRenderer.send('widget:pin', pinned),
  collapse: (collapsed: boolean) => ipcRenderer.send('widget:collapse', collapsed),
  closeWidget: () => ipcRenderer.send('widget:close'),
  openStudy: () => ipcRenderer.send('widget:openStudy'),
  onReviewEvent: (cb: (ev: unknown) => void) => ipcRenderer.on('review:event', (_e, ev) => cb(ev)),
  onAutocollapse: (cb: (v: boolean) => void) => ipcRenderer.on('widget:autocollapse', (_e, v) => cb(v)),

  // learning (companion)
  profile: () => ipcRenderer.invoke('learning:profile'),
  feed: (limit: number) => ipcRenderer.invoke('learning:feed', limit),
  history: (limit: number) => ipcRenderer.invoke('learning:history', limit),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  retrySync: () => ipcRenderer.invoke('sync:retry'),
  onSyncStatus: (cb: (status: unknown) => void) => ipcRenderer.on('sync:status', (_e, status) => cb(status)),

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

  // plans + usage (network stays in the main process)
  billingOverview: () => ipcRenderer.invoke('billing:overview'),
  usageGet: () => ipcRenderer.invoke('usage:get'),
  aiKeyStatus: () => ipcRenderer.invoke('ai:keyStatus'),
  aiSetKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
  aiClearKey: () => ipcRenderer.invoke('ai:clearKey'),
  aiCostOverview: (provider?: 'gemini' | 'anthropic') => ipcRenderer.invoke('ai:costOverview', provider),
  startBillingCheckout: (input: unknown) => ipcRenderer.invoke('billing:checkout', input),
  openBillingPortal: (workspaceId: string) => ipcRenderer.invoke('billing:portal', workspaceId),
};

contextBridge.exposeInMainWorld('unvibe', api);
export type UnvibeApi = typeof api;
