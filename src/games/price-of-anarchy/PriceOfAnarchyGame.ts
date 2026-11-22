import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_NETWORK, PROVE_POOL, PROVE_TOLERANCE, type Pigou } from "./model";

const DAYS = 5;
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: five days. Choose the fixed route or the one that slows as it fills. Drivers copy yesterday's cheaper one.
 * See: drag the share on the variable route. Selfish play sits at the right, the best split is lower.
 * Prove: a new network. Drag to the share that minimises the average cost.
 */
export class PriceOfAnarchyGame extends Game {
  readonly slug = "price-of-anarchy";
  private g: Pigou = FEEL_NETWORK;
  private day = 0;
  private share = 0.3;
  private stage: "choose" | "result" = "choose";
  private armed: "a" | "b" | null = null;
  private picked: "a" | "b" | null = null;
  private readonly aR = new Damped(0, 0.4);
  private readonly bR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly best = new Damped(0, 0.6);

  private cases: Pigou[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next day", () => this.nextDay(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_NETWORK;
    this.day = 0;
    this.share = 0.3;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startDay();
  }

  private startDay(): void {
    this.stage = "choose";
    this.armed = null;
    this.picked = null;
    this.aR.snap(Math.sqrt(this.g.c / 1.2));
    this.bR.snap(Math.sqrt(this.g.variable(this.share) / 1.2));
    this.prompt.set(this.day === 0 ? "Pick a route. Cheaper is better." : `Day ${this.day + 1}. Pick a route.`);
    this.note.set(`${pct(this.share)} of drivers took route B yesterday.`);
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.day = DAYS;
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
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "result" && this.day < DAYS;
    this.toSee.visible = this.beat === "feel" && this.stage === "result" && this.day >= DAYS;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "a";
      else if (inside(this.pair(1), x, y)) this.armed = "b";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setX(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setX(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "a" ? 0 : 1), x, y)) this.choose(a);
  }

  // ---- Feel -------------------------------------------------------------

  private choose(r: "a" | "b"): void {
    const g = this.g;
    const costA = g.c;
    const costB = g.variable(this.share);
    const mine = r === "a" ? costA : costB;
    const other = r === "a" ? costB : costA;
    this.picked = r;
    this.stage = "result";
    this.day++;
    this.cue(mine <= other ? "good" : "bad");
    this.prompt.set(mine <= other ? "The cheaper route." : "The other was cheaper.");
    this.note.set(`You paid ${fmt(mine)}. The other route cost ${fmt(other)}.`);
    this.announce(`Day ${this.day}. You paid ${fmt(mine)}. The other route cost ${fmt(other)}.`);
    this.share = g.drift(this.share);
    if (this.day >= DAYS) {
      this.prompt.set(`Drivers ended near ${fmt(g.variable(this.share))} each.`);
      this.note.set(`A planner could have averaged ${fmt(g.average(g.optimum))}.`);
    }
    this.sync();
  }

  private nextDay(): void {
    if (this.stage !== "result" || this.day >= DAYS) return;
    this.startDay();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (x: number) => number; Y: (y: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const hi = Math.max(g.average(0), g.average(1)) + 0.05;
    const lo = g.average(g.optimum) - 0.1;
    return { x0, w, top, h, X: (x) => x0 + x * w, Y: (y) => top + ((hi - y) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_NETWORK;
    this.sl.value = 1;
    this.lo = 1;
    this.hi = 1;
    this.reached = false;
    this.best.snap(0);
    this.prompt.set("Drag the share on route B. Watch the average.");
    this.note.set("Selfish drivers end at the right edge.");
    this.sync();
  }

  private setX(px: number): void {
    const c = this.chart(this.frame);
    const x = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 100) / 100;
    this.sl.value = x;
    this.lo = Math.min(this.lo, x);
    this.hi = Math.max(this.hi, x);
    const g = this.g;
    this.note.set(`${pct(x)} on B. Average cost ${fmt(g.average(x))}. Selfish play costs ${fmt(g.average(g.selfish))}.`);
    if (!this.reached && this.lo <= g.optimum + 0.05) {
      this.reached = true;
      this.best.set(1);
      this.cue("good");
      this.prompt.set(`A planner does better at ${pct(g.optimum)}.`);
      this.announce(`The average is lowest at ${pct(g.optimum)} on route B, ${fmt(g.average(g.optimum))}, against ${fmt(g.average(g.selfish))} when everyone is selfish.`);
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const k = this.cases[this.pi]!;
    this.g = k;
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.7;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New network. Drag to the cheapest average." : "Another network. Find the cheapest average.");
    this.note.set(`B costs ${fmt(k.a)} x its share. A costs ${fmt(k.c)}.`);
    this.sync();
  }

  private lockIn(): void {
    const g = this.g;
    const x = this.sl.value;
    const ok = Math.abs(x - g.optimum) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${fmt(g.c)} / (2 x ${fmt(g.a)}) = ${fmt(g.optimum)}.`);
      this.note.set(`Selfish play sits at ${pct(g.selfish)}. The ratio is ${fmt(g.anarchy)}.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Find the lowest average.");
      this.note.set(`At ${pct(x)} the average is ${fmt(g.average(x))}. A better split averages ${fmt(g.average(g.optimum))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.aR.step(dt);
    this.bR.step(dt);
    this.best.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Selfish choices settle, but not at the best.");
          this.note.set("The gap is the price of anarchy.");
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
    const g = this.g;
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    const showShare = this.stage === "result" ? this.shareBefore() : this.share;
    const costA = g.c;
    const costB = g.variable(showShare);
    const chosenA = this.picked === "a";
    const chosenB = this.picked === "b";
    if (this.stage === "result" && chosenA) p.disc(this.cx - off, cy, R * Math.sqrt(costA / 1.2), c.ink, 0.92 * a);
    else p.ring(this.cx - off, cy, Math.max(2, this.aR.value * R), c.ink, 1.5, a);
    if (this.stage === "result" && chosenB) p.disc(this.cx + off, cy, R * Math.sqrt(costB / 1.2), c.ink, 0.92 * a);
    else if (this.stage === "result") p.dashedRing(this.cx + off, cy, Math.max(2, R * Math.sqrt(costB / 1.2)), c.ink, 0.9 * a);
    else p.ring(this.cx + off, cy, Math.max(2, this.bR.value * R), c.ink, 1.5, a);
    if (this.stage === "result" && chosenB) p.dashedRing(this.cx - off, cy, R * Math.sqrt(costA / 1.2), c.ink, 0.9 * a);
    p.text(`A  ${fmt(costA)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`B  ${fmt(costB)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = (this.stage === "choose" ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "a" : "b") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.5) * al);
      p.text(i === 0 ? "Route A" : "Route B", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? "always costs 1" : "slows as it fills", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < DAYS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.day, i === this.day);
  }

  /** The share that applied on the day just played. */
  private shareBefore(): number {
    let x = 0.3;
    for (let i = 0; i < this.day - 1; i++) x = this.g.drift(x);
    return x;
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, top + h, x0 + w, top + h, c.ink, 0.5);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("average cost", x0, top - 14, { font, color: c.fog });
    p.text("share on route B", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 40; i++) {
      const x = i / 40;
      const pt: [number, number] = [X(x), Y(g.average(x))];
      if (prev) p.line(prev[0], prev[1], pt[0], pt[1], c.ink, 2, 1);
      prev = pt;
    }
    const xv = this.sl.value;
    p.rule(X(xv), top, X(xv), top + h, c.ink, 0.3);
    p.disc(X(xv), Y(g.average(xv)), 6, c.ink, 1);
    p.ring(X(g.selfish), Y(g.average(g.selfish)), 10, c.ink, 1.5, 0.7);
    const b = this.best.value;
    if (b > 0.01) {
      p.ring(X(g.optimum), Y(g.average(g.optimum)), 11, c.ink, 1.5, b);
      p.text(pct(g.optimum), X(g.optimum), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: b });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const x = this.sl.value;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    p.ring(this.cx - off, cy, R * Math.sqrt(g.c / (g.a + 0.01)) * 0.6, c.ink, 1.5, 1);
    p.disc(this.cx + off, cy, Math.max(2, R * 0.6 * Math.sqrt(x)), c.ink, 0.92);
    p.text(`A costs ${fmt(g.c)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`B ${pct(x)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 0.5, 1], label: pct, text: (v) => `${pct(v)} on B` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(g.optimum), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
