import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_FLIPS, FEEL_VALUE, MAX_GAIN, PROVE_POOL, type Case } from "./model";

/**
 * Feel: four fair coin flips that pay off on average. Take it or pass, then see how it felt.
 * See: drag along the value line. Losses are steeper than gains.
 * Prove: a new loss and weight. Drag to the gain that makes the flip feel neutral.
 */
export class ProspectTheoryGame extends Game {
  readonly slug = "prospect-theory";
  private readonly v = FEEL_VALUE;
  private round = 0;
  private stage: "choose" | "result" = "choose";
  private armed: "take" | "pass" | null = null;
  private taken = 0;
  private readonly feltR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 0;
  private hi = 0;
  private reached = false;
  private readonly kink = new Damped(0, 0.6);

  private cases: Case[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.stage = "choose";
    this.taken = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    this.armed = null;
    this.feltR.snap(0);
    this.prompt.set(this.round === 0 ? "Heads you win, tails you lose. Take it?" : "Another flip. Take it?");
    this.note.set(this.round === 0 ? "A fair coin. Every flip pays on average." : "");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = FEEL_FLIPS.length;
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= FEEL_FLIPS.length ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "take";
      else if (inside(this.pair(1), x, y)) this.armed = "pass";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setX(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setX(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "take" ? 0 : 1), x, y)) this.decide(a === "take");
  }

  // ---- Feel -------------------------------------------------------------

  private decide(take: boolean): void {
    const f = FEEL_FLIPS[this.round]!;
    const felt = this.v.gamble(f.gain, f.loss);
    const ev = (f.gain - f.loss) / 2;
    this.feltR.set(Math.sqrt(Math.abs(felt) / 60));
    if (take) this.taken++;
    this.stage = "result";
    this.round++;
    this.cue(take ? "good" : "bad");
    this.prompt.set(felt > 0 ? "That one felt like a good deal." : felt === 0 ? "That one felt like nothing." : "That one felt like a bad deal.");
    this.note.set(`On average it pays ${ev > 0 ? "+" : ""}${fmt(ev)}. It felt like ${felt > 0 ? "+" : ""}${fmt(felt)}.`);
    if (this.round >= FEEL_FLIPS.length) this.prompt.set(`You took ${this.taken} of ${FEEL_FLIPS.length}. Each paid on average.`);
    this.announce(`On average the flip pays ${fmt(ev)}. It felt like ${fmt(felt)}.`);
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= FEEL_FLIPS.length) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (x: number) => number; Y: (y: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 40));
    const ymin = -2 * 100;
    const ymax = 100;
    return { x0, w, top, h, X: (x) => x0 + ((x + 100) / 200) * w, Y: (y) => top + ((ymax - y) / (ymax - ymin)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.sl.value = 0;
    this.lo = 0;
    this.hi = 0;
    this.reached = false;
    this.kink.snap(0);
    this.prompt.set("Drag along. How does each amount feel?");
    this.note.set("Gains to the right, losses to the left.");
    this.sync();
  }

  private setX(px: number): void {
    const c = this.chart(this.frame);
    const x = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 40) * 5 - 100;
    this.sl.value = x;
    this.lo = Math.min(this.lo, x);
    this.hi = Math.max(this.hi, x);
    const v = this.v;
    this.note.set(x >= 0 ? `Win ${x}: feels +${fmt(v.v(x))}. A loss of ${x} feels ${fmt(v.v(-x))}.` : `Lose ${-x}: feels ${fmt(v.v(x))}. A gain of ${-x} feels +${-x}.`);
    if (!this.reached && this.lo <= -60 && this.hi >= 60) {
      this.reached = true;
      this.kink.set(1);
      this.cue("good");
      this.prompt.set("Losses feel twice as big as gains.");
      this.announce("A loss of any size feels about twice as big as a gain of the same size.");
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const c = this.cases[this.pi]!;
    this.sl.range(0, MAX_GAIN, 5);
    this.sl.value = 40;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(`Lose ${c.loss}, losses weigh ${fmt(c.value.lambda)}x. Win how much to break even?`);
    this.note.set("Drag the gain until the flip feels neutral.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const g = this.sl.value;
    const want = c.value.breakEven(c.loss);
    const ok = Math.abs(g - want) <= 5;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${fmt(c.value.lambda)} x ${c.loss} = ${fmt(want)}.`);
      this.note.set("Below that, the flip feels like a loss.");
      this.wait = 2;
    } else {
      const felt = c.value.gamble(g, c.loss);
      this.prompt.set(felt > 0 ? "Not quite. That already feels good." : "Not quite. That still feels bad.");
      this.note.set(`Win ${g}: it feels like ${felt > 0 ? "+" : ""}${fmt(felt)}. It should feel like 0.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.feltR.step(dt);
    this.kink.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A loss weighs about twice a gain.");
          this.note.set("A fair bet must win about twice what it risks.");
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

  private shapes(p: Painter, c: Colors, f: Frame, gain: number, loss: number, a: number, scale = 150): { cy: number; R: number; off: number } {
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    p.disc(this.cx + off, cy, R * Math.sqrt(gain / scale), c.ink, 0.92 * a);
    p.dashedRing(this.cx - off, cy, R * Math.sqrt(loss / scale), c.ink, 0.9 * a);
    p.text(`win ${gain}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`lose ${loss}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    return { cy, R, off };
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const fl = FEEL_FLIPS[Math.min(this.round - (this.stage === "result" ? 1 : 0), FEEL_FLIPS.length - 1)]!;
    const { cy, R } = this.shapes(p, c, f, fl.gain, fl.loss, a);
    p.text("50 / 50", this.cx, cy - R - 10, { font: Type.mono(11), color: c.ash, align: "center", alpha: a });
    const t = this.feltR.value;
    if (this.stage === "result" && t > 0.02) {
      const felt = this.v.gamble(fl.gain, fl.loss);
      if (felt > 0) p.disc(this.cx, cy, R * 0.6 * t * Math.sqrt(Math.abs(felt) / 20), c.ink, 0.9);
      else p.dashedRing(this.cx, cy, Math.max(3, R * 0.6 * t * Math.sqrt(Math.abs(felt) / 20)), c.ink, 0.9);
    }
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const live = this.stage === "choose";
      const al = (live ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "take" : "pass") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
      p.text(i === 0 ? "Take it" : "Pass", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? `average +${(fl.gain - fl.loss) / 2}` : "keep what you have", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < FEEL_FLIPS.length; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const v = this.v;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(X(0), top, X(0), top + h, c.ink, 0.35);
    p.text("how it feels", x0, top - 14, { font, color: c.fog });
    p.text("loss", x0, top + h + 18, { font, color: c.fog });
    p.text("gain", x0 + w, top + h + 18, { font, color: c.fog, align: "right" });
    p.line(X(-100), Y(v.v(-100)), X(0), Y(0), c.ink, 2, 1);
    p.line(X(0), Y(0), X(100), Y(100), c.ink, 2, 1);
    const x = this.sl.value;
    p.rule(X(x), Y(0), X(x), Y(v.v(x)), c.ink, 0.3);
    p.disc(X(x), Y(v.v(x)), 6, c.ink, 1);
    p.ring(X(-x), Y(v.v(-x)), 6, c.ink, 1.5, x === 0 ? 0 : 0.7);
    const k = this.kink.value;
    if (k > 0.02) p.ring(X(0), Y(0), 10, c.ink, 1.5, k);
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    this.shapes(p, c, f, this.sl.value, k.loss, 1, MAX_GAIN);
    this.sl.draw(p, c, { ticks: [0, 100, 200], text: (v) => `win ${fmt(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.value.breakEven(k.loss)), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
