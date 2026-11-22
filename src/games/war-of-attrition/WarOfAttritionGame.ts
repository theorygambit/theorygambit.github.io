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
import { FEEL_ATTRITION, FEEL_RIVAL, MAX_TICKS, PROVE_POOL, PROVE_TOLERANCE, type Attrition } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: hold or quit, tick by tick, against a rival who may quit at any moment.
 * See: drag the rival's quit chance. Holding one more tick crosses zero at a single chance.
 * Prove: a new prize and cost. Drag to the quit chance that makes holding break even.
 */
export class WarOfAttritionGame extends Game {
  readonly slug = "war-of-attrition";
  private g: Attrition = FEEL_ATTRITION;
  private tickCount = 0;
  private stage: "choose" | "wait" | "over" = "choose";
  private armed: "hold" | "quit" | null = null;
  private outcome: "won" | "quit" | "timeout" | null = null;
  private since = 0;
  private games = 0;
  private readonly paidR = new Damped(0, 0.4);
  private readonly prizeR = new Damped(1, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private cases: Attrition[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly again = this.add(new CanvasButton("Again", () => this.restart()));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_ATTRITION;
    this.games = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.restart();
  }

  private restart(): void {
    this.tickCount = 0;
    this.stage = "choose";
    this.armed = null;
    this.outcome = null;
    this.paidR.snap(0);
    this.prizeR.snap(1);
    this.prompt.set(this.games === 0 ? "Hold or quit? Each tick costs 1." : "Again. Hold or quit?");
    this.note.set("If the rival quits first, you win 10.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.games = 1;
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
    const a = this.pair(0);
    const b = this.pair(1);
    this.again.place(a.x, by, a.w);
    this.toSee.place(b.x, by, b.w);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.again.visible = this.beat === "feel" && this.stage === "over";
    this.toSee.visible = this.beat === "feel" && this.stage === "over";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "hold";
      else if (inside(this.pair(1), x, y)) this.armed = "quit";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setP(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setP(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "hold" ? 0 : 1), x, y)) this.decide(a);
  }

  // ---- Feel -------------------------------------------------------------

  private decide(a: "hold" | "quit"): void {
    this.cue(a === "hold" ? "good" : "bad");
    if (a === "quit") return this.finishGame("quit");
    this.tickCount++;
    this.paidR.set(Math.sqrt((this.tickCount * this.g.c) / (MAX_TICKS * this.g.c)));
    this.stage = "wait";
    this.since = 0;
    this.prompt.set("You held. Watch the rival.");
    this.note.set("");
    this.sync();
  }

  private rivalMove(): void {
    if (this.env.rng.chance(FEEL_RIVAL)) return this.finishGame("won");
    if (this.tickCount >= MAX_TICKS) return this.finishGame("timeout");
    this.stage = "choose";
    this.prompt.set(`Tick ${this.tickCount} done. Hold or quit?`);
    this.note.set(`You have paid ${fmt(this.tickCount * this.g.c)}. The prize is still ${this.g.V}.`);
    this.sync();
  }

  private finishGame(o: "won" | "quit" | "timeout"): void {
    this.outcome = o;
    this.stage = "over";
    this.games++;
    const paid = this.tickCount * this.g.c;
    if (o === "won") {
      this.prompt.set("The rival quit. You win.");
      this.note.set(`You won ${this.g.V} and paid ${fmt(paid)}: net ${fmt(this.g.V - paid)}.`);
    } else if (o === "quit") {
      this.prompt.set("You quit. The rival wins.");
      this.note.set(`You paid ${fmt(paid)} and lost. Holding was worth ${fmt(this.g.holdValue(FEEL_RIVAL))}.`);
    } else {
      this.prompt.set("Eight ticks, and nobody quit.");
      this.note.set(`You paid ${fmt(paid)}. The rival quits about 1 tick in 10.`);
    }
    this.announce(o === "won" ? "The rival quit and you won." : o === "quit" ? "You quit and the rival won." : "Eight ticks passed and nobody quit.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (p: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const hi = g.holdValue(0.5) + 0.5;
    const lo = -g.c - 0.4;
    return { x0, w, top, h, X: (p) => x0 + (p / 0.5) * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_ATTRITION;
    this.sl.value = 0.4;
    this.lo = 0.5;
    this.hi = 0;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag the rival's quit chance per tick.");
    this.note.set("Is holding one more tick worth it?");
    this.sync();
  }

  private setP(px: number): void {
    const c = this.chart(this.frame);
    const p = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 0.5 * 100) / 100;
    this.sl.value = p;
    this.lo = Math.min(this.lo, p);
    this.hi = Math.max(this.hi, p);
    const g = this.g;
    this.note.set(`Quit chance ${pct(p)}. Holding one more tick is worth ${fmt(g.holdValue(p))}.`);
    if (!this.reached && this.lo < g.indifference - 0.03 && this.hi > g.indifference + 0.03) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`Break even at ${pct(g.indifference)}.`);
      this.announce(`Holding is worth nothing when the rival quits with chance ${pct(g.indifference)} per tick.`);
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
    this.sl.range(0, 0.5, 0.01);
    this.sl.value = 0.1;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New prize and cost. Where does holding break even?" : "Different numbers. Where does it break even?");
    this.note.set(`Prize ${fmt(k.V)}, cost ${fmt(k.c)} a tick. Drag the rival's quit chance.`);
    this.sync();
  }

  private lockIn(): void {
    const k = this.g;
    const p = this.sl.value;
    const ok = Math.abs(p - k.indifference) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${fmt(k.c)} / ${fmt(k.V)} = ${fmt(k.indifference)}.`);
      this.note.set("Above that chance, hold. Below it, quit.");
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Make holding worth zero.");
      this.note.set(`At ${pct(p)}: ${fmt(p)} x ${fmt(k.V)} - ${fmt(k.c)} = ${fmt(k.holdValue(p))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.paidR.step(dt);
    this.prizeR.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.rivalMove();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Hold while the quit chance beats cost over prize.");
          this.note.set("Each side quits at the rate that leaves the other indifferent.");
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
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    const paid = this.tickCount * this.g.c;
    p.dashedRing(this.cx - off, cy, Math.max(2, this.paidR.value * R), c.ink, 0.9 * a);
    if (this.outcome === "won") p.disc(this.cx + off, cy, R, c.ink, 0.92 * a);
    else p.ring(this.cx + off, cy, R, c.ink, 1.5, a);
    p.text(`paid ${fmt(paid)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`prize ${this.g.V}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    if (this.stage !== "over") {
      for (const i of [0, 1] as const) {
        const z = this.pair(i);
        const al = (this.stage === "choose" ? 1 : 0) * a;
        p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
        p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "hold" : "quit") ? 0.08 : 0);
        const gx = z.x + z.w / 2;
        p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
        p.text(i === 0 ? "Hold" : "Quit", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
        p.text(i === 0 ? "pay 1 more" : "stop paying", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
      }
    }
    for (let i = 0; i < MAX_TICKS; i++) Glyph.step(p, c, this.cx - (MAX_TICKS - 1) * 10 + i * 20, f.tickY, i < this.tickCount, i === this.tickCount && this.stage !== "over");
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("value of holding one more tick", x0, top - 14, { font, color: c.fog });
    p.text("rival quit chance per tick", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("50%", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.line(X(0), Y(g.holdValue(0)), X(0.5), Y(g.holdValue(0.5)), c.ink, 2, 1);
    const pv = this.sl.value;
    p.rule(X(pv), top, X(pv), top + h, c.ink, 0.3);
    p.disc(X(pv), Y(g.holdValue(pv)), 6, c.ink, 1);
    const cr = this.cross.value;
    if (cr > 0.01) {
      p.ring(X(g.indifference), Y(0), 11, c.ink, 1.5, cr);
      p.text(pct(g.indifference), X(g.indifference), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    p.ring(this.cx + off, cy, R * Math.sqrt(g.V / 20), c.ink, 1.5, 1);
    p.dashedRing(this.cx - off, cy, Math.max(2, R * Math.sqrt(g.c / 20)), c.ink, 0.9);
    p.text(`prize ${fmt(g.V)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`cost ${fmt(g.c)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 0.25, 0.5], label: pct, text: (v) => `quits ${pct(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(g.indifference), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
