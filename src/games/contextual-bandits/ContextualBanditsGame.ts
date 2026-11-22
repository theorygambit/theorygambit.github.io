import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, PRIZE, better, reward, proveSet, type Case } from "./model";

const pc = (v: number): string => `${Math.round(v * 100)}%`;
const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: overall A is the favourite. A person arrives, and you pick what to show them.
 * See: drag how often you explore. Never exploring gets stuck. Always exploring wastes the best.
 * Prove: given a person and the click rates, which option do you show?
 */
export class ContextualBanditsGame extends Lesson<Case> {
  readonly slug = "contextual-bandits";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Show A", "Show B"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0.2, yMax: 0.7, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private eps = 0.1;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    return ["Overall, A is clicked more than B.", `A ${FEEL_ROUNDS[r]!.who} arrives. Show A or B?`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const mine = i === 0 ? x.a : x.b;
    const other = i === 0 ? x.b : x.a;
    return { pay: PRIZE * mine, alt: PRIZE * other, prompt: `This ${x.who} clicks A ${pc(x.a)} and B ${pc(x.b)}.`, note: `Your pick pays ${n1(PRIZE * mine)}. The other pays ${n1(PRIZE * other)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.eps = 0.1;
    return ["Drag how often you try the other option.", "Never trying gets stuck. Always trying wastes."];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.set(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.set(x);
  }

  private set(px: number): void {
    this.eps = clamp(Math.round(this.plot.valueAtX(px) * 20) / 20, 0, 1);
    this.touched = true;
    this.low = this.low || this.eps <= 0.05;
    this.high = this.high || this.eps >= 0.6;
    this.note.set(`Explore ${Math.round(this.eps * 100)}%. Clicks ${pc(reward(this.eps))}.`);
    if (this.low && this.high) this.reachSee("Explore a little: enough to learn, not enough to waste.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(0), y], [this.plot.X(0.8), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(0));
    this.set(this.plot.X(0.8));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(0.3));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Overall A ${q.overallA}%, B ${q.overallB}%. A ${q.who}: A ${Math.round(q.a * 100)}%, B ${Math.round(q.b * 100)}%.`, "Which do you show this person?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: ["Show A", "Show B"], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const ok = v === better(q);
    const note = `For a ${q.who}: A ${Math.round(q.a * 100)}%, B ${Math.round(q.b * 100)}%.`;
    return ok ? { ok, prompt: `Right. Show ${better(q) === 0 ? "A" : "B"}.`, note: "Use the person's rates, not the overall average." } : { ok, prompt: "Use this person's rates.", note };
  }
  protected readonly closing: [string, string] = ["Pick by who is looking, and keep trying a little.", "That is a contextual bandit."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "share of time exploring", yLabel: "clicks", fmt: (v) => String(v) });
    pl.curve(p, (e) => reward(e), c.ink, 1.75, 1, 40);
    if (this.touched) {
      const y = reward(this.eps);
      p.line(pl.X(this.eps), pl.base, pl.X(this.eps), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.eps), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(q.a), c.ink, 1.5);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(q.b), c.ink, 1.5);
    p.text(`A ${Math.round(q.a * 100)}%`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`B ${Math.round(q.b * 100)}%`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
