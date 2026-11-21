import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { Coalitions, FEEL_GAME, PROVE_POOL, type Case } from "./model";

const NAMES = ["A", "B", "C"] as const;
const ORDERS = Coalitions.orders;

/**
 * Feel: three players join one at a time, in six orders. Each takes what they add.
 * See: line up the six orders for each player and read off the average.
 * Prove: a new game. Drag to one player's average contribution.
 */
export class CooperativeGamesGame extends Game {
  readonly slug = "cooperative-games";
  private g: Coalitions = FEEL_GAME;
  private oi = 0;
  private gains: number[] = [0, 0, 0];
  private avg: number[] = [0, 0, 0];
  private readonly mR = [new Damped(0, 0.4), new Damped(0, 0.4), new Damped(0, 0.4)];
  private readonly aR = [new Damped(0, 0.4), new Damped(0, 0.4), new Damped(0, 0.4)];
  private readonly intro = new Damped(0, 0.7);

  private rows = 0;
  private readonly rowOn = [new Damped(0, 0.5), new Damped(0, 0.5), new Damped(0, 0.5)];

  private readonly sl = new Slider();
  private dragging = false;
  private cases: Case[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly nextOrder = this.add(new CanvasButton("Next order", () => this.advance(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_GAME;
    this.oi = 0;
    this.gains = [0, 0, 0];
    this.avg = [0, 0, 0];
    for (const d of [...this.mR, ...this.aR]) d.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Players join one at a time. Each takes what they add.");
    this.note.set("Tap for the first order.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.oi = ORDERS.length;
    this.enterSee();
    if (beat === "see") return;
    this.rows = 3;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.nextOrder.place(this.cx - 80, by, 160);
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.nextOrder.visible = this.beat === "feel" && this.oi < ORDERS.length;
    this.nextOrder.label = this.oi === 0 ? "First order" : "Next order";
    this.toSee.visible = this.beat === "feel" && this.oi >= ORDERS.length;
    this.toProve.visible = this.beat === "see" && this.rows >= 3;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") this.revealRow();
    else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.sl.setFromX(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private advance(): void {
    if (this.oi >= ORDERS.length) return;
    const order = ORDERS[this.oi]!;
    this.gains = this.g.gains(order);
    this.oi++;
    const sums = [0, 0, 0];
    for (let i = 0; i < this.oi; i++) this.g.gains(ORDERS[i]!).forEach((v, p) => (sums[p]! += v));
    this.avg = sums.map((s) => s / this.oi);
    const max = this.g.grand;
    for (let p = 0; p < 3; p++) {
      this.mR[p]!.set(Math.sqrt(this.gains[p]! / max));
      this.aR[p]!.set(Math.sqrt(this.avg[p]! / max));
    }
    this.cue("good");
    this.prompt.set(this.oi >= ORDERS.length ? "Six orders. The dashed rings are the averages." : `Order ${order.map((p) => NAMES[p]).join(", ")}.`);
    this.note.set(this.oi >= ORDERS.length ? `Averages: ${this.avg.map((v, p) => `${NAMES[p]} ${fmt(v)}`).join(", ")}.` : `They add ${this.gains.map((v, p) => `${NAMES[p]} ${v}`).join(", ")}.`);
    if (this.oi >= ORDERS.length) this.announce(`Averages over six orders: ${this.avg.map((v, p) => `${NAMES[p]} ${fmt(v)}`).join(", ")}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.rows = 0;
    for (const d of this.rowOn) d.snap(0);
    this.prompt.set("Tap a player to line up their six orders.");
    this.note.set("Each disc is what they added in one order.");
    this.sync();
  }

  private revealRow(): void {
    if (this.rows >= 3) return;
    const p = this.rows;
    this.rowOn[p]!.set(1);
    this.rows++;
    this.cue("good");
    const sh = this.g.shapley()[p]!;
    this.note.set(`${NAMES[p]} averages ${fmt(sh)}.`);
    if (this.rows >= 3) {
      this.prompt.set(`The shares add up to ${this.g.grand}.`);
      this.note.set(`${this.g.shapley().map((v, i) => `${NAMES[i]} ${fmt(v)}`).join(", ")}. A fair split.`);
      this.announce(`Shapley shares ${this.g.shapley().map((v, i) => `${NAMES[i]} ${fmt(v)}`).join(", ")}. They add up to ${this.g.grand}.`);
    } else this.prompt.set(this.rows === 1 ? "Now the next player." : "One more.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const c = this.cases[this.pi]!;
    this.g = c.game;
    this.sl.range(0, c.game.grand, 1);
    this.sl.value = Math.round(c.game.grand / 3);
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(`New game. What is ${NAMES[c.player]}'s fair share?`);
    this.note.set("Average what they add over the six orders.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const sh = c.game.shapley()[c.player]!;
    const x = this.sl.value;
    const ok = Math.abs(x - sh) <= 1;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${NAMES[c.player]} gets ${fmt(sh)}.`);
      this.note.set(`${ORDERS.map((o) => c.game.gains(o)[c.player]).join(" + ")} over 6 orders.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Average the six orders.");
      this.note.set(`${NAMES[c.player]} adds ${ORDERS.map((o) => c.game.gains(o)[c.player]).join(", ")} across the orders.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    for (const d of [...this.mR, ...this.aR, ...this.rowOn]) d.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A fair share is the average of what you add.");
          this.note.set("Over every order the group could form.");
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

  private values(p: Painter, c: Colors, f: Frame, a: number): void {
    const v = this.g.v;
    const font = Type.mono(11);
    const alone = `alone  A ${v[1]}  B ${v[2]}  C ${v[4]}`;
    const groups = `AB ${v[3]}  AC ${v[5]}  BC ${v[6]}  ABC ${v[7]}`;
    p.text(alone, this.cx, f.top + 10, { font, color: c.fog, align: "center", alpha: a });
    p.text(groups, this.cx, f.top + 28, { font, color: c.fog, align: "center", alpha: a });
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    this.values(p, c, f, a);
    if (this.beat === "feel") this.drawFeel(p, c, f, a);
    else if (this.beat === "see") this.drawRows(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame, a: number): void {
    const R = clamp(Math.min(f.w / 6 - 6, (f.h - 128) / 2), 12, 34);
    const cy = f.top + 58 + R + 14;
    const colW = f.w / 3;
    if (this.oi > 0) p.text(`order ${ORDERS[this.oi - 1]!.map((q) => NAMES[q]).join(" ")}`, this.cx, f.top + 46, { font: Type.mono(11), color: c.ash, align: "center", alpha: a });
    for (let i = 0; i < 3; i++) {
      const x = f.x + colW * (i + 0.5);
      p.dashedRing(x, cy, Math.max(2, this.aR[i]!.value * R), c.ink, 0.85);
      if (i === 0) p.disc(x, cy, this.mR[i]!.value * R, c.ink, 0.92 * a);
      else p.ring(x, cy, Math.max(0.5, this.mR[i]!.value * R), c.ink, 1.5, a);
      p.text(NAMES[i]!, x, cy - R - 8, { font: Type.body(14, 400), color: c.fog, align: "center", alpha: a });
      if (this.oi > 0) p.text(`+${fmt(this.gains[i]!)}  avg ${fmt(this.avg[i]!)}`, x, cy + R + 16, { font: Type.mono(10), color: c.fog, align: "center", alpha: a });
    }
    for (let i = 0; i < ORDERS.length; i++) Glyph.step(p, c, this.cx - 50 + i * 20, f.tickY, i < this.oi, i === this.oi);
  }

  private drawRows(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const top = f.top + 44;
    const rowH = Math.min(44, (f.h - 44 - 6) / 3);
    const R = Math.min(rowH / 2 - 3, 16);
    const x0 = f.x + 28;
    const stepX = (f.w - 28 - 64) / ORDERS.length;
    for (let pl = 0; pl < 3; pl++) {
      const y = top + rowH * (pl + 0.5);
      const t = this.rowOn[pl]!.value;
      p.text(NAMES[pl]!, f.x + 8, y, { font: Type.body(14, 400), color: c.fog, base: "middle" });
      ORDERS.forEach((o, k) => {
        const x = x0 + stepX * (k + 0.5);
        const m = g.gains(o)[pl]!;
        if (t < 0.02) p.disc(x, y, 1.5, c.ink, 0.35);
        else if (pl === 0) p.disc(x, y, Math.max(0.5, R * Math.sqrt(m / g.grand)) * t, c.ink, 0.92);
        else p.ring(x, y, Math.max(0.5, R * Math.sqrt(m / g.grand)) * t, c.ink, 1.5, 1);
      });
      if (t > 0.02) {
        const ax = f.x + f.w - 40;
        const sh = g.shapley()[pl]!;
        p.dashedRing(ax, y, Math.max(2, R * Math.sqrt(sh / g.grand)) * t, c.ink, 0.9);
        p.text(fmt(sh), f.x + f.w, y, { font: Type.mono(10), color: c.ink, align: "right", base: "middle", alpha: t });
      }
    }
    for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.rows, i === this.rows);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const cy = f.top + 80;
    p.text(NAMES[k.player]!, this.cx, cy, { font: Type.display(40), color: c.ink, align: "center", base: "middle" });
    this.sl.draw(p, c, { ticks: [0, Math.round(k.game.grand / 2), k.game.grand], text: (v) => `${fmt(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.game.shapley()[k.player]!), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
