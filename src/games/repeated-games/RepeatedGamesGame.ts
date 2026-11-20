import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { inside } from "../shared/MatrixView";
import { FEEL_CASE, FEEL_ROUNDS, GrimOpponent, PROVE_TOLERANCE, RepeatedDilemma, proveSet, type Move } from "./model";

const fmt = (v: number): string => String(Math.round(v * 100) / 100);
const fmt1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
const WORD: Record<Move, string> = { hold: "Hold", break: "Break" };
const COLS = 8;
/** The last pair of Prove cases, so a replay never shows the same two. */
let lastKey = "";

/**
 * Feel: eight rounds against a grim opponent. Break pays more today and costs every round after.
 * See: two streams of payoffs, each round worth d times the one before. Drag patience, they cross.
 * Prove: new payoffs. Drag patience to where holding starts to win.
 */
export class RepeatedGamesGame extends Game {
  readonly slug = "repeated-games";
  private readonly g = FEEL_CASE;
  private opp = new GrimOpponent();
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private mine: Move | null = null;
  private theirs: Move | null = null;
  private armed: Move | null = null;
  private since = 0;
  private total = 0;
  private holdTotal = 0;
  private broke = 0;
  private readonly youR = new Damped(0, 0.35);
  private readonly theirR = new Damped(0, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly barYou = new Damped(0, 0.5);
  private readonly barHold = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private d = 0.2;
  private readonly dShown = new Damped(0.2, 0.12);
  private lo = 1;
  private hi = 0;
  private found = false;
  private readonly cross = new Damped(0, 0.6);

  private cases: RepeatedDilemma[] = [];
  private pi = 0;
  private pd = 0.5;
  private dragging = false;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.opp = new GrimOpponent();
    this.round = 0;
    this.stage = "choose";
    this.mine = null;
    this.theirs = null;
    this.total = 0;
    this.holdTotal = 0;
    this.broke = 0;
    this.youR.snap(0);
    this.theirR.snap(0);
    this.altR.snap(0);
    this.barYou.snap(0);
    this.barHold.snap(0);
    this.intro.snap(0).set(1);
    this.cross.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Hold or break, again and again. No end is announced.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = FEEL_ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= FEEL_ROUNDS && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.found;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "hold";
        else if (inside(this.pair(1), x, y)) this.armed = "break";
      }
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setD(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setPd(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setD(x);
    else if (this.beat === "prove") this.setPd(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && inside(this.pair(m === "hold" ? 0 : 1), x, y)) this.play(m);
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Move): void {
    this.theirs = this.opp.move();
    this.mine = m;
    this.opp.observe(m);
    this.stage = "wait";
    this.since = 0;
    this.youR.set(this.rad(1.4));
    this.theirR.set(this.rad(1.4));
    this.altR.set(0);
    this.prompt.set(this.round === 0 ? "Watch what each choice pays." : "Again. No end is announced.");
    this.note.set("");
    this.sync();
  }

  private reveal(): void {
    const me = this.mine!;
    const th = this.theirs!;
    const [got, theirs] = this.g.payoff(me, th);
    const other: Move = me === "hold" ? "break" : "hold";
    const alt = this.g.payoff(other, th)[0];
    this.total += got;
    this.holdTotal += this.g.R;
    if (me === "break" && !this.broke) this.broke = this.round + 1;
    this.youR.set(this.rad(got));
    this.theirR.set(this.rad(theirs));
    this.altR.set(this.rad(alt));
    this.barYou.set(this.total);
    this.barHold.set(this.holdTotal);
    this.note.set(`They ${th === "hold" ? "held" : "broke"}. You got ${got}. ${WORD[other]} would have paid ${alt}.`);
    this.announce(`Round ${this.round + 1}. You chose ${me}, they ${th === "hold" ? "held" : "broke"}. You got ${got}. ${other} would have paid ${alt}. Total ${this.total}, always holding ${this.holdTotal}.`);
    this.round++;
    this.stage = "result";
    this.since = 0;
    if (this.round >= FEEL_ROUNDS) {
      this.prompt.set("That was the last. Compare the two bars.");
      this.note.set(`You earned ${this.total}. Holding every round earns ${this.holdTotal}.`);
    }
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 2 : this.discMax() * Math.sqrt(v / this.g.T);
  }

  private discMax(): number {
    return clamp((this.frame.h - 132) / 2, 16, 34);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.d = 0.2;
    this.dShown.snap(0.2);
    this.lo = 1;
    this.hi = 0;
    this.found = false;
    this.cross.snap(0);
    this.prompt.set("Two streams. Drag patience, which is worth more?");
    this.note.set(`Hold pays ${this.g.R} every round. Break pays ${this.g.T} once, then ${this.g.P}.`);
    this.sync();
  }

  private track(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 24, x1: f.x + f.w - 24, y: f.bottom - 44 };
  }

  private setD(x: number): void {
    const { x0, x1 } = this.track(this.frame);
    this.d = Math.round(clamp((x - x0) / (x1 - x0), 0, 0.95) * 100) / 100;
    this.lo = Math.min(this.lo, this.d);
    this.hi = Math.max(this.hi, this.d);
    if (!this.found && this.lo < 0.35 && this.hi > 0.65) {
      this.found = true;
      this.cross.set(1);
      const th = this.g.threshold;
      this.prompt.set(`They cross at ${fmt(th)}. Be patient and hold.`);
      this.note.set(`(${this.g.T} - ${this.g.R}) / (${this.g.T} - ${this.g.P}) = ${fmt(th)}. Break gains ${this.g.T - this.g.R} now, loses ${this.g.R - this.g.P} a round after.`);
      this.announce(`Holding is worth more once patience passes ${fmt(th)}.`);
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    const s = proveSet(this.env.rng, lastKey);
    lastKey = s.key;
    this.cases = s.games;
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.pd = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "They punish forever. Where does Hold start to win?" : "New payoffs. Where does Hold start to win?");
    this.note.set("Drag your patience, then lock it in.");
    this.sync();
  }

  private setPd(x: number): void {
    const { x0, x1 } = this.track(this.frame);
    this.pd = Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * 100) / 100;
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const ok = Math.abs(this.pd - c.threshold) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Past that, the future outweighs the grab.");
      this.note.set(`(${c.T} - ${c.R}) / (${c.T} - ${c.P}) = ${fmt(c.threshold)}.`);
      this.wait = 1.8;
    } else {
      const d = Math.min(this.pd, 0.99);
      this.prompt.set(this.pd < c.threshold ? "Too impatient. Breaking still pays more." : "Too patient. Holding already wins before that.");
      this.note.set(`At ${d.toFixed(2)}: hold is worth ${fmt1(c.holdValue(d))}, break is worth ${fmt1(c.breakValue(d))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.altR.step(dt);
    this.barYou.step(dt);
    this.barHold.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    this.dShown.set(this.d);
    this.dShown.step(dt);
    if (this.beat === "feel") {
      if (this.stage === "wait") {
        this.since += dt;
        if (this.since > 0.6) this.reveal();
      } else if (this.stage === "result" && this.round < FEEL_ROUNDS) {
        this.since += dt;
        if (this.since > 1.3) {
          this.stage = "choose";
          this.mine = null;
          this.sync();
        }
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Hold when the future is worth more than the grab.");
          this.note.set("A threat of endless punishment only works if you care about later.");
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
    const a = this.intro.value;
    const Rk = this.discMax();
    const cy = f.top + Rk + 6;
    const off = Math.min(86, f.w / 2 - Rk - 10);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const pulse = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const turned = this.opp.turned;
    p.dashedRing(xl, cy, this.altR.value, c.ink, 0.8 * a);
    p.disc(xl, cy, this.youR.value, c.ink, 0.95 * a * pulse);
    p.ring(xr, cy, this.theirR.value, c.ink, 1.5, a * pulse);
    if (turned && this.stage !== "wait" && this.round > 0) {
      const s = this.theirR.value;
      p.line(xr - s * 0.7, cy + s * 0.7, xr + s * 0.7, cy - s * 0.7, c.ink, 1.5, a);
    }
    const ly = cy + Rk + 20;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.mine && this.stage === "result") {
      p.text(WORD[this.mine].toLowerCase(), xl, ly + 18, { font: Type.body(12, 400), color: c.ash, align: "center" });
      p.text(this.theirs === "hold" ? "hold" : "break", xr, ly + 18, { font: Type.body(12, 400), color: c.ash, align: "center" });
    }

    const x0 = f.x + 4;
    const labelW = 78;
    const bx = x0 + labelW;
    const bw = f.w - 4 - labelW - 34;
    const y1 = f.bottom - 34;
    const y2 = f.bottom - 12;
    const scale = (v: number) => (clamp(v / 28, 0, 1) * bw);
    p.text("you", x0, y1, { font: Type.body(12, 400), color: c.fog, base: "middle", alpha: a });
    p.text("always hold", x0, y2, { font: Type.body(12, 400), color: c.fog, base: "middle", alpha: a });
    p.rect(bx, y1 - 4, Math.max(1, scale(this.barYou.value)), 8, c.ink, 0.92 * a);
    p.frame(bx, y2 - 4, Math.max(2, scale(this.barHold.value)), 8, c.ink, 0.7 * a);
    p.text(String(Math.round(this.total)), x0 + f.w - 4, y1, { font: Type.mono(11), color: c.ink, align: "right", base: "middle", alpha: a });
    p.text(String(Math.round(this.holdTotal)), x0 + f.w - 4, y2, { font: Type.mono(11), color: c.fog, align: "right", base: "middle", alpha: a });

    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const m: Move = i === 0 ? "hold" : "break";
      const live = this.stage === "choose";
      const chosen = this.mine === m;
      const al = (this.round >= FEEL_ROUNDS && this.stage === "result" ? 0 : live ? 1 : chosen ? 0.9 : 0.3) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === m ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const dr = Math.min(17, z.h * 0.15) * Math.sqrt((m === "hold" ? this.g.R : this.g.T) / this.g.T);
      p.disc(gx, z.y + z.h * 0.26, dr, c.ink, 0.92 * al);
      p.text(WORD[m], gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(m === "hold" ? `${this.g.R} or ${this.g.S}` : `${this.g.T} or ${this.g.P}`, gx, z.y + z.h - 9, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 70 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const d = Math.min(this.dShown.value, 0.99);
    const { x0, x1, y: ty } = this.track(f);
    const labelW = 64;
    const gx0 = f.x + labelW;
    const cw = (f.w - labelW - 6) / COLS;
    const rowH = clamp((ty - 46 - f.top) / 2, 34, 58);
    const Rm = Math.min(cw * 0.46, rowH * 0.46, 20);
    const hold = g.holdValue(d);
    const brk = g.breakValue(d);
    const rows: { kind: "hold" | "break"; name: string; v: number; cy: number }[] = [
      { kind: "hold", name: "hold", v: hold, cy: f.top + rowH / 2 + 2 },
      { kind: "break", name: "break", v: brk, cy: f.top + rowH * 1.5 + 12 },
    ];
    for (const r of rows) {
      const win = r.v >= (r.kind === "hold" ? brk : hold);
      p.text(r.name, f.x, r.cy - 8, { font: Type.body(13, 400), color: c.ink });
      p.text(fmt1(r.v), f.x, r.cy + 10, { font: Type.mono(11), color: win ? c.ink : c.ash });
      for (let t = 0; t < COLS; t++) {
        const v = g.stream(r.kind, t);
        p.disc(gx0 + (t + 0.5) * cw, r.cy, Rm * Math.sqrt((v * d ** t) / g.T), c.ink, 0.92);
      }
    }
    p.rule(x0, ty, x1, ty, c.ink, 0.5);
    for (const v of [0, 0.5, 1]) {
      const x = x0 + v * (x1 - x0);
      p.rule(x, ty - 5, x, ty + 5, c.ink, 0.5);
      if (v !== 0.5) p.text(String(v), x, ty + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    p.text("patience", (x0 + x1) / 2, ty + 40, { font: Type.body(12, 400), color: c.fog, align: "center" });
    const mx = x0 + this.dShown.value * (x1 - x0);
    p.text(this.d.toFixed(2), mx, ty - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    const cr = this.cross.value;
    if (cr > 0.01) p.ring(x0 + g.threshold * (x1 - x0), ty, 13, c.ink, 1.5, cr);
    p.disc(mx, ty, 9, c.ink);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)] ?? this.g;
    const Rd = clamp((f.h - 150) / 2, 18, 30);
    const cy = f.top + Rd + 2;
    const spread = Math.min(112, (f.w - 24) / 3);
    const items: [string, number][] = [[`break alone ${k.T}`, k.T], [`both hold ${k.R}`, k.R], [`both break ${k.P}`, k.P]];
    items.forEach(([label, v], i) => {
      const x = this.cx + (i - 1) * spread;
      p.disc(x, cy, Rd * Math.sqrt(v / k.T), c.ink, 0.92);
      p.text(label, x, cy + Rd + 22, { font: Type.body(12, 400), color: c.ink, align: "center" });
    });
    const { x0, x1, y: ty } = this.track(f);
    p.text("Your patience", x0, ty - 54, { font: Type.body(13, 400), color: c.fog });
    p.rule(x0, ty, x1, ty, c.ink, 0.5);
    for (const v of [0, 0.5, 1]) {
      const x = x0 + v * (x1 - x0);
      p.rule(x, ty - 5, x, ty + 5, c.ink, 0.5);
      if (v !== 0.5) p.text(String(v), x, ty + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const mx = x0 + this.pd * (x1 - x0);
    p.text(fmt(this.pd), mx, ty - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(x0 + k.threshold * (x1 - x0), ty, 13, c.ink, 1.5, tv);
    p.disc(mx, ty, 9, c.ink);
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
