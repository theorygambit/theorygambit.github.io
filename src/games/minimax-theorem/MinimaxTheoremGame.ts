import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import type { Bimatrix } from "../shared/Bimatrix";
import { COL_NAMES, FEEL_TABLE, ROW_NAMES, saddleTable } from "./model";

const ROUNDS = 3;

/**
 * Feel: pick a row three times. The rival always picks the column that is worst for you in that row.
 * See: tap rows for their floors and columns for their ceilings. The best floor meets the lowest ceiling.
 * Prove: two new tables. Tap the cell where the floor and the ceiling agree.
 */
export class MinimaxTheoremGame extends Game {
  readonly slug = "minimax-theorem";
  private readonly gv = new GridView(3, 3);
  private m: Bimatrix = FEEL_TABLE;
  private shown = [false, false, false];
  private round = 0;
  private locked = false;
  private chosen = -1;
  private since = 0;
  private readonly intro = new Damped(0, 0.7);

  private floors = [false, false, false];
  private ceils = [false, false, false];
  private readonly meet = new Damped(0, 0.6);

  private puzzles: Bimatrix[] = [];
  private pi = 0;
  private solved = 0;
  private won = false;
  private wait = 0;
  private wrong: [number, number] | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.m = FEEL_TABLE;
    this.shown = [false, false, false];
    this.round = 0;
    this.locked = false;
    this.chosen = -1;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.pi = 0;
    this.setBeat("feel");
    this.prompt.set("Pick a row. They hold you to the worst cell.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.shown = [true, true, true];
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.floors = [true, true, true];
    this.ceils = [true, true, true];
    this.enterProve();
  }

  protected layout(): void {
    this.gv.fit(this.frame, 34, 26);
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private get allSeen(): boolean {
    return this.floors.every(Boolean) && this.ceils.every(Boolean);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS && !this.locked;
    this.toProve.visible = this.beat === "see" && this.allSeen;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.locked || this.round >= ROUNDS) return;
      for (let r = 0; r < 3; r++) if (inside(this.gv.rowStrip(r), x, y)) return this.play(r);
    } else if (this.beat === "see") {
      for (let r = 0; r < 3; r++) if (inside(this.gv.rowLabelBox(r), x, y)) return this.floor(r);
      for (let c = 0; c < 3; c++) if (inside(this.gv.colLabelBox(c), x, y)) return this.ceil(c);
    } else if (this.beat === "prove" && !this.won) {
      const cell = this.gv.cellAt(x, y);
      if (cell) this.guess(cell[0], cell[1]);
    }
  }

  // ---- Feel -------------------------------------------------------------

  private play(r: number): void {
    this.chosen = r;
    this.locked = true;
    this.since = 0;
    this.prompt.set(this.round === 0 ? "They aim at your worst cell." : "Again. Pick a row.");
    this.note.set("");
    this.sync();
  }

  private revealRow(): void {
    const r = this.chosen;
    this.shown[r] = true;
    const c = this.m.worstCol(r);
    const got = this.m.mine(r, c);
    const top = Math.max(...this.m.a[r]!);
    this.note.set(`Row ${ROW(r)}: they chose ${COL_NAMES[c]}. You got ${got}. The best cell was ${top}.`);
    this.announce(`Row ${ROW(r)}. They held you to ${got}. The best cell in that row was ${top}.`);
    this.round++;
    this.locked = false;
    this.prompt.set(this.round >= ROUNDS ? "Three rows. They always found the worst." : "They pick the worst for you.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.floors = [false, false, false];
    this.ceils = [false, false, false];
    this.meet.snap(0);
    this.shown = [true, true, true];
    this.prompt.set("Tap a row for its worst case.");
    this.note.set("A row's floor is what the rival can hold you to.");
    this.sync();
  }

  private floor(r: number): void {
    if (this.floors[r]) return;
    this.floors[r] = true;
    this.cue("good");
    this.afterTap();
  }

  private ceil(c: number): void {
    if (this.ceils[c]) return;
    this.ceils[c] = true;
    this.cue("good");
    this.afterTap();
  }

  private afterTap(): void {
    const f = this.floors.filter(Boolean).length;
    const c = this.ceils.filter(Boolean).length;
    if (this.allSeen) {
      this.meet.set(1);
      const [r, k] = this.m.saddle()!;
      this.prompt.set(`Best floor ${this.m.maximin().value} meets lowest ceiling ${this.m.minimax().value}.`);
      this.note.set(`Row ${ROW(r)} against ${COL_NAMES[k]}: neither side can improve.`);
      this.announce(`The best floor and the lowest ceiling are both ${this.m.maximin().value}, at row ${ROW(r)} column ${COL_NAMES[k]}.`);
    } else if (f < 3) {
      this.prompt.set(c === 0 ? "Tap a row for its worst case." : "Tap the rest of the rows.");
      this.note.set("A row's floor is what the rival can hold you to.");
    } else {
      this.prompt.set("Now a column: the most you get there.");
      this.note.set("Tap each column label. That is the rival's ceiling on you.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [saddleTable(this.env.rng), saddleTable(this.env.rng)];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.m = this.puzzles[this.pi]!;
    this.won = false;
    this.wrong = null;
    this.meet.snap(0);
    this.prompt.set(this.pi === 0 ? "A new table. Tap the cell where floor meets ceiling." : "Another table. Find the meeting cell.");
    this.note.set("The row floor and the column ceiling must agree.");
    this.sync();
  }

  private guess(r: number, c: number): void {
    const s = this.m.saddle()!;
    if (r === s[0] && c === s[1]) {
      this.cue("good");
      this.won = true;
      this.wrong = null;
      this.solved++;
      this.meet.set(1);
      this.prompt.set(`Right. Floor and ceiling are both ${this.m.mine(r, c)}.`);
      this.note.set("Neither side can improve on it.");
      this.wait = 1.9;
    } else {
      this.cue("bad");
      this.wrong = [r, c];
      const fl = this.m.maximin().worst[r]!;
      const ce = this.m.minimax().best[c]!;
      this.prompt.set("Not quite. Check the floor and the ceiling.");
      this.note.set(`Row ${ROW(r)} floors at ${fl}. Column ${COL_NAMES[c]} caps at ${ce}. They must match.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.meet.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7) this.revealRow();
    }
    if (this.beat === "prove" && this.won && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Guarantee your best worst case.");
          this.note.set("In pure conflict the rival does the same, and the two meet.");
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
    const gv = this.gv;
    const a = this.intro.value;
    const m = this.m;
    gv.grid(p, c, a);
    const mm = m.maximin();
    const mx = m.minimax();
    const sad = m.saddle();
    const showAll = this.beat === "prove" && this.won;
    const wr = this.wrong;
    for (let r = 0; r < 3; r++) gv.rowLabel(p, c, r, ROW(r), { alpha: a, on: this.chosen === r });
    for (let k = 0; k < 3; k++) gv.colLabel(p, c, k, COL_NAMES[k]!, { alpha: a });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const mine = m.mine(r, k);
      const theirs = m.theirs(r, k);
      if (this.beat === "feel") {
        const open = this.shown[r]! || (this.locked && this.chosen === r);
        if (!open) continue;
        const worst = m.worstCol(r) === k;
        gv.cell(p, c, r, k, mine, theirs, { alpha: a, dashed: !worst, ringBest: worst ? 1 : 0 });
        continue;
      }
      let wash = 0;
      let youBest = 0;
      let ringBest = 0;
      if (this.beat === "see") {
        if (this.floors[r] && m.worstCol(r) === k) youBest = 1;
        if (this.ceils[k] && mine === mx.best[k]) ringBest = 1;
        if (this.allSeen && sad && sad[0] === r && sad[1] === k) wash = 0.1 * this.meet.value;
      } else {
        if (showAll && sad && sad[0] === r && sad[1] === k) {
          wash = 0.12 * this.meet.value;
          youBest = this.meet.value;
          ringBest = this.meet.value;
        }
        if (wr && wr[0] === r && wr[1] === k) wash = 0.08;
      }
      gv.cell(p, c, r, k, mine, theirs, { alpha: a, wash, youBest, ringBest });
    }
    // Margin numbers: row floors on the right, column ceilings below.
    for (let r = 0; r < 3; r++) {
      const on = this.beat === "see" ? this.floors[r]! : showAll || (wr !== null && wr[0] === r);
      if (!on) continue;
      const y = gv.y0 + (r + 0.5) * gv.cellH;
      const x = gv.right + 17;
      p.text(String(mm.worst[r]), x, y, { font: Type.mono(13), color: c.ink, align: "center", base: "middle" });
      if (this.allSeen || showAll) if (mm.worst[r] === mm.value) p.ring(x, y, 11, c.ink, 1.25, this.meet.value);
    }
    for (let k = 0; k < 3; k++) {
      const on = this.beat === "see" ? this.ceils[k]! : showAll || (wr !== null && wr[1] === k);
      if (!on) continue;
      const x = gv.x0 + (k + 0.5) * gv.cellW;
      const y = gv.bottom + 14;
      p.text(String(mx.best[k]), x, y, { font: Type.mono(13), color: c.ink, align: "center", base: "middle" });
      if (this.allSeen || showAll) if (mx.best[k] === mx.value) p.ring(x, y, 11, c.ink, 1.25, this.meet.value);
    }
    const n = this.beat === "feel" ? ROUNDS : this.beat === "see" ? 6 : 2;
    const done = this.beat === "feel" ? this.round : this.beat === "see" ? this.floors.filter(Boolean).length + this.ceils.filter(Boolean).length : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}

function ROW(r: number): string {
  return ROW_NAMES[r]!;
}
