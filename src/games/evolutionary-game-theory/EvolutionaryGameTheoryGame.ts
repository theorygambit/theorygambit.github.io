import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_GAME, PROVE_POOL, PROVE_TOLERANCE, type HawkDove } from "./model";

const GENERATIONS = 10;
const RUNS = 2;
const DOTS = 20;
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: pick a starting share of hawks and watch ten generations, twice from different starts.
 * See: drag the hawk share along a line of hawk minus dove. It crosses zero at the stable share.
 * Prove: new prize and cost. Drag to the share where hawks and doves earn the same.
 */
export class EvolutionaryGameTheoryGame extends Game {
  readonly slug = "evolutionary-game-theory";
  private g: HawkDove = FEEL_GAME;
  private run = 0;
  private stage: "choose" | "run" | "done" = "choose";
  private path: number[] = [];
  private gen = 0;
  private since = 0;
  private readonly share = new Damped(0.5, 0.3);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private pool: HawkDove[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly evolve = this.add(new CanvasButton("Evolve", () => this.start(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRun(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_GAME;
    this.run = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRun();
  }

  private startRun(): void {
    this.stage = "choose";
    this.sl.range(0.05, 0.95, 0.05);
    this.sl.value = this.run === 0 ? 0.9 : 0.1;
    this.share.snap(this.sl.value);
    this.path = [];
    this.gen = 0;
    this.prompt.set(this.run === 0 ? "Pick a starting share of hawks." : "Now start from the other side.");
    this.note.set("Hawks fight for the prize. Doves share or retreat.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.run = RUNS;
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.evolve.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.evolve.visible = this.beat === "feel" && this.stage === "choose";
    this.next.visible = this.beat === "feel" && this.stage === "done";
    this.next.label = this.run >= RUNS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose" && this.sl.hit(x, y)) this.drag(x);
    else if (this.beat === "see" && this.chartHit(x, y)) this.drag(x);
    else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) this.drag(x);
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.drag(x, true);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private drag(x: number, moving = false): void {
    if (!moving) this.dragging = true;
    if (this.beat === "see") {
      const c = this.chart(this.frame);
      this.sl.value = Math.round(clamp((x - c.x0) / c.w, 0, 1) * 100) / 100;
      this.seeNote();
    } else {
      this.sl.setFromX(x);
      if (this.beat === "feel") this.share.snap(this.sl.value);
    }
  }

  // ---- Feel -------------------------------------------------------------

  private start(): void {
    if (this.stage !== "choose") return;
    let x = this.sl.value;
    this.path = [x];
    for (let i = 0; i < GENERATIONS; i++) {
      x = this.g.step(x);
      this.path.push(x);
    }
    this.stage = "run";
    this.gen = 0;
    this.since = 0;
    this.prompt.set("Strategies that beat the average spread.");
    this.note.set("");
    this.cue("good");
    this.sync();
  }

  private finishRun(): void {
    this.stage = "done";
    this.run++;
    const x0 = this.path[0]!;
    const x1 = this.path[this.path.length - 1]!;
    this.prompt.set(this.run >= RUNS ? "Two starts, one place." : "It settled. Try the other side.");
    this.note.set(`From ${pct(x0)} hawks it settled near ${pct(x1)}.`);
    this.announce(`From ${pct(x0)} hawks the population settled near ${pct(x1)}.`);
    this.sync();
  }

  private nextRun(): void {
    if (this.stage !== "done") return;
    if (this.run >= RUNS) return this.enterSee();
    this.startRun();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.9;
    this.lo = 1;
    this.hi = 0;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag the hawk share. Who gains?");
    this.note.set("Above the axis hawks gain. Below it doves do.");
    this.sync();
  }

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (p: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const hi = g.V / 2 + 0.5;
    const lo = g.V / 2 - g.C / 2 - 0.5;
    return { x0, w, top, h, X: (p) => x0 + p * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private seeNote(): void {
    const x = this.sl.value;
    const g = this.g;
    this.lo = Math.min(this.lo, x);
    this.hi = Math.max(this.hi, x);
    const dir = g.drift(x);
    this.note.set(`${pct(x)} hawks. ${dir === 1 ? "Hawks earn more, so they spread." : "Doves earn more, so hawks shrink."}`);
    if (!this.reached && this.lo < g.stable - 0.1 && this.hi > g.stable + 0.1) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`It turns at ${pct(g.stable)}.`);
      this.announce(`The share settles where hawks and doves earn the same, at ${pct(g.stable)}.`);
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pool = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.g = this.pool[this.pi]!;
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New payoffs. Where do hawks and doves earn the same?" : "Different payoffs. Where do they meet?");
    this.note.set("Drag the hawk share.");
    this.sync();
  }

  private lockIn(): void {
    const g = this.g;
    const x = this.sl.value;
    const ok = Math.abs(x - g.stable) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Both earn the same there.");
      this.note.set(`${g.V} / ${g.C} = ${fmt(g.stable)}. Each earns ${fmt(g.dove(g.stable))}.`);
      this.wait = 1.9;
    } else {
      this.prompt.set("Not quite. Make the two earnings equal.");
      this.note.set(`At ${pct(x)}: hawk ${fmt(g.hawk(x))}, dove ${fmt(g.dove(x))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.share.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "run") {
      this.since += dt;
      if (this.since > 0.45) {
        this.since = 0;
        this.gen++;
        this.share.set(this.path[this.gen]!);
        if (this.gen >= GENERATIONS) this.finishRun();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.pool.length) {
          this.prompt.set("What pays above average spreads.");
          this.note.set("Where both earn the same, the mix holds.");
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
    else if (this.beat === "see") this.drawChart(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const g = this.g;
    const x = this.share.value;
    const perRow = 10;
    const step = f.w / perRow;
    const r = Math.min(clamp((f.h - 150) / 6, 5, 12), step / 2 - 4);
    const hawks = Math.round(x * DOTS);
    for (let i = 0; i < DOTS; i++) {
      const dx = f.x + step * ((i % perRow) + 0.5);
      const dy = f.top + r + 4 + Math.floor(i / perRow) * (r * 2 + 8);
      if (i < hawks) p.disc(dx, dy, r, c.ink, 0.92 * a);
      else p.ring(dx, dy, r, c.ink, 1.5, a);
    }
    const R = clamp((f.h - 150) / 4, 8, 22);
    const cy = f.top + 2 * (r * 2 + 8) + R + 10;
    const hp = g.hawk(x);
    const dp = g.dove(x);
    const off = Math.min(80, f.w / 2 - R - 10);
    const sz = (v: number) => R * Math.sqrt(Math.max(v, 0) / (g.V + 0.01));
    if (hp > 0) p.disc(this.cx - off, cy, sz(hp), c.ink, 0.92 * a);
    else p.dashedRing(this.cx - off, cy, 4, c.ink, a);
    p.ring(this.cx + off, cy, Math.max(2, sz(dp)), c.ink, 1.5, a);
    p.text(`hawk ${fmt(hp)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`dove ${fmt(dp)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    this.sl.draw(p, c, { ticks: [0.05, 0.5, 0.95], label: (v) => pct(v), text: (v) => (this.stage === "choose" ? `start ${pct(v)}` : `${pct(x)} hawks`), alpha: a });
    for (let i = 0; i < RUNS; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.run, i === this.run);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const { x0, w, top, h, X, Y } = this.chart(f);
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("hawk minus dove", x0, top - 14, { font, color: c.fog });
    p.text("share of hawks", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    const diff = (x: number) => g.hawk(x) - g.dove(x);
    p.line(X(0), Y(diff(0)), X(1), Y(diff(1)), c.ink, 2, 1);
    const xv = this.sl.value;
    p.rule(X(xv), top, X(xv), top + h, c.ink, 0.3);
    p.disc(X(xv), Y(diff(xv)), 6, c.ink, 1);
    const dir = g.drift(xv);
    const ay = top + h + 4;
    p.arrow(X(xv) - dir * 14, ay, X(xv) + dir * 14, ay, c.ink, 1.5, 1, 6);
    const cr = this.cross.value;
    if (cr > 0.01) {
      p.ring(X(g.stable), Y(0), 11, c.ink, 1.5, cr);
      p.text(pct(g.stable), X(g.stable), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    p.text(`prize ${g.V}`, this.cx - 60, f.top + 40, { font: Type.mono(16), color: c.ink, align: "center" });
    p.text(`fight cost ${g.C}`, this.cx + 60, f.top + 40, { font: Type.mono(16), color: c.ink, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 0.5, 1], label: (v) => pct(v), text: (v) => `${pct(v)} hawks` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(g.stable), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.pool.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
