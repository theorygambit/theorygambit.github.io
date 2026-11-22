import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_VENTURES, Venture, proveVentures, type Choice } from "./model";

/**
 * Feel: three projects with more and more already spent. Finishing always costs 4 and pays 3. Go on or quit?
 * See: the sunk amount is the same in both columns, so it drops out. Only what is still ahead decides.
 * Prove: three new projects. Go on or quit, ignoring what is spent.
 */
export class SunkCostEndowmentGame extends Game {
  readonly slug = "sunk-cost-endowment";
  private ventures: Venture[] = [];
  private picks: Choice[] = [];
  private round = 0;
  private waiting = false;
  private since = 0;
  private armed: Choice | null = null;
  private readonly outcome = new Damped(0, 0.4);

  private phase = 0;
  private readonly fade = new Damped(0, 0.5);
  private readonly reveal = new Damped(0, 0.5);

  private cases: Venture[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: Choice | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.ventures = [...FEEL_VENTURES];
    this.picks = [];
    this.round = 0;
    this.waiting = false;
    this.outcome.snap(0);
    this.phase = 0;
    this.fade.snap(0);
    this.reveal.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.loadVenture();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.picks = ["continue", "continue", "continue"];
    this.round = 3;
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 3 && !this.waiting;
    this.toProve.visible = this.beat === "see" && this.phase >= 2;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const live = (this.beat === "feel" && !this.waiting && this.round < 3) || (this.beat === "prove" && !this.locked);
    if (live) {
      if (inside(this.pair(0), x, y)) this.armed = "continue";
      else if (inside(this.pair(1), x, y)) this.armed = "quit";
    } else if (this.beat === "see") this.advance();
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = null;
    if (!a || !inside(this.pair(a === "continue" ? 0 : 1), x, y)) return;
    if (this.beat === "feel" && !this.waiting) this.play(a);
    else if (this.beat === "prove" && !this.locked) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private loadVenture(): void {
    const v = this.ventures[this.round]!;
    this.outcome.snap(0);
    this.prompt.set(this.round === 0 ? `You have spent ${v.sunk}. Finish for ${v.cost} more and get ${v.payoff}?` : `You have spent ${v.sunk}. Finish for ${v.cost}, get ${v.payoff}?`);
    this.note.set("Go on, or quit now?");
  }

  private play(a: Choice): void {
    const v = this.ventures[this.round]!;
    this.picks.push(a);
    this.waiting = true;
    this.since = 0;
    this.outcome.set(1);
    this.cue(a === v.best ? "good" : "bad");
    const here = a === "continue" ? v.ahead : 0;
    const other = a === "continue" ? 0 : v.ahead;
    this.prompt.set(a === "continue" ? "You went on." : "You quit.");
    this.note.set(`From here: ${here > 0 ? "+" : ""}${fmt(here)}. The other choice: ${other > 0 ? "+" : ""}${fmt(other)}.`);
    this.announce(`Project ${this.round + 1}. You ${a === "continue" ? "went on" : "quit"}. From here ${fmt(here)}. The other choice ${fmt(other)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.phase = 0;
    this.fade.snap(0);
    this.reveal.snap(0);
    const n = this.picks.filter((p) => p === "continue").length;
    this.prompt.set("Same project, two choices.");
    this.note.set(`You went on ${n} of 3 times. Tap to see what changes between them.`);
    this.sync();
  }

  private advance(): void {
    if (this.phase >= 2) return;
    this.phase++;
    if (this.phase === 1) {
      this.fade.set(1);
      this.prompt.set("What is spent is spent in both.");
      this.note.set("It is the same in both columns. Tap again.");
    } else {
      this.reveal.set(1);
      const v = FEEL_VENTURES[2]!;
      this.prompt.set(`Only the future is left: ${fmt(v.ahead)} against 0.`);
      this.note.set("Owning a thing works the same way. It is worth what it can still do for you.");
      this.announce("The sunk amount is the same either way. Only what is still ahead decides.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveVentures(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
    this.sync();
  }

  private loadCase(): void {
    this.locked = false;
    this.wrong = null;
    this.prompt.set(this.pi === 0 ? "A new project. Go on or quit?" : "Another project. Go on or quit?");
    this.note.set("Spent is spent. Compare what finishing costs with what it pays.");
  }

  private answer(a: Choice): void {
    const v = this.cases[this.pi]!;
    if (a === v.best) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.prompt.set(a === "continue" ? "Right. Finishing pays more than it costs." : "Right. Finishing costs more than it pays.");
      this.note.set(`Pays ${fmt(v.payoff)}, costs ${fmt(v.cost)}. The ${fmt(v.sunk)} already spent does not enter.`);
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.wrong = a;
      this.prompt.set("Not quite. Leave out what is spent.");
      this.note.set(`Finishing costs ${fmt(v.cost)} and pays ${fmt(v.payoff)}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.outcome.step(dt);
    this.fade.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 1.6) {
        this.waiting = false;
        this.round++;
        if (this.round < 3) this.loadVenture();
        else {
          this.prompt.set("Three projects. Did what you had spent move you?");
          this.note.set("");
        }
        this.sync();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Spent is spent. Decide on what is still ahead.");
          this.note.set("A clean decision would say the same however much you had put in.");
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
    else this.drawVenture(p, c, f);
  }

  private drawVenture(p: Painter, c: Colors, f: Frame): void {
    const prove = this.beat !== "feel";
    const v = prove ? this.cases[Math.min(this.pi, this.cases.length - 1)]! : this.ventures[Math.min(this.round, 2)]!;
    const top = Math.max(v.sunk, v.cost, v.payoff, 1);
    const slot = f.w / 3;
    const R = clamp(Math.min(slot * 0.38, (f.h - 60) / 2), 14, 46);
    const cy = f.top + f.h / 2 - 12;
    const r = (x: number) => R * Math.sqrt(Math.max(0, x) / top);
    const items = [
      { x: f.x + slot * 0.5, label: "spent", val: v.sunk, kind: "dash" },
      { x: f.x + slot * 1.5, label: "finishing costs", val: v.cost, kind: "disc" },
      { x: f.x + slot * 2.5, label: "it pays", val: v.payoff, kind: "ring" },
    ];
    for (const it of items) {
      if (it.val > 0) {
        if (it.kind === "disc") p.disc(it.x, cy, r(it.val), c.ink, 0.92);
        else if (it.kind === "ring") p.ring(it.x, cy, r(it.val), c.ink, 1.5);
        else p.dashedRing(it.x, cy, r(it.val), c.ink, 0.8);
      }
      p.text(fmt(it.val), it.x, cy + R + 18, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(it.label, it.x, cy + R + 36, { font: Type.body(11, 400), color: c.fog, align: "center" });
    }
    const live = prove ? !this.locked : !this.waiting && this.round < 3;
    for (const i of [0, 1] as const) {
      if (!prove && this.round >= 3) break;
      const a: Choice = i === 0 ? "continue" : "quit";
      const picked = prove ? false : this.picks[this.round] === a;
      const right = a === v.best;
      const al = prove ? (this.wrong === a ? 0.35 : this.locked && !right ? 0.3 : 1) : live ? 1 : picked ? 0.9 : 0.3;
      drawChoice(p, c, this.pair(i), { label: a === "continue" ? "Go on" : "Quit", sub: a === "continue" ? `pay ${fmt(v.cost)} more` : "walk away", r: a === "continue" ? 14 : 8, alpha: al, armed: this.armed === a });
    }
    if (prove) drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
    else drawTicks(p, c, f, this.cx, 3, this.round, Math.min(this.round, 2));
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const v = FEEL_VENTURES[2]!;
    const R = clamp((f.h - 100) / 3, 14, 40);
    const r = (x: number) => R * Math.sqrt(Math.max(0, x) / v.sunk);
    const xs = [this.cx - Math.min(84, f.w / 4), this.cx + Math.min(84, f.w / 4)];
    const y1 = f.top + 28 + R;
    const y2 = y1 + R + 22 + R * 0.7;
    ["Go on", "Quit"].forEach((name, i) => {
      p.text(name, xs[i]!, f.top + 10, { font: Type.body(13, 400), color: c.ink, align: "center" });
      p.dashedRing(xs[i]!, y1, r(v.sunk), c.ink, 0.85 * (1 - 0.8 * this.fade.value));
    });
    p.text("spent", this.cx, y1, { font: Type.body(11, 400), color: c.ash, align: "center", alpha: 1 - this.fade.value });
    const k = this.reveal.value;
    const futureR = (x: number) => R * 0.7 * Math.sqrt(Math.max(0.0001, Math.abs(x)) / 1);
    if (k > 0.01) {
      p.dashedRing(xs[0]!, y2, futureR(v.ahead) * k, c.ink, k);
      p.text(fmt(v.ahead), xs[0]!, y2 + R * 0.7 + 16, { font: Type.mono(12), color: c.ink, align: "center", alpha: k });
      p.text("0", xs[1]!, y2 + R * 0.7 + 16, { font: Type.mono(12), color: c.ink, align: "center", alpha: k });
      p.disc(xs[1]!, y2, 2, c.ink, k);
    } else {
      for (const x of xs) p.ring(x, y2, 4, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4));
    }
    drawTicks(p, c, f, this.cx, 3, this.phase + 1, this.phase);
  }
}
