import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, Matrix, SEE, isRight, proveSet } from "./model";

const n2 = (v: number): string => String(Math.round(v * 100) / 100);

/**
 * Feel: pick a mix between two rows. They answer with the worst column for you.
 * See: drag the mix. Your guaranteed payoff is the lower of two lines, and it peaks where they cross.
 * Prove: from new payoffs, find the value of the game.
 */
export class LinearProgrammingZeroSumGame extends Lesson<Matrix> {
  readonly slug = "linear-programming-zero-sum";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 4;
  protected get choices(): [string, string] {
    return ["Play evenly", "Play the safe mix"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0, yMax: 5, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private p = 0.5;
  private touched = false;
  private low = false;
  private high = false;
  private near = false;

  protected feelIntro(r: number): [string, string] {
    const m = FEEL_ROUNDS[r]!;
    return [`Top row pays ${m.a} or ${m.b}. Bottom pays ${m.c} or ${m.d}.`, "They pick the column that hurts you."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const m = FEEL_ROUNDS[r]!;
    const even = m.floor(0.5);
    const safe = m.value();
    return { pay: i === 0 ? even : safe, alt: i === 0 ? safe : even, prompt: i === 0 ? `Evenly, you are sure of ${n2(even)}.` : `The safe mix puts ${Math.round(m.best() * 100)}% on top.`, note: `Safe mix guarantees ${n2(safe)}. Evenly guarantees ${n2(even)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.near = false;
    this.p = 0.5;
    return [`Top row pays ${SEE.a} or ${SEE.b}. Bottom pays ${SEE.c} or ${SEE.d}.`, "Drag your chance of top. Find the best floor."];
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
    this.p = clamp(Math.round(this.plot.valueAtX(px) * 20) / 20, 0, 1);
    this.touched = true;
    this.low = this.low || this.p <= 0.05;
    this.high = this.high || this.p >= 0.9;
    this.near = this.near || SEE.floor(this.p) >= SEE.value() - 0.15;
    this.note.set(`Top ${Math.round(this.p * 100)}%. You are sure of ${n2(SEE.floor(this.p))}.`);
    if (this.near && (this.low || this.high)) this.reachSee(`Best floor ${n2(SEE.value())}, where the lines cross.`);
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(0.95), y], [this.plot.X(SEE.best()), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(0.95));
    this.set(this.plot.X(SEE.best()));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(0.6));
  }

  protected makePuzzles(): Matrix[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Matrix): [string, string] {
    return [`Top row pays ${q.a} or ${q.b}. Bottom pays ${q.c} or ${q.d}.`, "What payoff can you guarantee at best?"];
  }
  protected answerSpec(_q: Matrix): Answer {
    return { mode: "slider", min: 0, max: 6, step: 0.5, init: 3, labels: ["", ""], fmt: n2 };
  }
  protected judge(q: Matrix, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: `Right. The value is ${n2(q.value())}.`, note: `Mix ${Math.round(q.best() * 100)}% top so both columns pay the same.` };
    return { ok: false, prompt: v > q.value() ? "You cannot guarantee that much." : "You can guarantee more.", note: `Make both columns equal: ${Math.round(q.best() * 100)}% top gives ${n2(q.value())}.` };
  }
  protected readonly closing: [string, string] = ["Maximise the floor. That is a linear program.", "Its answer is the value of the game."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "chance of top row", yLabel: "your payoff", fmt: (v) => String(v) });
    pl.curve(p, (x) => SEE.lines(x)[0], c.ink, 1, 0.45, 2);
    pl.curve(p, (x) => SEE.lines(x)[1], c.ink, 1, 0.45, 2);
    pl.curve(p, (x) => SEE.floor(x), c.ink, 2, 1, 40);
    if (this.touched) {
      const y = SEE.floor(this.p);
      p.line(pl.X(this.p), pl.base, pl.X(this.p), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.p), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Matrix, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 11, (f.h - 80) / 2.4), 10, 30);
    const cy = f.top + R + 8;
    const cells = [q.a, q.b, q.c, q.d];
    const names = ["top left", "top right", "low left", "low right"];
    cells.forEach((v, i) => {
      const x = this.cx + (i - 1.5) * 2.5 * R;
      p.ring(x, cy, R * Math.sqrt(v / 6), c.ink, 1.5);
      p.text(String(v), x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
    void names;
  }
}
