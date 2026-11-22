import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, IDEAS, answerSlot, proveSet, type Case } from "./model";

/**
 * Feel: four quick situations, one for each of dominance, mixing, trust and fairness.
 * See: tap each idea on the board. Each has a rule and a situation where it applies.
 * Prove: name the idea that fits a situation.
 */
export class SynthesisBoardGame extends Lesson<Case> {
  readonly slug = "synthesis-board";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!.labels;
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    return FEEL_ROUNDS[r]!.intro;
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    return { pay: x.pay[i], alt: x.pay[i === 0 ? 1 : 0], prompt: x.pay[i] >= x.pay[i === 0 ? 1 : 0] ? `${x.labels[i]} pays ${x.pay[i]}.` : `${x.labels[i]} pays only ${x.pay[i]}.`, note: x.why };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["Five ideas make up the board. Tap each.", "Each fits one kind of situation."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const h = clamp((f.h - 24) / IDEAS.length, 38, 56);
    this.cell = IDEAS.map((_, i) => ({ x: f.x + 12, y: f.top + 8 + i * (h + 4), w: f.w - 24, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    this.note.set(IDEAS[i]!.rule);
    if (this.seen.size === IDEAS.length) this.reachSee("Name the structure first. Then the move follows.");
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
    return [IDEAS[q.idea]!.clue, "Which idea does this call for?"];
  }
  protected answerSpec(q: Case): Answer {
    const a = IDEAS[q.idea]!.name;
    const b = IDEAS[q.other]!.name;
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: q.first ? [a, b] : [b, a], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const i = IDEAS[q.idea]!;
    const ok = v === answerSlot(q);
    return ok ? { ok, prompt: `Right. ${i.name}.`, note: i.rule } : { ok, prompt: `This is ${i.name.toLowerCase()}.`, note: i.rule };
  }
  protected readonly closing: [string, string] = ["Name the structure, then pick the move.", "That is the whole board."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.cell.forEach((b, i) => {
      const on = this.seen.has(i);
      p.frame(b.x, b.y, b.w, b.h, c.ink, on ? 0.7 : 0.4);
      p.text(IDEAS[i]!.name, b.x + 14, b.y + b.h / 2 + 4, { font: Type.body(14, 400), color: on ? c.ink : c.fog, align: "left" });
      if (on) p.disc(b.x + b.w - 20, b.y + b.h / 2, 6, c.ink, 0.95);
      else p.ring(b.x + b.w - 20, b.y + b.h / 2, 6, c.ink, 1, 0.5);
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 8, (f.h - 80) / 2.4), 12, 34);
    const cy = f.top + R + 8;
    IDEAS.forEach((_, i) => {
      const x = this.cx + (i - 2) * 2.3 * R;
      if (i === q.idea) p.disc(x, cy, R * 0.6, c.ink, 0.95);
      else p.ring(x, cy, R * 0.6, c.ink, 1, 0.5);
    });
  }
}
