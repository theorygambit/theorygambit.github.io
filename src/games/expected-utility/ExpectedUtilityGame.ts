import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { Slider, drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_GAMBLE, FEEL_SURES, Lottery, PROVE_GAMBLES, PROVE_TOLERANCE, utility } from "./model";

type Pick = "sure" | "gamble";

/**
 * Feel: a sure amount against a fifty fifty gamble for 100, four times. The average money always favours the gamble.
 * See: the utility curve. Average utility sits below the curve, so the gamble is worth 25 for sure.
 * Prove: two new gambles. Drag the sure amount until its utility matches the gamble's.
 */
export class ExpectedUtilityGame extends Game {
  readonly slug = "expected-utility";
  private sures: number[] = [];
  private picks: Pick[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private armed: Pick | null = null;
  private readonly youV = new Damped(0, 0.4);
  private readonly altV = new Damped(0, 0.4);
  private readonly offer = new Damped(1, 0.4);

  private seeStep = 0;
  private readonly chord = new Damped(0, 0.5);
  private readonly worth = new Damped(0, 0.5);

  private gambles: Lottery[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly slider = new Slider();
  private readonly settle = new Damped(0, 0.4);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  private get g(): Lottery {
    return FEEL_GAMBLE;
  }

  begin(): void {
    this.sures = this.env.rng.shuffle(FEEL_SURES);
    this.picks = [];
    this.round = 0;
    this.stage = "choose";
    this.youV.snap(0);
    this.altV.snap(0);
    this.offer.snap(0).set(1);
    this.seeStep = 0;
    this.chord.snap(0);
    this.worth.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("A sure amount, or a coin flip for 100?");
    this.note.set("Heads pays 100, tails pays 0. Same flip every time.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.picks = this.sures.map((s) => (s < 25 ? "gamble" : "sure"));
    this.round = 4;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
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
    this.toSee.visible = this.beat === "feel" && this.round >= 4 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "sure";
        else if (inside(this.pair(1), x, y)) this.armed = "gamble";
      } else if (this.stage === "result" && this.round < 4) this.nextRound();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked && y >= this.frame.top && y <= this.frame.bottom) {
      this.slider.dragging = true;
      this.drag(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.slider.dragging) this.drag(x);
  }

  protected override onUp(x: number, y: number): void {
    this.slider.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.beat === "feel" && this.stage === "choose" && inside(this.pair(m === "sure" ? 0 : 1), x, y)) this.play(m);
  }

  private drag(x: number): void {
    const hi = this.gambles[this.pi]!.hi;
    this.slider.setFromX(x, 1 / hi);
    this.note.set("");
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Pick): void {
    this.picks.push(m);
    this.stage = "wait";
    this.since = 0;
    this.prompt.set(m === "gamble" ? "The coin is in the air." : "Taken.");
    this.note.set("");
    this.sync();
  }

  private reveal(): void {
    const s = this.sures[this.round]!;
    const m = this.picks[this.round]!;
    const heads = this.env.rng.chance(this.g.p);
    const flip = heads ? this.g.hi : this.g.lo;
    const got = m === "sure" ? s : flip;
    const other = m === "sure" ? flip : s;
    this.youV.set(got);
    this.altV.set(other);
    this.offer.set(0);
    this.cue(got >= other ? "good" : "bad");
    this.note.set(`${m === "sure" ? "The coin would have paid" : "The sure amount was"} ${fmt(other)}. You got ${fmt(got)}.`);
    this.announce(`Round ${this.round + 1}. You got ${fmt(got)}. The other choice paid ${fmt(other)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 4 ? "Four choices. Where did you switch?" : "Tap for the next offer.");
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.youV.set(0);
    this.altV.set(0);
    this.offer.set(1);
    this.prompt.set("A sure amount, or the same coin flip for 100?");
    this.note.set("");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.chord.snap(0);
    this.worth.snap(0);
    this.prompt.set("Money has diminishing value. Utility is its square root.");
    this.note.set("Marks on the axis are your sure offers. Tap to place the coin flip.");
    this.sync();
  }

  private advance(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    if (this.seeStep === 1) {
      this.chord.set(1);
      this.prompt.set("The flip sits halfway between 0 and 100.");
      this.note.set(`Average money ${fmt(this.g.ev)}. Average utility ${fmt(this.g.eu)}. Tap again.`);
    } else {
      this.worth.set(1);
      const took = this.picks.filter((m) => m === "gamble").length;
      this.prompt.set(`Utility ${fmt(this.g.eu)} is worth ${fmt(this.g.certainty)} for sure.`);
      this.note.set(`Not ${fmt(this.g.ev)}. Take the sure offer above ${fmt(this.g.certainty)}. You gambled ${took} of ${this.picks.length}.`);
      this.announce(`The gamble is worth ${fmt(this.g.certainty)} for sure, not ${fmt(this.g.ev)}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.gambles = this.env.rng.shuffle(PROVE_GAMBLES);
    this.pi = 0;
    this.solved = 0;
    this.loadGamble();
  }

  private loadGamble(): void {
    const gm = this.gambles[this.pi]!;
    this.locked = false;
    this.slider.value = 0.5;
    this.settle.snap(0);
    this.prompt.set(`${Math.round(gm.p * 100)}% of ${gm.hi}, otherwise ${gm.lo}. Find its sure equal.`);
    this.note.set("Drag until the disc matches the ring.");
    this.sync();
  }

  private sure(): number {
    return Math.round(this.slider.value * this.gambles[this.pi]!.hi);
  }

  private lockIn(): void {
    const gm = this.gambles[this.pi]!;
    const s = this.sure();
    if (Math.abs(s - gm.certainty) <= PROVE_TOLERANCE * gm.hi) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.settle.set(1);
      this.prompt.set(`Right. About ${fmt(Math.round(gm.certainty * 10) / 10)} for sure.`);
      this.note.set(`Average money ${fmt(gm.ev)}, but utility says ${fmt(Math.round(gm.certainty * 10) / 10)}.`);
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.prompt.set(s > gm.certainty ? "Too much. The sure amount beats the gamble." : "Too little. The gamble beats it.");
      this.note.set(`A sure ${s} has utility ${fmt(Math.round(utility(s) * 100) / 100)}. The gamble has ${fmt(Math.round(gm.eu * 100) / 100)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.youV.step(dt);
    this.altV.step(dt);
    this.offer.step(dt);
    this.chord.step(dt);
    this.worth.step(dt);
    this.settle.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.gambles.length) {
          this.prompt.set("Weigh utilities, not coins.");
          this.note.set("A risk is worth less than its average when each coin matters less than the last.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadGamble();
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
    const R = clamp((f.h - 90) / 2, 20, 56);
    const cy = f.top + f.h / 2 - 10;
    const off = Math.min(84, f.w / 2 - R - 24);
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 100);
    const s = this.sures[Math.min(this.round, 3)]!;
    const o = this.offer.value;
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    if (o > 0.01 && this.stage !== "result") {
      p.disc(this.cx - off, cy, r(s) * o, c.ink, 0.92 * idle);
      p.dashedRing(this.cx + off, cy, r(this.g.hi) * o, c.ink, 0.8 * idle);
      p.text(`${fmt(s)} sure`, this.cx - off, cy + R + 20, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: o });
      p.text(`${Math.round(this.g.p * 100)}% of ${this.g.hi}`, this.cx + off, cy + R + 20, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: o });
    }
    if (this.stage === "result" || this.youV.value > 0.5) {
      if (this.altV.value > 0.5) p.dashedRing(this.cx, cy, r(this.altV.value), c.ink, 0.8);
      if (this.youV.value > 0.5) p.disc(this.cx, cy, r(this.youV.value), c.ink, 0.95);
      p.text(`You got ${fmt(this.youV.target)}`, this.cx, cy + R + 20, { font: Type.body(13, 400), color: c.fog, align: "center" });
    }
    const shown = this.stage === "result" ? this.round - 1 : this.round;
    for (const i of [0, 1] as const) {
      if (this.round >= 4) break;
      const m: Pick = i === 0 ? "sure" : "gamble";
      const live = this.stage === "choose";
      const chosen = this.picks[shown] === m && this.stage !== "choose";
      const al = live ? 1 : chosen ? 0.9 : this.round >= 4 ? 0 : 0.3;
      drawChoice(p, c, this.pair(i), { label: m === "sure" ? "Sure" : "Gamble", sub: m === "sure" ? `${fmt(s)} for sure` : "50% of 100", r: m === "sure" ? 6 + 16 * Math.sqrt(s / 100) : 16, alpha: al, armed: this.armed === m, dashed: m === "gamble" });
    }
    drawTicks(p, c, f, this.cx, 4, this.round, this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const x0 = f.x + 14;
    const x1 = f.x + f.w - 14;
    const yTop = f.top + 8;
    const yBot = f.bottom - 26;
    const X = (m: number) => x0 + (m / 100) * (x1 - x0);
    const Y = (u: number) => yBot - (u / 10) * (yBot - yTop);
    p.rule(x0, yBot, x1, yBot, c.ink, 0.5);
    p.rule(x0, yTop, x0, yBot, c.ink, 0.5);
    p.text("utility", x0 + 8, yTop + 8, { font: Type.body(11, 400), color: c.fog });
    p.text("money", x1, yBot + 17, { font: Type.body(11, 400), color: c.fog, align: "right" });
    p.text("0", x0, yBot + 17, { font: Type.mono(10), color: c.ash });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 50; i++) pts.push([X(i * 2), Y(utility(i * 2))]);
    p.path(pts, c.ink, 1.5, 0.95);
    this.picks.forEach((m, i) => {
      const x = X(this.sures[i]!);
      if (m === "sure") p.disc(x, yBot - 8, 3, c.ink, 0.9);
      else p.ring(x, yBot - 8, 3.5, c.ink, 1.25);
    });
    const k = this.chord.value;
    if (k > 0.01) {
      p.line(X(0), Y(0), X(100) , Y(10), c.ink, 1, 0.6 * k, [4, 4]);
      p.disc(X(0), Y(0), 3, c.ink, k);
      p.disc(X(100), Y(10), 3, c.ink, k);
      p.ring(X(50), Y(this.g.eu), 5, c.ink, 1.5, k);
      p.text("flip", X(50) + 10, Y(this.g.eu) + 17, { font: Type.body(11, 400), color: c.fog, alpha: k });
    }
    const w = this.worth.value;
    if (w > 0.01) {
      const xc = X(this.g.certainty);
      p.line(X(50), Y(this.g.eu), xc, Y(this.g.eu), c.ink, 1, 0.8 * w, [4, 4]);
      p.line(xc, Y(this.g.eu), xc, yBot, c.ink, 1, 0.8 * w, [4, 4]);
      p.disc(xc, yBot, 4, c.ink, w);
      p.text(fmt(this.g.certainty), xc, yBot + 17, { font: Type.mono(12), color: c.ink, align: "center", alpha: w });
    }
    drawTicks(p, c, f, this.cx, 3, this.seeStep + 1, this.seeStep);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const gm = this.gambles[Math.min(this.pi, this.gambles.length - 1)]!;
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const top = utility(gm.hi);
    const r = (u: number) => R * Math.sqrt(Math.max(0, u) / top);
    const s = this.sure();
    p.disc(xl, cy, r(utility(s)), c.ink, 0.92);
    p.ring(xr, cy, r(gm.eu), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text(`Sure ${s}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text("Gamble", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`utility ${fmt(Math.round(utility(s) * 10) / 10)}`, xl, ly + 18, { font: Type.mono(11), color: c.ash, align: "center" });
    p.text(`utility ${fmt(Math.round(gm.eu * 10) / 10)}`, xr, ly + 18, { font: Type.mono(11), color: c.ash, align: "center" });
    const ty = Math.min(f.bottom - 28, ly + 62);
    this.slider.place(f.x + 24, f.x + f.w - 24, ty);
    this.slider.draw(p, c);
    p.text("0", this.slider.at(0), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(String(gm.hi), this.slider.at(1), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    const k = this.settle.value;
    if (k > 0.01) p.dashedRing(xl, cy, r(gm.eu), c.ink, k);
    drawTicks(p, c, f, this.cx, this.gambles.length, this.solved, this.pi);
  }
}
