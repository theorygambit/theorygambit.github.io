import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE_MAX, answer, brute, decoy, pay, path, proveSet, type Case } from "./model";

const big = (v: number): string => (v >= 1e6 ? `${Math.round(v / 1e5) / 10} million` : String(v));

/**
 * Feel: find an equilibrium of a bigger and bigger game. Check every pair of supports, or follow one path.
 * See: drag the number of actions. The number of supports to check explodes.
 * Prove: how many pairs of supports does brute force check?
 */
export class LemkeHowsonGame extends Lesson<Case> {
  readonly slug = "lemke-howson";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Check every support", "Follow one path"];
  }

  private readonly plot = new Plot({ xMin: 1, xMax: SEE_MAX, yMin: 0, yMax: 7, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private n = 3;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    const n = FEEL_ROUNDS[r]!.n;
    return [`A game with ${n} actions each. Find an equilibrium.`, "Fewer checks pay more."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const n = FEEL_ROUNDS[r]!.n;
    const a = brute(n);
    const b = path(n);
    return { pay: pay(i === 0 ? a : b), alt: pay(i === 0 ? b : a), prompt: i === 0 ? `You check ${a} pairs of supports.` : `You follow a path of about ${b} steps.`, note: i === 0 ? `A path takes about ${b} steps.` : `Checking every support needs ${a}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.n = 3;
    return ["Drag the number of actions each side has.", "How many pairs of supports could be the answer?"];
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
    this.n = clamp(Math.round(this.plot.valueAtX(px)), 1, SEE_MAX);
    this.touched = true;
    this.low = this.low || this.n <= 3;
    this.high = this.high || this.n >= 8;
    this.note.set(`${this.n} actions: ${big(brute(this.n))} pairs of supports.`);
    if (this.low && this.high) this.reachSee("Checking everything explodes. Path following dodges it, usually.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(2), y], [this.plot.X(9), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(2));
    this.set(this.plot.X(9));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(5));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`${q.n} actions each. Each side picks any group as its support.`, "How many pairs of groups is that?"];
  }
  protected answerSpec(q: Case): Answer {
    const flip = q.n % 2 === 1;
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: flip ? [String(decoy(q)), String(answer(q))] : [String(answer(q)), String(decoy(q))], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const ok = (v === 0) === (q.n % 2 === 0);
    const note = `Each side has 2^${q.n} - 1 = ${Math.pow(2, q.n) - 1} groups. Squared: ${answer(q)}.`;
    return ok ? { ok, prompt: `Right. ${answer(q)} pairs.`, note } : { ok, prompt: "Each side picks any non-empty group.", note };
  }
  protected readonly closing: [string, string] = ["Checking a candidate is easy. Finding one is the hard part.", "No fast method is known for every game."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [1, 3, 5, 7, 10], xLabel: "actions each", yLabel: "digits to check", fmt: (v) => String(v) });
    pl.curve(p, (n) => Math.log10(brute(n)), c.ink, 1.75, 1, 36);
    pl.curve(p, (n) => Math.log10(path(n)), c.ink, 1.25, 0.55, 36);
    if (this.touched) {
      const y = Math.log10(brute(this.n));
      p.line(pl.X(this.n), pl.base, pl.X(this.n), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.n), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const s = clamp(Math.min((f.w - 40) / (q.n * 1.5), (f.h - 80) / (q.n * 1.2)), 6, 14);
    const x0 = this.cx - ((q.n - 1) * 2.4 * s) / 2;
    for (let i = 0; i < q.n; i++) {
      p.disc(x0 + i * 2.4 * s, f.top + 24, s * 0.7, c.ink, 0.95);
      p.ring(x0 + i * 2.4 * s, f.top + 24 + 3 * s, s * 0.7, c.ink, 1.25);
    }
    p.text(`${q.n} each`, this.cx, f.top + 24 + 6.4 * s, { font: Type.body(13, 400), color: c.fog, align: "center" });
  }
}
