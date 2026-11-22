import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "./glyphs";
import { drawChoice, Slider } from "./kit";

export interface FeelOutcome {
  pay: number;
  alt: number;
  /** What the other side gets, drawn as a ring. */
  they?: number;
  /** Names for the filled and ring discs. Default: you, they. */
  labels?: [string, string];
  prompt: string;
  note: string;
}

export interface Verdict {
  ok: boolean;
  prompt: string;
  note: string;
}

export interface Answer {
  /** "slider" drags a value between min and max. "pick" shows two choice boxes. */
  mode: "slider" | "pick";
  min: number;
  max: number;
  step: number;
  init: number;
  labels: [string, string];
  /** How a slider value is written. */
  fmt: (v: number) => string;
}

/**
 * Shared scaffold for the Feel, See, Prove games: Feel is a run of two choice rounds with a counterfactual,
 * See is whatever the subclass draws and listens for, Prove is a set of new puzzles answered by a slider or a pick.
 * A subclass supplies the numbers, the words and the pictures. This class owns the beats, buttons and motion.
 */
export abstract class Lesson<Q> extends Game {
  // ---- Subclass contract ----
  protected abstract readonly rounds: number;
  protected abstract get choices(): [string, string];
  protected abstract readonly payMax: number;
  protected abstract feelIntro(r: number): [string, string];
  protected abstract feelPlay(r: number, i: 0 | 1): FeelOutcome;
  protected abstract seeStart(): [string, string];
  protected abstract drawSee(p: Painter, c: Colors, f: Frame): void;
  /** Pointer positions that a player would tap or drag through to finish See. Used by the playthrough. */
  abstract seeScript(): [number, number][];
  protected abstract makePuzzles(): Q[];
  protected abstract puzzleIntro(q: Q): [string, string];
  protected abstract answerSpec(q: Q): Answer;
  protected abstract judge(q: Q, v: number): Verdict;
  protected abstract drawProve(p: Painter, c: Colors, f: Frame, q: Q, v: number): void;
  protected abstract readonly closing: [string, string];

  protected seeDown(_x: number, _y: number): void {}
  protected seeMove(_x: number, _y: number): void {}
  protected feelExtra(_p: Painter, _c: Colors, _f: Frame, _r: number, _shown: number, _cy: number, _R: number): void {}
  /** Debug only: finish See without pointer input. */
  protected abstract seeFinishDebug(): void;
  /** Debug only: leave See half done, for layout states. */
  seePartialDebug(): void {}

  // ---- State ----
  protected round = 0;
  protected stage: "choose" | "shown" = "choose";
  protected armed: -1 | 0 | 1 = -1;
  protected picked: -1 | 0 | 1 = -1;
  protected seeDone = false;
  protected cases: Q[] = [];
  protected pi = 0;
  protected solved = 0;
  protected locked = false;
  protected spec: Answer = { mode: "slider", min: 0, max: 1, step: 0.01, init: 0.5, labels: ["", ""], fmt: String };
  protected v = 0;
  protected dragging = false;
  protected hold = 0;
  readonly sl = new Slider();
  protected readonly mine = new Damped(0, 0.4);
  protected readonly alt = new Damped(0, 0.4);
  protected readonly theirs = new Damped(0, 0.4);
  protected readonly show = new Damped(0, 0.5);
  protected readonly mark = new Damped(0, 0.4);
  protected lastOutcome: FeelOutcome | null = null;

  protected readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  protected readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  protected readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  protected readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < this.rounds; i++) {
      this.choose((i % 2) as 0 | 1);
      if (i < this.rounds - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.seeFinishDebug();
    this.enterProve();
  }

  /** Debug: a value the judge accepts, or one it rejects. */
  debugValue(right: boolean): number {
    const q = this.cases[this.pi]!;
    const s = this.spec;
    if (s.mode === "pick") return [0, 1].find((x) => this.judge(q, x).ok === right) ?? 0;
    for (let x = s.min; x <= s.max + 1e-9; x += s.step) {
      const r = Math.round(x / s.step) * s.step;
      if (this.judge(q, r).ok === right) return r;
    }
    return s.min;
  }

  debugAnswer(right: boolean): void {
    const x = this.debugValue(right);
    if (this.spec.mode === "pick") this.answerPick(x as 0 | 1);
    else {
      this.setValue(x);
      this.lockIn();
    }
  }

  protected override get actionH(): number {
    if (this.beat === "prove" && this.spec.mode === "slider") return 44;
    if (this.beat === "see") return 44;
    return this.compact ? 70 : 72;
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.sl.place(f.x + 30, f.x + f.w - 30, f.bottom - 34);
    this.layoutExtra();
  }

  protected layoutExtra(): void {}

  protected sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < this.rounds - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= this.rounds - 1;
    this.toProve.visible = this.beat === "see" && this.seeDone;
    this.lock.visible = this.beat === "prove" && this.spec.mode === "slider" && !this.locked;
  }

  protected box(i: 0 | 1) {
    return this.pair(i);
  }

  protected hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  protected fixValue(x: number): number {
    const s = this.spec;
    return clamp(Math.round(x / s.step) * s.step, s.min, s.max);
  }

  protected setValue(x: number): void {
    this.v = this.fixValue(x);
    this.sl.value = (this.v - this.spec.min) / (this.spec.max - this.spec.min);
    this.onValue();
  }

  /** Called when the slider value changes: update live pictures. */
  protected onValue(): void {}

  // ---- Input ----
  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : -1;
    else if (this.beat === "see") this.seeDown(x, y);
    else if (this.beat === "prove" && !this.locked) {
      if (this.spec.mode === "pick") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : -1;
      else if (y > this.sl.y - 40) {
        this.dragging = true;
        this.dragTo(x);
      }
    }
  }

  protected override onMove(x: number, y: number): void {
    if (this.beat === "see") this.seeMove(x, y);
    else if (this.dragging && this.beat === "prove" && !this.locked) this.dragTo(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = -1;
    if (a < 0 || !this.hit(a as 0 | 1, x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.choose(a as 0 | 1);
    else if (this.beat === "prove" && this.spec.mode === "pick" && !this.locked) this.answerPick(a as 0 | 1);
  }

  private dragTo(x: number): void {
    this.sl.setFromX(x);
    this.setValue(this.spec.min + this.sl.value * (this.spec.max - this.spec.min));
  }

  // ---- Feel ----
  protected startRound(): void {
    this.stage = "choose";
    this.picked = -1;
    this.show.snap(0);
    const [a, b] = this.feelIntro(this.round);
    this.prompt.set(a);
    this.note.set(b);
    this.sync();
  }

  protected choose(i: 0 | 1): void {
    const o = this.feelPlay(this.round, i);
    this.lastOutcome = o;
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(o.pay);
    this.alt.snap(0).set(o.alt);
    this.theirs.set(o.they ?? 0);
    this.prompt.set(o.prompt);
    this.note.set(o.note);
    this.announce(`${o.prompt} ${o.note}`);
    this.cue(o.pay >= o.alt ? "good" : "bad");
    this.sync();
  }

  protected nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See ----
  protected enterSee(): void {
    this.setBeat("see");
    this.seeDone = false;
    const [a, b] = this.seeStart();
    this.prompt.set(a);
    this.note.set(b);
    this.sync();
  }

  /** The subclass calls this when the player has done enough in See. */
  protected reachSee(prompt: string): void {
    if (this.seeDone) return;
    this.seeDone = true;
    this.cue("good");
    this.prompt.set(prompt);
    this.announce(prompt);
    this.sync();
  }

  // ---- Prove ----
  protected enterProve(): void {
    this.setBeat("prove");
    this.cases = this.makePuzzles();
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  protected loadPuzzle(): void {
    const q = this.cases[this.pi]!;
    this.spec = this.answerSpec(q);
    this.locked = false;
    this.picked = -1;
    this.mark.snap(0);
    this.setValue(this.spec.init);
    const [a, b] = this.puzzleIntro(q);
    this.prompt.set(a);
    this.note.set(b);
    this.sync();
  }

  protected answerPick(i: 0 | 1): void {
    this.picked = i;
    this.settle(i);
  }

  protected lockIn(): void {
    this.settle(this.v);
  }

  private settle(v: number): void {
    const q = this.cases[this.pi]!;
    const r = this.judge(q, v);
    this.mark.snap(0).set(1);
    this.cue(r.ok ? "good" : "bad");
    this.prompt.set(r.prompt);
    this.note.set(r.note);
    if (r.ok) {
      this.locked = true;
      this.solved++;
      this.hold = 2.2;
    }
    this.sync();
  }

  // ---- Loop ----
  protected tick(dt: number): void {
    for (const d of [this.mine, this.alt, this.theirs, this.show, this.mark]) d.step(dt);
    this.tickExtra(dt);
    if (this.beat === "prove" && this.locked && this.hold > 0) {
      this.hold -= dt;
      if (this.hold <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set(this.closing[0]);
          this.note.set(this.closing[1]);
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
      }
    }
  }

  protected tickExtra(_dt: number): void {}

  // ---- Draw ----
  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProveBeat(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const open = this.stage === "choose";
    ([0, 1] as const).forEach((i) => {
      drawChoice(p, c, this.pair(i), { label: this.choices[i], sub: "", r: 6, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, this.payMax) / this.payMax);
    const xl = this.lastOutcome?.they === undefined ? this.cx : this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const sv = this.show.value;
    if (open) p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    else if (sv > 0.01) {
      p.disc(xl, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.dashedRing(xl, cy, rad(this.alt.value), c.ink, 0.8 * sv);
      p.text(`${this.lastOutcome?.labels?.[0] ?? "you"} ${Math.round(this.mine.value * 10) / 10}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      if (this.lastOutcome?.they !== undefined) {
        p.ring(xr, cy, rad(this.theirs.value), c.ink, 1.5, sv);
        p.text(`${this.lastOutcome?.labels?.[1] ?? "they"} ${Math.round(this.theirs.value * 10) / 10}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      }
    }
    this.feelExtra(p, c, f, this.round, sv, cy, R);
    for (let i = 0; i < this.rounds; i++) Glyph.step(p, c, this.cx - ((this.rounds - 1) * 10) + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawProveBeat(p: Painter, c: Colors, f: Frame): void {
    const q = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    if (this.spec.mode === "pick") {
      const open = !this.locked;
      ([0, 1] as const).forEach((i) => {
        drawChoice(p, c, this.pair(i), { label: this.spec.labels[i], sub: "", r: 6, armed: this.armed === i, chosen: this.picked === i && this.locked, alpha: open ? 1 : 0.3 });
      });
    } else {
      this.sl.draw(p, c);
      p.text(this.spec.fmt(this.spec.min), this.sl.x0, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
      p.text(this.spec.fmt(this.spec.max), this.sl.x1, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    this.drawProve(p, c, f, q, this.v);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
