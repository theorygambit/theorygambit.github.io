import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { FEEL_AUCTION, PROVE_POOL, PROVE_TOLERANCE, type Case } from "./model";

const ROUNDS = 3;
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const money = (v: number): string => v.toFixed(2);

/**
 * Feel: three first price auctions against one rival. You see your value and choose a bid.
 * See: drag the bid along a profit curve. It peaks at half your value.
 * Prove: more bidders, new values. Drag to the best bid.
 */
export class AuctionsGame extends Game {
  readonly slug = "auctions";
  private readonly g = FEEL_AUCTION;
  private values: number[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private bid = 0;
  private rival = 0;
  private won = false;
  private since = 0;
  private readonly youR = new Damped(0, 0.4);
  private readonly altR = new Damped(0, 0.4);
  private readonly themR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = 1;
  private hi = 0;
  private reached = false;
  private readonly peak = new Damped(0, 0.6);

  private cases: Case[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly place = this.add(new CanvasButton("Bid", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.values = this.env.rng.shuffle([0.5, 0.7, 0.9]);
    this.round = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    const v = this.values[this.round]!;
    this.sl.range(0, v, 0.05);
    this.sl.value = Math.round((v * 0.9) / 0.05) * 0.05;
    this.youR.snap(0);
    this.altR.snap(0);
    this.themR.snap(0);
    this.prompt.set(`Your value is ${money(v)}. What do you bid?`);
    this.note.set(this.round === 0 ? "Highest bid wins and pays its own bid." : "");
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

  protected layout(): void {
    const by = this.buttonY;
    this.place.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.place.visible = this.beat === "feel" && this.stage === "choose";
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
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
      this.sl.value = Math.round(clamp((x - c.x0) / c.w, 0, 1) * c.v * 100) / 100;
      this.seeNote();
    } else this.sl.setFromX(x);
  }

  // ---- Feel -------------------------------------------------------------

  private commit(): void {
    if (this.stage !== "choose") return;
    const v = this.values[this.round]!;
    this.bid = this.sl.value;
    this.rival = this.g.rivalBid(this.env.rng.next());
    this.won = this.bid > this.rival;
    const profit = this.won ? v - this.bid : 0;
    const bestBid = v * this.g.shade;
    const altProfit = bestBid > this.rival ? v - bestBid : 0;
    this.youR.set(Math.sqrt(profit));
    this.altR.set(Math.sqrt(altProfit));
    this.themR.set(Math.sqrt(this.rival));
    this.stage = "wait";
    this.since = 0;
    this.cue(this.won ? "good" : "bad");
    this.sync();
  }

  private reveal(): void {
    const v = this.values[this.round]!;
    const profit = this.won ? v - this.bid : 0;
    const bestBid = v * this.g.shade;
    const altProfit = bestBid > this.rival ? v - bestBid : 0;
    this.stage = "result";
    this.round++;
    this.prompt.set(this.won ? "You won." : "You lost.");
    this.note.set(`They bid ${money(this.rival)}. You kept ${money(profit)}. Bidding ${money(bestBid)} would have kept ${money(altProfit)}.`);
    this.announce(`They bid ${money(this.rival)}. You ${this.won ? "won" : "lost"} and kept ${money(profit)}. Bidding ${money(bestBid)} would have kept ${money(altProfit)}.`);
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; v: number; X: (b: number) => number; Y: (y: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const v = 0.8;
    const ymax = this.g.profit(v / 2, v) * 1.15;
    return { x0, w, top, h, v, X: (b) => x0 + (b / v) * w, Y: (y) => top + h - (y / ymax) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.sl.range(0, 0.8, 0.01);
    this.sl.value = 0.78;
    this.lo = 1;
    this.hi = 0;
    this.reached = false;
    this.peak.snap(0);
    this.prompt.set("Your value is 0.80. Drag your bid.");
    this.note.set("Higher wins more often, but keeps less.");
    this.sync();
  }

  private seeNote(): void {
    const b = this.sl.value;
    const v = 0.8;
    const g = this.g;
    this.lo = Math.min(this.lo, b);
    this.hi = Math.max(this.hi, b);
    this.note.set(`Bid ${money(b)}: win ${pct(g.winChance(b))}, keep ${money(v - b)}. Expected ${money(g.profit(b, v))}.`);
    if (!this.reached && this.lo < 0.3 && this.hi > 0.55) {
      this.reached = true;
      this.peak.set(1);
      this.cue("good");
      this.prompt.set("The best bid is half your value.");
      this.announce("Expected profit peaks at a bid of 0.40, half your value of 0.80.");
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
    this.sl.range(0, c.value, 0.01);
    this.sl.value = Math.round(c.value * 50) / 100;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(`${c.auction.n} bidders. Your value is ${money(c.value)}.`);
    this.note.set("Drag to your best bid.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const b = this.sl.value;
    const best = c.value * c.auction.shade;
    const ok = Math.abs(b - best) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Shade by one over n.");
      this.note.set(`${c.auction.n - 1}/${c.auction.n} x ${money(c.value)} = ${money(best)}.`);
      this.wait = 1.9;
    } else {
      this.prompt.set(b > best ? "Not quite. You give away too much." : "Not quite. You lose too often.");
      this.note.set(`Bid ${money(b)}: expected ${money(c.auction.profit(b, c.value))}. A better bid earns ${money(c.auction.profit(best, c.value))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.themR.step(dt);
    this.peak.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Bid below value. More rivals, less shading.");
          this.note.set("Second price auctions let you bid your value.");
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
    const R = clamp((f.h - 110) / 2, 18, 44);
    const cy = f.top + R + 6;
    const off = Math.min(86, f.w / 2 - R - 10);
    p.dashedRing(this.cx - off, cy, this.altR.value * R, c.ink, 0.85);
    p.disc(this.cx - off, cy, this.youR.value * R, c.ink, 0.92 * a);
    p.ring(this.cx + off, cy, this.themR.value * R, c.ink, 1.5, a);
    const shown = this.stage === "result";
    p.text(shown ? `you keep ${money(this.won ? this.values[this.round - 1]! - this.bid : 0)}` : "you", this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(shown ? `they bid ${money(this.rival)}` : "rival", this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    this.sl.draw(p, c, { ticks: [0, this.sl.max], label: money, text: (v) => `bid ${money(v)}`, alpha: a });
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, v, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, top + h, x0 + w, top + h, c.ink, 0.5);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("expected profit", x0, top - 14, { font, color: c.fog });
    p.text("your bid", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(money(v), x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const b = (i / 40) * v;
      pts.push([X(b), Y(g.profit(b, v))]);
    }
    for (let i = 1; i < pts.length; i++) p.line(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1], c.ink, 2, 1);
    const b = this.sl.value;
    p.rule(X(b), top, X(b), top + h, c.ink, 0.3);
    p.disc(X(b), Y(g.profit(b, v)), 6, c.ink, 1);
    const pk = this.peak.value;
    if (pk > 0.01) {
      p.ring(X(v / 2), Y(g.profit(v / 2, v)), 11, c.ink, 1.5, pk);
      p.text(money(v / 2), X(v / 2), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: pk });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const n = k.auction.n;
    const step = Math.min(56, f.w / n);
    const R = clamp(step / 2 - 6, 8, 20);
    const cy = f.top + R + 10;
    for (let i = 0; i < n; i++) {
      const x = this.cx - ((n - 1) * step) / 2 + i * step;
      if (i === 0) p.disc(x, cy, R, c.ink, 0.92);
      else p.ring(x, cy, R, c.ink, 1.5, 1);
    }
    this.sl.draw(p, c, { ticks: [0, k.value], label: money, text: (v) => `bid ${money(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.value * k.auction.shade), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
