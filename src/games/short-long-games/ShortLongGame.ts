import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { FEEL_GAME, MAX_ROUNDS, PROVE_POOL, type Repeated } from "./model";

type Move = "hold" | "break";
const PLAYS = 5;

/**
 * Feel: one round with a stranger, then four with a partner who copies your last move.
 * See: drag the number of rounds. Two discs show the totals for holding and for betraying first.
 * Prove: new payoffs. Drag to the first round count where holding wins.
 */
export class ShortLongGame extends Game {
  readonly slug = "short-long-games";
  private readonly g = FEEL_GAME;
  private play = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private mine: Move | null = null;
  private theirs: Move = "hold";
  private last: Move = "hold";
  private since = 0;
  private armed: Move | null = null;
  private readonly youR = new Damped(0, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly themR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);
  private total = 0;

  private readonly sl = new Slider();
  private dragging = false;
  private reached = false;
  private readonly holdR = new Damped(0, 0.4);
  private readonly betrayR = new Damped(0, 0.4);

  private pool: Repeated[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextPlay(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.play = 0;
    this.stage = "choose";
    this.mine = null;
    this.last = "hold";
    this.total = 0;
    this.youR.snap(0);
    this.altR.snap(0);
    this.themR.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.prompt.set("A stranger, once. Hold or break?");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.play = PLAYS;
    this.total = 9;
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, this.trackY(f));
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.play >= PLAYS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "hold";
      else if (inside(this.pair(1), x, y)) this.armed = "break";
    } else if ((this.beat === "see" || (this.beat === "prove" && !this.locked)) && this.sl.hit(x, y)) {
      this.dragging = true;
      this.setRounds(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.setRounds(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && inside(this.pair(m === "hold" ? 0 : 1), x, y)) this.choose(m);
  }

  // ---- Feel -------------------------------------------------------------

  private choose(m: Move): void {
    this.mine = m;
    this.theirs = this.play === 0 ? (this.env.rng.chance(0.5) ? "hold" : "break") : this.last;
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set("Watch what each choice pays.");
    this.sync();
  }

  private reveal(): void {
    const me = this.mine!;
    const th = this.theirs;
    const got = this.g.oneShot(me, th);
    const other: Move = me === "hold" ? "break" : "hold";
    const alt = this.g.oneShot(other, th);
    this.total += got;
    this.youR.set(this.rad(got));
    this.altR.set(this.rad(alt));
    this.themR.set(this.rad(this.g.oneShot(th, me)));
    const word = (m: Move) => (m === "hold" ? "held" : "broke");
    this.note.set(`They ${word(th)}. You got ${got}. The other move paid ${alt}.`);
    this.announce(`Play ${this.play + 1}. You ${word(me)}, they ${word(th)}. You got ${got}. The other move paid ${alt}.`);
    this.last = me;
    this.play++;
    this.stage = "result";
    this.prompt.set(this.play >= PLAYS ? `Total ${this.total}. Holding every round pays more.` : this.play === 1 ? "Now the same partner, four times." : "They will copy you. Choose.");
    this.sync();
  }

  private nextPlay(): void {
    if (this.stage !== "result") return;
    if (this.play >= PLAYS) return this.enterSee();
    this.stage = "choose";
    this.mine = null;
    this.youR.set(0);
    this.altR.set(0);
    this.themR.set(0);
    this.note.set("");
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 0.05 : Math.sqrt(v / 5);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.sl.range(1, MAX_ROUNDS, 1);
    this.sl.value = 1;
    this.reached = false;
    this.holdR.snap(0).set(1);
    this.betrayR.snap(0).set(1);
    this.prompt.set("Drag the rounds. When does holding win?");
    this.note.set("Betray first, and they answer with betrayal.");
    this.sync();
  }

  private setRounds(x: number): void {
    this.sl.setFromX(x);
    if (this.beat === "see") {
      const n = this.sl.value;
      if (n >= this.g.breakEven && !this.reached) {
        this.reached = true;
        this.cue("good");
        this.prompt.set(`From round ${this.g.breakEven}, holding wins.`);
        this.announce(`With ${n} rounds holding earns ${this.g.hold(n)} and betraying first earns ${this.g.betray(n)}.`);
        this.sync();
      }
      if (!this.reached) this.note.set(`${n} round${n === 1 ? "" : "s"}. Betray first and they answer with betrayal.`);
      else this.note.set(`${n} rounds. Hold earns ${this.g.hold(n)}, betray first earns ${this.g.betray(n)}.`);
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pool = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.sl.range(1, MAX_ROUNDS, 1);
    this.sl.value = 1;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New payoffs. First round count where holding wins?" : "Different payoffs. Where does holding win?");
    this.note.set("Betray first and they answer with betrayal for good.");
    this.sync();
  }

  private lockIn(): void {
    const q = this.pool[this.pi]!;
    const n = this.sl.value;
    const ok = n === q.breakEven;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. Holding wins from round ${n}.`);
      this.note.set(`${n} x ${q.R} = ${q.hold(n)} beats ${q.T} + ${n - 1} x ${q.P} = ${q.betray(n)}.`);
      this.wait = 1.8;
    } else {
      this.prompt.set("Not quite. Compare the two totals.");
      this.note.set(`At ${n}: hold ${q.hold(n)}, betray first ${q.betray(n)}. Holding must win.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.themR.step(dt);
    this.holdR.step(dt);
    this.betrayR.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.6) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.pool.length) {
          this.prompt.set("Long games make cooperation pay.");
          this.note.set("More rounds, a bigger temptation needs a longer wait.");
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

  private trackY(f: Frame): number {
    return f.bottom - 34;
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const s = clamp((f.h - 56) / 150, 0.62, 1.1);
    const y = f.top + 46 * s + 4;
    const off = Math.min(86, f.w / 2 - 46 * s - 8);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const R = 46 * s;
    p.dashedRing(xl, y, this.altR.value * R, c.ink, 0.8);
    p.disc(xl, y, this.youR.value * R, c.ink, 0.95 * a * idle);
    p.ring(xr, y, 30 * s, c.ink, 1.5, a * idle);
    p.disc(xr, y, this.themR.value * 30 * s * 0.6, c.ink, a);
    const ly = y + 46 * s + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(this.play === 0 ? "Stranger" : "Partner", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(this.play === 0 ? "plays once" : "copies your last move", xr, ly + 20, { font: Type.body(12, 400), color: c.ash, align: "center", alpha: a });
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const m: Move = i === 0 ? "hold" : "break";
      const live = this.stage === "choose";
      const chosen = this.mine === m;
      const al = (live ? 1 : this.stage === "wait" ? (chosen ? 0.9 : 0.3) : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === m ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(22, z.h * 0.19) * (m === "break" ? 1 : 0.77), c.ink, 0.92 * al);
      p.text(m === "hold" ? "Hold" : "Break", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(m === "hold" ? "3 if they hold" : "5 if they hold", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < PLAYS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.play, i === this.play);
  }

  /** Two discs whose areas are the totals, and the round track under them. */
  private drawTotals(p: Painter, c: Colors, f: Frame, game: Repeated, n: number, showHold: number, showBetray: number): void {
    const top = f.top;
    const ty = this.sl.y;
    const room = ty - 56 - top;
    const maxTotal = Math.max(game.hold(MAX_ROUNDS), game.betray(MAX_ROUNDS), 1);
    const R = clamp(room / 2 - 18, 18, 56);
    const cy = top + R + 4;
    const off = Math.min(86, f.w / 2 - R - 10);
    const rh = R * Math.sqrt(game.hold(n) / maxTotal) * showHold;
    const rb = R * Math.sqrt(game.betray(n) / maxTotal) * showBetray;
    p.disc(this.cx - off, cy, rh, c.ink, 0.92);
    p.disc(this.cx + off, cy, rb, c.ink, 0.5);
    p.text(`Hold ${game.hold(n)}`, this.cx - off, cy + R + 22, { font: Type.mono(13), color: c.ink, align: "center", alpha: showHold });
    p.text(`Break ${game.betray(n)}`, this.cx + off, cy + R + 22, { font: Type.mono(13), color: c.ink, align: "center", alpha: showBetray });
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const n = this.sl.value;
    this.drawTotals(p, c, f, this.g, n, this.holdR.value, this.betrayR.value);
    this.sl.draw(p, c, { ticks: [1, 5, 10] });
    if (this.reached) {
      const bx = this.sl.X(this.g.breakEven);
      p.ring(bx, this.sl.y, 13, c.ink, 1.25, 0.8);
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const q = this.pool[Math.min(this.pi, this.pool.length - 1)]!;
    const R = clamp((f.h - 150) / 2, 22, 38);
    const cy = f.top + R + 2;
    const off = Math.min(84, f.w / 2 - R - 12);
    const rad = (v: number) => R * Math.sqrt(v / 10);
    p.disc(this.cx - off, cy, rad(q.T), c.ink, 0.92);
    p.disc(this.cx, cy, rad(q.R), c.ink, 0.65);
    p.disc(this.cx + off, cy, rad(q.P), c.ink, 0.4);
    const ly = cy + R + 22;
    p.text(`T ${q.T}`, this.cx - off, ly, { font: Type.mono(13), color: c.ink, align: "center" });
    p.text(`R ${q.R}`, this.cx, ly, { font: Type.mono(13), color: c.ink, align: "center" });
    p.text(`P ${q.P}`, this.cx + off, ly, { font: Type.mono(13), color: c.ink, align: "center" });
    this.sl.draw(p, c, { ticks: [1, 5, 10] });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(q.breakEven), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.pool.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
