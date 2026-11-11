/**
 * The ASCII ghost: Unvibe's logo drawn from code glyphs on a canvas, in the aurora colours (ledger 597).
 *
 *   start  scattered glyphs drift in, school into the ghost, it blinks and floats with a sheen,
 *          then dissolves into the window (≈ 2.3 s; `skip()` jumps to the dissolve)
 *   loop   the formed ghost floats, shimmers and blinks forever (overlay "thinking", empty states)
 *   still  one formed frame (prefers-reduced-motion; the owner fades the canvas in over 200 ms)
 *
 * Every number here is a CSS px or a second. One `fillText` per cell per frame, nothing allocated in
 * the frame loop. The loop pauses when the document is hidden or the window loses focus.
 */
import { buildGhostMask, type GhostMask } from './ghostMask';

export type GhostTheme = 'light' | 'dark';
export type GhostMode = 'start' | 'loop' | 'still';

export interface Timeline {
  /** Glyphs appear scattered over the canvas and drift (s). */
  scatter: number;
  /** They school into the ghost, core first (s). */
  school: number;
  /** The ghost floats, blinks once and catches a sheen (s). */
  hold: number;
  /** The glyphs loosen, sink and fade (s). */
  dissolve: number;
}

export interface AsciiGhostOptions {
  theme: GhostTheme;
  mode: GhostMode;
  /** Ghost height in CSS px; default 58 % of the canvas height. */
  height?: number;
  /** Mono font size in CSS px (cell size follows); default 13. */
  fontSize?: number;
  fontFamily?: string;
  timeline?: Partial<Timeline>;
  /** Small code-glyph companions swimming around the ghost; default 18 (start) / 6 (loop) / 0 (still). */
  companions?: number;
  seed?: number;
  onDone?: () => void;
}

export const START_TIMELINE: Timeline = { scatter: 0.35, school: 1.0, hold: 0.6, dissolve: 0.35 };

/** Aurora ramps, core → rim. Dark: near-white lilac core so the ghost glows; light: deep violet core for contrast. */
const RAMP: Record<GhostTheme, ReadonlyArray<readonly [number, number, number]>> = {
  dark: [[243, 236, 255], [196, 181, 253], [232, 121, 201], [96, 165, 250]],
  light: [[67, 48, 196], [106, 80, 245], [208, 71, 158], [47, 111, 224]],
};
const EYE_INK: Record<GhostTheme, string> = { dark: '#1b1530', light: '#15141a' };
const EYE_GLINT = '#ffffff';

const CORE_GLYPHS = '{}#$@&%';
const MID_GLYPHS = '()<>=*+';
const RIM_GLYPHS = ";:,./'`-";
const FISH_GLYPHS = '<>=~-';

interface Particle {
  tx: number; // target (formed) position
  ty: number;
  sx: number; // scatter origin
  sy: number;
  x: number;
  y: number;
  delay: number; // 0–1 stagger, core first
  glyph: string;
  alt: string;
  r: number;
  g: number;
  b: number;
  alpha: number;
  eye: boolean;
  /** Eye cells: '@' inside the iris, 'o' where the ellipse edge crosses the cell. */
  eyeGlyph: string;
  glint: boolean;
  sheen: number; // u + v, for the diagonal sheen band
  wobble: number; // phase for the idle wobble
  ox: number; // outward direction for the dissolve
  oy: number;
}

interface Fish {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  phase: number;
  speed: number;
  glyph: string;
  alpha: number;
  stop: number; // ramp stop 0–1
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ramp(theme: GhostTheme, d: number): [number, number, number] {
  const stops = RAMP[theme];
  const p = Math.min(0.999, Math.max(0, d)) * (stops.length - 1);
  const i = Math.floor(p);
  const f = p - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** easeOutBack with a 6 % overshoot: the glyphs settle with a tiny bounce. */
const settle = (p: number) => {
  const c1 = 0.9;
  const c3 = c1 + 1;
  const q = p - 1;
  return 1 + c3 * q * q * q + c1 * q * q;
};
const easeOut = (p: number) => 1 - (1 - p) * (1 - p) * (1 - p);
const easeIn = (p: number) => p * p;

export class AsciiGhost {
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private fish: Fish[] = [];
  private mask: GhostMask | null = null;
  private cellW = 8;
  private cellH = 15;
  private width = 0;
  private height = 0;
  private raf = 0;
  private last = 0;
  private t = 0;
  private paused = false;
  private disposed = false;
  private done = false;
  private readonly font: string;
  private readonly timeline: Timeline;
  private readonly rand: () => number;
  private shimmerAt = 0;
  private resizeObserver: ResizeObserver | null = null;
  /** Frame stats for the evidence harness (frames rendered, ms spent in render). */
  readonly stats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: AsciiGhostOptions) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('AsciiGhost needs a 2d canvas');
    this.ctx = ctx;
    const size = opts.fontSize ?? 13;
    this.font = `600 ${size}px ${opts.fontFamily ?? '"JetBrains Mono", ui-monospace, monospace'}`;
    this.timeline = { ...START_TIMELINE, ...opts.timeline };
    this.rand = mulberry(opts.seed ?? 7);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.layout());
      this.resizeObserver.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    this.layout();
    void document.fonts?.load(this.font).then(() => {
      if (!this.disposed) this.layout();
    });
  }

  /** The start animation jumps to its dissolve (≤ 0.35 s to a clean window); loops ignore it. */
  skip() {
    if (this.opts.mode !== 'start' || this.done) return;
    const { scatter, school, hold } = this.timeline;
    if (this.t < scatter + school + hold) this.t = scatter + school + hold;
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
  }

  private onVisibility = () => (document.hidden ? this.pause() : this.resume());
  private onBlur = () => this.pause();
  private onFocus = () => this.resume();

  private pause() {
    this.paused = true;
    cancelAnimationFrame(this.raf);
  }

  private resume() {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    this.schedule();
  }

  private layout() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = this.opts.fontSize ?? 13;
    this.cellW = ctx.measureText('M').width || size * 0.6;
    this.cellH = Math.round(size * 1.15);
    const cols = Math.floor(rect.width / this.cellW);
    const rows = Math.floor(rect.height / this.cellH);
    const ghostHeight = Math.min(this.opts.height ?? rect.height * 0.58, rect.height - this.cellH * 2);
    this.mask = buildGhostMask(this.cellW, this.cellH, ghostHeight, cols, rows);
    this.build();
    if (this.opts.mode === 'still') {
      this.t = this.timeline.scatter + this.timeline.school + this.timeline.hold * 0.4;
      this.render();
      return;
    }
    if (this.opts.mode === 'loop') this.t = this.timeline.scatter + this.timeline.school;
    this.schedule();
  }

  private build() {
    const mask = this.mask;
    if (!mask) return;
    const rand = mulberry((this.opts.seed ?? 7) * 7919);
    const theme = this.opts.theme;
    const offX = (this.width - mask.cols * this.cellW) / 2;
    const offY = (this.height - mask.rows * this.cellH) / 2;
    const cx = offX + (mask.left + mask.width / 2) * this.cellW;
    const cy = offY + (mask.top + mask.height * 0.5) * this.cellH;
    const particles: Particle[] = [];
    // One glint per eye: the top-left eye cell on each side.
    const glintKey = [Infinity, Infinity];
    const glintIdx = [-1, -1];
    for (const cell of mask.cells) {
      const tx = offX + (cell.col + 0.5) * this.cellW;
      const ty = offY + (cell.row + 0.5) * this.cellH;
      // Distance from the ghost's heart (a little above centre, between the eyes), 0 core → 1 rim.
      const du = (cell.u - 0.5) * 1.1;
      const dv = (cell.v - 0.42) * 0.95;
      const d = clamp01(Math.sqrt(du * du + dv * dv) * 1.9);
      const rim = cell.cover < 0.62 || d > 0.86;
      const set = rim ? RIM_GLYPHS : d < 0.4 ? CORE_GLYPHS : MID_GLYPHS;
      const [r, g, b] = ramp(theme, d);
      // Lit from the top-left, like the glass: the lower-right flank sits 22 % dimmer.
      const light = 1 - 0.22 * clamp01((cell.u - 0.35) * 0.7 + (cell.v - 0.3) * 0.9);
      const alpha = clamp01(cell.cover * 1.25) * light;
      const eye = cell.eye > 0.5;
      const idx = particles.length;
      if (eye) {
        const side = cell.u < 0.5 ? 0 : 1;
        const key = cell.v * 2 + cell.u;
        if (key < glintKey[side]) {
          glintKey[side] = key;
          glintIdx[side] = idx;
        }
      }
      const angle = rand() * Math.PI * 2;
      const radius = Math.max(this.width, this.height) * (0.25 + rand() * 0.45);
      const ox = tx - cx;
      const oy = ty - cy;
      const on = Math.hypot(ox, oy) || 1;
      particles.push({
        tx,
        ty,
        sx: cx + Math.cos(angle) * radius,
        sy: cy + Math.sin(angle) * radius * 0.7,
        x: tx,
        y: ty,
        delay: clamp01(d * 0.8 + rand() * 0.2),
        glyph: set[Math.floor(rand() * set.length)],
        alt: set[Math.floor(rand() * set.length)],
        r,
        g,
        b,
        alpha,
        eye,
        eyeGlyph: cell.eye > 0.85 ? '@' : 'o',
        glint: false,
        sheen: cell.u + cell.v,
        wobble: rand() * Math.PI * 2,
        ox: ox / on,
        oy: oy / on,
      });
    }
    for (const i of glintIdx) if (i >= 0) particles[i].glint = true;
    this.particles = particles;

    const count = this.opts.companions ?? (this.opts.mode === 'start' ? 18 : this.opts.mode === 'loop' ? 6 : 0);
    const fish: Fish[] = [];
    const gw = mask.width * this.cellW;
    const gh = mask.height * this.cellH;
    for (let i = 0; i < count; i++) {
      fish.push({
        cx,
        cy,
        rx: gw * (0.7 + rand() * 0.5),
        ry: gh * (0.45 + rand() * 0.35),
        phase: rand() * Math.PI * 2,
        speed: (0.35 + rand() * 0.4) * (rand() < 0.5 ? 1 : -1),
        glyph: FISH_GLYPHS[Math.floor(rand() * FISH_GLYPHS.length)],
        alpha: 0.35 + rand() * 0.3,
        stop: 0.6 + rand() * 0.4,
      });
    }
    this.fish = fish;
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.paused || this.done) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    const started = performance.now();
    this.render();
    this.stats.frames++;
    this.stats.ms += performance.now() - started;
    if (this.done) {
      this.opts.onDone?.();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private render() {
    const ctx = this.ctx;
    const { scatter, school, hold, dissolve } = this.timeline;
    const t = this.t;
    const mode = this.opts.mode;
    const theme = this.opts.theme;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.font = this.font;

    // Phase and its local progress.
    let phase: 'scatter' | 'school' | 'hold' | 'dissolve';
    let p: number;
    if (t < scatter) {
      phase = 'scatter';
      p = t / scatter;
    } else if (t < scatter + school) {
      phase = 'school';
      p = (t - scatter) / school;
    } else if (mode === 'loop' || t < scatter + school + hold) {
      phase = 'hold';
      p = mode === 'loop' ? 0 : (t - scatter - school) / hold;
    } else {
      phase = 'dissolve';
      p = clamp01((t - scatter - school - hold) / dissolve);
    }
    const holdT = t - scatter - school; // seconds since formed
    const bob = Math.sin(holdT * (Math.PI * 2) / 1.8) * 3;
    // One blink 0.25 s into the hold (and every 3.2 s in a loop), 0.12 s long.
    const blinkAt = mode === 'loop' ? holdT % 3.2 : holdT;
    const blink = phase === 'hold' && blinkAt > 0.25 && blinkAt < 0.37;
    // A diagonal sheen sweeps the ghost once over the hold (every 2.4 s in a loop): band 0.12 wide in u+v.
    const sheenP = mode === 'loop' ? (holdT % 2.4) / 1.2 : p;
    const sheenK = -0.2 + sheenP * 2.4;
    // Glyph shimmer: every 0.16 s, 7 % of the cells show their alternate glyph.
    if (phase !== 'scatter' && t - this.shimmerAt > 0.16) {
      this.shimmerAt = t;
      const n = this.particles.length;
      for (let i = 0; i < n * 0.07; i++) {
        const pt = this.particles[Math.floor(this.rand() * n)];
        const g = pt.glyph;
        pt.glyph = pt.alt;
        pt.alt = g;
      }
    }

    for (const pt of this.particles) {
      let x: number;
      let y: number;
      let alpha = pt.alpha;
      let glyph = pt.glyph;
      if (phase === 'scatter') {
        const drift = easeOut(p) * 0.08;
        x = pt.sx + (pt.tx - pt.sx) * drift;
        y = pt.sy + (pt.ty - pt.sy) * drift;
        alpha *= 0.55 * easeOut(p);
      } else if (phase === 'school') {
        // Each glyph starts after its stagger (core first) and takes 55 % of the phase to settle.
        const q = clamp01((p - pt.delay * 0.45) / 0.55);
        const e = settle(q);
        x = pt.sx + (pt.tx - pt.sx) * (0.08 + 0.92 * e);
        y = pt.sy + (pt.ty - pt.sy) * (0.08 + 0.92 * e);
        alpha *= 0.55 + 0.45 * q;
      } else if (phase === 'hold') {
        x = pt.tx + Math.sin(holdT * 2.1 + pt.wobble) * 0.6;
        y = pt.ty + bob + Math.cos(holdT * 1.7 + pt.wobble) * 0.5;
      } else {
        const e = easeIn(p);
        x = pt.tx + pt.ox * 46 * e;
        y = pt.ty + bob + pt.oy * 46 * e + 30 * e;
        alpha *= 1 - e;
        if (e > 0.3 && !pt.eye) glyph = pt.alt;
      }
      // Sheen: cells inside the band brighten by 35 % and lean white.
      const band = Math.abs(pt.sheen - sheenK);
      const sheen = phase === 'hold' && band < 0.12 ? 1 - band / 0.12 : 0;
      if (pt.eye) {
        if (blink) {
          glyph = '-';
        } else if (pt.glint) {
          ctx.fillStyle = EYE_GLINT;
          ctx.globalAlpha = alpha;
          ctx.fillText("'", x, y);
          continue;
        } else {
          glyph = pt.eyeGlyph;
        }
        ctx.fillStyle = EYE_INK[theme];
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, x, y);
        continue;
      }
      const r = pt.r + (255 - pt.r) * sheen * 0.5;
      const g = pt.g + (255 - pt.g) * sheen * 0.5;
      const b = pt.b + (255 - pt.b) * sheen * 0.5;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.globalAlpha = Math.min(1, alpha * (1 + 0.35 * sheen));
      ctx.fillText(glyph, x, y);
    }

    // Companions: code-glyph fish on slow ellipses around the ghost, visible while it is formed.
    let fishAlpha = 0;
    if (phase === 'school') fishAlpha = easeOut(p);
    else if (phase === 'hold') fishAlpha = 1;
    else if (phase === 'dissolve') fishAlpha = 1 - p;
    if (fishAlpha > 0) {
      for (const f of this.fish) {
        const a = f.phase + t * f.speed;
        const [r, g, b] = ramp(theme, f.stop);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.globalAlpha = f.alpha * fishAlpha;
        ctx.fillText(f.speed > 0 ? '>' : '<', f.cx + Math.cos(a) * f.rx, f.cy + Math.sin(a) * f.ry + Math.sin(t * 3 + f.phase) * 2);
        ctx.fillText(f.glyph, f.cx + Math.cos(a - 0.08 * Math.sign(f.speed)) * f.rx, f.cy + Math.sin(a - 0.08 * Math.sign(f.speed)) * f.ry + Math.sin(t * 3 + f.phase) * 2);
      }
    }
    ctx.globalAlpha = 1;

    if (mode === 'start' && phase === 'dissolve' && p >= 1) this.done = true;
  }
}
