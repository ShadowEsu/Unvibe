/**
 * An in-app ocean (Design r2-motion SPEC §6): the same world and renderer as the start stage, in a band or ground
 * layer of a companion page. Differences from `SharksStart`: a 20 fps cap (§6.3; the world still steps at 60 Hz
 * between draws), two forms of run time: a `visit` of N seconds (Today and the quiz: then `onEnd()` and the loop
 * stops) or an open run that rests on a still after `idleRest` seconds without pointer or key input (the empty
 * states; the next input wakes it), pausing at once while the window is hidden or blurred (a paused visit ends
 * instead of restarting), a two-shark roster and a palette per theme (violet ink on the light paper, lilac on the dark
 * glass). Reduced motion: `still` draws one pre-stepped frame and runs no loop.
 */
import { World, type SharkSpec } from '../../vendor/ascii-sharks/world';
import { DARK_PALETTE, LIGHT_PALETTE, VioletRenderer, type SharkPalette } from './violetRenderer';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Frames per second drawn (§6.3: 20, three fixed steps a frame). */
const FPS = 20;
/** Simulation seconds before the first frame: the sharks mid-cruise, the school formed. */
const PRESTEPS = 180;

/** §6.2: `{ classic, 1 }` and `{ mako, 0.85 }`, nothing smaller. */
export const POOL_SHARKS: SharkSpec[] = [
  { kind: 'classic', size: 1 },
  { kind: 'mako', size: 0.85 },
];

export interface SharksPoolOptions {
  theme: 'light' | 'dark';
  /** Seconds of swimming before `onEnd`; omitted = an open run. */
  visit?: number;
  /** Open run: seconds without pointer or key input before it rests on a still (the next input wakes it). */
  idleRest?: number;
  /** One pre-stepped frame, no loop (prefers-reduced-motion). */
  still?: boolean;
  sharks?: SharkSpec[];
  /** Fish in the band (the world's own count is sized for a full screen). */
  fish?: number;
  fontFamily?: string;
  /** Overrides the theme palette (the single-colour background sharks). */
  palette?: SharkPalette;
  /** The visit is over (its time, or a pause during it): the owner fades the canvas out and removes it. */
  onEnd?: () => void;
}

export class SharksPool {
  private readonly world: World;
  private readonly renderer: VioletRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private sinceDraw = 0;
  private swum = 0;
  private sinceInput = 0;
  private ended = false;
  private resting = false;
  private paused = false;
  private disposed = false;
  private primed = false;
  private resizeObserver: ResizeObserver | null = null;
  /** For the evidence harness: frames drawn and ms spent drawing. */
  readonly stats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: SharksPoolOptions) {
    this.world = new World(opts.sharks ?? POOL_SHARKS, opts.fish ?? 28);
    this.renderer = new VioletRenderer(canvas, opts.palette ?? (opts.theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE), 64);
    this.renderer.setFontFamily(opts.fontFamily ?? getComputedStyle(canvas).fontFamily);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    if (opts.idleRest !== undefined) {
      window.addEventListener('pointermove', this.onInput, { passive: true });
      window.addEventListener('pointerdown', this.onInput, { passive: true });
      window.addEventListener('keydown', this.onInput, { passive: true });
    }
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
    window.removeEventListener('pointermove', this.onInput);
    window.removeEventListener('pointerdown', this.onInput);
    window.removeEventListener('keydown', this.onInput);
  }

  private onVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };
  private onBlur = () => this.pause();
  private onFocus = () => this.resume();
  private onInput = () => {
    this.sinceInput = 0;
    if (this.resting && !this.paused && !this.disposed) {
      this.resting = false;
      this.schedule();
    }
  };

  private pause() {
    if (this.paused || this.disposed) return;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    // §6.3: a visit that was paused does not restart.
    if (this.opts.visit !== undefined) this.finish();
  }

  private resume() {
    if (!this.paused || this.disposed) return;
    this.paused = false;
    if (!this.ended && !this.resting && !this.opts.still && !document.hidden) this.schedule();
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
        if (n[i] < 32 || n[i] > width - 32 || n[i + 1] < 24 || n[i + 1] > height - 24) return false;
      }
    }
    return this.world.sharks.length > 0;
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.ended || this.resting || this.paused) return;
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
    this.sinceInput += dt;
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
      this.finish();
      return;
    }
    if (this.opts.idleRest !== undefined && this.sinceInput >= this.opts.idleRest) {
      this.resting = true;
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private finish() {
    if (this.ended) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.opts.onEnd?.();
  }

  /**
   * For the evidence harness: pauses the loop and draws one frame with the first shark laid out straight, side-on,
   * its head at (`x`, `y`) CSS px and its body trailing opposite to `heading` (0 = swimming right, π = left). The
   * same pose in every still of a comparison set.
   */
  pose(x: number, y: number, heading: number): void {
    this.pause();
    const shark = this.world.sharks[this.world.sharks.length - 1];
    if (!shark) return;
    const seg = shark.length / (shark.nodes.length / 2 - 1);
    for (let n = 0; n < shark.nodes.length / 2; n++) {
      shark.nodes[n * 2] = x - Math.cos(heading) * seg * n;
      shark.nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
    }
    shark.heading = heading;
    shark.turn = 0;
    this.draw(0);
  }

  private draw(dt: number) {
    const started = performance.now();
    this.renderer.render(this.world, dt);
    this.stats.frames++;
    this.stats.ms += performance.now() - started;
  }
}
