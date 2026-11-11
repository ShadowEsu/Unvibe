/**
 * An ocean behind a section of unvibe.site (ledger 598 N1): the vendored ascii-sharks world drawn by our violet
 * renderer in transparent light-ink mode. Runs only while the canvas is in view and the tab is visible and focused,
 * at 20 frames a second (the world still steps at 60 Hz between draws). Fish scatter from the pointer on mouse
 * devices; touch does nothing. Reduced motion: one pre-stepped still frame and no loop.
 */
import { World, type SharkSpec } from "@/vendor/ascii-sharks/world";
import { LIGHT_PALETTE, VioletRenderer } from "./violetRenderer";

const STEP = 1 / 60;
const MAX_STEPS = 4;
const FPS = 20;
/** Simulated seconds before the first frame, so the sharks are mid-cruise and the schools formed. */
const PRESTEPS = 180;

export interface OceanOptions {
  sharks: SharkSpec[];
  fish?: number;
  still?: boolean;
  /** Cells across the canvas width (the renderer clamps the cell to 8 to 13 px). */
  cellsAcross?: number;
}

export class Ocean {
  private readonly world: World;
  private readonly renderer: VioletRenderer;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private sinceDraw = 0;
  private paused = false;
  private visible = true;
  private disposed = false;
  private primed = false;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  /** For the evidence harness: frames drawn and ms spent drawing. */
  readonly stats = { frames: 0, ms: 0 };

  constructor(private canvas: HTMLCanvasElement, private opts: OceanOptions) {
    this.world = new World(opts.sharks, opts.fish);
    this.renderer = new VioletRenderer(canvas, LIGHT_PALETTE, opts.cellsAcross ?? 124);
    this.renderer.setFontFamily(getComputedStyle(canvas).fontFamily);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.schedule();
      else this.stop();
    });
    this.io.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    if (!opts.still && !window.matchMedia("(hover: none)").matches) {
      window.addEventListener("pointermove", this.onPointerMove, { passive: true });
      window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    }
    this.resize();
    if (!opts.still) this.schedule();
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
  }

  private onVisibility = () => {
    this.paused = document.hidden;
    if (this.paused) this.stop();
    else this.schedule();
  };
  private onBlur = () => {
    this.paused = true;
    this.world.pointer.active = false;
    this.stop();
  };
  private onFocus = () => {
    this.paused = document.hidden;
    this.schedule();
  };
  private onPointerMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.world.pointer.x = x;
    this.world.pointer.y = y;
    this.world.pointer.active = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
  };
  private onPointerDown = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) this.world.splash(x, y);
  };

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.resize(rect.width, rect.height, dpr);
    this.world.resize(rect.width, rect.height, this.renderer.cellWidth, this.renderer.cellHeight);
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
    this.stop();
    if (this.disposed || this.paused || !this.visible || this.opts.still) return;
    this.last = performance.now();
    this.sinceDraw = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt;
    this.sinceDraw += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < MAX_STEPS) {
      this.world.step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) this.acc = 0;
    if (this.sinceDraw >= 1 / FPS) {
      this.draw(this.sinceDraw);
      this.sinceDraw = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private draw(dt: number) {
    const t0 = performance.now();
    this.renderer.render(this.world, dt);
    this.stats.frames++;
    this.stats.ms += performance.now() - t0;
  }
}
