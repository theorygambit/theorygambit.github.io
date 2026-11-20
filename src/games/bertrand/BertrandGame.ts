import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { FEEL_COST, WAR, proveSet, type PriceCase } from "./model";

const TOP_PRICE = WAR.value;
const VMAX = (WAR.value - FEEL_COST) * WAR.buyers;
const PRICES: number[] = [];
for (let v = FEEL_COST; v <= TOP_PRICE; v++) PRICES.push(v);

interface Track {
  x0: number;
  x1: number;
  y: number;
  labelY: number;
  sceneTop: number;
  X: (v: number) => number;
  at: (px: number) => number;
}

interface Scene {
  xl: number;
  xr: number;
  by: number;
  cy: number;
  R: number;
  ly: number;
  sp: number;
}

/**
 * Feel: five rounds of pricing against a rival who goes one tick under you.
 * See: your profit against your price for any rival price. Undercut until the price meets cost.
 * Prove: where a war settles at a new cost, then how a firm with a cost edge should price.
 */
export class BertrandGame extends Game {
  readonly slug = "bertrand";

  private round = 0;
  private stage: "set" | "result" = "set";
  private price = 6;
  private rival = 9;
  private last: number | null = null;
  private dragging = false;
  private youProfit = 0;
  private theyProfit = 0;
  private cfProfit = 0;
  private nYou = 0;
  private nThem = 0;
  private split = false;
  private readonly handle = new Damped(6, 0.12);
  private readonly dots: Damped[] = Array.from({ length: WAR.buyers }, () => new Damped(0, 0.4));
  private readonly youV = new Damped(0, 0.5);
  private readonly theyV = new Damped(0, 0.5);
  private readonly cfV = new Damped(0, 0.5);
  private readonly show = new Damped(0, 0.3);

  private r = 9;
  private reached = false;
  private readonly rv = new Damped(9, 0.25);
  private readonly plot = new Plot({ xMin: FEEL_COST, xMax: TOP_PRICE, yMin: 0, yMax: VMAX, padL: 28, padR: 28 });

  private puzzles: PriceCase[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly ringAns = new Damped(0, 0.5);

  private readonly main = this.add(new CanvasButton("Set", () => this.press(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly under = this.add(new CanvasButton("Undercut", () => this.undercut(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.last = null;
    this.price = 6;
    this.handle.snap(6);
    this.rival = WAR.feelRival(0, null, FEEL_COST);
    this.stage = "set";
    this.resetScene();
    this.main.label = "Set";
    this.setBeat("feel");
    this.prompt.set("Set your price. The cheaper firm gets every buyer.");
    this.note.set(`They charge ${this.rival}. Drag your price, then tap Set.`);
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.enterSee();
    if (beat === "see") {
      this.r = FEEL_COST;
      this.rv.snap(FEEL_COST);
      this.reachedCost();
      return;
    }
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.main, this.toSee, this.under, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    const lastDone = this.round >= 4 && this.stage === "result";
    this.main.visible = feel && !lastDone;
    this.toSee.visible = feel && lastDone;
    this.under.visible = this.beat === "see" && !this.reached;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private track(f: Frame): Track {
    const x0 = f.x + 24;
    const x1 = f.x + f.w - 24;
    const labelY = f.top + 14;
    const y = labelY + 24;
    const X = (v: number): number => x0 + ((v - FEEL_COST) / (TOP_PRICE - FEEL_COST)) * (x1 - x0);
    const at = (px: number): number => clamp(Math.round(FEEL_COST + ((px - x0) / (x1 - x0)) * (TOP_PRICE - FEEL_COST)), FEEL_COST, TOP_PRICE);
    return { x0, x1, y, labelY, sceneTop: y + 44, X, at };
  }

  private scene(f: Frame): Scene {
    const t = this.track(f);
    const S = Math.max(60, f.bottom - t.sceneTop);
    const R = clamp(S * 0.22, 13, 40);
    const block = 8 + 14 + 2 * R + 20;
    const off = Math.max(0, (S - block) / 2);
    const by = t.sceneTop + off + 8;
    const cy = by + 14 + R;
    return { xl: f.x + f.w * 0.25, xr: f.x + f.w * 0.75, by, cy, R, ly: cy + R + 16, sp: Math.min(14, (f.w * 0.42) / WAR.buyers) };
  }

  private rad(v: number, R: number): number {
    return R * Math.sqrt(Math.max(0, v) / VMAX);
  }

  private resetScene(): void {
    this.show.snap(0);
    this.youV.snap(0);
    this.theyV.snap(0);
    this.cfV.snap(0);
    this.nYou = 0;
    this.nThem = 0;
    this.split = false;
    this.dots.forEach((d, i) => d.snap(this.centerX(i)));
  }

  private centerX(i: number): number {
    const f = this.frame;
    const sp = this.scene(f).sp;
    return this.cx + (i - (WAR.buyers - 1) / 2) * sp;
  }

  private dotTarget(i: number): number {
    if (!this.split) return this.centerX(i);
    const s = this.scene(this.frame);
    const left = i < this.nYou;
    const n = left ? this.nYou : this.nThem;
    const k = left ? i : i - this.nYou;
    return (left ? s.xl : s.xr) + (k - (n - 1) / 2) * s.sp;
  }

  /** Shows who got the buyers and what each firm earned. */
  private deal(mine: number, theirs: number, costMine: number, costTheirs: number): void {
    const you = WAR.won(mine, theirs);
    this.nYou = Math.round(you);
    this.nThem = WAR.buyers - this.nYou - (WAR.won(theirs, mine) === 0 && you === 0 ? 0 : 0);
    this.nThem = Math.round(WAR.won(theirs, mine));
    const loose = WAR.buyers - this.nYou - this.nThem;
    this.nThem += loose;
    this.split = true;
    this.youProfit = WAR.profit(mine, theirs, costMine);
    this.theyProfit = WAR.profit(theirs, mine, costTheirs);
    this.youV.set(Math.max(0, this.youProfit));
    this.theyV.set(Math.max(0, this.theyProfit));
    this.show.set(1);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (y < f.top - 20 || y > f.bottom + 10) return;
    if (this.beat === "feel" && this.stage === "set") {
      this.dragging = true;
      this.setPrice(x);
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setRival(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.hideAnswer();
      this.setPrice(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setPrice(x);
    else if (this.beat === "see") this.setRival(x);
    else if (this.beat === "prove") this.setPrice(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private setPrice(x: number): void {
    this.price = this.track(this.frame).at(x);
    if (this.beat === "prove") this.note.set(`Your price ${this.price}. Tap Lock in when sure.`);
  }

  // ---- Feel -------------------------------------------------------------

  private press(): void {
    if (this.stage === "set") {
      const mine = this.price;
      const theirs = this.rival;
      this.deal(mine, theirs, FEEL_COST, FEEL_COST);
      this.cfProfit = theirs - WAR.tick >= FEEL_COST ? WAR.profit(theirs - WAR.tick, theirs, FEEL_COST) : 0;
      this.cfV.set(this.cfProfit);
      this.last = mine;
      this.stage = "result";
      const won = WAR.won(mine, theirs);
      this.prompt.set(won === WAR.buyers ? "You took every buyer." : won > 0 ? "You split the buyers." : "They took every buyer.");
      this.note.set(this.youProfit === this.cfProfit ? `You made ${this.youProfit}. That was the best price.` : `You made ${this.youProfit}. One tick under them: ${this.cfProfit}.`);
      this.announce(`You charged ${mine}, they charged ${theirs}. You earned ${this.youProfit}.`);
      this.cue(this.youProfit >= this.cfProfit ? "good" : "bad");
      if (this.round >= 4) this.prompt.set("Five rounds. Every cut gave the other a reason to cut.");
      else this.main.label = "Next";
    } else {
      this.round++;
      this.stage = "set";
      this.rival = WAR.feelRival(this.round, this.last, FEEL_COST);
      this.resetScene();
      this.main.label = "Set";
      this.prompt.set("Set your price. The cheaper firm gets every buyer.");
      this.note.set(`They charge ${this.rival}. Drag your price, then tap Set.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.r = 9;
    this.rv.snap(9);
    this.reached = false;
    this.prompt.set("Always undercut. Where does it end?");
    this.refreshSee();
    this.sync();
  }

  private setRival(x: number): void {
    const v = clamp(this.plot.fit(this.frame).valueAtX(x), FEEL_COST, TOP_PRICE);
    this.r = Math.round(v);
    this.afterRival();
  }

  private undercut(): void {
    if (this.r <= FEEL_COST) return;
    this.r -= WAR.tick;
    this.afterRival();
  }

  private afterRival(): void {
    this.rv.set(this.r);
    if (this.r <= FEEL_COST && !this.reached) this.reachedCost();
    else this.refreshSee();
    this.sync();
  }

  private reachedCost(): void {
    this.reached = true;
    this.prompt.set("It ends at cost. Both earn nothing.");
    this.note.set("No price earns more, so neither firm moves. That is the end.");
    this.announce("The price war ends at cost.");
    this.sync();
  }

  private refreshSee(): void {
    if (this.r <= FEEL_COST) return;
    const b = WAR.bestReply(this.r, FEEL_COST);
    this.note.set(`They charge ${this.r}. Best reply ${b} earns ${WAR.profit(b, this.r, FEEL_COST)}.`);
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private get puzzle(): PriceCase {
    return this.puzzles[Math.min(this.pi, this.puzzles.length - 1)]!;
  }

  private loadPuzzle(): void {
    const c = this.puzzle;
    this.locked = false;
    this.price = 7;
    this.handle.snap(7);
    this.ringAns.snap(0);
    this.resetScene();
    this.prompt.set(c.kind === "same" ? `Both firms cost ${c.mine}. Where does the price settle?` : `Your cost is ${c.mine}, theirs ${c.theirs}. What do you charge?`);
    this.note.set("Drag your price, then tap Lock in.");
    this.sync();
  }

  private hideAnswer(): void {
    if (this.show.target > 0) {
      this.show.set(0);
      this.cfV.set(0);
      this.note.set(`Your price ${this.price}. Tap Lock in when sure.`);
    }
  }

  private rivalPrice(c: PriceCase, price: number): number {
    return c.kind === "same" ? (price > c.mine + WAR.tick ? price - WAR.tick : price) : c.theirs;
  }

  private lockIn(): void {
    const c = this.puzzle;
    const price = this.price;
    const ok = c.accepts(price);
    this.cue(ok ? "good" : "bad");
    const rp = this.rivalPrice(c, price);
    this.deal(price, rp, c.mine, c.kind === "same" ? c.mine : c.theirs);
    this.cfV.set(0);
    const mine = c.profitAt(price);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.ringAns.set(1);
      this.prompt.set(c.kind === "same" ? "Right. Price falls to cost." : "Right. Just under their cost.");
      this.note.set(c.kind === "same" ? "Two firms at cost earn nothing, and neither can do better." : `You take every buyer and earn ${c.bestProfit}. They cannot follow.`);
      this.wait = 1.8;
    } else if (c.kind === "same") {
      this.prompt.set(price < c.mine ? "Below cost you lose on every sale." : "They undercut you.");
      this.note.set(price < c.mine ? `Each sale loses ${c.mine - price}. Cost is ${c.mine}.` : `At ${price} they go to ${price - WAR.tick}. Cuts go on until cost, ${c.mine}.`);
    } else {
      this.cfV.set(c.bestProfit);
      this.cfProfit = c.bestProfit;
      this.prompt.set(price > c.answer ? "Too high. They take the buyers." : "Too low. You leave money.");
      this.note.set(`At ${price} you earn ${mine}. One tick under their cost earns ${c.bestProfit}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.handle.set(this.price);
    this.handle.step(dt);
    this.rv.step(dt);
    for (const v of [this.youV, this.theyV, this.cfV, this.show, this.ringAns]) v.step(dt);
    if (this.w > 0) this.dots.forEach((d, i) => d.set(this.dotTarget(i)).valueOf());
    for (const d of this.dots) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Rivals undercut until price meets cost.");
          this.note.set("A cost edge is the only way out: price just under their cost.");
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
    if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawPrice(p, c, f);
  }

  private drawPrice(p: Painter, c: Colors, f: Frame): void {
    const t = this.track(f);
    const prove = this.beat !== "feel";
    const pz = prove ? this.puzzle : null;
    const font = Type.body(13, 400);
    p.text(pz ? `You cost ${pz.mine}` : `You charge ${this.price}`, t.x0, t.labelY, { font, color: c.ink });
    p.text(pz ? `They cost ${pz.kind === "same" ? pz.mine : pz.theirs}` : `They charge ${this.rival}`, t.x1, t.labelY, { font, color: c.ink, align: "right" });
    p.rule(t.x0, t.y, t.x1, t.y, c.ink, 0.5);
    for (const v of PRICES) {
      p.rule(t.X(v), t.y - 4, t.X(v), t.y + 4, c.ink, 0.5);
      p.text(String(v), t.X(v), t.y + 28, { font: Type.mono(11), color: c.ash, align: "center" });
    }
    if (pz) {
      p.disc(t.X(pz.mine), t.y, 3.5, c.ink);
      p.ring(t.X(pz.kind === "same" ? pz.mine : pz.theirs), t.y, 6.5, c.ink, 1.25);
      if (this.ringAns.value > 0.01) p.ring(t.X(pz.answer), t.y, 16, c.ink, 1.5, this.ringAns.value);
    } else p.ring(t.X(this.rival), t.y, 14, c.ink, 1.5);
    const live = prove ? !this.locked : this.stage === "set";
    const hx = t.X(clamp(this.handle.value, FEEL_COST, TOP_PRICE));
    p.disc(hx, t.y, 8, c.ink);
    if (live) p.ring(hx, t.y, 13, c.ink, 1, 0.35);

    const s = this.scene(f);
    const a = this.show.value;
    for (const d of this.dots) p.disc(d.value, s.by, 4.5, c.ink, 0.9);
    if (a > 0.01) {
      const ry = this.rad(this.youV.value, s.R);
      const rt = this.rad(this.theyV.value, s.R);
      p.disc(s.xl, s.cy, ry, c.ink, a);
      p.ring(s.xr, s.cy, rt, c.ink, 1.5, a);
      p.dashedRing(s.xl, s.cy, this.rad(this.cfV.value, s.R), c.ink, a);
      const lab = (v: number): string => (v < 0 ? `${v}` : String(v));
      p.text(`You ${lab(this.youProfit)}`, s.xl, s.ly, { font, color: c.ink, align: "center", alpha: a });
      p.text(`They ${lab(this.theyProfit)}`, s.xr, s.ly, { font, color: c.ink, align: "center", alpha: a });
    }
    const n = prove ? this.puzzles.length : 5;
    const x0 = this.cx - ((n - 1) * 20) / 2;
    for (let i = 0; i < n; i++) {
      const done = prove ? i < this.solved : i < this.round || (i === this.round && this.stage === "result");
      Glyph.step(p, c, x0 + i * 20, f.tickY, done, i === (prove ? this.pi : this.round));
    }
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot.fit(f);
    pl.axes(p, c, { xTicks: PRICES, xLabel: "your price", yLabel: "your profit" });
    const r = this.r;
    const pts: [number, number][] = PRICES.map((v) => [pl.X(v), pl.Y(WAR.profit(v, r, FEEL_COST))]);
    p.path(pts, c.ink, 1.25, 0.55);
    for (const [x, y] of pts) p.disc(x, y, 3.5, c.ink);
    const b = WAR.bestReply(r, FEEL_COST);
    p.ring(pl.X(b), pl.Y(WAR.profit(b, r, FEEL_COST)), 9, c.ink, 1.5);
    const rx = pl.X(clamp(this.rv.value, FEEL_COST, TOP_PRICE));
    p.line(rx, pl.top, rx, pl.base, c.ink, 1, 0.7, [3, 4]);
    p.text(`they charge ${r}`, pl.right, pl.top - 8, { font: Type.body(12, 400), color: c.fog, align: "right" });
    for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < 1, i === 1);
  }
}
