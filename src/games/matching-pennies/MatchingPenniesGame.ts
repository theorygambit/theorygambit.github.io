import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import type { Rng } from "../../core/Rng";
import { inside } from "../shared/MatrixView";
import { PatternPredictor, expectedScore, randomRun, statsOf, type PenniesStats, type Side } from "./model";

const ROUNDS = 16;
const FLIPS = 10;
const SIDE = ["Left", "Right"] as const;

/** One column pair of marks per round: your move as a disc, its guess as a ring. A ring around a disc means it caught you. */
class Timeline {
  private readonly rows: { move: Side; guess: Side; a: Damped }[] = [];

  add(move: Side, guess: Side): void {
    this.rows.push({ move, guess, a: new Damped(0, 0.25).set(1) });
  }

  clear(): void {
    this.rows.length = 0;
  }

  get length(): number {
    return this.rows.length;
  }

  step(dt: number): void {
    for (const r of this.rows) r.a.step(dt);
  }

  draw(p: Painter, c: Colors, xs: [number, number], top: number, rowH: number, alpha = 1): void {
    let prev: { x: number; y: number } | null = null;
    this.rows.forEach((r, i) => {
      const y = top + i * rowH + rowH / 2;
      const x = xs[r.move];
      const a = r.a.value * alpha;
      if (prev) p.line(prev.x, prev.y, x, y, c.ink, 1, 0.22 * a);
      prev = { x, y };
      const caught = r.guess === r.move;
      const rr = Math.min(8, rowH * 0.46);
      p.ring(xs[r.guess], y, caught ? rr : rr * 0.72, c.ink, 1.25, (caught ? 1 : 0.55) * a);
      p.disc(x, y, Math.min(3.5, rowH * 0.28), c.ink, a);
    });
  }
}

/**
 * Feel: sixteen rounds against a pattern reader that guesses before it sees your move.
 * See: your own numbers. How often it caught you, how you repeat, and why 50/50 is the only safe mix.
 * Prove: ten rounds where chance plays for you, then a thousand round run that settles at one half.
 */
export class MatchingPenniesGame extends Game {
  readonly slug = "matching-pennies";
  private readonly feelTL = new Timeline();
  private readonly proveTL = new Timeline();
  private predictor!: PatternPredictor;
  private coin!: Rng;
  private fm: Side[] = [];
  private fg: Side[] = [];
  private stats: PenniesStats | null = null;
  private armed: 0 | 1 | 2 | null = null;
  private flips = 0;
  private proveCaught = 0;
  private seeStep = 0;
  private readonly panelA = new Damped(0, 0.5);
  private readonly panelB = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);
  private run: number[] = [];
  private readonly runT = new Damped(0, 0.9);
  private running = false;
  private runDone = 0;
  private runTime = 0;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly runBtn = this.add(new CanvasButton("Run 1000", () => this.startRun(), "primary"));

  begin(): void {
    this.predictor = new PatternPredictor(this.env.rng.fork("predictor"));
    this.coin = this.env.rng.fork("coin");
    this.feelTL.clear();
    this.proveTL.clear();
    this.fm = [];
    this.fg = [];
    this.stats = null;
    this.flips = 0;
    this.proveCaught = 0;
    this.seeStep = 0;
    this.running = false;
    this.runDone = 0;
    this.runT.snap(0);
    this.panelA.snap(0);
    this.panelB.snap(0);
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Pick Left or Right. It tries to match you.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < ROUNDS; i++) this.record(((i % 2) ^ (i % 5 === 4 ? 1 : 0)) as Side);
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" || this.beat === "prove" ? (this.compact ? 64 : 80) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.runBtn.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.fm.length >= ROUNDS;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.runBtn.visible = this.beat === "prove" && this.flips >= FLIPS && !this.running && this.runDone === 0;
  }

  private zone(i: 0 | 1 | 2): { x: number; y: number; w: number; h: number } {
    if (i === 2) {
      const f = this.frame;
      return { x: f.x, y: f.actionY, w: f.w, h: f.actionH };
    }
    return this.pair(i);
  }

  private get xs(): [number, number] {
    return [this.cx - this.frame.w * 0.2, this.cx + this.frame.w * 0.2];
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.fm.length < ROUNDS) {
      if (inside(this.zone(0), x, y)) this.armed = 0;
      else if (inside(this.zone(1), x, y)) this.armed = 1;
    } else if (this.beat === "prove" && this.flips < FLIPS) {
      if (inside(this.zone(2), x, y)) this.armed = 2;
    } else if (this.beat === "see") this.advance();
  }

  protected override onUp(x: number, y: number): void {
    const p = this.armed;
    this.armed = null;
    if (p === null || !inside(this.zone(p), x, y)) return;
    if (this.beat === "feel" && p !== 2) this.playFeel(p);
    else if (this.beat === "prove" && p === 2) this.flip();
  }

  // ---- Feel -------------------------------------------------------------

  private record(move: Side): void {
    const guess = this.predictor.predict();
    this.fm.push(move);
    this.fg.push(guess);
    this.feelTL.add(move, guess);
    this.predictor.observe(move);
  }

  private playFeel(move: Side): void {
    this.record(move);
    const n = this.fm.length;
    const caught = this.fm.filter((m, i) => m === this.fg[i]).length;
    this.note.set(`It caught ${caught} of ${n}.`);
    if (n === 1) this.prompt.set("Keep going. Watch the rings.");
    if (n >= ROUNDS) {
      this.prompt.set("Sixteen rounds. It has been reading you.");
      this.announce(`It caught ${caught} of ${n} rounds.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.stats = statsOf(this.fm, this.fg);
    this.seeStep = 0;
    this.panelA.snap(0);
    this.panelB.snap(0);
    const s = this.stats;
    this.prompt.set(`It guessed ${s.caughtCount} of ${s.rounds}. A fair coin gets half.`);
    this.note.set("Tap to see why.");
    this.announce(`It guessed ${s.caughtCount} of ${s.rounds}. A fair coin gets half.`);
    this.sync();
  }

  private advance(): void {
    if (!this.stats || this.seeStep >= 2) return;
    this.seeStep++;
    const s = this.stats;
    if (this.seeStep === 1) {
      this.panelA.set(1);
      this.prompt.set("Lean either way and a good guesser profits.");
      this.note.set(`You played Left ${Math.round(s.pLeft * 100)} percent of the time. Tap again.`);
    } else {
      this.panelB.set(1);
      this.prompt.set("Habits leak. Only a fair random mix cannot be read.");
      this.note.set("At 50/50 you are indifferent, and so is it.");
      this.announce("Only an even, unpredictable mix cannot be exploited.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.predictor = new PatternPredictor(this.env.rng.fork("fresh"));
    this.proveTL.clear();
    this.flips = 0;
    this.proveCaught = 0;
    this.prompt.set("You cannot out think it. Let chance play. Tap Flip.");
    this.note.set("");
    this.sync();
  }

  private flip(): void {
    const move: Side = this.coin.chance(0.5) ? 0 : 1;
    const guess = this.predictor.predict();
    this.proveTL.add(move, guess);
    this.predictor.observe(move);
    if (guess === move) this.proveCaught++;
    this.flips++;
    this.note.set(`It caught ${this.proveCaught} of ${this.flips}.`);
    if (this.flips >= FLIPS) {
      this.prompt.set("Ten flips is too few to judge. Run a thousand.");
      this.note.set(`It caught ${this.proveCaught} of ${FLIPS}. Short runs are noise.`);
    }
    this.sync();
  }

  private startRun(): void {
    this.run = randomRun(1000, Math.floor(this.env.rng.next() * 1e9));
    this.running = true;
    this.runTime = 0;
    this.runT.snap(0);
    this.prompt.set("Watch it settle.");
    this.note.set("");
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.feelTL.step(dt);
    this.proveTL.step(dt);
    this.panelA.step(dt);
    this.panelB.step(dt);
    if (this.running) {
      this.runTime += dt;
      const k = clamp(this.runTime / 2.8);
      this.runT.snap(1 - (1 - k) * (1 - k));
      if (k >= 1) {
        this.running = false;
        this.runDone = 1;
        const final = this.run[this.run.length - 1]!;
        const you = this.stats ? this.stats.caught : 0.5;
        this.prompt.set("Chance holds it to half. You cannot be read.");
        this.note.set(`The coin: ${(final * 100).toFixed(1)} percent. You: ${Math.round(you * 100)} percent.`);
        this.announce(`Against a fair coin it caught ${(final * 100).toFixed(1)} percent.`);
        this.finish();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    if (this.beat === "feel") this.drawTimeline(p, c, f, this.feelTL, a);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else if (this.runDone || this.running) this.drawRun(p, c, f);
    else this.drawTimeline(p, c, f, this.proveTL, 1);
    if (this.beat === "feel") this.drawPads(p, c, f, a);
    if (this.beat === "prove" && !this.running && !this.runDone && this.flips < FLIPS) this.drawFlip(p, c, f);
  }

  private drawTimeline(p: Painter, c: Colors, f: Frame, tl: Timeline, a: number): void {
    const xs = this.xs;
    const head = f.top + 12;
    const top = f.top + 28;
    const rowH = Math.max(10, Math.min(16, (f.bottom - top - 4) / ROUNDS));
    p.text("Left", xs[0], head, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("Right", xs[1], head, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    tl.draw(p, c, xs, top, rowH, a);
    if (tl.length === 0) p.text("disc is you, ring is its guess", this.cx, top + 40, { font: Type.body(13, 300), color: c.ash, align: "center", alpha: a });
  }

  private drawPads(p: Painter, c: Colors, f: Frame, a: number): void {
    const live = this.fm.length < ROUNDS;
    for (const i of [0, 1] as const) {
      const z = this.zone(i);
      const al = live ? a : 0;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === i ? 0.08 : 0);
      p.text(SIDE[i], z.x + z.w / 2, z.y + z.h / 2, { font: Type.body(18, 400), color: c.ink, align: "center", base: "middle", alpha: al });
    }
    if (live) p.text(`${this.fm.length} of ${ROUNDS}`, this.cx, f.tickY, { font: Type.mono(12), color: c.ash, align: "center", base: "middle" });
  }

  private drawFlip(p: Painter, c: Colors, f: Frame): void {
    const z = this.zone(2);
    p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35);
    p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === 2 ? 0.08 : 0);
    const gx = z.x + z.w / 2 - 46;
    const gy = z.y + z.h / 2;
    p.ring(gx, gy, 16, c.ink, 1.5);
    const ctx = p.ctx;
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(gx, gy, 16, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.fill();
    p.text("Flip", z.x + z.w / 2 + 6, gy, { font: Type.body(18, 400), color: c.ink, align: "center", base: "middle" });
    p.text(`${this.flips} of ${FLIPS}`, this.cx, f.tickY, { font: Type.mono(12), color: c.ash, align: "center", base: "middle" });
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const s = this.stats;
    if (!s) return;
    const x0 = f.x + 14;
    const w = f.w - 28;
    const ty = f.top + 26;
    const th = clamp(f.h - 26 - 18 - 20 - 76, 40, 110);
    const a = this.panelA.value;
    if (a > 0.01) {
      const bottom = ty + th;
      p.rule(x0, ty, x0 + w, ty, c.ink, 0.25 * a);
      p.line(x0, bottom, x0 + w / 2, ty, c.ink, 1.5, a);
      p.line(x0 + w / 2, ty, x0 + w, bottom, c.ink, 1.5, a);
      p.text("Your score", x0, ty - 12, { font: Type.body(12, 400), color: c.fog, alpha: a });
      p.text("all Right", x0, bottom + 20, { font: Type.body(12, 400), color: c.fog, alpha: a });
      p.text("all Left", x0 + w, bottom + 20, { font: Type.body(12, 400), color: c.fog, align: "right", alpha: a });
      p.text("50/50", x0 + w / 2, bottom + 20, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: a });
      p.ring(x0 + w / 2, ty, 9, c.ink, 1.25, a);
      const mx = x0 + s.pLeft * w;
      const my = ty + -expectedScore(s.pLeft) * th;
      p.disc(mx, my, 6, c.ink, a);
      p.text("you", mx, my + 26, { font: Type.body(12, 400), color: c.ink, align: "center", alpha: a });
    }
    const b = this.panelB.value;
    if (b > 0.01) {
      const by0 = ty + th + 56;
      this.bar(p, c, x0, w, by0, "After Left, repeated", s.repeatAfterLeft, b);
      this.bar(p, c, x0, w, by0 + 34, "After Right, repeated", s.repeatAfterRight, b);
    }
  }

  private bar(p: Painter, c: Colors, x0: number, w: number, y: number, label: string, v: number, a: number): void {
    p.text(label, x0, y, { font: Type.body(13, 400), color: c.fog, alpha: a });
    const tx = x0 + w * 0.5;
    const tw = w * 0.3;
    p.rule(tx, y - 4, tx + tw, y - 4, c.ink, 0.25 * a);
    p.rect(tx, y - 7, Math.max(1, tw * v), 6, c.ink, 0.9 * a);
    p.line(tx + tw / 2, y - 14, tx + tw / 2, y + 4, c.ink, 1, 0.7 * a);
    p.text(`${Math.round(v * 100)}%`, x0 + w, y, { font: Type.mono(12), color: c.ink, align: "right", alpha: a });
  }

  private drawRun(p: Painter, c: Colors, f: Frame): void {
    const marginR = 44;
    const x0 = f.x + 14;
    const w = f.w - 28 - marginR;
    const top = f.top + 28;
    const h = Math.max(70, f.h - 28 - 30);
    const lo = 0.3;
    const hi = 0.8;
    const yOf = (v: number) => top + (1 - (v - lo) / (hi - lo)) * h;
    p.text("how often it guesses right", x0, f.top + 12, { font: Type.body(12, 400), color: c.fog });
    p.rule(x0, yOf(lo), x0 + w, yOf(lo), c.ink, 0.25);
    p.line(x0, yOf(0.5), x0 + w, yOf(0.5), c.ink, 1, 0.5, [3, 4]);
    p.text("50%", x0 + w + 8, yOf(0.5), { font: Type.mono(11), color: c.fog, base: "middle" });
    if (this.stats) {
      const yy = yOf(clamp(this.stats.caught, lo, hi));
      p.line(x0, yy, x0 + w, yy, c.ink, 1.25, 0.9);
      const near = Math.abs(yy - yOf(0.5)) < 16;
      p.text(`you ${Math.round(this.stats.caught * 100)}%`, x0 + w + 8, near ? yy + (yy < yOf(0.5) ? -10 : 12) : yy, { font: Type.mono(11), color: c.ink, base: "middle" });
    }
    const n = Math.max(2, Math.floor(this.run.length * clamp(this.runT.value, 0, 1)));
    const pts: [number, number][] = [];
    const stride = Math.max(1, Math.floor(n / 220));
    for (let i = 0; i < n; i += stride) pts.push([x0 + Math.sqrt(i / (this.run.length - 1)) * w, yOf(clamp(this.run[i]!, lo, hi))]);
    p.path(pts, c.ink, 1.5);
    p.text("rounds, 1 to 1000", x0 + w, yOf(lo) + 20, { font: Type.body(12, 400), color: c.fog, align: "right" });
  }
}
