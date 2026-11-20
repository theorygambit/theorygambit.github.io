import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { MatrixView, inside } from "../shared/MatrixView";
import { drawChoice, drawMatrixLabels, drawPayoffCell, drawTicks, fmt } from "../shared/kit";
import { COMMIT_CASES, Chicken, DRIVER_RATES, type Move } from "./model";

/**
 * Feel: five drivers with records of how often they dared. Swerve or dare, and see what the other would have paid.
 * See: tap each choice to mark the best reply. Two cells are marked by both players, and each has one swerver.
 * Prove: you have thrown away the wheel and will dare. Does a rival with new payoffs swerve?
 */
export class ChickenGame extends Game {
  readonly slug = "chicken";
  private readonly g = new Chicken();
  private drivers: number[] = [];
  private mine: Move[] = [];
  private theirs: Move[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private armed: Move | null = null;
  private readonly youR = new Damped(7, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly notch = new Damped(0, 0.5);
  private readonly inner = new Damped(0, 0.3);
  private readonly intro = new Damped(0, 0.7);

  private readonly mv = new MatrixView();
  private colMark: boolean[] = [false, false];
  private rowMark: boolean[] = [false, false];
  private readonly glow = new Damped(0, 0.6);

  private cases: Chicken[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: Move | null = null;
  private readonly rightRing = new Damped(0, 0.4);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.drivers = this.env.rng.shuffle(DRIVER_RATES);
    this.mine = [];
    this.theirs = [];
    this.round = 0;
    this.stage = "choose";
    this.youR.snap(7);
    this.altR.snap(0);
    this.inner.snap(0);
    this.notch.snap(0).set(1);
    this.intro.snap(0).set(1);
    this.colMark = [false, false];
    this.rowMark = [false, false];
    this.glow.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Swerve or dare. Daring wins, unless they dare too.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.drivers.forEach((q, i) => {
      this.mine.push(i % 2 === 0 ? "dare" : "swerve");
      this.theirs.push(q > 0.5 ? "dare" : "swerve");
    });
    this.round = 5;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      this.colMark = [true, true];
      this.rowMark = [true, true];
      this.glow.snap(1);
      this.afterMark();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 5 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.marked === 4;
  }

  private get marked(): number {
    return this.colMark.filter(Boolean).length + this.rowMark.filter(Boolean).length;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "swerve";
        else if (inside(this.pair(1), x, y)) this.armed = "dare";
      } else if (this.stage === "result" && this.round < 5) this.nextDriver();
    } else if (this.beat === "see") this.mark(x, y);
    else if (this.beat === "prove" && !this.locked) {
      if (inside(this.pair(0), x, y)) this.armed = "swerve";
      else if (inside(this.pair(1), x, y)) this.armed = "dare";
    }
  }

  protected override onUp(x: number, y: number): void {
    const m = this.armed;
    this.armed = null;
    if (!m || !inside(this.pair(m === "swerve" ? 0 : 1), x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.play(m);
    else if (this.beat === "prove" && !this.locked) this.answer(m);
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Move): void {
    const q = this.drivers[this.round]!;
    this.mine.push(m);
    this.theirs.push(this.env.rng.chance(q) ? "dare" : "swerve");
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what each choice pays." : "Again.");
    this.sync();
  }

  private revealRound(): void {
    const me = this.mine[this.round]!;
    const th = this.theirs[this.round]!;
    const got = this.g.payoff(me, th);
    const other: Move = me === "swerve" ? "dare" : "swerve";
    const alt = this.g.payoff(other, th);
    this.youR.set(this.rad(got));
    this.altR.set(this.rad(alt));
    this.inner.set(th === "dare" ? 1 : 0);
    const verb = other === "swerve" ? "Swerving" : "Daring";
    this.note.set(`They ${th === "dare" ? "dared" : "swerved"}. You got ${fmt(got)}. ${verb} would have paid ${fmt(alt)}.`);
    this.announce(`Driver ${this.round + 1}. You ${me === "dare" ? "dared" : "swerved"}, they ${th === "dare" ? "dared" : "swerved"}. You got ${fmt(got)}. ${verb} would have paid ${fmt(alt)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 5 ? "Five drivers. Count the crashes." : "Tap for the next driver.");
    this.sync();
  }

  private nextDriver(): void {
    this.stage = "choose";
    this.youR.set(7);
    this.altR.set(0);
    this.inner.set(0);
    this.notch.snap(0).set(1);
    this.note.set("");
    this.prompt.set("Swerve or dare. Daring wins, unless they dare too.");
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 2 : 50 * Math.sqrt(v / this.g.T);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.colMark = [false, false];
    this.rowMark = [false, false];
    this.glow.snap(0);
    this.prompt.set("Tap what they do. See your best reply.");
    this.note.set("Tap your own choices too, to see theirs.");
    this.sync();
  }

  private mark(x: number, y: number): void {
    const m = this.mv;
    for (const col of [0, 1]) {
      if (x >= m.x0 + col * m.cell && x <= m.x0 + (col + 1) * m.cell && y >= m.y0 - m.colLabelH && y < m.y0) this.colMark[col] = true;
    }
    for (const row of [0, 1]) {
      if (y >= m.y0 + row * m.cell && y <= m.y0 + (row + 1) * m.cell && x >= m.x0 - m.rowLabelW && x < m.x0) this.rowMark[row] = true;
    }
    this.afterMark();
  }

  private afterMark(): void {
    const n = this.marked;
    if (n === 4) {
      this.glow.set(1);
      const crashes = this.mine.filter((mm, i) => mm === "dare" && this.theirs[i] === "dare").length;
      this.prompt.set("Two cells nobody wants to leave. Each has a swerver.");
      this.note.set(`${crashes === 0 ? "You never crashed." : `You crashed ${crashes} time${crashes === 1 ? "" : "s"}.`} Swerve when they dare, dare when they swerve.`);
      this.announce("Two cells are stable. In each, one driver swerves and the other dares.");
    } else if (n > 0) {
      this.prompt.set(n < 2 ? "Dot: your best reply. Ring: theirs." : "Keep going. Mark all four.");
      this.note.set(`${n} of 4 marked.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(COMMIT_CASES);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
  }

  private loadCase(): void {
    this.locked = false;
    this.wrong = null;
    this.rightRing.snap(0);
    this.prompt.set(this.pi === 0 ? "You threw away the wheel. You will dare." : "New payoffs. You will still dare.");
    this.note.set("Tap what a rational rival does.");
    this.sync();
  }

  private answer(m: Move): void {
    const cs = this.cases[this.pi]!;
    const right = cs.rivalReply();
    if (m === right) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.rightRing.set(1);
      this.prompt.set(right === "swerve" ? "Right. A crash is worse than yielding." : "Right. Here a crash beats yielding.");
      this.note.set(right === "swerve" ? `Swerving pays them ${fmt(cs.S)}, a crash only ${fmt(cs.P)}.` : `A crash pays them ${fmt(cs.P)}, swerving only ${fmt(cs.S)}. The threat fails.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.wrong = m;
      this.prompt.set("Not quite. Compare what each pays them.");
      this.note.set(`Swerving pays them ${fmt(cs.S)}. Crashing pays them ${fmt(cs.P)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.notch.step(dt);
    this.inner.step(dt);
    this.glow.step(dt);
    this.rightRing.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.6) this.revealRound();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A threat works only if the crash is worse than giving in.");
          this.note.set("Commit first and the other driver swerves. Make the crash cheap and they will not.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadCase();
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
    const s = clamp((f.h - 56) / 150, 0.62, 1.1);
    const y = f.top + 46 * s + 4;
    const off = Math.min(86, f.w / 2 - 46 * s - 8);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const q = this.drivers[Math.min(this.round, 4)]!;
    const k = Math.round(q * 10);
    const idle = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    const youMax = 50 * s;

    p.dashedRing(xl, y, this.altR.value * s, c.ink, 0.8);
    p.disc(xl, y, this.youR.value * s, c.ink, 0.95 * a * idle);
    p.ring(xr, y, 30 * s, c.ink, 1.5, a * idle);
    p.disc(xr, y, 9 * s * this.inner.value, c.ink, a);
    for (let i = 0; i < 10; i++) {
      const a0 = -Math.PI / 2 + (i / 10) * Math.PI * 2 + 0.07;
      const filled = i < k * this.notch.value;
      p.arc(xr, y, 42 * s, a0, a0 + (Math.PI * 2) / 10 - 0.14, c.ink, 3, (filled ? 0.95 : 0.2) * a);
    }
    const ly = y + Math.max(youMax, 46 * s) + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(`dared ${k} of 10`, xr, ly + 20, { font: Type.body(12, 400), color: c.ash, align: "center", alpha: a });

    for (const i of [0, 1] as const) {
      if (this.round >= 5) break;
      const m: Move = i === 0 ? "swerve" : "dare";
      const live = this.stage === "choose";
      const chosen = this.mine[this.round - (this.stage === "result" ? 1 : 0)] === m && this.stage !== "choose";
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 5 ? 0 : 0.3) * a;
      const top = m === "swerve" ? this.g.R : this.g.T;
      const low = m === "swerve" ? this.g.S : this.g.P;
      drawChoice(p, c, this.pair(i), { label: m === "swerve" ? "Swerve" : "Dare", sub: `${fmt(top)} or ${fmt(low)}`, r: 22 * Math.sqrt(top / this.g.T), alpha: al, armed: this.armed === m });
    }
    drawTicks(p, c, f, this.cx, 5, this.round, this.round);
  }

  private placeMatrix(f: Frame): void {
    this.mv.fit(this.cx, f.top, f.w, f.h, 140);
    const total = this.mv.colLabelH + 2 * this.mv.cell;
    this.mv.fit(this.cx, f.top + Math.max(0, (f.h - total) / 2), f.w, f.h, 140);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    this.placeMatrix(f);
    const m = this.mv;
    const bm = this.g.matrix();
    m.grid(p, c);
    for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) drawPayoffCell(p, c, m, r, col, bm);
    drawMatrixLabels(p, c, m, bm);
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 4);
    // Unmarked headers breathe, so the player knows they can be tapped.
    for (let col = 0; col < 2; col++) if (!this.colMark[col]) p.line(m.colX(col) - 14, m.y0 - 7, m.colX(col) + 14, m.y0 - 7, c.ink, 1, 0.25 + 0.3 * pulse);
    for (let r = 0; r < 2; r++) if (!this.rowMark[r]) p.line(m.x0 - 6, m.rowY(r) + 14, m.x0 - 6, m.rowY(r) - 14, c.ink, 1, 0.25 + 0.3 * pulse);
    for (let col = 0; col < 2; col++) {
      if (!this.colMark[col]) continue;
      const r = bm.bestRows(col)[0]!;
      const b = m.rect(r, col);
      p.disc(b.x + 9, b.y + 9, 3, c.ink);
    }
    for (let r = 0; r < 2; r++) {
      if (!this.rowMark[r]) continue;
      const col = bm.bestCols(r)[0]!;
      const b = m.rect(r, col);
      p.ring(b.x + b.w - 9, b.y + 9, 3.5, c.ink, 1.25);
    }
    const g = this.glow.value;
    if (g > 0.01) for (const [r, col] of bm.stable()) {
      const b = m.rect(r, col);
      p.frame(b.x + 4, b.y + 4, b.w - 8, b.h - 8, c.ink, g);
    }
    drawTicks(p, c, f, this.cx, 4, this.marked, Math.min(this.marked, 3));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const cs = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    this.placeMatrix(f);
    const m = this.mv;
    const bm = cs.matrix();
    m.grid(p, c);
    for (let r = 0; r < 2; r++) for (let col = 0; col < 2; col++) drawPayoffCell(p, c, m, r, col, bm, r === 1 ? 1 : 0.22);
    drawMatrixLabels(p, c, m, bm);
    const rr = this.rightRing.value;
    if (rr > 0.01) {
      const col = cs.rivalReply() === "swerve" ? 0 : 1;
      const cb = m.rect(1, col);
      p.frame(cb.x + 4, cb.y + 4, cb.w - 8, cb.h - 8, c.ink, rr);
    }
    for (const i of [0, 1] as const) {
      const mv: Move = i === 0 ? "swerve" : "dare";
      const pay = mv === "swerve" ? cs.S : cs.P;
      const al = this.wrong === mv ? 0.35 : 1;
      drawChoice(p, c, this.pair(i), { label: mv === "swerve" ? "They swerve" : "They dare", sub: `pays them ${fmt(pay)}`, r: 18 * Math.sqrt(Math.max(pay, 0.4) / Math.max(cs.S, cs.P)), alpha: this.locked ? (mv === cs.rivalReply() ? 1 : 0.3) : al, armed: this.armed === mv, ring: true });
    }
    drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
  }
}
