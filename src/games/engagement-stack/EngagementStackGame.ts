import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { Slider } from "../shared/Slider";
import { FEEL, FEEL_ROUNDS, MAX_LAYERS, PROVE_MAX, answer, proveSet, type Stack } from "./model";

const r1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: stack layers on a product, five launches. Power rises, and so does strain.
 * See: engagement, strain and what is left, layer by layer. Drag out to four or more layers.
 * Prove: a new product. Choose the number of layers that leaves the most.
 */
export class EngagementStackGame extends Game {
  readonly slug = "engagement-stack";
  private round = 0;
  private layers = 3;
  private stage: "choose" | "shown" = "choose";
  private readonly eng = new Damped(0, 0.4);
  private readonly str = new Damped(0, 0.4);
  private readonly bestRing = new Damped(0, 0.4);
  private dragging = false;

  private probe = 0;
  private touched = false;
  private reached = false;
  private readonly peak = new Damped(0, 0.6);
  private readonly plot = new Plot({ xMin: 0, xMax: MAX_LAYERS, yMin: -20, yMax: 100, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });

  private cases: Stack[] = [];
  private pi = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly sl = new Slider().range(0, PROVE_MAX, 1);
  private readonly reveal = new Damped(0, 0.5);

  private readonly launch = this.add(new CanvasButton("Launch", () => this.launchIt(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.layers = 3;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.layers = 1 + (i % 5);
      this.launchIt();
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setProbe(this.plot.X(4.4));
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.launch, this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.launch.visible = feel && this.stage === "choose";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private strip(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 28, x1: f.x + f.w - 28, y: f.bottom - 26 };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      this.dragging = true;
      this.setLayers(x);
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.setSl(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setLayers(x);
    else if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove") this.setSl(x);
  }

  protected override onUp(_x: number, _y: number): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.eng.snap(0);
    this.str.snap(0);
    this.bestRing.snap(0);
    this.prompt.set("Stack layers on the product. Then launch.");
    this.note.set(`Launch ${this.round + 1} of ${FEEL_ROUNDS}. ${this.layers} layers.`);
    this.sync();
  }

  private setLayers(x: number): void {
    const { x0, x1 } = this.strip(this.frame);
    this.layers = clamp(Math.round(((x - x0) / (x1 - x0)) * MAX_LAYERS), 0, MAX_LAYERS);
    this.note.set(`Launch ${this.round + 1} of ${FEEL_ROUNDS}. ${this.layers} layers.`);
  }

  private launchIt(): void {
    const n = this.layers;
    this.stage = "shown";
    this.eng.set(FEEL.engagement(n));
    this.str.set(FEEL.strain(n));
    const b = FEEL.best(MAX_LAYERS);
    this.bestRing.set(FEEL.engagement(b));
    const net = FEEL.net(n);
    this.prompt.set(`Engagement ${r1(FEEL.engagement(n))}, strain ${r1(FEEL.strain(n))}. Left: ${r1(net)}.`);
    this.note.set(n === b ? "That is the most any stack leaves." : `${b} layers would have left ${r1(FEEL.net(b))}.`);
    this.announce(`${n} layers left ${r1(net)}.`);
    this.cue(n === b ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 0;
    this.touched = false;
    this.reached = false;
    this.peak.snap(0);
    this.prompt.set("Drag the layers. Watch power and strain.");
    this.note.set("Each layer adds power. They also feed each other.");
    this.sync();
  }

  private setProbe(x: number): void {
    const n = clamp(Math.round(this.plot.valueAtX(x)), 0, MAX_LAYERS);
    this.probe = n;
    this.touched = true;
    this.note.set(`${n} layers: power ${r1(FEEL.engagement(n))}, strain ${r1(FEEL.strain(n))}, left ${r1(FEEL.net(n))}.`);
    if (!this.reached && n >= 4) {
      this.reached = true;
      this.peak.set(1);
      this.prompt.set("Strain grows faster. Past two layers it costs more.");
      this.announce("What is left peaks at two layers, then falls as strain overtakes the gain.");
      this.sync();
    }
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
    const s = this.cases[this.pi]!;
    this.sl.value = 0;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.eng.snap(s.engagement(0));
    this.str.snap(s.strain(0));
    this.prompt.set(`Each layer: ${s.e}. Pairs add ${s.s}. Strain ${s.q} a layer squared.`);
    this.note.set("Drag to the number of layers that leaves the most.");
    this.sync();
  }

  private setSl(x: number): void {
    this.sl.setFromX(x);
    const s = this.cases[this.pi]!;
    const n = this.sl.value;
    this.eng.set(s.engagement(n));
    this.str.set(s.strain(n));
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`${n} layers.`);
  }

  private lockIn(): void {
    const s = this.cases[this.pi]!;
    const n = this.sl.value;
    const b = answer(s);
    const ok = n === b;
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. ${b} ${b === 1 ? "layer" : "layers"}.`);
      this.note.set(`It leaves ${r1(s.net(b))}. One more costs more than it adds.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      this.prompt.set(n > b ? "One layer too many." : "Room for more.");
      this.note.set(`${n} layers leave ${r1(s.net(n))}. ${b} leave ${r1(s.net(b))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.eng, this.str, this.bestRing, this.peak, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Layers combine. So do their costs.");
          this.note.set("Ask what each layer adds, and what the stack does to the player.");
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
    if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawStack(p, c, f);
  }

  /** Two discs: engagement filled, strain a ring. Used by Feel and Prove. */
  private discs(p: Painter, c: Colors, f: Frame, ref: number, top: number, bottom: number): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (bottom - top - 40) / 2), 14, 50);
    const cy = top + R + 4;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, ref) / ref);
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    p.disc(xl, cy, rad(this.eng.value), c.ink, 0.95);
    p.ring(xr, cy, rad(this.str.value), c.ink, 1.5);
    p.text(`power ${r1(this.eng.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`strain ${r1(this.str.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
  }

  private drawStack(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") {
      const { x0, x1, y } = this.strip(f);
      this.discs(p, c, f, FEEL.engagement(MAX_LAYERS) * 0.8, f.top, y - 24);
      if (this.bestRing.value > 0.5 && this.stage === "shown") {
        /* the best stack is described in the note, a ring would only crowd the discs */
      }
      p.rule(x0, y, x1, y, c.ink, 0.4);
      for (let k = 0; k <= MAX_LAYERS; k++) {
        const x = x0 + (k / MAX_LAYERS) * (x1 - x0);
        p.rule(x, y - 4, x, y + 4, c.ink, 0.4);
        p.text(String(k), x, y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
      }
      const hx = x0 + (this.layers / MAX_LAYERS) * (x1 - x0);
      p.line(x0, y, hx, y, c.ink, 4, 0.9);
      p.disc(hx, y, 8, c.ink);
      p.ring(hx, y, 8, c.ground, 1.5, 0.9);
      for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
    } else {
      const s = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
      const sy = f.bottom - 40;
      this.sl.place(f.x + 24, f.x + f.w - 24, sy);
      this.sl.draw(p, c, { ticks: [0, 1, 2, 3, 4, 5, 6], label: (v) => String(v), text: (v) => String(v) });
      this.discs(p, c, f, s.engagement(PROVE_MAX) * 0.6, f.top, sy - 36);
      const rv = this.reveal.value;
      if (rv > 0.01 && this.locked) p.ring(this.sl.X(answer(s)), sy, 10, c.ink, 1.5, rv);
      for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
    }
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 1, 2, 3, 4, 5], xLabel: "layers", yLabel: "power, strain and what is left", fmt: (v) => String(v) });
    p.rule(pl.x0, pl.Y(0), pl.right, pl.Y(0), c.ink, 0.25);
    pl.curve(p, (n) => FEEL.engagement(n), c.ink, 1.75, 1, 40);
    for (let n = 0; n < MAX_LAYERS; n += 0.25) p.line(pl.X(n), pl.Y(FEEL.strain(n)), pl.X(n + 0.125), pl.Y(FEEL.strain(n + 0.125)), c.ink, 1.25, 0.8);
    pl.curve(p, (n) => FEEL.net(n), c.fog, 1.5, 0.9, 40);
    const pk = this.peak.value;
    if (pk > 0.01) p.ring(pl.X(2), pl.Y(FEEL.net(2)), 8, c.ink, 1.5, pk);
    if (this.touched) {
      const px = pl.X(this.probe);
      p.line(px, pl.top, px, pl.base, c.ink, 1, 0.4, [3, 4]);
      p.disc(px, pl.Y(FEEL.engagement(this.probe)), 4.5, c.ink);
      p.ring(px, pl.Y(FEEL.strain(this.probe)), 4.5, c.ink, 1.5);
    }
    Glyph.step(p, c, this.cx, f.tickY, this.reached, false);
  }
}
