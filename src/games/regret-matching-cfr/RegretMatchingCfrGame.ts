import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { ACTIONS, EVEN, FEEL_ROUNDS, SEE_MIX, SEE_OPP, matching, pay, percent, proveSet, regrets, isRight, type Case } from "./model";

const sg = (v: number): string => (v > 0 ? "+" : v < 0 ? "-" : "") + Math.abs(Math.round(v * 10) / 10).toFixed(1);

/**
 * Feel: play rock, paper, scissors against someone with a habit. Play evenly, or play by your regrets.
 * See: tap each action to see how much you regret not having played it. Your next mix follows the positive regrets.
 * Prove: from a set of regrets, how often do you play one action?
 */
export class RegretMatchingCfrGame extends Lesson<Case> {
  readonly slug = "regret-matching-cfr";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Play evenly", "Play by regret"];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];
  private reg = regrets(SEE_MIX, SEE_OPP);

  protected feelIntro(r: number): [string, string] {
    const o = FEEL_ROUNDS[r]!.opp;
    return [`They play rock ${Math.round(o[0] * 100)}%, paper ${Math.round(o[1] * 100)}%, scissors ${Math.round(o[2] * 100)}%.`, "You have not seen it. Play evenly or by regret?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const o = FEEL_ROUNDS[r]!.opp;
    const by = matching(regrets(EVEN, o));
    const a = pay(EVEN, o);
    const b = pay(by, o);
    return { pay: i === 0 ? a : b, alt: i === 0 ? b : a, prompt: i === 1 ? `Regrets point to ${ACTIONS[by.indexOf(Math.max(...by))]}.` : "You mixed evenly.", note: `Evenly pays ${Math.round(a * 10) / 10}. By regret pays ${Math.round(b * 10) / 10}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["You played paper every time. They play 30, 30, 40.", "Tap each action: how much do you regret it?"];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const w = (f.w - 40) / 3;
    const h = clamp(f.h - 90, 70, 150);
    this.cell = ACTIONS.map((_, i) => ({ x: f.x + 12 + i * (w + 8), y: f.top + 12, w, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    this.note.set(`${ACTIONS[i]}: regret ${sg(this.reg[i]!)}.`);
    if (this.seen.size === 3) {
      const m = matching(this.reg);
      this.reachSee(`Next: rock ${Math.round(m[0]! * 100)}%, paper ${Math.round(m[1]! * 100)}%, scissors ${Math.round(m[2]! * 100)}%.`);
    }
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
    return [`Regrets: rock ${q.r[0]}, paper ${q.r[1]}, scissors ${q.r[2]}.`, `How often do you play ${ACTIONS[q.idx]}, in percent?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 100, step: 1, init: 33, labels: ["0", "100"], fmt: (v) => `${v}%` };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = percent(q);
    const pos = q.r.filter((x) => x > 0);
    const s = pos.reduce((x, y) => x + y, 0);
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${a}%.`, note: `${Math.max(0, q.r[q.idx]!)} of the positive total ${s}.` };
    return { ok: false, prompt: v > a ? "Too often." : "Too rarely.", note: `Ignore negative regrets. ${Math.max(0, q.r[q.idx]!)} out of ${s} is ${a}%.` };
  }
  protected readonly closing: [string, string] = ["Play more of what you regret not playing.", "Repeat it against yourself and it finds the best strategy."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const m = matching(this.reg);
    this.cell.forEach((b, i) => {
      p.frame(b.x, b.y, b.w, b.h, c.ink, 0.5);
      p.text(ACTIONS[i]!, b.x + b.w / 2, b.y + 18, { font: Type.mono(11), color: this.seen.has(i) ? c.ink : c.fog, align: "center" });
      if (!this.seen.has(i)) return;
      const r = this.reg[i]!;
      const cy = b.y + b.h / 2 + 8;
      const rad = clamp(Math.sqrt(Math.abs(r) / 0.3) * (b.w / 3), 3, b.w / 2 - 6);
      if (r > 0) p.disc(b.x + b.w / 2, cy, rad, c.ink, 0.95);
      else p.ring(b.x + b.w / 2, cy, rad, c.ink, 1, 0.6);
      p.text(sg(r), b.x + b.w / 2, b.y + b.h - 10, { font: Type.mono(12), color: c.ink, align: "center" });
    });
    void m;
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 8.6, (f.h - 80) / 2.4), 10, 34);
    const cy = f.top + R + 8;
    q.r.forEach((r, i) => {
      const x = this.cx + (i - 1) * 3 * R;
      const rad = clamp(R * Math.sqrt(Math.abs(r) / 6), 3, R);
      if (r > 0) p.disc(x, cy, rad, c.ink, i === q.idx ? 0.95 : 0.5);
      else p.ring(x, cy, rad, c.ink, 1.25);
      p.text(`${ACTIONS[i]![0]!.toUpperCase()} ${r}`, x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
