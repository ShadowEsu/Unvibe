import type { UnvibeApi } from '../preload/preload';

declare global {
  interface Window {
    unvibe: UnvibeApi;
  }
}
export {};
