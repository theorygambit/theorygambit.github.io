import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { FIELD, TIT_FOR_TAT, headToHeadWins, holdAllScore, pay, proveReadings, tournament, type Move, type Reading } from "./model";

const ROUNDS_FEEL = 6;

/**
 * Feel: six rounds against a partner whose rule you do not know. Hold or break, and watch the totals grow.
 * See: a round robin of five rules. Tap to score each one. The one that never wins a match wins the tournament.
 * Prove: you play tit for tat against a new run of moves. Fill in your replies, forgiveness included.
 */
export class TitForTatGame extends Game {
  readonly slug = "axelrod-tit-for-tat";
  private mine: Move[] = [];
  private theirs: Move[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private armed: Move | null = null;
  private readonly you = new Damped(0, 0.4);
  private readonly they = new Damped(0, 0.4);
  private readonly steady = new Damped(0, 0.4);

  private scores: number[] = [];
  private shown = 0;
  private readonly rows: Damped[] = FIELD.map(() => new Damped(0, 0.5));
  private readonly crown = new Damped(0, 0.6);

  private readings: Reading[] = [];
  private pi = 0;
  private solved = 0;
  private entry: (Move | null)[] = [];
  private locked = false;
  private wait = 0;
  private bad = -1;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly check = this.add(new CanvasButton("Check", () => this.checkEntry(), "primary"));

  begin(): void {
    this.mine = [];
    this.theirs = [];
    this.round = 0;
    this.stage = "choose";
    this.you.snap(0);
    this.they.snap(0);
    this.steady.snap(0);
    this.shown = 0;
    this.rows.forEach((d) => d.snap(0));
    this.crown.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Hold or break. Six rounds with the same partner.");
    this.note.set("Break against a hold pays 5. Both break pays 1.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < ROUNDS_FEEL; i++) {
      const m: Move = i === 1 ? "break" : "hold";
      this.theirs.push(TIT_FOR_TAT.move(this.theirs, this.mine));
      this.mine.push(m);
    }
    this.round = ROUNDS_FEEL;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 6; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.check]) b.place(this.cx - 80, by, 160);
  }

  private get filled(): boolean {
    return this.entry.every((m) => m !== null);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS_FEEL && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.shown >= FIELD.length + 1;
    this.check.visible = this.beat === "prove" && !this.locked;
    this.check.enabled = this.filled;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "hold";
        else if (inside(this.pair(1), x, y)) this.armed = "break";
      } else if (this.stage === "result" && this.round < ROUNDS_FEEL) this.nextRound();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      const i = this.slotAt(x, y, 5);
      if (i >= 0) {
        this.entry[i] = this.entry[i] === "hold" ? "break" : "hold";
        this.bad = -1;
        this.note.set("");
        this.prompt.set("Tap a slot to switch hold and break.");
        this.sync();
      }
    }
  }

  protected override onUp(x: number, y: number): void {
    const m = this.armed;
    this.armed = null;
    if (m && this.beat === "feel" && this.stage === "choose" && inside(this.pair(m === "hold" ? 0 : 1), x, y)) this.play(m);
  }

  // ---- Geometry ---------------------------------------------------------

  private slotX(i: number, n: number, f: Frame): number {
    return f.x + 56 + (i + 0.5) * ((f.w - 56) / n);
  }

  private slotAt(x: number, y: number, n: number): number {
    const f = this.frame;
    const { y2 } = this.rowsY(f, true);
    if (y < y2 - 26 || y > y2 + 26 || x < f.x + 56 || x > f.x + f.w) return -1;
    return clamp(Math.floor((x - f.x - 56) / ((f.w - 56) / n)), 0, n - 1);
  }

  private rowsY(f: Frame, prove: boolean): { y1: number; y2: number } {
    if (prove) {
      const y1 = f.top + f.h * 0.3;
      return { y1, y2: y1 + Math.min(70, f.h * 0.26) };
    }
    return { y1: f.top + 14, y2: f.top + 14 + 38 };
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Move): void {
    this.theirs.push(TIT_FOR_TAT.move(this.theirs, this.mine));
    this.mine.push(m);
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Both moves at once." : "Again.");
    this.sync();
  }

  private totals(n: number): { a: number; b: number } {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      a += pay(this.mine[i]!, this.theirs[i]!);
      b += pay(this.theirs[i]!, this.mine[i]!);
    }
    return { a, b };
  }

  private reveal(): void {
    this.round++;
    const { a, b } = this.totals(this.round);
    this.you.set(a);
    this.they.set(b);
    this.steady.set(holdAllScore(this.round));
    const me = this.mine[this.round - 1]!;
    const th = this.theirs[this.round - 1]!;
    this.cue(pay(me, th) >= 3 ? "good" : "bad");
    this.stage = "result";
    this.note.set(`You ${me}, they ${th}. Totals ${a} to ${b}. Holding every round would be ${holdAllScore(this.round)}.`);
    this.announce(`Round ${this.round}. You ${me}, they ${th}. Totals ${a} to ${b}.`);
    this.prompt.set(this.round >= ROUNDS_FEEL ? "Six rounds. Where did it go wrong?" : "Tap for the next round.");
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.prompt.set("Hold or break.");
    this.note.set("");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.scores = tournament();
    this.shown = 0;
    this.rows.forEach((d) => d.snap(0));
    this.crown.snap(0);
    this.prompt.set("Five rules meet each other, ten rounds each. Tap to score them.");
    this.note.set("Each plays every rule, itself included.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= FIELD.length + 1) return;
    if (this.shown < FIELD.length) {
      this.rows[this.shown]!.set(1);
      this.shown++;
      this.note.set(`${this.shown} of ${FIELD.length} scored.`);
      if (this.shown === FIELD.length) {
        this.prompt.set("Tap once more for the winner.");
        this.note.set("Everyone is scored.");
      }
    } else {
      this.shown = FIELD.length + 1;
      this.crown.set(1);
      const wins = headToHeadWins(TIT_FOR_TAT);
      this.prompt.set("Tit for tat never won a match. It won the tournament.");
      this.note.set(`It beat ${wins} rivals head to head. Nice, firm and forgiving beat clever.`);
      this.announce("Tit for tat scored highest overall without winning any match head to head.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.readings = proveReadings(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadReading();
  }

  private loadReading(): void {
    this.locked = false;
    this.bad = -1;
    this.entry = Array.from({ length: 5 }, () => null);
    this.prompt.set(this.pi === 0 ? "You play tit for tat. Set your five replies." : "A new run. Set your five replies.");
    this.note.set("Tap a slot to hold or break.");
    this.sync();
  }

  private checkEntry(): void {
    const rd = this.readings[this.pi]!;
    const bad = this.entry.findIndex((m, i) => m !== rd.answer[i]);
    if (bad === -1) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set("Right. Nice first, then copy, and forgive.");
      this.note.set("A single hold from them and you hold again.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.bad = bad;
      this.prompt.set("One slot is off. Check the marked one.");
      const before = rd.theirs[bad - 1];
      this.note.set(bad === 0 ? "Round 1: tit for tat always opens by holding." : `Round ${bad + 1}: they ${before === "break" ? "broke" : "held"} in round ${bad}, so you ${before}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.you.step(dt);
    this.they.step(dt);
    this.steady.step(dt);
    this.crown.step(dt);
    for (const d of this.rows) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.6) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.readings.length) {
          this.prompt.set("Start nice, copy the last move, forgive.");
          this.note.set("It never wins a match, and it never gets taken advantage of for long.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadReading();
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

  private mark(p: Painter, c: Colors, x: number, y: number, mine: boolean, m: Move, r: number, alpha = 1): void {
    if (m === "hold") {
      if (mine) p.disc(x, y, r, c.ink, 0.92 * alpha);
      else p.ring(x, y, r + 1, c.ink, 1.5, alpha);
    } else {
      const w = mine ? 2 : 1.25;
      p.line(x - r, y - r, x + r, y + r, c.ink, w, alpha);
      p.line(x - r, y + r, x + r, y - r, c.ink, w, alpha);
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const { y1, y2 } = this.rowsY(f, false);
    const font = Type.body(12, 400);
    p.text("You", f.x, y1, { font, color: c.fog, base: "middle" });
    p.text("They", f.x, y2, { font, color: c.fog, base: "middle" });
    const shown = this.round;
    for (let i = 0; i < ROUNDS_FEEL; i++) {
      const x = this.slotX(i, ROUNDS_FEEL, f);
      const done = i < shown;
      if (done) {
        this.mark(p, c, x, y1, true, this.mine[i]!, 5.5);
        this.mark(p, c, x, y2, false, this.theirs[i]!, 5.5);
      } else {
        const pulse = i === this.round && this.stage !== "result" ? 0.3 + 0.2 * Math.sin(this.time * 4) : 0.12;
        p.ring(x, y1, 5, c.ink, 1, pulse);
        p.ring(x, y2, 5, c.ink, 1, pulse);
      }
    }
    const R = clamp((f.h - 66 - 8 - 24) / 2, 14, 46);
    const cy = y2 + 30 + R;
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 30);
    const off = Math.min(84, f.w / 2 - R - 30);
    if (this.steady.value > 0.5) p.dashedRing(this.cx - off, cy, r(this.steady.value), c.ink, 0.8);
    if (this.you.value > 0.5) p.disc(this.cx - off, cy, r(this.you.value), c.ink, 0.95);
    if (this.they.value > 0.5) p.ring(this.cx + off, cy, r(this.they.value), c.ink, 1.5);
    p.text(`You ${fmt(this.you.target)}`, this.cx - off, cy + R + 18, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`They ${fmt(this.they.target)}`, this.cx + off, cy + R + 18, { font: Type.body(13, 400), color: c.fog, align: "center" });
    for (const i of [0, 1] as const) {
      if (this.round >= ROUNDS_FEEL) break;
      const m: Move = i === 0 ? "hold" : "break";
      const live = this.stage === "choose";
      const chosen = this.mine[this.round - (this.stage === "result" ? 1 : 0)] === m && this.stage !== "choose";
      const al = live ? 1 : chosen ? 0.9 : this.round >= ROUNDS_FEEL ? 0 : 0.3;
      drawChoice(p, c, this.pair(i), { label: m === "hold" ? "Hold" : "Break", sub: m === "hold" ? "3 or 0" : "5 or 1", r: m === "hold" ? 16 : 22, alpha: al, armed: this.armed === m });
    }
    drawTicks(p, c, f, this.cx, ROUNDS_FEEL, this.round, this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const n = FIELD.length;
    const rowH = clamp(f.h / (n + 0.4), 26, 52);
    const top = f.top + Math.max(0, (f.h - rowH * n) / 2);
    const rMax = rowH * 0.42;
    const best = Math.max(...this.scores);
    const xd = f.x + f.w * 0.58;
    for (let i = 0; i < n; i++) {
      const y = top + (i + 0.5) * rowH;
      const a = this.rows[i]!.value;
      const s = FIELD[i]!;
      p.text(s.name, f.x, y, { font: Type.body(13, 400), color: c.ink, base: "middle", alpha: 0.5 + 0.5 * a });
      if (a < 0.01) {
        p.ring(xd, y, 3, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4 + i));
        continue;
      }
      const v = this.scores[i]!;
      const r = rMax * Math.sqrt(v / best) * a;
      p.disc(xd, y, r, c.ink, 0.92 * a);
      p.text(String(v), xd + rMax + 12, y, { font: Type.mono(12), color: c.ink, base: "middle", alpha: a });
      const k = this.crown.value;
      if (s === TIT_FOR_TAT && k > 0.01) p.ring(xd, y, rMax + 6, c.ink, 1.25, k);
    }
    drawTicks(p, c, f, this.cx, n + 1, this.shown, Math.min(this.shown, n));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const rd = this.readings[Math.min(this.pi, this.readings.length - 1)]!;
    const { y1, y2 } = this.rowsY(f, true);
    const font = Type.body(12, 400);
    p.text("They", f.x, y1, { font, color: c.fog, base: "middle" });
    p.text("You", f.x, y2, { font, color: c.fog, base: "middle" });
    const r = clamp(f.w / 40, 7, 10);
    for (let i = 0; i < 5; i++) {
      const x = this.slotX(i, 5, f);
      p.text(String(i + 1), x, y1 - 26, { font: Type.mono(10), color: c.ash, align: "center" });
      this.mark(p, c, x, y1, false, rd.theirs[i]!, r);
      const e = this.entry[i];
      if (e) this.mark(p, c, x, y2, true, e, r);
      else p.dashedRing(x, y2, r, c.ink, 0.45 + 0.25 * Math.sin(this.time * 4 + i));
      if (this.bad === i) p.line(x - r - 2, y2 + r + 8, x + r + 2, y2 + r + 8, c.ink, 1, 0.8);
    }
    drawTicks(p, c, f, this.cx, this.readings.length, this.solved, this.pi);
  }
}
