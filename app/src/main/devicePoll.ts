/**
 * The device-code sign-in main polls for: one code at a time. The code's secret half (`deviceCode`) lives only here, so
 * once a poll is dropped (a newer start, the sign-in card closing, the app quitting) approving its code in a browser
 * signs nobody in: nothing is left to redeem it (Security NIT, 0.1.55). The server keeps the code until it expires.
 */
export const DEVICE_CODE_LIFETIME_MS = 10 * 60_000;

export const DEVICE_TIMED_OUT = 'Sign-in timed out. Use Retry to create a new secure link.';
export const DEVICE_NO_LONGER_VALID = 'This sign-in link is no longer valid. Use Retry to create a new one.';

export interface DevicePollDeps {
  redeem: (deviceCode: string) => Promise<{ token: string } | null>;
  /**
   * The code was approved and redeemed. `stillCurrent` turns false if the poll is dropped meanwhile (the card closed
   * while the account was being read), and then nobody may be signed in. Resolves whether the person was signed in.
   */
  approved: (token: string, stillCurrent: () => boolean) => Promise<boolean>;
  /** A token redeemed for a code that was dropped meanwhile: nobody holds it, so its session is ended on the server. */
  abandoned: (token: string) => void;
  /** The code can't be approved any more (timed out, expired, already used); the card says so. */
  ended: (message: string) => void;
  now?: () => number;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  interval: number;
}

/** The page that started the sign-in (main passes its webContents). */
export interface DevicePollOwner {
  once(event: OwnerGoneEvent, listener: () => void): unknown;
  removeListener(event: OwnerGoneEvent, listener: () => void): unknown;
}

/**
 * The page that showed the code is gone, so no card shows it any more: its window closed (Mac close, ⌘W), the page
 * reloaded, or its renderer crashed. None of these runs the card's own cleanup.
 */
export const OWNER_GONE_EVENTS = ['destroyed', 'did-start-loading', 'render-process-gone'] as const;
type OwnerGoneEvent = typeof OWNER_GONE_EVENTS[number];

export interface DevicePoll {
  /** Poll for this code; it is dropped when `owner` goes away (lead M1 / Security SHOULD-1 on #354). */
  start(device: DeviceCode, verificationUrl: string, owner: DevicePollOwner): void;
  /** Drop the code being polled for. With a `userCode`, only if that is still the code: a card never drops a newer one. */
  cancel(userCode?: string): boolean;
  /** The browser link of the code being polled for, or null. */
  verificationUrl(): string | null;
  /** The page that started the code being polled for, or null. */
  owner(): DevicePollOwner | null;
}

export function createDevicePoll(deps: DevicePollDeps): DevicePoll {
  const now = deps.now ?? Date.now;
  let timer: ReturnType<typeof setInterval> | null = null;
  let current: { userCode: string; verificationUrl: string; owner: DevicePollOwner; ownerGone: () => void } | null = null;
  let generation = 0;
  const stop = () => {
    clearInterval(timer ?? undefined);
    timer = null;
    if (current) for (const event of OWNER_GONE_EVENTS) current.owner.removeListener(event, current.ownerGone);
    current = null;
    generation += 1;
  };
  return {
    start(device, verificationUrl, owner) {
      stop();
      const mine = generation;
      const live = () => generation === mine;
      const ownerGone = () => { if (live()) stop(); };
      for (const event of OWNER_GONE_EVENTS) owner.once(event, ownerGone);
      current = { userCode: device.userCode, verificationUrl, owner, ownerGone };
      const expires = now() + DEVICE_CODE_LIFETIME_MS;
      // One redeem at a time: a slow answer must not overlap the next tick and come back "already redeemed".
      let asking = false;
      timer = setInterval(() => void (async () => {
        if (!live() || asking) return;
        if (now() > expires) {
          stop();
          deps.ended(DEVICE_TIMED_OUT);
          return;
        }
        asking = true;
        try {
          const redeemed = await deps.redeem(device.deviceCode);
          if (!redeemed) return;
          if (!live() || !(await deps.approved(redeemed.token, live))) {
            deps.abandoned(redeemed.token);
            return;
          }
          if (live()) stop();
        } catch (err) {
          if (!live()) return;
          const message = err instanceof Error ? err.message : '';
          if (/expired|unknown|already redeemed/i.test(message)) {
            stop();
            deps.ended(DEVICE_NO_LONGER_VALID);
          }
        } finally {
          asking = false;
        }
      })(), Math.max(2, device.interval) * 1000);
    },
    cancel(userCode) {
      if (!current || (userCode !== undefined && current.userCode !== userCode)) return false;
      stop();
      return true;
    },
    verificationUrl() {
      return current?.verificationUrl ?? null;
    },
    owner() {
      return current?.owner ?? null;
    },
  };
}
