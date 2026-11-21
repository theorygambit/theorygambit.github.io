import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_MARKET, PROVE_TOLERANCE, randomMarket, type Lemons, type Round } from "./model";

const MINE = 4;

/**
 * Feel: you own a car worth 6. Each round buyers offer the average of what is on sale. Sell or keep.
 * See: tap through the rounds. Cars worth more than the offer leave.
 * Prove: a new market. Drag to the price where it stops shrinking.
 */
export class LemonsGame extends Game {
  readonly slug = "lemons-adverse-selection";
  private market: Lemons = FEEL_MARKET;
  private rounds: Round[] = FEEL_MARKET.rounds();
  private ri = 0;
  private stage: "choose" | "auto" | "done" = "choose";
  private sold: number | null = null;
  private since = 0;
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;

  private puzzles: Lemons[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly sell = this.add(new CanvasButton("Sell", () => this.decide(true)));
  private readonly keep = this.add(new CanvasButton("Keep", () => this.decide(false), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.market = FEEL_MARKET;
    this.rounds = this.market.rounds();
    this.ri = 0;
    this.stage = "choose";
    this.sold = null;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Your car is worth 6. Sell, or keep?");
    this.note.set("Buyers offer the average of the cars on sale.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.stage = "done";
    this.enterSee();
    if (beat === "see") return;
    this.ri = this.rounds.length - 1;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    const a = this.pair(0);
    const b = this.pair(1);
    this.sell.place(a.x, by, a.w);
    this.keep.place(b.x, by, b.w);
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.sell.visible = this.beat === "feel" && this.stage === "choose";
    this.keep.visible = this.beat === "feel" && this.stage === "choose";
    this.toSee.visible = this.beat === "feel" && this.stage === "done";
    this.toProve.visible = this.beat === "see" && this.ri >= this.rounds.length - 1;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") this.stepRound();
    else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.sl.setFromX(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private decide(sellNow: boolean): void {
    if (this.stage !== "choose") return;
    const r = this.rounds[this.ri]!;
    const worth = FEEL_MARKET.qualities[MINE]!;
    if (sellNow) {
      this.sold = r.price;
      const gain = r.price - worth;
      this.cue(gain >= 0 ? "good" : "bad");
      this.prompt.set(gain >= 0 ? "Sold. Now watch the market." : "Sold below its worth.");
      this.note.set(`You got ${fmt(r.price)} for a car worth ${worth}. ${gain >= 0 ? "Gain" : "Loss"} ${fmt(Math.abs(gain))}.`);
      this.announce(`You got ${fmt(r.price)} for a car worth ${worth}.`);
    } else {
      this.cue("good");
      this.prompt.set("You kept it. Watch the market.");
      this.note.set(`Offer was ${fmt(r.price)}. Cars worth more than that will not sell.`);
    }
    this.stage = "auto";
    this.since = 0;
    this.sync();
  }

  private advanceAuto(): void {
    if (this.ri >= this.rounds.length - 1) {
      this.stage = "done";
      const final = this.rounds[this.rounds.length - 1]!;
      this.prompt.set(this.sold === null ? "Your car left the market." : "The market kept shrinking.");
      this.note.set(`It ended at ${fmt(final.price)} with ${final.onSale.length} cars, the worst ones.`);
      this.sync();
      return;
    }
    this.ri++;
    this.since = 0;
    const r = this.rounds[this.ri]!;
    this.note.set(`Better cars left. New offer ${fmt(r.price)}.`);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.ri = 0;
    this.rounds = FEEL_MARKET.rounds();
    this.market = FEEL_MARKET;
    this.prompt.set("Tap. Who leaves at this offer?");
    this.note.set("Owners of cars worth more than the offer keep them.");
    this.sync();
  }

  private stepRound(): void {
    if (this.ri >= this.rounds.length - 1) return;
    this.ri++;
    this.cue("good");
    const r = this.rounds[this.ri]!;
    this.note.set(`Offer ${fmt(r.price)}. ${r.onSale.length} cars left to sell.`);
    if (this.ri >= this.rounds.length - 1) {
      this.prompt.set("The average falls, and so does quality.");
      this.note.set(`It stops at ${fmt(r.price)}, with only the worst cars.`);
      this.announce(`The market stops at an offer of ${fmt(r.price)}, with only the cheapest cars.`);
    } else this.prompt.set(this.ri === 1 ? "The best cars left. Tap again." : "Again the best leave. Tap.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [randomMarket(this.env.rng), randomMarket(this.env.rng)];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.market = this.puzzles[this.pi]!;
    this.rounds = this.market.rounds();
    this.ri = 0;
    this.sl.range(1, 14, 0.1);
    this.sl.value = 7;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New cars. Where does the offer settle?" : "Another market. Where does it settle?");
    this.note.set(`Buyers pay ${this.market.m} x the average on sale.`);
    this.sync();
  }

  private lockIn(): void {
    const m = this.market;
    const x = this.sl.value;
    const fin = m.finalPrice;
    const ok = Math.abs(x - fin) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.ri = this.rounds.length - 1;
      this.prompt.set(`Right. It settles near ${fmt(fin)}.`);
      this.note.set(`Offers ran ${this.rounds.map((r) => fmt(r.price)).join(", ")}.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Remove cars above the offer.");
      this.note.set(`First offer ${fmt(this.rounds[0]!.price)}. Drop cars worth more, then recompute.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "auto") {
      this.since += dt;
      if (this.since > 0.9) this.advanceAuto();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Hidden quality drives out the good.");
          this.note.set("Visible quality is what rescues a market.");
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
    const a = this.intro.value;
    const qs = this.market.qualities;
    const n = qs.length;
    const step = f.w / n;
    const R = clamp(step / 2 - 4, 6, 16);
    const y = f.top + 42 + R;
    const round = this.rounds[Math.min(this.ri, this.rounds.length - 1)]!;
    const showOffer = this.beat !== "prove" || this.locked;
    if (showOffer) p.text(`offer ${fmt(round.price)}`, this.cx, f.top + 14, { font: Type.mono(14), color: c.ink, align: "center", alpha: a });
    else p.text("offer ?", this.cx, f.top + 14, { font: Type.mono(14), color: c.fog, align: "center", alpha: a });
    const count = this.beat === "prove" && !this.locked ? n : round.onSale.length;
    const maxQ = Math.max(...qs, 12);
    for (let i = 0; i < n; i++) {
      const x = f.x + step * (i + 0.5);
      const rad = R * Math.sqrt(qs[i]! / maxQ);
      const on = i < count;
      const mine = this.beat === "feel" && i === MINE;
      if (!on) p.dashedRing(x, y, Math.max(3, rad), c.ink, 0.6 * a);
      else if (mine) p.disc(x, y, rad, c.ink, 0.92 * a);
      else p.ring(x, y, rad, c.ink, 1.5, a);
      p.text(String(qs[i]), x, y + R + 14, { font: Type.mono(10), color: on ? c.fog : c.ash, align: "center", alpha: a });
    }
    if (this.beat === "prove") {
      this.sl.draw(p, c, { ticks: [2, 8, 14], text: (v) => `offer ${fmt(v)}`, alpha: a });
      const tv = this.trueAt.value;
      if (tv > 0.01) p.ring(this.sl.X(this.market.finalPrice), this.sl.y, 13, c.ink, 1.25, tv);
      for (let i = 0; i < this.puzzles.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
    } else {
      const total = this.rounds.length;
      for (let i = 0; i < total; i++) Glyph.step(p, c, this.cx - (total - 1) * 10 + i * 20, f.tickY, i < this.ri || (this.stage === "done" && i <= this.ri), i === this.ri && this.stage !== "done");
    }
  }
}
