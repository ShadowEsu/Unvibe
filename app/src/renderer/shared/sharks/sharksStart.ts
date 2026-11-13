/**
 * The cold-launch ocean (Design `agents/design/r2-motion/SPEC.md` §2): ascii-sharks' World drawn by VioletRenderer
 * on the stage's dark ground for `duration` seconds, then the owner fades the stage and unmounts it.
 *
 * Our own loop instead of the vendored OceanEngine because the start screen needs what it lacks: a fixed run time
 * with `skip()`, ending on window blur / `document.hidden` (the vendored one only pauses off screen), a pre-stepped
 * world so frame 0 already has schools and sharks (SPEC §2.4: 240 steps), and no splash on click (a click skips).
 * The pointer behaviour stays on: fish scatter from the pointer. Nothing is allocated per frame.
 */
import { World, type SharkSpec } from '../../vendor/ascii-sharks/world';
import { VioletRenderer } from './violetRenderer';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Simulation steps before the first frame (SPEC §2.4: 240 = 4 s): schools formed, sharks mid-cruise. */
const PRESTEPS = 240;

/** The engine's default roster is four classic sharks; one hammerhead and one mako so the silhouettes differ. */
export const START_SHARKS: SharkSpec[] = [
  { kind: 'classic', size: 1 },
  { kind: 'hammerhead', size: 0.72 },
  { kind: 'classic', size: 0.84 },
  { kind: 'mako', size: 0.66 },
];

export interface SharksStartOptions {
  /** Seconds from construction to `onEnd('timeout')`, the pre-steps included. Default 1.55 (the stage then fades over 350 ms: 1.9 s in all). */
  duration?: number;
  /** One pre-stepped frame, no loop (prefers-reduced-motion). */
  still?: boolean;
  sharks?: SharkSpec[];
  fontFamily?: string;
  /** `timeout` / `skip`: the owner fades the stage; `hidden`: the owner removes it at once (SPEC §2.5). */
  onEnd?: (why: 'timeout' | 'skip' | 'hidden') => void;
}

export class SharksStart {
  private world: World;
  private renderer: VioletRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private readonly startedAt = performance.now();
  private elapsed = 0;
  private ended = false;
  private disposed = false;
  private readonly duration: number;
  private resizeObserver: ResizeObserver | null = null;
  /** For the evidence harness: frames drawn and ms spent drawing. */
  readonly stats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: SharksStartOptions = {}) {
    this.world = new World(opts.sharks ?? START_SHARKS);
    this.renderer = new VioletRenderer(canvas);
    this.renderer.setFontFamily(opts.fontFamily ?? getComputedStyle(canvas).fontFamily);
    this.duration = opts.duration ?? 1.55;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onHidden);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    // The world spawns its sharks on its first non-empty resize, so the pre-steps run there (`resize()`), which may
    // be now or at the ResizeObserver's first call when the canvas has no size yet (the window still hidden).
    this.resize();
    if (!opts.still) this.schedule();
  }

  /** A pointer down or key down: `onEnd('skip')` fires now; the owner fades the stage within --m-exit. */
  skip() {
    this.finish('skip');
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onHidden);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  private onVisibility = () => {
    if (document.hidden) this.finish('hidden');
  };
  private onHidden = () => this.finish('hidden');
  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const p = this.world.pointer;
    p.x = e.clientX - rect.left;
    p.y = e.clientY - rect.top;
    p.active = e.pointerType !== 'touch';
  };

  private primed = false;
  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
    if (!this.primed) {
      this.primed = true;
      for (let i = 0; i < PRESTEPS; i++) this.world.step(STEP);
      // The first frame frames the name (Design S-1 whole-app, Start): keep stepping, up to 4 more seconds, until a
      // shark swims on each side of the centre and none is cut by an edge. The world is random; a seed would only
      // fix one window size.
      for (let i = 0; i < PRESTEPS && !this.framesLockup(); i++) this.world.step(STEP);
    }
    // Painted here, not on the next frame: a window that is not shown yet has its rafs paused, and the first frame
    // the user sees must already have the sharks (SPEC §2.4).
    this.draw(STEP);
  }

  private framesLockup(): boolean {
    const { width, height } = this.world;
    let left = false;
    let right = false;
    for (const shark of this.world.sharks) {
      const n = shark.nodes;
      let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
      for (let i = 0; i < n.length; i += 2) {
        minX = Math.min(minX, n[i]); maxX = Math.max(maxX, n[i]);
        minY = Math.min(minY, n[i + 1]); maxY = Math.max(maxY, n[i + 1]);
      }
      // The spine, plus the body the renderer draws around it (fins, up to about 3 cells): 48 px in from each edge.
      if (minX < 48 || maxX > width - 48 || minY < 48 || maxY > height - 48) return false;
      const mid = (minX + maxX) / 2;
      if (mid < width * 0.42) left = true;
      else if (mid > width * 0.58) right = true;
    }
    return left && right;
  }

  private schedule() {
    cancelAnimationFrame(this.raf);
    if (this.disposed || this.ended) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.elapsed = (now - this.startedAt) / 1000;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.draw(dt);
    if (this.elapsed >= this.duration) {
      this.finish('timeout');
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

  private finish(why: 'timeout' | 'skip' | 'hidden') {
    if (this.ended || this.disposed) return;
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.opts.onEnd?.(why);
  }
}
