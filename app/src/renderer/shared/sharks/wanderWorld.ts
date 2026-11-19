/**
 * The sharks as a full-window background (Design r3, Thu 12 Nov 2026; Preston: "move constantly and randomly and look
 * really nice", "that shark is behind everything").
 *
 * Adapted from `vendor/ascii-sharks/world.ts` (ascii-sharks, MIT; its licence text is in that folder). Kept from it:
 * the Shark shape, the 20-node follow-the-leader spine and its 0.16 rad stiffness, the cruise speed, the wander term
 * and the rule that sharks give each other room. Changed:
 *
 *   - the engine patrols a circuit round the middle of the canvas and keeps out of an ellipse there (its headline);
 *     here each shark swims to a random point in the water, picks another when it gets there or after a while, and
 *     prefers the side it has turned to less lately, so it never settles into one-way laps;
 *   - no fish, so no hunting: no sprint to 3× cruise and no 86° a second snap turn behind the reader's text;
 *   - the turning circle is 0.4 body lengths (the engine's 0.22 curls a long shark into a C) and the turn rate
 *     eases in and out, so a turn starts and ends softly;
 *   - the edge is tested ahead of the snout, so a shark turns back before it leaves: a fin may dip past the frame,
 *     the shark never goes out of view;
 *   - speed breathes slowly around cruise and, now and then, surges for a couple of seconds.
 *
 * Nothing in `vendor/ascii-sharks/` is edited. Reads like the vendored World to the renderer: `sharks`, `fish` (empty),
 * `events` (empty), `pointer` (never active), `time`, `width`, `height`.
 */
import { angleDiff, clamp, rand, TAU } from "../../vendor/ascii-sharks/math";
import { SHARK_NODES, type Fish, type Shark, type SharkSpec, type WorldEvent } from "../../vendor/ascii-sharks/world";

/** The numbers Design gates (OPTIONS.md "Sharks"); change them there first. */
export const WANDER = {
  /** Largest shark's length as a share of the canvas's short side, and its px limits (the engine's own rule). */
  lengthShare: 0.44,
  lengthMin: 170,
  lengthMax: 430,
  /** Cruise in px/s for a shark L px long: the engine's `30 + 0.04 L`. */
  cruiseBase: 30,
  cruisePerPx: 0.04,
  /** Speed breathes between these multiples of cruise, drifting over about 8 s. */
  moodMin: 0.85,
  moodMax: 1.2,
  /** A surge: this multiple of cruise, for surgeSeconds, every surgeEvery seconds (each shark on its own clock). */
  surge: 1.7,
  surgeSeconds: [1.6, 2.6] as [number, number],
  surgeEvery: [18, 40] as [number, number],
  /** How fast speed follows its target (1/s); the engine's 1.1. */
  speedEase: 1.1,
  /** Fastest turn, rad/s (0.6 = 34° a second), and the tightest turning circle's radius in body lengths. The engine
   * uses 0.22, which curls a long shark into a C; 0.4 keeps the body in a shallow arc. */
  maxTurn: 0.6,
  turnRadius: 0.4,
  /** How fast the turn rate may change, 1/s: a turn takes about half a second to build. */
  turnEase: 2.2,
  /** A goal is a random point at least this share of the short side inside the canvas edge. */
  goalMargin: 0.1,
  /** Seconds a shark keeps a goal before it picks another, if it has not reached it. */
  goalSeconds: [7, 15] as [number, number],
  /** Reached: the snout is within this many body lengths of the goal. */
  goalReach: 0.3,
  /** Pull toward the goal, against 1 for momentum and 0.45 for the wander. */
  goalPull: 0.8,
  /** The wander: a random walk on an angle offset, as in the engine (rate 3.2 rad/s, limit ±1.1 rad, weight 0.45). */
  wanderRate: 3.2,
  wanderLimit: 1.1,
  wanderPull: 0.45,
  /** The edge band starts this many body lengths inside the frame; inside it the shark is pulled back to the middle,
   * at full strength once the tested point reaches the frame's edge. The band is tested at the snout and at a point
   * edgeAhead body lengths in front of it, so the turn starts early enough for the wide turning circle. */
  edgeBand: 0.15,
  edgeAhead: 0.7,
  edgePull: 6,
  /** How strongly a new goal is preferred on the side turned to less lately, in body lengths of score. */
  spinBalance: 1.5,
};

interface Course {
  goalX: number;
  goalY: number;
  goalUntil: number;
  mood: number;
  surgeAt: number;
  surgeUntil: number;
  turnRate: number;
  /** Which way it has been turning lately, -1 (all left) to 1 (all right), averaged over about 15 s. */
  spin: number;
}

export class WanderWorld {
  width = 0;
  height = 0;
  time = 0;
  sharks: Shark[] = [];
  /** No fish, no events and no pointer: the renderer's fish, "eat" and pointer-wake passes find nothing to draw. */
  readonly fish: Fish[] = [];
  readonly events: WorldEvent[] = [];
  readonly pointer = { x: 0, y: 0, active: false };
  private course = new Map<number, Course>();

  constructor(private sharkSpecs: SharkSpec[]) {}

  resize(width: number, height: number) {
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    if (first || this.sharks.length === 0) this.seed();
  }

  private seed() {
    const { width: W, height: H } = this;
    const base = clamp(Math.min(W, H) * WANDER.lengthShare, WANDER.lengthMin, WANDER.lengthMax);
    const count = this.sharkSpecs.length;
    this.sharks = [];
    this.course.clear();
    for (let i = 0; i < count; i++) {
      const { kind, size } = this.sharkSpecs[i];
      const length = base * size;
      // Spread along the long side, at random heights, each already swimming.
      const x = W * ((i + 0.5) / count) + rand(-0.08, 0.08) * W;
      const y = H * rand(0.25, 0.75);
      const heading = rand(0, TAU);
      const nodes = new Float32Array(SHARK_NODES * 2);
      const seg = length / (SHARK_NODES - 1);
      for (let n = 0; n < SHARK_NODES; n++) {
        nodes[n * 2] = x - Math.cos(heading) * seg * n;
        nodes[n * 2 + 1] = y - Math.sin(heading) * seg * n;
      }
      const shark: Shark = {
        id: i + 1, kind, length, nodes, heading, speed: WANDER.cruiseBase + length * WANDER.cruisePerPx, phase: rand(0, TAU), turn: 0,
        hunger: 0, wander: 0, orbitDir: 1, orbitRadius: 0, target: null, retargetAt: 0, depth: size,
      };
      this.sharks.push(shark);
      this.course.set(shark.id, { goalX: x, goalY: y, goalUntil: 0, mood: 1, surgeAt: rand(WANDER.surgeEvery[0], WANDER.surgeEvery[1]) * rand(0.3, 1), surgeUntil: 0, turnRate: 0, spin: 0 });
    }
    // Smaller (farther) sharks draw first so the big one swims over them, as in the engine.
    this.sharks.sort((a, b) => a.length - b.length);
  }

  /** A new goal: of four random points, the one farthest from this shark and from the others' snouts and goals, with
   * a preference for a point on the side it has turned to less lately, so it never settles into one-way laps. */
  private pickGoal(sh: Shark, c: Course) {
    const { width: W, height: H } = this;
    const m = Math.min(W, H) * WANDER.goalMargin;
    let best = -1;
    for (let k = 0; k < 4; k++) {
      const x = rand(m, W - m);
      const y = rand(m, H - m);
      let score = Math.min(Math.hypot(x - sh.nodes[0], y - sh.nodes[1]), sh.length * 2);
      const side = Math.sign(angleDiff(sh.heading, Math.atan2(y - sh.nodes[1], x - sh.nodes[0])));
      score -= side * c.spin * sh.length * WANDER.spinBalance;
      for (const other of this.sharks) {
        if (other === sh) continue;
        const oc = this.course.get(other.id);
        score += 0.5 * Math.min(Math.hypot(x - other.nodes[0], y - other.nodes[1]), other.length);
        if (oc) score += 0.5 * Math.min(Math.hypot(x - oc.goalX, y - oc.goalY), other.length);
      }
      if (score > best) {
        best = score;
        c.goalX = x;
        c.goalY = y;
      }
    }
    c.goalUntil = this.time + rand(WANDER.goalSeconds[0], WANDER.goalSeconds[1]);
  }

  step(dt: number) {
    this.time += dt;
    const { sharks, width: W, height: H, time } = this;
    for (const sh of sharks) {
      const c = this.course.get(sh.id);
      if (!c) continue;
      const L = sh.length;
      const nodes = sh.nodes;
      const hx = nodes[0];
      const hy = nodes[1];

      if (time >= c.goalUntil || Math.hypot(c.goalX - hx, c.goalY - hy) < L * WANDER.goalReach) this.pickGoal(sh, c);

      // Momentum, the engine's wander, and the pull of the goal.
      let dx = Math.cos(sh.heading);
      let dy = Math.sin(sh.heading);
      sh.wander = clamp(sh.wander + (Math.random() - 0.5) * dt * WANDER.wanderRate, -WANDER.wanderLimit, WANDER.wanderLimit);
      dx += Math.cos(sh.heading + sh.wander) * WANDER.wanderPull;
      dy += Math.sin(sh.heading + sh.wander) * WANDER.wanderPull;
      const gx = c.goalX - hx;
      const gy = c.goalY - hy;
      const gd = Math.hypot(gx, gy) || 1;
      dx += (gx / gd) * WANDER.goalPull;
      dy += (gy / gd) * WANDER.goalPull;

      // How far into the edge band the snout, or the water just ahead of it, is: 0 well inside, 1 at the frame's edge.
      const ax = hx + Math.cos(sh.heading) * L * WANDER.edgeAhead;
      const ay = hy + Math.sin(sh.heading) * L * WANDER.edgeAhead;
      const over = Math.max(-hx, hx - W, -hy, hy - H, -ax, ax - W, -ay, ay - H);
      const edge = clamp((over + L * WANDER.edgeBand) / (L * WANDER.edgeBand), 0, 1);

      // Give other sharks room (the engine's rule), but never by leaving: the push fades inside the edge band.
      for (const other of sharks) {
        if (other === sh) continue;
        for (let k = 0; k < SHARK_NODES; k += 4) {
          const ox = hx - other.nodes[k * 2];
          const oy = hy - other.nodes[k * 2 + 1];
          const d = Math.hypot(ox, oy);
          const range = (L + other.length) * 0.45;
          if (d < range && d > 1e-3) {
            const w = (1 - d / range) * 3 * (1 - edge);
            dx += (ox / d) * w;
            dy += (oy / d) * w;
          }
        }
      }

      // Turn back toward the middle inside the edge band: a body may dip past the edge, never leave.
      if (edge > 0) {
        const toX = W / 2 - hx;
        const toY = H / 2 - hy;
        const d = Math.hypot(toX, toY) || 1;
        dx += (toX / d) * edge * WANDER.edgePull;
        dy += (toY / d) * edge * WANDER.edgePull;
      }

      // The turn: toward the wanted heading, never faster than maxTurn, and the rate itself eases.
      const agility = Math.min(WANDER.maxTurn, sh.speed / (L * WANDER.turnRadius));
      const wanted = clamp(angleDiff(sh.heading, Math.atan2(dy, dx)) / 0.9, -agility, agility);
      c.turnRate += (wanted - c.turnRate) * Math.min(1, dt * WANDER.turnEase);
      c.spin += (clamp(c.turnRate / agility, -1, 1) - c.spin) * Math.min(1, dt / 15);
      sh.heading += c.turnRate * dt;
      sh.turn += (c.turnRate - sh.turn) * Math.min(1, dt * 3);

      // Speed: cruise, breathing, and now and then a surge.
      c.mood = clamp(c.mood + (Math.random() - 0.5) * dt * 0.35, WANDER.moodMin, WANDER.moodMax);
      if (time >= c.surgeAt) {
        c.surgeUntil = time + rand(WANDER.surgeSeconds[0], WANDER.surgeSeconds[1]);
        c.surgeAt = time + rand(WANDER.surgeEvery[0], WANDER.surgeEvery[1]);
      }
      const cruise = WANDER.cruiseBase + L * WANDER.cruisePerPx;
      const target = cruise * (time < c.surgeUntil ? WANDER.surge : c.mood);
      sh.speed += (target - sh.speed) * Math.min(1, dt * WANDER.speedEase);
      sh.phase += dt * (2 + sh.speed / 24);

      nodes[0] += Math.cos(sh.heading) * sh.speed * dt;
      nodes[1] += Math.sin(sh.heading) * sh.speed * dt;

      // Follow-the-leader spine with the engine's stiffness limit per joint.
      const seg = L / (SHARK_NODES - 1);
      let prevAngle = sh.heading + Math.PI;
      for (let k = 1; k < SHARK_NODES; k++) {
        const px = nodes[(k - 1) * 2];
        const py = nodes[(k - 1) * 2 + 1];
        let angle = Math.atan2(nodes[k * 2 + 1] - py, nodes[k * 2] - px);
        angle = prevAngle + clamp(angleDiff(prevAngle, angle), -0.16, 0.16);
        nodes[k * 2] = px + Math.cos(angle) * seg;
        nodes[k * 2 + 1] = py + Math.sin(angle) * seg;
        prevAngle = angle;
      }
    }
  }
}
