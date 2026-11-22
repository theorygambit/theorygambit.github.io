import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE_YOU, accept, isRight, percent, proveSet, value, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you have a desirability score. Ask someone near you or someone far above.
 * See: drag how desirable they are. The payoff peaks near your own level.
 * Prove: what is the chance they accept?
 */
export class DesirabilityRsrrGame extends Lesson<Case> {
  readonly slug = "desirability-rsrr";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Ask a ${r.a}`, `Ask a ${r.b}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 100, yMin: 0, yMax: 4, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private them = 50;
  private touched = false;
  private low = false;
  private high = false;
  private mid = false;

  protected feelIntro(r: number): [string, string] {
    return [`Your score is ${FEEL_ROUNDS[r]!.you}, how often others pick you.`, "Whom do you ask?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const t = i === 0 ? x.a : x.b;
    const o = i === 0 ? x.b : x.a;
    return { pay: value(x.you, t), alt: value(x.you, o), prompt: `A ${t} says yes ${Math.round(accept(x.you, t) * 100)}% of the time.`, note: `You expect ${n1(value(x.you, t))}. The other ask is worth ${n1(value(x.you, o))}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.mid = false;
    this.them = 50;
    return [`Your score is ${SEE_YOU}. Drag the other's score.`, "Worth times the chance of yes."];
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
    this.them = clamp(Math.round(this.plot.valueAtX(px) / 5) * 5, 0, 100);
    this.touched = true;
    this.low = this.low || this.them <= 20;
    this.high = this.high || this.them >= 85;
    this.mid = this.mid || Math.abs(this.them - SEE_YOU) <= 5;
    this.note.set(`Score ${this.them}. Expected ${n1(value(SEE_YOU, this.them))}.`);
    if (this.low && this.high && this.mid) this.reachSee("Aim near your own level. Reaching far rarely lands.");
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
    return [`You are ${q.you}, they are ${q.them}. Chance of yes?`, "Each point above you costs 3.3 percent."];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 50, labels: ["0", "100"], fmt: (v) => `${v}%` };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = percent(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${a}%.`, note: q.them <= q.you ? "They are at or below you, so they say yes." : `${q.them - q.you} above you, ${a}% left.` };
    return { ok: false, prompt: q.them <= q.you ? "They are not above you." : "Subtract the gap over 30.", note: q.them <= q.you ? "Below your level, the chance is 100%." : `1 - ${q.them - q.you}/30 is ${a}%.` };
  }
  protected readonly closing: [string, string] = ["Rank by how often people choose you, and match near your level.", "Watch the loop: top profiles get picked more because they are shown more."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 25, 50, 75, 100], xLabel: "their score", yLabel: "expected worth", fmt: (v) => String(v) });
    pl.curve(p, (t) => value(SEE_YOU, t), c.ink, 1.75, 1, 50);
    if (this.touched) {
      const y = value(SEE_YOU, this.them);
      p.line(pl.X(this.them), pl.base, pl.X(this.them), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.them), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(q.you / 100), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(q.them / 100), c.ink, 1.5);
    p.text(`you ${q.you}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`them ${q.them}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
