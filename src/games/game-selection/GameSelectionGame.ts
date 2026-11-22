import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { drawTicks, fmt } from "../shared/kit";
import { FEEL_SETS, PROVE_SETS, bestArena, type Arena } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: four times you pick one of three arenas. Each shows its prize and your chance. You enter, win or lose, and see what each was worth on average.
 * See: the prizes shrink to their averages, and the order changes.
 * Prove: two new sets. Tap the arena worth most on average.
 */
export class GameSelectionGame extends Game {
  readonly slug = "game-selection";
  private sets: (readonly Arena[])[] = [];
  private picks: number[] = [];
  private round = 0;
  private stage: "choose" | "result" = "choose";
  private readonly morph = new Damped(0, 0.7);

  private phase = 0;
  private readonly seeMorph = new Damped(0, 0.8);
  private readonly best = new Damped(0, 0.5);

  private cases: (readonly Arena[])[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong = -1;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly nextBtn = this.add(new CanvasButton("Next set", () => this.nextRound(), "primary"));

  begin(): void {
    this.sets = this.env.rng.shuffle(FEEL_SETS);
    this.picks = [];
    this.round = 0;
    this.stage = "choose";
    this.morph.snap(0);
    this.phase = 0;
    this.seeMorph.snap(0);
    this.best.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Three arenas. Tap the one you will enter.");
    this.note.set("Each shows its prize and your chance to win it. Entering costs 1.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.picks = [0, 1, 2, 0];
    this.round = 3;
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
    return 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.nextBtn]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.nextBtn.visible = this.beat === "feel" && this.stage === "result" && this.round < 3;
    this.toSee.visible = this.beat === "feel" && this.stage === "result" && this.round >= 3;
    this.toProve.visible = this.beat === "see" && this.phase >= 2;
  }

  // ---- Input ------------------------------------------------------------

  private columnAt(x: number, y: number): number {
    const f = this.frame;
    if (y < f.top || y > f.bottom || x < f.x || x > f.x + f.w) return -1;
    return clamp(Math.floor(((x - f.x) / f.w) * 3), 0, 2);
  }

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      const i = this.columnAt(x, y);
      if (i >= 0) this.enter(i);
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      const i = this.columnAt(x, y);
      if (i >= 0) this.answer(i);
    }
  }

  // ---- Feel -------------------------------------------------------------

  private enter(i: number): void {
    const set = this.sets[this.round]!;
    const a = set[i]!;
    this.picks.push(i);
    const won = this.env.rng.chance(a.win);
    this.stage = "result";
    this.morph.set(1);
    this.cue(won ? "good" : "bad");
    this.prompt.set(won ? `You won ${fmt(a.prize)}.` : `You lost the ${fmt(a.cost)} you paid.`);
    const best = bestArena(set);
    this.note.set(`Average per entry: ${set.map((x) => `${x.name} ${fmt(Math.round(x.ev * 10) / 10)}`).join(", ")}.`);
    this.announce(`Arena ${a.name}. ${won ? "You won." : "You lost."} The best on average was ${set[best]!.name}.`);
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.stage = "choose";
    this.morph.snap(0);
    this.prompt.set("Three more arenas. Tap the one you will enter.");
    this.note.set("Each shows its prize and your chance to win it.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.phase = 0;
    this.seeMorph.snap(0);
    this.best.snap(0);
    this.prompt.set("These are the prizes.");
    this.note.set("Tap to weigh each prize by your chance.");
    this.sync();
  }

  private advance(): void {
    if (this.phase >= 2) return;
    this.phase++;
    if (this.phase === 1) {
      this.seeMorph.set(1);
      this.prompt.set("Prize times chance, less the entry.");
      this.note.set("The big prize shrinks. Tap again.");
    } else {
      this.best.set(1);
      const set = FEEL_SETS[0]!;
      const b = bestArena(set);
      this.prompt.set(`Arena ${set[b]!.name} is worth most.`);
      this.note.set("The best arena is rarely the biggest prize or the best odds.");
      this.announce(`Arena ${set[b]!.name} is worth most on average.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_SETS);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
    this.sync();
  }

  private loadCase(): void {
    this.locked = false;
    this.wrong = -1;
    this.morph.snap(0);
    this.prompt.set(this.pi === 0 ? "New arenas. Tap the best one to enter." : "Another set. Tap the best one.");
    this.note.set("Weigh each prize by your chance, then take off the entry.");
  }

  private answer(i: number): void {
    const set = this.cases[this.pi]!;
    const b = bestArena(set);
    if (i === b) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = -1;
      this.morph.set(1);
      this.prompt.set(`Right. ${set[b]!.name} is worth ${fmt(Math.round(set[b]!.ev * 100) / 100)} per entry.`);
      this.note.set(set.map((x) => `${x.name} ${fmt(Math.round(x.ev * 100) / 100)}`).join(", ") + ".");
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.wrong = i;
      this.prompt.set("Not quite. Weigh the prize by the chance.");
      this.note.set(`${set[i]!.name}: ${pct(set[i]!.win)} of ${fmt(set[i]!.prize)}, less ${fmt(set[i]!.cost)}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.morph.step(dt);
    this.seeMorph.step(dt);
    this.best.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Choose the game before you choose the move.");
          this.note.set("The prize you can see is not the value you can expect.");
          this.finish();
        } else {
          this.pi++;
          this.loadCase();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawSet(p, c, f, this.sets[Math.min(this.round, 3)]!, this.stage === "result" ? this.morph.value : 0, this.picks[this.round] ?? -1, -1);
    else if (this.beat === "see") this.drawSet(p, c, f, FEEL_SETS[0]!, this.seeMorph.value, -1, this.best.value > 0.01 ? bestArena(FEEL_SETS[0]!) : -1);
    else this.drawSet(p, c, f, this.cases[Math.min(this.pi, this.cases.length - 1)]!, this.morph.value, -1, this.locked ? bestArena(this.cases[this.pi]!) : -1);
    if (this.beat === "feel") drawTicks(p, c, f, this.cx, 4, this.round + (this.stage === "result" ? 1 : 0), this.round);
    else if (this.beat === "see") drawTicks(p, c, f, this.cx, 3, this.phase + 1, this.phase);
    else drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
  }

  /** Three columns. A disc shrinks from the prize to the average as `morph` rises. */
  private drawSet(p: Painter, c: Colors, f: Frame, set: readonly Arena[], morph: number, picked: number, mark: number): void {
    const slot = f.w / 3;
    const top = Math.max(...set.map((a) => a.prize));
    const R = clamp(Math.min(slot * 0.4, (f.h - 90) / 2), 14, 54);
    const cy = f.top + 24 + R;
    const r = (v: number) => R * Math.sqrt(Math.max(0.02, v) / top);
    set.forEach((a, i) => {
      const x = f.x + (i + 0.5) * slot;
      const v = a.prize + (Math.max(a.ev, 0) - a.prize) * morph;
      const dim = this.wrong === i ? 0.35 : 1;
      p.text(a.name, x, f.top + 6, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: dim });
      p.disc(x, cy, r(v), c.ink, 0.92 * dim);
      p.dashedRing(x, cy, r(a.prize), c.ink, 0.45 * morph);
      const ty = cy + R + 18;
      p.text(morph > 0.5 ? `worth ${fmt(Math.round(a.ev * 10) / 10)}` : `prize ${fmt(a.prize)}`, x, ty, { font: Type.mono(11), color: c.ink, align: "center", alpha: dim });
      p.text(`${pct(a.win)} to win`, x, ty + 16, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: dim });
      if (picked === i) p.ring(x, cy, R + 6, c.ink, 1.25, 0.9);
      if (mark === i) p.ring(x, cy, R + 6, c.ink, 1.25, this.beat === "see" ? this.best.value : 0.9);
    });
  }
}
