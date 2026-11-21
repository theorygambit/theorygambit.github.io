import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { Beauty, FEEL_BEAUTY, PROVE_POOL, PROVE_TOLERANCE } from "./model";

const ROUNDS = 2;
const LEVELS = 5;
const COUNTS = [4, 7, 6, 3];
const frac = (p: number): string => (Math.abs(p - 2 / 3) < 1e-9 ? "2/3" : Math.abs(p - 0.5) < 1e-9 ? "1/2" : fmt(p));

/**
 * Feel: guess against a crowd. The winner is closest to a fraction of the average.
 * See: climb the ladder of levels. Level 0 guesses 50, each next level takes the fraction.
 * Prove: a new fraction. Drag to what a level 2 thinker would guess.
 */
export class BehavioralGameTheoryGame extends Game {
  readonly slug = "behavioral-game-theory";
  private b: Beauty = FEEL_BEAUTY;
  private ps = [2 / 3, 0.5];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private guess = 0;
  private since = 0;
  private readonly crowd = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private rung = 0;
  private readonly lit: Damped[] = Array.from({ length: LEVELS }, () => new Damped(0, 0.4));

  private readonly sl = new Slider();
  private dragging = false;
  private cases: Beauty[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly go = this.add(new CanvasButton("Guess", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    this.b = new Beauty(this.ps[this.round]!);
    this.sl.range(0, 100, 1);
    this.sl.value = 30;
    this.crowd.snap(0);
    this.prompt.set(`Guess 0 to 100. Closest to ${frac(this.b.p)} of the average wins.`);
    this.note.set(this.round === 0 ? "Twenty others guess too." : "A new fraction. Twenty new guessers.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.rung = LEVELS;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.go.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.go.visible = this.beat === "feel" && this.stage === "choose";
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.rung >= LEVELS;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") return this.climb();
    const live = (this.beat === "feel" && this.stage === "choose") || (this.beat === "prove" && !this.locked);
    if (live && this.sl.hit(x, y)) {
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

  private commit(): void {
    if (this.stage !== "choose") return;
    this.guess = this.sl.value;
    this.stage = "wait";
    this.since = 0;
    this.crowd.set(1);
    this.cue("good");
    this.sync();
  }

  private reveal(): void {
    const t = this.b.target;
    const off = Math.abs(this.guess - t);
    this.stage = "result";
    this.round++;
    this.prompt.set(off <= 5 ? "Close. You were near the winner." : this.guess > t ? "Too high. The crowd stayed near the top." : "Too low. You went further than the crowd.");
    this.note.set(`Average ${fmt(this.b.average)}. ${frac(this.b.p)} of it is ${fmt(t)}. You were ${fmt(off)} off.`);
    this.announce(`The crowd averaged ${fmt(this.b.average)}, so the winning number was ${fmt(t)}. You guessed ${this.guess}.`);
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
    this.b = FEEL_BEAUTY;
    this.rung = 0;
    for (const d of this.lit) d.snap(0);
    this.sl.range(0, 100, 1);
    this.prompt.set("Tap. Level 0 guesses 50.");
    this.note.set("Then each level takes 2/3 of the one before.");
    this.sync();
  }

  private climb(): void {
    if (this.rung >= LEVELS) return;
    const k = this.rung;
    this.lit[k]!.set(1);
    this.rung++;
    this.cue("good");
    const v = this.b.level(k);
    this.note.set(k === 0 ? "Level 0 guesses 50, without thinking." : `Level ${k} guesses 2/3 of ${fmt(this.b.level(k - 1))}, which is ${fmt(v)}.`);
    if (this.rung >= LEVELS) {
      this.prompt.set("Each step ends nearer zero.");
      this.note.set("Perfect logic reaches 0. Most crowds stop at one or two steps.");
      this.announce("Each level guesses lower. Perfect reasoning reaches zero, but most crowds stop after one or two steps.");
    } else this.prompt.set(k === 0 ? "One step ahead." : "One step further.");
    this.sync();
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
    this.b = c;
    this.sl.range(0, 100, 1);
    this.sl.value = 25;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(`The fraction is ${fmt(c.p)}. What does a level 2 thinker guess?`);
    this.note.set("Level 0 guesses 50, the ring.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const x = this.sl.value;
    const want = c.level(2);
    const ok = Math.abs(x - want) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. Level 2 guesses ${fmt(want)}.`);
      this.note.set(`50 x ${fmt(c.p)} x ${fmt(c.p)} = ${fmt(want)}.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Take the fraction twice.");
      this.note.set(`Level 1 guesses ${fmt(c.level(1))}. Level 2 takes ${fmt(c.p)} of that.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.crowd.step(dt);
    this.trueAt.step(dt);
    for (const d of this.lit) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Think a step or two beyond the crowd.");
          this.note.set("Not infinitely many. People rarely go that far.");
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
    else if (this.beat === "see") this.drawLadder(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const t = this.crowd.value;
    const y = this.sl.y;
    if (t > 0.02) {
      for (let k = 0; k < COUNTS.length; k++) {
        const x = this.sl.X(this.b.level(k));
        for (let i = 0; i < COUNTS[k]!; i++) p.ring(x, y - 22 - i * 11, 4.5, c.ink, 1.25, t * a);
      }
    }
    this.sl.draw(p, c, { ticks: [0, 50, 100], text: (v) => `guess ${v}`, showValue: this.stage === "choose", alpha: a });
    if (this.stage === "result" && t > 0.02) p.dashedRing(this.sl.X(this.b.target), y, 12, c.ink, 0.9);
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawLadder(p: Painter, c: Colors, f: Frame): void {
    const y = this.sl.y - 20;
    p.rule(this.sl.x0, y, this.sl.x1, y, c.ink, 0.5);
    for (const v of [0, 50, 100]) p.text(String(v), this.sl.X(v), y + 24 + 12, { font: Type.mono(10), color: c.ash, align: "center" });
    for (let k = 0; k < LEVELS; k++) {
      const t = this.lit[k]!.value;
      const x = this.sl.X(this.b.level(k));
      p.disc(x, y, 2, c.ink, 0.35 * (1 - t));
      if (t < 0.02) continue;
      if (k === 0) p.disc(x, y, 8 * t, c.ink, 0.92);
      else p.ring(x, y, 8 * t, c.ink, 1.5, 1);
      const up = k % 2 === 0;
      p.text(fmt(this.b.level(k)), x, up ? y - 18 : y + 24, { font: Type.mono(10), color: c.fog, align: "center", alpha: t });
    }
    for (let i = 0; i < LEVELS; i++) Glyph.step(p, c, this.cx - (LEVELS - 1) * 10 + i * 20, f.tickY, i < this.rung, i === this.rung);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const y = this.sl.y;
    p.ring(this.sl.X(50), y - 50, 7, c.ink, 1.5, 1);
    this.sl.draw(p, c, { ticks: [0, 50, 100], text: (v) => `guess ${v}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(this.b.level(2)), y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
