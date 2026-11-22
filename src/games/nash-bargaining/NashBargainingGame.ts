import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE, isRight, proveSet, type Pact } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: offer a split. They accept only a fair share of the gain over walking away.
 * See: drag your share on a plot of the product of gains. It peaks at one split.
 * Prove: new fallbacks. Where does the product peak?
 */
export class NashBargainingGame extends Lesson<Pact> {
  readonly slug = "nash-bargaining";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 8;
  protected get choices(): [string, string] {
    return ["Split evenly", "Split the gain"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 12, yMin: 0, yMax: 18, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private x1 = 0;
  private touched = false;
  private left = false;
  private right = false;
  private peak = false;

  protected feelIntro(r: number): [string, string] {
    const g = FEEL_ROUNDS[r]!;
    return [`The pot is 12. No deal pays you ${g.d1} and them ${g.d2}.`, "They accept only a fair share of the gain."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const g = FEEL_ROUNDS[r]!;
    const even = g.total / 2;
    const mine = g.pay(i === 0 ? even : g.nash());
    const alt = g.pay(i === 0 ? g.nash() : even);
    const took = i === 0 ? even : g.nash();
    return { pay: mine, alt, prompt: g.accepts(took) ? `You offer ${n1(took)}. They accept.` : `You offer ${n1(took)}. They refuse.`, note: g.accepts(took) ? `You get ${n1(mine)}. The other offer gets ${n1(alt)}.` : `You each walk away. You get ${g.d1}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.left = false;
    this.right = false;
    this.peak = false;
    return [`No deal pays you ${SEE.d1} and them ${SEE.d2}. Pot 12.`, "Drag your share. Watch the product of gains."];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.setX(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setX(x);
  }

  private setX(px: number): void {
    this.x1 = clamp(Math.round(this.plot.valueAtX(px) * 2) / 2, 0, 12);
    this.touched = true;
    this.left = this.left || this.x1 <= 5;
    this.right = this.right || this.x1 >= 9;
    this.peak = this.peak || Math.abs(this.x1 - SEE.nash()) <= 0.5;
    this.note.set(`You take ${n1(this.x1)}. Gains multiply to ${n1(SEE.product(this.x1))}.`);
    if (this.left && this.right && this.peak) this.reachSee(`It peaks at ${n1(SEE.nash())}. Split the gain in half.`);
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(4), y], [this.plot.X(10), y], [this.plot.X(7), y]];
  }
  protected seeFinishDebug(): void {
    for (const v of [4, 10, 7]) this.setX(this.plot.X(v));
  }
  override seePartialDebug(): void {
    this.setX(this.plot.X(4));
  }

  protected makePuzzles(): Pact[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Pact): [string, string] {
    return [`The pot is ${q.total}. No deal pays you ${q.d1} and them ${q.d2}.`, "What share maximises the product of gains?"];
  }
  protected answerSpec(q: Pact): Answer {
    return { mode: "slider", min: 0, max: q.total, step: 1, init: Math.round(q.total / 2), labels: ["", ""], fmt: String };
  }
  protected judge(q: Pact, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: `Right. You take ${n1(q.nash())}.`, note: `Each of you gains ${n1((q.total - q.d1 - q.d2) / 2)} over walking away.` };
    return { ok: false, prompt: v > q.nash() ? "Too greedy." : "Too generous.", note: `Split the ${q.total - q.d1 - q.d2} of gain in half, then add your ${q.d1}.` };
  }
  protected readonly closing: [string, string] = ["Split the gain over walking away, not the whole pot.", "The better your fallback, the more you keep."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 3, 6, 9, 12], xLabel: "your share", yLabel: "product", fmt: String });
    pl.curve(p, (x) => SEE.product(x), c.ink, 1.75, 1, 48);
    if (this.seeDone) p.ring(pl.X(SEE.nash()), pl.Y(SEE.product(SEE.nash())), 10, c.ink, 1.5);
    if (this.touched) {
      const y = SEE.product(this.x1);
      p.line(pl.X(this.x1), pl.base, pl.X(this.x1), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.x1), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Pact, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (x: number) => R * Math.sqrt(clamp(x, 0, q.total) / q.total);
    p.disc(this.cx - 2 * R, cy, rad(v), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, rad(q.total - v), c.ink, 1.5);
    p.text(`you ${n1(v)}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`them ${n1(q.total - v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
