import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_EFFORTS, FEEL_STREAK, MAX_STREAK, PROVE_POOL, type Case } from "./model";

const DAYS = FEEL_EFFORTS.length;

/**
 * Feel: five days with an effort each. Do it and the streak grows, skip and it resets.
 * See: drag the streak length. The cost of a break climbs and crosses the flat effort.
 * Prove: new values. Drag to the first streak length where you keep going.
 */
export class LossAversionStreaksGame extends Game {
  readonly slug = "loss-aversion-streaks";
  private readonly s = FEEL_STREAK;
  private day = 0;
  private streak = 0;
  private stage: "choose" | "result" = "choose";
  private armed: "do" | "skip" | null = null;
  private lost = 0;
  private readonly effR = new Damped(0, 0.4);
  private readonly stakeR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = MAX_STREAK;
  private hi = 0;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private cases: Case[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next day", () => this.nextDay(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.day = 0;
    this.streak = 0;
    this.stage = "choose";
    this.lost = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startDay();
  }

  private startDay(): void {
    this.stage = "choose";
    this.armed = null;
    const e = FEEL_EFFORTS[this.day]!;
    this.effR.snap(Math.sqrt(e / 12));
    this.stakeR.snap(Math.sqrt(this.s.lossIfBreak(this.streak) / 12));
    this.prompt.set(this.day === 0 ? "Day 1. Do the task, or skip?" : `Day ${this.day + 1}. Streak ${this.streak}. Do it, or skip?`);
    this.note.set(this.day === 0 ? "Doing it builds a streak. Skipping resets it." : "");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.day = DAYS;
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
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.day >= DAYS ? "See why" : "Next day";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "do";
      else if (inside(this.pair(1), x, y)) this.armed = "skip";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setS(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setS(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "do" ? 0 : 1), x, y)) this.decide(a === "do");
  }

  // ---- Feel -------------------------------------------------------------

  private decide(doIt: boolean): void {
    const e = FEEL_EFFORTS[this.day]!;
    const stake = this.s.lossIfBreak(this.streak);
    this.cue(doIt ? "good" : "bad");
    if (doIt) {
      this.streak++;
      this.prompt.set("Done. The streak grows.");
      this.note.set(`Effort ${e}. Breaking it would have cost ${fmt(stake)}. Next time it is worth ${fmt(this.s.lossIfBreak(this.streak))}.`);
    } else {
      this.lost = this.streak;
      this.streak = 0;
      this.prompt.set(stake > 0 ? "Skipped. The streak is gone." : "Skipped. Nothing to lose yet.");
      this.note.set(`Effort saved ${e}. The break cost ${fmt(stake)}.`);
    }
    this.announce(doIt ? `You did it. The streak is ${this.streak}.` : `You skipped. The streak reset.`);
    this.stage = "result";
    this.day++;
    if (this.day >= DAYS) this.prompt.set(`Day ${DAYS} done. Streak ${this.streak}.`);
    this.sync();
  }

  private nextDay(): void {
    if (this.stage !== "result") return;
    if (this.day >= DAYS) return this.enterSee();
    this.startDay();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (s: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const ymax = this.s.lossIfBreak(MAX_STREAK) * 1.05;
    return { x0, w, top, h, X: (s) => x0 + (s / MAX_STREAK) * w, Y: (v) => top + h - (v / ymax) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.sl.value = 0;
    this.lo = MAX_STREAK;
    this.hi = 0;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag the streak length. Does it pay to continue?");
    this.note.set("Each day takes effort 9.");
    this.sync();
  }

  private setS(px: number): void {
    const c = this.chart(this.frame);
    const s = Math.round(clamp((px - c.x0) / c.w, 0, 1) * MAX_STREAK);
    this.sl.value = s;
    this.lo = Math.min(this.lo, s);
    this.hi = Math.max(this.hi, s);
    const loss = this.s.lossIfBreak(s);
    this.note.set(`Streak ${s}: a break costs ${fmt(loss)}, effort is 9. ${this.s.keeps(s, 9) ? "Keep going." : "Skip."}`);
    const t = this.s.threshold(9);
    if (!this.reached && this.lo < t && this.hi >= t) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`From day ${t}, the loss beats the effort.`);
      this.announce(`From a streak of ${t}, a break costs more than the effort of the day.`);
      this.sync();
    }
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
    this.sl.range(0, MAX_STREAK, 1);
    this.sl.value = 1;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New values. First streak where you keep going?" : "Different values. Where do you start keeping it?");
    this.note.set(`A day is worth ${fmt(c.streak.g)}, losses weigh ${fmt(c.streak.lambda)}x, effort ${c.effort}.`);
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const t = c.streak.threshold(c.effort);
    const x = this.sl.value;
    const ok = x === t;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. From day ${t} you keep it.`);
      this.note.set(`${fmt(c.streak.lambda)} x ${fmt(c.streak.g)} x ${t} = ${fmt(c.streak.lossIfBreak(t))}, more than ${c.effort}.`);
      this.wait = 2;
    } else {
      const keeps = c.streak.keeps(x, c.effort);
      this.prompt.set(keeps ? "Not quite. You would keep it sooner." : "Not quite. You would still skip.");
      this.note.set(`At ${x}: a break costs ${fmt(c.streak.lossIfBreak(x))}, effort ${c.effort}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.effR.step(dt);
    this.stakeR.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("The longer the streak, the more a break costs.");
          this.note.set("Past a threshold you keep it, just to avoid the loss.");
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
    else if (this.beat === "see") this.drawChart(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const step = f.w / DAYS;
    const r = clamp(step / 2 - 6, 5, 12);
    const y0 = f.top + r + 4;
    for (let i = 0; i < DAYS; i++) {
      const x = f.x + step * (i + 0.5);
      if (i < this.streak) p.disc(x, y0, r, c.ink, 0.92 * a);
      else if (i < this.lost && this.streak === 0) p.dashedRing(x, y0, r, c.ink, 0.7 * a);
      else p.ring(x, y0, r, c.ink, 0.75, 0.35 * a);
    }
    const R = clamp((f.h - 110) / 2, 14, 36);
    const cy = y0 + r + 20 + R;
    const off = Math.min(86, f.w / 2 - R - 10);
    const e = FEEL_EFFORTS[Math.min(this.day - (this.stage === "result" ? 1 : 0), DAYS - 1)]!;
    const stakeNow = this.stage === "result" ? this.s.lossIfBreak(this.streak) : this.s.lossIfBreak(this.streak);
    p.ring(this.cx - off, cy, this.effR.value * R, c.ink, 1.5, a);
    p.dashedRing(this.cx + off, cy, Math.max(2, this.stakeR.value * R), c.ink, 0.9 * a);
    p.text(`effort ${e}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    p.text(`at stake ${fmt(stakeNow)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = (this.stage === "choose" ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "do" : "skip") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
      p.text(i === 0 ? "Do it" : "Skip", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? "pay the effort" : "reset the streak", gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < DAYS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.day, i === this.day);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const font = Type.body(12, 400);
    p.rule(x0, top + h, x0 + w, top + h, c.ink, 0.5);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("cost of a break", x0, top - 14, { font, color: c.fog });
    p.text("streak length", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(String(MAX_STREAK), x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.line(X(0), Y(0), X(MAX_STREAK), Y(this.s.lossIfBreak(MAX_STREAK)), c.ink, 2, 1);
    p.line(X(0), Y(9), X(MAX_STREAK), Y(9), c.ink, 1.25, 0.8, [5, 4]);
    const s = this.sl.value;
    p.rule(X(s), top, X(s), top + h, c.ink, 0.3);
    p.disc(X(s), Y(this.s.lossIfBreak(s)), 6, c.ink, 1);
    const cr = this.cross.value;
    if (cr > 0.01) {
      const t = this.s.threshold(9);
      p.ring(X(t), Y(this.s.lossIfBreak(t)), 11, c.ink, 1.5, cr);
      p.text(String(t), X(t), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    p.ring(this.cx, cy, R * Math.sqrt(Math.min(k.effort, 24) / 24), c.ink, 1.5, 1);
    p.text(`effort ${k.effort}`, this.cx, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 6, MAX_STREAK], text: (v) => `${fmt(v)} days` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.streak.threshold(k.effort)), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
