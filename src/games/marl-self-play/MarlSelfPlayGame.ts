import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE_YOU, answer, gain, isRight, proveSet, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: train against a weaker or a stronger bot. Learning peaks against an equal.
 * See: drag the opponent's level. A copy of yourself is always the best match.
 * Prove: how much do you learn against a given opponent?
 */
export class MarlSelfPlayGame extends Lesson<Case> {
  readonly slug = "marl-self-play";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Bot ${r.a}`, `Bot ${r.b}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 100, yMin: 0, yMax: 6, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private opp = 50;
  private touched = false;
  private low = false;
  private high = false;
  private mid = false;

  protected feelIntro(r: number): [string, string] {
    return [`Your level is ${FEEL_ROUNDS[r]!.you}. Pick a bot to train against.`, "You learn most from a match."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const g = gain(x.you, i === 0 ? x.a : x.b);
    const h = gain(x.you, i === 0 ? x.b : x.a);
    return { pay: g, alt: h, prompt: `You learned ${n1(g)}.`, note: `The other bot would have taught ${n1(h)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.mid = false;
    this.opp = 50;
    return [`Your level is ${SEE_YOU}. Drag the opponent's level.`, "Where do you learn most?"];
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
    this.opp = clamp(Math.round(this.plot.valueAtX(px) / 5) * 5, 0, 100);
    this.touched = true;
    this.low = this.low || this.opp <= 15;
    this.high = this.high || this.opp >= 85;
    this.mid = this.mid || Math.abs(this.opp - SEE_YOU) <= 5;
    this.note.set(`Opponent ${this.opp}. You learn ${n1(gain(SEE_YOU, this.opp))}.`);
    if (this.low && this.high && this.mid) this.reachSee("A copy of yourself teaches most. That is self-play.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(10), y], [this.plot.X(90), y], [this.plot.X(50), y]];
  }
  protected seeFinishDebug(): void {
    for (const v of [10, 90, 50]) this.set(this.plot.X(v));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(30));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`You are level ${q.you}. The bot is level ${q.opp}.`, "Learning is 6 minus 6 per 40 of gap. How much?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 6, step: 0.5, init: 3, labels: ["", ""], fmt: n1 };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${n1(a)}.`, note: `A gap of ${Math.abs(q.you - q.opp)} costs ${n1(6 - a)} of the 6.` };
    return { ok: false, prompt: v > a ? "Too much." : "More than that.", note: `Gap ${Math.abs(q.you - q.opp)} is ${n1((Math.abs(q.you - q.opp) / 40) * 6)} below 6, so ${n1(a)}.` };
  }
  protected readonly closing: [string, string] = ["Train against opponents near your level.", "A copy of yourself is always a perfect match."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 25, 50, 75, 100], xLabel: "opponent level", yLabel: "you learn", fmt: (v) => String(v) });
    pl.curve(p, (o) => gain(SEE_YOU, o), c.ink, 1.75, 1, 40);
    if (this.touched) {
      const y = gain(SEE_YOU, this.opp);
      p.line(pl.X(this.opp), pl.base, pl.X(this.opp), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.opp), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(q.you / 100), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(q.opp / 100), c.ink, 1.5);
    p.text(`you ${q.you}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`bot ${q.opp}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
