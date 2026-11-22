import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Council, FEEL_ROUNDS, SEE, answer, isRight, proveSet, type Case } from "./model";

const NAMES = "ABCD";

/**
 * Feel: pick a seat on a council. You are paid for each group of the others you tip over the quota.
 * See: tap each group of the other seats. The seat swings only where it turns a loss into a win.
 * Prove: count the swings for a seat on a new council.
 */
export class BanzhafIndexGame extends Lesson<Case> {
  readonly slug = "banzhaf-index";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Seat ${r.w[r.a]}`, `Seat ${r.w[r.b]}`];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];
  private groups: number[][] = [];

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`Seats weigh ${x.w.join(", ")}. A motion needs ${x.q}.`, "You earn 1 for each group of the others you tip."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const c = new Council(x.w, x.q);
    const mine = c.count(i === 0 ? x.a : x.b);
    const alt = c.count(i === 0 ? x.b : x.a);
    return { pay: mine, alt, prompt: mine > 0 ? `You tip ${mine} group${mine === 1 ? "" : "s"}.` : "You never tip a vote.", note: `You get ${mine}. The other seat gets ${alt}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["You hold 3. Others hold 2 and 2. Need 4.", "Tap each group of the others."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    this.groups = SEE.groups(0);
    const w = (f.w - 36) / 2;
    const h = clamp((f.h - 60) / 2, 44, 80);
    this.cell = this.groups.map((_, i) => ({ x: f.x + 12 + (i % 2) * (w + 12), y: f.top + 8 + Math.floor(i / 2) * (h + 8), w, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    const g = this.groups[i]!;
    const s = SEE.sum(g);
    this.note.set(SEE.swings(0, g) ? `They hold ${s}. With you ${s + 3}. You swing it.` : s >= SEE.quota ? `They hold ${s} and already win.` : `They hold ${s}. With you ${s + 3}, still short.`);
    if (this.seen.size === this.groups.length) this.reachSee(`You swing ${SEE.count(0)} of 4 groups.`);
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
    return [`Seats ${q.c.w.join(", ")}. A motion needs ${q.c.quota}.`, "How many groups does the filled seat tip?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 8, step: 1, init: 0, labels: ["", ""], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    const tips = q.c.groups(q.seat).filter((g) => q.c.swings(q.seat, g)).map((g) => (g.length ? g.map((i) => q.c.w[i]).join("+") : "none"));
    if (isRight(q, v)) return { ok: true, prompt: a === 0 ? "Right. This seat never tips a vote." : `Right. It tips ${a}.`, note: a === 0 ? "No group is short by exactly the right amount." : `It swings: ${tips.join(", ")}.` };
    return { ok: false, prompt: v > a ? "Too many." : "Too few.", note: a === 0 ? "A swing needs the group just short of the quota." : `It swings only: ${tips.join(", ")}.` };
  }
  protected readonly closing: [string, string] = ["Power is how often you decide the vote.", "Weight is not power."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.cell.forEach((b, i) => {
      p.frame(b.x, b.y, b.w, b.h, c.ink, 0.5);
      const g = this.groups[i]!;
      const label = g.length ? g.map((k) => NAMES[k + 1]).join(" ") : "alone";
      const on = this.seen.has(i);
      p.text(label, b.x + 12, b.y + b.h / 2 + 4, { font: Type.mono(12), color: on ? c.ink : c.fog, align: "left" });
      if (!on) return;
      const sw = SEE.swings(0, g);
      if (sw) p.disc(b.x + b.w - 24, b.y + b.h / 2, 8, c.ink, 0.95);
      else p.ring(b.x + b.w - 24, b.y + b.h / 2, 8, c.ink, 1, 0.6);
      p.text(String(SEE.sum(g)), b.x + b.w - 52, b.y + b.h / 2 + 4, { font: Type.mono(12), color: c.ink, align: "right" });
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const n = q.c.w.length;
    const R = clamp(Math.min((f.w - 24) / (n * 2.6), (f.h - 80) / 2.4), 10, 34);
    const cy = f.top + R + 8;
    const m = Math.max(...q.c.w);
    q.c.w.forEach((w, i) => {
      const x = this.cx + (i - (n - 1) / 2) * 2.6 * R;
      const r = R * Math.sqrt(w / m);
      if (i === q.seat) p.disc(x, cy, r, c.ink, 0.95);
      else p.ring(x, cy, r, c.ink, 1.5);
      p.text(String(w), x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
