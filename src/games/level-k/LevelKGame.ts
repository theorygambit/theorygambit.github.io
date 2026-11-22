import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, SEE_LEVELS, SEE_START, answer, closeness, guess, isRight, proveSet, target, type Case } from "./model";

const r0 = (v: number): string => String(Math.round(v));

/**
 * Feel: guess two thirds of the crowd's average. The crowd has a known average.
 * See: tap down the ladder. Each level guesses two thirds of the one below.
 * Prove: what does level k guess, from a level 0 average?
 */
export class LevelKGame extends Lesson<Case> {
  readonly slug = "level-k";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Guess ${r.a}`, `Guess ${r.b}`];
  }

  private shown = 0;
  private rows: { y: number; h: number }[] = [];
  private x0 = 0;
  private x1 = 0;

  protected feelIntro(r: number): [string, string] {
    return [`The crowd averages ${FEEL_ROUNDS[r]!.mean}.`, "Be closest to two thirds of it."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const g = i === 0 ? x.a : x.b;
    const h = i === 0 ? x.b : x.a;
    return { pay: 6 * closeness(g, x.mean), alt: 6 * closeness(h, x.mean), prompt: `Two thirds of ${x.mean} is ${r0(target(x.mean))}.`, note: `You guessed ${g}. The other guess was ${h}.` };
  }

  protected seeStart(): [string, string] {
    this.shown = 1;
    return [`Level 0 guesses ${SEE_START}. Tap for the next level.`, "Each level guesses two thirds of the last."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const h = clamp((f.h - 20) / SEE_LEVELS, 30, 56);
    this.rows = Array.from({ length: SEE_LEVELS }, (_, i) => ({ y: f.top + 10 + i * h, h }));
    this.x0 = f.x + 64;
    this.x1 = f.x + f.w - 28;
  }

  protected override seeDown(_x: number, _y: number): void {
    if (this.shown >= SEE_LEVELS) return;
    this.shown++;
    const g = guess(SEE_START, this.shown - 1);
    this.note.set(`Level ${this.shown - 1} guesses ${r0(g)}.`);
    if (this.shown === SEE_LEVELS) this.reachSee("Each step ahead lands lower. Real players stop after one or two.");
  }

  seeScript(): [number, number][] {
    const y = this.frame.top + 40;
    return Array.from({ length: SEE_LEVELS - 1 }, () => [this.cx, y] as [number, number]);
  }
  protected seeFinishDebug(): void {
    while (this.shown < SEE_LEVELS) this.seeDown(0, 0);
  }
  override seePartialDebug(): void {
    this.seeDown(0, 0);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Level 0 guesses ${q.start}.`, `Each level guesses 2/3 of the last. Level ${q.level}?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 50, labels: ["", ""], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. Level ${q.level} guesses ${r0(a)}.`, note: `${q.start} times 2/3, ${q.level} times.` };
    return { ok: false, prompt: v > a ? "Too high." : "Too low.", note: `Multiply ${q.start} by 2/3, ${q.level} time${q.level === 1 ? "" : "s"}: ${r0(a)}.` };
  }
  protected readonly closing: [string, string] = ["Think one step beyond the crowd, not ten.", "Most people stop after one or two steps."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    p.rule(this.x0, this.rows[0]!.y - 4, this.x0, this.rows[SEE_LEVELS - 1]!.y + this.rows[SEE_LEVELS - 1]!.h - 4, c.ink, 0.5);
    for (let i = 0; i < this.shown; i++) {
      const row = this.rows[i]!;
      const g = guess(SEE_START, i);
      const y = row.y + row.h / 2;
      p.text(`L${i}`, this.x0 - 16, y + 4, { font: Type.mono(12), color: c.fog, align: "right" });
      const x = this.x0 + 14 + (g / SEE_START) * (this.x1 - this.x0 - 40);
      p.disc(x, y, 7, c.ink, i === this.shown - 1 ? 1 : 0.5);
      p.text(r0(g), x + 20, y + 4, { font: Type.mono(12), color: c.ink, align: "left" });
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (x: number) => R * Math.sqrt(clamp(x, 0, 100) / 100);
    p.ring(this.cx - 2 * R, cy, rad(q.start), c.ink, 1.5);
    p.disc(this.cx + 2 * R, cy, rad(v), c.ink, 0.95);
    p.text(`level 0: ${q.start}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`level ${q.level}: ${r0(v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
