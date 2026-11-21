import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { lerp } from "../../core/math";
import { MatrixView } from "../shared/MatrixView";
import { bestReply, columnOf, mapPuzzles, outcome, randomTree, type MapPuzzle, type TreeGame } from "./model";

const ROUNDS = 3;

/**
 * Feel: play three trees as the first mover. They watch your move, then reply.
 * See: tap to fold the tree into a table. The same payoffs fly from the leaves into the cells.
 * Prove: three new games. Find the cell where a described leaf belongs.
 */
export class NormalVsExtensiveGame extends Game {
  readonly slug = "normal-vs-extensive";
  private readonly mv = new MatrixView();
  private tree: TreeGame = randomTree(this.env.rng, 0);
  private order: number[] = [];
  private round = 0;
  private stage: "set" | "wait" | "result" = "set";
  private mine = 0;
  private since = 0;
  private readonly path1 = new Damped(0, 0.3);
  private readonly path2 = new Damped(0, 0.3);
  private readonly known: Damped[][] = [[new Damped(0, 0.3), new Damped(0, 0.3)], [new Damped(0, 0.3), new Damped(0, 0.3)]];
  private readonly intro = new Damped(0, 0.7);

  private readonly fold = new Damped(0, 0.55);
  private sawTable = false;

  private puzzles: MapPuzzle[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);
  private wrongCell = -1;

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  protected override get actionH(): number {
    return this.beat === "feel" && this.stage === "set" ? (this.compact ? 56 : 64) : 44;
  }

  begin(): void {
    this.order = this.env.rng.shuffle([0, 1, 2, 3]);
    this.round = 0;
    this.newTree();
    this.puzzles = mapPuzzles(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.fold.snap(0);
    this.sawTable = false;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("You move first. They watch, then reply.");
    this.note.set("");
    this.sync();
  }

  private newTree(): void {
    this.tree = randomTree(this.env.rng, this.order[this.round % 4]!);
    this.stage = "set";
    this.path1.snap(0);
    this.path2.snap(0);
    for (const r of this.known) for (const d of r) d.snap(0);
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS - 1;
    for (const r of this.known) for (const d of r) d.snap(1);
    this.enterSee();
    if (beat === "prove") {
      this.sawTable = true;
      this.enterProve();
    }
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
    this.mv.fit(this.cx, f.top, f.w, f.h);
  }

  private sync(): void {
    // The action row is taller while choosing, so buttons are re-placed whenever the stage changes.
    if (this.w > 0) this.layout();
    this.next.visible = this.beat === "feel" && this.stage === "result" && this.round < ROUNDS - 1;
    this.toSee.visible = this.beat === "feel" && this.stage === "result" && this.round >= ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.sawTable;
  }

  protected override zonesActive(): Box[] | null {
    if (this.beat === "feel" && this.stage === "set") return [this.cells(2, 0), this.cells(2, 1)];
    if (this.beat === "prove" && !this.locked) return [0, 1, 2, 3].map((k) => this.mv.rect(k >> 1, k & 1));
    return null;
  }

  protected override onZone(i: number): void {
    if (this.beat === "feel") this.play(i);
    else this.answer(i);
  }

  protected override onDown(): void {
    if (this.beat !== "see") return;
    const target = this.fold.target > 0.5 ? 0 : 1;
    this.fold.set(target);
    if (target === 1) {
      this.sawTable = true;
      this.prompt.set("A table lists every pair. The order is gone.");
      this.note.set("Tap again to unfold it. The tree shows who moves first.");
    } else {
      this.prompt.set("The tree remembers who moved first.");
      this.note.set("Tap to fold it again, or try it yourself.");
    }
    this.sync();
  }

  // ---- Feel -------------------------------------------------------------

  private play(i: number): void {
    this.mine = i;
    this.stage = "wait";
    this.since = 0;
    this.path1.set(1);
    this.prompt.set("They are looking at your move.");
    this.note.set("");
    this.sync();
  }

  private revealLeaf(): void {
    const j = bestReply(this.tree, this.mine);
    this.path2.set(1);
    this.known[this.mine]![j]!.set(1);
    const other = 1 - this.mine;
    const alt = outcome(this.tree, other);
    this.known[other]![alt.j]!.set(1);
    const got = this.tree.pay[this.mine]![j]![0];
    this.stage = "result";
    this.prompt.set(this.round === 0 ? "A tree shows the order of moves." : "The tree again. Who moves first?");
    this.note.set(`They replied ${this.tree.second[j]}. You got ${got}. ${this.tree.first[other]} would have paid ${alt.pay[0]}.`);
    this.announce(`You chose ${this.tree.first[this.mine]}. They replied ${this.tree.second[j]}. You got ${got}. ${this.tree.first[other]} would have paid ${alt.pay[0]}.`);
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.newTree();
    this.prompt.set("A new game. You move first.");
    this.note.set("");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.fold.snap(0);
    this.sawTable = false;
    this.prompt.set("Same game. Tap to fold the tree into a table.");
    this.note.set("Watch where each payoff goes.");
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
    const z = this.puzzles[this.pi]!;
    this.locked = false;
    this.wrongCell = -1;
    this.reveal.snap(0);
    this.prompt.set("Find the leaf in the table.");
    this.note.set(`You chose ${z.game.first[z.i]}. They chose ${z.game.second[z.j]}.`);
    this.sync();
  }

  private answer(k: number): void {
    const z = this.puzzles[this.pi]!;
    const r = k >> 1;
    const col = k & 1;
    const ok = r === z.i && col === columnOf(z.j, z.swapped);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.wrongCell = -1;
      this.reveal.set(1);
      const pay = z.game.pay[z.i]![z.j]!;
      this.prompt.set("Right. Row is the first move, column the reply.");
      this.note.set(`That leaf pays ${pay[0]} to you and ${pay[1]} to them.`);
      this.wait = 2;
    } else {
      this.wrongCell = k;
      this.prompt.set("Not that cell. Check the labels.");
      this.note.set(`That cell is ${z.game.first[r]} and ${this.colName(z, col)}.`);
    }
  }

  private colName(z: MapPuzzle, col: number): string {
    return z.game.second[z.swapped ? 1 - col : col]!;
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.path1.step(dt);
    this.path2.step(dt);
    this.fold.step(dt);
    this.reveal.step(dt);
    for (const r of this.known) for (const d of r) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.revealLeaf();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("A table hides the order. A tree keeps it.");
          this.note.set("Same game, two views. Use the one that shows what matters.");
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

  private geom(f: Frame): { root: [number, number]; mid: [number, number][]; leaf: [number, number][][]; rl: number } {
    const top = f.top + 14;
    const H = Math.max(80, f.h - 74);
    const dy1 = H * 0.42;
    const dy2 = H * 0.58;
    const spread = f.w * 0.22;
    const half = f.w * 0.12;
    const mid: [number, number][] = [[this.cx - spread, top + dy1], [this.cx + spread, top + dy1]];
    const leaf = mid.map((m) => [[m[0] - half, top + dy1 + dy2], [m[0] + half, top + dy1 + dy2]] as [number, number][]);
    return { root: [this.cx, top], mid, leaf, rl: Math.min(14, dy2 * 0.24) };
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "prove") return this.drawTable(p, c, 1, this.puzzles[this.pi]!, f);
    const g = this.geom(f);
    const t = this.beat === "see" ? this.fold.value : 0;
    this.drawTree(p, c, f, g, 1 - t, t);
    if (this.beat === "see") this.drawTable(p, c, t, null, f);
  }

  private drawTree(p: Painter, c: Colors, f: Frame, g: ReturnType<NormalVsExtensiveGame["geom"]>, a: number, fold: number): void {
    const intro = this.intro.value;
    const al = a * intro;
    const see = this.beat === "see";
    if (al > 0.02) {
      for (let i = 0; i < 2; i++) {
        const lit = this.beat === "feel" && this.mine === i ? this.path1.value : 0;
        p.line(g.root[0], g.root[1], g.mid[i]![0], g.mid[i]![1], c.ink, 1, (0.4 + 0.6 * lit) * al);
        for (let j = 0; j < 2; j++) {
          const l = this.beat === "feel" && this.mine === i && bestReply(this.tree, i) === j ? this.path2.value : 0;
          p.line(g.mid[i]![0], g.mid[i]![1], g.leaf[i]![j]![0], g.leaf[i]![j]![1], c.ink, 1, (0.4 + 0.6 * l) * al);
        }
        p.ring(g.mid[i]![0], g.mid[i]![1], 6, c.ink, 1.5, al);
      }
      p.disc(g.root[0], g.root[1], 5, c.ink, al);
    }
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const [lx, ly] = g.leaf[i]![j]!;
        const k = see ? 1 : this.known[i]![j]!.value;
        const [a1, b1] = this.tree.pay[i]![j]!;
        if (al > 0.02) {
          p.text(this.tree.second[j]!, lx, ly + g.rl + 18, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: al });
          if (k > 0.05) p.text(`${a1},${b1}`, lx, ly + g.rl + 34, { font: Type.mono(10), color: c.ink, align: "center", alpha: al * k });
        }
        const cell = this.mv.center(i, columnOf(j, false));
        const vis = see ? 1 : k;
        if (vis > 0.05) {
          const rTree = g.rl * Math.sqrt(a1 / 9);
          const rTable = this.mv.radius(a1, 9) * 0.82;
          p.disc(lerp(lx, cell.x, fold), lerp(ly, cell.y - this.mv.cell * 0.1, fold), lerp(rTree, rTable, fold), c.ink, 0.92 * vis);
        }
      }
    }
    void f;
  }

  private drawTable(p: Painter, c: Colors, a: number, z: MapPuzzle | null, f: Frame): void {
    const mv = this.mv;
    const game = z ? z.game : this.tree;
    const swapped = z ? z.swapped : false;
    if (a < 0.02) return;
    mv.grid(p, c, a);
    ([0, 1] as const).forEach((i) => {
      p.text(game.first[i]!, mv.x0 - 18, mv.rowY(i), { font: Type.body(14, 400), color: c.fog, align: "right", base: "middle", alpha: a });
      p.text(game.second[swapped ? 1 - i : i]!, mv.colX(i), mv.y0 - 16, { font: Type.body(14, 400), color: c.fog, align: "center", alpha: a });
    });
    p.disc(mv.x0 - mv.rowLabelW + 10, mv.y0 + mv.cell, 4, c.ink, a);
    p.ring(mv.x0 + mv.cell, mv.y0 - 46, 6, c.ink, 1.5, a);
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        const j = swapped ? 1 - col : col;
        const [a1, b1] = game.pay[r]![j]!;
        const ctr = mv.center(r, col);
        if (z) {
          const k = r === z.i && j === z.j ? this.reveal.value : 0;
          if (k > 0.02) {
            p.disc(ctr.x, ctr.y - mv.cell * 0.1, mv.radius(a1, 9) * 0.82 * k, c.ink, 0.92);
            p.text(`${a1},${b1}`, ctr.x, ctr.y + mv.cell * 0.4, { font: Type.mono(11), color: c.fog, align: "center", alpha: k });
          }
          if (this.wrongCell === r * 2 + col) p.ring(ctr.x, ctr.y, mv.cell * 0.2, c.ink, 1.25, 0.6);
        } else {
          if (this.beat === "see") p.text(`${a1},${b1}`, ctr.x, ctr.y + mv.cell * 0.4, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
        }
      }
    }
    if (z) this.ticks(p, c, this.puzzles.length, this.solved, this.pi);
    void f;
  }
}
