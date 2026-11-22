import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_PRIORS, Persuasion, SEE_PRIOR, isRight, proveSet } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: you want a conviction. Reveal the truth or reveal less.
 * See: drag how often you say guilty about the innocent. Convictions climb, then fall off a cliff.
 * Prove: new priors. Drag to the most you can say before the judge stops believing you.
 */
export class BayesianPersuasionGame extends Lesson<Persuasion> {
  readonly slug = "bayesian-persuasion";
  protected readonly rounds = FEEL_PRIORS.length;
  protected readonly payMax = 10;
  protected get choices(): [string, string] {
    return ["Reveal the truth", "Reveal less"];
  }

  private readonly see = new Persuasion(SEE_PRIOR);
  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0, yMax: 1, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private probe = 0;
  private touched = false;
  private nearPeak = false;
  private pastPeak = false;

  protected feelIntro(r: number): [string, string] {
    return [`${pct(FEEL_PRIORS[r]!)} of defendants are guilty.`, "You want a conviction. Reveal the truth or reveal less?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const m = new Persuasion(FEEL_PRIORS[r]!);
    const a = i === 0 ? m.truth() : m.best();
    const b = i === 0 ? m.best() : m.truth();
    return { pay: a * 10, alt: b * 10, prompt: `They convict ${pct(a)} of the time.`, note: `The other policy convicts ${pct(b)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.nearPeak = false;
    this.pastPeak = false;
    this.probe = 0;
    return ["Drag how often you say guilty about the innocent.", "Watch the conviction rate."];
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
    const q = clamp(Math.round(this.plot.valueAtX(x) * 50) / 50, 0, 1);
    this.probe = q;
    this.touched = true;
    const m = this.see;
    this.nearPeak = this.nearPeak || Math.abs(q - m.bestQ()) <= 0.06;
    this.pastPeak = this.pastPeak || q >= m.bestQ() + 0.15;
    this.note.set(`At ${pct(q)}: they believe guilt is ${pct(m.posterior(q))}, and convict ${pct(m.convict(q))}.`);
    if (this.nearPeak && this.pastPeak) this.reachSee("Say as much as keeps their belief at one half.");
  }

  seeScript(): [number, number][] {
    const m = this.see;
    return [this.plot.X(m.bestQ()), this.plot.X(0.9)].map((x) => [x, this.plot.top + 40]);
  }
  protected seeFinishDebug(): void {
    this.setProbe(this.plot.X(this.see.bestQ()));
    this.setProbe(this.plot.X(0.9));
  }
  override seePartialDebug(): void {
    this.setProbe(this.plot.X(0.2));
  }

  protected makePuzzles(): Persuasion[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Persuasion): [string, string] {
    return [`${pct(q.p)} are guilty. How often can you say guilty about the innocent?`, "Drag until the judge's belief is just one half."];
  }
  protected answerSpec(_q: Persuasion): Answer {
    return { mode: "slider", min: 0, max: 1, step: 0.01, init: 0, labels: ["", ""], fmt: pct };
  }
  protected judge(q: Persuasion, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: `Right. They convict ${pct(q.best())} of the time.`, note: "Twice the prior, while the belief stays at one half." };
    return { ok: false, prompt: v > q.bestQ() ? "Too high. They stop convicting." : "Too low. You could say more.", note: `At ${pct(v)}: belief ${pct(q.posterior(v))}, convictions ${pct(q.convict(v))}.` };
  }
  protected readonly closing: [string, string] = ["Choose what to reveal, and you choose what they believe.", "Aim the belief just at the point where they act."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.5, 1], xLabel: "how often you say guilty about the innocent", yLabel: "convictions", fmt: pct });
    pl.curve(p, (q) => this.see.convict(q), c.ink, 1.75, 1, 100);
    if (this.seeDone) p.ring(pl.X(this.see.bestQ()), pl.Y(this.see.best()), 10, c.ink, 1.5);
    if (this.touched) {
      const k = this.see.convict(this.probe);
      p.line(pl.X(this.probe), pl.base, pl.X(this.probe), pl.Y(k), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.probe), pl.Y(k), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Persuasion, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 3, (f.h - 80) / 2.6), 16, 56);
    const cy = f.top + R + 8;
    p.ring(this.cx, cy, R, c.ink, 0.8, 0.5);
    p.disc(this.cx, cy, R * Math.sqrt(clamp(q.convict(v), 0, 1)), c.ink, 0.95);
    p.text(`convict ${pct(q.convict(v))}`, this.cx, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`belief ${pct(q.posterior(v))}`, this.cx, cy + R + 34, { font: Type.body(13, 400), color: c.fog, align: "center" });
  }
}
