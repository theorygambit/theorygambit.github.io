import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { ENDOWMENT, FEEL_POT, MULT_MAX, MULT_MIN, PROVE_SIZES, Pot, othersGive } from "./model";

const ROUNDS = 3;
const SCALE = 25;

/**
 * Feel: three rounds. Choose your gift, and see what giving nothing would have paid.
 * See: drag your gift. Your payoff falls while the group's rises.
 * Prove: new group sizes. Drag the multiplier to where giving stops costing you.
 */
export class PublicGoodsGame extends Game {
  readonly slug = "public-goods";
  private readonly pot = FEEL_POT;
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private others: number[] = [5, 5, 5];
  private gift = 0;
  private since = 0;
  private readonly youR = new Damped(0, 0.4);
  private readonly altR = new Damped(0, 0.4);
  private readonly othR = [new Damped(0, 0.4), new Damped(0, 0.4), new Damped(0, 0.4)];
  private readonly shown = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private reached = false;

  private sizes: number[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly give = this.add(new CanvasButton("Give", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.stage = "choose";
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    this.others = othersGive(this.env.rng);
    this.sl.range(0, ENDOWMENT, 1);
    this.sl.value = 5;
    this.shown.snap(0);
    const base = this.rad(ENDOWMENT);
    this.youR.snap(base);
    this.altR.snap(0);
    this.othR.forEach((d) => d.snap(base));
    this.prompt.set(this.round === 0 ? "How many of your 10 tokens go in the pot?" : "Again. How many go in?");
    this.note.set("");
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
    this.give.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.give.visible = this.beat === "feel" && this.stage === "choose";
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private rad(v: number): number {
    return Math.sqrt(Math.max(v, 0.01) / SCALE);
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
      this.gift = Math.round(clamp((x - c.x0) / c.w, 0, 1) * ENDOWMENT);
      this.sl.value = this.gift;
      const g = this.gift;
      const net = this.pot.netCost * g;
      this.note.set(`Give ${g}. You ${g === 0 ? "keep every token" : `lose ${fmt(net)}`}. The group gains ${fmt((this.pot.r - 1) * g)}.`);
      if (g >= 8 && !this.reached) {
        this.reached = true;
        this.cue("good");
        this.prompt.set("Each token costs you, and helps the group.");
        this.announce(`Each token you give costs you ${fmt(this.pot.netCost)} and adds ${fmt(this.pot.r - 1)} to the group.`);
        this.sync();
      }
    } else this.sl.setFromX(x);
  }

  // ---- Feel -------------------------------------------------------------

  private commit(): void {
    if (this.stage !== "choose") return;
    this.gift = this.sl.value;
    this.stage = "wait";
    this.since = 0;
    const total = this.others.reduce((a, b) => a + b, 0) + this.gift;
    this.youR.set(this.rad(this.pot.payoff(this.gift, total - this.gift)));
    this.altR.set(this.rad(this.pot.payoff(0, total - this.gift)));
    this.othR.forEach((d, i) => d.set(this.rad(ENDOWMENT - this.others[i]! + (this.pot.r * total) / this.pot.n)));
    this.cue("good");
    this.sync();
  }

  private reveal(): void {
    const others = this.others.reduce((a, b) => a + b, 0);
    const got = this.pot.payoff(this.gift, others);
    const alt = this.pot.payoff(0, others);
    this.shown.set(1);
    this.stage = "result";
    this.round++;
    this.note.set(`You gave ${this.gift} and got ${fmt(got)}. Giving nothing paid ${fmt(alt)}.`);
    this.announce(`Round ${this.round}. You gave ${this.gift} and got ${fmt(got)}. Giving nothing would have paid ${fmt(alt)}.`);
    this.prompt.set(this.round >= ROUNDS ? "Three rounds. Keeping paid more each time." : "They gave too.");
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.sl.range(0, ENDOWMENT, 1);
    this.sl.value = 0;
    this.gift = 0;
    this.reached = false;
    this.prompt.set("Drag your gift. Watch you and the group.");
    this.note.set("Give nothing: neither line moves.");
    this.sync();
  }

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (g: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 50));
    const lo = -(this.pot.netCost * ENDOWMENT) - 1;
    const hi = (this.pot.r - 1) * ENDOWMENT + 1;
    return { x0, w, top, h, X: (g) => x0 + (g / ENDOWMENT) * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.sizes = this.env.rng.shuffle(PROVE_SIZES).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.sl.range(MULT_MIN, MULT_MAX, 0.5);
    this.sl.value = 2;
    this.locked = false;
    this.trueAt.snap(0);
    const n = this.sizes[this.pi]!;
    this.prompt.set(`${n} players. Where does giving stop costing you?`);
    this.note.set("Drag the multiplier on the pot.");
    this.sync();
  }

  private lockIn(): void {
    const n = this.sizes[this.pi]!;
    const r = this.sl.value;
    const pot = new Pot(n, r);
    const ok = r === n;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. At x${n}, a token returns exactly 1.`);
      this.note.set(`${n} / ${n} = 1. Above that, giving pays you.`);
      this.wait = 1.9;
    } else {
      this.prompt.set(pot.givingPays() ? "Not quite. Giving already pays here." : "Not quite. Giving still costs you.");
      this.note.set(`At x${fmt(r)}, a token returns ${fmt(r / n)} to you. It must return 1.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.othR.forEach((d) => d.step(dt));
    this.shown.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.sizes.length) {
          this.prompt.set("Each token returns r over n to you.");
          this.note.set("Unless r beats n, keeping is tempting.");
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
    const step = f.w / 4;
    const R = clamp(Math.min(step / 2 - 6, (f.h - 130) / 2), 12, 30);
    const cy = f.top + R + 4;
    const t = this.shown.value;
    const others = this.others.reduce((x, y) => x + y, 0);
    const total = others + this.gift;
    const payYou = this.pot.payoff(this.gift, others);
    p.dashedRing(f.x + step * 0.5, cy, this.altR.value * R, c.ink, 0.85);
    p.disc(f.x + step * 0.5, cy, this.youR.value * R, c.ink, 0.92 * a);
    p.text(t > 0.5 ? fmt(payYou) : "you", f.x + step * 0.5, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    for (let i = 0; i < 3; i++) {
      const x = f.x + step * (i + 1.5);
      p.ring(x, cy, this.othR[i]!.value * R, c.ink, 1.5, a);
      const pay = ENDOWMENT - this.others[i]! + (this.pot.r * total) / this.pot.n;
      p.text(t > 0.5 ? fmt(pay) : "", x, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    }
    if (this.stage === "choose" || this.stage === "wait") this.sl.draw(p, c, { ticks: [0, 5, 10], text: (v) => `give ${v}`, alpha: a });
    else this.sl.draw(p, c, { ticks: [0, 5, 10], text: (v) => `gave ${v}`, alpha: a });
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const pot = this.pot;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("change from giving nothing", x0, top - 14, { font, color: c.fog });
    p.text("tokens you give", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(String(ENDOWMENT), x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    const gv = this.gift;
    const you = -pot.netCost * gv;
    const grp = (pot.r - 1) * gv;
    p.line(X(0), Y(0), X(ENDOWMENT), Y(-pot.netCost * ENDOWMENT), c.ink, 2, 1);
    p.line(X(0), Y(0), X(ENDOWMENT), Y((pot.r - 1) * ENDOWMENT), c.ink, 1.25, 0.7, [5, 4]);
    p.rule(X(gv), top, X(gv), top + h, c.ink, 0.3);
    p.disc(X(gv), Y(you), 6, c.ink, 1);
    p.ring(X(gv), Y(grp), 6, c.ink, 1.5, 1);
    const legendY = top + h + 40;
    p.disc(x0 + 4, legendY - 4, 4, c.ink, 1);
    p.text("you", x0 + 14, legendY, { font, color: c.ink });
    p.ring(x0 + 58, legendY - 4, 4, c.ink, 1.5, 1);
    p.text("group", x0 + 68, legendY, { font, color: c.fog });
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const n = this.sizes[Math.min(this.pi, this.sizes.length - 1)]!;
    const step = f.w / Math.max(n, 4);
    const R = clamp(step / 2 - 6, 8, 24);
    const cy = f.top + R + 10;
    for (let i = 0; i < n; i++) {
      const x = this.cx - ((n - 1) * step) / 2 + i * step;
      if (i === 0) p.disc(x, cy, R, c.ink, 0.92);
      else p.ring(x, cy, R, c.ink, 1.5, 1);
    }
    this.sl.draw(p, c, { ticks: [1, 4, 8], text: (v) => `x${fmt(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(n), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.sizes.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
