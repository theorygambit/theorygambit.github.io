import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import type { Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import { sameCells } from "../nash-equilibrium/model";
import { FEEL_GRID, randomPotential, type Potential } from "./model";

const ROW = ["A", "B", "C"] as const;
const COL = ["X", "Y", "Z"] as const;
const WALKS = 2;

/**
 * Feel: choose a start cell, then let players improve one at a time until the climb stops.
 * See: two taps mark every cell's improving moves. Cells with none are stable.
 * Prove: two new grids. Tap every cell where neither player can improve.
 */
export class PotentialGamesGame extends Game {
  readonly slug = "potential-games";
  private readonly gv = new GridView(3, 3, 9);
  private grid: Potential = FEEL_GRID;
  private path: [number, number][] = [];
  private pi = 0;
  private walks = 0;
  private readonly intro = new Damped(0, 0.7);
  private readonly pulse = new Damped(0, 0.4);

  private seeStep = 0;
  private readonly rowArrows = new Damped(0, 0.5);
  private readonly colArrows = new Damped(0, 0.5);
  private readonly stable = new Damped(0, 0.6);

  private puzzles: Potential[] = [];
  private pj = 0;
  private picked = new Set<string>();
  private locked = false;
  private solved = 0;
  private wait = 0;
  private shown: [number, number] | null = null;

  private readonly improve = this.add(new CanvasButton("Improve", () => this.advance(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.grid = FEEL_GRID;
    this.path = [];
    this.pi = 0;
    this.walks = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Tap a starting cell.");
    this.note.set("Then players improve one move at a time.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.walks = WALKS;
    this.enterSee();
    if (beat === "see") return;
    this.seeStep = 3;
    this.enterProve();
  }

  protected layout(): void {
    this.gv.fit(this.frame);
    const by = this.buttonY;
    this.improve.place(this.cx - 80, by, 160);
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private get walking(): boolean {
    return this.path.length > 0 && this.pi < this.path.length - 1;
  }

  private sync(): void {
    this.improve.visible = this.beat === "feel" && this.walking;
    this.toSee.visible = this.beat === "feel" && !this.walking && this.walks >= WALKS;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 3;
    this.lock.visible = this.beat === "prove" && !this.locked && this.picked.size > 0;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const cell = this.gv.cellAt(x, y);
    if (this.beat === "feel") {
      if (cell && !this.walking) this.start(cell[0], cell[1]);
    } else if (this.beat === "see") this.reveal();
    else if (this.beat === "prove" && !this.locked && cell) this.toggle(cell[0], cell[1]);
  }

  // ---- Feel -------------------------------------------------------------

  private start(r: number, c: number): void {
    this.path = this.grid.walk(r, c);
    this.pi = 0;
    this.pulse.snap(0);
    this.pulse.set(1);
    this.cue("good");
    if (this.path.length === 1) {
      this.walks++;
      this.prompt.set("Nobody can improve from here.");
      this.note.set(`${ROW[r]}${COL[c]} is already stable. Pick another start.`);
    } else {
      this.prompt.set("Press Improve. One player moves.");
      this.note.set(`Score ${this.grid.phi[r]![c]}. Each move raises it.`);
    }
    this.sync();
  }

  private advance(): void {
    if (!this.walking) return;
    this.pi++;
    const [r, c] = this.path[this.pi]!;
    const v = this.grid.phi[r]![c]!;
    this.pulse.snap(0);
    this.pulse.set(1);
    this.cue("good");
    if (this.pi >= this.path.length - 1) {
      this.walks++;
      this.prompt.set("Stuck. Nobody can improve.");
      this.note.set(`Stopped at ${ROW[r]}${COL[c]} with score ${v}. ${v < 9 ? "A higher peak sits elsewhere." : "The highest peak."}`);
      this.announce(`Stopped at ${ROW[r]}${COL[c]} with score ${v}.`);
    } else {
      this.prompt.set(`Moved to ${ROW[r]}${COL[c]}.`);
      this.note.set(`Score ${v}. It only goes up.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.grid = FEEL_GRID;
    this.seeStep = 0;
    this.rowArrows.snap(0);
    this.colArrows.snap(0);
    this.stable.snap(0);
    this.path = [];
    this.prompt.set("Tap. Who can improve in each cell?");
    this.note.set("First the row player, moving up or down.");
    this.sync();
  }

  private reveal(): void {
    if (this.seeStep >= 3) return;
    this.seeStep++;
    this.cue("good");
    if (this.seeStep === 1) {
      this.rowArrows.set(1);
      this.prompt.set("Arrows show a better row.");
      this.note.set("Now the column player, moving sideways. Tap.");
    } else if (this.seeStep === 2) {
      this.colArrows.set(1);
      this.prompt.set("Arrows show a better column.");
      this.note.set("Cells with no arrow are stable. Tap.");
    } else {
      this.stable.set(1);
      const n = this.grid.equilibria().length;
      this.prompt.set(`${n} cells have no arrow.`);
      this.note.set("They are the peaks. Where you land depends on where you start.");
      this.announce(`${n} cells have no improving move for either player. They are the local peaks.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [randomPotential(this.env.rng, 1), randomPotential(this.env.rng, 2)];
    this.pj = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.grid = this.puzzles[this.pj]!;
    this.picked.clear();
    this.locked = false;
    this.shown = null;
    this.stable.snap(0);
    const n = this.grid.equilibria().length;
    this.prompt.set(this.pj === 0 ? "New scores. Tap every stable cell." : "Another grid. Tap every stable cell.");
    this.note.set(n === 1 ? "Stable means neither player can improve." : "There is more than one.");
    this.sync();
  }

  private toggle(r: number, c: number): void {
    const k = `${r}${c}`;
    if (this.picked.has(k)) this.picked.delete(k);
    else this.picked.add(k);
    this.shown = null;
    this.sync();
  }

  private lockIn(): void {
    const mine = [...this.picked].map((k) => [Number(k[0]), Number(k[1])] as [number, number]);
    const eq = this.grid.equilibria();
    if (sameCells(mine, eq)) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.stable.snap(0);
      this.stable.set(1);
      this.shown = null;
      this.prompt.set("Right. No one can improve there.");
      this.note.set(`${eq.length} peak${eq.length === 1 ? "" : "s"} of the shared score.`);
      this.wait = 2;
    } else {
      this.cue("bad");
      const wrong = mine.find(([r, c]) => !this.grid.game.isEquilibrium(r, c));
      if (wrong) {
        this.shown = wrong;
        this.rowArrows.snap(0);
        this.rowArrows.set(1);
        const rm = this.grid.rowMove(wrong[0], wrong[1]);
        const cm = this.grid.colMove(wrong[0], wrong[1]);
        this.prompt.set(`${ROW[wrong[0]]}${COL[wrong[1]]} is not stable.`);
        this.note.set(rm !== null ? `Row ${ROW[rm]} scores ${this.grid.phi[rm]![wrong[1]]}, more than ${this.grid.phi[wrong[0]]![wrong[1]]}.` : `Column ${COL[cm!]} scores ${this.grid.phi[wrong[0]]![cm!]}, more than ${this.grid.phi[wrong[0]]![wrong[1]]}.`);
      } else {
        this.prompt.set("Not quite. You missed a stable cell.");
        this.note.set("Look for a cell that is highest in its row and its column.");
      }
      this.picked.clear();
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.pulse.step(dt);
    this.rowArrows.step(dt);
    this.colArrows.step(dt);
    this.stable.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Selfish moves climb until they reach a peak.");
          this.note.set("Every local peak of the shared score is an equilibrium.");
          this.finish();
          this.sync();
        } else {
          this.pj++;
          this.loadPuzzle();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  private arrows(p: Painter, c: Colors, r: number, k: number, rows: number, cols: number): void {
    const gv = this.gv;
    const b = gv.rect(r, k);
    if (rows > 0.02) {
      const rm = this.grid.rowMove(r, k);
      if (rm !== null) {
        const dir = rm > r ? 1 : -1;
        const x = b.x + 8;
        const y = b.y + b.h * 0.4;
        p.arrow(x, y - dir * 8, x, y + dir * 8, c.ink, 1.25, rows, 5);
      }
    }
    if (cols > 0.02) {
      const cm = this.grid.colMove(r, k);
      if (cm !== null) {
        const dir = cm > k ? 1 : -1;
        const x = b.x + b.w * 0.5;
        const y = b.y + 5;
        p.arrow(x - dir * 8, y, x + dir * 8, y, c.ink, 1.25, cols, 5);
      }
    }
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    const gv = this.gv;
    const a = this.intro.value;
    gv.grid(p, c, a);
    const cur = this.beat === "feel" && this.path.length ? this.path[this.pi]! : null;
    for (let r = 0; r < 3; r++) gv.rowLabel(p, c, r, ROW[r]!, { alpha: a, on: cur?.[0] === r });
    for (let k = 0; k < 3; k++) gv.colLabel(p, c, k, COL[k]!, { alpha: a, on: cur?.[1] === k });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      const v = this.grid.phi[r]![k]!;
      let wash = 0;
      let youBest = 0;
      if (this.beat === "feel") {
        const visited = this.path.slice(0, this.pi + 1).findIndex(([a2, b2]) => a2 === r && b2 === k);
        if (visited >= 0) youBest = visited === this.pi ? 1 : 0.35;
        if (cur && cur[0] === r && cur[1] === k) wash = 0.1 * this.pulse.value + 0.04;
      } else if (this.beat === "see") {
        if (this.grid.game.isEquilibrium(r, k)) {
          wash = 0.1 * this.stable.value;
          youBest = this.stable.value;
        }
      } else {
        if (this.picked.has(`${r}${k}`)) {
          wash = 0.12;
          youBest = 1;
        }
        if (this.locked && this.grid.game.isEquilibrium(r, k)) {
          wash = 0.12;
          youBest = this.stable.value;
        }
        if (this.shown && this.shown[0] === r && this.shown[1] === k) wash = Math.max(wash, 0.08);
      }
      gv.cell(p, c, r, k, v, v, { alpha: a, ring: false, wash, youBest });
    }
    if (this.beat === "see") {
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) this.arrows(p, c, r, k, this.rowArrows.value, this.colArrows.value);
    } else if (this.beat === "prove" && this.shown) {
      this.arrows(p, c, this.shown[0], this.shown[1], this.rowArrows.value, 1);
    }
    const n = this.beat === "feel" ? WALKS : this.beat === "see" ? 3 : 2;
    const done = this.beat === "feel" ? Math.min(this.walks, WALKS) : this.beat === "see" ? this.seeStep : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
