import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { Slider } from "../shared/Slider";
import { Challenge, FEEL_ROUNDS, FEEL_SKILL, MAX_LEVEL, MIN_LEVEL, SEE_START, STEP, TARGET, answer, isRight, proveSet, thermostat, type LevelPuzzle } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const SEE_ATTEMPTS = 8;

/**
 * Feel: pick a level six times. Too easy bores, too hard stings.
 * See: a thermostat. Each win raises the level a little and each loss lowers it more, until it settles.
 * Prove: a new player and a new target. Set the level that gives that chance of winning.
 */
export class DynamicDifficultyGame extends Game {
  readonly slug = "dynamic-difficulty";
  private readonly you = new Challenge(FEEL_SKILL);
  private round = 0;
  private wins = 0;
  private stage: "choose" | "shown" = "choose";
  private readonly fsl = new Slider().range(MIN_LEVEL, MAX_LEVEL, 1);
  private dragging = false;
  private readonly chanceV = new Damped(0.5, 0.25);
  private readonly pulse = new Damped(0, 0.5);

  private path: number[] = [];
  private marks: boolean[] = [];
  private readonly plot = new Plot({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, padL: 30, padR: 44, padT: 28, padB: 54, maxH: 220 });

  private cases: LevelPuzzle[] = [];
  private pi = 0;
  private pd = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly pplot = new Plot({ xMin: 0, xMax: 10, yMin: 0, yMax: 1.12, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private readonly reveal = new Damped(0, 0.5);

  private readonly play = this.add(new CanvasButton("Play", () => this.playIt(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly stepBtn = this.add(new CanvasButton("Play", () => this.stepSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.wins = 0;
    this.solved = 0;
    this.fsl.value = 5;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.fsl.value = 3 + (i % 4);
      this.playIt();
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    for (let i = 0; i < SEE_ATTEMPTS; i++) this.stepSee();
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.play, this.next, this.toSee, this.stepBtn, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
    this.pplot.fit(this.frame);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.play.visible = feel && this.stage === "choose";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.stepBtn.visible = this.beat === "see" && this.path.length <= SEE_ATTEMPTS;
    this.toProve.visible = this.beat === "see" && this.path.length > SEE_ATTEMPTS;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose" && this.fsl.hit(x, y)) {
      this.dragging = true;
      this.setLevel(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setPd(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setLevel(x);
    else if (this.beat === "prove") this.setPd(x);
  }

  protected override onUp(_x: number, _y: number): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.pulse.snap(0);
    this.chanceV.snap(this.you.chance(this.fsl.value));
    this.prompt.set("Pick a level. Too easy bores, too hard stings.");
    this.note.set(`Round ${this.round + 1} of ${FEEL_ROUNDS}. You win ${pct(this.you.chance(this.fsl.value))} of the time here.`);
    this.sync();
  }

  private setLevel(x: number): void {
    this.fsl.setFromX(x);
    const c = this.you.chance(this.fsl.value);
    this.chanceV.set(c);
    this.note.set(`Round ${this.round + 1} of ${FEEL_ROUNDS}. You win ${pct(c)} of the time here.`);
  }

  private playIt(): void {
    const d = this.fsl.value;
    const won = this.you.attempt(this.env.rng, d);
    if (won) this.wins++;
    this.stage = "shown";
    this.pulse.snap(0).set(1);
    this.prompt.set(won ? `Level ${d}. You won.` : `Level ${d}. You lost.`);
    this.note.set(`Won ${this.wins} of ${this.round + 1}. Level ${d - 2 >= MIN_LEVEL ? d - 2 : d + 2} would have given ${pct(this.you.chance(d - 2 >= MIN_LEVEL ? d - 2 : d + 2))}.`);
    this.announce(won ? "You won." : "You lost.");
    this.cue(won ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.path = [SEE_START];
    this.marks = [];
    this.prompt.set("Win and it gets harder. Lose and it eases.");
    this.note.set(`Start at level ${SEE_START}. Play 8 times.`);
    this.sync();
  }

  private stepSee(): void {
    if (this.path.length > SEE_ATTEMPTS) return;
    const d = this.path[this.path.length - 1]!;
    const won = this.you.attempt(this.env.rng, d);
    this.marks.push(won);
    this.path.push(thermostat(d, won, TARGET, STEP));
    this.cue(won ? "good" : "bad");
    const n = this.path.length - 1;
    if (n >= SEE_ATTEMPTS) {
      this.prompt.set("It settles where you win about 7 in 10.");
      this.note.set(`The level moves up ${Math.round((1 - TARGET) * STEP * 100) / 100} on a win and down ${Math.round(TARGET * STEP * 100) / 100} on a loss.`);
      this.announce("The level settles near where you win about 70 percent of the time.");
    } else {
      this.note.set(`Attempt ${n}: ${won ? "won" : "lost"}. Level ${Math.round(this.path[n]! * 10) / 10}.`);
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
    const c = this.cases[this.pi]!;
    this.pd = 0;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set(`Skill ${c.skill}. Aim for ${pct(c.target)} wins.`);
    this.note.set("Drag along the levels to where that holds, then lock in.");
    this.sync();
  }

  private setPd(x: number): void {
    this.pd = clamp(Math.round(this.pplot.valueAtX(x) * 10) / 10, 0, 10);
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`Level ${this.pd}.`);
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const ok = isRight(c, this.pd);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    const ch = new Challenge(c.skill).chance(this.pd);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. About ${pct(ch)} wins.`);
      this.note.set(`The level where wins reach ${pct(c.target)} is ${Math.round(answer(c) * 10) / 10}.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      this.prompt.set(ch > c.target ? "Too easy." : "Too hard.");
      this.note.set(`At level ${this.pd} you win ${pct(ch)}. The aim is ${pct(c.target)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.chanceV, this.pulse, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A thermostat for difficulty keeps wins near the target.");
          this.note.set("The right level depends on the player, so it has to follow them.");
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
    const sy = f.bottom - 40;
    this.fsl.place(f.x + 24, f.x + f.w - 24, sy);
    this.fsl.draw(p, c, { ticks: [1, 3, 5, 7, 9], label: (v) => String(v), text: (v) => String(v), alpha: this.stage === "choose" ? 1 : 0.4 });
    const R = clamp(Math.min((f.w - 60) / 2, (sy - f.top - 70) / 2), 14, 70);
    const cy = f.top + R + 6;
    p.dashedRing(this.cx, cy, R, c.ink, 0.6);
    p.disc(this.cx, cy, R * Math.sqrt(this.chanceV.value), c.ink, 0.95);
    p.text(`chance ${pct(this.chanceV.value)}`, this.cx, cy + R + 16, { font: Type.body(13, 400), color: c.fog, align: "center" });
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 50 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 4, 8, 10], xLabel: "attempt", yLabel: "level" });
    const tl = new Challenge(FEEL_SKILL).level(TARGET);
    for (let x = 0; x < 10; x += 0.5) p.line(pl.X(x), pl.Y(tl), pl.X(x + 0.25), pl.Y(tl), c.ink, 1, 0.5);
    p.text("70%", pl.right + 8, pl.Y(tl), { font: Type.body(12, 400), color: c.fog, base: "middle" });
    for (let i = 1; i < this.path.length; i++) p.line(pl.X(i - 1), pl.Y(this.path[i - 1]!), pl.X(i), pl.Y(this.path[i]!), c.ink, 1.5, 0.7);
    this.path.forEach((d, i) => {
      if (i === 0) p.disc(pl.X(0), pl.Y(d), 4, c.ink, 0.5);
      else if (this.marks[i - 1]) p.disc(pl.X(i), pl.Y(d), 4.5, c.ink);
      else p.ring(pl.X(i), pl.Y(d), 4.5, c.ink, 1.5);
    });
    for (let i = 0; i < SEE_ATTEMPTS; i++) Glyph.step(p, c, this.cx - 70 + i * 20, f.tickY, i < this.path.length - 1, i === this.path.length - 1);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const pl = this.pplot;
    const ch = new Challenge(k.skill);
    pl.axes(p, c, { xTicks: [0, 2, 4, 6, 8, 10], xLabel: "level", yLabel: "chance of winning", fmt: (v) => String(v) });
    pl.curve(p, (d) => ch.chance(d), c.ink, 1.75, 1, 60);
    for (let x = 0; x < 10; x += 0.5) p.line(pl.X(x), pl.Y(k.target), pl.X(x + 0.25), pl.Y(k.target), c.ink, 1, 0.5);
    p.text(pct(k.target), pl.right, pl.Y(k.target) - 12, { font: Type.mono(10), color: c.fog, align: "right" });
    const rv = this.reveal.value;
    if (rv > 0.01 && this.locked) p.ring(pl.X(answer(k)), pl.Y(k.target), 10, c.ink, 1.5, rv);
    if (rv > 0.01 && !this.locked) p.line(pl.X(this.pd), pl.base, pl.X(this.pd), pl.Y(ch.chance(this.pd)), c.ink, 1, 0.6 * rv, [3, 4]);
    p.disc(pl.X(this.pd), pl.Y(ch.chance(this.pd)), 7, c.ink);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
