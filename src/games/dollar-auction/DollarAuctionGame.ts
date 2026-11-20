import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { BUDGETS, DollarAuction, Escalation, FEEL_AUCTION, proveSet } from "./model";

/**
 * Feel: bid for 100 against a rival who keeps topping you. Raise or walk away.
 * See: what the winner, the runner up and the two together end with, bid by bid. Drag along the bids.
 * Prove: new prizes and steps. Find the first top bid where the two bids together beat the prize.
 */
export class DollarAuctionGame extends Game {
  readonly slug = "dollar-auction";
  private es = new Escalation(FEEL_AUCTION, 140);
  private stage: "choose" | "wait" | "over" = "choose";
  private since = 0;
  private armed: "raise" | "walk" | null = null;
  private readonly youV = new Damped(0, 0.4);
  private readonly rivV = new Damped(0, 0.4);
  private readonly takeV = new Damped(0, 0.6);
  private readonly intro = new Damped(0, 0.7);

  private probe = 10;
  private reached = false;
  private touched = false;
  private dragging = false;
  private readonly cross = new Damped(0, 0.6);
  private readonly plot = new Plot({ xMin: 10, xMax: 150, yMin: -200, yMax: 100, padL: 30, padR: 62, padT: 26, padB: 54, maxH: 220 });

  private cases: DollarAuction[] = [];
  private pi = 0;
  private pb = 10;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);
  private readonly bidsV = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.es = new Escalation(FEEL_AUCTION, this.env.rng.pick(BUDGETS));
    this.es.open();
    this.stage = "choose";
    this.armed = null;
    this.youV.snap(this.es.you);
    this.rivV.snap(this.es.rival);
    this.takeV.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Highest bid wins 100. The second highest pays too.");
    this.note.set("They topped your bid. Raise, or walk away.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 64 : 72) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.stage === "over";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage !== "choose") return;
      if (inside(this.pair(0), x, y)) this.armed = "raise";
      else if (inside(this.pair(1), x, y)) this.armed = "walk";
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setBid(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove") this.setBid(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && inside(this.pair(m === "raise" ? 0 : 1), x, y)) {
      if (m === "raise") this.raise();
      else this.walk();
    }
  }

  // ---- Feel -------------------------------------------------------------

  private raise(): void {
    this.es.raise();
    this.youV.set(this.es.you);
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(`You bid ${this.es.you}. They are deciding.`);
    this.announce(`You raised to ${this.es.you}.`);
  }

  private walk(): void {
    this.es.walk();
    this.finishFeel();
  }

  private answer(): void {
    this.es.respond();
    if (this.es.over === "won") {
      this.finishFeel();
      return;
    }
    this.rivV.set(this.es.rival);
    this.stage = "choose";
    this.prompt.set(`They topped you with ${this.es.rival}.`);
    this.note.set(this.es.rival >= FEEL_AUCTION.prize ? "Winning now still costs more than the prize." : "Raise, or walk away.");
  }

  private finishFeel(): void {
    const e = this.es;
    this.stage = "over";
    this.rivV.set(e.rival);
    this.takeV.set(e.take);
    const net = e.youNet();
    this.prompt.set(e.over === "won" ? `You won the 100, and paid ${e.you}.` : `You walked. You paid ${e.you}.`);
    this.note.set(`The auctioneer took ${e.take}. Walking at the start would have cost ${FEEL_AUCTION.step}.`);
    this.announce(`You ended with ${net}. The auctioneer collected ${e.take}.`);
    this.cue(net >= -FEEL_AUCTION.step ? "good" : "bad");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 10;
    this.reached = false;
    this.touched = false;
    this.cross.snap(0);
    this.prompt.set("Second place pays too. Drag along the bids.");
    this.note.set("Top bid 10: the winner nets 90, the runner up 0.");
    this.sync();
  }

  private setProbe(x: number): void {
    const a = FEEL_AUCTION;
    const v = clamp(Math.round(this.plot.valueAtX(x) / a.step) * a.step, a.step, 150);
    this.probe = v;
    this.touched = true;
    this.note.set(`Top bid ${v}: winner ${a.winnerNet(v)}, runner up ${a.loserNet(v)}, both ${a.pairNet(v)}.`);
    if (!this.reached && v >= 70) {
      this.reached = true;
      this.cross.set(1);
      this.prompt.set("Past 60 the two bids beat the prize. The auctioneer wins.");
      this.announce("From a top bid of 60 the two bids together exceed the prize.");
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
    const a = this.cases[this.pi]!;
    this.pb = a.step;
    this.locked = false;
    this.wrong = false;
    this.trueAt.snap(0);
    this.bidsV.snap(0);
    this.prompt.set(`Prize ${a.prize}. Bids rise by ${a.step}. When do both bids beat it?`);
    this.note.set("Drag to the first top bid where the pair loses, then lock in.");
    this.sync();
  }

  private notches(a: DollarAuction): number {
    return Math.ceil((a.prize * 1.25) / a.step);
  }

  private ladder(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 22, x1: f.x + f.w - 22, y: f.bottom - 34 };
  }

  private setBid(x: number): void {
    const a = this.cases[this.pi]!;
    const { x0, x1 } = this.ladder(this.frame);
    const n = this.notches(a);
    const k = clamp(Math.round(((x - x0) / (x1 - x0)) * (n - 1)) + 1, 1, n);
    this.pb = k * a.step;
    if (this.wrong) {
      this.wrong = false;
      this.bidsV.set(0);
      this.note.set("Drag to the first top bid where the pair loses, then lock in.");
    }
  }

  private lockIn(): void {
    const a = this.cases[this.pi]!;
    const ok = this.pb === a.breakEvenBid();
    this.cue(ok ? "good" : "bad");
    this.bidsV.set(1);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. The pair is already behind.");
      this.note.set(`At ${this.pb} the bids are ${this.pb} and ${this.pb - a.step}: ${a.take(this.pb)} for a prize of ${a.prize}.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      const t = a.take(this.pb);
      this.prompt.set(t > a.prize ? "Too late. They were behind before that." : "Too early. The pair still comes out ahead.");
      this.note.set(`At ${this.pb} the two bids total ${t} for a prize of ${a.prize}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.youV, this.rivV, this.takeV, this.intro, this.cross, this.trueAt, this.bidsV]) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.8) this.answer();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Both pay, so the bidding outgrows the prize.");
          this.note.set("Stop before the second bid passes half the prize.");
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
    else if (this.beat === "see") this.drawSee(p, c);
    else this.drawProve(p, c, f);
  }

  /** Three discs in a row: left, prize, right. Area is money. */
  private row(f: Frame, room = f.h - 100): { Rp: number; cy: number; xl: number; xc: number; xr: number; ly: number } {
    const Rp = clamp(Math.min((f.w - 24) / 7.2, room / 3.4), 12, 46);
    const cy = f.top + 1.6 * Rp + 4;
    const d = 2.35 * Rp;
    return { Rp, cy, xl: this.cx - d, xc: this.cx, xr: this.cx + d, ly: cy + 1.6 * Rp + 16 };
  }

  private rad(v: number, Rp: number, prize: number): number {
    return Rp * Math.sqrt(Math.max(0, v) / prize);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const { Rp, cy, xl, xc, xr, ly } = this.row(f);
    const prize = FEEL_AUCTION.prize;
    const tk = this.takeV.value;
    if (tk > 0.5) p.disc(xc, cy, Math.min(1.6 * Rp, this.rad(tk, Rp, prize)), c.ink, 0.2 * a);
    p.dashedRing(xc, cy, Rp, c.ink, a);
    p.disc(xl, cy, this.rad(this.youV.value, Rp, prize), c.ink, 0.95 * a);
    p.ring(xr, cy, this.rad(this.rivV.value, Rp, prize), c.ink, 1.5, a);
    if (this.stage === "over") p.dashedRing(xl, cy, this.rad(FEEL_AUCTION.step, Rp, prize), c.ground, 0.9);
    p.text(`you ${Math.round(this.youV.value)}`, xl, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: a });
    p.text(this.stage === "over" ? `takes ${Math.round(tk)}` : `prize ${prize}`, xc, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(`they ${Math.round(this.rivV.value)}`, xr, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: a });

    const open = this.stage === "choose";
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const raise = i === 0;
      const live = open ? 1 : this.stage === "over" ? 0 : 0.3;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * live);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (raise ? "raise" : "walk") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.text(raise ? `Raise to ${this.es.nextRaise}` : "Walk away", gx, z.y + z.h * 0.4, { font: Type.body(15, 400), color: c.ink, align: "center", base: "middle", alpha: live });
      p.text(raise ? `pay ${this.es.nextRaise} to win ${prize}` : `lose ${this.es.you}`, gx, z.y + z.h * 0.74, { font: Type.body(11, 400), color: c.fog, align: "center", base: "middle", alpha: live });
    }
    const n = Math.min(6, Math.round(this.es.you / FEEL_AUCTION.step));
    for (let i = 0; i < 6; i++) Glyph.step(p, c, this.cx - 50 + i * 20, f.tickY, i < n - 1, i === n - 1);
  }

  private drawSee(p: Painter, c: Colors): void {
    const a = FEEL_AUCTION;
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [10, 50, 100, 150], xLabel: "top bid", yLabel: "what they end with" });
    p.rule(pl.x0, pl.Y(0), pl.right, pl.Y(0), c.ink, 0.3);
    p.text("0", pl.x0 - 8, pl.Y(0), { font: Type.mono(10), color: c.ash, align: "right", base: "middle" });
    pl.curve(p, (b) => a.winnerNet(b), c.ink, 1.75, 1, 28);
    pl.curve(p, (b) => a.loserNet(b), c.fog, 1.5, 0.9, 28);
    pl.curve(p, (b) => a.pairNet(b), c.ink, 1.25, 0.9, 28);
    const lab = (s: string, v: number, color: string) => p.text(s, pl.right + 8, pl.Y(v), { font: Type.body(12, 400), color, base: "middle" });
    lab("winner", a.winnerNet(150), c.ink);
    lab("second", a.loserNet(150), c.fog);
    lab("both", a.pairNet(150), c.ink);
    const cr = this.cross.value;
    if (cr > 0.01) p.ring(pl.X(55), pl.Y(0), 9, c.ink, 1.5, cr);
    if (this.touched) {
      const px = pl.X(this.probe);
      p.line(px, pl.top, px, pl.base, c.ink, 1, 0.5, [3, 4]);
      p.disc(px, pl.Y(a.winnerNet(this.probe)), 4, c.ink);
      p.ring(px, pl.Y(a.loserNet(this.probe)), 4, c.ink, 1.5);
      p.disc(px, pl.Y(a.pairNet(this.probe)), 4, c.ink, 0.6);
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const a = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const { Rp, cy, xl, xc, xr, ly } = this.row(f, this.ladder(f).y - f.top - 34);
    const bv = this.bidsV.value;
    p.dashedRing(xc, cy, Rp, c.ink, 1);
    p.text(`prize ${a.prize}`, xc, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (bv > 0.01) {
      p.disc(xl, cy, this.rad(this.pb, Rp, a.prize), c.ink, 0.95 * bv);
      p.ring(xr, cy, this.rad(this.pb - a.step, Rp, a.prize), c.ink, 1.5, bv);
      p.text(`top ${this.pb}`, xl, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: bv });
      p.text(`second ${this.pb - a.step}`, xr, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: bv });
    }
    const { x0, x1, y } = this.ladder(f);
    const n = this.notches(a);
    const gap = (x1 - x0) / (n - 1);
    const every = gap >= 30 ? 1 : 2;
    p.rule(x0, y, x1, y, c.ink, 0.5);
    for (let k = 1; k <= n; k++) {
      const x = x0 + ((k - 1) / (n - 1)) * (x1 - x0);
      p.rule(x, y - 5, x, y + 5, c.ink, 0.5);
      if ((k - 1) % every === 0) p.text(String(k * a.step), x, y + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const mx = x0 + ((this.pb / a.step - 1) / (n - 1)) * (x1 - x0);
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(x0 + ((a.breakEvenBid() / a.step - 1) / (n - 1)) * (x1 - x0), y, 12, c.ink, 1.25, tv);
    p.disc(mx, y, 9, c.ink);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
