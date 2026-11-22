import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { fmt } from "../shared/fmt";
import { FEEL_GAME, proveQuestions, type Folk } from "./model";

const TRIES = 4;

interface Question {
  game: Folk;
  x: number;
  y: number;
}

/**
 * Feel: drag a payoff pair and test whether a patient pair could sustain it.
 * See: three taps build the reachable shape, the punishment lines and the surviving region.
 * Prove: new payoffs. For each point, answer whether it can be sustained.
 */
export class FolkTheoremGame extends Game {
  readonly slug = "folk-theorem";
  private g: Folk = FEEL_GAME;
  private px = 4;
  private py = 4;
  private dragging = false;
  private tries = 0;
  private verdict: "outside" | "punish" | "ok" | null = null;
  private readonly flash = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private stepN = 0;
  private readonly layer = [new Damped(0, 0.5), new Damped(0, 0.5), new Damped(0, 0.5)];

  private questions: Question[] = [];
  private pi = 0;
  private done = false;
  private solved = 0;
  private wait = 0;
  private wrong = false;

  private readonly check = this.add(new CanvasButton("Test it", () => this.test()));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly yes = this.add(new CanvasButton("Sustainable", () => this.answer(true)));
  private readonly no = this.add(new CanvasButton("Not", () => this.answer(false)));

  begin(): void {
    this.g = FEEL_GAME;
    this.px = 4;
    this.py = 4;
    this.tries = 0;
    this.verdict = null;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Drag a payoff pair. Can it be sustained?");
    this.note.set("Dashed lines mark the punishment level.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.tries = TRIES;
    this.enterSee();
    if (beat === "see") return;
    this.stepN = 3;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    const a = this.pair(0);
    const b = this.pair(1);
    this.check.place(a.x, by, a.w);
    this.toSee.place(b.x, by, b.w);
    this.toProve.place(this.cx - 80, by, 160);
    this.yes.place(a.x, by, a.w);
    this.no.place(b.x, by, b.w);
  }

  private sync(): void {
    this.check.visible = this.beat === "feel";
    this.toSee.visible = this.beat === "feel" && this.tries >= 3;
    this.toProve.visible = this.beat === "see" && this.stepN >= 3;
    this.yes.visible = this.beat === "prove" && !this.done;
    this.no.visible = this.beat === "prove" && !this.done;
  }

  // ---- Geometry ---------------------------------------------------------

  private plot(f: Frame): { x0: number; y0: number; w: number; h: number; X: (x: number) => number; Y: (y: number) => number; max: number } {
    const max = this.g.T + 0.5;
    const x0 = f.x + 24;
    const w = f.w - 48;
    const y0 = f.top + 22;
    const h = Math.max(90, Math.min(200, f.h - 22 - 30));
    return { x0, y0, w, h, max, X: (x) => x0 + (x / max) * w, Y: (y) => y0 + h - (y / max) * h };
  }

  private fromPointer(px: number, py: number): void {
    const g = this.plot(this.frame);
    this.px = Math.round(clamp(((px - g.x0) / g.w) * g.max, 0, this.g.T) * 10) / 10;
    this.py = Math.round(clamp(((g.y0 + g.h - py) / g.h) * g.max, 0, this.g.T) * 10) / 10;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      const g = this.plot(this.frame);
      if (x >= g.x0 - 20 && x <= g.x0 + g.w + 20 && y >= g.y0 - 10 && y <= g.y0 + g.h + 20) {
        this.dragging = true;
        this.verdict = null;
        this.fromPointer(x, y);
      }
    } else if (this.beat === "see") this.build();
  }

  protected override onMove(x: number, y: number): void {
    if (this.dragging) this.fromPointer(x, y);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private test(): void {
    const g = this.g;
    this.tries++;
    const why = g.reason(this.px, this.py);
    this.verdict = why === null ? "ok" : why;
    this.flash.snap(0);
    this.flash.set(1);
    this.cue(why === null ? "good" : "bad");
    const pt = `(${fmt(this.px)}, ${fmt(this.py)})`;
    if (why === null) {
      this.prompt.set("Sustainable. A patient pair can hold it.");
      this.note.set(`${pt} is reachable, and both beat the punishment ${g.P}.`);
    } else if (why === "outside") {
      this.prompt.set("Not reachable. It is outside the shape.");
      this.note.set(`${pt} cannot come from mixing the four outcomes.`);
    } else {
      this.prompt.set("Reachable, but someone would break the deal.");
      this.note.set(`${pt}: one of you gets no more than the punishment ${g.P}.`);
    }
    this.announce(why === null ? "Sustainable. A patient pair can hold it." : why === "outside" ? "Not reachable, outside the shape." : "Reachable, but someone would break the deal.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.stepN = 0;
    for (const d of this.layer) d.snap(0);
    this.prompt.set("Tap. What can the pair reach at all?");
    this.note.set("Mixing the four outcomes fills a shape.");
    this.sync();
  }

  private build(): void {
    if (this.stepN >= 3) return;
    this.layer[this.stepN]!.set(1);
    this.stepN++;
    this.cue("good");
    if (this.stepN === 1) {
      this.prompt.set("That is every reachable pair.");
      this.note.set("Tap. Now the threat.");
    } else if (this.stepN === 2) {
      this.prompt.set(`No one accepts less than ${this.g.P}.`);
      this.note.set("Below the dashed lines, they would defect and take the punishment.");
    } else {
      this.prompt.set("Filled points can be sustained.");
      this.note.set("Reachable, and above the threat for both. A huge range.");
      this.announce("Any reachable payoff that beats the punishment level for both players can be sustained if they are patient.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.questions = proveQuestions(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadQuestion();
  }

  private loadQuestion(): void {
    const q = this.questions[this.pi]!;
    this.g = q.game;
    this.px = q.x;
    this.py = q.y;
    this.done = false;
    this.wrong = false;
    this.flash.snap(0);
    this.prompt.set(this.pi === 0 ? "New payoffs. Can this pair be sustained?" : "Another pair. Can it be sustained?");
    this.note.set(`Punishment level ${q.game.P}. The shape is the reachable set.`);
    this.sync();
  }

  private answer(yes: boolean): void {
    if (this.done) return;
    const q = this.questions[this.pi]!;
    const truth = q.game.sustainable(q.x, q.y);
    if (yes === truth) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.wrong = false;
      const why = q.game.reason(q.x, q.y);
      this.prompt.set(truth ? "Right. It can be sustained." : why === "outside" ? "Right. It is not reachable." : "Right. Someone would defect.");
      this.note.set(truth ? "Reachable, and above the threat for both." : why === "outside" ? "It lies outside the shape." : `One of the payoffs is no more than ${q.game.P}.`);
      this.wait = 2;
    } else {
      this.cue("bad");
      this.wrong = true;
      this.flash.snap(0);
      this.flash.set(1);
      this.prompt.set("Not quite. Check both conditions.");
      this.note.set(truth ? "It is inside the shape and above the threat for both." : "It is outside the shape, or one payoff is at or below the threat.");
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.flash.step(dt);
    for (const d of this.layer) d.step(dt);
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.questions.length) {
          this.prompt.set("Reachable and above the threat: sustainable.");
          this.note.set("The folk theorem allows very many outcomes.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadQuestion();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const g = this.g;
    const pl = this.plot(f);
    const font = Type.body(12, 400);
    p.rule(pl.x0, pl.y0 + pl.h, pl.x0 + pl.w, pl.y0 + pl.h, c.ink, 0.5 * a);
    p.rule(pl.x0, pl.y0, pl.x0, pl.y0 + pl.h, c.ink, 0.5 * a);
    p.text("their payoff", pl.x0, pl.y0 - 8, { font, color: c.fog, alpha: a });
    p.text("your payoff", pl.x0 + pl.w, pl.y0 + pl.h + 25, { font, color: c.fog, align: "right", alpha: a });
    const showHull = this.beat !== "see" || this.layer[0]!.value > 0.02;
    const hl = this.beat === "see" ? this.layer[0]!.value : 1;
    if (showHull) {
      const h = g.hull;
      for (let i = 0; i < h.length; i++) {
        const q = h[i]!;
        const r = h[(i + 1) % h.length]!;
        p.line(pl.X(q.x), pl.Y(q.y), pl.X(r.x), pl.Y(r.y), c.ink, 1.25, 0.7 * hl * a);
      }
    }
    const showThreat = this.beat === "feel" || (this.beat === "see" && this.layer[1]!.value > 0.02);
    const tl = this.beat === "see" ? this.layer[1]!.value : 1;
    if (showThreat) {
      p.line(pl.X(g.P), pl.Y(0), pl.X(g.P), pl.Y(pl.max), c.ink, 1, 0.55 * tl * a, [4, 4]);
      p.line(pl.X(0), pl.Y(g.P), pl.X(pl.max), pl.Y(g.P), c.ink, 1, 0.55 * tl * a, [4, 4]);
    }
    if (this.beat === "see") {
      const lf = this.layer[0]!.value;
      const ls = this.layer[2]!.value;
      for (let x = 0.5; x < g.T; x += 0.5) for (let y = 0.5; y < g.T; y += 0.5) {
        if (!g.feasible(x, y)) continue;
        if (g.rational(x, y)) {
          if (ls > 0.02) p.disc(pl.X(x), pl.Y(y), 2.2, c.ink, 0.85 * ls * a);
          else p.ring(pl.X(x), pl.Y(y), 2.2, c.ink, 1, 0.4 * lf * a);
        } else p.ring(pl.X(x), pl.Y(y), 2.2, c.ink, 1, 0.4 * lf * a);
      }
    }
    if (this.beat === "feel" || this.beat === "prove") {
      const x = pl.X(this.px);
      const y = pl.Y(this.py);
      p.disc(x, y, 7, c.ink, 0.95 * a);
      const t = this.flash.value;
      if (this.beat === "feel" && this.verdict && t > 0.02) {
        if (this.verdict === "ok") p.ring(x, y, 13, c.ink, 1.5, t);
        else p.dashedRing(x, y, 13, c.ink, t);
      }
      if (this.beat === "prove" && this.wrong && t > 0.02) p.dashedRing(x, y, 13, c.ink, t);
    }
    const n = this.beat === "feel" ? TRIES : 3;
    const done = this.beat === "feel" ? Math.min(this.tries, TRIES) : this.beat === "see" ? this.stepN : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
