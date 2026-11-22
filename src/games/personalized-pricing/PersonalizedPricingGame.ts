import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { BEST_PRICE, COST, FEEL_ROUNDS, crowdProfit, profit, answer, isRight, proveSet, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you can see what each customer would pay. Set the price.
 * See: drag one price for everybody. Profit rises, then falls as buyers drop out.
 * Prove: sum the profit from a list of customers at a price.
 */
export class PersonalizedPricingGame extends Lesson<Case> {
  readonly slug = "personalized-pricing";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 8;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`Price ${r.a}`, `Price ${r.b}`];
  }

  private readonly plot = new Plot({ xMin: 2, xMax: 10, yMin: 0, yMax: 2.4, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private price = 6;
  private touched = false;
  private low = false;
  private high = false;
  private mid = false;

  protected feelIntro(r: number): [string, string] {
    return [`This customer would pay up to ${FEEL_ROUNDS[r]!.wtp}.`, `It costs you ${COST}. Set the price.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const p = i === 0 ? x.a : x.b;
    const q = i === 0 ? x.b : x.a;
    const got = profit(p, x.wtp);
    return { pay: got, alt: profit(q, x.wtp), prompt: p <= x.wtp ? `At ${p} they buy. You earn ${got}.` : `At ${p} they walk away.`, note: `The other price earns ${profit(q, x.wtp)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.low = false;
    this.high = false;
    this.mid = false;
    this.price = 6;
    return ["One price for everyone. Drag it.", "Customers would pay 2 to 10, evenly spread."];
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
    this.price = clamp(Math.round(this.plot.valueAtX(px) * 2) / 2, 2, 10);
    this.touched = true;
    this.low = this.low || this.price <= 3.5;
    this.high = this.high || this.price >= 8.5;
    this.mid = this.mid || Math.abs(this.price - BEST_PRICE) <= 0.5;
    const buy = Math.round(((10 - this.price) / 8) * 100);
    this.note.set(`Price ${n1(this.price)}. ${buy}% buy. Profit ${n1(crowdProfit(this.price))} each.`);
    if (this.low && this.high && this.mid) this.reachSee("One price leaves money behind. Each person has their own.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(3), y], [this.plot.X(9), y], [this.plot.X(6), y]];
  }
  protected seeFinishDebug(): void {
    for (const v of [3, 9, 6]) this.set(this.plot.X(v));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(4));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Cost ${COST}. Four customers would pay ${q.wtps.join(", ")}.`, `One price of ${q.price}. What is your profit?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 20, step: 1, init: 0, labels: ["0", "20"], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    const buyers = q.wtps.filter((w) => w >= q.price).length;
    if (isRight(q, v)) return { ok: true, prompt: `Right. ${a}.`, note: `${buyers} buy, each adding ${q.price - COST}.` };
    return { ok: false, prompt: v > a ? "Too high." : "Too low.", note: `${buyers} customers would pay ${q.price}. Each adds ${q.price - COST}, so ${a}.` };
  }
  protected readonly closing: [string, string] = ["Charge by willingness to pay and you keep what one price loses.", "Whether that is fair is another question."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [2, 4, 6, 8, 10], xLabel: "the one price", yLabel: "profit each", fmt: (v) => String(v) });
    pl.curve(p, (x) => crowdProfit(x), c.ink, 1.75, 1, 40);
    if (this.touched) {
      const y = crowdProfit(this.price);
      p.line(pl.X(this.price), pl.base, pl.X(this.price), pl.Y(y), c.ink, 1, 0.4, [3, 4]);
      p.disc(pl.X(this.price), pl.Y(y), 6, c.ink);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 9, (f.h - 80) / 2.4), 10, 30);
    const cy = f.top + R + 8;
    q.wtps.forEach((w, i) => {
      const x = this.cx + (i - 1.5) * 2.4 * R;
      const buy = w >= q.price;
      if (buy) p.disc(x, cy, R * Math.sqrt(w / 10), c.ink, 0.95);
      else p.ring(x, cy, R * Math.sqrt(w / 10), c.ink, 1.5);
      p.text(String(w), x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
