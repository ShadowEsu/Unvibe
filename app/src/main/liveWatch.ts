import { settings } from './settings';
import { notify } from './notify';
import { collectDiffHunks, porcelainStatus } from '../core/gitDiff';
import { architectureImpact, hunkStats } from '../core/changeBrief';

const POLL_MS = 12_000;
const SETTLE_MS = 28_000;
const LIVE_GAP_MS = 90_000;

let timer: NodeJS.Timeout | null = null;
let lastSignature = '';
let pendingSignature = '';
let pendingAt = 0;
let lastNotifyAt = 0;

function snoozed(now: number): boolean {
  const until = settings().all().liveSnoozeUntil;
  if (!until) return false;
  const stamp = Date.parse(until);
  return Number.isFinite(stamp) && stamp > now;
}

export async function tickLiveWatch(): Promise<void> {
  const all = settings().all();
  if (!all.features.live || !all.notifications) return;
  if (settings().inQuietHours()) return;
  const now = Date.now();
  if (snoozed(now)) return;
  const root = all.lastProjectRoot;
  if (!root) return;

  let status = '';
  try {
    status = await porcelainStatus(root);
  } catch {
    return;
  }
  const signature = status.trim();
  if (!signature || signature === lastSignature) {
    pendingSignature = '';
    return;
  }
  if (signature !== pendingSignature) {
    pendingSignature = signature;
    pendingAt = now;
    return;
  }
  if (now - pendingAt < SETTLE_MS) return;
  if (now - lastNotifyAt < LIVE_GAP_MS) return;

  const hunks = await collectDiffHunks(root, 'working');
  const stats = hunkStats(hunks);
  if (stats.files.length === 0) {
    lastSignature = signature;
    pendingSignature = '';
    return;
  }
  const impact = architectureImpact(stats.files);
  const name = root.split('/').filter(Boolean).pop() ?? 'this repo';
  const message = impact === 'HIGH'
    ? `${stats.files.length} files changed in ${name}. Architecture may be affected.`
    : `${stats.files.length} files changed in ${name}.`;
  notify(message);
  lastSignature = signature;
  pendingSignature = '';
  lastNotifyAt = now;
}

export function startLiveWatch(): void {
  if (timer) return;
  timer = setInterval(() => {
    void tickLiveWatch();
  }, POLL_MS);
  timer.unref?.();
}

export function stopLiveWatch(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
