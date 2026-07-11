import { contextBridge, ipcRenderer } from 'electron';

/** Bridge exposed to sandboxed renderers as window.unvibe. No node, no network. */
const api = {
  // bar + companion
  reviewSelection: () => ipcRenderer.send('bar:review'),
  openCompanion: () => ipcRenderer.send('bar:openCompanion'),
  companionReview: () => ipcRenderer.send('companion:review'),
  appInfo: (): Promise<{ version: string; user: string; shortcut: string }> =>
    ipcRenderer.invoke('app:info'),

  // widget review
  widgetReady: () => ipcRenderer.send('widget:ready'),
  request: (opts: unknown) => ipcRenderer.send('widget:request', opts),
  useClipboard: (opts: unknown) => ipcRenderer.send('widget:useClipboard', opts),
  testMe: () => ipcRenderer.send('widget:testMe'),
  answer: (choice: number) => ipcRenderer.send('widget:answer', choice),
  pin: (pinned: boolean) => ipcRenderer.send('widget:pin', pinned),
  collapse: (collapsed: boolean) => ipcRenderer.send('widget:collapse', collapsed),
  closeWidget: () => ipcRenderer.send('widget:close'),
  onReviewEvent: (cb: (ev: unknown) => void) => {
    ipcRenderer.on('review:event', (_e, ev) => cb(ev));
  },

  // learning (companion)
  profile: () => ipcRenderer.invoke('learning:profile'),
  feed: (limit: number) => ipcRenderer.invoke('learning:feed', limit),

  // account
  account: () => ipcRenderer.invoke('account:get'),
  signIn: (email: string) => ipcRenderer.invoke('account:signIn', email),
  signOut: () => ipcRenderer.invoke('account:signOut'),
  deleteAccount: () => ipcRenderer.invoke('account:delete'),
};

contextBridge.exposeInMainWorld('unvibe', api);
export type UnvibeApi = typeof api;
