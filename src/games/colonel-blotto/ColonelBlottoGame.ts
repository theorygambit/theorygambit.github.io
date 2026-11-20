import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Blotto, FEEL_ROUNDS, FEEL_TROOPS, feelOpponents, proveSet, type Alloc, type BlottoPuzzle } from "./model";

interface Round {
  you: Alloc;
  opp: Alloc;
}

/**
 * Feel: split 12 troops over three fields against four opponents. Drag the two dividers, send.
 * See: every split of 12 sits in a triangle. Tap an opponent to light up what beats it.
 * Prove: new totals. Split the troops so you hold more fields than they do.
 */
export class ColonelBlottoGame extends Game {
  readonly slug = "colonel-blotto";
  private opps: Alloc[] = [];
  private hist: Round[] = [];
  private round = 0;
  private stage: "set" | "shown" = "set";
  private T = FEEL_TROOPS;
  private h1 = 4;
  private h2 = 8;
  private grab: 0 | 1 | null = null;
  private readonly show = new Damped(0, 0.5);
  private readonly sizes = [new Damped(0, 0.18), new Damped(0, 0.18), new Damped(0, 0.18)];

  private tapped = new Set<number>();
  private sel = -1;
  private readonly lit = new Damped(0, 0.5);

  private cases: BlottoPuzzle[] = [];
  private pi = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;

  private readonly send = this.add(new CanvasButton("Send", () => this.sendIt(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.opps = feelOpponents(this.env.rng);
    this.hist = [];
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.sendIt();
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.tapped = new Set([0, 1, 2, 3]);
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.send, this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.send.visible = feel && this.stage === "set";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.tapped.size >= FEEL_ROUNDS;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private mine(): Alloc {
    return [this.h1, this.h2 - this.h1, this.T - this.h2];
  }

  private grow(): void {
    const m = this.mine();
    for (let i = 0; i < 3; i++) this.sizes[i]!.set(m[i]!);
  }

  // ---- Geometry ---------------------------------------------------------

  private bar(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 26, x1: f.x + f.w - 26, y: f.bottom - 18 };
  }

  private lanes(f: Frame, maxN: number): { R: number; cx: number[]; c1: number; c2: number; ly: number } {
    const colW = f.w / 3;
    const R = clamp(Math.min(colW / 2 - 8, (f.h - 40 - 40) / 4.4), 12, 44);
    const c1 = f.top + R + 2;
    const c2 = c1 + 2 * R + 8;
    void maxN;
    return { R, cx: [0, 1, 2].map((i) => f.x + colW * (i + 0.5)), c1, c2, ly: c2 + R + 14 };
  }

  private rad(n: number, R: number, maxN: number): number {
    return R * Math.sqrt(Math.max(0, n) / maxN);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") {
      this.tapSee(x, y);
      return;
    }
    if (this.canDrag()) {
      const { x0, x1 } = this.bar(this.frame);
      const cell = (x1 - x0) / this.T;
      const d1 = Math.abs(x - (x0 + this.h1 * cell));
      const d2 = Math.abs(x - (x0 + this.h2 * cell));
      this.grab = d1 < d2 || (d1 === d2 && x < x0 + this.h1 * cell) ? 0 : 1;
      this.drag(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.grab !== null && this.canDrag()) this.drag(x);
  }

  protected override onUp(_x: number, _y: number): void {
    this.grab = null;
  }

  private canDrag(): boolean {
    return (this.beat === "feel" && this.stage === "set") || (this.beat === "prove" && !this.locked);
  }

  private drag(x: number): void {
    const { x0, x1 } = this.bar(this.frame);
    const v = clamp(Math.round(((x - x0) / (x1 - x0)) * this.T), 0, this.T);
    if (this.grab === 0) this.h1 = Math.min(v, this.h2);
    else this.h2 = Math.max(v, this.h1);
    this.grow();
    if (this.beat === "prove" && this.wrong) {
      this.wrong = false;
      this.show.set(0);
      this.note.set("Move the dividers, then lock in.");
    }
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "set";
    this.T = FEEL_TROOPS;
    this.h1 = 4;
    this.h2 = 8;
    this.show.snap(0);
    const m = this.mine();
    for (let i = 0; i < 3; i++) this.sizes[i]!.snap(m[i]!);
    this.prompt.set("Send troops to three fields. More troops takes a field.");
    this.note.set(`Round ${this.round + 1} of ${FEEL_ROUNDS}. Hold two fields to win.`);
    this.sync();
  }

  private sendIt(): void {
    const you = this.mine();
    const opp = this.opps[this.round]!;
    this.hist.push({ you, opp });
    this.stage = "shown";
    this.show.set(1);
    const a = Blotto.held(you, opp);
    const b = Blotto.held(opp, you);
    const win = a > b;
    this.prompt.set(win ? `You hold ${a} of 3. You win.` : a === b ? `You hold ${a}, they hold ${b}. Nobody wins.` : `They hold ${b} of 3. They win.`);
    const c = new Blotto(FEEL_TROOPS).cheapestCounter(opp);
    this.note.set(win ? "Next time they split differently." : c ? `Sending ${c.join(", ")} would have won.` : "");
    this.announce(`You sent ${you.join(", ")}. They sent ${opp.join(", ")}.`);
    this.cue(win ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private tri(f: Frame): { s: number; V: [number, number][] } {
    const s = Math.min(f.w - 70, (f.h - 44) / 0.866, 300);
    const top = f.top + 24;
    const hgt = s * 0.866;
    return { s, V: [[this.cx, top], [this.cx - s / 2, top + hgt], [this.cx + s / 2, top + hgt]] };
  }

  private at(f: Frame, a: Alloc): [number, number] {
    const { V } = this.tri(f);
    const t = a[0] + a[1] + a[2];
    return [(a[0] * V[0]![0] + a[1] * V[1]![0] + a[2] * V[2]![0]) / t, (a[0] * V[0]![1] + a[1] * V[1]![1] + a[2] * V[2]![1]) / t];
  }

  private enterSee(): void {
    this.setBeat("see");
    this.T = FEEL_TROOPS;
    this.tapped = new Set();
    this.sel = -1;
    this.lit.snap(0);
    this.prompt.set("Tap each ring. See what beats it.");
    this.note.set("Every split of 12 is a dot. Rings are theirs, discs are yours.");
    this.sync();
  }

  private tapSee(x: number, y: number): void {
    const f = this.frame;
    let best = -1;
    let bd = 26;
    this.hist.forEach((r, i) => {
      const [px, py] = this.at(f, r.opp);
      const d = Math.hypot(px - x, py - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best < 0) return;
    this.sel = best;
    this.tapped.add(best);
    this.lit.snap(0).set(1);
    const n = new Blotto(FEEL_TROOPS).counters(this.hist[best]!.opp).length;
    if (this.tapped.size >= FEEL_ROUNDS) {
      this.prompt.set("Every split can be beaten.");
      this.note.set(`${n} splits beat this one. So no fixed split is safe. Mix them.`);
      this.announce("Every split of 12 can be beaten by another.");
    } else {
      this.note.set(`${n} of 91 splits beat this one. ${this.tapped.size} of ${FEEL_ROUNDS} tapped.`);
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
    const c = this.cases[this.pi]!;
    this.T = c.you;
    this.h1 = c.you;
    this.h2 = c.you;
    this.locked = false;
    this.wrong = false;
    this.show.snap(0);
    const m = this.mine();
    for (let i = 0; i < 3; i++) this.sizes[i]!.snap(m[i]!);
    this.prompt.set(`You have ${c.you}. They send ${c.opp.join(", ")}.`);
    this.note.set("Drag the dividers to hold more fields than they do.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const you = this.mine();
    const ok = Blotto.wins(you, c.opp);
    this.show.set(1);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. You hold ${Blotto.held(you, c.opp)} of 3.`);
      this.note.set("Spend just enough on two fields and give up the dearest.");
      this.wait = 2;
    } else {
      this.wrong = true;
      const a = Blotto.held(you, c.opp);
      const b = Blotto.held(c.opp, you);
      this.prompt.set(a === b ? "Level. Nobody wins." : "They hold more fields.");
      const lost = [0, 1, 2].filter((i) => you[i]! <= c.opp[i]!).map((i) => `field ${i + 1} by ${c.opp[i]! - you[i]!}`);
      this.note.set(`You hold ${a}, they hold ${b}. Not won: ${lost.join(", ")}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.show.step(dt);
    this.lit.step(dt);
    for (const d of this.sizes) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Outnumbered, concede a field and win two.");
          this.note.set("The other side can do the same, so mix it up.");
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
    else this.drawField(p, c, f);
  }

  private drawField(p: Painter, c: Colors, f: Frame): void {
    const feel = this.beat === "feel";
    const cs = feel ? null : this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const opp: Alloc | null = feel ? (this.stage === "shown" ? this.opps[this.round]! : null) : cs!.opp;
    const maxN = feel ? FEEL_TROOPS : Math.max(this.T, ...cs!.opp);
    const { R, cx, c1, c2, ly } = this.lanes(f, maxN);
    const sv = this.show.value;
    const mine = this.mine();
    const shownOpp = feel ? sv : 1;
    for (let i = 0; i < 3; i++) {
      const x = cx[i]!;
      if (i > 0) p.rule((cx[i]! + cx[i - 1]!) / 2, f.top, (cx[i]! + cx[i - 1]!) / 2, c2 + R, c.ink, 0.1);
      const mr = this.rad(this.sizes[i]!.value, R, maxN);
      if (opp && shownOpp > 0.01) p.ring(x, c1, this.rad(opp[i]!, R, maxN), c.ink, 1.5, shownOpp);
      if (mr > 0.5) p.disc(x, c2, mr, c.ink, 0.95);
      if (feel && this.stage === "shown" && this.hist.length && sv > 0.5) {
        const w = new Blotto(FEEL_TROOPS).cheapestCounter(opp!);
        if (w && !Blotto.wins(mine, opp!)) p.dashedRing(x, c2, this.rad(w[i]!, R, maxN), c.ink, 0.7 * sv);
      }
      const n = mine[i]!;
      let label = String(n);
      if (opp && shownOpp > 0.5) label = `${n} v ${opp[i]!} ${n > opp[i]! ? "won" : n < opp[i]! ? "lost" : "tie"}`;
      p.text(label, x, ly, { font: Type.body(13, 400), color: c.ink, align: "center" });
    }
    const { x0, x1, y } = this.bar(f);
    const cell = (x1 - x0) / this.T;
    p.rule(x0, y, x1, y, c.ink, 0.4);
    for (let k = 0; k <= this.T; k++) p.rule(x0 + k * cell, y - 3, x0 + k * cell, y + 3, c.ink, 0.4);
    const a = x0 + this.h1 * cell;
    const b = x0 + this.h2 * cell;
    p.line(x0, y, a, y, c.ink, 3, 0.9);
    p.line(a, y, b, y, c.ink, 3, 0.45);
    p.line(b, y, x1, y, c.ink, 3, 0.9);
    p.disc(a, y, 8, c.ink);
    p.disc(b, y, 8, c.ink);
    p.ring(a, y, 8, c.ground, 1.5, 0.9);
    p.ring(b, y, 8, c.ground, 1.5, 0.9);
    if (feel) for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "set");
    else for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const { V } = this.tri(f);
    p.line(V[0]![0], V[0]![1], V[1]![0], V[1]![1], c.ink, 1, 0.35);
    p.line(V[1]![0], V[1]![1], V[2]![0], V[2]![1], c.ink, 1, 0.35);
    p.line(V[2]![0], V[2]![1], V[0]![0], V[0]![1], c.ink, 1, 0.35);
    const lab = (s: string, x: number, y: number) => p.text(s, x, y, { font: Type.body(12, 400), color: c.fog, align: "center", base: "middle" });
    lab("field 1", V[0]![0], f.top + 8);
    lab("field 2", V[1]![0], V[1]![1] + 16);
    lab("field 3", V[2]![0], V[2]![1] + 16);
    const t = new Blotto(FEEL_TROOPS);
    const beat = this.sel >= 0 ? new Set(t.counters(this.hist[this.sel]!.opp).map((a) => a.join())) : null;
    const lv = this.lit.value;
    for (const a of t.lattice()) {
      const [x, y] = this.at(f, a);
      const on = beat?.has(a.join()) ?? false;
      p.disc(x, y, on ? 2.5 + 1.5 * lv : 2, c.ink, on ? 0.25 + 0.65 * lv : 0.28);
    }
    this.hist.forEach((r, i) => {
      const [ox, oy] = this.at(f, r.opp);
      const [yx, yy] = this.at(f, r.you);
      p.disc(yx, yy, 4.5, c.ink, 0.95);
      p.ring(ox, oy, i === this.sel ? 9 : 7, c.ink, i === this.sel ? 2 : 1.5, this.tapped.has(i) ? 1 : 0.7);
    });
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, this.tapped.has(i), false);
  }
}
