import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { FEEL_PENALTY, PROVE_PENALTIES, PROVE_TOLERANCE, keeperDive, type Dive, type Penalty } from "./model";

const KICKS = 6;
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const SIDE = ["left", "right"] as const;

/**
 * Feel: six kicks against a keeper who dives toward your more frequent side.
 * See: drag your share of left kicks. The keeper's two choices cross where neither is better.
 * Prove: new chances. Drag to the share where both dives score the same.
 */
export class MixedStrategyGame extends Game {
  readonly slug = "mixed-strategy";
  private readonly g = FEEL_PENALTY;
  private history: (0 | 1)[] = [];
  private results: boolean[] = [];
  private stage: "choose" | "wait" | "result" = "choose";
  private kickSide: 0 | 1 | null = null;
  private dive: Dive = 0;
  private scored = false;
  private since = 0;
  private armed: 0 | 1 | null = null;
  private readonly keeperX = new Damped(0.5, 0.35);
  private readonly ball = new Damped(0, 0.3);
  private readonly chances = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private pool: Penalty[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextKick(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.history = [];
    this.results = [];
    this.stage = "choose";
    this.kickSide = null;
    this.keeperX.snap(0.5);
    this.ball.snap(0);
    this.chances.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.prompt.set("Pick a side to kick. The keeper watches.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.history = [0, 1, 0, 0, 1, 0];
    this.results = [true, false, true, false, true, true];
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.history.length >= KICKS ? "See why" : "Next kick";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = 0;
      else if (inside(this.pair(1), x, y)) this.armed = 1;
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setP(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.setP(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.setP(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const s = this.armed;
    this.armed = null;
    if (s !== null && this.stage === "choose" && inside(this.pair(s), x, y)) this.kick(s);
  }

  // ---- Feel -------------------------------------------------------------

  private kick(side: 0 | 1): void {
    this.dive = keeperDive(this.history, this.env.rng);
    this.kickSide = side;
    this.scored = this.env.rng.chance(this.g.chance(side, this.dive));
    this.history.push(side);
    this.results.push(this.scored);
    this.stage = "wait";
    this.since = 0;
    this.keeperX.set(this.dive === 0 ? 0.25 : 0.75);
    this.ball.set(1);
    this.note.set("");
    this.prompt.set(this.history.length === 1 ? "Watch the keeper." : "Again.");
    this.cue("good");
    this.sync();
  }

  private revealKick(): void {
    const side = this.kickSide!;
    const other = side === 0 ? 1 : 0;
    this.chances.set(1);
    const alt = this.g.chance(other, this.dive);
    this.note.set(`Keeper dove ${SIDE[this.dive]}. ${this.scored ? "You scored." : "Saved."} The ${SIDE[other]} had ${pct(alt)} there.`);
    this.announce(`Kick ${this.history.length}. Keeper dove ${SIDE[this.dive]}. ${this.scored ? "You scored." : "Saved."} The ${SIDE[other]} had a ${pct(alt)} chance there.`);
    this.stage = "result";
    this.prompt.set(this.history.length >= KICKS ? `Scored ${this.results.filter(Boolean).length} of ${KICKS}. The keeper read you.` : "The keeper remembers your lean.");
    this.sync();
  }

  private nextKick(): void {
    if (this.stage !== "result") return;
    if (this.history.length >= KICKS) return this.enterSee();
    this.stage = "choose";
    this.kickSide = null;
    this.keeperX.set(0.5);
    this.ball.set(0);
    this.chances.set(0);
    this.prompt.set("Pick a side to kick. The keeper watches.");
    this.note.set("");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.9;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag your share of left kicks.");
    this.note.set("The keeper dives wherever you score less.");
    this.sync();
  }

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (p: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(200, f.h - 28 - 54));
    return { x0, w, top, h, X: (p) => x0 + p * w, Y: (v) => top + h - v * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private setP(x: number): void {
    if (this.beat === "see") {
      const c = this.chart(this.frame);
      this.sl.value = Math.round(clamp((x - c.x0) / c.w, 0, 1) * 100) / 100;
      const p = this.sl.value;
      const near = Math.abs(p - this.g.indifference) <= 0.04;
      if (near && !this.reached) {
        this.reached = true;
        this.cross.set(1);
        this.cue("good");
        this.prompt.set("Here the keeper has no better dive.");
        this.announce(`At ${pct(this.g.indifference)} left kicks, both dives score ${pct(this.g.value)}.`);
        this.sync();
      }
      if (this.reached) this.note.set(`Left ${pct(p)}. Dive left holds you to ${pct(this.g.against(p, 0))}, dive right to ${pct(this.g.against(p, 1))}.`);
      else this.note.set(`Left ${pct(p)}. Keeper dives ${SIDE[this.g.keeperBest(p)]}. You score ${pct(Math.min(this.g.against(p, 0), this.g.against(p, 1)))}.`);
    } else {
      this.sl.setFromX(x);
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pool = this.env.rng.shuffle(PROVE_PENALTIES);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New chances. Drag to where the keeper cannot choose." : "Different chances. Where is the keeper stuck?");
    this.note.set("Both dives must score the same against you.");
    this.sync();
  }

  private lockIn(): void {
    const q = this.pool[this.pi]!;
    const p = this.sl.value;
    const ok = Math.abs(p - q.indifference) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Both dives score the same.");
      this.note.set(`Left ${pct(q.indifference)} holds you at ${pct(q.value)} either way.`);
      this.wait = 1.9;
    } else {
      this.prompt.set("Not quite. Make the two dives equal.");
      this.note.set(`At ${p.toFixed(2)}: dive left ${pct(q.against(p, 0))}, dive right ${pct(q.against(p, 1))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.keeperX.step(dt);
    this.ball.step(dt);
    this.chances.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.revealKick();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.pool.length) {
          this.prompt.set("Mix so the other side is indifferent.");
          this.note.set("Then no fixed dive can beat you.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawChart(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const gh = clamp(f.h * 0.4, 48, 100);
    const gy = f.top + 2;
    p.frame(f.x, gy, f.w, gh, c.ink, 0.45 * a);
    p.rule(f.x + f.w / 2, gy, f.x + f.w / 2, gy + gh, c.ink, 0.18 * a);
    const kr = Math.min(14, gh * 0.26);
    p.ring(f.x + this.keeperX.value * f.w, gy + gh * 0.5, kr, c.ink, 1.5, a);
    if (this.kickSide !== null) {
      const bx = f.x + (this.kickSide === 0 ? 0.25 : 0.75) * f.w;
      const by = gy + gh * 0.5;
      const t = this.ball.value;
      if (this.stage === "wait" || this.scored) p.disc(bx, by, 7 * t, c.ink, 0.95 * t);
      else p.dashedRing(bx, by, 7, c.ink, 0.9 * t);
    }
    const R = clamp((f.h - gh - 50) / 2, 8, 24);
    const cy = gy + gh + 16 + R;
    const t = this.chances.value;
    if (this.kickSide !== null && t > 0.02) {
      for (const s of [0, 1] as const) {
        const x = f.x + (s === 0 ? 0.25 : 0.75) * f.w;
        const v = this.g.chance(s, this.dive);
        const chosen = this.kickSide === s;
        if (chosen) p.disc(x, cy, R * Math.sqrt(v), c.ink, 0.92 * t);
        else p.dashedRing(x, cy, Math.max(3, R * Math.sqrt(v)), c.ink, t);
        p.text(pct(v), x, cy + R + 14, { font: Type.mono(11), color: c.fog, align: "center", alpha: t });
      }
    }
    for (let i = 0; i < KICKS; i++) Glyph.step(p, c, this.cx - (KICKS - 1) * 10 + i * 20, f.tickY, i < this.history.length, i === this.history.length);
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const live = this.stage === "choose";
      const al = (live ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, 0.92 * al);
      p.text(i === 0 ? "Kick left" : "Kick right", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      const l = this.history.filter((k) => k === i).length;
      p.text(`${l} so far`, gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const { x0, w, top, h, X, Y } = this.chart(f);
    const base = top + h;
    p.rule(x0, base, x0 + w, base, c.ink, 0.5);
    p.rule(x0, top, x0, base, c.ink, 0.5);
    p.text("you score", x0, top - 14, { font: Type.body(12, 400), color: c.fog });
    p.text("share of left kicks", x0 + w, base + 40, { font: Type.body(12, 400), color: c.fog, align: "right" });
    p.text("0", x0, base + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("1", x0 + w, base + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    const pv = this.sl.value;
    const best = g.keeperBest(pv);
    const font = Type.body(12, 400);
    let lx = x0 + w;
    for (const d of [1, 0] as const) {
      const label = d === 0 ? "dive left" : "dive right";
      const tw = p.measure(label, font);
      p.text(label, lx, top - 14, { font, color: best === d ? c.ink : c.fog, align: "right" });
      p.line(lx - tw - 28, top - 18, lx - tw - 8, top - 18, c.ink, best === d ? 2 : 1.25, best === d ? 1 : 0.5, d === 1 ? [5, 4] : undefined);
      lx -= tw + 40;
    }
    for (const d of [0, 1] as const) {
      p.line(X(0), Y(g.against(0, d)), X(1), Y(g.against(1, d)), c.ink, best === d ? 2 : 1.25, best === d ? 1 : 0.5, d === 1 ? [5, 4] : undefined);
    }
    p.rule(X(pv), top, X(pv), base, c.ink, 0.3);
    const yv = Math.min(g.against(pv, 0), g.against(pv, 1));
    p.disc(X(pv), Y(yv), 6, c.ink, 1);
    p.disc(X(pv), base, 4, c.ink, 0.9);
    const cr = this.cross.value;
    if (cr > 0.01) {
      const ps = g.indifference;
      p.ring(X(ps), Y(g.value), 11, c.ink, 1.5, cr);
      p.text(ps.toFixed(2), X(ps), base + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const q = this.pool[Math.min(this.pi, this.pool.length - 1)]!;
    const labelW = 76;
    const headH = 22;
    const cellW = Math.floor(Math.min(110, (f.w - labelW) / 2));
    const room = this.sl.y - 56 - f.top - headH;
    const cellH = Math.floor(clamp(room / 2, 28, 54));
    const x0 = Math.round(f.x + (f.w - labelW - 2 * cellW) / 2 + labelW);
    const y0 = f.top + headH;
    p.frame(x0, y0, 2 * cellW, 2 * cellH, c.ink, 0.3);
    p.rule(x0 + cellW, y0, x0 + cellW, y0 + 2 * cellH, c.ink, 0.3);
    p.rule(x0, y0 + cellH, x0 + 2 * cellW, y0 + cellH, c.ink, 0.3);
    p.text("dive left", x0 + cellW / 2, y0 - 10, { font: Type.body(12, 400), color: c.fog, align: "center" });
    p.text("dive right", x0 + cellW * 1.5, y0 - 10, { font: Type.body(12, 400), color: c.fog, align: "center" });
    p.text("kick left", x0 - 8, y0 + cellH / 2, { font: Type.body(12, 400), color: c.fog, align: "right", base: "middle" });
    p.text("kick right", x0 - 8, y0 + cellH * 1.5, { font: Type.body(12, 400), color: c.fog, align: "right", base: "middle" });
    const R = Math.min(cellH * 0.34, cellW * 0.2);
    for (const k of [0, 1] as const) for (const d of [0, 1] as const) {
      const v = q.chance(k, d);
      const cx = x0 + d * cellW + cellW * 0.3;
      const cy = y0 + k * cellH + cellH / 2;
      p.disc(cx, cy, R * Math.sqrt(v), c.ink, 0.92);
      p.text(pct(v), x0 + d * cellW + cellW * 0.7, cy, { font: Type.mono(12), color: c.fog, align: "center", base: "middle" });
    }
    this.sl.draw(p, c, { ticks: [0, 0.5, 1], text: (v) => v.toFixed(2) });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(q.indifference), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.pool.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
