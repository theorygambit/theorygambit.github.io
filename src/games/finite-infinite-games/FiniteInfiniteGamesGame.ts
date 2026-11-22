import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_RACE, FEEL_RALLY, Race, proveCases, type Case, type Move } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;
type Stage = "race" | "race-over" | "rally" | "rally-over";

/**
 * Feel: a race to 6 that someone wins, then a rally that has no finish and is worth its length.
 * See: the same two policies, always safe and always bold, in each game.
 * Prove: three new situations. Safe or bold, depending on which kind of game it is.
 */
export class FiniteInfiniteGamesGame extends Game {
  readonly slug = "finite-infinite-games";
  private readonly race = FEEL_RACE;
  private readonly rally = FEEL_RALLY;
  private stage: Stage = "race";
  private a = 0;
  private b = 0;
  private rounds = 0;
  private won = false;
  private points = 0;
  private length = 0;
  private broke = false;
  private waiting = false;
  private since = 0;
  private armed: Move | null = null;
  private readonly aV = new Damped(0, 0.4);
  private readonly bV = new Damped(0, 0.4);

  private shown = 0;
  private readonly cells: Damped[] = [0, 1, 2, 3].map(() => new Damped(0, 0.5));

  private cases: Case[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: Move | null = null;

  private readonly next = this.add(new CanvasButton("Next game", () => this.startRally(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.stage = "race";
    this.a = 0;
    this.b = 0;
    this.rounds = 0;
    this.won = false;
    this.points = 0;
    this.length = 0;
    this.broke = false;
    this.waiting = false;
    this.aV.snap(0);
    this.bV.snap(0);
    this.shown = 0;
    this.cells.forEach((d) => d.snap(0));
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("A race to 6. They gain 1 a round. A tie goes to them.");
    this.note.set("Safe adds 1. Bold adds 2, or nothing, half the time each.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.won = true;
    this.rounds = 5;
    this.length = 3;
    this.stage = "rally-over";
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 4; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "race-over";
    this.toSee.visible = this.beat === "feel" && this.stage === "rally-over";
    this.toProve.visible = this.beat === "see" && this.shown >= 4;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const live = (this.beat === "feel" && !this.waiting && (this.stage === "race" || this.stage === "rally")) || (this.beat === "prove" && !this.locked);
    if (live) {
      if (inside(this.pair(0), x, y)) this.armed = "safe";
      else if (inside(this.pair(1), x, y)) this.armed = "bold";
    } else if (this.beat === "see") this.advance();
  }

  protected override onUp(x: number, y: number): void {
    const m = this.armed;
    this.armed = null;
    if (!m || !inside(this.pair(m === "safe" ? 0 : 1), x, y)) return;
    if (this.beat === "feel") this.play(m);
    else if (this.beat === "prove" && !this.locked) this.answer(m);
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Move): void {
    this.waiting = true;
    this.since = 0;
    if (this.stage === "race") {
      const other: Move = m === "safe" ? "bold" : "safe";
      const mine = this.race.value(this.a, this.b, m);
      const alt = this.race.value(this.a, this.b, other);
      const gain = m === "safe" ? 1 : this.env.rng.chance(this.race.boldP) ? 2 : 0;
      this.a += gain;
      this.b += 1;
      this.rounds++;
      this.aV.set(this.a);
      this.bV.set(this.b);
      this.cue(gain > 0 ? "good" : "bad");
      this.prompt.set(m === "safe" ? "Safe: +1." : gain ? "Bold: +2." : "Bold: nothing.");
      this.note.set(`Win chance with your move: ${pct(mine)}. With the other: ${pct(alt)}.`);
    } else {
      this.length++;
      if (m === "bold") {
        this.points += 2;
        this.broke = this.env.rng.chance(this.rally.breakP);
      }
      this.cue(this.broke ? "bad" : "good");
      this.prompt.set(this.broke ? "The rally broke." : m === "bold" ? "Bold: 2 points, and it held." : "Safe: the rally holds.");
      this.note.set(this.broke ? `It lasted ${this.length} of ${this.rally.rounds}.` : `${this.length} of ${this.rally.rounds} rounds so far.`);
    }
    this.sync();
  }

  private settle(): void {
    this.waiting = false;
    if (this.stage === "race") {
      if (this.b >= this.race.goal) {
        this.won = false;
        this.stage = "race-over";
        this.prompt.set(this.a >= this.race.goal ? "A tie. It goes to them. You lost." : "They got there first. You lost.");
        this.note.set("A finite game ends, and someone has won.");
      } else if (this.a >= this.race.goal) {
        this.won = true;
        this.stage = "race-over";
        this.prompt.set("You got there first. You won.");
        this.note.set("A finite game ends, and someone has won.");
      }
      if (this.stage === "race-over") this.announce(this.won ? "You won the race." : "You lost the race.");
    } else if (this.broke || this.length >= this.rally.rounds) {
      this.stage = "rally-over";
      this.prompt.set(this.broke ? "The rally is over." : "You kept it going all six.");
      this.note.set(`It lasted ${this.length}. Safe all the way would have lasted ${this.rally.rounds}.`);
      this.announce(`The rally lasted ${this.length} of ${this.rally.rounds}.`);
    }
    this.sync();
  }

  private startRally(): void {
    this.stage = "rally";
    this.length = 0;
    this.points = 0;
    this.broke = false;
    this.prompt.set("Now a rally. No finish, only how long it lasts.");
    this.note.set("Safe keeps it going. Bold earns 2 points and may break it.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.cells.forEach((d) => d.snap(0));
    this.prompt.set("Same two policies, two games. Tap to run each.");
    this.note.set(`In the race you ${this.won ? "won" : "lost"}. The rally lasted ${this.length}.`);
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 4) return;
    this.cells[this.shown]!.set(1);
    this.shown++;
    if (this.shown === 1) this.prompt.set("Always safe in the race: it never wins.");
    else if (this.shown === 2) this.prompt.set("Always bold in the race: it wins half the time.");
    else if (this.shown === 3) this.prompt.set("Always safe in the rally: it lasts every round.");
    else {
      this.prompt.set("Bold wins a finite game and breaks an infinite one.");
      this.note.set("A win ends the game. Play does not end, so you protect it.");
      this.announce("Bold wins a race and breaks a rally.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveCases(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
    this.sync();
  }

  private raceFor(c: Case): Race {
    return c.kind === "race" ? new Race(c.goal, 0.5) : this.race;
  }

  private loadCase(): void {
    const c = this.cases[this.pi]!;
    this.locked = false;
    this.wrong = null;
    this.prompt.set(c.kind === "race" ? "A race. Safe or bold?" : "A rally, halfway. Safe or bold?");
    this.note.set(c.kind === "race" ? "First to the goal wins, and ties go to them." : "Only its length counts.");
  }

  private answer(m: Move): void {
    const c = this.cases[this.pi]!;
    if (m === c.answer) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      if (c.kind === "race") {
        const r = this.raceFor(c);
        this.prompt.set(c.answer === "bold" ? "Right. Behind, you need the risk." : "Right. Ahead, do not gamble.");
        this.note.set(`Win chance: safe ${pct(r.value(c.a, c.b, "safe"))}, bold ${pct(r.value(c.a, c.b, "bold"))}.`);
      } else {
        this.prompt.set("Right. In an infinite game, protect the play.");
        this.note.set(`Bold breaks the rally ${pct(this.rally.breakP)} of the time.`);
      }
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.wrong = m;
      this.prompt.set(c.kind === "race" ? "Not quite. Think about who has to catch up." : "Not quite. Is there a finish to win?");
      this.note.set(c.kind === "race" ? "Compare your chance to win after each move." : "A win means nothing here. Length is the goal.");
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.aV.step(dt);
    this.bV.step(dt);
    for (const d of this.cells) d.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 1.2) this.settle();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Finite games are played to win. Infinite games to keep playing.");
          this.note.set("Ask which kind you are in before you ask how to play.");
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
    if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawPlay(p, c, f);
  }

  private tracks(p: Painter, c: Colors, f: Frame, a: number, b: number, goal: number): void {
    const x0 = f.x + 56;
    const x1 = f.x + f.w - 24;
    const X = (v: number) => x0 + (Math.min(v, goal) / goal) * (x1 - x0);
    const y1 = f.top + f.h * 0.28;
    const y2 = y1 + Math.min(70, f.h * 0.3);
    const font = Type.body(12, 400);
    p.text("You", f.x, y1, { font, color: c.fog, base: "middle" });
    p.text("They", f.x, y2, { font, color: c.fog, base: "middle" });
    for (const y of [y1, y2]) {
      p.rule(x0, y, x1, y, c.ink, 0.5);
      for (let i = 0; i <= goal; i++) p.rule(X(i), y - 3, X(i), y + 3, c.ink, 0.4);
    }
    p.disc(X(a), y1, 8, c.ink);
    p.ring(X(b), y2, 8, c.ink, 1.5);
    p.text(`${goal}`, x1, y1 - 18, { font: Type.mono(11), color: c.ash, align: "center" });
    p.text(`${fmt(a)}`, X(a), y1 + 20, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`${fmt(b)}`, X(b), y2 + 20, { font: Type.mono(11), color: c.fog, align: "center" });
  }

  private rallyRow(p: Painter, c: Colors, f: Frame, length: number, rounds: number, full: boolean): void {
    const y = f.top + f.h * 0.4;
    const gap = Math.min(40, (f.w - 40) / rounds);
    const x0 = this.cx - ((rounds - 1) * gap) / 2;
    for (let i = 0; i < rounds; i++) {
      const x = x0 + i * gap;
      if (i < length) p.ring(x, y, 9, c.ink, 1.5);
      else if (full) p.dashedRing(x, y, 9, c.ink, 0.6);
    }
    p.text(`rally ${length} of ${rounds}`, this.cx, y + 32, { font: Type.mono(12), color: c.ink, align: "center" });
    p.disc(this.cx, y + 62, 5, c.ink);
    p.text(`${this.points} points`, this.cx + 14, y + 62, { font: Type.body(12, 400), color: c.fog, base: "middle" });
  }

  private drawPlay(p: Painter, c: Colors, f: Frame): void {
    const prove = this.beat === "prove";
    const cs = prove ? this.cases[Math.min(this.pi, this.cases.length - 1)]! : null;
    let showBoxes = true;
    if (prove) {
      if (cs!.kind === "race") this.tracks(p, c, f, cs!.a, cs!.b, cs!.goal);
      else this.rallyRow(p, c, f, 3, 6, false);
    } else if (this.stage === "race" || this.stage === "race-over") {
      this.tracks(p, c, f, this.aV.value, this.bV.value, this.race.goal);
      showBoxes = this.stage === "race";
    } else {
      this.rallyRow(p, c, f, this.length, this.rally.rounds, this.stage === "rally-over");
      showBoxes = this.stage === "rally";
    }
    if (showBoxes) {
      for (const i of [0, 1] as const) {
        const m: Move = i === 0 ? "safe" : "bold";
        const al = prove ? (this.wrong === m ? 0.35 : this.locked && cs!.answer !== m ? 0.3 : 1) : this.waiting ? 0.4 : 1;
        drawChoice(p, c, this.pair(i), { label: m === "safe" ? "Safe" : "Bold", sub: m === "safe" ? "+1" : "+2 or nothing", r: m === "safe" ? 10 : 14, alpha: al, armed: this.armed === m });
      }
    }
    if (prove) drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
    else drawTicks(p, c, f, this.cx, 2, this.stage === "race" || this.stage === "race-over" ? (this.stage === "race-over" ? 1 : 0) : this.stage === "rally-over" ? 2 : 1, this.stage.startsWith("race") ? 0 : 1);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const race = this.race;
    const vals = [race.always("safe"), race.always("bold"), 1, this.rally.boldLength / this.rally.rounds];
    const texts = [pct(vals[0]!), pct(vals[1]!), `${this.rally.rounds}`, fmt(Math.round(this.rally.boldLength * 10) / 10)];
    const colW = (f.w - 70) / 2;
    const rowH = Math.min(f.h * 0.36, 80);
    const R = Math.min(colW * 0.36, rowH * 0.42);
    const top = f.top + 30 + Math.max(0, (f.h - 30 - 2 * rowH) / 2 - 10);
    const font = Type.body(13, 400);
    ["Race", "Rally"].forEach((name, j) => p.text(name, f.x + 70 + (j + 0.5) * colW, f.top + 10, { font, color: c.ink, align: "center" }));
    ["always safe", "always bold"].forEach((name, i) => p.text(name, f.x, top + (i + 0.5) * rowH, { font: Type.body(12, 400), color: c.fog, base: "middle" }));
    [0, 1, 2, 3].forEach((n) => {
      const j = n < 2 ? 0 : 1;
      const i = n % 2;
      const x = f.x + 70 + (j + 0.5) * colW;
      const y = top + (i + 0.5) * rowH;
      const a = this.cells[n]!.value;
      if (a < 0.01) {
        p.ring(x, y, 4, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4 + n));
        return;
      }
      const v = n === 0 ? vals[0]! : n === 1 ? vals[1]! : n === 2 ? 1 : vals[3]!;
      if (v > 0.005) p.disc(x, y, R * Math.sqrt(v) * a, c.ink, 0.92 * a);
      p.text(texts[n === 2 ? 2 : n === 3 ? 3 : n]!, x, y + R + 14, { font: Type.mono(11), color: c.ink, align: "center", alpha: a });
    });
    drawTicks(p, c, f, this.cx, 4, this.shown, Math.min(this.shown, 3));
  }
}
