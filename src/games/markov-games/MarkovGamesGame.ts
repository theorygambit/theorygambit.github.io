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
import { FEEL_MARKOV, PROVE_POOL, PROVE_TOLERANCE, share, type Action, type Chain, type State } from "./model";

const STEPS = 6;
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: six rounds in a Good or Bad state. Invest or coast, and see how each moves the chance of Good next.
 * See: drag how often you invest. The long-run share of Good rounds climbs, though investing costs.
 * Prove: a new chain. Drag to the long-run share of time in the Good state.
 */
export class MarkovGamesGame extends Game {
  readonly slug = "markov-games";
  private readonly m = FEEL_MARKOV;
  private state: State = "bad";
  private history: State[] = [];
  private round = 0;
  private total = 0;
  private stage: "choose" | "wait" | "over" = "choose";
  private armed: Action | null = null;
  private picked: Action | null = null;
  private since = 0;
  private readonly stateR = new Damped(1, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly marks = new Damped(0, 0.6);

  private cases: Chain[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.state = "bad";
    this.history = [];
    this.round = 0;
    this.total = 0;
    this.stage = "choose";
    this.picked = null;
    this.stateR.snap(this.radius("bad"));
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.prompt.set("You are in the Bad state. Invest, or coast?");
    this.note.set("Each choice sets the chance of Good next.");
    this.sync();
  }

  private radius(s: State): number {
    return Math.sqrt(this.m.pay[s] / 3);
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = STEPS;
    this.stage = "over";
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" && this.stage !== "over" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.stage === "over";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "invest";
      else if (inside(this.pair(1), x, y)) this.armed = "coast";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setA(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setA(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "invest" ? 0 : 1), x, y)) this.decide(a);
  }

  // ---- Feel -------------------------------------------------------------

  private decide(a: Action): void {
    this.picked = a;
    this.total += this.m.reward(this.state, a);
    this.stage = "wait";
    this.since = 0;
    this.cue(a === "invest" ? "good" : "bad");
    this.prompt.set("Chance decides.");
    this.note.set("");
    this.sync();
  }

  private resolve(): void {
    const a = this.picked!;
    const pGood = this.m.next(this.state, a);
    const nextState: State = this.env.rng.chance(pGood) ? "good" : "bad";
    this.history.push(nextState);
    const was = this.state;
    this.state = nextState;
    this.stateR.set(this.radius(nextState));
    this.round++;
    this.note.set(`${a === "invest" ? "Investing" : "Coasting"} gave a ${pct(pGood)} chance of Good. Total ${fmt(this.total)}.`);
    this.prompt.set(nextState === was ? `Still ${nextState === "good" ? "Good" : "Bad"}.` : nextState === "good" ? "Up to Good." : "Down to Bad.");
    this.announce(nextState === was ? "The state stayed the same." : nextState === "good" ? "Up to Good." : "Down to Bad.");
    if (this.round >= STEPS) {
      this.stage = "over";
      this.prompt.set(`Six rounds, total ${fmt(this.total)}.`);
      this.note.set(`${this.history.filter((s) => s === "good").length} of 6 landed in Good.`);
    } else this.stage = "choose";
    this.picked = null;
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (a: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    return { x0, w, top, h, X: (a) => x0 + a * w, Y: (v) => top + h - v * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.sl.value = 0.5;
    this.lo = 0.5;
    this.hi = 0.5;
    this.reached = false;
    this.marks.snap(0);
    this.prompt.set("Drag how often you invest.");
    this.note.set("Watch the share of rounds spent in Good.");
    this.sync();
  }

  private setA(px: number): void {
    const c = this.chart(this.frame);
    const a = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 100) / 100;
    this.sl.value = a;
    this.lo = Math.min(this.lo, a);
    this.hi = Math.max(this.hi, a);
    const m = this.m;
    this.note.set(`Invest ${pct(a)}: ${pct(m.stationary(a))} of rounds are Good. Average payoff ${fmt(m.average(a))}.`);
    if (!this.reached && this.lo <= 0.15 && this.hi >= 0.85) {
      this.reached = true;
      this.marks.set(1);
      this.cue("good");
      this.prompt.set(`Good share climbs from ${pct(m.stationary(0))} to ${pct(m.stationary(1))}.`);
      this.announce(`Investing always moves the long-run share of Good rounds from ${pct(m.stationary(0))} up to ${pct(m.stationary(1))}, but each investment costs.`);
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
    this.sl.range(0, 1, 0.01);
    this.sl.value = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New chain. What share of rounds are Good?" : "Another chain. Long-run share of Good?");
    this.note.set(`From Good it falls with chance ${fmt(k.p)}. From Bad it climbs with chance ${fmt(k.q)}.`);
    this.sync();
  }

  private lockIn(): void {
    const k = this.cases[this.pi]!;
    const want = share(k);
    const x = this.sl.value;
    const ok = Math.abs(x - want) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${fmt(k.q)} / (${fmt(k.p)} + ${fmt(k.q)}) = ${fmt(want)}.`);
      this.note.set("Flows in and out balance.");
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Balance the flows.");
      this.note.set(`At ${pct(x)}: out of Good ${fmt(x * k.p)}, into Good ${fmt((1 - x) * k.q)}. They must match.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.stateR.step(dt);
    this.marks.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.resolve();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Balance what flows in with what flows out.");
          this.note.set("That sets the long-run share in each state.");
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
    const step = f.w / STEPS;
    for (let i = 0; i < STEPS; i++) {
      const x = f.x + step * (i + 0.5);
      const s = this.history[i];
      if (s === "good") p.disc(x, f.top + 8, 5, c.ink, 0.92 * a);
      else if (s === "bad") p.ring(x, f.top + 8, 4, c.ink, 1.5, a);
      else p.ring(x, f.top + 8, 2, c.ink, 1, 0.3 * a);
    }
    const R = clamp((f.h - 100) / 2, 18, 40);
    const cy = f.top + 26 + R;
    p.disc(this.cx, cy, this.stateR.value * R, c.ink, 0.92 * a);
    p.text(this.state === "good" ? "Good  pays 3" : "Bad  pays 1", this.cx, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    if (this.stage !== "over") {
      const acts: Action[] = ["invest", "coast"];
      for (const i of [0, 1] as const) {
        const z = this.pair(i);
        const al = (this.stage === "choose" ? 1 : 0) * a;
        const act = acts[i]!;
        const chance = this.m.next(this.state, act);
        p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
        p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === act ? 0.08 : 0);
        const gx = z.x + z.w / 2;
        p.disc(gx, z.y + z.h * 0.3, Math.max(2, Math.min(14, z.h * 0.16) * Math.sqrt(chance)), c.ink, 0.92 * al);
        p.text(act === "invest" ? "Invest" : "Coast", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
        p.text(`${pct(chance)} Good next`, gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
      }
    }
    for (let i = 0; i < STEPS; i++) Glyph.step(p, c, this.cx - (STEPS - 1) * 10 + i * 20, f.tickY, i < this.round, i === this.round && this.stage !== "over");
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const m = this.m;
    const font = Type.body(12, 400);
    p.rule(x0, top + h, x0 + w, top + h, c.ink, 0.5);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("share of rounds Good", x0, top - 14, { font, color: c.fog });
    p.text("how often you invest", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    let prev: [number, number] | null = null;
    for (let i = 0; i <= 40; i++) {
      const al = i / 40;
      const pt: [number, number] = [X(al), Y(m.stationary(al))];
      if (prev) p.line(prev[0], prev[1], pt[0], pt[1], c.ink, 2, 1);
      prev = pt;
    }
    const av = this.sl.value;
    p.rule(X(av), top, X(av), top + h, c.ink, 0.3);
    p.disc(X(av), Y(m.stationary(av)), 6, c.ink, 1);
    const mk = this.marks.value;
    if (mk > 0.02) {
      p.ring(X(0), Y(m.stationary(0)), 9, c.ink, 1.5, mk);
      p.ring(X(1), Y(m.stationary(1)), 9, c.ink, 1.5, mk);
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    p.disc(this.cx - off, cy, Math.max(2, R * Math.sqrt(k.p)), c.ink, 0.92);
    p.ring(this.cx + off, cy, Math.max(2, R * Math.sqrt(k.q)), c.ink, 1.5, 1);
    p.text(`falls ${fmt(k.p)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`climbs ${fmt(k.q)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 0.5, 1], label: pct, text: (v) => `${pct(v)} Good` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(share(k)), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
