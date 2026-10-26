import { contextBridge, ipcRenderer } from 'electron';

/** Bridge exposed to sandboxed renderers as window.unvibe. No node, no network. */
const api = {
  // bar + companion
  reviewSelection: () => ipcRenderer.send('bar:review'),
  openCompanion: () => ipcRenderer.send('bar:openCompanion'),
  openSettings: () => ipcRenderer.send('bar:openSettings'),
  companionReview: () => ipcRenderer.send('companion:review'),
  appInfo: (): Promise<{ version: string; user: string; shortcut: string; sendsSetupProgress: boolean }> => ipcRenderer.invoke('app:info'),
  onBarNotify: (cb: (msg: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string) => cb(message);
    ipcRenderer.on('bar:notify', listener);
    return () => ipcRenderer.removeListener('bar:notify', listener);
  },
  onBarPulse: (cb: (pulse: { phase: string; label: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, pulse: { phase: string; label: string }) => cb(pulse);
    ipcRenderer.on('bar:pulse', listener);
    return () => ipcRenderer.removeListener('bar:pulse', listener);
  },
  onBarCollapse: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('bar:collapse', listener);
    return () => ipcRenderer.removeListener('bar:collapse', listener);
  },
  onBarSettings: (cb: (settings: { barPosition?: string; barSize?: 'small' | 'medium' | 'large'; barHoverPreview?: boolean; barHoverDelayMs?: number; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, settings: { barPosition?: string; barSize?: 'small' | 'medium' | 'large'; barHoverPreview?: boolean; barHoverDelayMs?: number; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' }) => cb(settings);
    ipcRenderer.on('bar:settings', listener);
    return () => ipcRenderer.removeListener('bar:settings', listener);
  },
  setBarExpanded: (expanded: boolean) => ipcRenderer.send('bar:setExpanded', expanded),
  barContextMenu: (state: { hasRecent: boolean }) => ipcRenderer.send('bar:contextMenu', state),
  barSnapshot: () => ipcRenderer.invoke('bar:snapshot'),

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
  buildChangeBrief: (opts?: unknown) => ipcRenderer.invoke('brief:build', opts),
  lookupOrigin: () => ipcRenderer.invoke('origin:lookup'),
  listKnowledge: () => ipcRenderer.invoke('knowledge:list'),
  verifyKnowledge: (input: unknown) => ipcRenderer.invoke('knowledge:verify', input),
  refreshKnowledge: (id: string) => ipcRenderer.invoke('knowledge:refresh', id),
  gradeTeachBack: (input: unknown) => ipcRenderer.invoke('teachback:grade', input),
  snoozeLive: (hours: number) => ipcRenderer.invoke('live:snooze', hours),
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
  openPlan: () => ipcRenderer.send('companion:openPlan'),
  openUrl: (url: string) => ipcRenderer.invoke('app:openUrl', url),
  sendFeedback: (input: { rating: number; message: string; email?: string }) => ipcRenderer.invoke('feedback:send', input),
  onShowPage: (cb: (page: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, page: string) => cb(page);
    ipcRenderer.on('companion:showPage', listener);
    return () => ipcRenderer.removeListener('companion:showPage', listener);
  },
  widgetResizeStart: (edge: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') =>
    ipcRenderer.send('widget:resizeStart', edge),
  widgetResizeEnd: () => ipcRenderer.send('widget:resizeEnd'),
  onReviewEvent: (cb: (ev: unknown) => void) => ipcRenderer.on('review:event', (_e, ev) => cb(ev)),
  onAutocollapse: (cb: (v: boolean) => void) => ipcRenderer.on('widget:autocollapse', (_e, v) => cb(v)),

  // learning (companion)
  profile: () => ipcRenderer.invoke('learning:profile'),
  feed: (limit: number) => ipcRenderer.invoke('learning:feed', limit),
  history: (limit: number) => ipcRenderer.invoke('learning:history', limit),
  learningItem: (id: string) => ipcRenderer.invoke('learning:item', id),
  setLearningNote: (input: { id: string; note: string }) => ipcRenderer.invoke('learning:setNote', input),
  forgetLearning: (id: string) => ipcRenderer.invoke('learning:forget', id),
  studyAskStatus: () => ipcRenderer.invoke('study:askStatus'),
  studyAsk: (input: { eventId: string; question: string; messages?: Array<{ role: 'user' | 'assistant'; content: string }> }) => ipcRenderer.invoke('study:ask', input),
  quizStatus: () => ipcRenderer.invoke('quiz:status'),
  quizStart: (input: { eventId: string; mode?: 'quick-check' | 'recall' | 'scenario' }) => ipcRenderer.invoke('quiz:start', input),
  quizAnswer: (input: { eventId: string; choice: number }) => ipcRenderer.invoke('quiz:answer', input),
  chatAsk: (input: { messages?: Array<{ role: 'user' | 'assistant'; content: string }>; question: string; wipeGeneration?: number }) =>
    ipcRenderer.invoke('chat:ask', input),
  chatThreads: () => ipcRenderer.invoke('chat:threads'),
  saveChatThread: (thread: {
    id: string;
    title: string;
    startedAt: string;
    updatedAt: string;
    turns: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
  }, wipeGeneration: number) => ipcRenderer.invoke('chat:saveThread', thread, wipeGeneration),
  deleteChatThread: (id: string) => ipcRenderer.invoke('chat:deleteThread', id),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  retrySync: () => ipcRenderer.invoke('sync:retry'),
  onSyncStatus: (cb: (status: unknown) => void) => ipcRenderer.on('sync:status', (_e, status) => cb(status)),
  /** A saved lesson, outcome, note, sync merge or removal changed what the companion lists. */
  onLearningChanged: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('learning:changed', listener);
    return () => { ipcRenderer.removeListener('learning:changed', listener); };
  },

  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  integrations: () => ipcRenderer.invoke('integrations:status'),
  installDesktopBridge: (editor: 'cursor' | 'vscode') => ipcRenderer.invoke('integrations:installBridge', editor),

  // permissions
  accessibility: () => ipcRenderer.invoke('perms:accessibility'),
  promptAccessibility: () => ipcRenderer.invoke('perms:promptAccessibility'),
  openAccessibility: () => ipcRenderer.invoke('perms:openAccessibility'),
  openDictation: () => ipcRenderer.invoke('perms:openDictation'),
  resetAccessibility: () => ipcRenderer.invoke('perms:resetAccessibility'),
  restartApp: () => ipcRenderer.invoke('app:restart'),
  /** After the Accessibility grant: explain the selection the shortcut could not read. */
  explainAfterGrant: (): Promise<{ explained: boolean }> => ipcRenderer.invoke('perms:explainAfterGrant'),

  // privacy
  openPrivacy: () => ipcRenderer.invoke('app:openPrivacy'),
  reportFeedback: (context: { screen: string; version: string }) => ipcRenderer.invoke('app:reportFeedback', context),

  // onboarding
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),
  /** First run: explain a built-in sample for real, so the first explanation needs no permission. */
  explainSample: () => ipcRenderer.send('onboarding:explainSample'),
  /** First run step 3: explain what is on the clipboard (no Accessibility needed). */
  explainClipboard: () => ipcRenderer.send('onboarding:explainClipboard'),
  answerLevel: (answer: 'too_basic' | 'about_right' | 'too_advanced'): Promise<{ ok: true; level: string } | { ok: false }> => ipcRenderer.invoke('onboarding:levelAnswer', answer),
  /** The first-run sample answer finished; returns an unsubscribe. */
  onSampleDone: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on('onboarding:sampleDone', listener);
    return () => { ipcRenderer.removeListener('onboarding:sampleDone', listener); };
  },
  onShortcutFired: (cb: () => void) => ipcRenderer.on('shortcut:fired', () => cb()),

  // account
  account: () => ipcRenderer.invoke('account:get'),
  signIn: (email: string) => ipcRenderer.invoke('account:signIn', email),
  signUp: (email: string) => ipcRenderer.invoke('account:signUp', email),
  startDeviceAuth: () => ipcRenderer.invoke('account:startDevice'),
  openDeviceAuth: () => ipcRenderer.invoke('account:openDeviceAuth'),
  onDeviceAuth: (cb: (result: { ok: boolean; email?: string; name?: string; error?: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, r: { ok: boolean; email?: string; name?: string; error?: string }) => cb(r);
    ipcRenderer.on('account:device', listener);
    return () => { ipcRenderer.removeListener('account:device', listener); };
  },
  signOut: () => ipcRenderer.invoke('account:signOut'),
  deleteAccount: () => ipcRenderer.invoke('account:delete'),

  // plans + usage (network stays in the main process)
  billingOverview: () => ipcRenderer.invoke('billing:overview'),
  /** Public: whether Pro checkout is open right now. */
  billingStatus: (): Promise<{ paymentsOpen: boolean }> => ipcRenderer.invoke('billing:status'),
  usageGet: () => ipcRenderer.invoke('usage:get'),
  giftStatus: () => ipcRenderer.invoke('gift:status'),
  giftClaim: (codeOrLink: string) => ipcRenderer.invoke('gift:claim', codeOrLink) as Promise<{ ok: boolean; monthAdded?: boolean; error?: string }>,
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateAvailable: (cb: (info: { latest?: string; current: string }) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: { latest?: string; current: string }) => cb(info);
    ipcRenderer.on('update:available', listener);
    return () => { ipcRenderer.removeListener('update:available', listener); };
  },
  onUpdateProgress: (cb: (pct: number) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, pct: number) => cb(pct);
    ipcRenderer.on('update:progress', listener);
    return () => { ipcRenderer.removeListener('update:progress', listener); };
  },
  aiKeyStatus: () => ipcRenderer.invoke('ai:keyStatus'),
  aiSetKey: (key: string) => ipcRenderer.invoke('ai:setKey', key),
  aiClearKey: () => ipcRenderer.invoke('ai:clearKey'),
  aiModels: () => ipcRenderer.invoke('ai:models'),
  aiCostOverview: (model?: string) => ipcRenderer.invoke('ai:costOverview', model),
  startBillingCheckout: (input: unknown) => ipcRenderer.invoke('billing:checkout', input),
  openBillingPortal: (workspaceId: string) => ipcRenderer.invoke('billing:portal', workspaceId),
};

contextBridge.exposeInMainWorld('unvibe', api);
export type UnvibeApi = typeof api;
