// Window size and 2x stills of the app's windows over the debug port, shared by marketing-media.mjs and
// two-app-take.mjs (both drive a release build through cdp-launch.mjs).
import { writeFileSync } from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Window size (and optionally centre) without the main process: Electron applies a page's
 * window.resizeTo/moveTo to its BrowserWindow ('content-bounds-updated'; the app doesn't block it).
 * CDP's Browser.setWindowBounds is not available in Electron. macOS keeps a window inside the screen,
 * so on a smaller display (GitHub's macOS runners: 1024x679 available) the page's viewport is emulated at the
 * size the wanted window would give it, and screenshots and the screencast render at that size.
 * Once a page's viewport is emulated, Chromium reports screen.avail* and innerWidth/innerHeight at the emulated
 * size (outerWidth/outerHeight stay real), so the real screen and window frame are kept from the first emulation:
 * run 43088701806 resized an emulated 420x720 panel again, read a 420x720 "screen" and threw on its real 420x679.
 */
const emulated = new WeakMap();
/**
 * The viewport is emulated from this module's own CDP session, kept attached for the page's life (detaching drops its
 * override), with deviceScaleFactor 0: the window keeps its own 2x. Playwright's setViewportSize forces 1, and then
 * the first 2x capture rendered at 4x and changed the override, which lost its height (run 43174610564's follow-up
 * throw, run 43205339271's white band under sample-sort-scores-beginner).
 */
const sessions = new WeakMap();
async function override(page, size) {
  let cdp = sessions.get(page);
  if (!cdp) {
    cdp = await page.context().newCDPSession(page);
    sessions.set(page, cdp);
  }
  if (!size) return cdp.send('Emulation.clearDeviceMetricsOverride');
  // Chromium skips a session's override when it repeats that session's last one, even if another override has
  // replaced it since; one pixel taller first makes it apply again.
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height + 1, deviceScaleFactor: 0, mobile: false });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: 0, mobile: false });
}
export async function resize(page, width, height, { center = false } = {}) {
  await page.evaluate(([w, h, c]) => {
    window.resizeTo(w, h);
    if (c) window.moveTo(Math.round(screen.availLeft + Math.max(0, (screen.availWidth - w) / 2)), Math.round(screen.availTop + Math.max(0, (screen.availHeight - h) / 2)));
  }, [width, height, center]);
  await sleep(400);
  const m = await page.evaluate(() => ({ outer: [window.outerWidth, window.outerHeight], inner: [window.innerWidth, window.innerHeight], avail: [screen.availWidth, screen.availHeight] }));
  // The window frame (title bar); 0 for frameless windows, which can report inner > outer mid-resize.
  const real = emulated.get(page) ?? { avail: m.avail, frame: [Math.max(0, m.outer[0] - m.inner[0]), Math.max(0, m.outer[1] - m.inner[1])] };
  if (Math.abs(m.outer[0] - width) <= 2 && Math.abs(m.outer[1] - height) <= 2) {
    // The real window fits now: an earlier emulation must not leave the page at another size.
    if (emulated.has(page)) await override(page, null);
    return;
  }
  if (real.avail[0] >= width && real.avail[1] >= height) throw new Error(`window is ${m.outer.join('x')}, wanted ${width}x${height}`);
  const viewport = { width: width - real.frame[0], height: height - real.frame[1] };
  await override(page, viewport);
  emulated.set(page, real);
  await sleep(300);
  const inner = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  if (inner[0] !== viewport.width || inner[1] !== viewport.height) throw new Error(`viewport is ${inner.join('x')}, wanted ${viewport.width}x${viewport.height}`);
  console.log(`NOTE screen ${real.avail.join('x')} is smaller than a ${width}x${height} window: page viewport emulated at ${viewport.width}x${viewport.height}`);
}

/**
 * A still of the page at 2x into `file` (the site shows them at up to half their pixel width, ledger 530 spec §5).
 * Chromium renders the capture itself at the clip's scale, so the text is sharp, not an upscaled image; the scale
 * makes the file twice the page's CSS size whatever the window's own pixel ratio is. Returns the PNG's size.
 */
export async function shot(page, file) {
  const [width, height, ratio] = await page.evaluate(() => [window.innerWidth, window.innerHeight, window.devicePixelRatio || 1]);
  const cdp = await page.context().newCDPSession(page);
  // The PNG's own size, from its IHDR chunk.
  const size = (png) => [png.readUInt32BE(16), png.readUInt32BE(20)];
  const label = file.split(/[\\/]/).pop();
  try {
    // Each capture is checked: if it isn't exactly twice the CSS size (run 43174610564's 4x stills, before resize() kept
    // the window's own scale), it is taken again at the corrected scale (up to 3 tries), with a NOTE: a retake is a
    // later moment. A still that never comes out right is kept and named in a NOTE, not thrown: a throw would end the
    // step and its follow-up.
    let scale = 2 / ratio;
    let png;
    let w = 0;
    let h = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      png = Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale } })).data, 'base64');
      [w, h] = size(png);
      if (w === 2 * width && h === 2 * height) break;
      console.log(`NOTE ${label}: capture ${attempt} came out ${w}x${h} for a ${width}x${height} page (ratio ${ratio}, scale ${scale})`);
      scale *= (2 * width) / w;
    }
    if (w !== 2 * width || h !== 2 * height) console.log(`NOTE ${label}: still kept at ${w}x${h}, not ${2 * width}x${2 * height}`);
    writeFileSync(file, png);
    return [w, h];
  } finally {
    await cdp.detach().catch(() => {});
  }
}
