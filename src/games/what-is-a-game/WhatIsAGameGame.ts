import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { MatrixView, inside } from "../shared/MatrixView";
import { ALONE, LANES, flipPuzzles, laneSequence, type Col, type FlipPuzzle, type PayoffTable, type Row } from "./model";

const LANE = ["A", "B"] as const;
const ROWS = 5;

/**
 * Feel: five drives. The first two roads are empty, the next three have another driver. Each round also
 * shows what the other lane would have paid.
 * See: toggle between the two situations. Alone, no lane is better. With a driver, their lane flips yours.
 * Prove: two tables where one row always wins. Raise one payoff until their move changes your best move.
 */
export class WhatIsAGameGame extends Game {
  readonly slug = "what-is-a-game";
  private readonly mv = new MatrixView();
  private seq: Col[] = [];
  private round = 0;
  private locked = false;
  private mine: Col | null = null;
  private theirs: Col | null = null;
  private since = 0;
  private revealed = false;
  private last: [number, number] = [0, 0];
  private readonly youR = new Damped(6, 0.35);
  private readonly theirR = new Damped(6, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private viewing: "alone" | "driver" = "alone";
  private readonly seen = new Set<"alone" | "driver">();
  private readonly arrows: Damped[] = [new Damped(0, 0.4), new Damped(0, 0.4)];

  private puzzles: FlipPuzzle[] = [];
  private pi = 0;
  private table: PayoffTable = ALONE;
  private readonly hint = new Damped(0, 0.5);
  private dragging = false;
  private dragY0 = 0;
  private dragV0 = 0;
  private solved = 0;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly bAlone = this.add(new CanvasButton("Alone", () => this.view("alone")));
  private readonly bDriver = this.add(new CanvasButton("Another driver", () => this.view("driver")));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.advance(), "primary"));

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  begin(): void {
    this.seq = laneSequence(this.env.rng);
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.theirs = null;
    this.revealed = false;
    this.seen.clear();
    this.viewing = "alone";
    this.youR.snap(6);
    this.theirR.snap(6);
    this.altR.snap(0);
    this.puzzles = flipPuzzles(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.roundPrompt();
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROWS;
    this.enterSee();
    if (beat === "prove") {
      this.seen.add("alone").add("driver");
      this.enterProve();
    }
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    const bw = (f.w - 12) / 2;
    this.bAlone.place(f.x, by, bw);
    this.bDriver.place(f.x + bw + 12, by, bw);
    this.mv.fit(this.cx, f.top, f.w, f.h);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROWS && !this.locked;
    this.bAlone.visible = this.bDriver.visible = this.beat === "see" && this.seen.size < 2;
    this.toProve.visible = this.beat === "see" && this.seen.size === 2;
    this.next.visible = this.beat === "prove" && this.table.isInterdependent();
  }

  protected override zonesActive(): Box[] | null {
    return this.beat === "feel" && !this.locked && this.round < ROWS ? [this.cells(2, 0), this.cells(2, 1)] : null;
  }

  protected override onZone(i: number): void {
    this.play(i as Col);
  }

  // ---- Feel -------------------------------------------------------------

  private get shared(): boolean {
    return this.round >= 2;
  }

  private roundPrompt(): void {
    this.prompt.set(this.shared ? "Another driver is out there. Pick a lane." : "Alone on the road. Pick a lane.");
  }

  private play(lane: Col): void {
    this.mine = lane;
    this.theirs = this.shared ? this.seq[this.round - 2]! : null;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.youR.set(6);
    this.theirR.set(6);
    this.altR.set(0);
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 2 : this.maxR() * Math.sqrt(v / 3);
  }

  private maxR(): number {
    return clamp((this.frame.h - 56) / 2, 20, 54);
  }

  private revealRound(): void {
    const me = this.mine!;
    const th = this.theirs;
    const table = th === null ? ALONE : LANES;
    const col: Col = th ?? 0;
    const got = table.payoff(me as Row, col);
    const other = (1 - me) as Row;
    const alt = table.payoff(other, col);
    this.last = [got, got];
    this.youR.set(this.rad(got));
    this.theirR.set(th === null ? 0 : this.rad(got));
    this.altR.set(this.rad(alt));
    this.revealed = true;
    this.note.set(th === null ? "Nobody else. Either lane pays 3." : `They took lane ${LANE[th]}. You got ${got}. Lane ${LANE[other]} would have paid ${alt}.`);
    this.announce(th === null ? "Nobody else on the road. Either lane pays 3." : `They took lane ${LANE[th]}. You got ${got}. Lane ${LANE[other]} would have paid ${alt}.`);
    this.round++;
    this.locked = false;
    if (this.round >= ROWS) this.prompt.set("Five drives. Did your best lane ever change?");
    else this.roundPrompt();
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.revealed = false;
    this.viewing = "alone";
    this.seen.clear();
    this.table = ALONE;
    this.arrows[0]!.snap(0);
    this.arrows[1]!.snap(0);
    this.prompt.set("Tap a road. Does their lane change your best lane?");
    this.note.set("");
    this.sync();
  }

  private view(v: "alone" | "driver"): void {
    this.viewing = v;
    this.seen.add(v);
    this.table = v === "alone" ? ALONE : LANES;
    for (const c of [0, 1] as const) {
      const b = this.table.bestRow(c);
      this.arrows[c]!.set(b === null ? 0 : b === 0 ? -1 : 1);
    }
    this.note.set(v === "alone" ? "No other driver. Either lane pays 3." : "Their lane decides your best lane.");
    if (this.seen.size === 2) {
      this.prompt.set("A game is when their move changes your best move.");
      this.announce("With another driver, your best lane depends on theirs. That is a game.");
    }
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
    this.table = this.puzzles[this.pi]!.table;
    this.hint.snap(1);
    this.prompt.set("Raise the ringed disc until their move matters.");
    this.note.set("Make Left and Right favor different rows.");
    this.syncArrows(true);
    this.sync();
  }

  private syncArrows(snap = false): void {
    for (const c of [0, 1] as const) {
      const b = this.table.bestRow(c);
      const v = b === null ? 0 : b === 0 ? -1 : 1;
      if (snap) this.arrows[c]!.snap(v);
      else this.arrows[c]!.set(v);
    }
  }

  protected override onDown(x: number, y: number): void {
    if (this.beat !== "prove" || this.next.visible) return;
    const [r, c] = this.puzzles[this.pi]!.cell;
    const b = this.mv.rect(r, c);
    if (inside({ x: b.x - 16, y: b.y - 10, w: b.w + 32, h: b.h + 20 }, x, y)) {
      this.dragging = true;
      this.dragY0 = y;
      this.dragV0 = this.table.payoff(r, c);
    }
  }

  protected override onMove(_x: number, y: number): void {
    if (!this.dragging) return;
    const z = this.puzzles[this.pi]!;
    const [r, c] = z.cell;
    const unit = (this.mv.cell * 0.7) / 9;
    const v = Math.round(clamp(this.dragV0 + (this.dragY0 - y) / unit, 0, 9));
    if (v === this.table.payoff(r, c)) return;
    const was = this.table.isInterdependent();
    this.table = this.table.with(r, c, v);
    this.hint.set(0);
    this.syncArrows();
    const now = this.table.isInterdependent();
    if (now !== was) this.cue(now ? "good" : "bad");
    this.prompt.set(now ? "Now their column changes your best row." : "Raise the ringed disc until their move matters.");
    this.note.set(now ? "Left and Right favor different rows. That is a game." : "Make Left and Right favor different rows.");
    this.sync();
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private advance(): void {
    this.solved++;
    if (this.pi < this.puzzles.length - 1) {
      this.pi++;
      this.load();
    } else {
      this.prompt.set("A game is when their move changes your best move.");
      this.note.set("Alone you optimise. With others you must anticipate.");
      this.next.visible = false;
      this.finish();
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.altR.step(dt);
    this.hint.step(dt);
    for (const a of this.arrows) a.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.6 && !this.revealed) this.revealRound();
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawTable(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const R = this.maxR();
    const cy = f.top + (f.h - (2 * R + 48)) / 2 + R;
    const off = Math.min(86, f.w / 2 - R - 10);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.dashedRing(xl, cy, this.altR.value, c.ink, 0.8);
    p.disc(xl, cy, this.youR.value, c.ink, 0.95 * a * idle);
    const alone = !this.shared && this.round < 2;
    if (alone || (this.mine !== null && this.theirs === null && this.revealed)) p.dashedRing(xr, cy, R * 0.5, c.ink, 0.35 * a);
    else p.ring(xr, cy, this.theirR.value, c.ink, 1.5, a * idle);
    const ly = cy + R + 22;
    const nobody = alone || (this.mine !== null && this.theirs === null && this.revealed);
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(nobody ? "Nobody" : "They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed) {
      p.text(String(this.last[0]), xl, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
      if (!nobody) p.text(String(this.last[1]), xr, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    for (const i of [0, 1] as const) {
      const z = this.cells(2, i);
      const live = this.round < ROWS && !this.locked;
      const chosen = this.locked && this.mine === i;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= ROWS ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedZone === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const gy = z.y + z.h * 0.36;
      p.line(gx - 9, gy - 14, gx - 9, gy + 14, c.ink, 1, 0.5 * al);
      p.line(gx + 9, gy - 14, gx + 9, gy + 14, c.ink, 1, 0.5 * al);
      p.disc(gx + (i === 0 ? -9 : 9) * 1, gy, 5, c.ink, al);
      p.text(`Lane ${LANE[i]}`, gx, z.y + z.h * 0.8, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < ROWS) this.ticks(p, c, ROWS, this.round, this.round);
  }

  private drawTable(p: Painter, c: Colors, f: Frame): void {
    const mv = this.mv;
    mv.grid(p, c, 1);
    const prove = this.beat !== "see";
    const rows = prove ? ["Up", "Down"] : ["Lane A", "Lane B"];
    const cols = prove ? ["Left", "Right"] : ["Lane A", "Lane B"];
    ([0, 1] as const).forEach((i) => {
      p.text(rows[i]!, mv.x0 - 18, mv.rowY(i), { font: Type.body(15, 400), color: c.fog, align: "right", base: "middle" });
      p.text(cols[i]!, mv.colX(i), mv.y0 - 16, { font: Type.body(15, 400), color: c.fog, align: "center" });
    });
    Glyph.you(p, c, mv.x0 - mv.rowLabelW + 10, mv.y0 + mv.cell, 4);
    if (prove || this.viewing === "driver") Glyph.other(p, c, mv.x0 + mv.cell, mv.y0 - 46, 6);
    const maxV = prove ? 9 : 3;
    for (const r of [0, 1] as const) {
      for (const col of [0, 1] as const) {
        const ctr = mv.center(r, col);
        const v = this.table.payoff(r, col);
        p.disc(ctr.x, ctr.y, mv.radius(v, maxV), c.ink, 0.92);
        mv.number(p, c, r, col, v);
      }
    }
    if (prove && this.hint.value > 0.02) {
      const [r, cc] = this.puzzles[this.pi]!.cell;
      const t = mv.center(r, cc);
      p.dashedRing(t.x, t.y, mv.radius(this.table.payoff(r, cc), 9) + 4 + 1.5 * Math.sin(this.time * 3), c.ink, 0.7 * this.hint.value);
    }
    ([0, 1] as const).forEach((col) => {
      const s = this.arrows[col]!.value;
      if (Math.abs(s) < 0.06) return;
      const x = mv.colX(col) - mv.cell * 0.44;
      const ym = mv.y0 + mv.cell;
      p.arrow(x, ym, x, ym + s * mv.cell * 0.42, c.ink, 1.5, Math.min(1, Math.abs(s)), 8);
    });
    if (prove) this.ticks(p, c, this.puzzles.length, this.solved, this.pi);
    void f;
  }
}
