import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { Slider, drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_PAIRS, MAX_WEEKS, PROVE_OFFERS, PROVE_TOLERANCE, SEE_OFFER, type Offer } from "./model";

type Pick = "sooner" | "later";
const when = (t: number): string => (t === 0 ? "now" : `week ${t}`);

/**
 * Feel: a smaller reward sooner or a larger one later, twice near and twice far, with the same gap.
 * See: drag the delay of the sooner reward. The two present values cross, and the choice flips.
 * Prove: two new offers. Drag the delay to where the choice flips.
 */
export class HyperbolicDiscountingGame extends Game {
  readonly slug = "hyperbolic-discounting";
  private picks: Pick[] = [];
  private round = 0;
  private waiting = false;
  private since = 0;
  private armed: Pick | null = null;
  private readonly lose = new Damped(0, 0.4);

  private reach = 0;
  private cur = 0;
  private dragging = false;
  private readonly flipMark = new Damped(0, 0.5);

  private offers: Offer[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly slider = new Slider();
  private readonly settle = new Damped(0, 0.4);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.picks = [];
    this.round = 0;
    this.waiting = false;
    this.lose.snap(0);
    this.reach = 0;
    this.cur = 0;
    this.flipMark.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.loadPair();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.picks = ["sooner", "later", "sooner", "later"];
    this.round = 4;
    this.enterSee();
    if (beat === "see") {
      this.reach = MAX_WEEKS;
      this.cur = MAX_WEEKS;
      this.check();
      this.flipMark.snap(1);
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 4 && !this.waiting;
    this.toProve.visible = this.beat === "see" && this.flipMark.target === 1;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "feel" && !this.waiting && this.round < 4) {
      if (inside(this.pair(0), x, y)) this.armed = "sooner";
      else if (inside(this.pair(1), x, y)) this.armed = "later";
    } else if (this.beat === "see" && y >= f.top && y <= f.bottom) {
      this.dragging = true;
      this.dragSee(x);
    } else if (this.beat === "prove" && !this.locked && y >= f.top && y <= f.bottom) {
      this.slider.dragging = true;
      this.slider.setFromX(x, 0.5 / MAX_WEEKS);
      this.note.set("");
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.dragSee(x);
    if (this.slider.dragging) this.slider.setFromX(x, 0.5 / MAX_WEEKS);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    this.slider.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.beat === "feel" && !this.waiting && inside(this.pair(a === "sooner" ? 0 : 1), x, y)) this.play(a);
  }

  // ---- Feel -------------------------------------------------------------

  private loadPair(): void {
    const p = FEEL_PAIRS[this.round]!;
    this.lose.snap(0);
    this.prompt.set(p.t === 0 ? "A smaller reward now, or a larger one later?" : "Both are far off. Same gap. Which?");
    this.note.set(`${p.offer.S} ${when(p.t)}, or ${p.offer.L} in ${p.offer.gap} weeks more.`);
  }

  private play(a: Pick): void {
    this.picks.push(a);
    this.waiting = true;
    this.since = 0;
    this.lose.set(1);
    this.cue("good");
    const p = FEEL_PAIRS[this.round]!;
    this.prompt.set(a === "sooner" ? "Sooner." : "Later.");
    this.note.set(a === "sooner" ? `You take ${p.offer.S} ${when(p.t)}.` : `You take ${p.offer.L} at week ${p.t + p.offer.gap}.`);
    this.announce(`Choice ${this.round + 1}. You took the ${a} reward.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.reach = 0;
    this.cur = 0;
    this.flipMark.snap(0);
    this.prompt.set("Slide the delay of the sooner reward. Watch who wins.");
    this.note.set("Discs are what each reward feels worth today.");
    this.sync();
  }

  private dragSee(x: number): void {
    const { x0, x1 } = this.plot(this.frame);
    this.cur = clamp(((x - x0) / (x1 - x0)) * MAX_WEEKS, 0, MAX_WEEKS);
    this.reach = Math.max(this.reach, this.cur);
    this.check();
  }

  private check(): void {
    if (this.flipMark.target === 0 && this.reach >= SEE_OFFER.flip + 2.5) {
      this.flipMark.set(1);
      this.cue("good");
      const flipped = this.picks[0] === "sooner" && this.picks[1] === "later";
      this.prompt.set(`The choice flips near week ${fmt(Math.round(SEE_OFFER.flip * 10) / 10)}.`);
      this.note.set(flipped ? "You flipped too: sooner near, later far." : "Most people take sooner near and later far.");
      this.announce("The preference flips as the sooner reward gets close.");
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.offers = this.env.rng.shuffle(PROVE_OFFERS);
    this.pi = 0;
    this.solved = 0;
    this.loadOffer();
    this.sync();
  }

  private loadOffer(): void {
    const o = this.offers[this.pi]!;
    this.locked = false;
    this.slider.value = 0;
    this.settle.snap(0);
    this.prompt.set(`${o.S} sooner or ${o.L} ${o.gap} weeks after. Find where it flips.`);
    this.note.set("Drag the delay until the two discs match.");
    this.sync();
  }

  private weeks(): number {
    return this.slider.value * MAX_WEEKS;
  }

  private lockIn(): void {
    const o = this.offers[this.pi]!;
    const t = this.weeks();
    if (Math.abs(t - o.flip) <= PROVE_TOLERANCE) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.settle.set(1);
      this.sync();
      this.prompt.set(`Right. It flips near week ${fmt(Math.round(o.flip * 10) / 10)}.`);
      this.note.set("Closer than that, the sooner reward wins. Further, the later one does.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.prompt.set(o.prefersSooner(t) ? "Too close. The sooner one still wins." : "Too far. The later one already wins.");
      this.note.set(`At week ${fmt(Math.round(t * 10) / 10)}: sooner ${fmt(Math.round(o.sooner(t) * 100) / 100)}, later ${fmt(Math.round(o.later(t) * 100) / 100)}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.lose.step(dt);
    this.flipMark.step(dt);
    this.settle.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 1.4) {
        this.waiting = false;
        this.round++;
        if (this.round < 4) this.loadPair();
        else {
          this.prompt.set("Four choices. Compare near and far.");
          this.note.set("");
        }
        this.sync();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.offers.length) {
          this.prompt.set("What is close is worth more than it should be.");
          this.note.set("A steady discounter never flips. A present biased one does.");
          this.finish();
        } else {
          this.pi++;
          this.loadOffer();
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

  private axis(p: Painter, c: Colors, x0: number, x1: number, y: number): void {
    p.rule(x0, y, x1, y, c.ink, 0.5);
    for (const w of [0, 4, 8, 12, 16]) {
      const x = x0 + (w / MAX_WEEKS) * (x1 - x0);
      p.rule(x, y - 4, x, y + 4, c.ink, 0.5);
      p.text(String(w), x, y + 17, { font: Type.mono(10), color: c.ash, align: "center" });
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const pr = FEEL_PAIRS[Math.min(this.round, 3)]!;
    const R = clamp((f.h - 70) / 2, 14, 36);
    const x0 = f.x + 10 + R * Math.sqrt(pr.offer.S / 8);
    const x1 = f.x + f.w - 10 - R * Math.sqrt(pr.offer.L / 8);
    const X = (w: number) => x0 + (w / MAX_WEEKS) * (x1 - x0);
    const r = (v: number) => R * Math.sqrt(v / 8);
    const yAxis = f.top + f.h / 2 + R * 0.5;
    const yd = yAxis - R - 14;
    const k = this.lose.value;
    const pick = this.picks[this.round] ?? this.picks[this.picks.length - 1];
    const chosen = this.waiting ? pick : undefined;
    const soon = chosen === "later" ? "dash" : "disc";
    const late = chosen === "sooner" ? "dash" : "disc";
    const draw = (kind: string, x: number, v: number) => {
      if (kind === "disc") p.disc(x, yd, r(v), c.ink, 0.92);
      else p.dashedRing(x, yd, r(v), c.ink, 0.5 + 0.4 * (1 - k));
    };
    draw(soon, X(pr.t), pr.offer.S);
    draw(late, X(pr.t + pr.offer.gap), pr.offer.L);
    this.axis(p, c, x0, x1, yAxis);
    p.text("weeks", this.cx, yAxis + 32, { font: Type.body(11, 400), color: c.fog, align: "center" });
    for (const i of [0, 1] as const) {
      const a: Pick = i === 0 ? "sooner" : "later";
      const al = this.waiting ? (pick === a ? 0.9 : 0.3) : 1;
      const o = pr.offer;
      drawChoice(p, c, this.pair(i), { label: a === "sooner" ? "Sooner" : "Later", sub: a === "sooner" ? `${o.S} ${when(pr.t)}` : `${o.L} at week ${pr.t + o.gap}`, r: 22 * Math.sqrt((a === "sooner" ? o.S : o.L) / 8), alpha: this.round >= 4 ? 0 : al, armed: this.armed === a });
    }
    drawTicks(p, c, f, this.cx, 4, this.round, Math.min(this.round, 3));
  }

  private plot(f: Frame): { x0: number; x1: number; yTop: number; yBot: number } {
    return { x0: f.x + 12, x1: f.x + f.w - 12, yTop: f.top + 10, yBot: f.bottom - 26 };
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const { x0, x1, yTop, yBot } = this.plot(f);
    const o = SEE_OFFER;
    const X = (w: number) => x0 + (w / MAX_WEEKS) * (x1 - x0);
    const Y = (v: number) => yBot - (v / o.S) * (yBot - yTop) * 0.92;
    p.rule(x0, yBot, x1, yBot, c.ink, 0.5);
    p.rule(x0, yTop, x0, yBot, c.ink, 0.5);
    p.text("0", x0, yBot + 17, { font: Type.mono(10), color: c.ash });
    p.text("weeks", x1, yBot + 17, { font: Type.body(11, 400), color: c.fog, align: "right" });
    const curve = (fn: (t: number) => number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * this.reach;
        pts.push([X(t), Y(fn(t))]);
      }
      return pts;
    };
    if (this.reach > 0.05) {
      p.path(curve((t) => o.sooner(t)), c.ink, 1.5, 0.95);
      p.path(curve((t) => o.later(t)), c.ink, 1, 0.45);
    }
    const t = this.cur;
    p.line(X(t), yBot, X(t), Y(Math.max(o.sooner(t), o.later(t))), c.ink, 0.5, 0.35, [2, 4]);
    p.disc(X(t), Y(o.sooner(t)), 5, c.ink);
    p.ring(X(t), Y(o.later(t)), 5, c.ink, 1.5);
    const k = this.flipMark.value;
    if (k > 0.01) {
      p.line(X(o.flip), yBot, X(o.flip), Y(o.sooner(o.flip)), c.ink, 1, 0.8 * k, [4, 4]);
      p.text("flip", X(o.flip), yBot + 17, { font: Type.body(12, 400), color: c.ink, align: "center", alpha: k });
    }
    drawTicks(p, c, f, this.cx, 2, this.flipMark.target === 1 ? 2 : this.reach > 0.5 ? 1 : 0, this.flipMark.target === 1 ? 1 : 0);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const o = this.offers[Math.min(this.pi, this.offers.length - 1)]!;
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const t = this.weeks();
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / o.S);
    p.disc(xl, cy, r(o.sooner(t)), c.ink, 0.92);
    p.ring(xr, cy, r(o.later(t)), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text(`Sooner ${fmt(Math.round(o.sooner(t) * 100) / 100)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`Later ${fmt(Math.round(o.later(t) * 100) / 100)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    const ty = Math.min(f.bottom - 28, ly + 56);
    this.slider.place(f.x + 24, f.x + f.w - 24, ty);
    this.slider.draw(p, c);
    for (const w of [0, 8, 16]) p.text(String(w), this.slider.at(w / MAX_WEEKS), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(`Sooner arrives at week ${fmt(Math.round(t * 2) / 2)}`, this.cx, ty - 22, { font: Type.mono(11), color: c.ink, align: "center" });
    const k = this.settle.value;
    if (k > 0.01) p.line(this.slider.at(o.flip / MAX_WEEKS), ty - 14, this.slider.at(o.flip / MAX_WEEKS), ty + 14, c.ink, 1, k);
    drawTicks(p, c, f, this.cx, this.offers.length, this.solved, this.pi);
  }
}
