import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { MatrixView, inside } from "../shared/MatrixView";
import { drawChoice, drawMatrixLabels, drawPayoffCell, Slider, fmt } from "../shared/kit";
import { FEEL, FEEL_ROUNDS, FEEL_SAFE, SEE_MAX, feelSlips, proveSet, type Slip } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: the other player means Right but their hand sometimes slips to Left. Pick Top or Bottom, five times.
 * See: drag the chance of a slip. Top never pays less than Bottom, and pays more as slips grow.
 * Prove: new tables with two stable cells. Tap the one that survives a tremble.
 */
export class TremblingHandGame extends Game {
  readonly slug = "trembling-hand";
  private slips: boolean[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly theirs = new Damped(0, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private readonly sl = new Slider();
  private maxE = 0;
  private readonly top = new Damped(0, 0.3);
  private readonly bottom = new Damped(0, 0.3);
  private dragging = false;

  private cases: Slip[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private tapped: [number, number] | null = null;
  private wait = 0;
  private readonly mv = new MatrixView();
  private readonly mark = new Damped(0, 0.4);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.slips = feelSlips(this.env.rng);
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose((i % 2) as 0 | 1);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setE(SEE_MAX);
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "prove" ? 44 : this.compact ? 60 : 68;
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
    this.sl.place(f.x + 30, f.x + f.w - 30, f.bottom - 46);
    this.mv.fit(this.cx, f.top, f.w, f.h - 8);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.maxE >= 0.2;
  }

  private hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "see" && y > this.sl.y - 34) {
      this.dragging = true;
      this.drag(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging && this.beat === "see") this.drag(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (this.beat === "prove" && !this.locked) {
      for (const r of [0, 1]) for (const c of [0, 1]) if (inside(this.mv.rect(r, c), x, y)) this.tapCell(r, c);
      return;
    }
    if (a === null || !this.hit(a, x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.choose(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = null;
    this.show.snap(0);
    this.prompt.set("They mean Right. Top or Bottom?");
    this.note.set(`Round ${this.round + 1} of ${FEEL_ROUNDS}. Their hand may slip.`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const slip = this.slips[this.round]!;
    const col = slip ? 1 - FEEL_SAFE : FEEL_SAFE;
    const [pay, they] = FEEL.table.payoff(i, col);
    const alt = FEEL.table.payoff(1 - i, col)[0];
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(pay);
    this.theirs.set(they);
    this.alt.snap(0).set(alt);
    this.prompt.set(slip ? "Their hand slipped to Left." : "They played Right.");
    this.note.set(`You get ${pay}. The other choice would have paid ${alt}.`);
    this.announce(`You get ${pay}. The other choice paid ${alt}.`);
    this.cue(pay >= alt ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.maxE = 0;
    this.sl.value = 0;
    this.top.snap(0);
    this.bottom.snap(0);
    this.prompt.set("Drag how often their hand slips.");
    this.note.set("At zero, Top and Bottom tie.");
    this.sync();
  }

  private drag(x: number): void {
    this.sl.setFromX(x, 0.05);
    this.setE(this.sl.value * SEE_MAX);
  }

  private setE(e: number): void {
    this.sl.value = e / SEE_MAX;
    this.maxE = Math.max(this.maxE, e);
    const t = FEEL.rowPay(0, FEEL_SAFE, e);
    const b = FEEL.rowPay(1, FEEL_SAFE, e);
    this.top.set(t);
    this.bottom.set(b);
    this.note.set(`At ${pct(e)}: Top pays ${fmt(t)}, Bottom ${fmt(b)}.`);
    if (this.maxE >= 0.2) {
      this.prompt.set("Top never loses, and wins with any slip.");
      this.announce("Top never pays less, and pays more whenever they slip.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.locked = false;
    this.tapped = null;
    this.mark.snap(0);
    this.prompt.set("Two cells are stable. Tap the one that survives a slip.");
    this.note.set("Look for a move that never beats the other.");
    this.sync();
  }

  private tapCell(r: number, c: number): void {
    const t = this.cases[this.pi]!;
    this.tapped = [r, c];
    this.mark.snap(0).set(1);
    if (t.survives(r, c)) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set("Right. Nothing in it relies on a perfect hand.");
      this.note.set("The other stable cell rests on a weak move.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.prompt.set(t.table.isStable(r, c) ? "Stable, but it does not survive a slip." : "That one is not even stable.");
      this.note.set(t.why(r, c));
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.theirs, this.alt, this.show, this.top, this.bottom, this.mark]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Equilibria must survive small mistakes.");
          this.note.set("A move that only ties is not safe when the other hand shakes.");
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
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const open = this.stage === "choose";
    (["Top", "Bottom"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 60) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 4) / 4);
    const sv = this.show.value;
    if (open) {
      p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    } else if (sv > 0.01) {
      p.disc(xl, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.ring(xr, cy, rad(this.theirs.value), c.ink, 1.5, sv);
      p.dashedRing(xl, cy, rad(this.alt.value), c.ink, 0.8 * sv);
      p.text(`you ${Math.round(this.mine.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      p.text(`they ${Math.round(this.theirs.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 110) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 2) / 2);
    p.disc(xl, cy, rad(this.top.value), c.ink, 0.95);
    p.disc(xr, cy, rad(this.bottom.value), c.ink, 0.45);
    p.text(`Top ${fmt(this.top.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    p.text(`Bottom ${fmt(this.bottom.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    this.sl.draw(p, c);
    p.text("0%", this.sl.x0, this.sl.y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(pct(SEE_MAX), this.sl.x1, this.sl.y + 22, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("chance their hand slips", this.cx, this.sl.y - 22, { font: Type.body(12, 400), color: c.fog, align: "center" });
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const t = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const mv = this.mv;
    mv.grid(p, c);
    drawMatrixLabels(p, c, mv, t.table);
    for (const r of [0, 1]) for (const col of [0, 1]) drawPayoffCell(p, c, mv, r, col, t.table);
    if (this.tapped) {
      const [r, col] = this.tapped;
      const b = mv.rect(r, col);
      p.frame(b.x + 2, b.y + 2, b.w - 4, b.h - 4, c.ink, (this.locked ? 0.9 : 0.45) * this.mark.value);
    }
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
