import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, SEE, isRight, proveSet, type Gain } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you are paid what you add when you join. Join first or join last.
 * See: tap the six join orders. Your Shapley value is the average of what you added.
 * Prove: new coalition values. Find the average.
 */
export class ShapleyValueGame extends Lesson<Gain> {
  readonly slug = "shapley-value";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Join first", "Join last"];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    const g = FEEL_ROUNDS[r]!;
    return ["You are paid what you add on joining.", `Alone ${g.solo}. The other two ${g.bc}. All three ${g.abc}.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const g = FEEL_ROUNDS[r]!;
    const first = g.solo;
    const last = g.last();
    const got = i === 0 ? first : last;
    const alt = i === 0 ? last : first;
    return { pay: got, alt, prompt: i === 0 ? `Joining first adds ${first}.` : `Joining last adds ${last}.`, note: `You get ${got}. The other spot gives ${alt}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["Tap each join order for what A adds.", "Then average the six."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const w = (f.w - 36) / 2;
    const h = clamp((f.h - 80) / 3, 40, 70);
    this.cell = [];
    for (let i = 0; i < 6; i++) this.cell.push({ x: f.x + 12 + (i % 2) * (w + 12), y: f.top + 8 + Math.floor(i / 2) * (h + 8), w, h });
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    const o = SEE.orders()[i]!;
    this.note.set(`${o.order}: A adds ${o.add}.`);
    if (this.seen.size === 6) this.reachSee(`The average is ${n1(SEE.shapley())}. That is A's share.`);
  }

  seeScript(): [number, number][] {
    return this.cell.map((c) => [c.x + c.w / 2, c.y + c.h / 2] as [number, number]);
  }
  protected seeFinishDebug(): void {
    for (let i = 0; i < 6; i++) this.seeDown(this.cell[i]!.x + 2, this.cell[i]!.y + 2);
  }
  override seePartialDebug(): void {
    for (let i = 0; i < 3; i++) this.seeDown(this.cell[i]!.x + 2, this.cell[i]!.y + 2);
  }

  protected makePuzzles(): Gain[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(_q: Gain): [string, string] {
    return ["Each coalition earns what is shown.", "What is A's Shapley value?"];
  }
  protected answerSpec(_q: Gain): Answer {
    return { mode: "slider", min: 0, max: 8, step: 0.5, init: 4, labels: ["", ""], fmt: n1 };
  }
  protected judge(q: Gain, v: number): Verdict {
    const o = q.orders().map((x) => x.add);
    if (isRight(q, v)) return { ok: true, prompt: `Right. The average is ${n1(q.shapley())}.`, note: `A adds ${o.join(", ")} across the six orders.` };
    return { ok: false, prompt: v > q.shapley() ? "Too high." : "Too low.", note: `A adds ${o.join(", ")}. Average them: ${n1(q.shapley())}.` };
  }
  protected readonly closing: [string, string] = ["Pay each player the average of what they add.", "It is fair across every order they could arrive in."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const o = SEE.orders();
    this.cell.forEach((b, i) => {
      p.frame(b.x, b.y, b.w, b.h, c.ink, 0.5);
      const on = this.seen.has(i);
      p.text(o[i]!.order, b.x + 12, b.y + b.h / 2 + 4, { font: Type.mono(12), color: on ? c.ink : c.fog, align: "left" });
      if (on) {
        const r = clamp(Math.sqrt(o[i]!.add / 8) * 12, 2, 12);
        p.disc(b.x + b.w - 52, b.y + b.h / 2, r, c.ink, 0.95);
        p.text(String(o[i]!.add), b.x + b.w - 16, b.y + b.h / 2 + 4, { font: Type.mono(12), color: c.ink, align: "right" });
      }
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Gain, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 11, (f.h - 80) / 2.4), 10, 34);
    const cy = f.top + R + 8;
    const items: [string, number][] = [["AB", q.ab], ["AC", q.ac], ["BC", q.bc], ["ABC", q.abc]];
    const gap = Math.min(2.6 * R, (f.w - 30) / 4);
    items.forEach(([l, v], i) => {
      const x = this.cx + (i - 1.5) * gap;
      p.ring(x, cy, R * Math.sqrt(v / 12), c.ink, 1.5);
      p.text(`${l} ${v}`, x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
