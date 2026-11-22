import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { BET_NAMES, FEEL_CHANCE, KNOWN, PRIZE, Urn, answer, pairBets, proveSet, type Case } from "./model";

const pc = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: bet on a known urn or an unknown one. The unknown mix is revealed afterwards.
 * See: drag your guess for the black count. Red against black flips, and so does red or yellow against black or yellow.
 * Prove: given a guess, which bet wins more often?
 */
export class EllsbergAmbiguityGame extends Lesson<Case> {
  readonly slug = "ellsberg-ambiguity";
  protected readonly rounds = FEEL_CHANCE.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Known urn", "Unknown urn"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 60, yMin: 0, yMax: 1, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private k = 30;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(_r: number): [string, string] {
    return ["Bet red. The known urn is half red.", "The other urn has an unknown mix."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const u = FEEL_CHANCE[r]!;
    const got = (i === 0 ? KNOWN : u) * PRIZE;
    const alt = (i === 0 ? u : KNOWN) * PRIZE;
    return { pay: got, alt, prompt: `The unknown urn was ${pc(u)} red.`, note: `Your bet is worth ${Math.round(got * 10) / 10}. The other is worth ${Math.round(alt * 10) / 10}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.k = 30;
    return ["30 red. 60 black or yellow, mix unknown.", "Drag your guess for how many are black."];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.setK(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setK(x);
  }

  private setK(x: number): void {
    this.k = clamp(Math.round(this.plot.valueAtX(x) / 5) * 5, 0, 60);
    this.touched = true;
    this.low = this.low || this.k <= 20;
    this.high = this.high || this.k >= 40;
    const u = new Urn(this.k);
    this.note.set(`${this.k} black. Likelier: ${BET_NAMES[u.better("A", "B")]}, and ${BET_NAMES[u.better("C", "D")]}.`);
    if (this.low && this.high) this.reachSee("No single guess prefers red and black or yellow.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(10), y], [this.plot.X(50), y]];
  }
  protected seeFinishDebug(): void {
    this.setK(this.plot.X(10));
    this.setK(this.plot.X(50));
  }
  override seePartialDebug(): void {
    this.setK(this.plot.X(20));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Guess: ${q.black} of the 60 are black.`, "Which bet wins more often?"];
  }
  protected answerSpec(q: Case): Answer {
    const [a, b] = pairBets(q);
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: [BET_NAMES[a], BET_NAMES[b]], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const u = new Urn(q.black);
    const [a, b] = pairBets(q);
    const ok = v === answer(q);
    const note = `${BET_NAMES[a]} wins ${pc(u.chance(a))}. ${BET_NAMES[b]} wins ${pc(u.chance(b))}.`;
    return ok ? { ok, prompt: `Right. ${BET_NAMES[answer(q) === 0 ? a : b]} is likelier.`, note } : { ok, prompt: "Count the balls each bet wins on.", note };
  }
  protected readonly closing: [string, string] = ["Preferring the known odds both times cannot fit any one guess.", "That dislike of the unknown is ambiguity aversion."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 20, 40, 60], xLabel: "black balls", yLabel: "chance to win", fmt: (v) => String(v) });
    pl.curve(p, () => 30 / 90, c.ink, 1.25, 0.6, 2);
    pl.curve(p, (k) => k / 90, c.ink, 1.75, 1, 24);
    if (this.touched) {
      p.line(pl.X(this.k), pl.base, pl.X(this.k), pl.Y(this.k / 90), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.k), pl.Y(this.k / 90), 6, c.ink);
      p.ring(pl.X(this.k), pl.Y(30 / 90), 6, c.ink, 1.25);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const u = new Urn(q.black);
    const [a, b] = pairBets(q);
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(u.chance(a)), c.ink, 1.5);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(u.chance(b)), c.ink, 1.5);
    p.text(BET_NAMES[a], this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(BET_NAMES[b], this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
