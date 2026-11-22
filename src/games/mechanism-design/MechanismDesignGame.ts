import type { Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Lesson, type Answer, type FeelOutcome, type Verdict } from "../shared/Lesson";
import { drawChoice } from "../shared/kit";
import { Plot } from "../shared/Plot";
import { Cake, FEEL_N, FEEL_ROUNDS, SEE_N, answer, proveSet, type Puzzle } from "./model";

/**
 * Feel: you cut a pie and they take the bigger piece. Choose between two cuts.
 * See: switch who picks first, then drag the cut. The rule decides which cut is best.
 * Prove: new pies and rules. Pick the cut a selfish divider makes.
 */
export class MechanismDesignGame extends Lesson<Puzzle> {
  readonly slug = "mechanism-design";
  protected readonly rounds = FEEL_ROUNDS.length;
  protected readonly payMax = FEEL_N / 2;
  private readonly chooser = new Cake(FEEL_N, "chooser");
  protected get choices(): [string, string] {
    const r = FEEL_ROUNDS[Math.min(this.round, this.rounds - 1)]!;
    return [`${FEEL_N - r.a} and ${r.a}`, `${FEEL_N - r.b} and ${r.b}`];
  }

  private readonly plot = new Plot({ xMin: 0, xMax: SEE_N / 2, yMin: 0, yMax: SEE_N, padL: 34, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private rule = -1;
  private seen = new Set<number>();
  private probe = 0;
  private touched = false;
  private seeArmed = -1;

  protected feelIntro(_r: number): [string, string] {
    return [`You cut a pie of ${FEEL_N}. They take the bigger piece.`, "You keep the other. Which cut?"];
  }

  protected feelPlay(r: number, i: 0 | 1): FeelOutcome {
    const x = FEEL_ROUNDS[r]!;
    const mine = this.chooser.share(i === 0 ? x.a : x.b);
    const other = this.chooser.share(i === 0 ? x.b : x.a);
    return { pay: mine, alt: other, they: FEEL_N - mine, prompt: `They took the bigger piece. You keep ${mine}.`, note: `The other cut would have kept ${other}.` };
  }

  protected seeStart(): [string, string] {
    this.rule = -1;
    this.seen = new Set();
    this.touched = false;
    this.probe = 0;
    return ["Who picks first? Try both rules.", "Then drag the cut."];
  }

  protected override layoutExtra(): void {
    this.plot.fit(this.frame);
  }

  private zone(x: number, y: number): -1 | 0 | 1 {
    const b0 = this.pair(0);
    const b1 = this.pair(1);
    if (y >= b0.y && y <= b0.y + b0.h) return x <= b0.x + b0.w ? 0 : x >= b1.x ? 1 : -1;
    return -1;
  }

  protected override seeDown(x: number, y: number): void {
    const z = this.zone(x, y);
    if (z >= 0) {
      if (!this.seeDone) this.seeArmed = z;
      return;
    }
    this.setProbe(x);
  }
  protected override seeMove(x: number, y: number): void {
    if (this.zone(x, y) < 0 && this.rule >= 0) this.setProbe(x);
  }
  protected override onUp(x: number, y: number): void {
    if (this.beat === "see" && this.seeArmed >= 0) {
      const z = this.zone(x, y);
      if (z === this.seeArmed) this.pickRule(z);
      this.seeArmed = -1;
      return;
    }
    super.onUp(x, y);
  }

  private pickRule(i: number): void {
    this.rule = i;
    this.cue("good");
    this.note.set(i === 0 ? "They pick first. Drag the cut." : "You pick first. Drag the cut.");
    this.check();
  }

  private cake(): Cake {
    return new Cake(SEE_N, this.rule === 1 ? "divider" : "chooser");
  }

  private setProbe(x: number): void {
    if (this.rule < 0) {
      this.note.set("Pick who chooses first.");
      return;
    }
    this.probe = clamp(Math.round(this.plot.valueAtX(x)), 0, SEE_N / 2);
    this.touched = true;
    this.seen.add(this.rule);
    const c = this.cake();
    this.note.set(`Cut ${SEE_N - this.probe} and ${this.probe}: you keep ${c.share(this.probe)}.`);
    this.check();
  }

  private check(): void {
    if (this.seen.size >= 2) this.reachSee("The rule decides the best cut.");
  }

  seeScript(): [number, number][] {
    const b0 = this.pair(0);
    const b1 = this.pair(1);
    const y = this.plot.top + 40;
    return [
      [b0.x + b0.w / 2, b0.y + b0.h / 2],
      [this.plot.X(4), y],
      [b1.x + b1.w / 2, b1.y + b1.h / 2],
      [this.plot.X(1), y],
    ];
  }
  protected seeFinishDebug(): void {
    this.pickRule(0);
    this.setProbe(this.plot.X(4));
    this.pickRule(1);
    this.setProbe(this.plot.X(1));
  }
  override seePartialDebug(): void {
    this.pickRule(0);
    this.setProbe(this.plot.X(3));
  }

  protected makePuzzles(): Puzzle[] {
    return proveSet(this.env.rng);
  }
  protected puzzleIntro(q: Puzzle): [string, string] {
    const n = q.cake.n;
    return [`You cut a pie of ${n}. ${q.cake.rule === "chooser" ? "They take the bigger piece." : "You take the bigger piece."}`, "Which cut does a selfish divider make?"];
  }
  protected answerSpec(q: Puzzle): Answer {
    const n = q.cake.n;
    const even = `${n / 2} and ${n / 2}`;
    const lop = `${n} and 0`;
    return { mode: "pick", min: 0, max: 1, step: 1, init: 0, labels: q.evenAt === 0 ? [even, lop] : [lop, even], fmt: String };
  }
  protected judge(q: Puzzle, v: number): Verdict {
    const ok = v === answer(q);
    if (q.cake.rule === "chooser") return ok ? { ok, prompt: "Right. Cut evenly.", note: "They take the bigger piece, so the smaller one is yours. Make it as big as you can." } : { ok, prompt: "They would take the bigger piece.", note: "An uneven cut leaves you the small one." };
    return ok ? { ok, prompt: "Right. Keep it all.", note: "You pick first, so no cut protects them. The rule does not check you." } : { ok, prompt: "You pick first here.", note: "Nothing stops you from taking everything, so an even cut gives value away." };
  }
  protected readonly closing: [string, string] = ["Change the rule and selfish players change what they do.", "A good rule makes the selfish choice the fair one."];

  protected drawSee(p: Painter, c: Colors, _f: Frame): void {
    (["They pick first", "I pick first"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.seeArmed === i, chosen: this.rule === i, alpha: this.seeDone ? 0 : this.rule === i ? 1 : 0.7 });
    });
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 1, 2, 3, 4, 5], xLabel: "size of the smaller piece", yLabel: "you keep", fmt: String });
    if (this.rule >= 0) {
      const ck = this.cake();
      pl.curve(p, (a) => ck.share(a), c.ink, 1.75, 1, 20);
      if (this.touched) {
        const s = ck.share(this.probe);
        p.line(pl.X(this.probe), pl.base, pl.X(this.probe), pl.Y(s), c.ink, 1, 0.4, [3, 4]);
        p.disc(pl.X(this.probe), pl.Y(s), 6, c.ink);
      }
    }
  }

  protected drawProve(p: Painter, c: Colors, f: Frame, q: Puzzle, _v: number): void {
    const x0 = f.x + 30;
    const x1 = f.x + f.w - 30;
    const y = f.top + 80;
    p.rule(x0, y, x1, y, c.ink, 0.6);
    for (const x of [x0, x1]) p.rule(x, y - 6, x, y + 6, c.ink, 0.6);
    p.text(`pie of ${q.cake.n}`, this.cx, y - 22, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.disc(x0 + 16, y + 34, 6, c.ink);
    p.text("you cut", x0 + 30, y + 34, { font: Type.body(13, 400), color: c.ink, align: "left", base: "middle" });
    p.ring(this.cx + 30, y + 34, 6, c.ink, 1.5);
    p.text(q.cake.rule === "chooser" ? "they pick first" : "you pick first", this.cx + 44, y + 34, { font: Type.body(13, 400), color: c.ink, align: "left", base: "middle" });
  }
}
