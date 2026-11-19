import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import type { Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import type { Bimatrix } from "../shared/Bimatrix";
import { equilibriumTable, sameCells } from "./model";

const ROW = ["A", "B", "C"] as const;
const COL = ["X", "Y", "Z"] as const;
const ROUNDS = 4;

interface Probe {
  r: number;
  c: number;
  row: number | null;
  col: number | null;
}

/**
 * Feel: tap an outcome. If either player would switch, an arrow shows where and what it pays.
 * See: ring your best reply in each column, then theirs in each row. Both rings mark an equilibrium.
 * Prove: two new tables. Tap every cell where nobody wants to move.
 */
export class NashEquilibriumGame extends Game {
  readonly slug = "nash-equilibrium";
  private readonly gv = new GridView(3, 3);
  private m!: Bimatrix;
  private probe: Probe | null = null;
  private readonly arrowT = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);
  private round = 0;

  private seeStep = 0;
  private readonly youMarks = new Damped(0, 0.5);
  private readonly ringMarks = new Damped(0, 0.5);
  private readonly stable = new Damped(0, 0.6);

  private puzzles: Bimatrix[] = [];
  private pi = 0;
  private picked = new Set<string>();
  private locked = false;
  private solved = 0;
  private wait = 0;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.m = equilibriumTable(this.env.rng, 1);
    this.probe = null;
    this.round = 0;
    this.arrowT.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.pi = 0;
    this.picked.clear();
    this.locked = false;
    this.setBeat("feel");
    this.prompt.set("Tap an outcome. Does anyone want to move?");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.seeStep = 3;
    this.enterProve();
  }

  protected layout(): void {
    this.gv.fit(this.frame);
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 3;
    this.lock.visible = this.beat === "prove" && !this.locked && this.picked.size > 0;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const cell = this.gv.cellAt(x, y);
    if (this.beat === "feel") {
      if (cell && this.round < ROUNDS) this.tryCell(cell[0], cell[1]);
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked && cell) this.toggle(cell[0], cell[1]);
  }

  // ---- Feel -------------------------------------------------------------

  private tryCell(r: number, c: number): void {
    const d = this.m.deviations(r, c);
    this.probe = { r, c, row: d.row, col: d.col };
    this.arrowT.snap(0);
    this.arrowT.set(1);
    this.round++;
    this.explain(this.probe);
    this.cue(d.row === null && d.col === null ? "good" : "bad");
    if (this.round >= ROUNDS) this.prompt.set("Four outcomes. Look for where nobody moved.");
    this.sync();
  }

  private explain(pr: Probe): void {
    const { r, c } = pr;
    const m = this.m;
    if (pr.row === null && pr.col === null) {
      this.prompt.set("Nobody moves.");
      this.note.set("Both of you already play a best reply.");
    } else {
      this.prompt.set(pr.row !== null && pr.col !== null ? "Both of you would move." : "Someone would move.");
      const parts: string[] = [];
      if (pr.row !== null) parts.push(`You to ${ROW[pr.row]}: ${m.mine(pr.row, c)} beats ${m.mine(r, c)}.`);
      if (pr.col !== null) parts.push(`They to ${COL[pr.col]}: ${m.theirs(r, pr.col)} beats ${m.theirs(r, c)}.`);
      this.note.set(parts.join(" "));
    }
    this.announce(`Row ${ROW[r]}, column ${COL[c]}. ${pr.row === null && pr.col === null ? "Nobody moves." : "Someone would move."}`);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = null;
    this.seeStep = 0;
    this.youMarks.snap(0);
    this.ringMarks.snap(0);
    this.stable.snap(0);
    this.prompt.set("Tap to ring your best reply in each column.");
    this.note.set("The highest payoff you can get when they stay put.");
    this.sync();
  }

  private advance(): void {
    if (this.seeStep >= 3) return;
    this.seeStep++;
    this.cue("good");
    if (this.seeStep === 1) {
      this.youMarks.set(1);
      this.prompt.set("Now their best reply in each row.");
      this.note.set("Tap again. Same idea from their side.");
    } else if (this.seeStep === 2) {
      this.ringMarks.set(1);
      this.prompt.set("Where do both rings meet?");
      this.note.set("Tap again.");
    } else {
      this.stable.set(1);
      const n = this.m.equilibria().length;
      this.prompt.set(n === 1 ? "One cell has both rings. Nobody moves." : "Cells with both rings. Nobody moves.");
      this.note.set("Each is a best reply to the other: a Nash equilibrium.");
      this.announce(`${n} equilibrium, where both best replies meet.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [equilibriumTable(this.env.rng, 2), equilibriumTable(this.env.rng, 2)];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.m = this.puzzles[this.pi]!;
    this.picked.clear();
    this.locked = false;
    this.probe = null;
    this.arrowT.snap(0);
    this.stable.snap(0);
    this.prompt.set(this.pi === 0 ? "New table. Tap every cell where nobody moves." : "Another table. Find every stable cell.");
    this.note.set("There is more than one.");
    this.sync();
  }

  private toggle(r: number, c: number): void {
    const k = `${r}${c}`;
    if (this.picked.has(k)) this.picked.delete(k);
    else this.picked.add(k);
    this.probe = null;
    this.sync();
  }

  private lockIn(): void {
    const mine = [...this.picked].map((k) => [Number(k[0]), Number(k[1])] as [number, number]);
    const eq = this.m.equilibria();
    if (sameCells(mine, eq)) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.stable.snap(0).set(1);
      this.probe = null;
      this.prompt.set("Right. Both are best replies there.");
      this.note.set(`${eq.length} stable cells. Check any other and someone moves.`);
      this.wait = 1.9;
    } else {
      this.cue("bad");
      const wrong = mine.find(([r, c]) => !this.m.isEquilibrium(r, c));
      if (wrong) {
        const d = this.m.deviations(wrong[0], wrong[1]);
        this.probe = { r: wrong[0], c: wrong[1], row: d.row, col: d.col };
        this.arrowT.snap(0);
        this.arrowT.set(1);
        this.explain(this.probe);
        this.prompt.set(`${ROW[wrong[0]]}${COL[wrong[1]]} is not stable.`);
      } else {
        this.prompt.set("Not quite. You missed a stable cell.");
        this.note.set("Look for a cell that is best in its column and in its row.");
      }
      this.picked.clear();
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.arrowT.step(dt);
    this.youMarks.step(dt);
    this.ringMarks.step(dt);
    this.stable.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Stable means each is a best reply to the other.");
          this.note.set("It need not be good. It only has to be stable.");
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
    gv.grid(p, c, a);
    for (let r = 0; r < 3; r++) gv.rowLabel(p, c, r, ROW[r]!, { alpha: a, on: this.probe?.r === r });
    for (let k = 0; k < 3; k++) gv.colLabel(p, c, k, COL[k]!, { alpha: a, on: this.probe?.c === k });
    const pr = this.probe;
    const t = this.arrowT.value;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      let youBest = 0;
      let ringBest = 0;
      let wash = 0;
      if (this.beat === "see") {
        if (this.m.bestRows(k).includes(r)) youBest = this.youMarks.value;
        if (this.m.bestCols(r).includes(k)) ringBest = this.ringMarks.value;
        if (this.m.isEquilibrium(r, k)) wash = 0.1 * this.stable.value;
      }
      if (this.beat === "prove" || this.beat === "done") {
        if (this.picked.has(`${r}${k}`)) {
          wash = 0.12;
          youBest = 1;
          ringBest = 1;
        }
        if (this.locked && this.m.isEquilibrium(r, k)) {
          wash = 0.12;
          youBest = this.stable.value;
          ringBest = this.stable.value;
        }
      }
      if (pr) {
        if (pr.row !== null && pr.c === k && pr.row === r) youBest = Math.max(youBest, t);
        if (pr.col !== null && pr.r === r && pr.col === k) ringBest = Math.max(ringBest, t);
        if (pr.r === r && pr.c === k) wash = Math.max(wash, 0.08);
      }
      gv.cell(p, c, r, k, this.m.mine(r, k), this.m.theirs(r, k), { alpha: a, youBest, ringBest, wash });
    }
    if (pr && t > 0.02) {
      const o = gv.rect(pr.r, pr.c);
      if (pr.row !== null) {
        const d = gv.rect(pr.row, pr.c);
        const x = o.x + 7;
        p.arrow(x, o.y + o.h * 0.4, x, o.y + o.h * 0.4 + (d.y + d.h * 0.4 - (o.y + o.h * 0.4)) * t, c.ink, 1.5, t, 6);
      }
      if (pr.col !== null) {
        const d = gv.rect(pr.r, pr.col);
        const y = o.y + 5;
        p.arrow(o.x + o.w * 0.5, y, o.x + o.w * 0.5 + (d.x - o.x) * t, y, c.ink, 1.5, t, 6);
      }
    }
    const n = this.beat === "feel" ? ROUNDS : this.beat === "see" ? 3 : 2;
    const done = this.beat === "feel" ? this.round : this.beat === "see" ? this.seeStep : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
