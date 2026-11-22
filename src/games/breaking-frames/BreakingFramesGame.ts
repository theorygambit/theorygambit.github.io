import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { MatrixView, inside } from "../shared/MatrixView";
import { drawChoice, drawMatrixLabels, drawPayoffCell, drawTicks, fmt, trio } from "../shared/kit";
import { FEEL_STANDOFF, FINE, LEVERS, PROVE_STANDOFFS, type Lever, type Standoff } from "./model";

const NAME: Record<Lever, string> = { first: "Move first", fine: "Add a fine", exit: "Walk away" };
const SUB = (l: Lever, s: Standoff): string => (l === "first" ? "commit a row" : l === "fine" ? `-${FINE} on their Press` : `take ${s.exit}`);

/**
 * Feel: you are stuck at 1 while the rival gets 5. Instead of playing the game, change it: move first, add a fine, or walk away.
 * See: the table, then the same table after the fine, where the equilibrium moves.
 * Prove: three new standoffs. Tap the lever that helps most.
 */
export class BreakingFramesGame extends Game {
  readonly slug = "breaking-frames";
  private readonly s = FEEL_STANDOFF;
  private tried: boolean[] = [false, false, false];
  private armed = -1;
  private readonly youV = new Damped(1, 0.4);
  private readonly themV = new Damped(5, 0.4);
  private readonly baseV = new Damped(1, 0.4);
  private last: Lever | null = null;

  private readonly mv = new MatrixView();
  private phase = 0;
  private readonly swap = new Damped(0, 0.6);
  private readonly mark = new Damped(0, 0.5);

  private cases: Standoff[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong = -1;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.tried = [false, false, false];
    this.last = null;
    this.youV.snap(this.s.base);
    this.themV.snap(5);
    this.baseV.snap(this.s.base);
    this.phase = 0;
    this.swap.snap(0);
    this.mark.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("You are stuck at 1 and they get 5. Change the game.");
    this.note.set("Try each lever. Each one rewrites a different thing.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.tried = [true, true, true];
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.tried.every(Boolean);
    this.toProve.visible = this.beat === "see" && this.phase >= 2;
  }

  // ---- Input ------------------------------------------------------------

  private hit(x: number, y: number): number {
    const f = this.frame;
    for (let i = 0; i < 3; i++) if (inside(trio(f, i), x, y)) return i;
    return -1;
  }

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" || (this.beat === "prove" && !this.locked)) this.armed = this.hit(x, y);
    else if (this.beat === "see") this.advance();
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = -1;
    if (a < 0 || this.hit(x, y) !== a) return;
    if (this.beat === "feel") this.tryLever(a);
    else if (this.beat === "prove" && !this.locked) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private tryLever(i: number): void {
    const l = LEVERS[i]!;
    this.tried[i] = true;
    this.last = l;
    this.youV.set(this.s.result(l));
    this.themV.set(Math.max(0, this.s.rival(l)));
    const gain = this.s.result(l) - this.s.base;
    this.cue(gain > 0 ? "good" : "bad");
    const left = this.tried.filter((t) => !t).length;
    this.prompt.set(gain > 0 ? `${NAME[l]}: you go from ${fmt(this.s.base)} to ${fmt(this.s.result(l))}.` : `${NAME[l]}: nothing changes for you.`);
    this.note.set(left > 0 ? `${left} lever${left === 1 ? "" : "s"} left to try.` : "All three tried. Compare them.");
    this.announce(`${NAME[l]}. You get ${fmt(this.s.result(l))}, up from ${fmt(this.s.base)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.phase = 0;
    this.swap.snap(0);
    this.mark.snap(0);
    this.prompt.set("Here is the game you were stuck in.");
    this.note.set("Their Press beats Hold whatever you do. Tap to move first.");
    this.sync();
  }

  private advance(): void {
    if (this.phase >= 2) return;
    this.phase++;
    if (this.phase === 1) {
      this.mark.set(1);
      this.prompt.set("Moving first does not help.");
      this.note.set(`They still Press, whatever you commit to. You keep ${fmt(this.s.first)}. Tap again.`);
    } else {
      this.swap.set(1);
      this.prompt.set("A fine rewrites their payoffs, and the equilibrium moves.");
      this.note.set(`Now Hold beats Press for them, and you get ${fmt(this.s.fine)}. Change the table, not your move.`);
      this.announce(`With a fine on their Press, the equilibrium moves and you get ${this.s.fine}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_STANDOFFS);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
    this.sync();
  }

  private loadCase(): void {
    this.locked = false;
    this.wrong = -1;
    this.mark.snap(0);
    this.prompt.set(this.pi === 0 ? "A new standoff. Which lever helps most?" : "Another. Which lever helps most?");
    this.note.set("Work out where each lever leaves you.");
  }

  private answer(i: number): void {
    const s = this.cases[this.pi]!;
    if (LEVERS[i] === s.best) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = -1;
      this.mark.set(1);
      this.prompt.set(`Right. ${NAME[LEVERS[i]!]} gets you ${fmt(s.result(LEVERS[i]!))}.`);
      this.note.set(`Move first ${fmt(s.first)}, fine ${fmt(s.fine)}, walk away ${fmt(s.exit)}. As it stands ${fmt(s.base)}.`);
      this.wait = 2.6;
    } else {
      this.cue("bad");
      this.wrong = i;
      this.prompt.set(`Not quite. ${NAME[LEVERS[i]!]} gets you ${fmt(s.result(LEVERS[i]!))}.`);
      this.note.set(`As it stands you get ${fmt(s.base)}. Try another lever.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.youV.step(dt);
    this.themV.step(dt);
    this.baseV.step(dt);
    this.swap.step(dt);
    this.mark.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("When you are losing inside a game, change the game.");
          this.note.set("The right lever depends on the table: sometimes the order, sometimes the payoffs, sometimes the door.");
          this.finish();
        } else {
          this.pi++;
          this.loadCase();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawTable(p, c, f);
  }

  private levers(p: Painter, c: Colors, s: Standoff, alpha: (i: number) => number): void {
    LEVERS.forEach((l, i) => {
      drawChoice(p, c, trio(this.frame, i), { label: NAME[l], sub: SUB(l, s), r: 10, alpha: alpha(i), armed: this.armed === i });
    });
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const R = clamp((f.h - 90) / 2, 18, 54);
    const cy = f.top + R + 8;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 5);
    p.dashedRing(xl, cy, r(this.baseV.value), c.ink, 0.8);
    if (this.youV.value > 0.05) p.disc(xl, cy, r(this.youV.value), c.ink, 0.92);
    if (this.themV.value > 0.05) p.ring(xr, cy, r(this.themV.value), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text(`You ${fmt(Math.round(this.youV.target * 10) / 10)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`They ${fmt(Math.round(this.themV.target * 10) / 10)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (!this.tried.every(Boolean)) this.levers(p, c, this.s, (i) => (this.tried[i] ? (this.last === LEVERS[i] ? 1 : 0.55) : 1));
    drawTicks(p, c, f, this.cx, 3, this.tried.filter(Boolean).length, this.tried.findIndex((t) => !t));
  }

  private placeMatrix(f: Frame): void {
    this.mv.fit(this.cx, f.top, f.w, f.h, 140);
    const total = this.mv.colLabelH + 2 * this.mv.cell;
    this.mv.fit(this.cx, f.top + Math.max(0, (f.h - total) / 2), f.w, f.h, 140);
  }

  private drawTable(p: Painter, c: Colors, f: Frame): void {
    this.placeMatrix(f);
    const m = this.mv;
    const prove = this.beat !== "see";
    const s = prove ? this.cases[Math.min(this.pi, this.cases.length - 1)]! : this.s;
    const sw = prove ? 0 : this.swap.value;
    const bm = s.table();
    const fined = s.fined();
    m.grid(p, c);
    drawMatrixLabels(p, c, m, bm);
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        drawPayoffCell(p, c, m, r, col, bm, 1 - sw);
        if (sw > 0.01) drawPayoffCell(p, c, m, r, col, fined, sw);
      }
    }
    const eq = s.equilibrium;
    const ef = s.fineCell;
    const b = (cell: [number, number]) => m.rect(cell[0], cell[1]);
    if (this.beat === "see") {
      const be = b(eq);
      p.frame(be.x + 4, be.y + 4, be.w - 8, be.h - 8, c.ink, 1 - sw);
      const fc = this.mark.value * (1 - sw);
      if (fc > 0.01) {
        const bf = b(s.firstCell);
        p.disc(bf.x + 9, bf.y + 9, 3, c.ink, fc);
      }
      if (sw > 0.01) {
        const bn = b(ef);
        p.frame(bn.x + 4, bn.y + 4, bn.w - 8, bn.h - 8, c.ink, sw);
      }
      drawTicks(p, c, f, this.cx, 3, this.phase + 1, this.phase);
      return;
    }
    const be = b(eq);
    p.frame(be.x + 4, be.y + 4, be.w - 8, be.h - 8, c.ink, 0.9);
    this.levers(p, c, s, (i) => (this.wrong === i ? 0.35 : this.locked && LEVERS[i] !== s.best ? 0.3 : 1));
    drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
  }
}
