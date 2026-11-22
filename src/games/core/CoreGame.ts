import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Simplex } from "../shared/Simplex";
import { FEEL_ROUNDS, SEE, Trio, proveSet, type Case } from "./model";

const tri = (x: readonly number[]): string => x.join(" . ");

/**
 * Feel: split a pot among three. If two players can earn more on their own, they leave.
 * See: drag a split around the triangle. Stable splits stay, blocked ones lose a pair.
 * Prove: is this split in the core? If not, which pair leaves?
 */
export class CoreGame extends Lesson<Case> {
  readonly slug = "core";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [tri(r.a), tri(r.b)];
  }

  private readonly tri = new Simplex();
  private trail: { x: number; y: number; ok: boolean }[] = [];
  private yes = false;
  private no = false;

  protected feelIntro(r: number): [string, string] {
    const x = FEEL_ROUNDS[r]!;
    return [`Any two can earn ${x.pair} alone. All three earn 12.`, "You are first. Pick a split."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const g = new Trio(x.pair);
    const mine = i === 0 ? x.a : x.b;
    const other = i === 0 ? x.b : x.a;
    const got = g.mine(mine);
    const b = g.blocker(mine);
    return {
      pay: got,
      alt: g.mine(other),
      prompt: b === null ? "No pair can do better. It holds." : `Players ${b[0] + 1} and ${b[1] + 1} walk away.`,
      note: b === null ? `You get ${got}.` : `You get 0. They keep ${x.pair} together.`,
    };
  }

  protected seeStart(): [string, string] {
    this.trail = [];
    this.yes = false;
    this.no = false;
    return ["Any two can earn 6 alone. Drag a split.", "Filled holds. Ring is blocked."];
  }

  protected override layoutExtra(): void {
    this.tri.fit(this.frame, this.cx, 12);
  }
  protected override seeDown(x: number, y: number): void {
    this.at(x, y);
  }
  protected override seeMove(x: number, y: number): void {
    this.at(x, y);
  }

  private at(px: number, py: number): void {
    const s = this.tri.split(px, py).map((v) => Math.round(v * 2) / 2);
    const ok = SEE.stable(s);
    const [x, y] = this.tri.point(s);
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 9) this.trail.push({ x, y, ok });
    if (this.trail.length > 60) this.trail.shift();
    this.yes = this.yes || ok;
    this.no = this.no || !ok;
    const b = SEE.blocker(s);
    this.note.set(b === null ? `${tri(s)} holds.` : `${tri(s)}: players ${b[0] + 1} and ${b[1] + 1} leave.`);
    if (this.yes && this.no) this.reachSee("The safe splits fill a region, the core.");
  }

  seeScript(): [number, number][] {
    const a = this.tri.point([4, 4, 4]);
    const b = this.tri.point([11, 0.5, 0.5]);
    return [a, b];
  }
  protected seeFinishDebug(): void {
    const a = this.tri.point([4, 4, 4]);
    const b = this.tri.point([11, 0.5, 0.5]);
    this.at(a[0], a[1]);
    this.at(b[0], b[1]);
  }
  override seePartialDebug(): void {
    const a = this.tri.point([4, 4, 4]);
    this.at(a[0], a[1]);
  }

  protected makePuzzles(): Case[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Case): [string, string] {
    return [`Any two can earn ${q.game.pair} alone. All three earn 12.`, `Split ${tri(q.x)}. Is it in the core?`];
  }
  protected answerSpec(_q: Case): Answer {
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: ["In the core", "Blocked"], fmt: String };
  }
  protected judge(q: Case, v: number): Verdict {
    const b = q.game.blocker(q.x);
    const ok = (v === 0) === (b === null);
    if (b === null) return ok ? { ok, prompt: "Right. No pair can do better.", note: `Every pair gets at least ${q.game.pair}.` } : { ok, prompt: "No pair can do better here.", note: `Every pair gets at least ${q.game.pair}.` };
    const s = q.x[b[0]]! + q.x[b[1]]!;
    return ok ? { ok, prompt: `Right. Players ${b[0] + 1} and ${b[1] + 1} walk.`, note: `They get ${s}, below ${q.game.pair}.` } : { ok, prompt: `Players ${b[0] + 1} and ${b[1] + 1} get ${s}.`, note: `That is below ${q.game.pair}, so they leave.` };
  }
  protected readonly closing: [string, string] = ["A split lasts when no group gains by leaving.", "The core is every split nobody can block."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.tri.draw(p, c);
    for (const t of this.trail) {
      if (t.ok) p.disc(t.x, t.y, 4, c.ink, 0.9);
      else p.ring(t.x, t.y, 4, c.ink, 1, 0.6);
    }
    const l = this.trail[this.trail.length - 1];
    if (l) p.ring(l.x, l.y, 9, c.ink, 1.25);
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Case, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 8, (f.h - 80) / 2.4), 12, 40);
    const cy = f.top + R + 8;
    q.x.forEach((v, i) => {
      const cx = this.cx + (i - 1) * 2.8 * R;
      const r = R * Math.sqrt(v / 8);
      if (i === 0) p.disc(cx, cy, r, c.ink, 0.95);
      else p.ring(cx, cy, r, c.ink, 1.5);
      p.text(`${i + 1}: ${v}`, cx, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
