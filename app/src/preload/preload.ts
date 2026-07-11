import { contextBridge, ipcRenderer } from 'electron';

/** Bridge exposed to sandboxed renderers as window.unvibe. No node, no network. */
const api = {
  // bar + companion
  reviewSelection: () => ipcRenderer.send('bar:review'),
  openCompanion: () => ipcRenderer.send('bar:openCompanion'),
  companionReview: () => ipcRenderer.send('companion:review'),
  appInfo: (): Promise<{ version: string; user: string; shortcut: string }> =>
    ipcRenderer.invoke('app:info'),

  // widget
  widgetReady: () => ipcRenderer.send('widget:ready'),
  request: (opts: unknown) => ipcRenderer.send('widget:request', opts),
  useClipboard: (opts: unknown) => ipcRenderer.send('widget:useClipboard', opts),
  pin: (pinned: boolean) => ipcRenderer.send('widget:pin', pinned),
  collapse: (collapsed: boolean) => ipcRenderer.send('widget:collapse', collapsed),
  closeWidget: () => ipcRenderer.send('widget:close'),
  onReviewEvent: (cb: (ev: unknown) => void) => {
    ipcRenderer.on('review:event', (_e, ev) => cb(ev));
  },
};

contextBridge.exposeInMainWorld('unvibe', api);
export type UnvibeApi = typeof api;
