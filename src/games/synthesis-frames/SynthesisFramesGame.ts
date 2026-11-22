import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, PASS, SEE_ORDER, SEE_PRIOR, SELLERS, buyValue, isRight, percent, posterior, proveSet, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);
const pc = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: a seller says "Premium". Buy or pass, knowing how many sellers are strong and how this seller behaves.
 * See: tap each kind of seller. The same message is worth different amounts, depending on how far they reason.
 * Prove: from a prior and a bluff rate, how likely is a Premium seller strong?
 */
export class SynthesisFramesGame extends Lesson<Case> {
  readonly slug = "synthesis-frames";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Buy", `Pass for ${PASS}`];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`${pc(x.prior)} of sellers are strong. This one says "Premium".`, `This seller ${SELLERS[x.seller]!.desc}.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const b = buyValue(x);
    return { pay: i === 0 ? b : PASS, alt: i === 0 ? PASS : b, prompt: `A Premium seller is strong ${pc(posterior(x.prior, SELLERS[x.seller]!.bluff))} of the time.`, note: `Buying is worth ${n1(b)}. Passing is ${PASS}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return [`${pc(SEE_PRIOR)} of sellers are strong. Tap each kind.`, "How much is the word Premium worth?"];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const w = (f.w - 40) / 3;
    const h = clamp(f.h - 90, 70, 150);
    this.cell = SEE_ORDER.map((_, i) => ({ x: f.x + 12 + i * (w + 8), y: f.top + 12, w, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    const s = SELLERS[SEE_ORDER[i]!]!;
    this.note.set(`A seller who ${s.desc}: strong ${pc(posterior(SEE_PRIOR, s.bluff))} of the time.`);
    if (this.seen.size === SEE_ORDER.length) this.reachSee("Same word, three meanings. Read the speaker's level too.");
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
    return [`${pc(q.prior)} are strong. Weak sellers say Premium ${pc(q.bluff)} of the time.`, "A seller says Premium. Chance it is strong?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 50, labels: ["0", "100"], fmt: (v) => `${v}%` };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = percent(q);
    const strong = q.prior;
    const weak = (1 - q.prior) * q.bluff;
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${a}%.`, note: `Strong ${n1(strong * 100)} against weak ${n1(weak * 100)} who also say it.` };
    return { ok: false, prompt: v > a ? "Too sure." : "Weak sellers say it too.", note: `Strong ${n1(strong * 100)} out of ${n1((strong + weak) * 100)} Premium sellers is ${a}%.` };
  }
  protected readonly closing: [string, string] = ["A message is worth what the sender's type and level make it.", "Update on the prior, and on who is speaking."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.cell.forEach((b, i) => {
      const s = SELLERS[SEE_ORDER[i]!]!;
      const on = this.seen.has(i);
      p.frame(b.x, b.y, b.w, b.h, c.ink, 0.5);
      p.text(s.short, b.x + b.w / 2, b.y + 20, { font: Type.mono(12), color: on ? c.ink : c.fog, align: "center" });
      if (!on) return;
      const post = posterior(SEE_PRIOR, s.bluff);
      const R = clamp(b.w / 3.4, 10, 26);
      const cy = b.y + b.h / 2 + 6;
      p.ring(b.x + b.w / 2, cy, R, c.ink, 0.75, 0.4);
      p.disc(b.x + b.w / 2, cy, R * Math.sqrt(post), c.ink, 0.95);
      p.text(pc(post), b.x + b.w / 2, b.y + b.h - 10, { font: Type.mono(12), color: c.ink, align: "center" });
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(q.prior), c.ink, 1.5);
    p.disc(this.cx + 2 * R, cy, R * Math.sqrt(clamp(v, 0, 100) / 100), c.ink, 0.95);
    p.text(`before ${pc(q.prior)}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`after ${Math.round(v)}%`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
