import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { FEEL_ORDER, LEVELS, SAFE, answerSlot, proveSet, type Case } from "./model";

/**
 * Feel: exploit what they believe, or play safe. What they believe depends on their level.
 * See: tap up the ladder. Each level knows a little more about the other's picture.
 * Prove: name the level from a description.
 */
export class HypergameLevelsGame extends Lesson<Case> {
  readonly slug = "hypergame-levels";
  protected readonly rounds = FEEL_ORDER.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    return ["Exploit their picture", "Play safe"];
  }

  private shown = 0;
  private rows: { y: number; h: number }[] = [];

  protected feelIntro(r: number): [string, string] {
    return [LEVELS[FEEL_ORDER[r]!]!.desc, "Exploit what they believe, or play safe?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const l = LEVELS[FEEL_ORDER[r]!]!;
    return { pay: i === 0 ? l.exploit : SAFE, alt: i === 0 ? SAFE : l.exploit, prompt: i === 0 ? `Exploiting pays ${l.exploit}.` : `Safe pays ${SAFE}.`, note: `Exploit ${l.exploit}. Safe ${SAFE}.` };
  }

  protected seeStart(): [string, string] {
    this.shown = 1;
    return ["Tap up the ladder of hypergame levels.", "How much does a wrong picture earn you?"];
  }

  protected override layoutExtra(): void {
    const f = this.frame;
    const h = clamp((f.h - 20) / LEVELS.length, 40, 66);
    this.rows = LEVELS.map((_, i) => ({ y: f.top + 10 + i * h, h }));
  }

  protected override seeDown(_x: number, _y: number): void {
    if (this.shown >= LEVELS.length) return;
    this.shown++;
    const l = LEVELS[this.shown - 1]!;
    this.note.set(`Level ${l.level}: ${l.short}. Exploiting pays ${l.exploit}.`);
    if (this.shown === LEVELS.length) this.reachSee("Each step up closes the gap to exploit.");
  }

  seeScript(): [number, number][] {
    const y = this.frame.top + 40;
    return Array.from({ length: LEVELS.length - 1 }, () => [this.cx, y] as [number, number]);
  }
  protected seeFinishDebug(): void {
    while (this.shown < LEVELS.length) this.seeDown(0, 0);
  }
  override seePartialDebug(): void {
    this.seeDown(0, 0);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [LEVELS[q.level]!.desc, "Which level of hypergame is this?"];
  }
  protected answerSpec(q: Case): Answer {
    const a = `Level ${q.level}`;
    const b = `Level ${q.other}`;
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: q.first ? [a, b] : [b, a], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const ok = v === answerSlot(q);
    const l = LEVELS[q.level]!;
    return ok ? { ok, prompt: `Right. Level ${l.level}, ${l.short.toLowerCase()}.`, note: `Exploiting here pays ${l.exploit}.` } : { ok, prompt: `That is level ${l.level}, ${l.short.toLowerCase()}.`, note: `${l.desc} Exploiting pays ${l.exploit}.` };
  }
  protected readonly closing: [string, string] = ["Each level knows more about the other's picture.", "Climb until nothing is left to exploit."];

  protected drawSee(p: Painter, c: Colors, f: Frame): void {
    for (let i = 0; i < this.shown; i++) {
      const row = this.rows[i]!;
      const l = LEVELS[i]!;
      const y = row.y + row.h / 2;
      p.text(`L${l.level}`, f.x + 28, y + 4, { font: Type.mono(12), color: c.fog, align: "center" });
      p.text(l.short, f.x + 52, y + 4, { font: Type.body(13, 400), color: c.ink, align: "left" });
      const r = clamp(Math.sqrt(l.exploit / 6) * 14, 4, 14);
      p.disc(f.x + f.w - 28, y, r, c.ink, i === this.shown - 1 ? 1 : 0.5);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const l = LEVELS[q.level]!;
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    p.disc(this.cx, cy, R * Math.sqrt(l.exploit / 6), c.ink, 0.95);
    p.text(`exploit ${l.exploit}`, this.cx, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }
}
