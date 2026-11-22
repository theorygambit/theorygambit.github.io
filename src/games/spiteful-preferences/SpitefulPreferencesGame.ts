import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_OTHER, FEEL_OWN, FEEL_ROUNDS, FEEL_SPITE, SEE_COST, SEE_HARM, burn, isRight, keep, proveSet, threshold, utility, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you are spiteful. Pay a cost to cut their payoff, or keep what you have.
 * See: drag how spiteful you are. Burning only pays above one level.
 * Prove: at what spite is paying to harm just worth it?
 */
export class SpitefulPreferencesGame extends Lesson<Case> {
  readonly slug = "spiteful-preferences";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Pay to cut theirs", "Keep both"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0, yMax: 6, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private s = 0.5;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`You and they each have ${FEEL_OWN}. You dislike their gain.`, `Pay ${x.cost} to cut theirs by ${x.harm}?`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const b = burn(x);
    const k = keep();
    return { pay: Math.max(0, i === 0 ? b : k), alt: Math.max(0, i === 0 ? k : b), prompt: i === 0 ? `You pay ${x.cost}. They lose ${x.harm}.` : "You keep both payoffs.", note: `Burning feels like ${n1(b)}. Keeping feels like ${n1(k)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.s = 0.5;
    return [`Pay ${SEE_COST} to cut their ${FEEL_OTHER} by ${SEE_HARM}. Drag your spite.`, "Where does burning start to pay?"];
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
    this.s = clamp(Math.round(this.plot.valueAtX(px) * 20) / 20, 0, 1);
    this.touched = true;
    this.low = this.low || this.s <= 0.2;
    this.high = this.high || this.s >= 0.6;
    const b = utility(FEEL_OWN - SEE_COST, FEEL_OTHER - SEE_HARM, this.s);
    const k = utility(FEEL_OWN, FEEL_OTHER, this.s);
    this.note.set(b > k ? `Spite ${n1(this.s)}: burning feels better.` : `Spite ${n1(this.s)}: keeping feels better.`);
    if (this.low && this.high) this.reachSee(`Burning pays once spite passes ${n1(SEE_COST / SEE_HARM)}.`);
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(0.1), y], [this.plot.X(0.8), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(0.1));
    this.set(this.plot.X(0.8));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(0.3));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Pay ${q.cost} to cut their payoff by ${q.harm}.`, "At what spite, in percent, is it worth it?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 50, labels: ["0", "100"], fmt: (v) => `${v}%` };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = threshold(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. At ${a}%.`, note: `Harm is worth spite x ${q.harm}. It must reach the cost of ${q.cost}.` };
    return { ok: false, prompt: v > a ? "It pays sooner than that." : "It does not pay yet.", note: `Spite x ${q.harm} equals ${q.cost} at ${a}%.` };
  }
  protected readonly closing: [string, string] = ["Spite is worth harm times spite, against the cost.", "Raise the cost of harm and fewer players pay it."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "your spite", yLabel: "how it feels", fmt: (v) => String(v) });
    pl.curve(p, (s) => utility(FEEL_OWN, FEEL_OTHER, s), c.ink, 1.25, 0.6, 20);
    pl.curve(p, (s) => utility(FEEL_OWN - SEE_COST, FEEL_OTHER - SEE_HARM, s), c.ink, 1.75, 1, 20);
    if (this.touched) {
      const b = utility(FEEL_OWN - SEE_COST, FEEL_OTHER - SEE_HARM, this.s);
      p.line(pl.X(this.s), pl.base, pl.X(this.s), pl.Y(b), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.s), pl.Y(b), 6, c.ink);
    }
    void FEEL_SPITE;
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(q.cost / 8), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(q.harm / 8), c.ink, 1.5);
    p.text(`cost ${q.cost}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`harm ${q.harm}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
