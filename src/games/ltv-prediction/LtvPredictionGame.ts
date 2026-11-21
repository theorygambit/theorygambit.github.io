import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { Slider } from "../shared/Slider";
import { drawChoice } from "../shared/kit";
import { Cohort, FEEL_ROUNDS, HORIZON, answer, feelPairs, isRight, proveSet, type LtvPuzzle, type Pair } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const r1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: buy one of two groups of players, four times. Week one hides the answer.
 * See: lifetime value against how many stay. The last few points of staying are worth the most.
 * Prove: a new spend and retention. Work out the lifetime value.
 */
export class LtvPredictionGame extends Game {
  readonly slug = "ltv-prediction";
  private pairs: Pair[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly other = new Damped(0, 0.4);

  private probe = 0.5;
  private touched = false;
  private reached = false;
  private dragging = false;
  private readonly ring = new Damped(0, 0.6);
  private readonly plot = new Plot({ xMin: 0.3, xMax: 0.95, yMin: 0, yMax: 80, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });

  private cases: LtvPuzzle[] = [];
  private pi = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly sl = new Slider().range(0, 40, 1);
  private readonly reveal = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.pairs = feelPairs(this.env.rng);
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose((i % 2) as 0 | 1);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setProbe(this.plot.X(0.92));
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 70 : 72) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage !== "choose") return;
      this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.setSl(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove") this.setSl(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a !== null && this.stage === "choose" && this.hit(a, x, y)) this.choose(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = null;
    this.mine.snap(0);
    this.other.snap(0);
    this.prompt.set("Buy one group. Each costs the same.");
    this.note.set(`Pair ${this.round + 1} of ${FEEL_ROUNDS}. You see week one only.`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const pr = this.pairs[this.round]!;
    const a = i === 0 ? pr.left : pr.right;
    const b = i === 0 ? pr.right : pr.left;
    this.picked = i;
    this.stage = "shown";
    const va = a.value(HORIZON);
    const vb = b.value(HORIZON);
    this.mine.set(va);
    this.other.set(vb);
    const win = va >= vb;
    this.prompt.set(win ? `Twelve weeks later: ${r1(va)} a player.` : `Twelve weeks later: ${r1(va)}. The other made ${r1(vb)}.`);
    this.note.set(win ? "Spend and staying both count." : a.a > b.a ? "The bigger first week did not last." : "Fewer stayed, so less came in.");
    this.announce(`You earned ${r1(va)} a player, the other group ${r1(vb)}.`);
    this.cue(win ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 0.5;
    this.touched = false;
    this.reached = false;
    this.ring.snap(0);
    this.prompt.set("Drag how many stay. Watch what a player is worth.");
    this.note.set("A player spending 4 a week.");
    this.sync();
  }

  private setProbe(x: number): void {
    const r = clamp(Math.round(this.plot.valueAtX(x) * 100) / 100, 0.3, 0.95);
    this.probe = r;
    this.touched = true;
    const c = new Cohort(4, r);
    this.note.set(`${pct(r)} stay: ${r1(c.weeks())} weeks on average, worth ${r1(c.lifetime())}.`);
    if (!this.reached && r >= 0.9) {
      this.reached = true;
      this.ring.set(1);
      this.prompt.set("The last points of staying are worth the most.");
      this.announce("Going from 80 to 90 percent staying adds as much as going from 50 to 80.");
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const c = this.cases[this.pi]!;
    this.sl.value = 0;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set(`${c.a} a week, ${pct(c.r)} stay each week.`);
    this.note.set("Drag to what a player is worth over their whole stay.");
    this.sync();
  }

  private setSl(x: number): void {
    this.sl.setFromX(x);
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`A player is worth ${Math.round(this.sl.value)}.`);
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const v = this.sl.value;
    const ok = isRight(c, v);
    const k = new Cohort(c.a, c.r);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. ${r1(k.lifetime())}.`);
      this.note.set(`${r1(k.weeks())} weeks on average, times ${c.a} a week.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      this.prompt.set(v > k.lifetime() ? "Too much." : "Too little.");
      this.note.set(`They stay ${r1(k.weeks())} weeks on average (1 / (1 - ${c.r})). Times ${c.a}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.other, this.ring, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Value is spend times how long they stay.");
          this.note.set("Retention is the lever. Small gains compound.");
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
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const pr = this.pairs[Math.min(this.round, this.pairs.length - 1)]!;
    const open = this.stage === "choose";
    ([pr.left, pr.right] as const).forEach((k, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), {
        label: `${k.a} a week`,
        sub: `${pct(k.r)} stay`,
        r: Math.min(9, 3 + 1.4 * k.a),
        armed: this.armed === i,
        chosen: this.picked === i,
        alpha: open ? 1 : 0,
      });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 60) / 2.4), 14, 50);
    const cy = f.top + R + 4;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 40) / 20);
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    if (!open) {
      p.disc(xl, cy, rad(this.mine.value), c.ink, 0.95);
      p.ring(xr, cy, rad(this.other.value), c.ink, 1.5);
      p.text(`yours ${r1(this.mine.value)}`, xl, cy + 1.45 * R + 12, { font: Type.body(13, 400), color: c.ink, align: "center" });
      p.text(`other ${r1(this.other.value)}`, xr, cy + 1.45 * R + 12, { font: Type.body(13, 400), color: c.ink, align: "center" });
    } else {
      p.dashedRing(this.cx, cy, R * 0.8, c.ink, 0.45);
      p.text("12 weeks, per player", this.cx, cy + R * 0.8 + 18, { font: Type.body(13, 400), color: c.fog, align: "center" });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0.3, 0.5, 0.7, 0.9], xLabel: "share who stay each week", yLabel: "worth of one player", fmt: (v) => pct(v) });
    pl.curve(p, (r) => new Cohort(4, r).lifetime(), c.ink, 1.75, 1, 60);
    const rg = this.ring.value;
    if (rg > 0.01) p.ring(pl.X(0.9), pl.Y(new Cohort(4, 0.9).lifetime()), 9, c.ink, 1.5, rg);
    if (this.touched) {
      const px = pl.X(this.probe);
      const py = pl.Y(new Cohort(4, this.probe).lifetime());
      p.line(px, pl.base, px, py, c.ink, 1, 0.4, [3, 4]);
      p.disc(px, py, 4.5, c.ink);
    }
    Glyph.step(p, c, this.cx, f.tickY, this.reached, false);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const sy = f.bottom - 40;
    this.sl.place(f.x + 24, f.x + f.w - 24, sy);
    this.sl.draw(p, c, { ticks: [0, 10, 20, 30, 40], label: (v) => String(v), text: (v) => String(Math.round(v)) });
    const n = 6;
    const R = clamp(Math.min((f.w - 48) / (n * 2.4), (sy - f.top - 60) / 2), 8, 34);
    const cy = f.top + R + 8;
    const x0 = this.cx - ((n - 1) * 2.4 * R) / 2;
    for (let t = 0; t < n; t++) {
      p.disc(x0 + t * 2.4 * R, cy, R * Math.sqrt(Math.pow(k.r, t)), c.ink, 0.92);
    }
    p.text("share still playing, week by week", this.cx, cy + R + 18, { font: Type.body(12, 400), color: c.fog, align: "center" });
    const rv = this.reveal.value;
    if (rv > 0.01) p.ring(this.sl.X(clamp(answer(k), 0, 40)), sy, 14, c.ink, 1.5, rv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
