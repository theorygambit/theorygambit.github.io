import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { Simplex } from "../shared/Simplex";
import { Bloc, FEEL_ROUNDS, SEE, calm, isRight, proveSet } from "./model";

const tri = (x: readonly number[]): string => x.join(" . ");
const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: pick the split that leaves nobody wanting to walk out.
 * See: drag a split. The disc grows as the biggest complaint shrinks, and it peaks at one split.
 * Prove: new games. How small can the biggest complaint get?
 */
export class NucleolusGame extends Lesson<Bloc> {
  readonly slug = "nucleolus";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = 6;
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [tri(r.a), tri(r.b)];
  }

  private readonly tri = new Simplex();
  private trail: { x: number; y: number; e: number }[] = [];
  private tried = 0;
  private bestSeen = 99;

  protected feelIntro(r: number): [string, string] {
    const g = FEEL_ROUNDS[r]!.game;
    return [`Pairs earn ${g.label()} alone. All three earn 12.`, "Pick the split with the weakest pull to leave."];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const mine = i === 0 ? x.a : x.b;
    const other = i === 0 ? x.b : x.a;
    const e = x.game.worst(mine);
    return { pay: calm(x.game, mine), alt: calm(x.game, other), prompt: `The biggest pull to leave is ${n1(e)}.`, note: `You get ${calm(x.game, mine)}. The other split gets ${calm(x.game, other)}.` };
  }

  protected seeStart(): [string, string] {
    this.trail = [];
    this.tried = 0;
    this.bestSeen = 99;
    return [`Pairs earn ${SEE.label()} alone. Drag a split.`, "A bigger disc means a calmer group."];
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
    const e = SEE.worst(s);
    const [x, y] = this.tri.point(s);
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 9) {
      this.trail.push({ x, y, e });
      this.tried++;
    }
    if (this.trail.length > 40) this.trail.shift();
    this.bestSeen = Math.min(this.bestSeen, e);
    this.note.set(`${tri(s)}: biggest pull to leave ${n1(e)}.`);
    if (this.tried >= 2 && this.bestSeen <= SEE.best() + 0.26) this.reachSee(`Best is ${tri(SEE.split())}. Everyone is equally unhappy.`);
  }

  seeScript(): [number, number][] {
    return [this.tri.point([4, 4, 4]), this.tri.point(SEE.split())];
  }
  protected seeFinishDebug(): void {
    const a = this.tri.point([4, 4, 4]);
    const b = this.tri.point(SEE.split());
    this.at(a[0], a[1]);
    this.at(b[0], b[1]);
  }
  override seePartialDebug(): void {
    const a = this.tri.point([4, 4, 4]);
    this.at(a[0], a[1]);
  }

  protected makePuzzles(): Bloc[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Bloc): [string, string] {
    return [`Pairs earn ${q.label()} alone. All three earn 12.`, "Lowest worst gap: pair value minus its share."];
  }
  protected answerSpec(_q: Bloc): Answer {
    return { mode: "slider", min: -4, max: 4, step: 0.5, init: 0, labels: ["", ""], fmt: n1 };
  }
  protected judge(q: Bloc, v: number): Verdict {
    const s = q.split();
    if (isRight(q, v)) return { ok: true, prompt: `Right. The worst gap is ${n1(q.best())}.`, note: `The split ${tri(s)} makes all three pairs equal.` };
    return { ok: false, prompt: v > q.best() ? "It can go lower." : "That is lower than possible.", note: `Share ${tri(s)} gives each pair a gap of ${n1(q.best())}.` };
  }
  protected readonly closing: [string, string] = ["Shrink the biggest complaint first.", "Then the next. Only one split survives."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    this.tri.draw(p, c);
    for (const t of this.trail) p.disc(t.x, t.y, clamp(11 - 2.5 * (t.e + 2), 3, 11), c.ink, 0.35);
    const l = this.trail[this.trail.length - 1];
    if (l) p.ring(l.x, l.y, clamp(11 - 2.5 * (l.e + 2), 3, 11) + 3, c.ink, 1.25);
    if (this.seeDone) {
      const [x, y] = this.tri.point(SEE.split());
      p.ring(x, y, 14, c.ink, 1.5);
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Bloc, _v: number): void {
    const R = clamp(Math.min((f.w - 24) / 8, (f.h - 80) / 2.4), 12, 40);
    const cy = f.top + R + 8;
    const items: [string, number][] = [["12", q.v12], ["13", q.v13], ["23", q.v23]];
    items.forEach(([l, v], i) => {
      const x = this.cx + (i - 1) * 2.8 * R;
      p.ring(x, cy, R * Math.sqrt(v / 12), c.ink, 1.5);
      p.text(`${l}: ${v}`, x, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    });
  }
}
