import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import type { Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import type { Bimatrix } from "../shared/Bimatrix";
import { COL_NAMES, ROW_NAMES, liveColumns, solvableTable, tryStrike } from "./model";

type Kind = "row" | "col";
const ROUNDS = 3;

/**
 * Feel: pick a row three times. The other player never picks a column that is always worse for them.
 * See: strike what is always worse, one choice at a time, with the next strike hinted.
 * Prove: two new tables. Strike down to the one cell that survives.
 */
export class IteratedEliminationGame extends Game {
  readonly slug = "iterated-elimination";
  private readonly gv = new GridView(3, 3);
  private m!: Bimatrix;
  private rowsAlive = [0, 1, 2];
  private colsAlive = [0, 1, 2];
  private order: { kind: Kind; index: number }[] = [];
  private readonly rowFade = [new Damped(1, 0.4), new Damped(1, 0.4), new Damped(1, 0.4)];
  private readonly colFade = [new Damped(1, 0.4), new Damped(1, 0.4), new Damped(1, 0.4)];

  private round = 0;
  private locked = false;
  private chosen = -1;
  private col = -1;
  private since = 0;
  private revealed: boolean[][] = [];
  private played: boolean[][] = [];
  private readonly intro = new Damped(0, 0.7);
  private readonly winner = new Damped(0, 0.6);

  private puzzles: Bimatrix[] = [];
  private pi = 0;
  private solved = 0;
  private wait = 0;
  private won = false;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.m = solvableTable(this.env.rng);
    this.resetTable();
    this.round = 0;
    this.locked = false;
    this.chosen = -1;
    this.col = -1;
    this.revealed = [0, 1, 2].map(() => [false, false, false]);
    this.played = [0, 1, 2].map(() => [false, false, false]);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.pi = 0;
    this.setBeat("feel");
    this.prompt.set("Pick a row. They pick a column.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.revealed = [0, 1, 2].map(() => [true, true, true]);
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  private resetTable(): void {
    this.rowsAlive = [0, 1, 2];
    this.colsAlive = [0, 1, 2];
    this.order = [];
    this.won = false;
    for (const d of [...this.rowFade, ...this.colFade]) d.snap(1);
    this.winner.snap(0);
  }

  protected layout(): void {
    this.gv.fit(this.frame);
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS && !this.locked;
    this.toProve.visible = this.beat === "see" && this.won;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.locked || this.round >= ROUNDS) return;
      for (let r = 0; r < 3; r++) if (inside(this.gv.rowStrip(r), x, y)) return this.play(r);
      return;
    }
    if (this.won || this.beat === "done") return;
    for (let r = 0; r < 3; r++) if (inside(this.gv.rowLabelBox(r), x, y)) return this.strike("row", r);
    for (let c = 0; c < 3; c++) if (inside(this.gv.colLabelBox(c), x, y)) return this.strike("col", c);
  }

  // ---- Feel -------------------------------------------------------------

  private play(r: number): void {
    const live = liveColumns(this.m);
    this.chosen = r;
    this.col = this.env.rng.pick(live);
    this.locked = true;
    this.since = 0;
    this.prompt.set(this.round === 0 ? "Watch what each row pays." : "Again. Pick a row.");
    this.note.set("");
    this.sync();
  }

  private revealRound(): void {
    const r = this.chosen;
    const c = this.col;
    for (let i = 0; i < 3; i++) this.revealed[i]![c] = true;
    this.played[r]![c] = true;
    const got = this.m.mine(r, c);
    const best = this.m.bestRows(c)[0]!;
    const bestPay = this.m.mine(best, c);
    this.note.set(best === r ? `They chose ${COL_NAMES[c]}. You got ${got}, the most there.` : `They chose ${COL_NAMES[c]}. You got ${got}. Row ${ROW_NAMES[best]} paid ${bestPay}.`);
    this.announce(`Round ${this.round + 1}. You chose row ${ROW_NAMES[r]}, they chose column ${COL_NAMES[c]}. You got ${got}.`);
    this.round++;
    this.locked = false;
    this.prompt.set(this.round >= ROUNDS ? "Three rounds. Which columns did they use?" : "Pick a row again.");
    this.sync();
  }

  // ---- See and Prove: striking --------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.resetTable();
    this.revealed = [0, 1, 2].map(() => [true, true, true]);
    this.prompt.set("Strike a choice that is always worse.");
    this.note.set("Tap the ringed label.");
    this.sync();
  }

  /** The next legal strike, shown as a hint in See only. */
  private hint(): { kind: Kind; index: number } | null {
    if (this.beat !== "see" || this.won) return null;
    const dr = this.m.dominatedRow(this.rowsAlive, this.colsAlive);
    if (dr) return { kind: "row", index: dr.index };
    const dc = this.m.dominatedCol(this.rowsAlive, this.colsAlive);
    return dc ? { kind: "col", index: dc.index } : null;
  }

  private strike(kind: Kind, index: number): void {
    const alive = kind === "row" ? this.rowsAlive : this.colsAlive;
    if (!alive.includes(index) || alive.length <= 1) return;
    const res = tryStrike(this.m, this.rowsAlive, this.colsAlive, kind, index);
    const name = kind === "row" ? ROW_NAMES[index]! : COL_NAMES[index]!;
    if (!res.ok) {
      this.cue("bad");
      const w = res.why!;
      const other = kind === "row" ? ROW_NAMES[w.other]! : COL_NAMES[w.other]!;
      const here = kind === "row" ? COL_NAMES[w.against]! : ROW_NAMES[w.against]!;
      const a = kind === "row" ? this.m.mine(index, w.against) : this.m.theirs(w.against, index);
      const b = kind === "row" ? this.m.mine(w.other, w.against) : this.m.theirs(w.against, w.other);
      this.prompt.set(`${name} is not always worse.`);
      this.note.set(`Against ${here} it pays ${a}, ${other} pays ${b}.`);
      return;
    }
    this.cue("good");
    this.order.push({ kind, index });
    if (kind === "row") {
      this.rowsAlive = this.rowsAlive.filter((r) => r !== index);
      this.rowFade[index]!.set(0.16);
    } else {
      this.colsAlive = this.colsAlive.filter((c) => c !== index);
      this.colFade[index]!.set(0.16);
    }
    if (this.rowsAlive.length === 1 && this.colsAlive.length === 1) {
      this.won = true;
      this.winner.set(1);
      const r = this.rowsAlive[0]!;
      const c = this.colsAlive[0]!;
      this.prompt.set(`One cell is left: ${ROW_NAMES[r]}, ${COL_NAMES[c]}.`);
      this.note.set(this.beat === "see" ? "Each strike made the next one possible." : "No one wants to move from there.");
      this.announce(`One cell left, row ${ROW_NAMES[r]} column ${COL_NAMES[c]}, after ${this.order.length} strikes.`);
      if (this.beat === "prove") {
        this.solved++;
        this.wait = 1.9;
      }
    } else {
      this.prompt.set(this.order.length === 1 ? `${name} is gone. Look again.` : "Gone. Strike the next one.");
      this.note.set(this.beat === "see" ? "Tap the ringed label." : "Fewer choices can make others worse.");
    }
    this.sync();
  }

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [solvableTable(this.env.rng), solvableTable(this.env.rng)];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.m = this.puzzles[this.pi]!;
    this.resetTable();
    this.revealed = [0, 1, 2].map(() => [true, true, true]);
    this.prompt.set(this.pi === 0 ? "A new table. Strike down to one cell." : "Another table. Strike it down.");
    this.note.set("Strike a row or a column that is always worse.");
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.winner.step(dt);
    for (const d of [...this.rowFade, ...this.colFade]) d.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7) this.revealRound();
    }
    if (this.beat === "prove" && this.won && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Strike what is always worse, and repeat.");
          this.note.set("Whatever survives is where rational players end.");
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
    const hint = this.hint();
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    for (let r = 0; r < 3; r++) {
      const fade = this.rowFade[r]!.value;
      const struck = !this.rowsAlive.includes(r);
      gv.rowLabel(p, c, r, ROW_NAMES[r]!, { alpha: a * (struck ? 0.4 : 1), on: !struck && (this.chosen === r || this.won) });
      const o = this.order.findIndex((s) => s.kind === "row" && s.index === r);
      if (o >= 0) gv.rowTag(p, c, r, String(o + 1), 1 - fade * 0.4);
      if (hint && hint.kind === "row" && hint.index === r) {
        const q = gv.rowLabelBox(r);
        p.ring(q.x + q.w - 15, q.y + q.h / 2, 14, c.ink, 1.25, 0.35 + 0.5 * pulse);
      }
    }
    for (let k = 0; k < 3; k++) {
      const struck = !this.colsAlive.includes(k);
      gv.colLabel(p, c, k, COL_NAMES[k]!, { alpha: a * (struck ? 0.4 : 1), on: !struck && (this.col === k || this.won) });
      const o = this.order.findIndex((s) => s.kind === "col" && s.index === k);
      if (o >= 0) gv.colTag(p, c, k, String(o + 1), 0.7);
      if (hint && hint.kind === "col" && hint.index === k) {
        const q = gv.colLabelBox(k);
        p.ring(q.x + q.w / 2, q.y + q.h - 14, 14, c.ink, 1.25, 0.35 + 0.5 * pulse);
      }
    }
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const alpha = Math.min(this.rowFade[r]!.value, this.colFade[k]!.value);
      const keep = this.won && this.rowsAlive[0] === r && this.colsAlive[0] === k;
      if (this.beat === "feel") {
        const shown = this.revealed[r]![k]!;
        const now = this.locked && this.chosen === r && this.col === k;
        if (!shown && !now) continue;
        gv.cell(p, c, r, k, this.m.mine(r, k), this.m.theirs(r, k), { alpha: a, dashed: shown && !this.played[r]![k] });
      } else {
        gv.cell(p, c, r, k, this.m.mine(r, k), this.m.theirs(r, k), { alpha: alpha * a, wash: keep ? 0.1 * this.winner.value : 0, youBest: keep ? this.winner.value : 0, ringBest: keep ? this.winner.value : 0 });
      }
    }
    if (this.beat === "feel" && this.locked) {
      const q = gv.youPos(this.chosen, this.col);
      p.ring(q.x, q.y, gv.maxR + 3, c.ink, 1, 0.5);
    }
    const n = this.beat === "feel" ? ROUNDS : this.beat === "prove" || this.beat === "done" ? 2 : 0;
    const done = this.beat === "feel" ? this.round : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
    if (this.beat === "see") {
      const total = this.order.length;
      for (let i = 0; i < 4; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < total, i === total && !this.won);
    }
  }
}
