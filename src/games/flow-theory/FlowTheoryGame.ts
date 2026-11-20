import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { drawTicks, fmt } from "../shared/kit";
import { BAND, Flow, LEVELS, PROVE_SKILLS, type FlowState } from "./model";

const RUN = 4.5;
const GRACE = 0.5;
const REACH = 30;
const pct = (v: number): string => `${Math.round(v * 100)}%`;
const WORD: Record<FlowState, string> = { bored: "bored", flow: "flow", anxious: "anxious" };

/**
 * Feel: three tracking runs, slow then faster then fast. Keep the disc inside the ring.
 * See: your skill from those runs, and where each run sat against it. Tap through the plane.
 * Prove: two new people with a skill each. Drag the challenge to where they would be in flow.
 */
export class FlowTheoryGame extends Game {
  readonly slug = "flow-theory";
  private runs: { c: number; h: number }[] = [];
  private level = 0;
  private stage: "ready" | "run" | "result" = "ready";
  private runT = 0;
  private inside = 0;
  private counted = 0;
  private px = 0;
  private py = 0;
  private down = false;
  private readonly held = new Damped(0, 0.6);

  private skill = 5;
  private seeStep = 0;
  private readonly dots = new Damped(0, 0.5);
  private readonly band = new Damped(0, 0.6);

  private skills: number[] = [];
  private pi = 0;
  private solved = 0;
  private ch = 5;
  private dragging = false;
  private locked = false;
  private wait = 0;
  private readonly verdict = new Damped(0, 0.4);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.runs = [];
    this.level = 0;
    this.stage = "ready";
    this.runT = 0;
    this.down = false;
    this.held.snap(0);
    this.seeStep = 0;
    this.dots.snap(0);
    this.band.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Keep the disc inside the ring. Press to start.");
    this.note.set("Three short runs. Each gets faster.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.runs = [{ c: LEVELS[0]!, h: 0.97 }, { c: LEVELS[1]!, h: 0.74 }, { c: LEVELS[2]!, h: 0.31 }];
    this.level = 3;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.level >= 3 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Tracking path ----------------------------------------------------

  /** Where the target ring is at time t on a run of challenge c. Exposed for the playtest. */
  path(t: number, c: number): { x: number; y: number } {
    const f = this.frame;
    const w = 0.5 + 0.2 * c;
    const ax = Math.max(30, f.w / 2 - 38);
    const ay = Math.max(30, f.h / 2 - 38);
    return { x: this.cx + ax * Math.sin(w * t), y: f.top + f.h / 2 + ay * Math.sin(w * 1.31 * t + 0.9) };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    this.px = x;
    this.py = y;
    this.down = true;
    if (this.beat === "feel") {
      if (this.stage === "ready" && this.level < 3) this.startRun();
      else if (this.stage === "result" && this.level < 3) this.nextRun();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.drag(y);
    }
  }

  protected override onMove(x: number, y: number): void {
    this.px = x;
    this.py = y;
    if (this.dragging) this.drag(y);
  }

  protected override onUp(): void {
    this.down = false;
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private startRun(): void {
    this.stage = "run";
    this.runT = 0;
    this.inside = 0;
    this.counted = 0;
    this.held.snap(0);
    this.prompt.set("Stay in the ring.");
    this.note.set("");
    this.sync();
  }

  private endRun(): void {
    const h = this.counted > 0 ? this.inside / this.counted : 0;
    this.runs.push({ c: LEVELS[this.level]!, h });
    this.level++;
    this.stage = "result";
    this.held.set(h);
    this.cue(h >= 0.65 ? "good" : "bad");
    this.prompt.set(this.level === 1 ? "Slow. Did your mind wander?" : this.level === 2 ? "Faster. Were you absorbed?" : "Fast. Were you tense?");
    this.note.set(this.level >= 3 ? `Held ${pct(h)}. Three runs, three feelings.` : `Held ${pct(h)}. Tap for a harder run.`);
    this.announce(`Run ${this.level}. You held the ring ${pct(h)} of the time.`);
    this.sync();
  }

  private nextRun(): void {
    this.stage = "ready";
    this.held.snap(0);
    this.prompt.set("Keep the disc inside the ring. Press to start.");
    this.note.set("");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.skill = Flow.skillFrom(this.runs);
    this.seeStep = 0;
    this.dots.snap(0);
    this.band.snap(0);
    this.prompt.set("Your skill is where you started to slip.");
    this.note.set(`Skill ${fmt(Math.round(this.skill * 10) / 10)}. Tap to place your three runs.`);
    this.sync();
  }

  private advance(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    if (this.seeStep === 1) {
      this.dots.set(1);
      this.prompt.set("Three challenges at one skill.");
      this.note.set("Tap to reveal the flow band.");
    } else {
      this.band.set(1);
      const states = this.runs.map((r) => Flow.state(r.c, this.skill));
      this.prompt.set("Flow lives on the band where challenge meets skill.");
      this.note.set(`Your runs: ${states.map((s) => WORD[s]).join(", ")}.`);
      this.announce(`Flow sits where challenge is close to skill. Your runs were ${states.join(", ")}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.skills = this.env.rng.shuffle(PROVE_SKILLS);
    this.pi = 0;
    this.solved = 0;
    this.loadPerson();
  }

  private loadPerson(): void {
    this.locked = false;
    this.ch = this.skills[this.pi]! < 5 ? 8 : 2.5;
    this.verdict.snap(0);
    this.prompt.set(this.pi === 0 ? `Her skill is ${fmt(this.skills[this.pi]!)}. Set the challenge for flow.` : `His skill is ${fmt(this.skills[this.pi]!)}. Set the challenge for flow.`);
    this.note.set("Drag the disc up or down.");
    this.sync();
  }

  private plane(f: Frame): { x0: number; y0: number; side: number } {
    const side = Math.min(f.w - 70, f.h - 64, 260);
    return { x0: this.cx - side / 2 + 10, y0: f.top + 20 + (f.h - 64 - side) / 2, side };
  }

  private drag(y: number): void {
    const { y0, side } = this.plane(this.frame);
    this.ch = clamp(((y0 + side - y) / side) * 10, 0, 10);
    this.note.set("");
  }

  private lockIn(): void {
    const s = this.skills[this.pi]!;
    const st = Flow.state(this.ch, s);
    this.verdict.set(1);
    if (st === "flow") {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set("Right. Challenge just above skill is flow.");
      this.note.set(`Challenge ${fmt(Math.round(this.ch * 10) / 10)} against skill ${fmt(s)}.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.prompt.set(st === "bored" ? "Too easy for them. They would be bored." : "Too hard for them. They would be anxious.");
      this.note.set(`Challenge ${fmt(Math.round(this.ch * 10) / 10)} against skill ${fmt(s)}. Try again.`);
      this.verdict.set(0);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.held.step(dt);
    this.dots.step(dt);
    this.band.step(dt);
    this.verdict.step(dt);
    if (this.beat === "feel" && this.stage === "run") {
      this.runT += dt;
      if (this.runT > GRACE) {
        const t = this.path(this.runT, LEVELS[this.level]!);
        this.counted += dt;
        if (this.down && Math.hypot(this.px - t.x, this.py - t.y) <= REACH) this.inside += dt;
      }
      if (this.runT >= RUN) this.endRun();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.skills.length) {
          this.prompt.set("Match the challenge to the skill, a little above.");
          this.note.set("Too little bores. Too much frightens. In between, people lose track of time.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPerson();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawPlane(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const lvl = Math.min(this.level, 2);
    if (this.stage === "ready") {
      const t = this.path(0, LEVELS[lvl]!);
      p.ring(t.x, t.y, REACH, c.ink, 1.5, 0.5 + 0.35 * Math.sin(this.time * 3));
    } else if (this.stage === "run") {
      const t = this.path(this.runT, LEVELS[lvl]!);
      const hit = this.down && Math.hypot(this.px - t.x, this.py - t.y) <= REACH;
      p.ring(t.x, t.y, REACH, c.ink, 1.5, hit ? 1 : 0.5);
      if (this.down) p.disc(this.px, this.py, 8, c.ink, 0.95);
      const k = clamp(this.runT / RUN, 0, 1);
      p.rule(f.x, f.top + 2, f.x + f.w * k, f.top + 2, c.ink, 0.4);
    } else {
      const r = Math.min(f.w, f.h) * 0.24;
      const cy = f.top + f.h / 2;
      p.ring(this.cx, cy, r, c.ink, 1, 0.2);
      p.arc(this.cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.held.value, c.ink, 3, 0.95);
      p.text(pct(this.held.value), this.cx, cy, { font: Type.mono(22), color: c.ink, align: "center", base: "middle" });
      p.text("held", this.cx, cy + r + 20, { font: Type.body(13, 400), color: c.fog, align: "center" });
    }
    drawTicks(p, c, f, this.cx, 3, this.level, Math.min(this.level, 2));
  }

  private drawPlane(p: Painter, c: Colors, f: Frame): void {
    const { x0, y0, side } = this.plane(f);
    const X = (v: number) => x0 + (v / 10) * side;
    const Y = (v: number) => y0 + side - (v / 10) * side;
    p.rule(x0, y0, x0, y0 + side, c.ink, 0.5);
    p.rule(x0, y0 + side, x0 + side, y0 + side, c.ink, 0.5);
    p.text("challenge", x0, y0 - 11, { font: Type.body(11, 400), color: c.fog, base: "middle" });
    const b = this.band.value;
    if (this.beat === "see" && b > 0.01) {
      for (const sgn of [-1, 1]) {
        const s0 = sgn === 1 ? 0 : BAND;
        const s1 = sgn === 1 ? 10 - BAND : 10;
        p.line(X(s0), Y(s0 + sgn * BAND), X(s1), Y(s1 + sgn * BAND), c.ink, 1, 0.6 * b, [4, 4]);
      }
      // Labels step aside from the skill line and the dots so nothing touches text.
      const flowAt = [7.4, 5, 2.6, 9].find((v) => Math.abs(v - this.skill) > 1.7);
      if (flowAt !== undefined && side * BAND * 0.0707 > 15) p.text("flow", X(flowAt), Y(flowAt), { font: Type.body(11, 400), color: c.ink, align: "center", base: "middle", alpha: b });
      const boredAt = [8.6, 6.4, 4.4].find((v) => Math.abs(v - this.skill) > 1.7);
      if (boredAt !== undefined) p.text("bored", X(boredAt), Y(0.7), { font: Type.body(11, 400), color: c.fog, align: "center", base: "middle", alpha: b });
    }
    if (this.beat === "see") {
      const k = this.dots.value;
      if (k > 0.01) {
        const sx = X(this.skill);
        p.line(sx, y0 + side, sx, y0, c.ink, 0.5, 0.3 * k, [2, 4]);
        for (const r of this.runs) {
          p.disc(sx, Y(r.c), 5 + 2 * (r.h > 0.65 ? 1 : 0), c.ink, k);
        }
        p.text(`skill ${fmt(Math.round(this.skill * 10) / 10)}`, sx, y0 + side + 16, { font: Type.mono(10), color: c.ash, align: "center", alpha: k });
      }
    } else {
      const s = this.skills[Math.min(this.pi, this.skills.length - 1)]!;
      const sx = X(s);
      p.line(sx, y0 + side, sx, y0, c.ink, 0.5, 0.35, [2, 4]);
      p.text(`skill ${fmt(s)}`, sx, y0 + side + 16, { font: Type.mono(10), color: c.ash, align: "center" });
      p.disc(sx, Y(Math.min(this.ch, 9.3)), 9, c.ink, 0.95);
      const v = this.verdict.value;
      if (v > 0.01) {
        p.line(X(0), Y(s - BAND), X(10), Y(s - BAND), c.ink, 0.5, 0.4 * v, [4, 4]);
        p.line(X(0), Y(s + BAND), X(10), Y(s + BAND), c.ink, 0.5, 0.4 * v, [4, 4]);
      }
      drawTicks(p, c, f, this.cx, this.skills.length, this.solved, this.pi);
      return;
    }
    drawTicks(p, c, f, this.cx, 3, this.seeStep + 1, this.seeStep);
  }
}
