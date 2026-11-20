import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { FEEL_PERIODS, FEEL_POND, PROVE_TOLERANCE, Pond, proveSet } from "./model";

const fmt = (v: number): string => String(Math.round(v * 10) / 10);
/** The last pair of Prove ponds, so a replay never shows the same two. */
let lastKey = "";

/**
 * Feel: five periods on a shared pond. What you leave grows back, so today's take sets tomorrow's pond.
 * See: tomorrow's pond against today's take. It stays full up to a kink, then falls.
 * Prove: new ponds. Drag the steady harvest that keeps each one full.
 */
export class DynamicGamesGame extends Game {
  readonly slug = "dynamic-games";
  private readonly pond = FEEL_POND;
  private stock = FEEL_POND.K;
  private period = 0;
  private stage: "choose" | "grow" | "result" | "end" = "choose";
  private amount = 5;
  private since = 0;
  private grown = false;
  private total = 0;
  private took: number[] = [];
  private readonly pondV = new Damped(10, 0.4);
  private readonly youV = new Damped(0, 0.3);
  private readonly rivV = new Damped(0, 0.3);
  private readonly totV = new Damped(0, 0.5);
  private readonly steadyV = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private probe = 9;
  private readonly probeShown = new Damped(9, 0.12);
  private found = false;
  private readonly kink = new Damped(0, 0.6);

  private ponds: Pond[] = [];
  private pi = 0;
  private ph = 6;
  private dragging = false;
  private locked = false;
  private tried = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly take = this.add(new CanvasButton("Take", () => this.takeNow(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));
  private readonly plot = new Plot({ xMin: 0, xMax: 10, yMin: 0, yMax: 11.5, padL: 20, padR: 20, padT: 26, padB: 54, maxH: 220 });

  begin(): void {
    this.stock = this.pond.K;
    this.period = 0;
    this.stage = "choose";
    this.amount = 5;
    this.total = 0;
    this.took = [];
    this.pondV.snap(this.pond.K);
    this.youV.snap(5);
    this.rivV.snap(this.pond.r);
    this.totV.snap(0);
    this.steadyV.snap(0);
    this.intro.snap(0).set(1);
    this.kink.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Take from the pond. What you leave grows back.");
    this.note.set("The rival takes 2 each period. Drag, then Take.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.took = [3, 5, 2, 4, 3];
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.take, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    this.take.visible = this.beat === "feel" && this.stage === "choose";
    this.toSee.visible = this.beat === "feel" && this.stage === "end";
    this.toProve.visible = this.beat === "see" && this.found;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private track(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 24, x1: f.x + f.w - 24, y: f.bottom - 28 };
  }

  private rad(v: number, K: number): number {
    return this.rmax() * Math.sqrt(Math.max(0, v) / K);
  }

  private rmax(): number {
    const f = this.frame;
    return clamp(Math.min((f.h - 118) / 2, f.w / 6.5), 22, 54);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, _y: number): void {
    this.dragging = true;
    this.drag(x);
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.drag(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private drag(x: number): void {
    const f = this.frame;
    if (this.beat === "feel") {
      if (this.stage !== "choose") return;
      const { x0, x1 } = this.track(f);
      const cap = Math.floor(this.stock + 1e-9);
      this.amount = Math.min(cap, Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * this.pond.K));
      this.youV.set(this.amount);
    } else if (this.beat === "see") {
      const pl = this.plot;
      this.probe = Math.round(clamp(pl.valueAtX(x), 0, 10) * 10) / 10;
      if (!this.found) this.note.set(`Take ${fmt(this.probe)}: tomorrow's pond is ${fmt(this.pond.next(this.pond.K, this.probe))} of ${this.pond.K}.`);
      if (!this.found && Math.abs(this.probe - this.pond.yield) <= 0.7) {
        this.found = true;
        this.kink.set(1);
        this.prompt.set(`Past ${fmt(this.pond.yield)} the pond stops refilling.`);
        this.note.set(`${this.pond.K} - ${this.pond.K}/${this.pond.g} - ${this.pond.r} = ${fmt(this.pond.yield)}: the most that still fills it.`);
        this.announce(`The pond stays full up to a take of ${fmt(this.pond.yield)}.`);
        this.sync();
      }
    } else if (this.beat === "prove" && !this.locked) {
      const { x0, x1 } = this.track(f);
      const K = this.ponds[this.pi]!.K;
      this.ph = Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * K * 2) / 2;
      if (this.tried) {
        this.tried = false;
        this.pondV.set(K);
        this.prompt.set("Same harvest every period. What keeps the pond full?");
        this.note.set("Drag your steady harvest, then lock it in.");
      }
    }
  }

  // ---- Feel -------------------------------------------------------------

  private takeNow(): void {
    if (this.stage !== "choose") return;
    const s = this.pond.step(this.stock, this.amount);
    this.took.push(s.took);
    this.total += s.took;
    this.stage = "grow";
    this.grown = false;
    this.since = 0;
    this.youV.set(s.took);
    this.rivV.set(s.rival);
    this.period++;
    this.prompt.set(this.period === 1 ? "Watch the pond. What is left grows back." : "Again. Today shapes tomorrow.");
    this.note.set(`You took ${s.took}, they took ${s.rival}. ${s.left} left.`);
    this.announce(`Period ${this.period}. You took ${s.took}, they took ${s.rival}, ${s.left} left, regrowing to ${s.next}.`);
    this.stock = s.next;
    this.pondV.set(s.left);
    this.sync();
  }

  private grow(): void {
    this.grown = true;
    this.pondV.set(this.stock);
    this.note.set(`${this.took[this.took.length - 1]} taken. The pond grows to ${fmt(this.stock)} of ${this.pond.K}.`);
  }

  private nextPeriod(): void {
    if (this.period >= FEEL_PERIODS) {
      this.stage = "end";
      const steady = this.pond.yield * FEEL_PERIODS;
      this.totV.snap(0).set(this.total);
      this.steadyV.snap(0).set(steady);
      this.prompt.set("Compare with taking the steady 3 each time.");
      this.note.set(`You took ${this.total}. Steady ${fmt(this.pond.yield)} a period takes ${fmt(steady)}.`);
    } else {
      this.stage = "choose";
      this.amount = Math.min(this.amount, Math.floor(this.stock + 1e-9));
      this.youV.set(this.amount);
      this.rivV.set(this.pond.r);
      this.note.set(`Period ${this.period + 1} of ${FEEL_PERIODS}. The pond holds ${fmt(this.stock)}.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 9;
    this.probeShown.snap(9);
    this.found = false;
    this.kink.snap(0);
    this.prompt.set("Take more today, a smaller pond tomorrow.");
    this.note.set("Drag along the take. Find where the pond stops refilling.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    const s = proveSet(this.env.rng, lastKey);
    lastKey = s.key;
    this.ponds = s.ponds;
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const p = this.ponds[this.pi]!;
    this.ph = 1;
    this.locked = false;
    this.tried = false;
    this.pondV.snap(p.K);
    this.youV.snap(this.ph);
    this.rivV.snap(p.r);
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "Same harvest every period. What keeps the pond full?" : "New pond. The most you can take and keep it full?");
    this.note.set("Drag your steady harvest, then lock it in.");
    this.sync();
  }

  private lockIn(): void {
    const p = this.ponds[this.pi]!;
    const ok = Math.abs(this.ph - p.yield) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    this.youV.set(this.ph);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.pondV.set(p.K);
      this.prompt.set("Right. That is all the pond can give back.");
      this.note.set(`${p.K} - ${p.K}/${p.g} - ${p.r} = ${fmt(p.yield)}.`);
      this.wait = 1.8;
    } else {
      const n = p.next(p.K, this.ph);
      this.tried = true;
      this.pondV.set(n);
      this.prompt.set(this.ph > p.yield ? "Too greedy. The pond shrinks each time." : "Too timid. The pond could give more.");
      this.note.set(`Taking ${fmt(this.ph)} a period, it refills to ${fmt(n)} of ${p.K}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const v of [this.pondV, this.youV, this.rivV, this.totV, this.steadyV, this.intro, this.kink, this.trueAt]) v.step(dt);
    this.probeShown.set(this.probe);
    this.probeShown.step(dt);
    if (this.beat === "feel") {
      if (this.stage === "grow") {
        this.since += dt;
        if (!this.grown && this.since > 1.0) this.grow();
        if (this.since > 2.6) this.nextPeriod();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.ponds.length) {
          this.prompt.set("Take only what the pond can give back.");
          this.note.set("What you leave is tomorrow's pond. Today's choice sets the state.");
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

  private label(p: Painter, c: Colors, s: string, x: number, y: number, strong = false, alpha = 1): void {
    p.text(s, x, y, { font: Type.body(12, 400), color: strong ? c.ink : c.fog, align: "center", alpha });
  }

  /** The pond, you and the rival in one row, all on one area scale. */
  private row(p: Painter, c: Colors, f: Frame, K: number, g: number | null, a: number): { ty: number } {
    const R = this.rmax();
    const cy = f.top + R + 4;
    const off = Math.min(2 * R + 8, f.w / 2 - R - 8);
    const xl = this.cx - off;
    const xr = this.cx + off;
    p.dashedRing(this.cx, cy, R, c.ink, 0.6 * a);
    p.ring(this.cx, cy, this.rad(this.pondV.value, K), c.ink, 2, a);
    p.disc(xl, cy, this.rad(this.youV.value, K), c.ink, 0.95 * a);
    p.ring(xr, cy, this.rad(this.rivV.value, K), c.ink, 1.5, a);
    const ly = cy + R + 18;
    this.label(p, c, `pond ${fmt(this.pondV.value)}`, this.cx, ly, true, a);
    if (g !== null) this.label(p, c, `full ${K}, grows x${g}`, this.cx, ly + 16, false, a);
    this.label(p, c, `you ${fmt(this.youV.value)}`, xl, ly, true, a);
    this.label(p, c, `rival ${fmt(this.rivV.value)}`, xr, ly, false, a);
    return { ty: ly + 16 };
  }

  private slider(p: Painter, c: Colors, f: Frame, v: number, max: number, live: boolean): void {
    const { x0, x1, y: ty } = this.track(f);
    p.rule(x0, ty, x1, ty, c.ink, 0.5);
    for (const t of [0, Math.round(max / 2), max]) {
      const x = x0 + (t / max) * (x1 - x0);
      p.rule(x, ty - 5, x, ty + 5, c.ink, 0.5);
      p.text(String(t), x, ty + 23, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const mx = x0 + (v / max) * (x1 - x0);
    p.text(fmt(v), mx, ty - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    if (live) p.disc(mx, ty, 9, c.ink);
    else p.disc(mx, ty, 9, c.ink, 0.4);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const K = this.pond.K;
    if (this.stage === "end") {
      const R = this.rmax();
      const cy = f.top + R + 4;
      const off = Math.min(2 * R + 8, f.w / 2 - R - 8);
      const xl = this.cx - off;
      const Rt = R * Math.sqrt(Math.max(this.totV.value, 0) / 25);
      p.dashedRing(xl, cy, R * Math.sqrt(this.steadyV.value / 25), c.ink, 0.9);
      p.disc(xl, cy, Rt, c.ink, 0.95);
      p.dashedRing(this.cx + off, cy, R, c.ink, 0.6);
      p.ring(this.cx + off, cy, this.rad(this.pondV.value, K), c.ink, 2);
      const ly = cy + R + 18;
      this.label(p, c, `you ${this.total}`, xl, ly, true);
      this.label(p, c, `steady ${fmt(this.pond.yield * FEEL_PERIODS)}`, xl, ly + 16);
      this.label(p, c, `pond ${fmt(this.pondV.value)}`, this.cx + off, ly, true);
    } else {
      this.row(p, c, f, K, null, a);
      const open = this.stage === "choose";
      this.slider(p, c, f, this.amount, K, open);
      const max = Math.floor(this.stock + 1e-9);
      if (open && max < K) {
        const { x0, x1, y: ty } = this.track(f);
        p.rect(x0 + (max / K) * (x1 - x0), ty - 1, (1 - max / K) * (x1 - x0), 3, c.ground, 0.9);
      }
    }
    for (let i = 0; i < FEEL_PERIODS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.period && (this.stage === "end" || i < this.period - (this.stage === "grow" ? 1 : 0)), i === this.period);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot.fit(f);
    const m = this.pond;
    pl.axes(p, c, { xTicks: [0, 5, 10], xLabel: "take now", yLabel: "pond tomorrow" });
    p.text("your take", pl.right, pl.top - 8, { font: Type.body(12, 400), color: c.fog, align: "right" });
    p.line(pl.X(0), pl.Y(0), pl.X(10), pl.Y(10), c.ink, 1.25, 0.6, [3, 4]);
    pl.curve(p, (h) => m.next(m.K, h), c.ink, 1.75, 1, 80);
    for (const t of this.took) p.disc(pl.X(t), pl.Y(m.next(m.K, t)), 3.5, c.ink, 0.9);
    const h = this.probeShown.value;
    const px = pl.X(h);
    p.rule(px, pl.base, px, pl.Y(m.next(m.K, h)), c.ink, 0.45);
    p.disc(px, pl.Y(m.next(m.K, h)), 4.5, c.ink);
    p.ring(px, pl.Y(h), 4.5, c.ink, 1.25);
    p.disc(px, pl.base, 8, c.ink);
    const k = this.kink.value;
    if (k > 0.01) p.ring(pl.X(m.yield), pl.Y(m.K), 11, c.ink, 1.5, k);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.ponds[Math.min(this.pi, this.ponds.length - 1)] ?? this.pond;
    this.row(p, c, f, k.K, k.g, 1);
    this.slider(p, c, f, this.ph, k.K, !this.locked);
    const { x0, x1, y: ty } = this.track(f);
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(x0 + (k.yield / k.K) * (x1 - x0), ty, 11, c.ink, 1.5, tv);
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
