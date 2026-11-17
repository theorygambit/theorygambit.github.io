import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { MatrixView, inside } from "../shared/MatrixView";
import { DominanceMatrix, FEEL_MATRIX, feelColumns, proveSet, type Col, type Row } from "./model";

const ROW_NAME = ["Up", "Down"] as const;
const COL_NAME = ["Left", "Right"] as const;

/**
 * Feel: pick a row four times while the other player picks a column. Each round
 * also shows what the other row would have paid, so you collect the evidence.
 * See: tap each column and watch which row wins there. The same row wins in both.
 * Prove: three new tables. Name the dominant row, or say there is none.
 */
export class DominantStrategyGame extends Game {
  readonly slug = "dominant-strategy";
  private readonly mv = new MatrixView();
  private matrix: DominanceMatrix = FEEL_MATRIX;
  private cols: Col[] = [];
  private round = 0;
  private locked = false;
  private chosen: Row | null = null;
  private lastCol: Col | null = null;
  private sinceReveal = 0;
  private known = new Set<string>();

  private readonly intro = new Damped(0, 0.7);
  private readonly youY = new Damped(0, 0.35);
  private readonly otherX = new Damped(0, 0.4);
  private readonly solid: Damped[][] = [[new Damped(0, 0.4), new Damped(0, 0.4)], [new Damped(0, 0.4), new Damped(0, 0.4)]];
  private readonly ghost: Damped[][] = [[new Damped(0, 0.4), new Damped(0, 0.4)], [new Damped(0, 0.4), new Damped(0, 0.4)]];
  private readonly arrow: Damped[] = [new Damped(0, 0.5), new Damped(0, 0.5)];
  private readonly bracket = new Damped(0, 0.6);
  private seenCols = new Set<Col>();

  private puzzles = proveSet(this.env.rng);
  private pi = 0;
  private picked: Row | "none" | null = null;
  private solved = 0;
  private proveWait = 0;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly ansUp = this.add(new CanvasButton("Up", () => this.answer(0)));
  private readonly ansNone = this.add(new CanvasButton("None", () => this.answer("none")));
  private readonly ansDown = this.add(new CanvasButton("Down", () => this.answer(1)));
  private readonly again = this.add(new CanvasButton("Try again", () => this.retry(), "primary"));

  begin(): void {
    this.matrix = FEEL_MATRIX;
    this.cols = feelColumns(this.env.rng);
    this.round = 0;
    this.locked = false;
    this.chosen = null;
    this.lastCol = null;
    this.known.clear();
    this.seenCols.clear();
    this.solved = 0;
    this.pi = 0;
    this.picked = null;
    this.puzzles = proveSet(this.env.rng);
    for (const row of [...this.solid, ...this.ghost]) for (const d of row) d.snap(0);
    for (const a of this.arrow) a.snap(0);
    this.bracket.snap(0);
    this.intro.snap(0);
    this.intro.set(1);
    this.youY.snap(0.5);
    this.otherX.snap(0.5);
    this.setBeat("feel");
    this.prompt.set("Pick a row. They pick a column at the same time.");
    this.note.set("");
    this.syncButtons();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (const r of [0, 1] as const) for (const c of [0, 1] as const) {
      this.solid[r]![c]!.snap(1);
      this.known.add(`${r}${c}`);
    }
    this.enterSee();
    if (beat === "prove") {
      this.seenCols.add(0).add(1);
      this.enterProve();
    }
  }

  protected layout(): void {
    const avail = this.h - 70 - 150;
    this.mv.fit(this.cx, 0, this.colW, avail - 56);
    const used = this.mv.colLabelH + 2 * this.mv.cell + 56;
    this.mv.fit(this.cx, 150 + Math.max(0, (avail - used) / 2), this.colW, avail - 56);
    const by = this.h - 80;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.again.place(this.cx - 80, by, 160);
    const bw = Math.min(110, (this.colW - 24) / 3);
    this.ansUp.place(this.cx - bw * 1.5 - 12, by, bw);
    this.ansNone.place(this.cx - bw / 2, by, bw);
    this.ansDown.place(this.cx + bw / 2 + 12, by, bw);
  }

  private syncButtons(): void {
    const feelDone = this.beat === "feel" && this.round >= 4 && !this.locked;
    const seeDone = this.beat === "see" && this.seenCols.size === 2;
    const proving = this.beat === "prove" && this.picked === null;
    this.toSee.visible = feelDone;
    this.toProve.visible = seeDone;
    for (const b of [this.ansUp, this.ansNone, this.ansDown]) b.visible = proving;
    this.again.visible = this.beat === "prove" && this.picked !== null && !this.isRight(this.picked);
  }

  private isRight(a: Row | "none"): boolean {
    const want = this.puzzles[this.pi]!.answer;
    return a === "none" ? want === null : a === want;
  }

  // ---- Feel -------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && !this.locked && this.round < 4) {
      for (const r of [0, 1] as const) if (inside(this.mv.rowStrip(r), x, y)) return this.play(r);
    } else if (this.beat === "see") {
      for (const c of [0, 1] as const) if (inside(this.mv.colStrip(c), x, y)) return this.inspect(c);
    }
  }

  private play(r: Row): void {
    const col = this.cols[this.round]!;
    this.chosen = r;
    this.lastCol = col;
    this.locked = true;
    this.sinceReveal = 0;
    this.youY.set(r);
    this.otherX.set(col);
    this.prompt.set(this.round === 0 ? "Watch what each row pays." : "Again. Pick a row.");
    this.note.set("");
    this.syncButtons();
  }

  private revealRound(): void {
    const r = this.chosen!;
    const c = this.lastCol!;
    const got = this.matrix.payoff(r, c);
    const alt = this.matrix.payoff(this.matrix.other(r), c);
    this.solid[r]![c]!.set(1);
    this.known.add(`${r}${c}`);
    this.ghost[this.matrix.other(r)]![c]!.set(1);
    this.known.add(`${this.matrix.other(r)}${c}`);
    this.note.set(`You took ${got}. The other row would have paid ${alt}.`);
    this.announce(`Round ${this.round + 1}. You chose ${ROW_NAME[r]}, they chose ${COL_NAME[c]}. You got ${got}. The other row would have paid ${alt}.`);
    this.round++;
    this.locked = false;
    if (this.round >= 4) {
      this.prompt.set("Four rounds. Look at the pattern.");
      this.syncButtons();
    }
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.chosen = null;
    this.lastCol = null;
    for (const r of [0, 1] as const) for (const c of [0, 1] as const) {
      this.solid[r]![c]!.set(1);
      this.ghost[r]![c]!.set(0);
    }
    this.prompt.set("Tap each column. Which row pays more there?");
    this.note.set("");
    this.syncButtons();
  }

  private inspect(c: Col): void {
    this.seenCols.add(c);
    this.arrow[c]!.set(1);
    const best = this.matrix.bestRow(c)!;
    this.note.set(`Against ${COL_NAME[c]}, ${ROW_NAME[best]} pays more.`);
    if (this.seenCols.size === 2) {
      const dom = this.matrix.dominantRow();
      this.bracket.set(1);
      this.prompt.set(`${ROW_NAME[dom ?? 1]} wins in both columns. That is a dominant strategy.`);
      this.note.set("It is best whatever they do, so you can stop guessing.");
      this.announce(`${ROW_NAME[dom ?? 1]} is better in both columns. It is dominant.`);
    }
    this.syncButtons();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.matrix = this.puzzles[this.pi]!.matrix;
    this.picked = null;
    this.proveWait = 0;
    for (const r of [0, 1] as const) for (const c of [0, 1] as const) {
      this.solid[r]![c]!.snap(0);
      this.solid[r]![c]!.set(1);
      this.ghost[r]![c]!.snap(0);
    }
    for (const a of this.arrow) a.snap(0);
    this.bracket.snap(0);
    this.prompt.set(this.pi === 0 ? "A new table. Is one row better in both columns?" : "Another table. Same question.");
    this.note.set("");
    this.syncButtons();
  }

  private answer(a: Row | "none"): void {
    if (this.picked !== null) return;
    this.picked = a;
    this.arrow[0]!.set(1);
    this.arrow[1]!.set(1);
    const want = this.puzzles[this.pi]!.answer;
    if (this.isRight(a)) {
      if (want !== null) this.bracket.set(1);
      this.prompt.set(want === null ? "Right. Each column points a different way." : `Right. ${ROW_NAME[want]} wins in both columns.`);
      this.note.set(want === null ? "No row is dominant, so you have to read the other player." : "Dominant, so you can ignore what they do.");
      this.solved++;
      this.proveWait = 1.5;
    } else {
      const l = this.matrix.bestRow(0)!;
      const r = this.matrix.bestRow(1)!;
      this.prompt.set("Not quite. Look at where each arrow points.");
      this.note.set(l === r ? `${ROW_NAME[l]} wins in both columns.` : `${COL_NAME[0]} favors ${ROW_NAME[l]}, ${COL_NAME[1]} favors ${ROW_NAME[r]}.`);
    }
    this.syncButtons();
  }

  private retry(): void {
    this.loadPuzzle();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youY.step(dt);
    this.otherX.step(dt);
    this.bracket.step(dt);
    for (const a of this.arrow) a.step(dt);
    for (const row of [...this.solid, ...this.ghost]) for (const d of row) d.step(dt);

    if (this.beat === "feel" && this.locked) {
      this.sinceReveal += dt;
      if (this.sinceReveal > 0.7) this.revealRound();
    }
    if (this.beat === "prove" && this.proveWait > 0) {
      this.proveWait -= dt;
      if (this.proveWait <= 0) {
        if (this.solved >= 3) {
          this.prompt.set("A dominant strategy is best against everything they could do.");
          this.note.set("Spot it and you can ignore your opponent.");
          this.finish();
          this.syncButtons();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors): void {
    const mv = this.mv;
    const a = this.intro.value;
    this.prompt.draw(p, c, this.colX, 82, this.colW);

    mv.grid(p, c, a);
    this.drawLabels(p, c, a);
    this.drawDiscs(p, c);
    this.drawArrows(p, c);

    this.note.draw(p, c, this.cx, mv.bottom + 34, this.colW, "center");

    if (this.beat === "feel") this.drawRounds(p, c);
    if (this.beat === "prove" || this.beat === "done") this.drawPuzzleTicks(p, c);
  }

  private drawLabels(p: Painter, c: Colors, a: number): void {
    const mv = this.mv;
    const youActive = this.chosen !== null || this.beat !== "feel";
    ([0, 1] as const).forEach((r) => {
      const y = mv.rowY(r);
      const on = this.chosen === r || (this.beat === "see" && this.matrix.dominantRow() === r && this.bracket.value > 0.5);
      p.text(ROW_NAME[r], mv.x0 - 18, y, { font: Type.body(15, 400), color: on ? c.ink : c.fog, align: "right", base: "middle", alpha: a });
    });
    ([0, 1] as const).forEach((col) => {
      const x = mv.colX(col);
      const on = this.lastCol === col || this.seenCols.has(col);
      p.text(COL_NAME[col], x, mv.y0 - 14, { font: Type.body(15, 400), color: on ? c.ink : c.fog, align: "center", alpha: a });
    });
    // You: a filled disc that slides to the chosen row. Other: a ring that slides to the chosen column.
    const yy = mv.y0 + (this.youY.value + 0.5) * mv.cell;
    const xx = mv.x0 + (this.otherX.value + 0.5) * mv.cell;
    if (this.beat === "feel") {
      Glyph.you(p, c, mv.x0 - mv.rowLabelW + 8, yy, 5, a * (youActive ? 1 : 0.55));
      const idle = this.locked || this.lastCol !== null ? 1 : 0.55 + 0.25 * Math.sin(this.time * 2.2);
      Glyph.other(p, c, xx, mv.y0 - 42, 7, a * idle);
    }
  }

  private drawDiscs(p: Painter, c: Colors): void {
    const mv = this.mv;
    for (const r of [0, 1] as const) for (const col of [0, 1] as const) {
      const ctr = mv.center(r, col);
      const v = this.matrix.payoff(r, col);
      const s = this.solid[r]![col]!.value;
      const g = this.ghost[r]![col]!.value;
      if (g > 0.01) p.ring(ctr.x, ctr.y, mv.radius(v) * g, c.ink, 1.25, 0.7 * g);
      if (s > 0.01) {
        p.disc(ctr.x, ctr.y, mv.radius(v) * s, c.ink, 0.92);
        mv.number(p, c, r, col, v, s);
      }
      if (g > 0.01 && s <= 0.01) mv.number(p, c, r, col, v, g);
    }
  }

  private drawArrows(p: Painter, c: Colors): void {
    const mv = this.mv;
    for (const col of [0, 1] as const) {
      const t = this.arrow[col]!.value;
      if (t < 0.02) continue;
      const best = this.matrix.bestRow(col)!;
      const x = mv.colX(col) - mv.cell * 0.44;
      const y0 = mv.rowY(mv.matrixOther(best));
      const y1 = mv.rowY(best);
      p.arrow(x, y0, x, y0 + (y1 - y0) * t, c.ink, 1.5, t, 8);
    }
    const br = this.bracket.value;
    const dom = this.matrix.dominantRow();
    if (br > 0.02 && dom !== null) {
      const y = mv.y0 + dom * mv.cell;
      p.rect(mv.x0 - 8, y + 6, 3, (mv.cell - 12) * br, c.ink, br);
    }
  }

  private drawRounds(p: Painter, c: Colors): void {
    const x = this.cx - 30;
    const y = this.h - 22 - (this.toSee.visible ? 0 : 0);
    for (let i = 0; i < 4; i++) Glyph.step(p, c, x + i * 20, y, i < this.round, i === this.round);
  }

  private drawPuzzleTicks(p: Painter, c: Colors): void {
    const x = this.cx - 20;
    const y = this.h - 22;
    for (let i = 0; i < 3; i++) Glyph.step(p, c, x + i * 20, y, i < this.solved, i === this.solved && this.beat === "prove");
  }
}
