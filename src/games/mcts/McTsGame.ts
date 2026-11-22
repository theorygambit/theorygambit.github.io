import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { C, FEEL_ROUNDS, PRIZE, SEE_TOTAL, SEE_WINRATE, next, proveSet, ucb, type Case, type Stat } from "./model";

const lab = (s: Stat): string => `won ${s.wins} of ${s.tries}`;
const n2 = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);

/**
 * Feel: random games were played from two moves. Pick the one to play.
 * See: drag how many games a move has had. Fewer games leave a bigger bonus for being unsure.
 * Prove: which of two moves does search try next?
 */
export class McTsGame extends Lesson<Case> {
  readonly slug = "mcts";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [lab(r.a), lab(r.b)];
  }

  private readonly plot = new Plot({ xMin: 1, xMax: 100, yMin: 0, yMax: 1.6, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private n = 10;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(_r: number): [string, string] {
    return ["Random games were played from each move.", "Which move do you play?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const m = i === 0 ? x.a : x.b;
    const o = i === 0 ? x.b : x.a;
    return { pay: PRIZE * m.truth, alt: PRIZE * o.truth, prompt: `That move truly wins ${Math.round(m.truth * 100)}%.`, note: `The other wins ${Math.round(o.truth * 100)}%. Few games can mislead.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.n = 10;
    return ["A move wins half its random games. Drag how many it has had.", "How big is the bonus for being unsure?"];
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
    this.n = clamp(Math.round(this.plot.valueAtX(px)), 1, 100);
    this.touched = true;
    this.low = this.low || this.n <= 5;
    this.high = this.high || this.n >= 60;
    this.note.set(`${this.n} games. Score ${n2(ucb(SEE_WINRATE * this.n, this.n, SEE_TOTAL))}, bonus ${n2(C * Math.sqrt(Math.log(SEE_TOTAL) / this.n))}.`);
    if (this.low && this.high) this.reachSee("Few games, big bonus. Search tries them first.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(3), y], [this.plot.X(80), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(3));
    this.set(this.plot.X(80));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(20));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`After ${q.total} searches. Bonus 0.5 x sqrt(ln ${q.total} / games).`, "Which move does search try next?"];
  }
  protected answerSpec(q: Case): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: [`A: ${q.a.wins} of ${q.a.tries}`, `B: ${q.b.wins} of ${q.b.tries}`], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const ua = ucb(q.a.wins, q.a.tries, q.total);
    const ub = ucb(q.b.wins, q.b.tries, q.total);
    const ok = v === next(q);
    const note = `Scores: A ${n2(ua)}, B ${n2(ub)}. The higher is tried.`;
    return ok ? { ok, prompt: `Right. ${next(q) === 0 ? "A" : "B"} is tried next.`, note } : { ok, prompt: "Add the bonus for fewer games.", note };
  }
  protected readonly closing: [string, string] = ["Win rate plus a bonus for being unsure.", "Search spends its games where the outcome is still open."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [1, 25, 50, 75, 100], xLabel: "games played", yLabel: "score", fmt: (v) => String(v) });
    pl.curve(p, () => SEE_WINRATE, c.ink, 1.25, 0.6, 2);
    pl.curve(p, (n) => ucb(SEE_WINRATE * n, n, SEE_TOTAL), c.ink, 1.75, 1, 60);
    if (this.touched) {
      const y = ucb(SEE_WINRATE * this.n, this.n, SEE_TOTAL);
      p.line(pl.X(this.n), pl.base, pl.X(this.n), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.n), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rate = (s: { wins: number; tries: number }) => s.wins / s.tries;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(rate(q.a)), c.ink, 1.5);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(rate(q.b)), c.ink, 1.5);
    p.text(`A  ${Math.round(rate(q.a) * 100)}%  n ${q.a.tries}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`B  ${Math.round(rate(q.b) * 100)}%  n ${q.b.tries}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
