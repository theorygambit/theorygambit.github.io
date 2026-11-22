import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ORDER, POLICIES, SEE_ORDER, bestMove, payoff, proveSet } from "./model";

const SHORT: Record<string, string> = { copy: "copy", alwaysD: "defect", alwaysC: "coop", opposite: "flip", grim: "grim" };

/**
 * Feel: they reply to your move by a policy. Cooperate or defect against each policy.
 * See: tap each policy. The best move against a policy can be the opposite of the best move against a fixed move.
 * Prove: given a policy, what is your best move?
 */
export class MetagameHowardGame extends Lesson<string> {
  readonly slug = "metagame-howard";
  protected readonly rounds = FEEL_ORDER.length;
  protected readonly payMax = 5;
  protected get choices(): [string, string] {
    return ["Cooperate", "Defect"];
  }

  private seen = new Set<number>();
  private cell: { x: number; y: number; w: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    return [`Their policy: ${POLICIES[FEEL_ORDER[r]!]!.name}.`, "They reply to your move, not to a guess."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const p = POLICIES[FEEL_ORDER[r]!]!;
    const mine = i === 0 ? "C" : "D";
    const other = i === 0 ? "D" : "C";
    return { pay: payoff(p, mine), alt: payoff(p, other), prompt: `They reply ${p.reply(mine) === "C" ? "cooperate" : "defect"}.`, note: `You get ${payoff(p, mine)}. The other move gets ${payoff(p, other)}.` };
  }

  protected seeStart(): [string, string] {
    this.seen = new Set();
    return ["Tap each policy to see what each of your moves earns.", "Defect is not always best."];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const n = SEE_ORDER.length;
    const w = (f.w - 24 - (n - 1) * 6) / n;
    const h = clamp(f.h - 90, 90, 170);
    this.cell = SEE_ORDER.map((_, i) => ({ x: f.x + 12 + i * (w + 6), y: f.top + 12, w, h }));
  }

  protected override seeDown(x: number, y: number): void {
    const i = this.cell.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
    if (i < 0 || this.seen.has(i)) return;
    this.seen.add(i);
    const p = POLICIES[SEE_ORDER[i]!]!;
    this.note.set(`They ${p.name}. Best: ${bestMove(p) === "C" ? "cooperate" : "defect"}.`);
    if (this.seen.size === SEE_ORDER.length) this.reachSee("Answer the policy, not the move.");
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

  protected makePuzzles(): string[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: string): [string, string] {
    return [`Their policy: ${POLICIES[q]!.name}.`, "What is your best move?"];
  }
  protected answerSpec(_q: string): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: ["Cooperate", "Defect"], fmt: String };
  }
  protected judge(q: string, v: number): Verdict {
    const p = POLICIES[q]!;
    const best = bestMove(p);
    const ok = (v === 0) === (best === "C");
    const note = `Cooperate earns ${payoff(p, "C")}. Defect earns ${payoff(p, "D")}.`;
    return ok ? { ok, prompt: `Right. ${best === "C" ? "Cooperate" : "Defect"}.`, note } : { ok, prompt: `${best === "C" ? "Cooperating" : "Defecting"} pays more here.`, note };
  }
  protected readonly closing: [string, string] = ["Play against their policy, the rule behind their moves.", "A game about the game changes the best reply."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.cell.forEach((b, i) => {
      const pol = POLICIES[SEE_ORDER[i]!]!;
      const on = this.seen.has(i);
      p.frame(b.x, b.y, b.w, b.h, c.ink, 0.5);
      p.text(SHORT[pol.key]!, b.x + b.w / 2, b.y + 18, { font: Type.mono(11), color: on ? c.ink : c.fog, align: "center" });
      if (!on) return;
      const best = bestMove(pol);
      (["C", "D"] as const).forEach((m, k) => {
        const y = b.y + 52 + k * (b.h - 74);
        const r = clamp(Math.sqrt(payoff(pol, m) / 5) * (b.w / 4), 2, b.w / 2 - 6);
        if (m === best) p.disc(b.x + b.w / 2, y, r, c.ink, 0.95);
        else p.ring(b.x + b.w / 2, y, r, c.ink, 1.25, 0.6);
        p.text(`${m} ${payoff(pol, m)}`, b.x + b.w / 2, y + b.w / 2 + 6, { font: Type.mono(11), color: c.ink, align: "center" });
      });
    });
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: string, _v: number): void {
    const pol = POLICIES[q]!;
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx - 2 * R, cy, R * Math.sqrt(payoff(pol, "C") / 5), c.ink, 0.95);
    p.disc(this.cx + 2 * R, cy, R * Math.sqrt(payoff(pol, "D") / 5), c.ink, 0.95);
    p.text("cooperate", this.cx - 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text("defect", this.cx + 2 * R, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
