import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Track } from "../shared/Track";
import { Contest, FEEL_ROUNDS, FEEL_START, PUZZLES, TOLERANCE, bestFor } from "./model";

const r0 = (v: number): string => String(Math.round(v));
const WORD = (p: number): string => (p === 1 / 2 ? "half" : p === 3 / 4 ? "three quarters" : "two thirds");

/**
 * Feel: three crowds who have thought for different lengths of time. Guess a number, and the target is two
 * thirds of the crowd's average.
 * See: the ladder. Each step of "they think that I think" multiplies by two thirds, and it ends at 0.
 * Prove: new contests and new crowds. Aim one step beyond the crowd.
 */
export class RationalityGame extends Game {
  readonly slug = "rationality-common-knowledge";
  private readonly contest = new Contest(2 / 3);
  private readonly track = new Track();
  private round = 0;
  private stage: "set" | "result" = "set";
  private dragging = false;
  private readonly crowdAt = new Damped(0, 0.5);
  private readonly show = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly rows = new Damped(1, 0.45);

  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;

  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  constructor(env: ConstructorParameters<typeof Game>[0]) {
    super(env);
    this.track.min = 0;
    this.track.max = 100;
    this.track.step = 1;
  }

  begin(): void {
    this.round = 0;
    this.stage = "set";
    this.track.value = 50;
    this.show.snap(0);
    this.crowdAt.snap(0);
    this.seeStep = 0;
    this.pi = 0;
    this.solved = 0;
    this.locked = false;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Closest to two thirds of the average wins.");
    this.note.set("Drag to pick a number from 0 to 100.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.enterSee();
    this.seeStep = 3;
    this.rows.snap(7);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.lock, this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
    const ty = clamp(f.top + f.h * 0.58, f.top + 72, f.bottom - 56);
    this.track.fit(f.x + 24, f.x + f.w - 24, ty);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.lock.visible = (feel && this.stage === "set") || (this.beat === "prove" && !this.locked);
    this.next.visible = feel && this.stage === "result" && this.round < FEEL_ROUNDS.length - 1;
    this.toSee.visible = feel && this.stage === "result" && this.round >= FEEL_ROUNDS.length - 1;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 3;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number): void {
    if (this.beat === "see") return this.stepSee();
    if ((this.beat === "feel" && this.stage === "set") || (this.beat === "prove" && !this.locked)) {
      this.dragging = true;
      this.track.set(x);
    }
  }

  protected override onMove(x: number): void {
    if (this.dragging) this.track.set(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private lockIn(): void {
    if (this.beat === "prove") return this.proveLock();
    const k = FEEL_ROUNDS[this.round]!.k;
    const q = this.contest.crowd(FEEL_START, k);
    const aim = this.contest.best(q);
    const g = this.track.value;
    this.stage = "result";
    this.crowdAt.snap(q);
    this.show.set(1);
    this.prompt.set(Math.abs(g - aim) <= 5 ? "Close. You aimed beyond the crowd." : g > aim ? "Too high. Think one step further." : "Too low. They are not that deep.");
    this.note.set(`The crowd said ${r0(q)}. Aim ${r0(aim)}. You said ${r0(g)}.`);
    this.announce(`The crowd said ${r0(q)}. The target was ${r0(aim)}. You said ${r0(g)}.`);
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.stage = "set";
    this.show.set(0);
    this.track.value = 50;
    this.prompt.set("Closest to two thirds of the average wins.");
    this.note.set("Drag to pick a number from 0 to 100.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.rows.snap(1);
    this.afterStep();
  }

  private stepSee(): void {
    if (this.seeStep >= 3) return;
    this.seeStep++;
    this.afterStep();
  }

  private afterStep(): void {
    const texts = [
      ["Everyone guesses 50. Aim two thirds of that.", "Tap to think one step further."],
      ["They think that too, so aim lower again.", "Each step multiplies by two thirds. Tap again."],
      ["And again. The numbers keep shrinking.", "Tap once more."],
      ["If all are rational and all know it, the chain ends at 0.", "Common knowledge is what lets the chain run all the way."],
    ];
    this.rows.set([1, 3, 5, 7][this.seeStep]!);
    this.prompt.set(texts[this.seeStep]![0]!);
    this.note.set(texts[this.seeStep]![1]!);
    if (this.seeStep === 3) this.announce("Every step multiplies by two thirds. With common knowledge of rationality the chain ends at zero.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.load();
  }

  private load(): void {
    const z = PUZZLES[this.pi]!;
    this.locked = false;
    this.track.value = 50;
    this.show.snap(0);
    this.prompt.set(`Aim for ${WORD(z.p)} of the average.`);
    this.note.set(`The crowd starts at ${z.start} and thinks ${z.k} step${z.k === 1 ? "" : "s"} ahead.`);
    this.sync();
  }

  private proveLock(): void {
    const z = PUZZLES[this.pi]!;
    const best = bestFor(z);
    const q = new Contest(z.p).crowd(z.start, z.k);
    const g = this.track.value;
    const ok = Math.abs(g - best) <= TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.crowdAt.snap(q);
      this.show.set(1);
      this.prompt.set("Right. One step beyond the crowd.");
      this.note.set(`The crowd says ${r0(q)}, so aim ${WORD(z.p)} of that: ${r0(best)}.`);
      this.wait = 2;
    } else {
      this.prompt.set(g > best ? "Too high. Find what the crowd will say first." : "Too low. You thought too many steps.");
      this.note.set(`You said ${r0(g)}. Start from ${z.start} and apply the steps.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.crowdAt.step(dt);
    this.show.step(dt);
    this.rows.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= PUZZLES.length) {
          this.prompt.set("Aim one step beyond what the crowd will say.");
          this.note.set("The more steps they take, the lower the answer.");
          this.finish();
        } else {
          this.pi++;
          this.load();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "see") this.drawLadder(p, c, f);
    else this.drawTrack(p, c, f);
  }

  private drawTrack(p: Painter, c: Colors, f: Frame): void {
    const t = this.track;
    const a = this.intro.value;
    if (this.beat === "feel") p.text(FEEL_ROUNDS[this.round]!.label, this.cx, f.top + 16, { font: Type.display(20), color: c.fog, align: "center", alpha: a });
    t.ruler(p, c, [0, 50, 100], r0, a);
    const s = this.show.value;
    const z = this.beat === "prove" ? PUZZLES[Math.min(this.pi, PUZZLES.length - 1)]! : null;
    if (s > 0.01) {
      const q = this.crowdAt.value;
      const aim = z ? bestFor(z) : this.contest.best(q);
      p.dashedRing(t.xOf(q), t.y, 7, c.ink, 0.9 * s);
      p.text(`crowd ${r0(q)}`, t.xOf(q), t.y + 46, { font: Type.mono(11), color: c.fog, align: "center", alpha: s });
      p.ring(t.xOf(aim), t.y, 14, c.ink, 1.25, s);
      p.text(`aim ${r0(aim)}`, t.xOf(aim), t.y - 46, { font: Type.mono(11), color: c.ink, align: "center", alpha: s });
    }
    p.text(r0(t.value), t.xOf(t.value), t.y - 24, { font: Type.mono(12), color: c.ink, align: "center" });
    t.marker(p, c, t.value, 9);
    if (this.beat === "feel") this.ticks(p, c, FEEL_ROUNDS.length, this.round + (this.stage === "result" ? 1 : 0), this.round);
    else this.ticks(p, c, PUZZLES.length, this.solved, this.pi);
  }

  private drawLadder(p: Painter, c: Colors, f: Frame): void {
    const vals = this.contest.ladder(FEEL_START, 5);
    const n = 7;
    const rowH = Math.min(30, (f.h - 10) / n);
    const x0 = f.x + 28;
    const maxW = f.w - 28 - 52;
    const shown = this.rows.value;
    for (let i = 0; i < n; i++) {
      const al = clamp(shown - i, 0, 1);
      if (al < 0.02) continue;
      const y = f.top + 8 + i * rowH + rowH / 2;
      p.text(String(i), f.x + 8, y, { font: Type.mono(10), color: c.ash, base: "middle", alpha: al });
      const v = i < 6 ? vals[i]! : 0;
      const len = (v / FEEL_START) * maxW;
      if (i < 6) {
        p.rect(x0, y - 3, Math.max(1, len), 6, c.ink, 0.9 * al);
        p.text(r0(v), x0 + len + 10, y, { font: Type.mono(11), color: c.ink, base: "middle", alpha: al });
      } else {
        p.ring(x0 + 3, y, 3, c.ink, 1.25, al);
        p.text("0", x0 + 16, y, { font: Type.mono(11), color: c.ink, base: "middle", alpha: al });
      }
    }
  }
}
