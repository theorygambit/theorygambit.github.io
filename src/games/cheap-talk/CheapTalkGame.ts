import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { BLIND, FEEL_ROUNDS, SEE_MAX, Talk, isRight, literal, pay, proveSet } from "./model";

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/**
 * Feel: a sender with a bias says low or high about a hidden state. Believe it or ignore it.
 * See: drag the bias. What you learn falls and dies at a quarter.
 * Prove: new biases. Drag the cutoff where the sender switches from low to high.
 */
export class CheapTalkGame extends Lesson<Talk> {
  readonly slug = "cheap-talk";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 4;
  protected get choices(): [string, string] {
    return ["Believe it", "Ignore it"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: SEE_MAX, yMin: 0, yMax: 0.8, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private probe = 0.2;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`The sender says "${x.msg}".`, `Their bias is ${n2(x.b)}. Believe it or ignore it?`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const a = i === 0 ? literal(x.msg) : BLIND;
    const got = pay(a, x.state);
    const other = pay(i === 0 ? BLIND : literal(x.msg), x.state);
    return { pay: got, alt: other, prompt: `The state was ${n2(x.state)}.`, note: `You get ${n2(got)}. The other choice pays ${n2(other)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.probe = 0.2;
    return ["Drag the bias. How much can a message tell you?", "Try a small bias and a large one."];
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
    const b = clamp(Math.round(this.plot.valueAtX(x) * 50) / 50, 0, SEE_MAX);
    this.probe = b;
    this.touched = true;
    const t = new Talk(b);
    this.low = this.low || b <= 0.06;
    this.high = this.high || b >= 0.3;
    this.note.set(`Bias ${n2(b)}: ${t.informative() ? `they switch at ${n2(t.cutoff())}, you learn ${n2(t.gain())}` : "the message tells you nothing"}.`);
    if (this.low && this.high) this.reachSee("Beyond a quarter, talk is just noise.");
  }

  seeScript(): [number, number][] {
    return [this.plot.X(0.04), this.plot.X(0.35)].map((x) => [x, this.plot.top + 40]);
  }
  protected seeFinishDebug(): void {
    this.setProbe(this.plot.X(0.04));
    this.setProbe(this.plot.X(0.35));
  }
  override seePartialDebug(): void {
    this.setProbe(this.plot.X(0.12));
  }

  protected makePuzzles(): Talk[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Talk): [string, string] {
    return [`Bias ${n2(q.b)}. Where do they switch from low to high?`, "Drag the state where they are indifferent."];
  }
  protected answerSpec(_q: Talk): Answer {
    return { mode: "slider", min: 0, max: 0.5, step: 0.01, init: 0.25, labels: ["", ""], fmt: n2 };
  }
  protected judge(q: Talk, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: q.informative() ? `Right. Low below ${n2(q.cutoff())}, high above.` : "Right. They always say high.", note: "The cutoff is one half minus twice the bias." };
    return { ok: false, prompt: v > q.cutoff() ? "Too high." : "Too low.", note: `The cutoff is 0.5 minus 2 times ${n2(q.b)}, and never below zero.` };
  }
  protected readonly closing: [string, string] = ["Cheap talk works only when interests are close.", "Past a quarter of bias, nothing is learned."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.1, 0.2, 0.3, 0.4], xLabel: "bias of the sender", yLabel: "what you learn", fmt: n2 });
    pl.curve(p, (b) => new Talk(b).gain(), c.ink, 1.75, 1, 40);
    if (this.seeDone) p.ring(pl.X(0.25), pl.Y(0), 10, c.ink, 1.5);
    if (this.touched) {
      const g = new Talk(this.probe).gain();
      p.line(pl.X(this.probe), pl.base, pl.X(this.probe), pl.Y(g), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.probe), pl.Y(g), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Talk, v: number): void {
    const x0 = f.x + 30;
    const x1 = f.x + f.w - 30;
    const y = f.top + 70;
    const X = (s: number) => x0 + s * (x1 - x0);
    p.rule(x0, y, x1, y, c.ink, 0.5);
    for (const s of [0, 1]) p.rule(X(s), y - 5, X(s), y + 5, c.ink, 0.5);
    p.text("0", X(0), y + 28, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("1", X(1), y + 28, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("low", X(v / 2), y - 22, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text("high", X((1 + v) / 2), y - 22, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.line(X(v), y - 12, X(v), y + 12, c.ink, 1.5, 0.9);
    p.disc(X(v), y, 7, c.ink);
    if (this.locked) p.ring(X(q.cutoff()), y, 12, c.ink, 1.5, this.mark.value);
    p.text(`bias ${n2(q.b)}`, this.cx, y + 56, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
