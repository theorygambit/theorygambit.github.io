import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { BASE, FEEL_CONTEST, MAX, PROVE_TOLERANCE, crowd, pickPuzzles, type ContestPuzzle } from "./model";

const num = (v: number): string => String(Math.round(v * 10) / 10);
const ROUNDS = 3;
const RUNGS = 4;

interface Round {
  others: number[];
  mine: number;
  mean: number;
  target: number;
  winner: number;
}

/**
 * Feel: three rounds, guess two thirds of the average of twelve guesses. The crowd learns between rounds.
 * See: a ladder. Tap to think one step further and watch the guess fall toward 0. Your own guesses sit on it.
 * Prove: a new share and a crowd that has thought a few steps. Land one step beyond them.
 */
export class BeautyContestGame extends Game {
  readonly slug = "beauty-contest";
  private readonly f = FEEL_CONTEST;
  private rounds: Round[] = [];
  private round = 0;
  private stage: "set" | "wait" | "result" = "set";
  private guess = 50;
  private dragging = false;
  private since = 0;
  private readonly intro = new Damped(0, 0.7);
  private readonly handle = new Damped(50, 0.12);
  private readonly shown = new Damped(0, 0.4);

  private ladder = 0;
  private readonly rung = new Damped(50, 0.45);

  private puzzles: ContestPuzzle[] = [];
  private pi = 0;
  private pg = 50;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly crowdMark = new Damped(0, 0.4);
  private readonly trueAt = new Damped(0, 0.5);

  private readonly main = this.add(new CanvasButton("Lock in", () => this.press(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.rounds = [];
    this.round = 0;
    this.stage = "set";
    this.guess = 50;
    this.handle.snap(50);
    this.shown.snap(0);
    this.intro.snap(0).set(1);
    this.puzzles = pickPuzzles((xs) => this.env.rng.pick(xs));
    this.ladder = 0;
    this.rung.snap(BASE);
    this.solved = 0;
    this.main.label = "Lock in";
    this.setBeat("feel");
    this.prompt.set("Guess 2/3 of the average. Closest wins.");
    this.note.set("Twelve of you guess 0 to 100. Drag, then lock in.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let r = 0; r < ROUNDS; r++) this.rounds.push(this.score(crowd(this.env.rng, r), [30, 24, 15][r]!));
    this.round = ROUNDS;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      this.ladder = RUNGS;
      this.rung.snap(this.f.levelGuess(RUNGS));
      this.seeText();
      return;
    }
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.main, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    const last = this.round >= ROUNDS && this.stage === "result";
    this.main.visible = feel && !last && this.stage !== "wait";
    this.toSee.visible = feel && last;
    this.toProve.visible = this.beat === "see" && this.ladder >= RUNGS;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private line(f: Frame, share: number, floor = 46): { x0: number; x1: number; y: number; X: (v: number) => number } {
    const x0 = f.x + 24;
    const x1 = f.x + f.w - 24;
    return { x0, x1, y: Math.min(f.bottom - floor, f.top + f.h * share), X: (v) => x0 + (clamp(v, 0, MAX) / MAX) * (x1 - x0) };
  }

  private valueAt(x: number, f: Frame): number {
    const { x0, x1 } = this.line(f, 0.7);
    return Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * MAX);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, _y: number): void {
    const f = this.frame;
    if (this.beat === "feel" && this.stage === "set") {
      this.dragging = true;
      this.guess = this.valueAt(x, f);
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.pg = this.valueAt(x, f);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.guess = this.valueAt(x, this.frame);
    else if (this.beat === "prove") this.pg = this.valueAt(x, this.frame);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private score(others: number[], mine: number): Round {
    const all = [...others, mine];
    return { others, mine, mean: this.f.mean(all), target: this.f.target(all), winner: this.f.winner(all) };
  }

  private press(): void {
    if (this.stage === "set") {
      this.rounds.push(this.score(crowd(this.env.rng, this.round), this.guess));
      this.stage = "wait";
      this.since = 0;
      this.shown.snap(0);
      this.note.set("");
      this.prompt.set("Twelve guesses are in.");
      this.sync();
    } else if (this.stage === "result") {
      this.stage = "set";
      this.shown.snap(0);
      this.prompt.set("The crowd has learned. Guess again.");
      this.note.set("");
      this.main.label = "Lock in";
      this.sync();
    }
  }

  private reveal(): void {
    const r = this.rounds[this.round]!;
    const won = r.winner === r.others.length;
    const best = Math.round(r.target);
    this.stage = "result";
    this.shown.set(1);
    this.prompt.set(won ? "Closest to the target. You win." : `Not you. The target was ${best}.`);
    this.note.set(`The average was ${num(r.mean)}. Two thirds of it is ${num(r.target)}. You were ${num(Math.abs(r.mine - r.target))} off.`);
    this.announce(`Round ${this.round + 1}. You guessed ${r.mine}. The average was ${num(r.mean)} and the target ${num(r.target)}. ${won ? "You won" : "You did not win"}.`);
    this.round++;
    this.main.label = "Next";
    if (this.round >= ROUNDS) this.prompt.set(won ? "You win. Watch the target fall each round." : "Three rounds. Watch the target fall.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.ladder = 0;
    this.rung.snap(BASE);
    this.seeText();
    this.sync();
  }

  private advance(): void {
    if (this.ladder >= RUNGS) return;
    this.ladder++;
    this.rung.set(this.f.levelGuess(this.ladder));
    this.seeText();
    this.sync();
  }

  private levelOf(g: number): number {
    return Math.max(0, Math.round(Math.log(Math.max(1, g) / BASE) / Math.log(this.f.factor)));
  }

  private seeText(): void {
    const a = Math.round(this.f.levelGuess(this.ladder - 1));
    const b = Math.round(this.f.levelGuess(this.ladder));
    if (this.ladder === 0) {
      this.prompt.set("Say everyone guesses 50. Tap to think a step further.");
      this.note.set("");
    } else if (this.ladder < RUNGS) {
      this.prompt.set(`If all guess ${a}, the winner guesses ${b}.`);
      this.note.set("Tap again.");
    } else {
      const ls = this.rounds.map((r) => this.levelOf(r.mine));
      this.prompt.set("Thinking without end lands on 0.");
      this.note.set(`You stood at steps ${ls.join(", ")}. Real crowds stop early.`);
      this.announce("Each step multiplies the guess by two thirds. Without end it reaches zero.");
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.pg = 50;
    this.locked = false;
    this.crowdMark.snap(0);
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "Think one step beyond the crowd. Where do you win?" : "A new crowd. One step beyond them.");
    this.note.set("");
    this.sync();
  }

  private lockIn(): void {
    const pz = this.puzzles[this.pi]!;
    const ok = Math.abs(this.pg - pz.answer) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    const mean = BASE * Math.pow(pz.f, pz.crowdSteps);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.crowdMark.set(0);
      this.prompt.set("Right. One step past the crowd.");
      this.note.set(`The crowd averages ${num(mean)}. ${pz.label} of that is ${num(pz.answer)}.`);
      this.wait = 2;
    } else {
      this.crowdMark.set(1);
      this.prompt.set("Not quite. Find where the crowd lands.");
      this.note.set(`The crowd averages ${num(mean)}. The target is ${pz.label} of that average.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.shown.step(dt);
    this.crowdMark.step(dt);
    this.trueAt.step(dt);
    this.handle.set(this.guess);
    this.handle.step(dt);
    this.rung.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Aim one step beyond the crowd.");
          this.note.set("The winning guess is the share times what the crowd will guess.");
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

  private axis(p: Painter, c: Colors, l: { x0: number; x1: number; y: number; X: (v: number) => number }, ticks: number[], alpha = 1): void {
    p.rule(l.x0, l.y, l.x1, l.y, c.ink, 0.5 * alpha);
    for (const v of ticks) {
      p.rule(l.X(v), l.y, l.X(v), l.y + 5, c.ink, 0.5 * alpha);
      p.text(String(v), l.X(v), l.y + 27, { font: Type.mono(10), color: c.ash, align: "center", alpha });
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const l = this.line(f, 0.72);
    const rr = clamp(f.h / 42, 3.6, 5.5);
    this.axis(p, c, l, [0, 50, 100], a);
    const sh = this.shown.value;
    const cur = this.stage === "set" ? undefined : this.rounds[this.rounds.length - 1];
    const hx = l.X(this.handle.value);
    if (cur && sh > 0.01) {
      const placed: { x: number; k: number }[] = [];
      const order = cur.others.map((g, i) => ({ g, i })).sort((u, v) => u.g - v.g);
      for (const { g, i } of order) {
        const x = l.X(g);
        let k = 0;
        while (placed.some((q) => q.k === k && Math.abs(q.x - x) < 2 * rr + 1.5)) k++;
        placed.push({ x, k });
        const y = l.y - 15 - rr - k * (2 * rr + 1.5);
        p.ring(x, y, rr, c.ink, 1.25, sh);
        if (cur.winner === i) p.ring(x, y, rr + 3, c.ink, 1, sh);
      }
      const mx = l.X(cur.mean);
      const tx = l.X(cur.target);
      p.rule(mx, l.y - 6, mx, l.y + 6, c.ink, sh);
      p.dashedRing(tx, l.y, 10, c.ink, sh);
      p.text(`mean ${num(cur.mean)}`, Math.max(mx, Math.max(tx, l.x0 + 58) + 10), l.y + 42, { font: Type.body(12, 400), color: c.fog, alpha: sh });
      p.text(`target ${num(cur.target)}`, Math.max(tx, l.x0 + 58), l.y + 42, { font: Type.body(12, 400), color: c.ink, align: "right", alpha: sh });
      if (cur.winner === cur.others.length) p.ring(l.X(cur.mine), l.y, 14, c.ink, 1.25, sh);
    }
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const mine = cur && this.stage !== "set" ? cur.mine : this.guess;
    const mxp = this.stage === "set" ? hx : l.X(mine);
    p.disc(mxp, l.y, 9, c.ink, a * idle);
    if (this.stage === "set") {
      p.ring(mxp, l.y, 14, c.ink, 1, 0.35 * a);
      p.text(String(this.guess), mxp, l.y - 27, { font: Type.mono(13), color: c.ink, align: "center", alpha: a });
    }
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const l = this.line(f, 0.55, 56);
    p.rule(l.x0, l.y, l.x1, l.y, c.ink, 0.5);
    p.text("0", l.x0, l.y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100", l.x1, l.y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
    for (let k = 0; k <= RUNGS; k++) {
      const v = this.f.levelGuess(k);
      const reached = k <= this.ladder;
      const x = l.X(v);
      p.rule(x, l.y - 5, x, l.y + 5, c.ink, reached ? 0.7 : 0.3);
      if (k > 0 && k < this.ladder) p.ring(x, l.y, 5, c.ink, 1.25);
      p.text(String(Math.round(v)), x, l.y + (k % 2 === 0 ? 22 : 38), { font: Type.mono(11), color: reached ? c.ink : c.ash, align: "center", alpha: reached ? 1 : 0.6 });
    }
    p.disc(l.X(this.rung.value), l.y, 8, c.ink);
    if (this.rounds.length) {
      p.text("your guesses", l.x0, l.y - 36, { font: Type.body(12, 400), color: c.fog });
      for (const r of this.rounds) p.disc(l.X(r.mine), l.y - 18, 4, c.ink);
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const pz = this.puzzles[Math.min(this.pi, this.puzzles.length - 1)]!;
    const l = this.line(f, 0.7, 52);
    p.text(`Target is ${pz.label} of the average.`, this.cx, f.top + 14, { font: Type.body(14, 400), color: c.ink, align: "center" });
    p.text(`A big crowd starts at 50, then thinks ${pz.crowdSteps} step${pz.crowdSteps > 1 ? "s" : ""}.`, this.cx, f.top + 36, { font: Type.body(13, 300), color: c.fog, align: "center" });
    this.axis(p, c, l, [0, 50, 100]);
    const cm = this.crowdMark.value;
    if (cm > 0.01) {
      const x = l.X(BASE * Math.pow(pz.f, pz.crowdSteps));
      p.ring(x, l.y, 12, c.ink, 1.25, cm);
      p.text(`crowd ${num(BASE * Math.pow(pz.f, pz.crowdSteps))}`, x, l.y + 42, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: cm });
    }
    const tv = this.trueAt.value;
    if (tv > 0.01) {
      const x = l.X(pz.answer);
      p.ring(x, l.y, 16, c.ink, 1.25, tv);
      p.text(`target ${num(pz.answer)}`, x, l.y + 42, { font: Type.mono(11), color: c.ink, align: "center", alpha: tv });
    }
    const mx = l.X(this.pg);
    p.text(String(this.pg), mx, l.y - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    p.disc(mx, l.y, 9, c.ink);
    for (let i = 0; i < this.puzzles.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
