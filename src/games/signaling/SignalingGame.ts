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
import { FEEL_BAR, FEEL_SIGNAL, MAX_YEARS, PROVE_POOL, type Signal } from "./model";

const ROUNDS = 3;

/**
 * Feel: you are a worker of a known type. Study to clear the employer's bar, or skip.
 * See: drag the bar. Find the range where only the strong type gains from clearing it.
 * Prove: new costs and premium. Drag to a bar that separates the types.
 */
export class SignalingGame extends Game {
  readonly slug = "signaling";
  private g: Signal = FEEL_SIGNAL;
  private types: boolean[] = [];
  private round = 0;
  private stage: "choose" | "result" = "choose";
  private armed: "study" | "skip" | null = null;
  private readonly netR = new Damped(0, 0.4);
  private readonly altR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private reached = false;
  private readonly band = new Damped(0, 0.6);

  private cases: Signal[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_SIGNAL;
    this.types = this.env.rng.shuffle([true, false, true]);
    this.round = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private get strong(): boolean {
    return this.types[Math.min(this.round - (this.stage === "result" ? 1 : 0), ROUNDS - 1)]!;
  }

  private startRound(): void {
    this.stage = "choose";
    this.armed = null;
    this.netR.snap(0);
    this.altR.snap(0);
    this.prompt.set(this.round === 0 ? `Employers pay ${this.g.W} to anyone with ${FEEL_BAR} years. Study?` : `Another worker. Study ${FEEL_BAR} years?`);
    this.note.set(this.round === 0 ? "Studying costs each year. Strong types pay less." : "");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
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
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "study";
      else if (inside(this.pair(1), x, y)) this.armed = "skip";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setBar(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setBar(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "study" ? 0 : 1), x, y)) this.decide(a === "study");
  }

  // ---- Feel -------------------------------------------------------------

  private decide(study: boolean): void {
    const g = this.g;
    const strong = this.types[this.round]!;
    const net = g.net(strong, FEEL_BAR);
    const mine = study ? net : 0;
    const alt = study ? 0 : net;
    this.netR.set(Math.sqrt(Math.abs(mine) / g.W));
    this.altR.set(Math.sqrt(Math.abs(alt) / g.W));
    this.stage = "result";
    this.round++;
    this.cue(mine >= alt ? "good" : "bad");
    this.prompt.set(strong ? (study ? "A strong worker gains from it." : "A strong worker missed a gain.") : study ? "A weak worker loses by it." : "A weak worker is right to skip.");
    this.note.set(`${study ? "Studying" : "Skipping"} netted ${fmt(mine)}. The other choice netted ${fmt(alt)}.`);
    this.announce(`${study ? "Studying" : "Skipping"} netted ${fmt(mine)}. The other choice netted ${fmt(alt)}.`);
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (s: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const hi = g.W + 1;
    const lo = Math.min(g.net(false, MAX_YEARS), -2) - 1;
    return { x0, w, top, h, X: (s) => x0 + (s / MAX_YEARS) * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_SIGNAL;
    this.sl.value = 1;
    this.reached = false;
    this.band.snap(0);
    this.prompt.set("Drag the employer's bar. Who clears it?");
    this.note.set("Solid is the strong type, dashed the weak type.");
    this.sync();
  }

  private setBar(px: number): void {
    const c = this.chart(this.frame);
    const s = Math.round(clamp((px - c.x0) / c.w, 0, 1) * MAX_YEARS * 10) / 10;
    this.sl.value = s;
    const g = this.g;
    const st = g.strongSignals(s);
    const wk = g.weakSignals(s);
    this.note.set(`Bar ${fmt(s)}: strong nets ${fmt(g.net(true, s))}, weak ${fmt(g.net(false, s))}. ${st && !wk ? "Only the strong clear it." : st && wk ? "Both clear it." : "Neither does."}`);
    if (!this.reached && g.separates(s) && s > g.low + 0.2) {
      this.reached = true;
      this.band.set(1);
      this.cue("good");
      this.prompt.set(`Bars from ${fmt(g.low)} to ${fmt(g.high)} separate them.`);
      this.announce(`Only the strong type gains from a bar between ${fmt(g.low)} and ${fmt(g.high)} years.`);
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
    const k = this.cases[this.pi]!;
    this.g = k;
    this.sl.range(0, MAX_YEARS, 0.1);
    this.sl.value = 1;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New costs. Drag to a bar that separates." : "Different costs. Find a separating bar.");
    this.note.set(`Premium ${k.W}. A year costs ${k.cStrong} to the strong, ${k.cWeak} to the weak.`);
    this.sync();
  }

  private lockIn(): void {
    const k = this.g;
    const s = this.sl.value;
    const ok = k.separates(s);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Only the strong clear that bar.");
      this.note.set(`Any bar from ${fmt(k.low)} to ${fmt(k.high)} works: ${k.W} / ${k.cWeak} to ${k.W} / ${k.cStrong}.`);
      this.wait = 2;
    } else {
      this.prompt.set(k.weakSignals(s) ? "Not quite. The weak type clears it too." : "Not quite. Even the strong type loses.");
      this.note.set(`Bar ${fmt(s)}: strong nets ${fmt(k.net(true, s))}, weak nets ${fmt(k.net(false, s))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.netR.step(dt);
    this.altR.step(dt);
    this.band.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A signal separates when it costs the weak more.");
          this.note.set("It must be too dear for the weak, not for the strong.");
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
    const strong = this.strong;
    const cost = (strong ? g.cStrong : g.cWeak) * FEEL_BAR;
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    const mx = Math.max(g.W, cost);
    p.disc(this.cx - off, cy, R * Math.sqrt(g.W / mx), c.ink, 0.92 * a);
    p.ring(this.cx + off, cy, R * Math.sqrt(cost / mx), c.ink, 1.5, a);
    p.text(`premium ${g.W}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`${strong ? "strong" : "weak"}: cost ${fmt(cost)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = (this.stage === "choose" ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "study" : "skip") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
      p.text(i === 0 ? `Study ${FEEL_BAR} years` : "Skip", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? "get the premium" : "pay nothing", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("net gain of clearing the bar", x0, top - 14, { font, color: c.fog });
    p.text("years of study required", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(String(MAX_YEARS), x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.line(X(0), Y(g.net(true, 0)), X(MAX_YEARS), Y(g.net(true, MAX_YEARS)), c.ink, 2, 1);
    p.line(X(0), Y(g.net(false, 0)), X(MAX_YEARS), Y(g.net(false, MAX_YEARS)), c.ink, 1.25, 0.8, [5, 4]);
    const s = this.sl.value;
    p.rule(X(s), top, X(s), top + h, c.ink, 0.3);
    p.disc(X(s), Y(g.net(true, s)), 6, c.ink, 1);
    p.ring(X(s), Y(g.net(false, s)), 6, c.ink, 1.5, 1);
    const b = this.band.value;
    if (b > 0.01) {
      const y = Y(0);
      p.line(X(g.low), y, X(g.high), y, c.ink, 3, b);
      p.text(`${fmt(g.low)}`, X(g.low), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: b });
      p.text(`${fmt(g.high)}`, X(g.high), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: b });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.g;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    const mx = Math.max(k.cStrong, k.cWeak, 1);
    p.disc(this.cx - off, cy, R * Math.sqrt(k.cStrong / mx), c.ink, 0.92);
    p.ring(this.cx + off, cy, R * Math.sqrt(k.cWeak / mx), c.ink, 1.5, 1);
    p.text(`strong ${fmt(k.cStrong)} a year`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`weak ${fmt(k.cWeak)} a year`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 5, MAX_YEARS], text: (v) => `bar ${fmt(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(this.sl.value), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
