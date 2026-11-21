import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside, type Box } from "../../core/Geometry";
import { Glyph } from "../shared/glyphs";
import { fmt } from "../shared/fmt";
import { Allais, FEEL_ALLAIS, PROVE_POOL, type Case } from "./model";

type Id = "A" | "B" | "C" | "D";
interface Part {
  p: number;
  prize: number;
  common: boolean;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** The parts of a lottery. With `split`, the shared chance is its own part. */
function parts(g: Allais, id: Id, split: boolean): Part[] {
  const c = g.common;
  if (id === "A") return split ? [{ p: c, prize: g.s, common: true }, { p: 1 - c, prize: g.s, common: false }] : [{ p: 1, prize: g.s, common: false }];
  if (id === "B") return [{ p: c, prize: g.s, common: true }, { p: g.pH, prize: g.h, common: false }, { p: g.pZ, prize: 0, common: false }];
  if (id === "C") return [{ p: g.pH + g.pZ, prize: g.s, common: false }, { p: c, prize: 0, common: true }];
  return split ? [{ p: g.pH, prize: g.h, common: false }, { p: g.pZ, prize: 0, common: false }, { p: c, prize: 0, common: true }] : [{ p: g.pH, prize: g.h, common: false }, { p: 1 - g.pH, prize: 0, common: false }];
}

function lottery(g: Allais, id: Id) {
  return id === "A" ? g.A() : id === "B" ? g.B() : id === "C" ? g.C() : g.D();
}

/**
 * Feel: a sure prize against a gamble, then two long shots. Pick one in each pair.
 * See: strip the common part from both pairs, and the same choice is left.
 * Prove: new prizes. Given the first pick, tap the second pick that expected utility requires.
 */
export class AllaisParadoxGame extends Game {
  readonly slug = "allais-paradox";
  private g: Allais = FEEL_ALLAIS;
  private first: "A" | "B" | null = null;
  private second: "C" | "D" | null = null;
  private stage: "one" | "two" | "result" = "one";
  private readonly intro = new Damped(0, 0.7);
  private readonly row2 = new Damped(0, 0.4);

  private peelStep = 0;
  private readonly mark = new Damped(0, 0.5);
  private readonly peel = new Damped(0, 0.7);

  private cases: Case[] = [];
  private pi = 0;
  private done = false;
  private solved = 0;
  private wait = 0;
  private readonly flash = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.g = FEEL_ALLAIS;
    this.first = null;
    this.second = null;
    this.stage = "one";
    this.intro.snap(0).set(1);
    this.row2.snap(0.25);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Pick one. A is certain, B is a gamble.");
    this.note.set("Amounts are in millions.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.first = "A";
    this.second = "D";
    this.enterSee();
    if (beat === "see") return;
    this.peelStep = 2;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.peelStep >= 2;
  }

  // ---- Geometry ---------------------------------------------------------

  private card(f: Frame, row: 0 | 1, col: 0 | 1): Box {
    const gap = 12;
    const rh = Math.floor((f.h - gap - 6) / 2);
    const w = Math.floor((f.w - gap) / 2);
    return { x: f.x + col * (w + gap), y: f.top + 2 + row * (rh + gap), w, h: rh };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "feel") {
      if (this.stage === "one") {
        for (const col of [0, 1] as const) if (inside(this.card(f, 0, col), x, y)) return this.pickFirst(col === 0 ? "A" : "B");
      } else if (this.stage === "two") {
        for (const col of [0, 1] as const) if (inside(this.card(f, 1, col), x, y)) return this.pickSecond(col === 0 ? "C" : "D");
      }
    } else if (this.beat === "see") this.stepPeel();
    else if (this.beat === "prove" && !this.done) {
      for (const col of [0, 1] as const) if (inside(this.card(f, 1, col), x, y)) return this.guess(col === 0 ? "C" : "D");
    }
  }

  // ---- Feel -------------------------------------------------------------

  private pickFirst(id: "A" | "B"): void {
    this.first = id;
    const ev = (l: Id) => Allais.expected(lottery(this.g, l));
    this.cue("good");
    this.stage = "two";
    this.row2.set(1);
    this.prompt.set("Now pick again. C or D?");
    this.note.set(`B averages ${fmt(ev("B"))}, A pays ${fmt(ev("A"))}. You chose ${id}.`);
    this.sync();
  }

  private pickSecond(id: "C" | "D"): void {
    this.second = id;
    this.cue("good");
    this.stage = "result";
    const first = this.first!;
    const consistent = this.g.consistent(first) === id;
    this.prompt.set(consistent ? "That pair of picks is consistent." : "That pair of picks fits no utility.");
    this.note.set(consistent ? "Most people switch, though. Expected utility pairs A with C, B with D." : "Most people do this. Expected utility pairs A with C, B with D.");
    this.announce(`You chose ${first} then ${id}. Expected utility pairs A with C and B with D.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_ALLAIS;
    this.peelStep = 0;
    this.mark.snap(0);
    this.peel.snap(0);
    this.row2.snap(1);
    this.prompt.set("Tap. What do both options in a pair share?");
    this.note.set("Look for the same chance of the same prize.");
    this.sync();
  }

  private stepPeel(): void {
    if (this.peelStep >= 2) return;
    this.peelStep++;
    this.cue("good");
    if (this.peelStep === 1) {
      this.mark.set(1);
      this.prompt.set(`Both share a ${pct(this.g.common)} chance of the same prize.`);
      this.note.set("In pair one it is 1. In pair two it is 0. Tap to strip it.");
    } else {
      this.peel.set(1);
      this.prompt.set("Stripped, A equals C and B equals D.");
      this.note.set("The same choice, so the answers should match.");
      this.announce("With the common part removed, A and C are the same gamble, and B and D are the same gamble.");
    }
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
    this.g = c.game;
    this.first = c.first;
    this.second = null;
    this.done = false;
    this.row2.snap(1);
    this.flash.snap(0);
    this.peel.snap(0);
    this.mark.snap(0);
    this.prompt.set(`New prizes. You picked ${c.first}. Which goes with it?`);
    this.note.set("Tap C or D, the pick expected utility requires.");
    this.sync();
  }

  private guess(id: "C" | "D"): void {
    const c = this.cases[this.pi]!;
    this.second = id;
    const want = c.game.consistent(c.first);
    if (id === want) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.peel.set(1);
      this.mark.snap(1);
      this.prompt.set(`Right. ${c.first} goes with ${want}.`);
      this.note.set(`Strip the common ${pct(c.game.common)}: the same choice is left.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.flash.snap(1);
      this.prompt.set("Not quite. Strip the common part.");
      this.note.set(`Pair one and two share ${pct(c.game.common)} of one prize. Remove it.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.row2.step(dt);
    this.mark.step(dt);
    this.peel.step(dt);
    this.flash.step(dt);
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Strip the common part, and the choice is the same.");
          this.note.set("People often switch anyway. That is the paradox.");
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

  private drawCard(p: Painter, c: Colors, b: Box, id: Id, split: boolean, o: { alpha: number; chosen: boolean; peel: number; mark: number }): void {
    const g = this.g;
    const list = parts(g, id, split);
    p.frame(b.x, b.y, b.w, b.h, c.ink, (o.chosen ? 0.75 : 0.3) * o.alpha);
    if (o.chosen) p.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, c.ink, 0.07 * o.alpha);
    p.text(id, b.x + 9, b.y + 14, { font: Type.body(13, 400), color: c.fog, alpha: o.alpha });
    const colW = b.w / 3;
    const R = Math.min(colW / 2 - 6, b.h * 0.22, 16);
    const start = b.x + (b.w - colW * list.length) / 2;
    const maxPrize = Math.max(g.h, 1);
    list.forEach((part, i) => {
      const x = start + colW * (i + 0.5);
      const y = b.y + b.h * 0.5;
      const fade = part.common ? 1 - 0.8 * o.peel : 1;
      const rad = part.prize > 0 ? Math.max(2, R * Math.sqrt(part.prize / maxPrize)) : 3;
      if (part.prize > 0) p.disc(x, y, rad, c.ink, 0.92 * o.alpha * fade);
      else p.dashedRing(x, y, rad, c.ink, 0.9 * o.alpha * fade);
      if (part.common && o.mark > 0.02) p.dashedRing(x, y, R + 4, c.ink, 0.8 * o.mark * o.alpha * (1 - o.peel));
      p.text(`${pct(part.p)} ${part.prize}`, x, b.y + b.h - 8, { font: Type.mono(10), color: c.fog, align: "center", alpha: o.alpha * fade });
    });
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const split = this.beat !== "feel";
    const r2 = this.row2.value;
    const ids1: Id[] = ["A", "B"];
    const ids2: Id[] = ["C", "D"];
    ids1.forEach((id, col) => this.drawCard(p, c, this.card(f, 0, col as 0 | 1), id, split, { alpha: a, chosen: this.first === id, peel: this.peel.value, mark: this.mark.value }));
    ids2.forEach((id, col) => this.drawCard(p, c, this.card(f, 1, col as 0 | 1), id, split, { alpha: a * r2, chosen: this.second === id && !(this.beat === "prove" && !this.done), peel: this.peel.value, mark: this.mark.value }));
    if (this.beat === "prove" && this.flash.value > 0.02 && this.second) {
      const b = this.card(f, 1, this.second === "C" ? 0 : 1);
      p.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, c.ink, 0.1 * this.flash.value);
    }
    const n = 2;
    const done = this.beat === "feel" ? (this.stage === "one" ? 0 : this.stage === "two" ? 1 : 2) : this.beat === "see" ? this.peelStep : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
