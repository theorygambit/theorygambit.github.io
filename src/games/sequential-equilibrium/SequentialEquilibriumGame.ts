import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { drawChoice, Slider, fmt } from "../shared/kit";
import { FEEL, FEEL_ROUNDS, feelBeliefs, proveSet, type Belief } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: you cannot tell which of two spots you are in, but you hold a belief about it. Pick L or R at five different beliefs.
 * See: probe the belief axis. L climbs and R falls, and the best move flips where they cross.
 * Prove: new payoffs. Drag the belief to where L and R pay the same.
 */
export class SequentialEquilibriumGame extends Game {
  readonly slug = "sequential-equilibrium";
  private beliefs: number[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private readonly plot = new Plot({ xMin: 0, xMax: 1, yMin: 0, yMax: FEEL.max, padL: 30, padR: 30, padT: 28, padB: 54, maxH: 220 });
  private probe = 0.5;
  private touched = false;
  private seenLow = false;
  private seenHigh = false;
  private reached = false;
  private dragging = false;
  private readonly cross = new Damped(0, 0.5);

  private cases: Belief[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly sl = new Slider();
  private readonly dl = new Damped(0, 0.2);
  private readonly dr = new Damped(0, 0.2);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.beliefs = feelBeliefs(this.env.rng);
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose((i % 2) as 0 | 1);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setProbe(this.plot.X(0.1));
    this.setProbe(this.plot.X(0.9));
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 60 : 68) : 44;
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(f);
    this.sl.place(f.x + 30, f.x + f.w - 30, f.bottom - 34);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked && y > this.sl.y - 40) {
      this.dragging = true;
      this.sl.setFromX(x, 0.01);
      this.touch();
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove" && !this.locked) {
      this.sl.setFromX(x, 0.01);
      this.touch();
    }
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a !== null && this.beat === "feel" && this.stage === "choose" && this.hit(a, x, y)) this.choose(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = null;
    this.show.snap(0);
    const p = this.beliefs[this.round]!;
    this.prompt.set(`You think there is a ${pct(p)} chance you are at X.`);
    this.note.set(`Round ${this.round + 1} of ${FEEL_ROUNDS}. L pays 6 at X and 0 at Y. R pays 0 at X and 4 at Y.`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const p = this.beliefs[this.round]!;
    const pay = i === 0 ? FEEL.payL(p) : FEEL.payR(p);
    const alt = i === 0 ? FEEL.payR(p) : FEEL.payL(p);
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(pay);
    this.alt.snap(0).set(alt);
    this.prompt.set(`${i === 0 ? "L" : "R"} pays ${fmt(pay)} on average.`);
    this.note.set(`${i === 0 ? "R" : "L"} would have paid ${fmt(alt)}.`);
    this.announce(`You get ${fmt(pay)} on average. The other move pays ${fmt(alt)}.`);
    this.cue(pay >= alt ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.touched = false;
    this.seenLow = false;
    this.seenHigh = false;
    this.reached = false;
    this.probe = 0.5;
    this.cross.snap(0);
    this.prompt.set("Drag along the belief line. Which move wins?");
    this.note.set("Try a low belief and a high one.");
    this.sync();
  }

  private setProbe(x: number): void {
    const p = clamp(Math.round(this.plot.valueAtX(x) * 20) / 20, 0, 1);
    this.probe = p;
    this.touched = true;
    const t = FEEL.threshold();
    this.seenLow = this.seenLow || p <= t - 0.2;
    this.seenHigh = this.seenHigh || p >= t + 0.2;
    this.note.set(`At ${pct(p)}: L pays ${fmt(FEEL.payL(p))}, R pays ${fmt(FEEL.payR(p))}.`);
    if (!this.reached && this.seenLow && this.seenHigh) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`They cross at ${pct(t)}. Above it L wins.`);
      this.announce(`L and R pay the same at ${pct(t)}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const b = this.cases[this.pi]!;
    this.locked = false;
    this.sl.value = 0.5;
    this.touch();
    this.dl.snap(b.payL(0.5));
    this.dr.snap(b.payR(0.5));
    this.prompt.set(`X: L ${b.xL}, R ${b.xR}. Y: L ${b.yL}, R ${b.yR}.`);
    this.note.set("Drag the belief in X to where L and R pay the same.");
    this.sync();
  }

  /** Follow the slider: discs show what each move pays on average. */
  private touch(): void {
    const b = this.cases[this.pi];
    if (!b) return;
    this.dl.set(b.payL(this.sl.value));
    this.dr.set(b.payR(this.sl.value));
    this.note.set(`Belief in X: ${pct(this.sl.value)}.`);
  }

  private lockIn(): void {
    const b = this.cases[this.pi]!;
    const p = this.sl.value;
    if (b.isRight(p)) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. They tie at ${pct(b.threshold())}.`);
      this.note.set("Above it L wins, below it R wins.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      const l = b.payL(p) > b.payR(p);
      this.prompt.set(l ? "Too high. L still pays more." : "Too low. R still pays more.");
      this.note.set(`At ${pct(p)}: L pays ${fmt(b.payL(p))}, R pays ${fmt(b.payR(p))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.alt, this.show, this.cross, this.dl, this.dr]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A belief decides the move, and the move must fit it.");
          this.note.set("Equilibrium needs beliefs that match the play.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const open = this.stage === "choose";
    (["L", "R"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 4.6, (f.h - 80) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 6) / 6);
    const pb = this.beliefs[Math.min(this.round, this.beliefs.length - 1)]!;
    // Ten dots: the share filled is the belief in X.
    const n = 10;
    const gap = Math.min(22, (f.w - 40) / n);
    for (let i = 0; i < n; i++) {
      const x = this.cx - ((n - 1) * gap) / 2 + i * gap;
      if (i < Math.round(pb * n)) p.disc(x, cy + R + 22, 4, c.ink);
      else p.ring(x, cy + R + 22, 4, c.ink, 1.25);
    }
    const sv = this.show.value;
    if (open) {
      p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    } else if (sv > 0.01) {
      p.disc(this.cx, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.dashedRing(this.cx, cy, rad(this.alt.value), c.ink, 0.8 * sv);
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.5, 1], xLabel: "belief that you are at X", yLabel: "pay", fmt: (v) => (v <= 1 ? pct(v) : String(v)) });
    pl.curve(p, (b) => FEEL.payL(b), c.ink, 1.75, 1, 20);
    pl.curve(p, (b) => FEEL.payR(b), c.ink, 1.25, 0.5, 20);
    p.text("L", pl.X(1) + 12, pl.Y(FEEL.payL(1)), { font: Type.body(13, 400), color: c.ink, align: "left", base: "middle" });
    p.text("R", pl.X(0) - 12, pl.Y(FEEL.payR(0)), { font: Type.body(13, 400), color: c.ink, align: "right", base: "middle" });
    const t = FEEL.threshold();
    const cv = this.cross.value;
    if (cv > 0.01) p.ring(pl.X(t), pl.Y(FEEL.payL(t)), 11, c.ink, 1.5, cv);
    if (this.touched) {
      const x = pl.X(this.probe);
      p.line(x, pl.base, x, pl.Y(Math.max(FEEL.payL(this.probe), FEEL.payR(this.probe))), c.ink, 1, 0.4, [3, 4]);
      p.disc(x, pl.Y(FEEL.payL(this.probe)), 6, c.ink);
      p.ring(x, pl.Y(FEEL.payR(this.probe)), 6, c.ink, 1.5);
    }
    Glyph.step(p, c, this.cx - 10, f.tickY, this.seenLow, false);
    Glyph.step(p, c, this.cx + 10, f.tickY, this.seenHigh, false);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const b = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, b.max) / b.max);
    p.disc(xl, cy, rad(this.dl.value), c.ink, 0.95);
    p.ring(xr, cy, rad(this.dr.value), c.ink, 1.5);
    p.text("L", xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text("R", xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    this.sl.draw(p, c);
    p.text("0%", this.sl.x0, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", this.sl.x1, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
