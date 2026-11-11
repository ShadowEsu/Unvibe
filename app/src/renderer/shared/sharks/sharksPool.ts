/**
 * An in-app ocean (Design r2-motion, in-app sharks): the same world and renderer as the start stage, in a band on a
 * companion page. Differences from `SharksStart`: a 15 fps cap (SPEC §4 for in-app oceans), no fixed run time unless
 * a `visit` is given (Today's pool: about 8 s, then `onRest()` and the loop stops; the band mounts a new pool to wake),
 * it pauses while the window is hidden or blurred and resumes when it is back, a small school, and a palette per
 * theme (violet ink on the light paper, lilac on the dark glass). Reduced motion: `still` draws one pre-stepped frame
 * and runs no loop.
 */
import { World, type SharkSpec } from '../../vendor/ascii-sharks/world';
import { DARK_PALETTE, LIGHT_PALETTE, VioletRenderer } from './violetRenderer';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Frames per second drawn (the world still steps at 60 Hz between draws). */
const FPS = 15;
/** Simulation seconds before the first frame: the sharks mid-cruise, the school formed. */
const PRESTEPS = 180;

export const POOL_SHARKS: SharkSpec[] = [
  { kind: 'classic', size: 0.78 },
  { kind: 'mako', size: 0.6 },
];

export interface SharksPoolOptions {
  theme: 'light' | 'dark';
  /** Seconds of swimming before `onRest`; omitted = swims while mounted and visible. */
  visit?: number;
  /** One pre-stepped frame, no loop (prefers-reduced-motion). */
  still?: boolean;
  sharks?: SharkSpec[];
  /** Fish in the band (the world's own count is sized for a full screen). */
  fish?: number;
  fontFamily?: string;
  onRest?: () => void;
}

export class SharksPool {
  private readonly world: World;
  private readonly renderer: VioletRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private sinceDraw = 0;
  private swum = 0;
  private resting = false;
  private paused = false;
  private disposed = false;
  private primed = false;
  private resizeObserver: ResizeObserver | null = null;
  /** For the evidence harness: frames drawn and ms spent drawing. */
  readonly stats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: SharksPoolOptions) {
    this.world = new World(opts.sharks ?? POOL_SHARKS, opts.fish ?? 28);
    this.renderer = new VioletRenderer(canvas, opts.theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE, 64);
    this.renderer.setFontFamily(opts.fontFamily ?? getComputedStyle(canvas).fontFamily);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    this.resize();
    if (!opts.still) this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
  }

  private onVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  private onBlur = () => this.pause();
  private onFocus = () => this.resume();

  private pause() {
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resume() {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    if (!this.resting && !this.opts.still && !document.hidden) this.schedule();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    if (!this.primed) {
      this.primed = true;
      for (let i = 0; i < PRESTEPS; i++) this.world.step(STEP);
      // The first frame shows the sharks: keep stepping, up to 4 more seconds, until every shark is inside the band.
      for (let i = 0; i < 240 && !this.sharksInside(); i++) this.world.step(STEP);
    }
    this.draw(STEP);
  }

  private sharksInside(): boolean {
    const { width, height } = this.world;
    for (const shark of this.world.sharks) {
      const n = shark.nodes;
      for (let i = 0; i < n.length; i += 2) {
        if (n[i] < 0 || n[i] > width || n[i + 1] < 0 || n[i + 1] > height) return false;
      }
    }
    return this.world.sharks.length > 0;
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.resting || this.paused) return;
    this.last = performance.now();
    this.sinceDraw = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    this.sinceDraw += dt;
    this.swum += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    // Drawn at FPS, not every frame: the world keeps its 60 Hz physics, the raster is the cost.
    if (this.sinceDraw >= 1 / FPS - 0.002) {
      this.draw(this.sinceDraw);
      this.sinceDraw = 0;
    }
    if (this.opts.visit !== undefined && this.swum >= this.opts.visit) {
      this.resting = true;
      this.raf = 0;
      this.opts.onRest?.();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number) {
    const started = performance.now();
    this.renderer.render(this.world, dt);
    this.stats.frames++;
    this.stats.ms += performance.now() - started;
  }
}
