import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, ITEMS, SEE_ITEMS, answer, fit, phonePay, serverPay, proveSet, type Case } from "./model";

const n1 = (v: number): string => String(Math.round(v * 10) / 10);
const clock = (h: number): string => `${h}:00`;

/**
 * Feel: rank on the phone with the moment, or ask a bigger model on the server with a delay.
 * See: drag the hour. The best item changes as the situation changes.
 * Prove: at this hour, which of two items fits better?
 */
export class ContextAwareRecsysGame extends Lesson<Case> {
  readonly slug = "context-aware-recsys";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Rank on the phone", "Ask the server"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: 24, yMin: 0, yMax: 1, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private hour = 12;
  private touched = false;
  private morning = false;
  private night = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`Phone fits the moment: ${x.phone} of 6.`, `Server model: ${x.server} of 6, but it lags by ${x.delay}.`];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const a = phonePay(x);
    const b = serverPay(x);
    return { pay: i === 0 ? a : b, alt: i === 0 ? b : a, prompt: i === 0 ? `The phone gives ${n1(a)}.` : `The server gives ${x.server}, less ${x.delay} for lag.`, note: `Phone ${n1(a)}. Server ${n1(b)}.` };
  }

  protected seeStart(): [string, string] {
    this.touched = false;
    this.morning = false;
    this.night = false;
    this.hour = 12;
    return ["Drag the hour. Which item fits right now?", "Same person, different moment."];
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
    this.hour = clamp(Math.round(this.plot.valueAtX(px)), 0, 24);
    this.touched = true;
    this.morning = this.morning || this.hour <= 9;
    this.night = this.night || this.hour >= 19;
    const best = ITEMS.map((_, i) => i).sort((x, y) => fit(y, this.hour) - fit(x, this.hour))[0]!;
    this.note.set(`${clock(this.hour)}: ${ITEMS[best]!.name} fits best.`);
    if (this.morning && this.night) this.reachSee("The best item changes with the moment. That is context.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return [[this.plot.X(8), y], [this.plot.X(21), y]];
  }
  protected seeFinishDebug(): void {
    this.set(this.plot.X(8));
    this.set(this.plot.X(21));
  }
  override seePartialDebug(): void {
    this.set(this.plot.X(13));
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`It is ${clock(q.hour)}. Coffee fits 8, lunch 13, film 21.`, "Which of these two fits better now?"];
  }
  protected answerSpec(q: Case): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: [ITEMS[q.a]!.name, ITEMS[q.b]!.name], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const a = answer(q);
    const ok = v === a;
    const note = `At ${clock(q.hour)}: ${ITEMS[q.a]!.name} ${Math.round(fit(q.a, q.hour) * 100)}%, ${ITEMS[q.b]!.name} ${Math.round(fit(q.b, q.hour) * 100)}%.`;
    return ok ? { ok, prompt: `Right. ${ITEMS[a === 0 ? q.a : q.b]!.name}.`, note } : { ok, prompt: "Which peak is closer to the hour?", note };
  }
  protected readonly closing: [string, string] = ["Use the moment, not only the history.", "Small models on the phone can see it first."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 6, 12, 18, 24], xLabel: "hour", yLabel: "fit", fmt: (v) => String(v) });
    SEE_ITEMS.forEach((it, k) => pl.curve(p, (h) => fit(it, h), c.ink, k === 0 ? 1.75 : 1.25, k === 0 ? 1 : 0.55, 48));
    if (this.touched) {
      p.line(pl.X(this.hour), pl.base, pl.X(this.hour), pl.top, c.ink, 1, 0.35, [3, 4]);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.ring(this.cx - 2 * R, cy, R * Math.sqrt(Math.max(fit(q.a, q.hour), 0.04)), c.ink, 1.5);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt(Math.max(fit(q.b, q.hour), 0.04)), c.ink, 1.5);
    p.text(ITEMS[q.a]!.name, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(ITEMS[q.b]!.name, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
