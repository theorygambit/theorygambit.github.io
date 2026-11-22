import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_POT, FEEL_ROUNDS, Offers, isRight, proveSet } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you offer first. If they refuse, the pot shrinks and they take it all.
 * See: drag the shrink rate. The more the pot shrinks, the more the first proposer keeps.
 * Prove: new pots and shrink rates. How much can the proposer keep?
 */
export class RubinsteinBargainingGame extends Lesson<Offers> {
  readonly slug = "rubinstein-bargaining";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 9;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Offer ${r.a}`, `Offer ${r.b}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0, yMax: 12, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private d = 0.5;
  private touched = false;
  private low = false;
  private high = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`Pot ${FEEL_POT}. Waiting shrinks it to ${n1(FEEL_POT * x.delta)}.`, "Refuse and they propose and take it all."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const g = new Offers(FEEL_POT, x.delta);
    const o = i === 0 ? x.a : x.b;
    const p = i === 0 ? x.b : x.a;
    return { pay: g.keep(o), alt: g.keep(p), prompt: g.accepts(o) ? `You offer ${o}. They accept.` : `You offer ${o}. They wait and win.`, note: `You keep ${g.keep(o)}. The other offer keeps ${g.keep(p)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.d = 0.5;
    return ["Drag the shrink: how much of the pot waiting keeps.", "What does the first proposer keep?"];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(x: number, _y: number): void {
    this.setD(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setD(x);
  }

  private setD(x: number): void {
    this.d = clamp(Math.round(this.plot.valueAtX(x) * 20) / 20, 0, 1);
    this.touched = true;
    this.low = this.low || this.d <= 0.3;
    this.high = this.high || this.d >= 0.7;
    const g = new Offers(12, this.d);
    this.note.set(`Waiting keeps ${Math.round(this.d * 100)}%. They accept ${n1(g.wait())}. You keep ${n1(g.best())}.`);
    if (this.low && this.high) this.reachSee("The more waiting keeps, the less you can.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(0.2), y], [this.plot.X(0.8), y]];
  }
  protected seeFinishDebug(): void {
    this.setD(this.plot.X(0.2));
    this.setD(this.plot.X(0.8));
  }
  override seePartialDebug(): void {
    this.setD(this.plot.X(0.3));
  }

  protected makePuzzles(): Offers[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Offers): [string, string] {
    return [`Pot ${q.pot}. Waiting keeps ${Math.round(q.delta * 100)}% of it.`, "What is the most you keep as first proposer?"];
  }
  protected answerSpec(q: Offers): Answer {
    return { mode: "slider", min: 0, max: q.pot, step: 1, init: Math.round(q.pot / 2), labels: ["", ""], fmt: String };
  }
  protected judge(q: Offers, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: `Right. You keep ${n1(q.best())}.`, note: `They accept ${n1(q.wait())}, the value of waiting.` };
    return { ok: false, prompt: v > q.best() ? "They would refuse that." : "You can keep more.", note: `Waiting is worth ${n1(q.wait())} to them. Offer exactly that.` };
  }
  protected readonly closing: [string, string] = ["Offer what waiting is worth to them, and no more.", "The patient side keeps more."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: "share kept by waiting", yLabel: "you keep", fmt: (v) => String(v) });
    pl.curve(p, (d) => 12 * (1 - d), c.ink, 1.75, 1, 20);
    if (this.touched) {
      const y = 12 * (1 - this.d);
      p.line(pl.X(this.d), pl.base, pl.X(this.d), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.d), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Offers, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (x: number) => R * Math.sqrt(clamp(x, 0, q.pot) / q.pot);
    p.disc(this.cx - 2 * R, cy, rad(v), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, rad(q.pot - v), c.ink, 1.5);
    p.text(`you ${n1(v)}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`them ${n1(q.pot - v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
