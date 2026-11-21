import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { PayoffPlane } from "../shared/PayoffPlane";
import { TOTAL, afterTug, sumOf, sumPuzzle, type Pt, type SumPuzzle } from "./model";

const ROUNDS = 4;
const PULL = ["Light", "Medium", "Heavy"] as const;

/**
 * Feel: four tugs of war over a fixed pie. Whatever you win, they lose, and the discs trade area.
 * See: every round plotted. All the outcomes sit on one line, so the total never changes.
 * Prove: three sets of outcomes. Is each one zero-sum, with every outcome sharing one total?
 */
export class ZeroSumGame extends Game {
  readonly slug = "zero-sum";
  private readonly plane = new PayoffPlane();
  private you = 5;
  private round = 0;
  private locked = false;
  private since = 0;
  private yp = 0;
  private tp = 0;
  private revealed = false;
  private readonly youR = new Damped(1, 0.4);
  private readonly theirR = new Damped(1, 0.4);
  private readonly intro = new Damped(0, 0.7);
  private history: Pt[] = [[5, 5]];

  private seeStep = 0;
  private readonly dots = new Damped(0, 0.5);
  private readonly line = new Damped(0, 0.7);

  private puzzle: SumPuzzle = sumPuzzle(this.env.rng, true);
  private kinds: boolean[] = [];
  private pi = 0;
  private solved = 0;
  private answered = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly bZero = this.add(new CanvasButton("Zero-sum", () => this.answer(true)));
  private readonly bNot = this.add(new CanvasButton("Not zero-sum", () => this.answer(false)));

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 56 : 64) : 44;
  }

  begin(): void {
    this.you = 5;
    this.round = 0;
    this.locked = false;
    this.revealed = false;
    this.history = [[5, 5]];
    this.youR.snap(this.scale(5));
    this.theirR.snap(this.scale(5));
    this.kinds = this.env.rng.shuffle([true, false, true]);
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Pull light, medium or heavy. They pull too.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.history = [[5, 5], [7, 3], [6, 4], [3, 7], [4, 6]];
    this.round = ROUNDS;
    this.enterSee();
    this.seeStep = 1;
    this.dots.snap(1);
    this.line.snap(1);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    const bw = (f.w - 12) / 2;
    this.bZero.place(f.x, by, bw);
    this.bNot.place(f.x + bw + 12, by, bw);
    this.plane.fit(f, this.beat === "prove" ? 12 : 10);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS && !this.locked;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 1;
    this.bZero.visible = this.bNot.visible = this.beat === "prove" && !this.answered;
  }

  protected override zonesActive(): Box[] | null {
    return this.beat === "feel" && !this.locked && this.round < ROUNDS ? [0, 1, 2].map((i) => this.cells(3, i)) : null;
  }

  protected override onZone(i: number): void {
    this.play(i + 1);
  }

  protected override onDown(): void {
    if (this.beat !== "see" || this.seeStep >= 1) return;
    this.seeStep = 1;
    this.afterStep();
  }

  // ---- Feel -------------------------------------------------------------

  private scale(score: number): number {
    return Math.sqrt(Math.max(score, 0.05) / TOTAL);
  }

  private maxR(): number {
    return clamp((this.frame.h - 84) / 2, 24, 56);
  }

  private play(pull: number): void {
    this.yp = pull;
    this.tp = this.env.rng.pick([1, 2, 3]);
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch the two discs." : "Again. Pull.");
    this.sync();
  }

  private revealRound(): void {
    this.you = afterTug(this.you, this.yp, this.tp);
    const they = TOTAL - this.you;
    this.history.push([this.you, they]);
    this.youR.set(this.scale(this.you));
    this.theirR.set(this.scale(they));
    this.revealed = true;
    this.note.set(`You pulled ${this.yp}, they pulled ${this.tp}. You hold ${this.you}, they hold ${they}.`);
    this.announce(`You pulled ${this.yp}, they pulled ${this.tp}. You hold ${this.you}, they hold ${they}.`);
    this.round++;
    this.locked = false;
    if (this.round >= ROUNDS) this.prompt.set("Four pulls. What happened to the total?");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.dots.snap(0).set(1);
    this.line.snap(0);
    this.afterStep();
  }

  private afterStep(): void {
    if (this.seeStep === 0) {
      this.prompt.set("Every round, plotted. You on one axis, they on the other.");
      this.note.set("Tap to see what they have in common.");
    } else {
      this.line.set(1);
      this.prompt.set("They all sit on one line. The total never changes.");
      this.note.set("What you gain, they lose. That is zero-sum.");
      this.announce("Every outcome adds up to 10. What one side gains, the other loses.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.load();
  }

  private load(): void {
    this.puzzle = sumPuzzle(this.env.rng, this.kinds[this.pi % this.kinds.length]!);
    this.answered = false;
    this.reveal.snap(0);
    this.prompt.set("Do all four outcomes share one total?");
    this.note.set("");
    this.sync();
  }

  private answer(isZero: boolean): void {
    if (this.answered) return;
    this.answered = true;
    const ok = isZero === this.puzzle.constant;
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    if (ok) this.solved++;
    const z = this.puzzle;
    const odd = z.outlier === null ? 0 : sumOf(z.points[z.outlier]!);
    this.prompt.set(ok ? "Right." : "Not quite.");
    this.note.set(z.constant ? `Every outcome adds up to ${z.total}. Zero-sum.` : `One outcome adds up to ${Math.round(odd * 10) / 10}, the rest to ${z.total}. Not zero-sum.`);
    this.wait = 2.2;
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.dots.step(dt);
    this.line.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7 && !this.revealed) this.revealRound();
    }
    if (this.beat === "prove" && this.answered && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= 3) {
          this.prompt.set("Zero-sum means one fixed total, split between you.");
          this.note.set("If the total can grow or shrink, it is not zero-sum.");
          this.finish();
        } else {
          this.pi++;
          this.load();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawPlane(p, c);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const R = this.maxR();
    const off = Math.min(90, f.w / 2 - R - 8);
    const cy = f.top + 22 + (f.h - 22 - (R * 2 + 44)) / 2 + R;
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.text(`together ${TOTAL}`, this.cx, f.top + 12, { font: Type.mono(12), color: c.fog, align: "center", alpha: a });
    p.disc(xl, cy, R * this.youR.value, c.ink, 0.95 * a * idle);
    p.ring(xr, cy, R * this.theirR.value, c.ink, 1.5, a * idle);
    const ly = cy + R + 22;
    p.text(`You ${this.you}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(`They ${TOTAL - this.you}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    for (let i = 0; i < 3; i++) {
      const z = this.cells(3, i);
      const live = this.round < ROUNDS && !this.locked;
      const chosen = this.locked && this.yp === i + 1;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= ROUNDS ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedZone === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      for (let k = 0; k <= i; k++) p.line(gx - i * 4 + k * 8, z.y + z.h * 0.2, gx - i * 4 + k * 8, z.y + z.h * 0.42, c.ink, 1.5, al);
      p.text(PULL[i]!, gx, z.y + z.h * 0.78, { font: Type.body(14, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < ROUNDS) this.ticks(p, c, ROUNDS, this.round, this.round);
  }

  private drawPlane(p: Painter, c: Colors): void {
    const pl = this.plane;
    pl.axes(p, c);
    if (this.beat === "see") {
      const d = this.dots.value;
      const l = this.line.value;
      if (l > 0.01) {
        pl.sumLine(p, c, TOTAL, l);
        const [tx, ty] = pl.px(7.6, 7);
        p.text("total 10", tx, ty, { font: Type.mono(11), color: c.ink, align: "center", alpha: l });
      }
      for (const [x, y] of this.history) {
        const [px, py] = pl.px(x, y);
        p.disc(px, py, 6, c.ink, d);
      }
      return;
    }
    const z = this.puzzle;
    const r = this.reveal.value;
    for (const [x, y] of z.points) {
      const [px, py] = pl.px(x, y);
      p.disc(px, py, 6, c.ink);
    }
    if (r > 0.02) {
      if (z.constant) pl.sumLine(p, c, z.total, r);
      else {
        pl.sumLine(p, c, z.total, 0.6 * r, 1, [3, 4]);
        const [ox, oy] = pl.px(z.points[z.outlier!]![0], z.points[z.outlier!]![1]);
        p.ring(ox, oy, 13, c.ink, 1.5, r);
      }
    }
    this.ticks(p, c, 3, this.solved, Math.min(this.pi, 2));
  }
}
