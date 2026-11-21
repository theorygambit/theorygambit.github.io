import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { PayoffPlane } from "../shared/PayoffPlane";
import { PIE, botMoves, destroyed, payoff, selectPuzzle, worseForBoth, type Move, type Pt, type SelectPuzzle } from "./model";

const ROUNDS = 4;
const NAME: Record<Move, string> = { fight: "Fight", walk: "Walk" };

/**
 * Feel: four rounds of fight or walk. Walking away keeps the whole pie, and every fight burns some of it.
 * See: the four outcomes against the line where nothing is lost. All the fights fall below it.
 * Prove: tap every outcome that leaves both sides worse off than where they started.
 */
export class NegativeSumGame extends Game {
  readonly slug = "negative-sum";
  private readonly plane = new PayoffPlane();
  private bot: Move[] = [];
  private round = 0;
  private locked = false;
  private mine: Move | null = null;
  private theirs: Move | null = null;
  private since = 0;
  private revealed = false;
  private last: Pt = [5, 5];
  private readonly youR = new Damped(1, 0.35);
  private readonly theirR = new Damped(1, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly dots = new Damped(0, 0.5);
  private readonly lineT = new Damped(0, 0.7);
  private readonly lost = new Damped(0, 0.7);

  private puzzle: SelectPuzzle = selectPuzzle(this.env.rng);
  private picked: boolean[] = [];
  private pi = 0;
  private solved = 0;
  private locked2 = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly check = this.add(new CanvasButton("Check", () => this.doCheck(), "primary"));

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  begin(): void {
    this.bot = botMoves(this.env.rng);
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.theirs = null;
    this.revealed = false;
    this.last = [5, 5];
    this.youR.snap(this.scale(5));
    this.theirR.snap(this.scale(5));
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Fight or walk away. They choose at the same time.");
    this.note.set("Walking away from both keeps 5 each.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
    this.enterSee();
    this.seeStep = 2;
    this.dots.snap(1);
    this.lineT.snap(1);
    this.lost.snap(1);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.check]) b.place(this.cx - 80, by, 160);
    this.plane.fit(this.frame, PIE);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS && !this.locked;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.check.visible = this.beat === "prove" && !this.locked2;
  }

  private provePoints(): Box[] {
    return this.puzzle.points.map((pt) => {
      const [x, y] = this.plane.px(pt[0], pt[1]);
      return { x: x - 15, y: y - 15, w: 30, h: 30 };
    });
  }

  protected override zonesActive(): Box[] | null {
    if (this.beat === "feel" && !this.locked && this.round < ROUNDS) return [this.cells(2, 0), this.cells(2, 1)];
    if (this.beat === "prove" && !this.locked2) return this.provePoints();
    return null;
  }

  protected override onZone(i: number): void {
    if (this.beat === "feel") return this.play(i === 0 ? "fight" : "walk");
    this.picked[i] = !this.picked[i];
    this.cue("good");
  }

  protected override onDown(): void {
    if (this.beat !== "see" || this.seeStep >= 2) return;
    this.seeStep++;
    this.afterStep();
  }

  // ---- Feel -------------------------------------------------------------

  private scale(v: number): number {
    return Math.sqrt(Math.max(v, 0.05) / 7);
  }

  private maxR(): number {
    return clamp((this.frame.h - 56) / 2, 20, 54);
  }

  private play(m: Move): void {
    this.mine = m;
    this.theirs = this.bot[this.round]!;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what is left." : "Again. Fight or walk.");
    this.sync();
  }

  private revealRound(): void {
    const pay = payoff(this.mine!, this.theirs!);
    this.last = pay;
    this.youR.set(this.scale(pay[0]));
    this.theirR.set(this.scale(pay[1]));
    this.revealed = true;
    const gone = destroyed(pay);
    this.note.set(`${gone === 0 ? "Nothing lost." : `${gone} of the pie is gone.`} You got ${pay[0]}, they got ${pay[1]}.`);
    this.announce(`You got ${pay[0]}, they got ${pay[1]}. ${gone === 0 ? "Nothing was lost." : `${gone} of the pie is gone.`}`);
    this.round++;
    this.locked = false;
    if (this.round >= ROUNDS) this.prompt.set("Four rounds. Where did the pie go?");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.dots.snap(0).set(1);
    this.lineT.snap(0);
    this.lost.snap(0);
    this.afterStep();
  }

  private afterStep(): void {
    if (this.seeStep === 0) {
      this.prompt.set("The four possible outcomes, plotted.");
      this.note.set("Tap to compare them with the whole pie.");
    } else if (this.seeStep === 1) {
      this.lineT.set(1);
      this.prompt.set("This line is the whole pie: 10.");
      this.note.set("Only walking from both stays on it. Tap again.");
    } else {
      this.lost.set(1);
      this.prompt.set("Every fight falls below it. Value is destroyed.");
      this.note.set("Negative-sum: the total shrinks when players fight.");
      this.announce("Every outcome with a fight is below the line, so value is destroyed.");
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
    this.puzzle = selectPuzzle(this.env.rng);
    this.picked = this.puzzle.points.map(() => false);
    this.locked2 = false;
    this.reveal.snap(0);
    this.prompt.set("Tap every outcome worse for both.");
    this.note.set("The ring is where you started.");
    this.sync();
  }

  private doCheck(): void {
    const want = this.puzzle.points.map((p) => worseForBoth(p, this.puzzle.status));
    const ok = want.every((w, i) => w === this.picked[i]);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked2 = true;
      this.solved++;
      this.reveal.set(1);
      this.prompt.set("Right. Both are poorer than at the start.");
      this.note.set("Those outcomes are below and left of the ring.");
      this.wait = 2.2;
    } else {
      const n = want.filter(Boolean).length;
      const got = this.picked.filter(Boolean).length;
      this.prompt.set("Not quite. Worse for both means lower on both axes.");
      this.note.set(`You picked ${got}. There ${n === 1 ? "is 1" : `are ${n}`}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.dots.step(dt);
    this.lineT.step(dt);
    this.lost.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7 && !this.revealed) this.revealRound();
    }
    if (this.beat === "prove" && this.locked2 && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= 2) {
          this.prompt.set("Fighting shrinks the pie. Walking keeps it.");
          this.note.set("Negative-sum: everyone can end up poorer.");
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
    const cy = f.top + (f.h - (2 * R + 48)) / 2 + R;
    const off = Math.min(86, f.w / 2 - R - 10);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.dashedRing(xl, cy, R * this.scale(5), c.ink, 0.6 * a);
    p.dashedRing(xr, cy, R * this.scale(5), c.ink, 0.6 * a);
    p.disc(xl, cy, R * this.youR.value, c.ink, 0.95 * a * idle);
    p.ring(xr, cy, R * this.theirR.value, c.ink, 1.5, a * idle);
    const ly = cy + R + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed) {
      p.text(String(this.last[0]), xl, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(String(this.last[1]), xr, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    for (const i of [0, 1] as const) {
      const z = this.cells(2, i);
      const m: Move = i === 0 ? "fight" : "walk";
      const live = this.round < ROUNDS && !this.locked;
      const chosen = this.locked && this.mine === m;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= ROUNDS ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedZone === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const gy = z.y + z.h * 0.36;
      if (m === "fight") {
        p.line(gx - 9, gy - 9, gx + 9, gy + 9, c.ink, 1.5, al);
        p.line(gx - 9, gy + 9, gx + 9, gy - 9, c.ink, 1.5, al);
      } else p.arrow(gx - 11, gy, gx + 11, gy, c.ink, 1.5, al, 7);
      p.text(NAME[m], gx, z.y + z.h * 0.8, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < ROUNDS) this.ticks(p, c, ROUNDS, this.round, this.round);
  }

  private drawPlane(p: Painter, c: Colors): void {
    const pl = this.plane;
    pl.axes(p, c);
    if (this.beat === "see") {
      const d = this.dots.value;
      const l = this.lineT.value;
      const lost = this.lost.value;
      if (lost > 0.01) {
        const [x1, y1] = pl.px(0, 0);
        const [x2, y2] = pl.px(PIE, 0);
        const [x3, y3] = pl.px(0, PIE);
        p.ctx.save();
        p.ctx.globalAlpha = 0.07 * lost;
        p.ctx.fillStyle = c.ink;
        p.ctx.beginPath();
        p.ctx.moveTo(x1, y1);
        p.ctx.lineTo(x2, y2);
        p.ctx.lineTo(x3, y3);
        p.ctx.closePath();
        p.ctx.fill();
        p.ctx.restore();
      }
      if (l > 0.01) pl.sumLine(p, c, PIE, l);
      const pts: [Move, Move, string][] = [["walk", "walk", "both walk"], ["fight", "walk", ""], ["walk", "fight", ""], ["fight", "fight", "both fight"]];
      for (const [a, b, label] of pts) {
        const [x, y] = payoff(a, b);
        const [px, py] = pl.px(x, y);
        p.disc(px, py, 6, c.ink, d);
        if (label === "both walk") p.text(label, px + 12, py - 12, { font: Type.body(12, 400), color: c.fog, alpha: d });
        if (label === "both fight") p.text(label, px, py + 24, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: d });
      }
      return;
    }
    const z = this.puzzle;
    const r = this.reveal.value;
    const [sx, sy] = pl.px(z.status[0], z.status[1]);
    if (r > 0.02) {
      const [ox, oy] = pl.px(0, 0);
      p.rect(ox, sy, sx - ox, oy - sy, c.ink, 0.07 * r);
    }
    p.dashedRing(sx, sy, 12, c.ink, 0.9);
    z.points.forEach((pt, i) => {
      const [x, y] = pl.px(pt[0], pt[1]);
      p.disc(x, y, 6, c.ink);
      if (this.picked[i]) p.ring(x, y, 13, c.ink, 1.5);
    });
    this.ticks(p, c, 2, this.solved, this.pi);
  }
}
