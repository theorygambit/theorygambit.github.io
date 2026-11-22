import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Plot } from "../shared/Plot";
import { FEEL_ROUNDS, SEE_ROUNDS, answerOf, beats, proveSet, simulate, type Round } from "./model";

const nm = (s: "H" | "T"): string => (s === "H" ? "heads" : "tails");

/**
 * Feel: a matcher plays the side your history favours. Play the opposite.
 * See: tap to let both sides play on. Their long run mix settles at one half.
 * Prove: given a history, what does the matcher play next?
 */
export class FictitiousPlayGame extends Lesson<Round> {
  readonly slug = "fictitious-play";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Play heads", "Play tails"];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: SEE_ROUNDS, yMin: 0, yMax: 1, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private readonly sim = simulate(SEE_ROUNDS);
  private shown = 0;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`You showed heads ${x.heads} of ${x.of} times.`, "They match what you favour. Differ from them."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const mine = i === 0 ? "H" : "T";
    const win = mine === beats(x);
    return { pay: win ? 6 : 0, alt: win ? 0 : 6, prompt: `They play ${nm(answerOf(x))}. You play ${nm(mine)}.`, note: win ? "You differ, so you win." : "You match, so they win." };
  }

  protected seeStart(): [string, string] {
    this.shown = 1;
    return ["Both sides answer the other's history. Tap to play on.", "Where does each side's heads rate go?"];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }
  protected override seeDown(_x: number, _y: number): void {
    if (this.shown >= SEE_ROUNDS) return;
    this.shown = Math.min(SEE_ROUNDS, this.shown + 8);
    this.note.set(`After ${this.shown} rounds: ${Math.round(this.sim.matcher[this.shown - 1]! * 100)}% and ${Math.round(this.sim.mismatcher[this.shown - 1]! * 100)}% heads.`);
    if (this.shown >= SEE_ROUNDS) this.reachSee("Both settle near one half, the equilibrium mix.");
  }

  seeScript(): [number, number][] {
    const y = this.plot.top + 40;
    return Array.from({ length: 5 }, () => [this.cx, y] as [number, number]);
  }
  protected seeFinishDebug(): void {
    while (this.shown < SEE_ROUNDS) this.seeDown(0, 0);
  }
  override seePartialDebug(): void {
    this.seeDown(0, 0);
  }

  protected makePuzzles(): Round[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Round): [string, string] {
    return [`They showed heads ${q.heads} of ${q.of} times.`, "You match them. What do you play next?"];
  }
  protected answerSpec(_q: Round): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: ["Heads", "Tails"], fmt: String };
  }
  protected judge(q: Round, v: number): Verdict {
    const a = answerOf(q);
    const ok = (v === 0) === (a === "H");
    const note = `Heads came ${Math.round((q.heads / q.of) * 100)}% of the time. Best reply: ${nm(a)}.`;
    return ok ? { ok, prompt: `Right. Play ${nm(a)}.`, note } : { ok, prompt: q.heads * 2 > q.of ? "Heads came more than half the time." : "Tails came more than half the time.", note };
  }
  protected readonly closing: [string, string] = ["Answer what they have done so far.", "The history converges to equilibrium in zero-sum games."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 10, 20, 30, 40], xLabel: "round", yLabel: "share heads", fmt: (v) => String(v) });
    p.line(pl.X(0), pl.Y(0.5), pl.X(SEE_ROUNDS), pl.Y(0.5), c.ink, 0.75, 0.4, [3, 4]);
    for (let i = 1; i < this.shown; i++) {
      p.line(pl.X(i - 1), pl.Y(this.sim.matcher[i - 1]!), pl.X(i), pl.Y(this.sim.matcher[i]!), c.ink, 1.75, 1);
      p.line(pl.X(i - 1), pl.Y(this.sim.mismatcher[i - 1]!), pl.X(i), pl.Y(this.sim.mismatcher[i]!), c.ink, 1.25, 0.55);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Round, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(q.heads / q.of), c.ink, 0.95);
    p.ring(this.cx + 2 * R, cy, R * Math.sqrt((q.of - q.heads) / q.of), c.ink, 1.5);
    p.text(`heads ${q.heads}`, this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`tails ${q.of - q.heads}`, this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
