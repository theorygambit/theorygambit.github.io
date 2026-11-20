import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { MatrixView, inside } from "../shared/MatrixView";
import type { PayoffTable } from "../shared/PayoffTable";
import { drawChoice, drawMatrixLabels, drawPayoffCell, drawTicks, fmt } from "../shared/kit";
import { Outing, PARTNER_ODDS, proveTables, type Place, type Table } from "./model";

/**
 * Feel: five evenings with five partners. You prefer the opera, they prefer football, and a miss pays nothing.
 * See: tap the four outcomes to turn them over. The two where you meet are the ones nobody leaves.
 * Prove: two new tables. Tap every cell nobody wants to leave, then check.
 */
export class BattleOfSexesGame extends Game {
  readonly slug = "battle-of-sexes";
  private readonly g = new Outing(3, 2);
  private partners: number[] = [];
  private mine: Place[] = [];
  private theirs: Place[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private armed: Place | null = null;
  private readonly youR = new Damped(7, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly inner = new Damped(0, 0.3);
  private readonly notch = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private readonly mv = new MatrixView();
  private turned: boolean[][] = [[false, false], [false, false]];
  private readonly glow = new Damped(0, 0.6);

  private tables: Table[] = [];
  private pi = 0;
  private solved = 0;
  private picks: boolean[][] = [[false, false], [false, false]];
  private locked = false;
  private wait = 0;
  private bad: [number, number] | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly check = this.add(new CanvasButton("Check", () => this.checkPicks(), "primary"));

  begin(): void {
    this.partners = this.env.rng.shuffle(PARTNER_ODDS);
    this.mine = [];
    this.theirs = [];
    this.round = 0;
    this.stage = "choose";
    this.youR.snap(7);
    this.altR.snap(0);
    this.inner.snap(0);
    this.notch.snap(0).set(1);
    this.intro.snap(0).set(1);
    this.turned = [[false, false], [false, false]];
    this.glow.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("You love the opera. They love football. Choose.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.partners.forEach((q, i) => {
      this.mine.push(i % 2 === 0 ? "opera" : "football");
      this.theirs.push(q > 0.5 ? "opera" : "football");
    });
    this.round = 5;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      this.turned = [[true, true], [true, true]];
      this.glow.snap(1);
      this.afterTurn();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.check.place(this.cx - 80, by, 160);
  }

  private get turnedCount(): number {
    return this.turned.flat().filter(Boolean).length;
  }

  private get pickedCount(): number {
    return this.picks.flat().filter(Boolean).length;
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 5 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.turnedCount === 4;
    this.check.visible = this.beat === "prove" && !this.locked;
    this.check.enabled = this.pickedCount > 0;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "opera";
        else if (inside(this.pair(1), x, y)) this.armed = "football";
      } else if (this.stage === "result" && this.round < 5) this.nextPartner();
    } else if (this.beat === "see") {
      const cell = this.cellAt(x, y);
      if (cell && !this.turned[cell[0]]![cell[1]]) {
        this.turned[cell[0]]![cell[1]] = true;
        this.afterTurn();
      }
    } else if (this.beat === "prove" && !this.locked) {
      const cell = this.cellAt(x, y);
      if (cell) {
        this.picks[cell[0]]![cell[1]] = !this.picks[cell[0]]![cell[1]];
        this.bad = null;
        this.note.set("");
        this.sync();
      }
    }
  }

  protected override onUp(x: number, y: number): void {
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && this.beat === "feel" && inside(this.pair(m === "opera" ? 0 : 1), x, y)) this.play(m);
  }

  private cellAt(x: number, y: number): [number, number] | null {
    const m = this.mv;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) if (inside(m.rect(r, c), x, y)) return [r, c];
    return null;
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Place): void {
    const q = this.partners[this.round]!;
    this.mine.push(m);
    this.theirs.push(this.env.rng.chance(q) ? "opera" : "football");
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what each choice pays." : "Again.");
    this.sync();
  }

  private revealRound(): void {
    const me = this.mine[this.round]!;
    const th = this.theirs[this.round]!;
    const got = this.g.payoff(me, th);
    const other: Place = me === "opera" ? "football" : "opera";
    const alt = this.g.payoff(other, th);
    this.youR.set(this.rad(got));
    this.altR.set(this.rad(alt));
    this.inner.set(th === "opera" ? 1 : 0);
    this.note.set(`They went to the ${th === "opera" ? "opera" : "football"}. You got ${fmt(got)}. The ${other} would have paid ${fmt(alt)}.`);
    this.announce(`Evening ${this.round + 1}. You went to the ${me}, they went to the ${th}. You got ${fmt(got)}. The ${other} would have paid ${fmt(alt)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 5 ? "Five evenings. Count how often you met." : "Tap for the next evening.");
    this.sync();
  }

  private nextPartner(): void {
    this.stage = "choose";
    this.youR.set(7);
    this.altR.set(0);
    this.inner.set(0);
    this.notch.snap(0).set(1);
    this.note.set("");
    this.prompt.set("You love the opera. They love football. Choose.");
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 2 : 50 * Math.sqrt(v / this.g.hi);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.turned = [[false, false], [false, false]];
    this.glow.snap(0);
    this.prompt.set("Four outcomes. Tap each one to turn it over.");
    this.note.set("Pips show how often you landed in each.");
    this.sync();
  }

  private afterTurn(): void {
    const n = this.turnedCount;
    if (n === 4) {
      this.glow.set(1);
      const met = this.mine.filter((m, i) => m === this.theirs[i]).length;
      this.prompt.set("Meeting pays. Missing pays nothing.");
      this.note.set(`You met ${met} of ${this.mine.length}. Both meetings are stable. Each of you prefers a different one.`);
      this.announce("Two outcomes are stable: both at the opera, or both at football. Missing pays nothing.");
    } else this.note.set(`${n} of 4 turned. Pips show how often you landed in each.`);
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.tables = proveTables(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadTable();
  }

  private loadTable(): void {
    this.picks = [[false, false], [false, false]];
    this.locked = false;
    this.bad = null;
    this.glow.snap(0);
    this.prompt.set(this.pi === 0 ? "New table. Tap every cell nobody leaves." : "New names, new order. Same test.");
    this.note.set("Nobody leaves a cell when each is already at their best reply.");
    this.sync();
  }

  private checkPicks(): void {
    const t = this.tables[this.pi]!;
    const bm = t.bm;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const want = bm.isStable(r, c);
        if (this.picks[r]![c]! === want) continue;
        this.cue("bad");
        this.bad = [r, c];
        this.prompt.set(want ? "You missed one. Test each cell." : "Not stable. Someone would move.");
        this.note.set(want ? `${bm.rowNames[r]} with ${bm.colNames[c]}: neither of you gains by leaving.` : this.why(bm, r, c));
        this.sync();
        return;
      }
    }
    this.cue("good");
    this.locked = true;
    this.solved++;
    this.glow.set(1);
    this.prompt.set("Right. Both want to meet, and they want different places.");
    this.note.set("Missing pays nothing, so both meetings hold.");
    this.wait = 2;
    this.sync();
  }

  /** Who would walk away from this cell, and to where. */
  private why(bm: PayoffTable, r: number, c: number): string {
    if (!bm.bestRows(c).includes(r)) return `You would switch to ${bm.rowNames[bm.bestRows(c)[0]!]}. It pays you more.`;
    return `They would switch to ${bm.colNames[bm.bestCols(r)[0]!]}. It pays them more.`;
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.inner.step(dt);
    this.notch.step(dt);
    this.glow.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.6) this.revealRound();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.tables.length) {
          this.prompt.set("Both want to meet, so there are two stable places.");
          this.note.set("A signal, a habit or taking turns decides which one you use.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadTable();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawTable(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const s = clamp((f.h - 56) / 150, 0.62, 1.1);
    const y = f.top + 46 * s + 4;
    const off = Math.min(86, f.w / 2 - 46 * s - 8);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const q = this.partners[Math.min(this.round, 4)]!;
    const k = Math.round(q * 5);
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const youMax = 50 * s;

    p.dashedRing(xl, y, this.altR.value * s, c.ink, 0.8);
    p.disc(xl, y, this.youR.value * s, c.ink, 0.95 * a * idle);
    p.ring(xr, y, 30 * s, c.ink, 1.5, a * idle);
    p.disc(xr, y, 9 * s * this.inner.value, c.ink, a);
    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI / 2 + (i / 5) * Math.PI * 2 + 0.1;
      const filled = i < k * this.notch.value;
      p.arc(xr, y, 42 * s, a0, a0 + (Math.PI * 2) / 5 - 0.2, c.ink, 3, (filled ? 0.95 : 0.2) * a);
    }
    const ly = y + Math.max(youMax, 46 * s) + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(`opera ${k} of 5 nights`, xr, ly + 20, { font: Type.body(12, 400), color: c.ash, align: "center", alpha: a });

    for (const i of [0, 1] as const) {
      if (this.round >= 5) break;
      const pl: Place = i === 0 ? "opera" : "football";
      const live = this.stage === "choose";
      const chosen = this.mine[this.round - (this.stage === "result" ? 1 : 0)] === pl && this.stage !== "choose";
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 5 ? 0 : 0.3) * a;
      const v = pl === "opera" ? this.g.hi : this.g.lo;
      drawChoice(p, c, this.pair(i), { label: pl === "opera" ? "Opera" : "Football", sub: `${fmt(v)} if they come`, r: 22 * Math.sqrt(v / this.g.hi), alpha: al, armed: this.armed === pl });
    }
    drawTicks(p, c, f, this.cx, 5, this.round, this.round);
  }

  private placeMatrix(f: Frame): void {
    this.mv.fit(this.cx, f.top, f.w, f.h, 140);
    const total = this.mv.colLabelH + 2 * this.mv.cell;
    this.mv.fit(this.cx, f.top + Math.max(0, (f.h - total) / 2), f.w, f.h, 140);
  }

  private drawTable(p: Painter, c: Colors, f: Frame): void {
    this.placeMatrix(f);
    const m = this.mv;
    const see = this.beat === "see";
    const bm = see ? this.g.matrix() : this.tables[Math.min(this.pi, this.tables.length - 1)]!.bm;
    m.grid(p, c);
    drawMatrixLabels(p, c, m, bm);
    const g = this.glow.value;
    for (let r = 0; r < 2; r++) {
      for (let col = 0; col < 2; col++) {
        const b = m.rect(r, col);
        if (see) {
          if (this.turned[r]![col]) drawPayoffCell(p, c, m, r, col, bm);
          else {
            const pulse = 0.35 + 0.25 * Math.sin(this.time * 4 + r + col);
            p.ring(b.x + b.w / 2, b.y + b.h / 2, 5, c.ink, 1.25, pulse + 0.2);
          }
          const n = this.mine.filter((mm, i) => mm === (r === 0 ? "opera" : "football") && this.theirs[i] === (col === 0 ? "opera" : "football")).length;
          for (let i = 0; i < n; i++) p.disc(b.x + 9 + i * 7, b.y + 9, 2, c.ink, 0.9);
          if (g > 0.01 && bm.isStable(r, col)) p.frame(b.x + 4, b.y + 4, b.w - 8, b.h - 8, c.ink, g);
        } else {
          drawPayoffCell(p, c, m, r, col, bm);
          if (this.picks[r]![col]) p.frame(b.x + 4, b.y + 4, b.w - 8, b.h - 8, c.ink, 1);
          if (this.bad && this.bad[0] === r && this.bad[1] === col) p.line(b.x + 8, b.y + b.h * 0.62, b.x + b.w - 8, b.y + b.h * 0.62, c.ink, 1, 0.5, [3, 4]);
        }
      }
    }
    if (see) drawTicks(p, c, f, this.cx, 4, this.turnedCount, Math.min(this.turnedCount, 3));
    else drawTicks(p, c, f, this.cx, this.tables.length, this.solved, this.pi);
  }
}
