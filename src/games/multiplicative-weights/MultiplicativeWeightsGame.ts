import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, SEE_LOSSES, answer, isRight, pick, proveSet, seeShares, spread, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);
const pct = (w: readonly number[]): string => w.map((x) => Math.round(x * 100)).join(", ");

/**
 * Feel: past results give each option a weight. Back the heaviest, or spread by weight.
 * See: tap to play rounds. Options that lose shrink, and the shares move smoothly.
 * Prove: what is a weight after a round with a given loss?
 */
export class MultiplicativeWeightsGame extends Lesson<Case> {
  readonly slug = "multiplicative-weights";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Back the heaviest", "Spread by weight"];
  }

  private k = 0;

  protected feelIntro(r: number): [string, string] {
    return [`Option weights: ${pct(FEEL_ROUNDS[r]!.weights)} percent.`, "Back the heaviest, or spread by weight?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const a = pick(x);
    const b = spread(x);
    return { pay: i === 0 ? a : b, alt: i === 0 ? b : a, prompt: `They pay ${x.next.join(", ")}.`, note: `Heaviest earns ${n1(a)}. Spreading earns ${n1(b)}.` };
  }

  protected seeStart(): [string, string] {
    this.k = 0;
    return ["Three options start equal. Tap to play a round.", "Losers lose weight. Watch the shares."];
  }

  protected override seeDown(_x: number, _y: number): void {
    if (this.k >= SEE_LOSSES.length) return;
    this.k++;
    const s = seeShares(this.k);
    this.note.set(`Round ${this.k}. Shares ${pct(s)} percent.`);
    if (this.k === SEE_LOSSES.length) this.reachSee("Weights shrink smoothly. No option is ever dropped.");
  }

  seeScript(): [number, number][] {
    const y = this.frame.top + 40;
    return Array.from({ length: SEE_LOSSES.length }, () => [this.cx, y] as [number, number]);
  }
  protected seeFinishDebug(): void {
    while (this.k < SEE_LOSSES.length) this.seeDown(0, 0);
  }
  override seePartialDebug(): void {
    this.seeDown(0, 0);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Weight ${q.w}. Learning rate ${q.eps}.`, `It loses ${q.loss} this round. New weight?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 50, labels: ["0", "100"], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${n1(a)}.`, note: `${q.w} x (1 - ${q.eps} x ${q.loss}).` };
    return { ok: false, prompt: v > a ? "Too high." : "Too low.", note: `${q.w} x (1 - ${q.eps} x ${q.loss}) = ${n1(a)}.` };
  }
  protected readonly closing: [string, string] = ["Shrink what loses, never to zero.", "Over time it matches the best option in hindsight."];

  protected drawSee(p: Painter, c: Colors, f: Frame): void {
    const s = seeShares(this.k);
    const R = clamp(Math.min((f.w - 24) / 8.4, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 20;
    s.forEach((v, i) => {
      const x = this.cx + (i - 1) * 3 * R;
      p.ring(x, cy, R, c.ink, 0.5, 0.35);
      p.disc(x, cy, R * Math.sqrt(v), c.ink, 0.95);
      p.text(`${"ABC"[i]} ${Math.round(v * 100)}%`, x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
    if (this.k > 0) {
      const l = SEE_LOSSES[this.k - 1]!;
      p.text(`lost: ${l.map((x, i) => (x ? "ABC"[i] : "")).join(" ").replace(/\s+/g, " ").trim()}`, this.cx, cy + R + 44, { font: Type.mono(12), color: c.fog, align: "center" });
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(q.w / 100), c.ink, 1.5);
    p.disc(this.cx + 2 * R, cy, R * Math.sqrt(clamp(v, 0, 100) / 100), c.ink, 0.95);
    p.text(`now ${q.w}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`next ${Math.round(v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
