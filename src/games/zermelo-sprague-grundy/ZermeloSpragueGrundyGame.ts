import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, NAMES, SEE_PILES, after, holds, moverWins, proveSet, winningMove, xor } from "./model";

const word = (m: [number, number]): string => `Take ${m[1]} from ${NAMES[m[0]]}`;

/**
 * Feel: a game of Nim against a perfect player. Pick the move that leaves them stuck.
 * See: tap a token to take it and everything beyond it. Find the move where the xor of the piles is zero.
 * Prove: who wins from this position, the player to move or the other?
 */
export class ZermeloSpragueGrundyGame extends Lesson<number[]> {
  readonly slug = "zermelo-sprague-grundy";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [word(r.a), word(r.b)];
  }

  private piles = [...SEE_PILES];
  private tried = 0;
  private done0 = false;
  private grid: { x: number; y: number }[][] = [];
  private cellR = 10;

  protected feelIntro(r: number): [string, string] {
    return [`Piles of ${FEEL_ROUNDS[r]!.piles.join(", ")}. Last token wins.`, "They play perfectly. Pick your move."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const m = i === 0 ? x.a : x.b;
    const o = i === 0 ? x.b : x.a;
    const win = holds(x, m);
    return { pay: win ? 6 : 0, alt: holds(x, o) ? 6 : 0, prompt: win ? `Leaves ${after(x.piles, m[0], m[1]).join(", ")}. They are stuck.` : `Leaves ${after(x.piles, m[0], m[1]).join(", ")}. They win.`, note: win ? "You hold the win." : "They have a move that leaves you stuck." };
  }

  protected seeStart(): [string, string] {
    this.piles = [...SEE_PILES];
    this.tried = 0;
    this.done0 = false;
    return ["Tap a token to take it and all beyond it.", "Find a move that makes the xor zero."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    this.cellR = clamp(Math.min((f.w - 110) / 14, (f.h - 90) / 7), 8, 14);
    const gap = this.cellR * 2.6;
    this.grid = SEE_PILES.map((n, i) => Array.from({ length: n }, (_, j) => ({ x: f.x + 56 + j * gap, y: f.top + 24 + i * (this.cellR * 2.8) })));
  }

  protected override seeDown(x: number, y: number): void {
    for (let i = 0; i < SEE_PILES.length; i++) {
      for (let j = 0; j < SEE_PILES[i]!; j++) {
        const g = this.grid[i]![j]!;
        if (Math.hypot(x - g.x, y - g.y) <= this.cellR * 1.4) {
          this.take(i, SEE_PILES[i]! - j);
          return;
        }
      }
    }
  }

  private take(pile: number, k: number): void {
    this.piles = after(SEE_PILES, pile, k);
    this.tried++;
    const z = xor(this.piles);
    this.note.set(z === 0 ? `Piles ${this.piles.join(", ")}. The xor is zero.` : `Piles ${this.piles.join(", ")}. The xor is ${z}, not zero.`);
    if (z === 0 && this.tried >= 2) this.reachSee("Leave xor zero and they are stuck.");
    if (z === 0) this.done0 = true;
  }

  seeScript(): [number, number][] {
    const a = this.grid[1]![2]!;
    const b = this.grid[0]![1]!;
    return [[a.x, a.y], [b.x, b.y]];
  }
  protected seeFinishDebug(): void {
    this.take(1, 1);
    this.take(0, 2);
  }
  override seePartialDebug(): void {
    this.take(1, 1);
  }

  protected makePuzzles(): number[][] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: number[]): [string, string] {
    return [`Piles of ${q.join(", ")}. You move first.`, "Who wins with perfect play?"];
  }
  protected answerSpec(_q: number[]): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: ["You win", "They win"], fmt: String };
  }
  protected judge(q: number[], v: number): Verdict {
    const w = moverWins(q);
    const ok = (v === 0) === w;
    const m = winningMove(q);
    const bits = q.map((n) => n.toString(2)).join(" xor ");
    if (w) return ok ? { ok, prompt: "Right. You can leave xor zero.", note: m ? `${word(m)} to leave ${after(q, m[0], m[1]).join(", ")}.` : "" } : { ok, prompt: "The xor is not zero.", note: m ? `${word(m)} leaves xor zero. You win.` : "" };
    return ok ? { ok, prompt: "Right. The xor is already zero.", note: `${bits} is 0. Every move breaks it.` } : { ok, prompt: "The xor is already zero.", note: `${bits} is 0. Whatever you take, they restore it.` };
  }
  protected readonly closing: [string, string] = ["Someone always has a winning plan in a finite game of perfect information.", "In Nim, it is to leave xor zero."];

  protected drawSee(p: Painter, c: Colors, f: Frame): void {
    SEE_PILES.forEach((n, i) => {
      const left = this.piles[i]!;
      for (let j = 0; j < n; j++) {
        const g = this.grid[i]![j]!;
        if (j < left) p.disc(g.x, g.y, this.cellR * 0.8, c.ink, 0.95);
        else p.ring(g.x, g.y, this.cellR * 0.8, c.ink, 0.75, 0.35);
      }
      p.text(String(left), f.x + 26, this.grid[i]![0]!.y + 4, { font: Type.mono(13), color: c.ink, align: "center" });
    });
    const z = xor(this.piles);
    const y = this.grid[2]![0]!.y + this.cellR * 3.2;
    p.text(`xor ${z}`, this.cx, y, { font: Type.mono(14), color: z === 0 ? c.ink : c.fog, align: "center" });
    void this.done0;
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: number[], _v: number): void {
    const r = clamp(Math.min((f.w - 90) / 16, (f.h - 80) / 8), 6, 12);
    q.forEach((n, i) => {
      const y = f.top + 20 + i * (r * 2.8);
      for (let j = 0; j < n; j++) p.disc(f.x + 50 + j * r * 2.5, y, r * 0.8, c.ink, 0.95);
      p.text(String(n), f.x + 22, y + 4, { font: Type.mono(13), color: c.ink, align: "center" });
    });
  }
}
