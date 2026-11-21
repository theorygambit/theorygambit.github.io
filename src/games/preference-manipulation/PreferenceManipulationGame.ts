import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { FEEL_DECOY, FEEL_PAIR, beatenBy, decoy, triple, type Option } from "./model";

const HIT = 24;

/**
 * Feel: choose between two options, then again when a third appears.
 * See: tap each option to see who beats it. The decoy is beaten by exactly one option.
 * Prove: new options with new labels. Tap the decoy.
 */
export class PreferenceManipulationGame extends Game {
  readonly slug = "preference-manipulation";
  private set: Option[] = [...FEEL_PAIR];
  private stage: "one" | "two" | "result" = "one";
  private first: string | null = null;
  private second: string | null = null;
  private readonly third = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private seen = new Set<string>();
  private focus: string | null = null;
  private readonly region = new Damped(0, 0.4);

  private puzzles: Option[][] = [];
  private pi = 0;
  private done = false;
  private solved = 0;
  private wait = 0;
  private wrong: string | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.set = [...FEEL_PAIR];
    this.stage = "one";
    this.first = null;
    this.second = null;
    this.third.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Pick one. Cheap, or better?");
    this.note.set("Left is cheaper. Higher is better.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.first = "A";
    this.second = "B";
    this.stage = "result";
    this.enterSee();
    if (beat === "see") return;
    this.seen = new Set(["A", "B", "D"]);
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.seen.size >= 3;
  }

  // ---- Geometry ---------------------------------------------------------

  private plot(f: Frame): { x0: number; y0: number; w: number; h: number; X: (price: number) => number; Y: (q: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const y0 = f.top + 26;
    const h = Math.max(90, Math.min(200, f.h - 26 - 32));
    return { x0, y0, w, h, X: (price) => x0 + (price / 11) * w, Y: (q) => y0 + h - (q / 10) * h };
  }

  private optionAt(x: number, y: number): Option | null {
    const g = this.plot(this.frame);
    let best: Option | null = null;
    let bd = HIT;
    for (const o of this.set) {
      if (o.name === "D" && this.beat === "feel" && this.stage === "one") continue;
      const d = Math.hypot(g.X(o.price) - x, g.Y(o.quality) - y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const o = this.optionAt(x, y);
    if (!o) return;
    if (this.beat === "feel") this.pickFeel(o);
    else if (this.beat === "see") this.inspect(o);
    else if (this.beat === "prove" && !this.done) this.guess(o);
  }

  // ---- Feel -------------------------------------------------------------

  private pickFeel(o: Option): void {
    if (this.stage === "one") {
      this.first = o.name;
      this.cue("good");
      this.stage = "two";
      this.set = [...FEEL_PAIR, FEEL_DECOY];
      this.third.set(1);
      this.prompt.set("A third option D appears. Pick again.");
      this.note.set(`You chose ${o.name} before. The ring marks it.`);
    } else if (this.stage === "two") {
      this.second = o.name;
      this.cue("good");
      this.stage = "result";
      const first = this.first!;
      const moved = first !== o.name;
      this.prompt.set(o.name === "D" ? "You picked the decoy." : moved ? `You moved from ${first} to ${o.name}.` : `You kept ${o.name}.`);
      this.note.set(o.name === "D" ? "B beats D on price and quality, so D is never the best pick." : moved ? "D is worse than B, yet it changed your pick." : "Many people drift toward B once D is there.");
      this.announce(o.name === "D" ? "You picked the decoy." : moved ? `You moved from ${first} to ${o.name}.` : `You kept ${o.name}.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.set = [...FEEL_PAIR, FEEL_DECOY];
    this.seen.clear();
    this.focus = null;
    this.region.snap(0);
    this.third.snap(1);
    this.prompt.set("Tap each option. Who beats it?");
    this.note.set("A beats B if it is cheaper and better.");
    this.sync();
  }

  private inspect(o: Option): void {
    this.focus = o.name;
    this.seen.add(o.name);
    this.region.snap(0);
    this.region.set(1);
    this.cue("good");
    const by = beatenBy(this.set, o);
    this.note.set(by.length === 0 ? `${o.name} is beaten by no one.` : `${o.name} is beaten by ${by.map((b) => b.name).join(" and ")}.`);
    if (this.seen.size >= 3) {
      this.prompt.set("D is beaten by B only. That is the decoy.");
      this.announce("The decoy D is beaten by B only, and by neither A nor itself.");
    } else this.prompt.set(this.seen.size === 1 ? "Tap another." : "One more.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [this.relabel(triple(this.env.rng)), this.relabel(triple(this.env.rng))];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private relabel(set: Option[]): Option[] {
    const names = this.env.rng.shuffle(["P", "Q", "R"]);
    return set.map((o, i) => ({ ...o, name: names[i]! }));
  }

  private loadPuzzle(): void {
    this.set = this.puzzles[this.pi]!;
    this.done = false;
    this.wrong = null;
    this.focus = null;
    this.region.snap(0);
    this.third.snap(1);
    this.prompt.set(this.pi === 0 ? "New options. Tap the decoy." : "Another menu. Tap the decoy.");
    this.note.set("It is beaten by exactly one option.");
    this.sync();
  }

  private guess(o: Option): void {
    const dec = decoy(this.set)!;
    if (o === dec) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.focus = o.name;
      this.region.snap(0);
      this.region.set(1);
      this.wrong = null;
      const by = beatenBy(this.set, dec)[0]!;
      this.prompt.set(`Right. ${o.name} is the decoy.`);
      this.note.set(`${by.name} beats it, and the other option does not.`);
      this.wait = 2;
    } else {
      this.cue("bad");
      this.wrong = o.name;
      this.focus = o.name;
      this.region.snap(0);
      this.region.set(1);
      this.prompt.set("Not quite. That is a real choice.");
      this.note.set(`${o.name} is beaten by no one. The decoy is beaten by one.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.third.step(dt);
    this.region.step(dt);
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("A decoy no one picks can decide the pick.");
          this.note.set("Ask what each option beats, and what beats it.");
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
    const a = this.intro.value;
    const g = this.plot(f);
    p.rule(g.x0, g.y0 + g.h, g.x0 + g.w, g.y0 + g.h, c.ink, 0.5 * a);
    p.rule(g.x0, g.y0, g.x0, g.y0 + g.h, c.ink, 0.5 * a);
    p.text("quality", g.x0, g.y0 - 12, { font: Type.body(12, 400), color: c.fog, alpha: a });
    p.text("price", g.x0 + g.w, g.y0 + g.h + 18, { font: Type.body(12, 400), color: c.fog, align: "right", alpha: a });
    const fo = this.focus ? this.set.find((o) => o.name === this.focus) : undefined;
    const rg = this.region.value;
    if (fo && rg > 0.02) {
      p.rect(g.x0 + 1, g.y0, g.X(fo.price) - g.x0 - 1, g.Y(fo.quality) - g.y0, c.ink, 0.07 * rg);
      for (const b of beatenBy(this.set, fo)) {
        const bx = g.X(b.price);
        const by = g.Y(b.quality);
        const fx = g.X(fo.price);
        const fy = g.Y(fo.quality);
        const d = Math.hypot(fx - bx, fy - by);
        const k = 14 / d;
        p.arrow(bx + (fx - bx) * k, by + (fy - by) * k, fx - (fx - bx) * k, fy - (fy - by) * k, c.ink, 1.25, rg, 6);
      }
    }
    for (const o of this.set) {
      const x = g.X(o.price);
      const y = g.Y(o.quality);
      const isD = this.beat === "feel" && o.name === "D";
      const al = (isD ? this.third.value : 1) * a;
      const chosen = this.beat === "feel" && (this.second === o.name || (this.stage === "one" && this.first === o.name));
      if (chosen) p.disc(x, y, 10, c.ink, 0.92 * al);
      else {
        p.ring(x, y, 10, c.ink, 1.5, al);
        p.text(o.name, x, y, { font: Type.body(11, 400), color: c.ink, align: "center", base: "middle", alpha: al });
      }
      if (this.beat === "feel" && this.stage !== "one" && this.first === o.name && this.second !== o.name) p.dashedRing(x, y, 15, c.ink, 0.8 * al);
      if (this.wrong === o.name) p.dashedRing(x, y, 15, c.ink, 0.8);
      if (chosen) p.text(o.name, x + 16, y - 12, { font: Type.body(12, 400), color: c.fog, alpha: al });
    }
    const n = this.beat === "feel" ? 2 : this.beat === "see" ? 3 : this.puzzles.length;
    const done = this.beat === "feel" ? (this.stage === "one" ? 0 : this.stage === "two" ? 1 : 2) : this.beat === "see" ? this.seen.size : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
