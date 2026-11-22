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
import { FEEL_BONUSES, FEEL_CONTRACT, MAX_BONUS, PROVE_POOL, PROVE_TOLERANCE, type Contract } from "./model";

const ROUNDS = FEEL_BONUSES.length;
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: you are the agent. At three bonuses, work or shirk, and see what each is worth on average.
 * See: drag the bonus. Working and shirking cross at one bonus.
 * Prove: new effort and success chances. Drag to the smallest bonus that makes working worthwhile.
 */
export class ScreeningPrincipalAgentGame extends Game {
  readonly slug = "screening-principal-agent";
  private g: Contract = FEEL_CONTRACT;
  private round = 0;
  private stage: "choose" | "result" = "choose";
  private armed: "work" | "shirk" | null = null;
  private picked: "work" | "shirk" | null = null;
  private readonly aR = new Damped(0, 0.4);
  private readonly bR = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private lo = MAX_BONUS;
  private hi = 0;
  private reached = false;
  private readonly cross = new Damped(0, 0.6);

  private cases: Contract[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_CONTRACT;
    this.round = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private bonus(): number {
    return FEEL_BONUSES[Math.min(this.round - (this.stage === "result" ? 1 : 0), ROUNDS - 1)]!;
  }

  private startRound(): void {
    this.stage = "choose";
    this.armed = null;
    this.picked = null;
    const b = FEEL_BONUSES[this.round]!;
    this.aR.snap(Math.sqrt(b / 8));
    this.bR.snap(Math.sqrt(this.g.e / 8));
    this.prompt.set(`Bonus ${b} if the project succeeds. Work or shirk?`);
    this.note.set(this.round === 0 ? "Working costs effort 2 but raises the chance of success." : "");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
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
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") {
      if (inside(this.pair(0), x, y)) this.armed = "work";
      else if (inside(this.pair(1), x, y)) this.armed = "shirk";
    } else if (this.beat === "see" && this.chartHit(x, y)) {
      this.dragging = true;
      this.setB(x);
    } else if (this.beat === "prove" && !this.locked && this.sl.hit(x, y)) {
      this.dragging = true;
      this.sl.setFromX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "see") this.setB(x);
    else this.sl.setFromX(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.stage === "choose" && inside(this.pair(a === "work" ? 0 : 1), x, y)) this.decide(a);
  }

  // ---- Feel -------------------------------------------------------------

  private decide(a: "work" | "shirk"): void {
    const g = this.g;
    const b = FEEL_BONUSES[this.round]!;
    const w = g.work(b);
    const s = g.shirk(b);
    const mine = a === "work" ? w : s;
    const other = a === "work" ? s : w;
    this.picked = a;
    this.aR.set(Math.sqrt(Math.max(mine, 0) / 8));
    this.bR.set(Math.sqrt(Math.max(other, 0) / 8));
    const success = this.env.rng.chance(a === "work" ? g.pH : g.pL);
    this.stage = "result";
    this.round++;
    this.cue(mine >= other ? "good" : "bad");
    this.prompt.set(success ? "The project succeeded." : "The project failed.");
    this.note.set(`On average ${a === "work" ? "working" : "shirking"} nets ${fmt(mine)}, the other ${fmt(other)}.`);
    this.announce(`On average working nets ${fmt(w)} and shirking nets ${fmt(s)}.`);
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (b: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(80, Math.min(190, f.h - 28 - 54));
    const g = this.g;
    const max = 12;
    const hi = g.work(max) + 0.6;
    const lo = -g.e - 0.4;
    return { x0, w, top, h, X: (b) => x0 + (b / max) * w, Y: (v) => top + ((hi - v) / (hi - lo)) * h };
  }

  private chartHit(x: number, y: number): boolean {
    const c = this.chart(this.frame);
    return x >= c.x0 - 20 && x <= c.x0 + c.w + 20 && y >= c.top - 10 && y <= c.top + c.h + 30;
  }

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_CONTRACT;
    this.sl.value = 1;
    this.lo = 1;
    this.hi = 1;
    this.reached = false;
    this.cross.snap(0);
    this.prompt.set("Drag the bonus. Work or shirk?");
    this.note.set("Solid is working, dashed is shirking.");
    this.sync();
  }

  private setB(px: number): void {
    const c = this.chart(this.frame);
    const b = Math.round(clamp((px - c.x0) / c.w, 0, 1) * 12 * 2) / 2;
    this.sl.value = b;
    this.lo = Math.min(this.lo, b);
    this.hi = Math.max(this.hi, b);
    const g = this.g;
    this.note.set(`Bonus ${fmt(b)}: working nets ${fmt(g.work(b))}, shirking ${fmt(g.shirk(b))}. ${g.agentWorks(b) ? "Work." : "Shirk."}`);
    if (!this.reached && this.lo < g.minimum - 1 && this.hi > g.minimum + 1) {
      this.reached = true;
      this.cross.set(1);
      this.cue("good");
      this.prompt.set(`From a bonus of ${fmt(g.minimum)}, working wins.`);
      this.announce(`Working beats shirking once the bonus reaches ${fmt(g.minimum)}.`);
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
    const k = this.cases[this.pi]!;
    this.g = k;
    this.sl.range(0, MAX_BONUS, 0.5);
    this.sl.value = 3;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New contract. Smallest bonus that makes working pay?" : "Different contract. Smallest bonus to work?");
    this.note.set(`Effort ${fmt(k.e)}. Success ${pct(k.pH)} if you work, ${pct(k.pL)} if you shirk.`);
    this.sync();
  }

  private lockIn(): void {
    const k = this.g;
    const b = this.sl.value;
    const ok = Math.abs(b - k.minimum) <= PROVE_TOLERANCE;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(`Right. ${fmt(k.e)} / (${fmt(k.pH)} - ${fmt(k.pL)}) = ${fmt(k.minimum)}.`);
      this.note.set("Below it the agent shirks. Above it, working wins.");
      this.wait = 2;
    } else {
      this.prompt.set(k.agentWorks(b) ? "Not quite. A smaller bonus works too." : "Not quite. The agent still shirks.");
      this.note.set(`At ${fmt(b)}: working nets ${fmt(k.work(b))}, shirking ${fmt(k.shirk(b))}. Working must be at least as good.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.aR.step(dt);
    this.bR.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Pay enough that working beats shirking.");
          this.note.set("The bonus covers effort, scaled by how much effort lifts success.");
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
    const g = this.g;
    const b = this.bonus();
    const R = clamp((f.h - 90) / 2, 18, 44);
    const cy = f.top + R + 8;
    const off = Math.min(86, f.w / 2 - R - 10);
    const res = this.stage === "result";
    if (res && this.picked) {
      const mine = this.picked === "work" ? g.work(b) : g.shirk(b);
      const other = this.picked === "work" ? g.shirk(b) : g.work(b);
      if (mine > 0) p.disc(this.cx - off, cy, Math.max(2, this.aR.value * R), c.ink, 0.92 * a);
      else p.dashedRing(this.cx - off, cy, 3, c.ink, a);
      p.dashedRing(this.cx + off, cy, Math.max(2, this.bR.value * R), c.ink, 0.9 * a);
      p.text(`${this.picked} ${fmt(mine)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
      p.text(`other ${fmt(other)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    } else {
      p.disc(this.cx - off, cy, Math.max(2, this.aR.value * R), c.ink, 0.92 * a);
      p.ring(this.cx + off, cy, Math.max(2, this.bR.value * R), c.ink, 1.5, a);
      p.text(`bonus ${b}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
      p.text(`effort ${g.e}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    }
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const al = (this.stage === "choose" ? 1 : 0) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === (i === 0 ? "work" : "shirk") ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.disc(gx, z.y + z.h * 0.3, Math.min(14, z.h * 0.16), c.ink, (i === 0 ? 0.92 : 0.35) * al);
      p.text(i === 0 ? "Work" : "Shirk", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(i === 0 ? `success ${pct(g.pH)}` : `success ${pct(g.pL)}`, gx, z.y + z.h - 9, { font: Type.mono(11), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const g = this.g;
    const font = Type.body(12, 400);
    p.rule(x0, Y(0), x0 + w, Y(0), c.ink, 0.35);
    p.rule(x0, top, x0, top + h, c.ink, 0.5);
    p.text("expected pay", x0, top - 14, { font, color: c.fog });
    p.text("bonus on success", x0 + w, top + h + 40, { font, color: c.fog, align: "right" });
    p.text("0", x0, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("12", x0 + w, top + h + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.line(X(0), Y(g.work(0)), X(12), Y(g.work(12)), c.ink, 2, 1);
    p.line(X(0), Y(g.shirk(0)), X(12), Y(g.shirk(12)), c.ink, 1.25, 0.8, [5, 4]);
    const b = this.sl.value;
    p.rule(X(b), top, X(b), top + h, c.ink, 0.3);
    p.disc(X(b), Y(g.work(b)), 6, c.ink, 1);
    p.ring(X(b), Y(g.shirk(b)), 6, c.ink, 1.5, 1);
    const cr = this.cross.value;
    if (cr > 0.01) {
      p.ring(X(g.minimum), Y(g.work(g.minimum)), 11, c.ink, 1.5, cr);
      p.text(fmt(g.minimum), X(g.minimum), top + h + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.g;
    const R = clamp((f.h - 130) / 2, 14, 32);
    const cy = f.top + R + 10;
    const off = Math.min(80, f.w / 2 - R - 10);
    p.ring(this.cx - off, cy, R * Math.sqrt(k.e / 5), c.ink, 1.5, 1);
    p.disc(this.cx + off, cy, Math.max(2, R * Math.sqrt(k.pH - k.pL)), c.ink, 0.92);
    p.text(`effort ${fmt(k.e)}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`lift ${pct(k.pH - k.pL)}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    this.sl.draw(p, c, { ticks: [0, 10, MAX_BONUS], text: (v) => `bonus ${fmt(v)}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(k.minimum), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
