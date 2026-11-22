import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { BET, FEEL_GAPS, SAFE, chance, isRight, percent, proveSet, type Case } from "./model";

const pc = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: the rival picks the better move most of the time, not always. Bet on it or take the safe prize.
 * See: drag the payoff gap. The chance of the better move rises smoothly, never jumping to certain.
 * Prove: from a gap and a sharpness, find the chance in percent.
 */
export class QuantalResponseGame extends Lesson<Case> {
  readonly slug = "quantal-response";
  protected readonly rounds = FEEL_GAPS.length;
  protected readonly payMax = 4;
  protected get choices(): [string, string] {
    return ["Bet they pick better", `Take ${SAFE}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 4, yMin: 0.5, yMax: 1, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private gap = 1;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    return [`Their better move is worth ${FEEL_GAPS[r]} more.`, `Bet wins ${BET} if they pick it. Or take ${SAFE}.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const p = chance(1, FEEL_GAPS[r]!);
    const bet = BET * p;
    return { pay: i === 0 ? bet : SAFE, alt: i === 0 ? SAFE : bet, prompt: `They pick the better move ${pc(p)} of the time.`, note: `The bet is worth ${Math.round(bet * 10) / 10}. The safe prize is ${SAFE}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.gap = 1;
    return ["Drag the payoff gap between their two moves.", "How often do they pick the better one?"];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.setGap(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setGap(x);
  }

  private setGap(x: number): void {
    this.gap = clamp(Math.round(this.plot.valueAtX(x) * 4) / 4, 0, 4);
    this.touched = true;
    this.low = this.low || this.gap <= 0.5;
    this.high = this.high || this.gap >= 3;
    this.note.set(`Gap ${this.gap}: better move ${pc(chance(1, this.gap))}.`);
    if (this.low && this.high) this.reachSee("Bigger gaps are chosen more, but never always.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(0.25), y], [this.plot.X(3.5), y]];
  }
  protected seeFinishDebug(): void {
    this.setGap(this.plot.X(0.25));
    this.setGap(this.plot.X(3.5));
  }
  override seePartialDebug(): void {
    this.setGap(this.plot.X(1));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Sharpness ${q.lambda}. The better move is worth ${q.gap} more.`, "How often is it chosen, in percent?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 50, max: 100, step: 1, init: 75, labels: ["50", "100"], fmt: (v) => `${v}%` };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = percent(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. About ${a}%.`, note: `1 / (1 + e^(-${q.lambda} x ${q.gap})).` };
    return { ok: false, prompt: v > a ? "Too sure." : "Not that low.", note: `The chance is 1 / (1 + e^(-${q.lambda} x ${q.gap})), about ${a}%.` };
  }
  protected readonly closing: [string, string] = ["Better moves are chosen more often, not always.", "Noise fades as the stakes grow."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 1, 2, 3, 4], xLabel: "payoff gap", yLabel: "better move", fmt: (v) => String(v) });
    pl.curve(p, (g) => chance(1, g), c.ink, 1.75, 1, 40);
    if (this.touched) {
      const y = chance(1, this.gap);
      p.line(pl.X(this.gap), pl.base, pl.X(this.gap), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.gap), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(v / 100), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt((100 - v) / 100), c.ink, 1.5);
    p.text(`better ${Math.round(v)}%`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`other ${Math.round(100 - v)}%`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    void q;
  }
}
