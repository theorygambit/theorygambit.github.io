import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Duopoly, FEEL, FEEL_ROUNDS, axisMax, isRight, proveSet, rivalQuantity, staircase } from "./model";

interface Round {
  q1: number;
  q2: number;
}

const r1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: pick a quantity for five rounds. The rival answers what you sold last time.
 * See: both best reply lines cross at one point. Step the replies and watch them walk to it.
 * Prove: new markets. Drag the point to where neither firm wants to change its quantity.
 */
export class CournotGame extends Game {
  readonly slug = "cournot";
  private hist: Round[] = [];
  private stage: "set" | "shown" = "set";
  private q = 30;
  private dragging = false;
  private readonly bar = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);
  private readonly prof1 = new Damped(0, 0.4);
  private readonly prof2 = new Damped(0, 0.4);

  private path: [number, number][] = [];
  private steps = 0;
  private readonly px = new Damped(0, 0.35);
  private readonly py = new Damped(0, 0.35);
  private readonly done = new Damped(0, 0.6);

  private cases: Duopoly[] = [];
  private pi = 0;
  private pt: [number, number] = [0, 0];
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly send = this.add(new CanvasButton("Set", () => this.setIt(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly reply = this.add(new CanvasButton("Reply", () => this.stepReply(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.hist = [];
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.q = 40;
      this.setIt();
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    for (let i = 0; i < 5; i++) this.stepReply();
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.send, this.next, this.toSee, this.reply, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    const last = this.hist.length >= FEEL_ROUNDS;
    this.send.visible = feel && this.stage === "set";
    this.next.visible = feel && this.stage === "shown" && !last;
    this.toSee.visible = feel && this.stage === "shown" && last;
    this.reply.visible = this.beat === "see" && this.steps < 5;
    this.toProve.visible = this.beat === "see" && this.steps >= 5;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private bar1(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 26, x1: f.x + f.w - 26, y: f.bottom - 26 };
  }

  private plane(f: Frame, max: number, wide = true): { x0: number; y0: number; s: number; X: (v: number) => number; Y: (v: number) => number } {
    const s = Math.max(60, Math.min(f.w - (wide ? 70 : 100), f.h - 60, 320));
    const x0 = this.cx - s / 2 + (wide ? 0 : 0);
    const y0 = f.top + 14 + s;
    return { x0, y0, s, X: (v) => x0 + (v / max) * s, Y: (v) => y0 - (v / max) * s };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "set") {
      this.dragging = true;
      this.setQ(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setPt(x, y);
    }
  }

  protected override onMove(x: number, y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setQ(x);
    else if (this.beat === "prove") this.setPt(x, y);
  }

  protected override onUp(_x: number, _y: number): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "set";
    this.show.snap(0);
    this.bar.snap(this.q);
    this.prof1.snap(0);
    this.prof2.snap(0);
    this.prompt.set(`Price is 90 minus the total. Choose how much to sell.`);
    this.note.set(`Round ${this.hist.length + 1} of ${FEEL_ROUNDS}. You sell ${this.q}.`);
    this.sync();
  }

  private setQ(x: number): void {
    const { x0, x1 } = this.bar1(this.frame);
    this.q = clamp(Math.round(((x - x0) / (x1 - x0)) * FEEL.a), 0, 60);
    this.bar.set(this.q);
    this.note.set(`Round ${this.hist.length + 1} of ${FEEL_ROUNDS}. You sell ${this.q}.`);
  }

  private setIt(): void {
    const prev = this.hist.length ? this.hist[this.hist.length - 1]!.q1 : null;
    const q2 = rivalQuantity(FEEL, prev);
    const q1 = this.q;
    this.hist.push({ q1, q2 });
    this.stage = "shown";
    this.show.set(1);
    const price = FEEL.price(q1 + q2);
    const p1 = FEEL.profit(1, q1, q2);
    const p2 = FEEL.profit(2, q1, q2);
    this.prof1.set(p1);
    this.prof2.set(p2);
    const br = Math.round(FEEL.bestReply(1, q2));
    const bp = FEEL.profit(1, br, q2);
    this.prompt.set(`Price ${price}. You earn ${r1(p1)}, they earn ${r1(p2)}.`);
    this.note.set(bp > p1 + 1 ? `Selling ${br} would have earned ${r1(bp)}.` : "You sold about the best amount for what they sold.");
    this.announce(`You sold ${q1}, they sold ${q2}. Price ${price}.`);
    this.cue(p1 >= p2 ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    const last = this.hist[this.hist.length - 1]!;
    this.path = staircase(FEEL, { q1: last.q1, q2: last.q2 }, 5);
    this.steps = 0;
    this.px.snap(this.path[0]![0]);
    this.py.snap(this.path[0]![1]);
    this.done.snap(0);
    this.prompt.set("Step the replies. Where do they end?");
    this.note.set("Solid line: your best reply. Dashed: theirs.");
    this.sync();
  }

  private stepReply(): void {
    if (this.steps >= 5) return;
    this.steps++;
    const p = this.path[this.steps]!;
    this.px.set(p[0]);
    this.py.set(p[1]);
    this.cue("good");
    if (this.steps >= 5) {
      this.done.set(1);
      this.prompt.set("Half of what the other leaves.");
      this.note.set("30 each. Selling 22.5 each pays more, but neither stays there.");
      this.announce("The replies settle at 30 each. 22.5 each pays more, but neither firm would stay.");
    } else {
      this.note.set(`Reply ${this.steps} of 5. ${this.steps % 2 ? "You" : "They"} sell half of what the other leaves.`);
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
    const d = this.cases[this.pi]!;
    this.pt = [0, 0];
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set(d.symmetric ? `Price is ${d.a} minus the total. Cost ${d.c1} each.` : `Price is ${d.a} minus the total. You pay ${d.c1}, they pay ${d.c2}.`);
    this.note.set("Drag the point to where neither wants to change.");
    this.sync();
  }

  private setPt(x: number, y: number): void {
    const d = this.cases[this.pi]!;
    const max = axisMax(d);
    const pl = this.plane(this.frame, max, false);
    this.pt = [clamp(Math.round(((x - pl.x0) / pl.s) * max), 0, max), clamp(Math.round(((pl.y0 - y) / pl.s) * max), 0, max)];
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`You sell ${this.pt[0]}, they sell ${this.pt[1]}.`);
  }

  private lockIn(): void {
    const d = this.cases[this.pi]!;
    const [q1, q2] = this.pt;
    const ok = isRight(d, q1, q2);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    if (ok) {
      this.locked = true;
      this.solved++;
      const e = d.equilibrium();
      this.prompt.set("Right. Neither wants to move.");
      this.note.set(`You sell ${r1(e.q1)}, they sell ${r1(e.q2)}: each is half of what is left after cost.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      const b2 = d.bestReply(2, q1);
      const b1 = d.bestReply(1, q2);
      const theirs = Math.abs(b2 - q2) >= Math.abs(b1 - q1);
      this.prompt.set(theirs ? "They would change." : "You would change.");
      this.note.set(theirs ? `Facing your ${q1}, they would sell ${r1(b2)}, not ${q2}.` : `Facing their ${q2}, you would sell ${r1(b1)}, not ${q1}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.bar, this.show, this.prof1, this.prof2, this.px, this.py, this.done, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Each firm sells half of what the other leaves.");
          this.note.set("Lower cost sells more, and the rival sells less.");
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
    const sv = this.show.value;
    const { x0, x1, y } = this.bar1(f);
    const X = (v: number) => x0 + (v / FEEL.a) * (x1 - x0);
    const last = this.hist[this.hist.length - 1];
    const mine = this.stage === "set" ? this.bar.value : last!.q1;
    p.rule(x0, y, x1, y, c.ink, 0.4);
    for (const t of [0, 30, 60, 90]) {
      p.rule(X(t), y - 3, X(t), y + 3, c.ink, 0.4);
      p.text(String(t), X(t), y + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    p.line(x0, y, X(mine), y, c.ink, 5, 0.95);
    if (last && sv > 0.01) p.line(X(last.q1), y, X(last.q1 + last.q2), y, c.ink, 5, 0.45 * sv);
    p.disc(X(mine), y, 8, c.ink);
    p.ring(X(mine), y, 8, c.ground, 1.5, 0.9);

    const R = clamp(Math.min((f.w - 60) / 4.6, (f.h - 80) / 2.4), 14, 60);
    const cy = f.top + R + 4;
    const xl = this.cx - 2.0 * R;
    const xr = this.cx + 2.0 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 1500) / 1200);
    if (sv > 0.01 && last) {
      p.disc(xl, cy, rad(this.prof1.value), c.ink, 0.95 * sv);
      p.ring(xr, cy, rad(this.prof2.value), c.ink, 1.5, sv);
      const br = Math.round(FEEL.bestReply(1, last.q2));
      const bp = FEEL.profit(1, br, last.q2);
      if (bp > this.prof1.value + 1) p.dashedRing(xl, cy, rad(bp), c.ink, 0.8 * sv);
      p.text(`you ${r1(this.prof1.value)}`, xl, cy + 1.25 * R + 14, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      p.text(`they ${r1(this.prof2.value)}`, xr, cy + 1.25 * R + 14, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      p.text(`price ${FEEL.price(last.q1 + last.q2)}`, this.cx, cy + 1.25 * R + 14, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: sv });
    } else {
      p.dashedRing(xl, cy, rad(900), c.ink, 0.5);
      p.text("sell, then see", this.cx, cy + 1.25 * R + 14, { font: Type.body(13, 400), color: c.fog, align: "center" });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.hist.length - (this.stage === "set" ? 0 : 0) && (i < this.hist.length), i === this.hist.length && this.stage === "set");
  }

  private axes(p: Painter, c: Colors, pl: { x0: number; y0: number; s: number; X: (v: number) => number; Y: (v: number) => number }, max: number, ticks: number[]): void {
    p.rule(pl.x0, pl.y0, pl.x0 + pl.s, pl.y0, c.ink, 0.5);
    p.rule(pl.x0, pl.y0, pl.x0, pl.y0 - pl.s, c.ink, 0.5);
    for (const t of ticks) {
      p.rule(pl.X(t), pl.y0, pl.X(t), pl.y0 + 4, c.ink, 0.5);
      p.text(String(t), pl.X(t), pl.y0 + 24, { font: Type.mono(10), color: c.ash, align: "center" });
      if (t > 0) {
        p.rule(pl.x0 - 4, pl.Y(t), pl.x0, pl.Y(t), c.ink, 0.5);
        p.text(String(t), pl.x0 - 8, pl.Y(t), { font: Type.mono(10), color: c.ash, align: "right", base: "middle" });
      }
    }
    void max;
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const max = FEEL.a;
    const pl = this.plane(f, max, true);
    this.axes(p, c, pl, max, [0, 30, 60, 90]);
    p.text("you sell", pl.x0 + pl.s, pl.y0 + 42, { font: Type.body(12, 400), color: c.fog, align: "right" });
    p.text("they sell", pl.x0 - 4, pl.y0 - pl.s - 10, { font: Type.body(12, 400), color: c.fog, align: "left" });
    p.line(pl.X(45), pl.Y(0), pl.X(0), pl.Y(90), c.ink, 1.25, 0.9);
    p.line(pl.X(0), pl.Y(45), pl.X(90), pl.Y(0), c.ink, 1.25, 0.9, [4, 4]);
    this.hist.forEach((h, i) => p.disc(pl.X(h.q1), pl.Y(h.q2), 3, c.ink, i === this.hist.length - 1 ? 0.8 : 0.3));
    for (let i = 0; i < this.steps; i++) {
      const a = this.path[i]!;
      const b = i + 1 === this.steps ? ([this.px.value, this.py.value] as [number, number]) : this.path[i + 1]!;
      p.line(pl.X(a[0]), pl.Y(a[1]), pl.X(b[0]), pl.Y(b[1]), c.ink, 2, 0.9);
    }
    p.disc(pl.X(this.px.value), pl.Y(this.py.value), 5, c.ink);
    const dn = this.done.value;
    if (dn > 0.01) {
      p.ring(pl.X(30), pl.Y(30), 10, c.ink, 1.5, dn);
      p.dashedRing(pl.X(22.5), pl.Y(22.5), 6, c.ink, 0.8 * dn);
    }
    for (let i = 0; i < 5; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.steps, i === this.steps);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const d = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const max = axisMax(d);
    const pl = this.plane(f, max, false);
    const step = max <= 60 ? 20 : max <= 120 ? 40 : 50;
    const ticks: number[] = [];
    for (let t = 0; t <= max; t += step) ticks.push(t);
    this.axes(p, c, pl, max, ticks);
    p.text("you sell", pl.x0 + pl.s, pl.y0 + 42, { font: Type.body(12, 400), color: c.fog, align: "right" });
    p.text("they sell", pl.x0 - 4, pl.y0 - pl.s - 10, { font: Type.body(12, 400), color: c.fog, align: "left" });
    const [q1, q2] = this.pt;
    const rv = this.reveal.value;
    if (rv > 0.01) {
      const e = d.equilibrium();
      if (this.locked) p.ring(pl.X(e.q1), pl.Y(e.q2), 12, c.ink, 1.5, rv);
      else {
        const b2 = d.bestReply(2, q1);
        const b1 = d.bestReply(1, q2);
        const theirs = Math.abs(b2 - q2) >= Math.abs(b1 - q1);
        if (theirs) {
          p.line(pl.X(q1), pl.Y(q2), pl.X(q1), pl.Y(b2), c.ink, 1.25, 0.8 * rv, [3, 4]);
          p.dashedRing(pl.X(q1), pl.Y(b2), 7, c.ink, rv);
        } else {
          p.line(pl.X(q1), pl.Y(q2), pl.X(b1), pl.Y(q2), c.ink, 1.25, 0.8 * rv, [3, 4]);
          p.dashedRing(pl.X(b1), pl.Y(q2), 7, c.ink, rv);
        }
      }
    }
    p.disc(pl.X(q1), pl.Y(q2), 8, c.ink);
    p.ring(pl.X(q1), pl.Y(q2), 8, c.ground, 1.5, 0.9);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
