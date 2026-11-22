import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import { fmt } from "../shared/fmt";
import { FEEL_GAME, randomSym, type Sym } from "./model";

const NAMES = ["Hawk", "Dove"] as const;
const LETTERS = ["A", "B"] as const;
const DOTS = 12;

/**
 * Feel: let hawks rule, then doves, and drop a rare mutant into each crowd.
 * See: compare, in each column, what the resident and the mutant earn against the resident.
 * Prove: two new tables. Tap every strategy that resists invasion.
 */
export class EssGame extends Game {
  readonly slug = "ess";
  private g: Sym = FEEL_GAME;
  private readonly gv = new GridView(2, 2, 6);
  private resident: 0 | 1 | null = null;
  private tested = new Set<number>();
  private armed: 0 | 1 | null = null;
  private readonly reveal = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly col: Damped[] = [new Damped(0, 0.5), new Damped(0, 0.5)];

  private puzzles: Sym[] = [];
  private pi = 0;
  private picked = new Set<number>();
  private locked = false;
  private solved = 0;
  private wait = 0;
  private wrongRow: number | null = null;
  private readonly flash = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_GAME;
    this.resident = null;
    this.tested.clear();
    this.reveal.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Who rules? A mutant arrives.");
    this.note.set("Pick a crowd. One rare mutant plays the other strategy.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.tested = new Set([0, 1]);
    this.enterSee();
    if (beat === "see") return;
    this.seeStep = 3;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    this.gv.fit(this.frame);
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.tested.size >= 2;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 3;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (inside(this.pair(0), x, y)) this.armed = 0;
      else if (inside(this.pair(1), x, y)) this.armed = 1;
    } else if (this.beat === "see") this.stepSee();
    else if (this.beat === "prove" && !this.locked) {
      for (let r = 0; r < 2; r++) if (inside(this.gv.rowLabelBox(r), x, y)) return this.toggle(r);
    }
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = null;
    if (a !== null && this.beat === "feel" && inside(this.pair(a), x, y)) this.drop(a);
  }

  // ---- Feel -------------------------------------------------------------

  private drop(i: 0 | 1): void {
    this.resident = i;
    this.tested.add(i);
    this.reveal.snap(0);
    this.reveal.set(1);
    const g = this.g;
    const j = (1 - i) as 0 | 1;
    const res = g.pay(i, i);
    const mut = g.pay(j, i);
    const inv = mut > res;
    this.cue(inv ? "bad" : "good");
    this.prompt.set(inv ? `The ${NAMES[j].toLowerCase()} mutant invades.` : `The ${NAMES[i].toLowerCase()}s hold.`);
    this.note.set(`Among ${NAMES[i].toLowerCase()}s, a ${NAMES[i].toLowerCase()} earns ${fmt(res)}, the mutant ${fmt(mut)}.`);
    this.announce(`Among ${NAMES[i]} residents, a resident earns ${fmt(res)} and a ${NAMES[j]} mutant earns ${fmt(mut)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.seeStep = 0;
    for (const d of this.col) d.snap(0);
    this.prompt.set("Tap. Compare a resident with a mutant.");
    this.note.set("Read down one column at a time.");
    this.sync();
  }

  private stepSee(): void {
    if (this.seeStep >= 3) return;
    const k = this.seeStep;
    this.seeStep++;
    this.cue("good");
    if (k < 2) {
      this.col[k]!.set(1);
      const j = 1 - k;
      const res = this.g.pay(k, k);
      const mut = this.g.pay(j, k);
      this.prompt.set(mut > res ? `${NAMES[j]} beats ${NAMES[k]} here.` : `${NAMES[k]} holds here.`);
      this.note.set(`Against ${NAMES[k].toLowerCase()}s, ${NAMES[k].toLowerCase()} earns ${fmt(res)} and ${NAMES[j].toLowerCase()} earns ${fmt(mut)}.`);
    } else {
      this.prompt.set("Neither resists. No pure strategy is stable.");
      this.note.set("When both are invaded, a stable mix can exist instead.");
      this.announce("Neither pure strategy resists invasion, so no pure strategy is evolutionarily stable.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    const wants = this.env.rng.shuffle([this.env.rng.pick([0, 2]), 1]);
    this.puzzles = wants.map((w) => randomSym(this.env.rng, w));
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.g = this.puzzles[this.pi]!;
    this.picked.clear();
    this.locked = false;
    this.wrongRow = null;
    this.flash.snap(0);
    this.prompt.set(this.pi === 0 ? "New table. Tap each strategy that resists." : "Another table. Which strategies resist?");
    this.note.set("Tap a row label. Tap none if none resist.");
    this.sync();
  }

  private toggle(r: number): void {
    if (this.picked.has(r)) this.picked.delete(r);
    else this.picked.add(r);
    this.wrongRow = null;
    this.sync();
  }

  private lockIn(): void {
    const g = this.g;
    const want = g.ess;
    const mine = [...this.picked].sort();
    const ok = mine.length === want.length && mine.every((v, i) => v === want[i]);
    if (ok) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrongRow = null;
      this.flash.snap(0);
      this.flash.set(1);
      this.prompt.set(want.length === 0 ? "Right. Neither resists." : `Right. ${want.map((i) => LETTERS[i]).join(" and ")} resist${want.length === 1 ? "s" : ""}.`);
      this.note.set("A resident must earn more against itself than a mutant does.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      const bad = mine.find((r) => !g.isEss(r));
      const miss = want.find((r) => !this.picked.has(r));
      const r = bad ?? miss!;
      this.wrongRow = r;
      this.flash.snap(0);
      this.flash.set(1);
      const j = 1 - r;
      this.prompt.set(bad !== undefined ? `${LETTERS[r]} does not resist.` : `${LETTERS[r]} does resist.`);
      this.note.set(`Among ${LETTERS[r]}s, ${LETTERS[r]} earns ${g.pay(r, r)} and ${LETTERS[j]} earns ${g.pay(j, r)}.`);
      this.picked.clear();
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.reveal.step(dt);
    this.flash.step(dt);
    for (const d of this.col) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Stable means a rare mutant cannot profit.");
          this.note.set("Compare it with what the resident earns against itself.");
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
    else this.drawTable(p, c, f);
  }

  private shape(p: Painter, c: Colors, x: number, y: number, kind: 0 | 1, r: number, alpha: number): void {
    if (kind === 0) p.disc(x, y, r, c.ink, 0.92 * alpha);
    else p.ring(x, y, r, c.ink, 1.5, alpha);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const t = this.reveal.value;
    const g = this.g;
    const res = this.resident;
    const step = f.w / DOTS;
    const r = clamp(step / 2 - 3, 4, 10);
    for (let i = 0; i < DOTS; i++) {
      const x = f.x + step * (i + 0.5);
      const y = f.top + r + 4;
      if (res === null) p.ring(x, y, r, c.ink, 1, 0.3 * a);
      else if (i === DOTS - 1) this.shape(p, c, x, y, (1 - res) as 0 | 1, r, a);
      else this.shape(p, c, x, y, res, r, a);
    }
    const R = clamp((f.h - 100) / 2, 14, 34);
    const cy = f.top + 2 * r + 22 + R;
    const off = Math.min(80, f.w / 2 - R - 10);
    if (res !== null && t > 0.02) {
      const j = (1 - res) as 0 | 1;
      const rv = g.pay(res, res);
      const mv = g.pay(j, res);
      const sz = (v: number) => Math.max(2, R * Math.sqrt(Math.abs(v) / 2) * t);
      if (rv > 0) p.disc(this.cx - off, cy, sz(rv), c.ink, 0.92 * a);
      else p.dashedRing(this.cx - off, cy, sz(rv), c.ink, a);
      if (mv > 0) p.ring(this.cx + off, cy, sz(mv), c.ink, 1.5, a);
      else p.dashedRing(this.cx + off, cy, sz(mv), c.ink, a);
      p.text(`resident ${fmt(rv)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a * t });
      p.text(`mutant ${fmt(mv)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a * t });
    }
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = this.tested.size >= 2 ? 0 : a;
      const done = this.tested.has(i);
      p.frame(z.x, z.y, z.w, z.h, c.ink, (done ? 0.6 : 0.35) * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      this.shape(p, c, gx, z.y + z.h * 0.3, i, Math.min(12, z.h * 0.15), al);
      p.text(`${NAMES[i]}s rule`, gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? "mutant: dove" : "mutant: hawk", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.tested.size > i, this.tested.size === i);
  }

  private drawTable(p: Painter, c: Colors, f: Frame): void {
    const gv = this.gv;
    const a = this.intro.value;
    const g = this.g;
    const seeing = this.beat === "see";
    const names = seeing ? ["H", "D"] : LETTERS;
    gv.grid(p, c, a);
    for (let r = 0; r < 2; r++) gv.rowLabel(p, c, r, names[r]!, { alpha: a, on: this.picked.has(r) });
    for (let k = 0; k < 2; k++) gv.colLabel(p, c, k, names[k]!, { alpha: a, on: seeing ? this.col[k]!.value > 0.5 : false });
    for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
      let wash = 0;
      let youBest = 0;
      if (seeing) {
        const t = this.col[k]!.value;
        if (t > 0.02) {
          wash = 0.06 * t;
          if (g.pay(r, k) >= g.pay(1 - r, k)) youBest = t;
        }
      } else {
        if (this.picked.has(r)) wash = 0.1;
        if (this.locked && g.isEss(r)) {
          wash = 0.12;
          youBest = this.flash.value;
        }
        if (this.wrongRow === r && this.flash.value > 0.02) wash = Math.max(wash, 0.08 * this.flash.value);
      }
      gv.cell(p, c, r, k, g.pay(r, k), g.pay(k, r), { alpha: a, wash, youBest });
    }
    const n = seeing ? 3 : 2;
    const done = seeing ? this.seeStep : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
