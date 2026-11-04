// Dev smoke: open the built widget, companion and bar pages the way windows.ts does, log every request
// they make (session.webRequest), load every @font-face they declare, and fail on any request to
// Google Fonts (*.googleapis.com, *.gstatic.com) or any face that does not load from the app.
// Launches Electron, so run it on a machine that can: from app/,
//   npm run build && npx electron scripts/smoke-renderer-network.cjs
// Prints one SMOKE line and exits 0 on pass, 1 on fail.
const { app, BrowserWindow, session } = require('electron');
const { mkdtempSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
const PAGES = ['widget', 'companion', 'bar'];
const GOOGLE = /^[a-z]+:\/\/([^/]*\.)?(googleapis\.com|gstatic\.com)(:\d+)?\//i;
const SETTLE_MS = 3000;

// A throwaway profile so the smoke never reads or writes the real Unvibe data.
app.setPath('userData', mkdtempSync(path.join(os.tmpdir(), 'unvibe-smoke-')));

app.whenReady().then(async () => {
  const requests = [];
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    requests.push(details.url);
    // Block anything remote so a failing build cannot leak the address while it is being caught.
    callback({ cancel: !details.url.startsWith('file:') && !details.url.startsWith('devtools:') });
  });

  const faces = {};
  for (const name of PAGES) {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { preload: path.join(DIST, 'preload', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    await win.loadFile(path.join(DIST, 'renderer', name, `${name}.html`));
    faces[name] = await win.webContents.executeJavaScript(`
      Promise.all([...document.fonts].map((face) =>
        face.load().then(() => face.family + ' ' + face.style + ' ' + face.weight + ': ' + face.status,
                         () => face.family + ' ' + face.style + ' ' + face.weight + ': error')))
    `);
  }
  await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

  const google = requests.filter((url) => GOOGLE.test(url));
  const remote = requests.filter((url) => !url.startsWith('file:') && !url.startsWith('devtools:'));
  const badFaces = Object.entries(faces).flatMap(([name, list]) => list.filter((f) => !f.endsWith(': loaded')).map((f) => `${name}: ${f}`));
  const fontFiles = [...new Set(requests.filter((url) => /\/renderer\/fonts\//.test(url)).map((url) => decodeURI(url.slice(url.indexOf('/renderer/fonts/') + 16))))];

  console.log('requests:', requests.length, '| remote:', remote.length ? remote.join(', ') : 'none');
  console.log('font files loaded from the app:', fontFiles.join(', ') || 'none');
  for (const [name, list] of Object.entries(faces)) console.log(`${name} faces: ${list.join('; ')}`);
  if (badFaces.length) console.log('faces not loaded:', badFaces.join('; '));
  const ok = google.length === 0 && remote.length === 0 && badFaces.length === 0 && Object.values(faces).every((list) => list.length > 0);
  console.log(`SMOKE ${ok ? 'PASS' : 'FAIL'}: ${google.length} requests to *.googleapis.com/*.gstatic.com, ${remote.length} remote requests, ` +
    PAGES.map((name) => `${name} ${faces[name].length - faces[name].filter((f) => !f.endsWith(': loaded')).length}/${faces[name].length} faces loaded`).join(', '));
  app.exit(ok ? 0 : 1);
});
