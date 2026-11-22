import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { COUNTER, FEEL_ROUNDS, SEE_MOVES, answer, isRight, pay, proveSet, type Case } from "./model";

/**
 * Feel: they play the game they can see. Use a move they know, which they counter, or one they cannot see.
 * See: tap each of your moves to see what they would do. They have no reply to the move outside their picture.
 * Prove: what do you get from a move, given whether they can see it?
 */
export class HypergameTheoryGame extends Lesson<Case> {
  readonly slug = "hypergame-theory";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Known move", "Hidden move"];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`The move they know is worth ${x.seen}. They counter it for ${COUNTER}.`, `Your hidden move is worth ${x.hidden}. They cannot see it.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const a = pay(x.seen, true);
    const b = pay(x.hidden, false);
    return { pay: i === 0 ? a : b, alt: i === 0 ? b : a, prompt: i === 0 ? `They counter it. You keep ${a}.` : `They cannot answer it. You keep ${b}.`, note: `Known move ${a}. Hidden move ${b}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["You hold three moves. They see only A and B.", "Tap each move to see what they do."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const w = (f.w - 40) / 3;
    const h = clamp(f.h - 90, 70, 150);
    this.cell = SEE_MOVES.map((_, i) => ({ x: f.x + 12 + i * (w + 8), y: f.top + 12, w, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    const m = SEE_MOVES[i]!;
    this.note.set(m.seen ? `${m.name} is worth ${m.raw}. They counter it. You keep ${pay(m.raw, true)}.` : `${m.name} is worth ${m.raw}. They never see it. You keep ${m.raw}.`);
    if (this.seen.size === SEE_MOVES.length) this.reachSee("The best move can be the one outside their picture.");
  }

  seeScript(): [number, number][] {
    return this.cell.map((c) => [c.x + c.w / 2, c.y + c.h / 2] as [number, number]);
  }
  protected seeFinishDebug(): void {
    this.cell.forEach((c) => this.seeDown(c.x + 2, c.y + 2));
  }
  override seePartialDebug(): void {
    this.seeDown(this.cell[0]!.x + 2, this.cell[0]!.y + 2);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Your move is worth ${q.v}. They ${q.seen ? "see" : "cannot see"} it.`, `A counter takes ${q.k}. What do you get?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 10, step: 1, init: 5, labels: ["", ""], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${a}.`, note: q.seen ? `${q.v} less the counter of ${q.k}, not below zero.` : "They cannot counter what they cannot see." };
    return { ok: false, prompt: q.seen ? "They can see it, so they counter." : "They cannot see it, so no counter.", note: q.seen ? `${q.v} less ${q.k}, not below zero, is ${a}.` : `You keep the full ${q.v}.` };
  }
  protected readonly closing: [string, string] = ["Each side plays the game it sees.", "The contest is over whose picture is right."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.cell.forEach((b, i) => {
      const m = SEE_MOVES[i]!;
      const on = this.seen.has(i);
      p.frame(b.x, b.y, b.w, b.h, c.ink, m.seen ? 0.5 : 0.35);
      p.text(m.name, b.x + b.w / 2, b.y + 20, { font: Type.mono(12), color: on ? c.ink : c.fog, align: "center" });
      if (!on) return;
      const cy = b.y + b.h / 2 + 4;
      const R = clamp(b.w / 4, 8, 22);
      if (m.seen) {
        p.ring(b.x + b.w / 2, cy, R * Math.sqrt(m.raw / 10), c.ink, 1.25, 0.5);
        p.disc(b.x + b.w / 2, cy, R * Math.sqrt(pay(m.raw, true) / 10), c.ink, 0.95);
      } else p.disc(b.x + b.w / 2, cy, R * Math.sqrt(m.raw / 10), c.ink, 0.95);
      p.text(m.seen ? "countered" : "unseen", b.x + b.w / 2, b.y + b.h - 10, { font: Type.mono(11), color: c.fog, align: "center" });
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    if (q.seen) p.ring(this.cx - 2 * R, cy, R * Math.sqrt(q.v / 10), c.ink, 1.5);
    else p.ring(this.cx - 2 * R, cy, R * Math.sqrt(q.v / 10), c.ink, 1, 0.45);
    p.disc(this.cx + 2 * R, cy, R * Math.sqrt(clamp(v, 0, 10) / 10), c.ink, 0.95);
    p.text(q.seen ? `seen ${q.v}` : `unseen ${q.v}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`you ${Math.round(v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
