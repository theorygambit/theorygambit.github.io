import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { inside } from "../shared/MatrixView";
import { FEEL_GAME, PROVE_TOLERANCE, pickPuzzles, type VolunteerPuzzle } from "./model";

type Move = "step" | "wait";
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const fmt = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);
const N_MIN = 2;
const N_MAX = 12;

/**
 * Feel: you and four others. One must fix the lamp. Step up and pay, or wait and hope.
 * See: drag the size of the group. Each person helps less, and nobody helping gets more likely.
 * Prove: new benefit, cost and group size. Set the chance each steps up so waiting and stepping up pay the same.
 */
export class VolunteersDilemmaGame extends Game {
  readonly slug = "volunteers-dilemma";
  private readonly g = FEEL_GAME;
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private armed: Move | null = null;
  private mine: Move | null = null;
  private others: boolean[] = [];
  private since = 0;
  private readonly intro = new Damped(0, 0.7);
  private readonly fill: Damped[] = [0, 1, 2, 3].map(() => new Damped(0, 0.3));
  private readonly youStep = new Damped(0, 0.3);
  private readonly gotR = new Damped(0, 0.35);
  private readonly altR = new Damped(0, 0.35);

  private probe = 5;
  private maxN = 5;
  private touched = false;
  private dragging = false;
  private readonly nShown = new Damped(5, 0.25);

  private puzzles: VolunteerPuzzle[] = [];
  private pi = 0;
  private pp = 0.1;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.round = 0;
    this.stage = "choose";
    this.mine = null;
    this.others = [];
    this.armed = null;
    this.intro.snap(0).set(1);
    for (const d of this.fill) d.snap(0);
    this.youStep.snap(0);
    this.gotR.snap(0);
    this.altR.snap(0);
    this.puzzles = pickPuzzles((xs) => this.env.rng.pick(xs));
    this.probe = 5;
    this.maxN = 5;
    this.touched = false;
    this.nShown.snap(5);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("One of you must fix the lamp. All gain 3. It costs 1.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = 5;
    this.enterSee();
    if (beat === "see") {
      this.setN(11);
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
    this.lock.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 5 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.maxN >= 10;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "step";
        else if (inside(this.pair(1), x, y)) this.armed = "wait";
      } else if (this.stage === "result" && this.round < 5) this.nextRound();
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setN(this.plot().valueAtX(x));
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setP(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setN(this.plot().valueAtX(x));
    else if (this.beat === "prove" && !this.locked) this.setP(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && inside(this.pair(m === "step" ? 0 : 1), x, y)) this.play(m);
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Move): void {
    this.mine = m;
    this.others = this.g.draw(() => this.env.rng.next(), this.g.pStar);
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch who steps up." : "Again.");
    this.sync();
  }

  private reveal(): void {
    const m = this.mine!;
    const anyone = this.others.some(Boolean);
    const stepPay = this.g.volunteerPay;
    const waitPay = anyone ? this.g.benefit : 0;
    const got = m === "step" ? stepPay : waitPay;
    const alt = m === "step" ? waitPay : stepPay;
    this.others.forEach((o, i) => this.fill[i]!.set(o ? 1 : 0));
    this.youStep.set(m === "step" ? 1 : 0);
    this.gotR.set(got);
    this.altR.set(alt);
    if (m === "step") {
      this.prompt.set("You stepped up.");
      this.note.set(`You got ${got}, after paying ${this.g.cost}. Waiting would have paid ${alt}.`);
    } else if (anyone) {
      this.prompt.set("Someone else did it.");
      this.note.set(`A free ride, you got ${got}. Stepping up would have paid ${alt}.`);
    } else {
      this.prompt.set("Nobody did.");
      this.note.set(`The lamp stays dark. You got 0. Stepping up would have paid ${alt}.`);
    }
    this.announce(`Round ${this.round + 1}. You ${m === "step" ? "stepped up" : "waited"} and got ${got}. The other choice would have paid ${alt}.`);
    this.round++;
    this.stage = "result";
    if (this.round >= 5) this.prompt.set("Five rounds. Waiting paid 3 or 0.");
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.mine = null;
    this.others = [];
    for (const d of this.fill) d.set(0);
    this.youStep.set(0);
    this.gotR.set(0);
    this.altR.set(0);
    this.note.set("");
    this.prompt.set("A new lamp. Step up or wait?");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 5;
    this.maxN = 5;
    this.touched = false;
    this.nShown.snap(5);
    this.prompt.set("Drag the size of the group.");
    this.note.set("Watch each person, and the chance nobody helps.");
    this.sync();
  }

  private setN(v: number): void {
    const n = clamp(Math.round(v), N_MIN, N_MAX);
    this.probe = n;
    this.touched = true;
    const first = this.maxN < 10 && n >= 10;
    this.maxN = Math.max(this.maxN, n);
    const g = this.g.with(n);
    this.note.set(`${n} people: each steps up ${pct(g.pStar)}, nobody helps ${pct(g.nobodyAtStar)}`);
    if (first) {
      this.prompt.set("More people, less help.");
      this.announce("More people means each helps less and nobody helping becomes more likely, toward one in three.");
    }
    this.sync();
  }

  private rowR(f: Frame): number {
    return clamp(f.h / 26, 5, 10);
  }

  private plot(): Plot {
    const f = this.frame;
    const r = this.rowR(f);
    return new Plot({ xMin: N_MIN, xMax: N_MAX, yMin: 0, yMax: 1, padT: 2 * r + 8 + 30, padL: 24, padR: 24 }).fit(f);
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.pp = 0.1;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "Set the chance each steps up. Everyone must be indifferent." : "A new group. Set the chance again.");
    this.note.set("");
    this.sync();
  }

  private track(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 24, x1: f.x + f.w - 24, y: Math.min(f.bottom - 58, f.top + f.h * 0.74) };
  }

  private setP(x: number): void {
    const { x0, x1 } = this.track(this.frame);
    this.pp = Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * 100) / 100;
  }

  private lockIn(): void {
    const pz = this.puzzles[this.pi]!;
    const ok = Math.abs(this.pp - pz.answer) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    const g = pz.game;
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. Waiting and stepping up now pay the same.");
      this.note.set(`All the others wait ${pct(g.cost / g.benefit)} of the time, which is ${g.cost} / ${g.benefit}.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Look at when all the others wait.");
      this.note.set(`At ${fmt(this.pp)} they all wait ${pct(g.othersWait(this.pp))}. It must equal ${g.cost} / ${g.benefit} = ${pct(g.cost / g.benefit)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    for (const d of this.fill) d.step(dt);
    this.youStep.step(dt);
    this.gotR.step(dt);
    this.altR.step(dt);
    this.trueAt.step(dt);
    this.nShown.set(this.probe);
    this.nShown.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.7) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Each helps less as the crowd grows.");
          this.note.set("Set the chance so all the others wait cost over benefit of the time.");
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
    const S = clamp((f.h - 60) / 170, 0.6, 1.3);
    const R = 17 * S;
    const y = f.top + R + 6;
    const step = Math.min(f.w / 5, 84);
    const x = (i: number) => this.cx + (i - 2) * step;
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.disc(x(0), y, R * 0.8, c.ink, a * idle);
    p.ring(x(0), y, R * 0.8 + 6, c.ink, 1.25, this.youStep.value * a);
    for (let i = 1; i < 5; i++) {
      p.ring(x(i), y, R, c.ink, 1.5, a * idle);
      p.disc(x(i), y, R * 0.5 * this.fill[i - 1]!.value, c.ink, a);
    }
    const ly = y + R + 22;
    p.text("you", x(0), ly, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: a });
    p.text("the others", (x(1) + x(4)) / 2, ly, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: a });

    const Pr = 30 * S;
    const py = ly + 16 + Pr;
    const k = (v: number) => Pr * Math.sqrt(Math.max(0, v) / this.g.benefit);
    p.dashedRing(this.cx, py, k(this.altR.value), c.ink, 0.8);
    p.disc(this.cx, py, k(this.gotR.value), c.ink, 0.95 * a);
    if (this.stage === "result") p.text(String(this.gotR.target), this.cx, py + Pr + 20, { font: Type.mono(13), color: c.ink, align: "center" });

    for (const i of this.round >= 5 && this.stage === "result" ? [] : ([0, 1] as const)) {
      const z = this.pair(i);
      const m: Move = i === 0 ? "step" : "wait";
      const live = this.stage === "choose";
      const chosen = this.mine === m;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 5 ? 0 : 0.3) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === m ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const dr = Math.min(22, z.h * 0.19) * Math.sqrt((m === "step" ? this.g.volunteerPay : this.g.benefit) / this.g.benefit);
      if (m === "step") p.disc(gx, z.y + z.h * 0.3, dr, c.ink, 0.92 * al);
      else p.ring(gx, z.y + z.h * 0.3, dr, c.ink, 1.5, 0.92 * al);
      p.text(m === "step" ? "Step up" : "Wait", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(m === "step" ? `${this.g.volunteerPay} for sure` : `${this.g.benefit} if another does`, gx, z.y + z.h - 9, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < 5; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const r = this.rowR(f);
    const n = this.nShown.value;
    const step = Math.min(2.6 * r, (f.w - 2 * r) / 11);
    const ry = f.top + r + 4;
    for (let i = 0; i < N_MAX; i++) {
      const al = clamp(n - i, 0, 1);
      if (al <= 0.01) continue;
      const x = f.x + r + i * step;
      if (i === 0) p.disc(x, ry, r, c.ink, al);
      else p.ring(x, ry, r, c.ink, 1.5, al);
    }
    const pl = this.plot();
    pl.axes(p, c, { xTicks: [2, 4, 6, 8, 10, 12], xLabel: "people in the group" });
    p.text("each steps up", pl.x0, pl.top - 8, { font: Type.body(12, 400), color: c.fog });
    p.text("nobody helps", pl.right, pl.top - 8, { font: Type.body(12, 400), color: c.ink, align: "right" });
    const floor = this.g.cost / this.g.benefit;
    p.line(pl.x0, pl.Y(floor), pl.right, pl.Y(floor), c.ink, 1, 0.45, [3, 4]);
    p.text("1/3", pl.right - 4, pl.Y(floor) - 7, { font: Type.mono(10), color: c.ash, align: "right" });
    pl.curve(p, (v) => this.g.with(v).pStar, c.fog, 1.5, 0.9);
    pl.curve(p, (v) => this.g.with(v).nobodyAtStar, c.ink, 2, 1);
    if (this.touched) {
      const px = pl.X(n);
      const gg = this.g.with(n);
      p.line(px, pl.top, px, pl.base, c.ink, 1, 0.7, [3, 4]);
      p.disc(px, pl.Y(gg.nobodyAtStar), 5, c.ink);
      p.ring(px, pl.Y(gg.pStar), 5, c.ink, 1.5);
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const pz = this.puzzles[Math.min(this.pi, this.puzzles.length - 1)]!;
    const g = pz.game;
    const r = clamp(f.h / 9, 9, 16);
    const y1 = f.top + r + 4;
    const step = Math.min(2.6 * r, (f.w - 2 * r) / Math.max(1, g.n - 1));
    const x0 = this.cx - ((g.n - 1) * step) / 2;
    for (let i = 0; i < g.n; i++) {
      if (i === 0) p.disc(x0, y1, r, c.ink);
      else p.ring(x0 + i * step, y1, r, c.ink, 1.5);
    }
    p.text(`benefit ${g.benefit}, cost ${g.cost}, ${g.n} people`, this.cx, y1 + r + 20, { font: Type.mono(12), color: c.ink, align: "center" });

    const { x0: t0, x1: t1, y: ty } = this.track(f);
    p.rule(t0, ty, t1, ty, c.ink, 0.5);
    for (const v of [0, 0.5, 1]) {
      const x = t0 + v * (t1 - t0);
      p.rule(x, ty - 5, x, ty + 5, c.ink, 0.5);
      p.text(String(v), x, ty + 31, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const mx = t0 + this.pp * (t1 - t0);
    p.text(fmt(this.pp), mx, ty - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    const tv = this.trueAt.value;
    if (tv > 0.01) {
      const tx = t0 + pz.answer * (t1 - t0);
      p.ring(tx, ty, 14, c.ink, 1.25, tv);
      p.text(fmt(pz.answer), tx, ty + 52, { font: Type.mono(11), color: c.ink, align: "center", alpha: tv });
    }
    p.disc(mx, ty, 9, c.ink);
    for (let i = 0; i < this.puzzles.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
