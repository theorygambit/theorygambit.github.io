/**
 * The Theory Gambit hero: "The Approach". No figure, only geometry and physics.
 *
 * A downward triangle (the old alchemical sign for water and the feminine) is the still,
 * angular body. A hairline thread, a real Verlet rope, is the soft body that circles it,
 * leans in, hesitates, and slides along its edges holding a gap of a few pixels, never quite
 * touching. Everything seductive here is tension kept short of release:
 *
 *   - proximity without contact: the gap is a physical collision margin, and the nearest edge
 *     brightens in proportion to how small the gap is
 *   - push and pull: the thread's approach is a slow cycle with long dwells at both ends
 *   - lag and follow-through: the triangle turns to face you, and its echoes trail behind
 *     it like silk, each a little later than the last
 *   - mutual influence: the thread pushes the triangle too, so it shivers when brushed
 *   - breath and pulse: a slow breath always, a heartbeat that rises while you hold
 *   - an opening: each ring has a gap, and the gaps turn to open toward you
 *   - ripples: a touch sends a wave outward; where it crosses a ring a node of light appears
 *
 * It is a game theory app, so it plays back. Touch or hover and the thread leaves the
 * triangle to circle your fingertip, a few pixels off, and the triangle turns to look.
 * Hold and everything draws closer. Release and it all unwinds, slowly.
 *
 * Brand: Abyssal Liturgy. Void ground, Bone ink, one hairline, square geometry, one soft
 * light from above, motion that is damped and never bounces. No imports, so the home hero
 * (HeroRenderer.ts) and the promo banner (tools/make-banner.mjs) share this exact code.
 */

export type RGB = readonly [number, number, number];

export interface SceneOptions {
  /** Bone in dark mode, Void in light mode. */
  ink: RGB;
  /** Ground colour, used for the fade into the page and, when opaque, the fill. */
  ground: string;
  /** Fill the canvas with ground first (banner). The live hero stays transparent. */
  opaque?: boolean;
  /** Banner only: small mono caption at the lower left. */
  caption?: string;
  /** Draw the wordmark and subtitle. Default true. */
  text?: boolean;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
const smooth = (v: number): number => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
const easeOut = (v: number): number => 1 - Math.pow(1 - clamp(v), 3);
const seg = (t: number, t0: number, d: number): number => easeOut((t - t0) / d);
const wrap = (a: number): number => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** Exponential approach that does not depend on frame rate. Never overshoots. */
const follow = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * (1 - Math.exp(-rate * dt));

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Pt = readonly [number, number];

interface Strand {
  n: number;
  x: Float32Array;
  y: Float32Array;
  /** Where the head has been, newest first. The body follows this path. */
  trail: { x: number; y: number }[];
  phase: number;
  dir: number;
  /** Angle of the orbit goal, advanced a little slower the nearer the thread is. */
  ang: number;
  hx: number;
  hy: number;
  hvx: number;
  hvy: number;
  /** Nearest approach to the triangle, refreshed each step. */
  near: { d: number; x: number; y: number; edge: number; s: number };
  /** The glint: where it is on the triangle's outline (0 to 3, wrapping) and how bright. Both glide. */
  gp: number;
  gi: number;
}

interface Ripple {
  x: number;
  y: number;
  t0: number;
  power: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  sz: number;
}

const ECHO_SCALE = [1, 0.8, 0.62, 0.46, 0.32];
const ECHO_ALPHA = [1, 0.5, 0.34, 0.22, 0.14];
const ECHO_RATE = [Infinity, 4.2, 2.7, 1.8, 1.2];
const RING_K = [0.37, 0.52, 0.68, 0.84, 1];

export class HeroScene {
  t = 0;
  w = 0;
  h = 0;
  dpr = 1;
  private ink: RGB;
  private ground: string;
  private readonly opaque: boolean;
  private readonly caption: string | undefined;
  private readonly showText: boolean;

  // layout
  private wide = false;
  private u = 1;
  private cx = 0;
  private cy = 0;
  private Rt = 32;
  private lw = 1;

  // body
  private theta = 0;
  private omega = 0;
  private thetaTarget = 0;
  private scale = 1;
  private scaleV = 0;
  private readonly echo = [0, 0, 0, 0, 0];
  private readonly gapC = [0, 0, 0, 0, 0];
  private torque = 0;

  // pointer
  private active = false;
  private down = false;
  private tx = 0;
  private ty = 0;
  private sx = 0;
  private sy = 0;
  private pm = 0;
  /** Arousal: 0 idle, rises while touched, settles slowly after. */
  private A = 0;
  private lastBeat = -9;
  private nextInvite = 5;

  private readonly strands: Strand[] = [];
  private readonly ripples: Ripple[] = [];
  private readonly motes: Mote[] = [];
  private acc = 0;

  constructor(o: SceneOptions) {
    this.ink = o.ink;
    this.ground = o.ground;
    this.opaque = !!o.opaque;
    this.caption = o.caption;
    this.showText = o.text !== false;
    for (let k = 0; k < 3; k++) this.strands.push(this.makeStrand(k));
    const r = rng(5);
    for (let i = 0; i < 30; i++) this.motes.push({ x: r(), y: r(), vx: 0, vy: 0, ph: r() * TAU, sz: 0.5 + r() * 0.9 });
  }

  setColors(ink: RGB, ground: string): void {
    this.ink = ink;
    this.ground = ground;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.wide = w / h > 1.25;
    if (this.wide) {
      this.u = (h / 372) * 0.98;
      this.cx = w * 0.64;
      this.cy = h * 0.5;
    } else {
      this.u = Math.min(w / 390, h / 372);
      this.cx = w / 2;
      this.cy = 160 * this.u + Math.max(0, (h - 372 * this.u) * 0.2);
    }
    this.Rt = (this.wide ? 38 : 32) * this.u;
    this.lw = Math.max(1 / dpr, 1 / dpr) * (this.wide ? Math.max(1, this.u * 0.7) : 1);
    for (const s of this.strands) this.reseed(s);
  }

  // ---- Input -----------------------------------------------------------------------------

  /** Pointer inside the hero. `down` is true while a finger or button is held. Pass null when it leaves. */
  pointer(x: number | null, y = 0, down = false): void {
    if (x === null) {
      this.active = false;
      this.down = false;
      return;
    }
    if (!this.active) {
      this.sx = x;
      this.sy = y;
    }
    this.active = true;
    this.tx = x;
    this.ty = y;
    this.down = down;
  }

  /** A press: a ripple from the fingertip and a small start in the triangle. */
  press(x: number, y: number): void {
    this.pointer(x, y, true);
    this.ripples.push({ x, y, t0: this.t, power: 1 });
    this.scaleV -= 0.5;
    if (this.ripples.length > 7) this.ripples.shift();
  }

  // ---- Simulation ------------------------------------------------------------------------

  private makeStrand(k: number): Strand {
    const n = 44;
    return {
      n,
      x: new Float32Array(n),
      y: new Float32Array(n),
      trail: [],
      phase: k * 2.1 + 0.4,
      dir: k % 2 ? -1 : 1,
      ang: k * 2.1 + 0.4,
      hx: 0,
      hy: 0,
      hvx: 0,
      hvy: 0,
      near: { d: 1e9, x: 0, y: 0, edge: 0, s: 0 },
      gp: 0,
      gi: 0,
    };
  }

  /** Lay a strand out along a far arc so it sweeps in on arrival. */
  private reseed(s: Strand): void {
    const R = this.Rt * 5.2;
    const step = this.Rt * 0.08;
    s.trail = [];
    for (let i = 0; i < 160; i++) {
      const a = s.phase + (s.dir * i * step) / R;
      s.trail.push({ x: this.cx + Math.cos(a) * R, y: this.cy + Math.sin(a) * R * 0.86 });
    }
    s.hx = s.trail[0]!.x;
    s.hy = s.trail[0]!.y;
    s.hvx = s.hvy = 0;
    s.ang = s.phase;
    for (let i = 0; i < s.n; i++) {
      s.x[i] = s.trail[Math.min(i * 3, 159)]!.x;
      s.y[i] = s.trail[Math.min(i * 3, 159)]!.y;
    }
  }

  /** Triangle vertices, pointing down at theta = 0. */
  private verts(scale = 1, th = this.theta): [number, number][] {
    const out: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      const a = th + Math.PI / 2 + (k * TAU) / 3;
      out.push([this.cx + Math.cos(a) * this.Rt * scale * this.scale, this.cy + Math.sin(a) * this.Rt * scale * this.scale]);
    }
    return out;
  }

  /** Signed distance to the triangle (negative inside), with the closest point and its edge. */
  private sdf(px: number, py: number, v: [number, number][]): { d: number; cx: number; cy: number; edge: number; s: number } {
    let best = 1e9;
    let bx = 0;
    let by = 0;
    let be = 0;
    let bs = 0;
    for (let e = 0; e < 3; e++) {
      const a = v[e]!;
      const b = v[(e + 1) % 3]!;
      const abx = b[0] - a[0];
      const aby = b[1] - a[1];
      const s = clamp(((px - a[0]) * abx + (py - a[1]) * aby) / (abx * abx + aby * aby));
      const qx = a[0] + abx * s;
      const qy = a[1] + aby * s;
      const d = Math.hypot(px - qx, py - qy);
      if (d < best) {
        best = d;
        bx = qx;
        by = qy;
        be = e;
        bs = s;
      }
    }
    // inside test by consistent cross sign
    let inside = true;
    let sign = 0;
    for (let e = 0; e < 3; e++) {
      const a = v[e]!;
      const b = v[(e + 1) % 3]!;
      const c = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
      if (sign === 0) sign = Math.sign(c);
      else if (Math.sign(c) !== sign && c !== 0) inside = false;
    }
    return { d: inside ? -best : best, cx: bx, cy: by, edge: be, s: bs };
  }

  step(dt: number): void {
    // fixed sub-steps keep the rope stable whatever the frame rate
    this.acc += Math.min(dt, 0.05);
    const h = 1 / 120;
    while (this.acc >= h) {
      this.acc -= h;
      this.tick(h);
    }
  }

  private tick(dt: number): void {
    this.t += dt;
    const t = this.t;
    const u = this.u;

    // arousal and pointer smoothing
    const wantA = this.down ? 1 : this.active ? 0.3 : 0;
    this.A = follow(this.A, wantA, wantA > this.A ? 1.1 : 0.55, dt);
    this.pm = follow(this.pm, this.active ? 1 : 0, this.active ? 1.5 : 0.7, dt);
    this.sx = follow(this.sx, this.tx, 7, dt);
    this.sy = follow(this.sy, this.ty, 7, dt);
    const A = this.A;
    const breathHz = 0.2 + 0.2 * A;
    const breath = Math.sin(t * TAU * breathHz);

    // the heartbeat while held: two soft beats, then rest
    if (A > 0.45) {
      const period = lerp(1.15, 0.85, A);
      if (t - this.lastBeat > period) {
        this.lastBeat = t;
        this.scaleV += 0.16 * A;
      }
    }
    // an invitation while nobody is touching: a faint wave from the triangle
    if (!this.active && t > this.nextInvite) {
      this.nextInvite = t + 6.5;
      this.ripples.push({ x: this.cx, y: this.cy, t0: t, power: 0.4 });
    }
    while (this.ripples.length && t - this.ripples[0]!.t0 > 4.5) this.ripples.shift();

    // triangle: turn so the nearest vertex faces the pointer, otherwise drift very slowly
    if (this.pm > 0.02) {
      const ang = Math.atan2(this.sy - this.cy, this.sx - this.cx);
      let bd = 9;
      for (let k = 0; k < 3; k++) {
        const d = wrap(ang - (Math.PI / 2 + (k * TAU) / 3) - this.theta);
        if (Math.abs(d) < Math.abs(bd)) {
          bd = d;
        }
      }
      const faced = this.theta + bd;
      this.thetaTarget = lerp(0.1 * Math.sin(t * 0.21), faced, this.pm);
    } else this.thetaTarget = 0.1 * Math.sin(t * 0.21) + 0.04 * Math.sin(t * 0.47);
    const kap = 7;
    this.omega += (kap * wrap(this.thetaTarget - this.theta) - 2 * Math.sqrt(kap) * this.omega + clamp(this.torque, -1, 1) * 60) * dt;
    this.theta += this.omega * dt;
    this.torque = 0;
    // scale spring (breath + heartbeat + press), critically damped
    const ks = 70;
    const sTarget = 1 + 0.012 * breath - 0.03 * A;
    this.scaleV += (ks * (sTarget - this.scale) - 2 * Math.sqrt(ks) * this.scaleV) * dt;
    this.scale += this.scaleV * dt;
    // echoes: each follows the one before, a little later
    for (let k = 0; k < 5; k++) {
      this.echo[k] = k === 0 ? this.theta : this.echo[k]! + wrap(this.echo[k - 1]! - this.echo[k]!) * (1 - Math.exp(-ECHO_RATE[k]! * dt));
    }
    // ring gaps turn to open toward you; idle they drift
    const toward = Math.atan2(this.sy - this.cy, this.sx - this.cx);
    for (let i = 0; i < 5; i++) {
      const idle = this.gapC[i]! + dt * (0.1 + 0.035 * i) * (i % 2 ? -1 : 1);
      const want = this.pm > 0.05 ? this.gapC[i]! + wrap(toward - this.gapC[i]!) * (1 - Math.exp(-(1.2 + i * 0.35) * dt)) : idle;
      this.gapC[i] = lerp(idle, want, this.pm);
    }

    const v = this.verts();
    const gap = (7 - 4.8 * A) * u + 0.7 * u * breath;
    const Rfar = this.Rt * (3.3 + 0.2 * Math.sin(t * 0.31));
    const Rnear = this.Rt * 0.6;

    for (const s of this.strands) {
      // the approach: a slow cycle with long dwells, far then near then far
      const cyc = 0.5 - 0.5 * Math.cos(TAU * (t / 15 + s.phase * 0.31));
      const near = smooth((cyc - 0.18) / 0.3);
      const R = lerp(Rfar, Rnear, near) * (1 - 0.22 * A);
      s.ang += dt * s.dir * (0.52 - 0.32 * near);
      const phi = s.ang + 0.35 * Math.sin(t * 0.17 + s.phase);
      const ix = this.cx + Math.cos(phi) * R;
      const iy = this.cy + Math.sin(phi) * R * 0.86;
      // when touched, circle the fingertip a few pixels off, slowly
      const rho = lerp(30, 17, A) * u;
      const psi = s.phase * 2 + t * 1.15 * s.dir;
      const fx = this.sx + Math.cos(psi) * rho;
      const fy = this.sy + Math.sin(psi) * rho;
      const m = smooth(this.pm);
      const gx = lerp(ix, fx, m);
      const gy = lerp(iy, fy, m);
      // head: critically damped spring toward the goal, lazy on purpose
      const w0 = 2.4 + 1.6 * m;
      s.hvx += (w0 * w0 * (gx - s.hx) - 2 * w0 * s.hvx) * dt;
      s.hvy += (w0 * w0 * (gy - s.hy) - 2 * w0 * s.hvy) * dt;
      s.hx += s.hvx * dt;
      s.hy += s.hvy * dt;
      let q = this.sdf(s.hx, s.hy, v);
      if (q.d < gap) {
        const nx = q.d < 0 ? q.cx - s.hx : s.hx - q.cx;
        const ny = q.d < 0 ? q.cy - s.hy : s.hy - q.cy;
        const nl = Math.hypot(nx, ny) || 1;
        const push = gap - q.d;
        s.hx += (nx / nl) * push;
        s.hy += (ny / nl) * push;
        s.hvx *= 0.7;
        s.hvy *= 0.7;
      }
      s.x[0] = s.hx;
      s.y[0] = s.hy;

      // The body follows the path the head has taken, like silk drawn through water, with a
      // slow wave running down it. Then it is kept off the triangle by the gap.
      const tr = s.trail;
      const last = tr[0]!;
      if (Math.hypot(s.hx - last.x, s.hy - last.y) > 0.6 * u) {
        tr.unshift({ x: s.hx, y: s.hy });
        if (tr.length > 260) tr.pop();
      } else {
        last.x = s.hx;
        last.y = s.hy;
      }
      const L = this.Rt * 0.1;
      let ti = 0;
      let carried = 0;
      s.x[0] = s.hx;
      s.y[0] = s.hy;
      let ax = s.hx;
      let ay = s.hy;
      for (let i = 1; i < s.n; i++) {
        let need = L;
        while (ti < tr.length && need > 0) {
          const p = tr[ti]!;
          const d = Math.hypot(p.x - ax, p.y - ay);
          if (d <= need) {
            need -= d;
            ax = p.x;
            ay = p.y;
            ti++;
          } else {
            ax += ((p.x - ax) / d) * need;
            ay += ((p.y - ay) / d) * need;
            need = 0;
          }
        }
        carried += L;
        s.x[i] = ax;
        s.y[i] = ay;
      }
      // silk wave, growing toward the tail
      for (let i = 1; i < s.n - 1; i++) {
        const nx = s.y[i + 1]! - s.y[i - 1]!;
        const ny = -(s.x[i + 1]! - s.x[i - 1]!);
        const nl = Math.hypot(nx, ny) || 1;
        const f = i / s.n;
        const a = 3.4 * u * Math.pow(f, 1.3) * Math.sin(i * 0.21 - t * 1.5 + s.phase) * (0.55 + 0.45 * Math.sin(t * 0.37 + s.phase));
        s.x[i] = s.x[i]! + (nx / nl) * a;
        s.y[i] = s.y[i]! + (ny / nl) * a;
      }
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 1; i < s.n; i++) {
          q = this.sdf(s.x[i]!, s.y[i]!, v);
          if (q.d < gap) {
            const nx = q.d < 0 ? q.cx - s.x[i]! : s.x[i]! - q.cx;
            const ny = q.d < 0 ? q.cy - s.y[i]! : s.y[i]! - q.cy;
            const nl = Math.hypot(nx, ny) || 1;
            const push = gap - q.d;
            s.x[i] = s.x[i]! + (nx / nl) * push;
            s.y[i] = s.y[i]! + (ny / nl) * push;
            if (pass === 0) {
              // equal and opposite: the thread presses the triangle and turns it
              const rx = q.cx - this.cx;
              const ry = q.cy - this.cy;
              this.torque += ((rx * (-ny / nl) - ry * (-nx / nl)) * push * 0.00003) / u;
            }
          }
        }
        for (let i = 1; i < s.n - 1; i++) {
          s.x[i] = lerp(s.x[i]!, (s.x[i - 1]! + s.x[i + 1]!) * 0.5, 0.5);
          s.y[i] = lerp(s.y[i]!, (s.y[i - 1]! + s.y[i + 1]!) * 0.5, 0.5);
        }
      }
      void carried;
      // nearest approach, for the light
      let bd = 1e9;
      for (let i = 0; i < s.n; i += 1) {
        const r = this.sdf(s.x[i]!, s.y[i]!, v);
        if (r.d < bd) {
          bd = r.d;
          s.near = { d: r.d, x: r.cx, y: r.cy, edge: r.edge, s: r.s };
        }
      }
      // The glint never jumps. Its brightness rises and falls on its own clock, and while it is
      // visible it slides along the outline toward the nearest spot; it only relocates unseen.
      const pt = s.near.edge + s.near.s;
      const pp = Math.exp(-Math.max(0, s.near.d - gap) / (16 * u));
      const off = (((pt - s.gp + 1.5) % 3) + 3) % 3 - 1.5;
      // if the nearest spot has run far from the glint, let it fade where it is instead of chasing
      const want = pp * pp * smooth(this.t / 3) * (1 - smooth((Math.abs(off) - 0.1) / 0.3));
      s.gi = follow(s.gi, want, want > s.gi ? 0.9 : 0.8, dt);
      if (s.gi < 0.03) s.gp = pt;
      else {
        // a gentle glide, never faster than about 25 pixels a second
        const step = clamp(off * (1 - Math.exp(-1.4 * dt)), -0.45 * dt, 0.45 * dt);
        s.gp = (((s.gp + step) % 3) + 3) % 3;
      }
    }

    // motes drift, drawn faintly toward the thread head or the fingertip
    const r = rng(Math.floor(t * 4) + 11);
    for (const m of this.motes) {
      const mx = m.x * this.w;
      const my = m.y * this.h;
      const ax = (this.pm > 0.1 ? this.sx : this.strands[0]!.hx) - mx;
      const ay = (this.pm > 0.1 ? this.sy : this.strands[0]!.hy) - my;
      const dl = Math.hypot(ax, ay) || 1;
      const pull = (0.4 + 3 * A) * u * Math.min(1, 90 / dl);
      m.vx = m.vx * 0.985 + ((r() - 0.5) * 0.9 + (ax / dl) * pull * 0.05) * dt * 20;
      m.vy = m.vy * 0.985 + ((r() - 0.5) * 0.9 - 0.05 + (ay / dl) * pull * 0.05) * dt * 20;
      m.x += (m.vx * dt) / Math.max(1, this.w) * 6;
      m.y += (m.vy * dt) / Math.max(1, this.h) * 6;
      if (m.x < -0.05 || m.x > 1.05 || m.y < -0.05 || m.y > 1.05) {
        m.x = r();
        m.y = r();
        m.vx = m.vy = 0;
      }
    }
  }

  // ---- Drawing ---------------------------------------------------------------------------

  private c(a: number): string {
    return `rgba(${this.ink[0]},${this.ink[1]},${this.ink[2]},${clamp(a).toFixed(3)})`;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { w, h, t, u } = this;
    const lw = this.lw;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    if (this.opaque) {
      ctx.fillStyle = this.ground;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const A = this.A;
    const breath = Math.sin(t * TAU * (0.2 + 0.2 * A));

    // one soft light from above
    {
      const g = ctx.createRadialGradient(this.cx, -h * 0.15, 0, this.cx, -h * 0.15, h * 1.25);
      g.addColorStop(0, this.c(0.085 + 0.02 * breath + 0.04 * A));
      g.addColorStop(1, this.c(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // ripples: a wave from the touch, with nodes of light where it crosses each ring
    const rings = RING_K.map((k) => k * 150 * u);
    const offs = rings.map((_, i) => {
      const k = 0.02 + i * 0.012;
      const dx = this.sx - this.cx;
      const dy = this.sy - this.cy;
      const dl = Math.hypot(dx, dy) || 1;
      const mag = Math.min(dl, 220 * u) * k * this.pm;
      return [(dx / dl) * mag, (dy / dl) * mag] as const;
    });
    for (const rp of this.ripples) {
      const age = t - rp.t0;
      const r = age * 150 * u;
      const al = rp.power * Math.exp(-age * 0.9) * clamp(1 - r / (330 * u));
      if (al < 0.01) continue;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, r, 0, TAU);
      ctx.strokeStyle = this.c(al * 0.55);
      ctx.lineWidth = lw;
      ctx.stroke();
      rings.forEach((R, i) => {
        const ox = this.cx + offs[i]![0];
        const oy = this.cy + offs[i]![1];
        const dx = ox - rp.x;
        const dy = oy - rp.y;
        const d = Math.hypot(dx, dy);
        if (d < 1e-3 || d > r + R || d < Math.abs(r - R)) return;
        const a = (r * r - R * R + d * d) / (2 * d);
        const hh = Math.sqrt(Math.max(0, r * r - a * a));
        const mx = rp.x + (dx * a) / d;
        const my = rp.y + (dy * a) / d;
        for (const sg of [-1, 1]) {
          const nx = mx + (sg * hh * -dy) / d;
          const ny = my + (sg * hh * dx) / d;
          const gr = ctx.createRadialGradient(nx, ny, 0, nx, ny, 9 * u);
          gr.addColorStop(0, this.c(al * 0.9));
          gr.addColorStop(1, this.c(0));
          ctx.fillStyle = gr;
          ctx.fillRect(nx - 10 * u, ny - 10 * u, 20 * u, 20 * u);
        }
      });
    }

    // rings: the brand mark, opened. The gaps turn toward you.
    rings.forEach((R, i) => {
      const k = i / 4;
      const rin = seg(t, 0.2 + i * 0.28, 1.7);
      const gw = 0.5 + 0.3 * A + 0.05 * Math.sin(t * 0.4 + i);
      const a0 = this.gapC[i]! + gw / 2;
      const a1 = this.gapC[i]! + TAU - gw / 2;
      const rr = R * (1 + 0.006 * breath * (1 + k)) * (1 - 0.03 * A * (1 - k));
      ctx.beginPath();
      ctx.arc(this.cx + offs[i]![0], this.cy + offs[i]![1], rr, a0, a0 + (a1 - a0) * rin);
      ctx.strokeStyle = this.c((0.9 - k * 0.55) * rin);
      ctx.lineWidth = lw;
      ctx.stroke();
    });

    // the triangle and its echoes
    const intro = seg(t, 0.5, 1.8);
    for (let k = 4; k >= 0; k--) {
      const v = this.verts(ECHO_SCALE[k]!, this.echo[k]! + (k ? 0.035 * k * breath : 0));
      const a = ECHO_ALPHA[k]! * intro;
      ctx.beginPath();
      ctx.moveTo(v[0]![0], v[0]![1]);
      ctx.lineTo(v[1]![0], v[1]![1]);
      ctx.lineTo(v[2]![0], v[2]![1]);
      ctx.closePath();
      if (k === 0) {
        const g = ctx.createLinearGradient(0, this.cy - this.Rt, 0, this.cy + this.Rt);
        g.addColorStop(0, this.c(0.12 * intro));
        g.addColorStop(1, this.c(0.01 * intro));
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.strokeStyle = this.c((k === 0 ? 0.62 : 0.8) * a);
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // edge light: where the thread nearly touches, the outline warms. It glides, never jumps.
    const v0 = this.verts();
    const onOutline = (ps: number): [number, number] => {
      const e = Math.floor(ps) % 3;
      const f = ps - Math.floor(ps);
      const a = v0[e]!;
      const b = v0[(e + 1) % 3]!;
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
    };
    for (const s of this.strands) {
      if (s.gi < 0.01) continue;
      const span = 0.3;
      const N = 20;
      for (let k = 0; k < N; k++) {
        const d0 = -span + (2 * span * k) / N;
        const d1 = -span + (2 * span * (k + 1)) / N;
        const fall = Math.pow(Math.cos(((d0 + d1) / 2 / span) * Math.PI * 0.5), 2);
        const a = onOutline((((s.gp + d0) % 3) + 3) % 3);
        const b = onOutline((((s.gp + d1) % 3) + 3) % 3);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.strokeStyle = this.c(0.9 * s.gi * fall);
        ctx.lineWidth = lw * 2;
        ctx.stroke();
      }
    }

    // threads: three strands, bright at the head, fading to nothing at the tail
    const tin = seg(t, 1.1, 1.6);
    this.strands.forEach((s, si) => {
      // smooth the polyline (Catmull-Rom), then draw it in many short pieces that thin and fade
      const pts: Pt[] = [];
      for (let k = 0; k < s.n - 1; k++) {
        const p0 = k ? k - 1 : 0;
        const p3 = k + 2 < s.n ? k + 2 : s.n - 1;
        for (let m = 0; m < 3; m++) {
          const q = m / 3;
          const q2 = q * q;
          const q3 = q2 * q;
          const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * q + (2 * a - 5 * b + 4 * c - d) * q2 + (-a + 3 * b - 3 * c + d) * q3);
          pts.push([cr(s.x[p0]!, s.x[k]!, s.x[k + 1]!, s.x[p3]!), cr(s.y[p0]!, s.y[k]!, s.y[k + 1]!, s.y[p3]!)]);
        }
      }
      pts.push([s.x[s.n - 1]!, s.y[s.n - 1]!]);
      const chunks = 30;
      const per = (pts.length - 1) / chunks;
      ctx.lineCap = "butt";
      for (let c = 0; c < chunks; c++) {
        const i0 = Math.floor(c * per);
        const i1 = Math.min(pts.length - 1, Math.floor((c + 1) * per) + 1);
        const f = (c + 0.5) / chunks;
        ctx.beginPath();
        ctx.moveTo(pts[i0]![0], pts[i0]![1]);
        for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
        const fade = Math.pow(1 - f, 1.6);
        ctx.strokeStyle = this.c(fade * (si === 0 ? 0.95 : 0.6 - si * 0.1) * tin);
        ctx.lineWidth = lw * (si === 0 ? 1.6 : 1.2) * (1 - 0.55 * f);
        ctx.stroke();
      }
      ctx.lineCap = "round";
      // the head: a small bright point
      ctx.beginPath();
      ctx.arc(s.x[0]!, s.y[0]!, (si === 0 ? 1.8 : 1.2) * Math.max(1, u * 0.8), 0, TAU);
      ctx.fillStyle = this.c(0.95 * tin);
      ctx.fill();
    });

    // the near-touch: a soft bloom and a four point glint that swell and fade with the gap
    for (const st of this.strands) {
      if (st.gi < 0.01) continue;
      const [gx, gy] = onOutline(st.gp);
      const R = (6 + 10 * st.gi) * u;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, R);
      g.addColorStop(0, this.c(0.34 * st.gi));
      g.addColorStop(1, this.c(0));
      ctx.fillStyle = g;
      ctx.fillRect(gx - R, gy - R, R * 2, R * 2);
      const r = (1.5 + 5.5 * st.gi) * u * st.gi;
      if (r > 0.3) {
        ctx.beginPath();
        ctx.moveTo(gx, gy - r);
        ctx.quadraticCurveTo(gx, gy, gx + r, gy);
        ctx.quadraticCurveTo(gx, gy, gx, gy + r);
        ctx.quadraticCurveTo(gx, gy, gx - r, gy);
        ctx.quadraticCurveTo(gx, gy, gx, gy - r);
        ctx.fillStyle = this.c(0.95 * st.gi);
        ctx.fill();
      }
    }

    // motes
    for (const m of this.motes) {
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + m.sz * 0.5) + m.ph);
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.sz * Math.max(0.8, u * 0.7), 0, TAU);
      ctx.fillStyle = this.c((0.12 + 0.4 * tw) * seg(t, 1.5, 1.5));
      ctx.fill();
    }

    // fade into the page along the lower edge
    if (!this.opaque) {
      const b = ctx.createLinearGradient(0, h * 0.9, 0, h);
      b.addColorStop(0, "rgba(0,0,0,0)");
      b.addColorStop(1, this.ground);
      ctx.fillStyle = b;
      ctx.fillRect(0, h * 0.9, w, h * 0.1 + 1);
    }

    if (this.showText) this.drawText(ctx);
    ctx.restore();
  }

  private drawText(ctx: CanvasRenderingContext2D): void {
    const { w, h, t } = this;
    const ti = seg(t, 1.8, 1.5);
    const si = seg(t, 2.6, 1.4);
    const serif = (px: number) => `italic 300 ${px}px "Cormorant Garamond", "EB Garamond", Georgia, serif`;
    const mono = (px: number) => `400 ${px}px "JetBrains Mono", ui-monospace, monospace`;
    const body = (px: number) => `300 ${px}px "Jost", system-ui, sans-serif`;
    ctx.textBaseline = "alphabetic";
    if (this.wide) {
      const fs = h * 0.19;
      const x = w * 0.075;
      ctx.textAlign = "left";
      ctx.font = serif(fs);
      ctx.fillStyle = this.c(0.96 * ti);
      ctx.fillText("Theory", x, h * 0.5 + (1 - ti) * 10);
      ctx.fillText("Gambit", x - fs * 0.02, h * 0.5 + fs * 0.92 + (1 - ti) * 10);
      ctx.fillStyle = this.c(0.4 * si);
      ctx.fillRect(x, h * 0.5 + fs * 1.18, w * 0.27 * si, 1);
      ctx.font = mono(h * 0.017);
      ctx.fillStyle = this.c(0.6 * si);
      ctx.fillText("F E E L   /   S E E   /   P R O V E", x, h * 0.5 + fs * 1.18 + h * 0.04);
      if (this.caption) {
        ctx.font = mono(h * 0.014);
        ctx.fillStyle = this.c(0.5 * si);
        ctx.fillText(this.caption, w * 0.04, h * 0.955);
      }
      ctx.textAlign = "right";
      ctx.font = mono(h * 0.014);
      ctx.fillStyle = this.c(0.5 * si);
      ctx.fillText("(3, 3)  (0, 5)", w * 0.965, h * 0.07);
      ctx.fillText("(5, 0)  (1, 1)", w * 0.965, h * 0.095);
    } else {
      ctx.textAlign = "center";
      ctx.font = serif(40);
      ctx.fillStyle = this.c(0.97 * ti);
      ctx.fillText("Theory Gambit", w / 2, h - 40 + (1 - ti) * 8);
      ctx.font = body(15);
      ctx.fillStyle = this.c(0.6 * si);
      ctx.fillText("Learn game theory by playing it.", w / 2, h - 14);
    }
  }
}
