import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE, SEE_MAX, Sale, isRight, owed, proveSet } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you bid for an item against a rival. Report your true value or report something else.
 * See: drag your report. Above the best rival you win and pay their value, so no report beats the truth.
 * Prove: new bidders. What do you pay when you win and when you lose?
 */
export class VcgGame extends Lesson<Sale> {
  readonly slug = "vcg";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Report ${r.value}`, `Report ${r.lie}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: SEE_MAX, yMin: 0, yMax: 4, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private probe = 5;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`You value it ${x.value}. The best rival reports ${x.other}.`, "The winner pays the best rival's report."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const s = new Sale(x.value, [x.other]);
    const got = s.pay(i === 0 ? x.value : x.lie);
    const alt = s.pay(i === 0 ? x.lie : x.value);
    const won = (i === 0 ? x.value : x.lie) > x.other;
    const raw = won ? x.value - x.other : 0;
    return { pay: Math.max(0, got), alt: Math.max(0, alt), prompt: won ? `You won and paid ${x.other}.` : "You lost the item.", note: `Your gain is ${raw}. The other report gains ${s.pay(i === 0 ? x.lie : x.value)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.probe = 5;
    return [`You value it ${SEE.value}. The best rival reports ${SEE.best()}.`, "Drag your report. What do you gain?"];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.setProbe(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setProbe(x);
  }

  private setProbe(x: number): void {
    this.probe = clamp(Math.round(this.plot.valueAtX(x)), 0, SEE_MAX);
    this.touched = true;
    this.low = this.low || this.probe <= 3;
    this.high = this.high || this.probe >= 7;
    const g = SEE.pay(this.probe);
    this.note.set(this.probe > SEE.best() ? `Report ${this.probe}: you win and pay ${SEE.best()}, gaining ${g}.` : `Report ${this.probe}: you lose, gaining 0.`);
    if (this.low && this.high) this.reachSee(`Above ${SEE.best()} you gain the same. Truth is as good as any.`);
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(2), y], [this.plot.X(9), y]];
  }
  protected seeFinishDebug(): void {
    this.setProbe(this.plot.X(2));
    this.setProbe(this.plot.X(9));
  }
  override seePartialDebug(): void {
    this.setProbe(this.plot.X(3));
  }

  protected makePuzzles(): Sale[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Sale): [string, string] {
    return [`You value it ${q.value}. Others value it ${q.others.join(" and ")}.`, "You report the truth. What do you pay?"];
  }
  protected answerSpec(_q: Sale): Answer {
    return { mode: "slider", min: 0, max: 10, step: 1, init: 5, labels: ["", ""], fmt: String };
  }
  protected judge(q: Sale, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: owed(q) > 0 ? `Right. You pay ${owed(q)}.` : "Right. You lose and pay nothing.", note: "You pay the harm you do to the others." };
    return { ok: false, prompt: owed(q) > 0 ? "You win, so you pay the harm." : "You lose, so you pay nothing.", note: owed(q) > 0 ? `Your win costs the best rival ${q.best()}.` : `The best rival values it ${q.best()}, above your ${q.value}.` };
  }
  protected readonly closing: [string, string] = ["Charge each winner the harm they cause.", "Then telling the truth is the best policy."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 2, 4, 6, 8, 10], xLabel: "your report", yLabel: "your gain", fmt: String });
    pl.curve(p, (r) => SEE.pay(r), c.ink, 1.75, 1, 40);
    if (this.seeDone) p.ring(pl.X(SEE.value), pl.Y(SEE.pay(SEE.value)), 10, c.ink, 1.5);
    if (this.touched) {
      const g = SEE.pay(this.probe);
      p.line(pl.X(this.probe), pl.base, pl.X(this.probe), pl.Y(g), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.probe), pl.Y(g), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Sale, v: number): void {
    const R = clamp(Math.min((f.w - 24) / (2 + 2 * q.others.length), (f.h - 100) / 2.2), 10, 34);
    const cy = f.top + R + 8;
    const rad = (x: number) => R * Math.sqrt(clamp(x, 0, 10) / 10);
    const n = 1 + q.others.length;
    const gap = Math.min(2.6 * R, (f.w - 40) / n);
    const xs = (i: number) => this.cx - ((n - 1) * gap) / 2 + i * gap;
    p.disc(xs(0), cy, rad(q.value), c.ink, 0.95);
    p.text(`you ${q.value}`, xs(0), cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    q.others.forEach((o, i) => {
      p.ring(xs(i + 1), cy, rad(o), c.ink, 1.5);
      p.text(String(o), xs(i + 1), cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
    p.text(`you pay ${n1(v)}`, this.cx, cy + R + 44, { font: Type.body(13, 400), color: c.fog, align: "center" });
  }
}
