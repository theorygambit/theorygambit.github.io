import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { drawTicks } from "../shared/kit";
import { feelRounds, proveSet, type Puzzle, type Spread } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: four rows of options and a stranger you cannot talk to. Pick the one they will pick.
 * See: where a hundred strangers went in each row. The player taps through them.
 * Prove: three new rows. Tap the one most strangers would pick.
 */
export class FocalPointsGame extends Game {
  readonly slug = "focal-points";
  private rounds: Spread[] = [];
  private mine: number[] = [];
  private theirs: number[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private readonly pairs = new Damped(0, 0.35);

  private si = 0;
  private readonly crowd = new Damped(0, 0.5);

  private puzzles: Puzzle[] = [];
  private pi = 0;
  private solved = 0;
  private wrongAt = -1;
  private locked = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.rounds = feelRounds(this.env.rng);
    this.mine = [];
    this.theirs = [];
    this.round = 0;
    this.stage = "choose";
    this.pairs.snap(0);
    this.si = 0;
    this.crowd.snap(0);
    this.pi = 0;
    this.solved = 0;
    this.locked = false;
    this.setBeat("feel");
    this.prompt.set("Pick the one they will pick. You cannot talk.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.rounds.forEach((s, i) => {
      this.mine.push(i % 5);
      this.theirs.push(s.pick(this.env.rng));
    });
    this.round = 4;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 4 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.si === 3 && this.crowd.target === 1;
  }

  // ---- Geometry ---------------------------------------------------------

  private slot(n: number, f: Frame): number {
    return f.w / n;
  }

  private radius(n: number, f: Frame): number {
    return clamp(Math.min(this.slot(n, f) * 0.2, f.h / 11), 8, 17);
  }

  private slotX(i: number, n: number, f: Frame): number {
    return f.x + (i + 0.5) * this.slot(n, f);
  }

  private pickAt(x: number, y: number, n: number): number | null {
    const f = this.frame;
    if (y < f.top || y > f.bottom || x < f.x || x > f.x + f.w) return null;
    return clamp(Math.floor((x - f.x) / this.slot(n, f)), 0, n - 1);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        const i = this.pickAt(x, y, 5);
        if (i !== null) this.play(i);
      } else if (this.stage === "result" && this.round < 4) this.nextRound();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      const pz = this.puzzles[this.pi]!;
      const i = this.pickAt(x, y, pz.spread.size);
      if (i !== null) this.answer(i);
    }
  }

  // ---- Feel -------------------------------------------------------------

  private play(i: number): void {
    const s = this.rounds[this.round]!;
    this.mine.push(i);
    this.theirs.push(s.pick(this.env.rng));
    this.stage = "wait";
    this.since = 0;
    this.pairs.snap(0);
    this.prompt.set(this.round === 0 ? "They are choosing too." : "Waiting for them.");
    this.note.set("");
    this.sync();
  }

  private revealRound(): void {
    const s = this.rounds[this.round]!;
    const me = this.mine[this.round]!;
    const th = this.theirs[this.round]!;
    const hit = me === th;
    const odds = s.shares()[me]!;
    this.pairs.set(1);
    this.cue(hit ? "good" : "bad");
    this.note.set(hit ? `Matched. The chance they picked yours was ${pct(odds)}.` : `Missed. The chance they picked yours was ${pct(odds)}.`);
    this.announce(`Round ${this.round + 1}. ${hit ? "You matched." : "You missed."} The chance of a match with your pick was ${pct(odds)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 4 ? "Four rows. Which rows were easy?" : "Tap for the next row.");
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.pairs.snap(0);
    this.note.set("");
    this.prompt.set("Again. Pick what they will pick.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.si = 0;
    this.crowd.snap(0);
    this.prompt.set("Tap to send a hundred strangers into this row.");
    this.note.set("Your pick is the dot above the row.");
    this.sync();
  }

  private advance(): void {
    if (this.crowd.target === 0) {
      this.crowd.set(1);
      const s = this.rounds[this.si]!;
      const lead = s.focal();
      this.prompt.set(lead === null ? "Nothing stands out. They scatter." : "One stands out. They gather on it.");
      this.note.set(`Chance two strangers match: ${pct(s.matchChance())}.`);
      this.announce(`Row ${this.si + 1}. Chance two strangers match: ${pct(s.matchChance())}.`);
    } else if (this.si < 3) {
      this.si++;
      this.crowd.snap(0);
      this.prompt.set("Tap to send them into the next row.");
      this.note.set("Your pick is the dot above the row.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.locked = false;
    this.wrongAt = -1;
    this.reveal.snap(0);
    this.prompt.set(this.pi === 0 ? "New row. Tap the one most strangers pick." : "Another row. Which one wins the crowd?");
    this.note.set("");
    this.sync();
  }

  private answer(i: number): void {
    const pz = this.puzzles[this.pi]!;
    if (i === pz.answer) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrongAt = -1;
      this.reveal.set(1);
      this.prompt.set("Right. The one that is most alone wins.");
      this.note.set(`${pct(pz.spread.shares()[i]!)} of strangers pick it.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.wrongAt = i;
      const same = pz.spread.count(i);
      this.prompt.set("Not that one. Look for the one alone.");
      this.note.set(`${pct(pz.spread.shares()[i]!)} would pick it. ${same === 1 ? "It is alone, but another is more unusual." : `${same - 1} others look just like it.`}`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.pairs.step(dt);
    this.crowd.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.revealRound();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Without a word, the odd one out is the answer.");
          this.note.set("Focal points work because everyone expects everyone else to see them.");
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

  private mark(p: Painter, c: Colors, s: Spread, i: number, x: number, y: number, r: number, alpha = 1): void {
    const m = s.marks[i]!;
    const rr = m.big ? Math.min(r * 1.6, this.slot(s.size, this.frame) * 0.4) : r;
    if (m.ring) p.ring(x, y, rr, c.ink, 1.5, alpha);
    else p.disc(x, y, rr, c.ink, 0.92 * alpha);
  }

  private row(p: Painter, c: Colors, s: Spread, f: Frame, y: number, alpha = 1, skip = -1): void {
    const r = this.radius(s.size, f);
    for (let i = 0; i < s.size; i++) this.mark(p, c, s, i, this.slotX(i, s.size, f), y, r, i === skip ? alpha * 0.3 : alpha);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const shown = this.stage === "result" ? this.round - 1 : this.round;
    const sp = this.rounds[Math.max(0, Math.min(shown, 3))]!;
    const rBig = this.radius(5, f) * 1.6;
    const yI = f.top + f.h / 2 - 14;
    const yM = yI + rBig + 18;
    const idle = this.stage === "wait" ? 0.55 + 0.45 * Math.sin(this.time * 9) : 1;
    this.row(p, c, sp, f, yI, idle);
    const k = this.pairs.value;
    if (k > 0.01 && this.mine[shown] !== undefined) {
      const me = this.mine[shown]!;
      const th = this.theirs[shown]!;
      const xm = this.slotX(me, 5, f);
      const xt = this.slotX(th, 5, f);
      p.disc(xm, yM, 4.5, c.ink, k);
      p.ring(xt, yM, 8, c.ink, 1.5, k);
      if (me === th) p.text("both", xm, yM + 24, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: k });
      else {
        p.text("you", xm, yM + 24, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: k });
        p.text("they", xt, yM + 24, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: k });
      }
    }
    drawTicks(p, c, f, this.cx, 4, this.round, this.round);
  }

  /** Where a crowd goes: one ring per option, its area the share of the crowd. */
  private crowdRings(p: Painter, c: Colors, s: Spread, f: Frame, yC: number, rc: number, a: number): void {
    const sh = s.shares();
    const top = Math.max(...sh);
    for (let i = 0; i < s.size; i++) p.ring(this.slotX(i, s.size, f), yC, rc * Math.sqrt(sh[i]! / top) * a, c.ink, 1.5, 0.95);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const s = this.rounds[this.si]!;
    const n = s.size;
    const r = this.radius(n, f);
    const rBig = r * 1.6;
    const rc = clamp(Math.min(this.slot(n, f) * 0.46, (f.h - 2 * rBig - 62) / 2), 10, 36);
    const group = 10 + 2 * rBig + 12 + 2 * rc + 24;
    const yI = f.top + Math.max(0, (f.h - group) / 2) + 10 + rBig;
    const yC = yI + rBig + 12 + rc;
    const a = this.crowd.value;
    this.row(p, c, s, f, yI);
    p.disc(this.slotX(this.mine[this.si]!, n, f), yI - rBig - 8, 3, c.ink);
    if (a > 0.01) {
      this.crowdRings(p, c, s, f, yC, rc, a);
      p.text(`${pct(s.matchChance())} match`, this.cx, yC + rc + 17, { font: Type.mono(12), color: c.ink, align: "center", alpha: a });
    }
    drawTicks(p, c, f, this.cx, 4, this.si + (this.crowd.target === 1 ? 1 : 0), this.si);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const pz = this.puzzles[Math.min(this.pi, this.puzzles.length - 1)]!;
    const s = pz.spread;
    const n = s.size;
    const r = this.radius(n, f);
    const rBig = r * 1.6;
    const a = this.reveal.value;
    const room = f.h - (rBig * 2 + 30);
    const rc = clamp(Math.min(this.slot(n, f) * 0.44, room / 2), 10, 30);
    const yI = f.top + f.h / 2 - (a > 0.01 ? rc + 4 : 0);
    this.row(p, c, s, f, yI, 1, this.wrongAt);
    if (a > 0.01) this.crowdRings(p, c, s, f, yI + rBig + 12 + rc, rc, a);
    drawTicks(p, c, f, this.cx, this.puzzles.length, this.solved, this.pi);
  }
}
