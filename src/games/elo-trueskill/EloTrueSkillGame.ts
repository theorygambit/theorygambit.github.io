import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { Slider } from "../shared/Slider";
import { drawChoice } from "../shared/kit";
import { Elo, FEEL_ELO, FEEL_OPPONENTS, FEEL_ROUNDS, FEEL_START, answer, isRight, play, proveSet, type EloPuzzle } from "./model";

const sgn = (v: number): string => (v >= 0 ? "+" : "") + Math.round(v);

/**
 * Feel: pick who to play five times. Your rating moves by how surprising each result was.
 * See: the chance of winning against the rating gap. Drag to a gap of 300 or more.
 * Prove: a new result and K. Work out the new rating.
 */
export class EloTrueSkillGame extends Game {
  readonly slug = "elo-trueskill";
  private rating = FEEL_START;
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed = -1;
  private picked = -1;
  private readonly you = new Damped(FEEL_START, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private altAt = 0;

  private seenHigh = false;
  private seenLow = false;
  private probe = 0;
  private touched = false;
  private reached = false;
  private dragging = false;
  private readonly ring = new Damped(0, 0.6);
  private readonly plot = new Plot({ xMin: -400, xMax: 400, yMin: 0, yMax: 1, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });

  private cases: EloPuzzle[] = [];
  private pi = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly sl = new Slider();
  private readonly reveal = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.rating = FEEL_START;
    this.round = 0;
    this.solved = 0;
    this.you.snap(FEEL_START);
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose(i % 3);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setProbe(this.plot.X(350));
    this.setProbe(this.plot.X(-350));
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 70 : 72) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private box(i: number): { x: number; y: number; w: number; h: number } {
    const f = this.frame;
    const gap = 8;
    const bw = (f.w - 2 * gap) / 3;
    return { x: f.x + i * (bw + gap), y: f.actionY, w: bw, h: f.actionH };
  }

  private line(f: Frame): { x0: number; x1: number; y: number; X: (v: number) => number } {
    const x0 = f.x + 24;
    const x1 = f.x + f.w - 24;
    return { x0, x1, y: f.top + f.h * 0.48, X: (v) => x0 + ((v - 900) / 600) * (x1 - x0) };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage !== "choose") return;
      this.armed = [0, 1, 2].find((i) => this.hit(i, x, y)) ?? -1;
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.sl.setFromX(x);
      this.clearWrong();
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove" && !this.locked) {
      this.sl.setFromX(x);
      this.clearWrong();
    }
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = -1;
    if (a >= 0 && this.stage === "choose" && this.hit(a, x, y)) this.choose(a);
  }

  private hit(i: number, x: number, y: number): boolean {
    const b = this.box(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = -1;
    this.alt.snap(0);
    this.prompt.set("Pick who to play. Your rating moves with the result.");
    this.note.set(`Match ${this.round + 1} of ${FEEL_ROUNDS}. You are rated ${Math.round(this.rating)}.`);
    this.sync();
  }

  private choose(i: number): void {
    const opp = FEEL_OPPONENTS[i]!;
    const e = FEEL_ELO;
    const s = play(this.env.rng, this.rating, opp);
    const d = e.delta(this.rating, opp, s);
    // The most different result you would have had against someone else.
    let best = -1;
    let gap = -1;
    FEEL_OPPONENTS.forEach((o, j) => {
      const g = Math.abs(e.delta(this.rating, o, s) - d);
      if (j !== i && g > gap) {
        gap = g;
        best = j;
      }
    });
    const alt = e.delta(this.rating, FEEL_OPPONENTS[best]!, s);
    const before = this.rating;
    this.rating += d;
    this.picked = i;
    this.stage = "shown";
    this.you.set(this.rating);
    this.altAt = before + alt;
    this.alt.snap(0).set(1);
    this.prompt.set(`${s === 1 ? "You won" : "You lost"} against ${opp}. ${sgn(d)}.`);
    this.note.set(`Same result against ${FEEL_OPPONENTS[best]}: ${sgn(alt)}.`);
    this.announce(`${s === 1 ? "Won" : "Lost"} against ${opp}. Rating ${Math.round(this.rating)}.`);
    this.cue(s === 1 ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 0;
    this.touched = false;
    this.reached = false;
    this.seenHigh = false;
    this.seenLow = false;
    this.ring.snap(0);
    this.prompt.set("Drag the rating gap. See the chance of winning.");
    this.note.set("Equal ratings: an even chance.");
    this.sync();
  }

  private setProbe(x: number): void {
    const g = clamp(Math.round(this.plot.valueAtX(x) / 25) * 25, -400, 400);
    this.probe = g;
    this.touched = true;
    const e = FEEL_ELO.expected(1200, 1200 + g);
    const win = FEEL_ELO.delta(1200, 1200 + g, 1);
    const loss = FEEL_ELO.delta(1200, 1200 + g, 0);
    this.note.set(`Rival ${g >= 0 ? "above" : "below"} by ${Math.abs(g)}: ${Math.round(e * 100)}% to win. Win ${sgn(win)}, loss ${sgn(loss)}.`);
    if (!this.reached) {
      this.seenHigh = this.seenHigh || g >= 300;
      this.seenLow = this.seenLow || g <= -300;
      if (this.seenHigh && this.seenLow) {
        this.reached = true;
        this.ring.set(1);
        this.prompt.set("An upset pays most. Rating is a prediction.");
        this.announce("A win over a much stronger rival pays almost the full K. A win over a weaker one pays little.");
        this.sync();
      }
    }
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
    const c = this.cases[this.pi]!;
    this.sl.range(c.you - 40, c.you + 40, 1).place(0, 0, 0);
    this.sl.value = c.you;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set(`You are ${c.you}, they are ${c.opp}. You ${c.s === 1 ? "win" : "lose"}. K is ${c.k}.`);
    this.note.set("Drag to your new rating, then lock in.");
    this.sync();
  }

  private clearWrong(): void {
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`Your new rating: ${Math.round(this.sl.value)}.`);
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const v = this.sl.value;
    const ok = isRight(c, v);
    const e = new Elo(c.k).expected(c.you, c.opp);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    const a = answer(c);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. ${Math.round(a)}.`);
      this.note.set(`The chance of a win was ${Math.round(e * 100)}%. K times the surprise.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      this.prompt.set(v > a ? "Too high." : "Too low.");
      this.note.set(`The chance of a win was ${Math.round(e * 100)}%. Change = ${c.k} x (${c.s} - ${Math.round(e * 100) / 100}).`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.you, this.alt, this.ring, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A rating moves by how surprising the result was.");
          this.note.set("An upset moves it a lot. An expected win barely does.");
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
    const L = this.line(f);
    p.rule(L.x0, L.y, L.x1, L.y, c.ink, 0.4);
    for (const o of FEEL_OPPONENTS) {
      p.rule(L.X(o), L.y - 4, L.X(o), L.y + 4, c.ink, 0.4);
      p.text(String(o), L.X(o), L.y + 26, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const x = L.X(clamp(this.you.value, 900, 1500));
    if (this.stage === "shown") {
      const op = FEEL_OPPONENTS[this.picked]!;
      p.ring(L.X(op), L.y, 8, c.ink, 1.5);
      const av = this.alt.value;
      if (av > 0.01) p.dashedRing(L.X(clamp(this.altAt, 900, 1500)), L.y, 7, c.ink, 0.9 * av);
    }
    p.disc(x, L.y, 8, c.ink);
    p.text(`you ${Math.round(this.you.value)}`, x, L.y - 28, { font: Type.body(13, 400), color: c.ink, align: "center" });
    FEEL_OPPONENTS.forEach((o, i) => {
      const z = this.box(i);
      const open = this.stage === "choose";
      drawChoice(p, c, z, {
        label: `vs ${o}`,
        sub: o > this.rating + 50 ? "stronger" : o < this.rating - 50 ? "weaker" : "even",
        r: 6,
        ring: true,
        armed: this.armed === i,
        chosen: this.picked === i,
        alpha: open ? 1 : 0,
      });
    });
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [-400, -200, 0, 200, 400], xLabel: "rival rating minus yours", yLabel: "your chance to win" });
    p.rule(pl.x0, pl.Y(0.5), pl.right, pl.Y(0.5), c.ink, 0.2);
    pl.curve(p, (g) => FEEL_ELO.expected(1200, 1200 + g), c.ink, 1.75, 1, 60);
    const rg = this.ring.value;
    if (rg > 0.01) {
      p.ring(pl.X(-350), pl.Y(FEEL_ELO.expected(1200, 850)), 8, c.ink, 1.5, rg);
      p.ring(pl.X(350), pl.Y(FEEL_ELO.expected(1200, 1550)), 8, c.ink, 1.5, rg);
    }
    if (this.touched) {
      const px = pl.X(this.probe);
      p.line(px, pl.top, px, pl.base, c.ink, 1, 0.4, [3, 4]);
      p.disc(px, pl.Y(FEEL_ELO.expected(1200, 1200 + this.probe)), 4.5, c.ink);
    }
    Glyph.step(p, c, this.cx - 10, f.tickY, this.seenHigh, false);
    Glyph.step(p, c, this.cx + 10, f.tickY, this.seenLow, false);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const L = this.line(f);
    const lo = k.you - 40;
    const hi = k.you + 40;
    const X = (v: number) => L.x0 + ((v - lo) / (hi - lo)) * (L.x1 - L.x0);
    const sy = f.bottom - 40;
    this.sl.place(L.x0, L.x1, sy);
    this.sl.draw(p, c, { ticks: [lo, k.you, hi], label: (v) => String(Math.round(v)), text: (v) => String(Math.round(v)) });
    const ty = f.top + (sy - f.top) * 0.4;
    p.rule(L.x0, ty, L.x1, ty, c.ink, 0.3);
    p.disc(X(k.you), ty, 8, c.ink);
    p.text(`now ${k.you}`, X(k.you), ty - 22, { font: Type.body(13, 400), color: c.ink, align: "center" });
    const rv = this.reveal.value;
    if (rv > 0.01) {
      p.ring(X(clamp(answer(k), lo, hi)), ty, 9, c.ink, 1.5, rv);
      p.text(`${Math.round(answer(k))}`, X(clamp(answer(k), lo, hi)), ty + 26, { font: Type.mono(11), color: c.fog, align: "center", alpha: rv });
    }
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
