import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { PayoffPlane } from "../shared/PayoffPlane";
import { RADIUS, STARTS, efficientSet, isEfficient, puzzle, slide, type Pt } from "./model";

const r1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
const SPEED = 5;

/**
 * Feel: drag an outcome toward better for you. They veto anything worse for them, so it slides until it sticks.
 * See: every place it stuck lies on the outer edge of the feasible region, the Pareto frontier.
 * Prove: tap every Pareto efficient outcome in a set of six.
 */
export class ParetoGame extends Game {
  readonly slug = "pareto-efficiency";
  private readonly plane = new PayoffPlane();
  private round = 0;
  private pt: Pt = [2, 3];
  private target: Pt = [2, 3];
  private trail: Pt[] = [];
  private dragging = false;
  private stuck = 0;
  private stage: "play" | "result" = "play";
  private ends: Pt[] = [];
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly arc = new Damped(0, 0.8);
  private readonly free = new Damped(0, 0.6);

  private points: Pt[] = [];
  private picked: boolean[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly check = this.add(new CanvasButton("Check", () => this.doCheck(), "primary"));

  begin(): void {
    this.round = 0;
    this.ends = [];
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.startRound();
    this.pi = 0;
    this.solved = 0;
    this.seeStep = 0;
  }

  private startRound(): void {
    const s = STARTS[this.round]!;
    this.pt = [s[0], s[1]];
    this.target = [s[0], s[1]];
    this.trail = [[s[0], s[1]]];
    this.stuck = 0;
    this.stage = "play";
    this.prompt.set("Drag the outcome. They veto anything that hurts them.");
    this.note.set("You may only move to outcomes at least as good for both.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.ends = [[6.1, 7.9], [9.2, 3.9], [5.3, 8.5]];
    this.round = STARTS.length - 1;
    this.enterSee();
    this.seeStep = 2;
    this.arc.snap(1);
    this.free.snap(1);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.check]) b.place(this.cx - 80, by, 160);
    this.plane.fit(this.frame, 10);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "result" && this.round < STARTS.length - 1;
    this.toSee.visible = feel && this.stage === "result" && this.round >= STARTS.length - 1;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.check.visible = this.beat === "prove" && !this.locked;
  }

  protected override zonesActive(): Box[] | null {
    if (this.beat !== "prove" || this.locked) return null;
    return this.points.map((pt) => {
      const [x, y] = this.plane.px(pt[0], pt[1]);
      return { x: x - 15, y: y - 15, w: 30, h: 30 };
    });
  }

  protected override onZone(i: number): void {
    this.picked[i] = !this.picked[i];
    this.cue("good");
  }

  // ---- Input ------------------------------------------------------------

  private aim(x: number, y: number): void {
    const [vx, vy] = this.plane.inv(x, y);
    this.target = [clamp(vx, 0, RADIUS), clamp(vy, 0, RADIUS)];
  }

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") return this.stepSee();
    if (this.beat === "feel" && this.stage === "play") {
      this.dragging = true;
      this.aim(x, y);
    }
  }

  protected override onMove(x: number, y: number): void {
    if (this.dragging) this.aim(x, y);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  private finishRound(): void {
    this.stage = "result";
    this.dragging = false;
    this.ends.push([this.pt[0], this.pt[1]]);
    this.cue("good");
    this.prompt.set("Stuck. Nothing can improve without hurting someone.");
    this.note.set(`You are at ${r1(this.pt[0])}, ${r1(this.pt[1])}. Any gain for you costs them.`);
    this.announce(`Stuck at ${r1(this.pt[0])}, ${r1(this.pt[1])}. Any gain for you costs them.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.arc.snap(0);
    this.free.snap(0);
    this.afterStep();
  }

  private stepSee(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    this.afterStep();
  }

  private afterStep(): void {
    if (this.seeStep === 0) {
      this.prompt.set("Each time, you stopped at the edge of the region.");
      this.note.set("Tap to see the edge.");
    } else if (this.seeStep === 1) {
      this.arc.set(1);
      this.prompt.set("That edge is the Pareto frontier.");
      this.note.set("Tap again for what it means.");
    } else {
      this.free.set(1);
      this.prompt.set("Inside it, a move helps someone for free.");
      this.note.set("On the edge, no move helps one without hurting the other.");
      this.announce("Points on the frontier are Pareto efficient. Points inside can be improved for free.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.load();
  }

  private load(): void {
    this.points = puzzle(this.env.rng);
    this.picked = this.points.map(() => false);
    this.locked = false;
    this.reveal.snap(0);
    this.prompt.set("Tap every Pareto efficient outcome.");
    this.note.set("Efficient: no other outcome is better for one and not worse for the other.");
    this.sync();
  }

  private doCheck(): void {
    const want = this.points.map((p) => isEfficient(p, this.points));
    const ok = want.every((w, i) => w === this.picked[i]);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.reveal.set(1);
      this.prompt.set("Right. Those cannot be improved for free.");
      this.note.set("The rest each have an outcome that is at least as good for both.");
      this.wait = 2.4;
    } else {
      const n = want.filter(Boolean).length;
      const got = this.picked.filter(Boolean).length;
      this.prompt.set("Not quite. Look for an outcome above and right of each.");
      this.note.set(`You picked ${got}. ${n} ${n === 1 ? "is" : "are"} efficient.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.arc.step(dt);
    this.free.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.stage === "play" && this.dragging) {
      const next = slide(this.pt, this.target, SPEED * dt);
      const moved = next[0] !== this.pt[0] || next[1] !== this.pt[1];
      const wants = this.target[0] > this.pt[0] + 0.15 || this.target[1] > this.pt[1] + 0.15;
      this.pt = next;
      if (moved) {
        this.stuck = 0;
        const last = this.trail[this.trail.length - 1]!;
        if (Math.hypot(last[0] - next[0], last[1] - next[1]) > 0.15) this.trail.push([next[0], next[1]]);
      } else if (wants) {
        this.stuck += dt;
        if (this.stuck > 0.4) this.finishRound();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= 2) {
          this.prompt.set("Efficient means no free improvement is left.");
          this.note.set("It does not mean fair, only that nobody can gain at no cost.");
          this.finish();
        } else {
          this.pi++;
          this.load();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  private arcPoints(upTo = 1): [number, number][] {
    const pts: [number, number][] = [];
    const n = 48;
    for (let i = 0; i <= n * upTo; i++) {
      const a = (i / n) * (Math.PI / 2);
      pts.push(this.plane.px(RADIUS * Math.cos(a), RADIUS * Math.sin(a)));
    }
    return pts;
  }

  protected render(p: Painter, c: Colors): void {
    const pl = this.plane;
    pl.axes(p, c);
    if (this.beat === "prove") return this.drawProve(p, c);
    const a = this.intro.value;
    const [ox, oy] = pl.px(0, 0);
    const edge = this.arcPoints();
    p.ctx.save();
    p.ctx.globalAlpha = 0.07 * a;
    p.ctx.fillStyle = c.ink;
    p.ctx.beginPath();
    p.ctx.moveTo(ox, oy);
    for (const [x, y] of edge) p.ctx.lineTo(x, y);
    p.ctx.closePath();
    p.ctx.fill();
    p.ctx.restore();
    if (this.beat === "feel") {
      if (this.trail.length > 1) p.path(this.trail.map((q) => pl.px(q[0], q[1])), c.ink, 1.5, 0.35);
      const [x, y] = pl.px(this.pt[0], this.pt[1]);
      const pulse = this.stage === "play" && !this.dragging ? 0.55 + 0.35 * Math.sin(this.time * 3) : 0.9;
      p.ring(x, y, 12, c.ink, 1.25, pulse);
      p.disc(x, y, 6, c.ink);
      for (const e of this.ends) {
        const [ex, ey] = pl.px(e[0], e[1]);
        p.disc(ex, ey, 4, c.ink, 0.6);
      }
      this.ticks(p, c, STARTS.length, this.round + (this.stage === "result" ? 1 : 0), this.round);
      return;
    }
    const arc = this.arc.value;
    if (this.free.value > 0.02) pl.quadrant(p, c, STARTS[0]![0], STARTS[0]![1], this.free.value);
    if (arc > 0.01) p.path(this.arcPoints(arc), c.ink, 2, 1);
    STARTS.forEach((s) => {
      const [x, y] = pl.px(s[0], s[1]);
      p.ring(x, y, 5, c.ink, 1.25, 0.7);
    });
    for (const e of this.ends) {
      const [x, y] = pl.px(e[0], e[1]);
      p.disc(x, y, 6, c.ink);
    }
  }

  private drawProve(p: Painter, c: Colors): void {
    const pl = this.plane;
    const k = this.reveal.value;
    if (k > 0.02) {
      const eff = efficientSet(this.points).sort((a, b) => a[0] - b[0]);
      p.path(eff.map((q) => pl.px(q[0], q[1])), c.ink, 1.5, 0.6 * k);
    }
    this.points.forEach((pt, i) => {
      const [x, y] = pl.px(pt[0], pt[1]);
      p.disc(x, y, 6, c.ink);
      if (this.picked[i]) p.ring(x, y, 13, c.ink, 1.5);
    });
    this.ticks(p, c, 2, this.solved, this.pi);
  }
}
