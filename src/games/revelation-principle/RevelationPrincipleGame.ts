import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ROUNDS, HALF, SEE_MAX, isRight, machineBid, proveSet, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: a first price auction. Bid your value or bid half.
 * See: drag your value. Bidding half yourself, or telling the truth to a machine that bids half for you, is the same bid.
 * Prove: new strategies. Drag the bid the machine places after you report your value.
 */
export class RevelationPrincipleGame extends Lesson<Case> {
  readonly slug = "revelation-principle";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Bid your value", "Bid half"];
  }

  private value = 6;
  private touched = false;
  private low = false;
  private high = false;
  private x0 = 0;
  private x1 = 0;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`Your value is ${x.value}. The rival bids ${x.rival}.`, "Highest bid wins and pays its bid."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const bid = i === 0 ? x.value : HALF.bid(x.value);
    const other = i === 0 ? HALF.bid(x.value) : x.value;
    const got = HALF.pay(x.value, bid, x.rival);
    const alt = HALF.pay(x.value, other, x.rival);
    return { pay: got, alt, prompt: bid > x.rival ? `You bid ${n1(bid)} and won.` : `You bid ${n1(bid)} and lost.`, note: `You get ${n1(got)}. The other bid pays ${n1(alt)}.` };
  }

  protected seeStart(): [string, string] {
    this.value = 6;
    this.touched = false;
    this.low = false;
    this.high = false;
    return ["Drag your value. Two ways to bid half.", "Bid yourself, or tell the truth to a machine."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    this.x0 = f.x + 34;
    this.x1 = f.x + f.w - 34;
  }

  protected override seeDown(x: number, _y: number): void {
    this.setValue2(x);
  }
  protected override seeMove(x: number, _y: number): void {
    this.setValue2(x);
  }

  private setValue2(x: number): void {
    this.value = clamp(Math.round(((x - this.x0) / (this.x1 - this.x0)) * SEE_MAX), 0, SEE_MAX);
    this.touched = true;
    this.low = this.low || this.value <= 3;
    this.high = this.high || this.value >= 9;
    this.note.set(`Value ${this.value}. Both ways place a bid of ${n1(HALF.bid(this.value))}.`);
    if (this.low && this.high) this.reachSee("Truth to the machine gives the same bid.");
  }

  private vx(v: number): number {
    return this.x0 + (v / SEE_MAX) * (this.x1 - this.x0);
  }

  seeScript(): [number, number][] {
    const y = this.frame.top + 60;
    return [[this.vx(2), y], [this.vx(10), y]];
  }
  protected seeFinishDebug(): void {
    this.setValue2(this.vx(2));
    this.setValue2(this.vx(10));
  }
  override seePartialDebug(): void {
    this.setValue2(this.vx(4));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`The machine bids ${q.word} of the value. You report ${q.value}.`, "What bid does it place?"];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "slider", min: 0, max: 12, step: 0.5, init: 0, labels: ["", ""], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    if (isRight(q, v)) return { ok: true, prompt: `Right. It bids ${n1(machineBid(q))}.`, note: "The machine plays your strategy, so honesty costs nothing." };
    return { ok: false, prompt: v > machineBid(q) ? "Too high." : "Too low.", note: `${q.word} of ${q.value} is ${n1(machineBid(q))}.` };
  }
  protected readonly closing: [string, string] = ["Any outcome of a clever rule can come from honest reports.", "Let the machine do the shading."];

  protected drawSee(p: Painter, c: Colors, f: Frame): void {
    const y = f.top + 60;
    p.rule(this.x0, y, this.x1, y, c.ink, 0.5);
    for (const v of [0, 6, 12]) {
      p.rule(this.vx(v), y - 5, this.vx(v), y + 5, c.ink, 0.5);
      p.text(String(v), this.vx(v), y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    p.disc(this.vx(this.value), y, 8, c.ink);
    p.text("your value", this.cx, y - 22, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (!this.touched) return;
    const b = HALF.bid(this.value);
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 190) / 1.4), 12, 34);
    const cy = y + 100;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, SEE_MAX / 2) / (SEE_MAX / 2));
    p.ring(this.cx - 2 * R, cy, rad(b), c.ink, 1.5);
    p.disc(this.cx + 2 * R, cy, rad(b), c.ink, 0.95);
    p.text(`you bid ${n1(b)}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`machine ${n1(b)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (x: number) => R * Math.sqrt(clamp(x, 0, 12) / 12);
    p.ring(this.cx - 2 * R, cy, rad(q.value), c.ink, 1.5);
    p.disc(this.cx + 2 * R, cy, rad(v), c.ink, 0.95);
    p.text(`value ${q.value}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`bid ${n1(v)}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
