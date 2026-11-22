import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE_ALPHA, SEE_POT, felt, isRight, proveSet, seeUtility, value, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);
const pair = (x: [number, number]): string => `${x[0]} and ${x[1]}`;

/**
 * Feel: pick the split you would rather receive. How it feels depends on the gap, and on which side of it you are.
 * See: drag how much guilt you feel when ahead. The split that feels best moves from taking all to sharing.
 * Prove: compute the felt value of a split.
 */
export class InequityAversionGame extends Lesson<Case> {
  readonly slug = "inequity-aversion";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [pair(r.a), pair(r.b)];
  }

  private readonly plot = new Plot({ xMin: 3, xMax: 10, yMin: 0, yMax: 10, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private beta = 0.2;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(_r: number): [string, string] {
    return ["You and a stranger get these amounts.", "Pick the split you would rather have."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const mine = i === 0 ? x.a : x.b;
    const other = i === 0 ? x.b : x.a;
    const u = felt(mine[0], mine[1]);
    const v = felt(other[0], other[1]);
    return { pay: Math.max(0, u), alt: Math.max(0, v), prompt: `You get ${mine[0]}. They get ${mine[1]}. It feels like ${n1(u)}.`, note: `The other split would feel like ${n1(v)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.beta = 0.2;
    return ["You split 10. Drag how guilty being ahead feels.", "Where does your best share land?"];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, y: number): void {
    this.set(x, y);
  }
  protected override seeMove(x: number, y: number): void {
    this.set(x, y);
  }

  private set(px: number, _y: number): void {
    const f = this.frame;
    this.beta = clamp(Math.round(((px - f.x) / f.w) * 10) / 10, 0, 1);
    this.touched = true;
    this.low = this.low || this.beta <= 0.2;
    this.high = this.high || this.beta >= 0.7;
    this.note.set(`Guilt ${n1(this.beta)}. Best share to keep: ${this.beta > 0.5 ? "5, an even split" : "10, everything"}.`);
    if (this.low && this.high) this.reachSee("Enough guilt makes sharing feel better than taking.");
  }

  seeScript(): [number, number][] {
    const f = this.frame;
    const y = f.top + 40;
    return [[f.x + f.w * 0.1, y], [f.x + f.w * 0.9, y]];
  }
  protected seeFinishDebug(): void {
    const f = this.frame;
    this.set(f.x + f.w * 0.1, 0);
    this.set(f.x + f.w * 0.9, 0);
  }
  override seePartialDebug(): void {
    this.set(this.frame.x + this.frame.w * 0.3, 0);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`You get ${q.x}. They get ${q.y}.`, `Behind costs ${q.alpha} each. Ahead costs ${q.beta}. Felt value?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: -6, max: 8, step: 1, init: 0, labels: ["", ""], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = value(q);
    const gap = Math.abs(q.x - q.y);
    if (isRight(q, v)) return { ok: true, prompt: `Right. It feels like ${n1(a)}.`, note: `${q.x} less ${n1((q.x < q.y ? q.alpha : q.beta) * gap)} for the gap of ${gap}.` };
    return { ok: false, prompt: q.x < q.y ? "You are behind, so use the first rate." : "You are ahead, so use the second rate.", note: `${q.x} less ${q.x < q.y ? q.alpha : q.beta} x ${gap} is ${n1(a)}.` };
  }
  protected readonly closing: [string, string] = ["People pay to avoid unfairness, more when behind than when ahead.", "That is why low offers get refused."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [3, 5, 7, 10], xLabel: "your share of 10", yLabel: "how it feels", fmt: (v) => String(v) });
    pl.curve(p, (x) => Math.max(0, seeUtility(x, this.beta)), c.ink, 1.75, 1, 28);
    const best = this.beta > 0.5 ? 5 : 10;
    if (this.touched) {
      const y = Math.max(0, seeUtility(best, this.beta));
      p.ring(pl.X(best), pl.Y(y), 8, c.ink, 1.5);
    }
    void SEE_ALPHA;
    void SEE_POT;
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(q.x / 10), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(q.y / 10), c.ink, 1.5);
    p.text(`you ${q.x}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`them ${q.y}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
