import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { drawTicks, fmt } from "../shared/kit";
import { Tree, feelTrees, proveTrees } from "./model";

interface Pt {
  x: number;
  y: number;
}

/**
 * Feel: you move, the rival moves, you move. Pick a branch, watch the rival pick, then pick a leaf. Leaves are your payoffs.
 * See: back up the values through your moves, the rival's moves and your moves. The root shows what you can force.
 * Prove: two new trees. Tap the leaves that alpha-beta, reading left to right, never has to look at.
 */
export class MinimaxAlphaBetaGame extends Game {
  readonly slug = "minimax-alpha-beta";
  private trees: Tree[] = [];
  private round = 0;
  private stage: "root" | "rival" | "leaf" | "done" = "root";
  private branch = 0;
  private reply = 0;
  private got = 0;
  private since = 0;
  private readonly cover = new Damped(0, 0.4);

  private phase = 0;
  private readonly fills: Damped[] = [0, 1, 2, 3, 4, 5, 6].map(() => new Damped(0, 0.4));

  private puzzles: Tree[] = [];
  private pi = 0;
  private solved = 0;
  private skip: boolean[] = [];
  private locked = false;
  private wait = 0;
  private bad = -1;

  private readonly next = this.add(new CanvasButton("Next tree", () => this.nextTree(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly check = this.add(new CanvasButton("Check", () => this.checkSkips(), "primary"));

  begin(): void {
    this.trees = feelTrees(this.env.rng);
    this.round = 0;
    this.stage = "root";
    this.phase = 0;
    this.fills.forEach((d) => d.snap(0));
    this.solved = 0;
    this.setBeat("feel");
    this.loadTree();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = 1;
    this.stage = "done";
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 8; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.check]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "done" && this.round < 1;
    this.toSee.visible = this.beat === "feel" && this.stage === "done" && this.round >= 1;
    this.toProve.visible = this.beat === "see" && this.phase >= 8;
    this.check.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private geo(f: Frame): { leaf: Pt[]; mx: Pt[]; mn: Pt[]; root: Pt; rl: number } {
    const slot = f.w / 8;
    const rl = clamp(slot * 0.36, 7, 14);
    const yLeaf = f.bottom - 30;
    const y0 = f.top + 10;
    const step = (yLeaf - y0) / 3;
    const leaf = Array.from({ length: 8 }, (_, i) => ({ x: f.x + (i + 0.5) * slot, y: yLeaf }));
    const mx = [0, 1, 2, 3].map((j) => ({ x: (leaf[2 * j]!.x + leaf[2 * j + 1]!.x) / 2, y: y0 + 2 * step }));
    const mn = [0, 1].map((j) => ({ x: (mx[2 * j]!.x + mx[2 * j + 1]!.x) / 2, y: y0 + step }));
    const root = { x: (mn[0]!.x + mn[1]!.x) / 2, y: y0 };
    return { leaf, mx, mn, root, rl };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (y < f.top || y > f.bottom) return;
    if (this.beat === "feel") {
      if (this.stage === "root") this.pickBranch(x < this.cx ? 0 : 1);
      else if (this.stage === "leaf") {
        const g = this.geo(f);
        const base = this.branch * 4 + this.reply * 2;
        const i = [base, base + 1].find((k) => Math.abs(g.leaf[k]!.x - x) < f.w / 16 + 4);
        if (i !== undefined) this.pickLeaf(i);
      }
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      const g = this.geo(f);
      if (Math.abs(y - g.leaf[0]!.y) > 36) return;
      const i = clamp(Math.floor((x - f.x) / (f.w / 8)), 0, 7);
      this.skip[i] = !this.skip[i];
      this.bad = -1;
      this.note.set("");
      this.sync();
    }
  }

  // ---- Feel -------------------------------------------------------------

  private loadTree(): void {
    this.stage = "root";
    this.cover.snap(0);
    this.prompt.set(this.round === 0 ? "You pick a branch. Then they pick. Then you pick a leaf." : "A new tree. Think two moves ahead.");
    this.note.set("Tap the left or the right half to take that branch.");
  }

  private pickBranch(b: number): void {
    this.branch = b;
    this.stage = "rival";
    this.since = 0;
    const t = this.trees[this.round]!;
    const m = t.maxNodes;
    this.reply = m[b * 2]! <= m[b * 2 + 1]! ? 0 : 1;
    this.prompt.set("They choose the branch that is worst for you.");
    this.note.set("");
    this.cue("good");
  }

  private pickLeaf(i: number): void {
    const t = this.trees[this.round]!;
    this.got = t.leaves[i]!;
    this.stage = "done";
    this.cover.set(1);
    this.cue(this.got >= t.value ? "good" : "bad");
    this.prompt.set(this.got >= t.value ? `You got ${this.got}. You forced the best there was.` : `You got ${this.got}. Best you could force: ${t.value}.`);
    this.note.set(t.bestBranch === this.branch ? "You took the right branch." : `The better branch was the ${t.bestBranch === 0 ? "left" : "right"} one.`);
    this.announce(`You got ${this.got}. The best you could force was ${t.value}.`);
    this.sync();
  }

  private nextTree(): void {
    this.round++;
    this.loadTree();
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.phase = 0;
    this.fills.forEach((d) => d.snap(0));
    this.prompt.set("Work backwards from the leaves.");
    this.note.set("Tap to back up each value. Filled node: you pick the larger. Ring: they pick the smaller.");
    this.sync();
  }

  private advance(): void {
    if (this.phase >= 8) return;
    if (this.phase < 7) {
      this.fills[this.phase]!.set(1);
      this.phase++;
      this.prompt.set(this.phase <= 4 ? "You pick the larger of two leaves." : this.phase <= 6 ? "They pick the smaller of two." : "You pick the larger of two.");
      this.note.set(`${this.phase} of 7 values backed up.`);
    } else {
      this.phase = 8;
      const t = this.trees[0] ?? new Tree([0, 0, 0, 0, 0, 0, 0, 0]);
      this.prompt.set(`The root is worth ${t.value}: take the ${t.bestBranch === 0 ? "left" : "right"} branch.`);
      this.note.set("That is the most you can force against a rival who always picks the worst for you.");
      this.announce(`The value of the game is ${t.value}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = proveTrees(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
    this.sync();
  }

  private loadPuzzle(): void {
    this.locked = false;
    this.bad = -1;
    this.skip = Array.from({ length: 8 }, () => false);
    this.prompt.set(this.pi === 0 ? "Read the leaves left to right. Tap those you can skip." : "Another tree. Which leaves can you skip?");
    this.note.set("Skip a leaf when the rival already has a better option.");
    this.sync();
  }

  private checkSkips(): void {
    const t = this.puzzles[this.pi]!;
    const want = t.skipped;
    const bad = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => this.skip[i] !== want.includes(i));
    if (bad === undefined) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. ${want.length} leaf${want.length === 1 ? "" : "s"} skipped, same answer ${t.value}.`);
      this.note.set("Alpha-beta gets the same value while reading fewer leaves.");
      this.wait = 2.6;
    } else {
      this.cue("bad");
      this.bad = bad;
      this.prompt.set(want.includes(bad) ? `Leaf ${bad + 1} can be skipped.` : `Leaf ${bad + 1} is needed.`);
      this.note.set(want.includes(bad) ? "The rival already has a better option on the other side, so this branch will not be allowed." : "Read it. It could still change the best value.");
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.cover.step(dt);
    for (const d of this.fills) d.step(dt);
    if (this.beat === "feel" && this.stage === "rival") {
      this.since += dt;
      if (this.since > 1) {
        this.stage = "leaf";
        this.prompt.set("Now you pick the larger leaf.");
        this.note.set("Tap one of the two under their choice.");
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Search ahead, and skip what the rival would never allow.");
          this.note.set("Alpha-beta pruning is how chess engines look so far ahead.");
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
    const g = this.geo(f);
    const t = this.beat === "feel" ? this.trees[Math.min(this.round, 1)]! : this.beat === "see" ? this.trees[0] ?? new Tree([3, 5, 6, 9, 1, 2, 0, 1]) : this.puzzles[Math.min(this.pi, this.puzzles.length - 1)]!;
    const taken = (a: Pt, b: Pt, on: boolean) => p.line(a.x, a.y, b.x, b.y, c.ink, on ? 2.5 : 1, on ? 1 : 0.45);
    const feel = this.beat === "feel";
    const chosenMn = feel && this.stage !== "root" ? this.branch : -1;
    const chosenMx = feel && (this.stage === "leaf" || this.stage === "done") ? this.branch * 2 + this.reply : -1;
    taken(g.root, g.mn[0]!, chosenMn === 0);
    taken(g.root, g.mn[1]!, chosenMn === 1);
    [0, 1, 2, 3].forEach((j) => taken(g.mn[Math.floor(j / 2)]!, g.mx[j]!, chosenMx === j));
    [0, 1, 2, 3, 4, 5, 6, 7].forEach((i) => taken(g.mx[Math.floor(i / 2)]!, g.leaf[i]!, false));
    p.disc(g.root.x, g.root.y, 5, c.ink);
    g.mn.forEach((n) => p.ring(n.x, n.y, 5.5, c.ink, 1.5));
    g.mx.forEach((n) => p.disc(n.x, n.y, 4.5, c.ink));
    const vis = this.beat === "prove" ? t.alphaBeta().visited : null;
    t.leaves.forEach((v, i) => {
      const pt = g.leaf[i]!;
      const faded = this.beat === "prove" && this.locked && vis !== null && !vis[i];
      p.disc(pt.x, pt.y, g.rl * Math.sqrt(v / 9), c.ink, faded ? 0.3 : 0.92);
      p.text(String(v), pt.x, pt.y + g.rl + 13, { font: Type.mono(11), color: c.ink, align: "center", alpha: faded ? 0.4 : 1 });
      if (this.beat === "prove" && (this.skip[i] || (this.locked && vis !== null && !vis[i]))) {
        const k = g.rl + 3;
        p.line(pt.x - k, pt.y - k, pt.x + k, pt.y + k, c.ink, 1.5, 1);
        p.line(pt.x - k, pt.y + k, pt.x + k, pt.y - k, c.ink, 1.5, 1);
      }
      if (this.bad === i) p.ring(pt.x, pt.y, g.rl + 1, c.ink, 1.25, 0.9);
    });
    if (this.beat === "see") {
      // Values sit on the side away from the line to the parent.
      const val = (n: Pt, v: number, a: number, left: boolean) => {
        if (a > 0.01) p.text(String(v), n.x + (left ? -13 : 13), n.y, { font: Type.mono(11), color: c.ink, base: "middle", align: left ? "right" : "left", alpha: a });
      };
      t.maxNodes.forEach((v, j) => val(g.mx[j]!, v, this.fills[j]!.value, j % 2 === 0));
      t.minNodes.forEach((v, j) => val(g.mn[j]!, v, this.fills[4 + j]!.value, j === 0));
      val(g.root, t.value, this.fills[6]!.value, false);
      if (this.phase >= 8) {
        const b = t.bestBranch;
        p.line(g.root.x, g.root.y, g.mn[b]!.x, g.mn[b]!.y, c.ink, 2.5, 1);
      }
      drawTicks(p, c, f, this.cx, 8, this.phase, Math.min(this.phase, 7));
    } else if (feel) {
      if (this.stage === "done") p.text(`${fmt(this.got)} of ${fmt(t.value)}`, this.cx, f.top + f.h * 0.52, { font: Type.mono(12), color: c.ink, align: "center", alpha: this.cover.value });
      drawTicks(p, c, f, this.cx, 2, this.round + (this.stage === "done" ? 1 : 0), this.round);
    } else drawTicks(p, c, f, this.cx, this.puzzles.length, this.solved, this.pi);
  }
}
