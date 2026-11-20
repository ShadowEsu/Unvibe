// Reads the app's Chromium net log (--log-net-log, default capture mode: no request or response bodies, no cookies,
// no auth headers) and keeps only the requests to one host: time, method, path (no query) and status. The 0.1.55 RC
// rows count sign-in polls and explanation POSTs with it. The raw log never leaves the runner: it is written outside
// the uploaded folders and deleted (dropNetLog) once read (Security S-1 conditions, requests/security/20261119-1643-…).
// Electron's net.fetch (backend.ts networkFetch) goes through Chromium's network stack, so the app's API requests
// show here; Node's fetch fallback would not, which the rows say where it matters.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/** The switch that starts the log; no --net-log-capture-mode, so Chromium's default (stripped) mode is used. */
export const netLogArg = (file) => `--log-net-log=${file}`;

/** A path with every segment over 24 characters shown as "…", so a token or code in a path never reaches a summary. */
export const maskPath = (p) => p.split('/').map((s) => (s.length > 24 ? '…' : s)).join('/');

/**
 * The host's requests in the log so far, oldest first: { t (ms since the epoch), method, path (long segments masked),
 * status (0 = no answer logged yet) }. The log is read while the app still writes it: a partial last line is skipped.
 */
export function apiRequests(file, host) {
  if (!existsSync(file)) return [];
  let types = null;
  let offset = 0;
  const bySource = new Map();
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (!types && line.startsWith('{"constants":')) {
      try {
        const constants = JSON.parse(line.slice('{"constants":'.length));
        types = constants.logEventTypes;
        offset = Number(constants.timeTickOffset) || 0;
      } catch { /* not a whole line yet */ }
      continue;
    }
    if (!types || !line.startsWith('{')) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    const id = ev.source?.id;
    if (id === undefined) continue;
    if (ev.type === types.URL_REQUEST_START_JOB && ev.params?.url && !bySource.has(id)) {
      let url;
      try { url = new URL(ev.params.url); } catch { continue; }
      if (url.host !== host) continue;
      bySource.set(id, { t: offset + Number(ev.time), method: ev.params.method ?? 'GET', path: maskPath(url.pathname), status: 0 });
    } else if (ev.type === types.HTTP_TRANSACTION_READ_RESPONSE_HEADERS && bySource.has(id)) {
      const first = ev.params?.headers?.[0] ?? '';
      const status = Number(/^HTTP\/\S+ (\d{3})/.exec(first)?.[1] ?? 0);
      if (status) bySource.get(id).status = status;
    }
  }
  return [...bySource.values()].sort((a, b) => a.t - b.t);
}

/** One line per request: ISO time, method, path, status. Nothing else from the log is kept. */
export const summaryLines = (requests) => requests.map((r) => `${new Date(r.t).toISOString()} ${r.method} ${r.path} ${r.status || '-'}`);

/** Writes the summary next to the report, then deletes the raw log. */
export function keepSummaryAndDrop(file, host, summaryFile) {
  const requests = apiRequests(file, host);
  writeFileSync(summaryFile, `${summaryLines(requests).join('\n')}\n`);
  dropNetLog(file);
  return requests;
}

export function dropNetLog(file) {
  rmSync(file, { force: true });
}
