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
import { FEEL_BELIEFS, FEEL_ENTRY, PROVE_POOL, PROVE_TOLERANCE, type Entry } from "./model";

const ROUNDS = FEEL_BELIEFS.length;
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: four entry decisions against an incumbent who is Tough or Weak, with a different belief each time.
 * See: drag the belief and watch the average payoff of entering cross zero.
 * Prove: new payoffs. Drag to the belief where entering and staying out are equally good.
 */
export class BayesianGamesGame extends Game {
  readonly slug = "bayesian-games";
  private g: Entry = FEEL_ENTRY;
  private round = 0;
  private stage: "choose" | "result" = "choose";
  private armed: "enter" | "out" | null = null;
  private tough = false;
  private readonly youR = new Damped(0, 0.4);
  private readonly altR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private cases: Entry[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_ENTRY;
    this.round = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    this.armed = null;
    this.youR.snap(0);
    this.altR.snap(0);
    const q = FEEL_BELIEFS[this.round]!;
    this.prompt.set(`Tough with chance ${pct(q)}. Enter, or stay out?`);
    this.note.set(this.round === 0 ? "Win 3 if Weak. Lose 2 if Tough. Out pays 0." : "");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
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
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "enter";
      else if (inside(this.pair(1), x, y)) this.armed = "out";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setQ(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setQ(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "enter" ? 0 : 1), x, y)) this.decide(a === "enter");
  }

  // ---- Feel -------------------------------------------------------------

  private decide(enter: boolean): void {
    const g = this.g;
    const q = FEEL_BELIEFS[this.round]!;
    this.tough = this.env.rng.chance(q);
    const enterPay = g.realised(this.tough);
    const mine = enter ? enterPay : 0;
    const alt = enter ? 0 : enterPay;
    this.youR.set(Math.sqrt(Math.abs(mine) / g.G));
    this.altR.set(Math.sqrt(Math.abs(alt) / g.G));
    this.stage = "result";
    this.round++;
    this.cue(mine >= alt ? "good" : "bad");
    this.prompt.set(this.tough ? "The incumbent was Tough." : "The incumbent was Weak.");
    this.note.set(`${enter ? "You entered" : "You stayed out"}: ${fmt(mine)}. ${enter ? "Out" : "Entering"} would have paid ${fmt(alt)}.`);
    this.announce(`The incumbent was ${this.tough ? "Tough" : "Weak"}. You got ${fmt(mine)}. The other choice paid ${fmt(alt)}.`);
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (q: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const hi = g.G + 0.4;
    const lo = -g.L - 0.4;
    return { x0, w, top, h, X: (q) => x0 + q * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_ENTRY;
    this.sl.value = 0.1;
    this.lo = 0.1;
    this.hi = 0.1;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag your belief that the rival is Tough.");
    this.note.set("Above the axis, entering pays on average.");
    this.sync();
  }

  private setQ(px: number): void {
    const c = this.chart(this.frame);
    const q = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 100) / 100;
    this.sl.value = q;
    this.lo = Math.min(this.lo, q);
    this.hi = Math.max(this.hi, q);
    const g = this.g;
    this.note.set(`Belief ${pct(q)}: entering averages ${fmt(g.enter(q))}. ${g.shouldEnter(q) ? "Enter." : "Stay out."}`);
    if (!this.reached && this.lo < g.threshold - 0.1 && this.hi > g.threshold + 0.1) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`It flips at a belief of ${pct(g.threshold)}.`);
      this.announce(`Entering pays on average when the belief in a Tough rival is below ${pct(g.threshold)}.`);
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
    this.sl.value = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New payoffs. At what belief are you indifferent?" : "Different payoffs. Where are you indifferent?");
    this.note.set(`Win ${k.G} against Weak, lose ${k.L} against Tough.`);
    this.sync();
  }

  private lockIn(): void {
    const k = this.g;
    const q = this.sl.value;
    const ok = Math.abs(q - k.threshold) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${k.G} / (${k.G} + ${k.L}) = ${fmt(k.threshold)}.`);
      this.note.set("Below that belief, enter. Above it, stay out.");
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Make entering worth zero.");
      this.note.set(`At ${pct(q)}: ${fmt(k.G)} x ${fmt(1 - q)} - ${fmt(k.L)} x ${fmt(q)} = ${fmt(k.enter(q))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Best reply to a belief about a hidden type.");
          this.note.set("Change the belief, and the best reply changes.");
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
    const q = FEEL_BELIEFS[Math.min(this.round - (this.stage === "result" ? 1 : 0), ROUNDS - 1)]!;
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    p.disc(this.cx - off, cy, R * Math.sqrt(g.G / g.G), c.ink, 0.92 * a);
    p.dashedRing(this.cx + off, cy, R * Math.sqrt(g.L / g.G), c.ink, 0.9 * a);
    if (this.stage === "result") p.ring(this.tough ? this.cx + off : this.cx - off, cy, R + 4, c.ink, 1, 0.8 * a);
    p.text(`Weak ${pct(1 - q)}  +${g.G}`, this.cx - off, cy + R + 22, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`Tough ${pct(q)}  -${g.L}`, this.cx + off, cy + R + 22, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = (this.stage === "choose" ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "enter" : "out") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
      p.text(i === 0 ? "Enter" : "Stay out", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? `average ${fmt(g.enter(q))}` : "pays 0", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("average payoff of entering", x0, top - 14, { font, color: c.fog });
    p.text("belief the rival is Tough", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.line(X(0), Y(g.enter(0)), X(1), Y(g.enter(1)), c.ink, 2, 1);
    const q = this.sl.value;
    p.rule(X(q), top, X(q), top + h, c.ink, 0.3);
    p.disc(X(q), Y(g.enter(q)), 6, c.ink, 1);
    const cr = this.cross.value;
    if (cr > 0.01) {
      p.ring(X(g.threshold), Y(0), 11, c.ink, 1.5, cr);
      p.text(pct(g.threshold), X(g.threshold), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.g;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    const mx = Math.max(k.G, k.L);
    p.disc(this.cx - off, cy, R * Math.sqrt(k.G / mx), c.ink, 0.92);
    p.dashedRing(this.cx + off, cy, R * Math.sqrt(k.L / mx), c.ink, 0.9);
    p.text(`Weak  +${k.G}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`Tough  -${k.L}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 0.5, 1], label: pct, text: (v) => `${pct(v)} Tough` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.threshold), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
