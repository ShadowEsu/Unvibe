/**
 * The sharks behind everything (Design r3-flat OPTIONS.md "Sharks: behind everything", as Mono amends it): Design's
 * WanderWorld drawn by VioletRenderer on one window-sized canvas. Two classic sharks, sizes 1 and 0.72 of
 * `clamp(0.44 × the short side, 170, 430)` px, no fish; cells 10 × 15 px at every window size. The world steps 60
 * times a second; frames are drawn 30 a second while the window is focused, 15 while it is visible but not focused,
 * none while it is hidden. It never parks. Reduced motion: one pre-stepped still frame and no loop.
 */
import type { SharkSpec } from '../../vendor/ascii-sharks/world';
import { VioletRenderer, type SharkPalette } from './violetRenderer';
import { WanderWorld } from './wanderWorld';

const STEP = 1 / 60;
const MAX_STEPS = 4;
/** Frames drawn per second while the window is focused, and while it is visible but not focused. */
const FPS_FOCUSED = 30;
const FPS_UNFOCUSED = 15;
/** Simulation seconds before the first frame, so the sharks are already swimming. */
const PRESTEPS = 180;
/** Cell width in CSS px at every window size (the height is 1.45 of it: 15 px). */
const CELL_PX = 10;

/** OPTIONS.md "Cast": two sharks, sizes 1 and 0.72; WanderWorld sizes the largest from the window. */
export const POOL_SHARKS: SharkSpec[] = [
  { kind: 'classic', size: 1 },
  { kind: 'classic', size: 0.72 },
];

/** A still's shark: head at (`x` × width, `y` × height) and swimming along `heading` (0 = right, π = left). */
export interface SharkPose {
  x: number;
  y: number;
  heading: number;
}

/** The comparison still: the large shark (A) high on the right swimming right, the small one (B) low on the left
 * swimming left. */
export const STILL_POSES: SharkPose[] = [
  { x: 0.62, y: 0.3, heading: 0 },
  { x: 0.3, y: 0.72, heading: Math.PI },
];

export interface SharksPoolOptions {
  palette: SharkPalette;
  /** One pre-stepped frame, no loop (prefers-reduced-motion). */
  still?: boolean;
  fontFamily?: string;
}

/** Script cost of the sharks for the evidence harness (`window.__sharksStats`): frames drawn, and ms spent stepping
 * the world and drawing them (the 3 s pre-step before the first frame is not counted). `ms / frames` is the script
 * cost per frame. */
export interface SharksStats {
  frames: number;
  ms: number;
}

declare global {
  interface Window {
    __sharksStats?: SharksStats;
  }
}

export class SharksPool {
  private readonly world = new WanderWorld(POOL_SHARKS);
  private readonly renderer: VioletRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private sinceDraw = 0;
  private focused = document.hasFocus();
  private disposed = false;
  private primed = false;
  /** Set by the harness's pose calls: the loop stays stopped on that frame. */
  private posed = false;
  private resizeObserver: ResizeObserver | null = null;
  readonly stats: SharksStats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: SharksPoolOptions) {
    this.renderer = new VioletRenderer(canvas, opts.palette, (width) => Math.round(width / CELL_PX));
    this.renderer.setFontFamily(opts.fontFamily ?? getComputedStyle(canvas).fontFamily);
    window.__sharksStats = this.stats;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
    this.resize();
    this.schedule();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    if (window.__sharksStats === this.stats) delete window.__sharksStats;
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.stop();
    else this.schedule();
  };
  private onBlur = () => {
    this.focused = false;
  };
  private onFocus = () => {
    this.focused = true;
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height);
    if (!this.primed) {
      this.primed = true;
      for (let i = 0; i < PRESTEPS; i++) this.world.step(STEP);
    }
    this.draw(STEP);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private schedule() {
    if (this.raf || this.disposed || this.posed || this.opts.still || document.visibilityState === 'hidden') return;
    this.last = performance.now();
    this.sinceDraw = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    this.sinceDraw += dt;
    const started = performance.now();
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    this.stats.ms += performance.now() - started;
    // The world keeps its 60 Hz step; only the drawing follows the frame rate.
    if (this.sinceDraw >= 1 / (this.focused ? FPS_FOCUSED : FPS_UNFOCUSED) - 0.002) {
      this.draw(this.sinceDraw);
      this.sinceDraw = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /**
   * For the evidence harness: stops the loop and draws one frame with the largest shark laid out straight, side-on,
   * its head at (`x`, `y`) CSS px and its body trailing opposite to `heading` (0 = swimming right, π = left), and no
   * fish. The same pose in every still of a comparison set.
   */
  pose(x: number, y: number, heading: number): void {
    this.posed = true;
    this.stop();
    const shark = this.world.sharks[this.world.sharks.length - 1];
    if (!shark) return;
    this.layStraight(shark.nodes, shark.length, x, y, heading);
    shark.heading = heading;
    shark.turn = 0;
    this.world.fish.length = 0;
    this.draw(0);
  }

  /**
   * For the evidence harness: stops the loop and draws one frame with every shark laid out straight at a fixed spot,
   * the largest first: `poses` are shares of the canvas (default `STILL_POSES`: A's head at 0.62 w, 0.30 h heading
   * right; B's at 0.30 w, 0.72 h heading left).
   */
  poseAll(poses: SharkPose[] = STILL_POSES): void {
    this.posed = true;
    this.stop();
    const { width, height } = this.world;
    const largestFirst = [...this.world.sharks].reverse();
    largestFirst.forEach((shark, i) => {
      const p = poses[i];
      if (!p) return;
      this.layStraight(shark.nodes, shark.length, p.x * width, p.y * height, p.heading);
      shark.heading = p.heading;
      shark.turn = 0;
    });
    this.world.fish.length = 0;
    this.draw(0);
  }

  private layStraight(nodes: Float32Array, length: number, x: number, y: number, heading: number) {
    const count = nodes.length / 2;
    const seg = length / (count - 1);
    for (let n = 0; n < count; n++) {
      nodes[n * 2] = x - Math.cos(heading) * seg * n;
      nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
    }
  }

  private draw(dt: number) {
    const started = performance.now();
    this.renderer.render(this.world, dt);
    this.stats.ms += performance.now() - started;
    this.stats.frames++;
  }
}
