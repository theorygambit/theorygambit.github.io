import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { inside } from "../shared/MatrixView";
import { PARTNER_BELIEFS, PROVE_GAMES, PROVE_TOLERANCE, StagHunt, type Hunt } from "./model";

const fmt = (v: number): string => String(Math.round(v * 100) / 100);

/**
 * Feel: five partners, each with a visible record of how often they hunted stag. Stag or Hare?
 * See: the two payoff lines against your belief. They cross at hare over stag.
 * Prove: new payoffs. Drag to the belief where you would switch, then lock it in.
 */
export class StagHuntGame extends Game {
  readonly slug = "stag-hunt";
  private readonly g = new StagHunt();
  private partners: number[] = [];
  private choices: { p: number; mine: Hunt }[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private mine: Hunt | null = null;
  private theirs: Hunt | null = null;
  private since = 0;
  private armed: Hunt | null = null;
  private readonly youR = new Damped(7, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly notch = new Damped(0, 0.5);
  private readonly inner = new Damped(0, 0.3);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly stagLine = new Damped(0, 0.7);
  private readonly cross = new Damped(0, 0.6);

  private pi = 0;
  private pm = 0.5;
  private dragging = false;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.partners = this.env.rng.shuffle(PARTNER_BELIEFS);
    this.choices = [];
    this.round = 0;
    this.stage = "choose";
    this.mine = null;
    this.theirs = null;
    this.youR.snap(7);
    this.altR.snap(0);
    this.inner.snap(0);
    this.notch.snap(0).set(1);
    this.intro.snap(0).set(1);
    this.seeStep = 0;
    this.stagLine.snap(0);
    this.cross.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Stag needs both of you. Hare is safe. Choose.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.partners.forEach((p, i) => this.choices.push({ p, mine: i % 2 === 0 ? "stag" : "hare" }));
    this.round = 5;
    this.enterSee();
    if (beat === "see") {
      this.advance();
      this.advance();
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
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = "stag";
        else if (inside(this.pair(1), x, y)) this.armed = "hare";
      } else if (this.stage === "result" && this.round < 5) this.nextPartner();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setMarker(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.setMarker(x);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.stage === "choose" && inside(this.pair(m === "stag" ? 0 : 1), x, y)) this.play(m);
  }

  // ---- Feel -------------------------------------------------------------

  private play(m: Hunt): void {
    const p = this.partners[this.round]!;
    this.mine = m;
    this.theirs = this.env.rng.chance(p) ? "stag" : "hare";
    this.choices.push({ p, mine: m });
    this.stage = "wait";
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what each choice pays." : "Again.");
    this.sync();
  }

  private revealRound(): void {
    const me = this.mine!;
    const th = this.theirs!;
    const got = this.g.payoff(me, th);
    const other: Hunt = me === "stag" ? "hare" : "stag";
    const alt = this.g.payoff(other, th);
    this.youR.set(this.rad(got));
    this.altR.set(this.rad(alt));
    this.inner.set(th === "stag" ? 1 : 0);
    this.note.set(`They went for the ${th}. You got ${fmt(got)}. The ${other} would have paid ${fmt(alt)}.`);
    this.announce(`Partner ${this.round + 1}. You chose ${me}, they chose ${th}. You got ${fmt(got)}. The ${other} would have paid ${fmt(alt)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 5 ? "Five hunts. Count the ones you would redo." : "Tap for the next partner.");
    this.sync();
  }

  private nextPartner(): void {
    this.stage = "choose";
    this.mine = null;
    this.theirs = null;
    this.youR.set(7);
    this.altR.set(0);
    this.inner.set(0);
    this.notch.snap(0).set(1);
    this.note.set("");
    this.prompt.set("Stag needs both of you. Hare is safe. Choose.");
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 2 : 50 * Math.sqrt(v / 3);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.stagLine.snap(0);
    this.cross.snap(0);
    this.prompt.set(`Hare always pays ${this.g.hare}.`);
    this.note.set("Tap to continue.");
    this.sync();
  }

  private advance(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    if (this.seeStep === 1) {
      this.stagLine.set(1);
      this.prompt.set(`Stag pays ${this.g.stag} times your belief.`);
      this.note.set("Belief is the chance they hunt stag. Tap again.");
    } else {
      this.cross.set(1);
      const wrong = this.choices.filter((c) => c.mine !== this.g.best(c.p)).length;
      this.prompt.set(`They cross at ${fmt(this.g.threshold)}. Below it, hunt hare.`);
      this.note.set(`You went against the odds ${wrong} of ${this.choices.length} times.`);
      this.announce(`The lines cross at ${fmt(this.g.threshold)}. You chose against the odds ${wrong} of ${this.choices.length} times.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.pm = 0.5;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? "New payoffs. Drag to where you would switch to Stag." : "Different payoffs again. Where is the switch?");
    this.note.set("");
    this.sync();
  }

  private setMarker(x: number): void {
    const { x0, x1 } = this.track();
    this.pm = Math.round(clamp((x - x0) / (x1 - x0), 0, 1) * 100) / 100;
  }

  /** Prove layout, top to bottom: payoff discs, their labels, the title, the track. See proveGeometry. */
  private track(): { x0: number; x1: number; y: number } {
    return { x0: this.colX + 24, x1: this.colX + this.colW - 24, y: this.proveGeometry().ty };
  }

  private proveGeometry(): { R: number; cy: number; ty: number } {
    const f = this.frame;
    const R = clamp((f.h - 150) / 2, 22, 38);
    const cy = f.top + R + 2;
    const ty = Math.min(f.bottom - 52, Math.max(cy + R + 108, f.top + (f.h - 52) * 0.62));
    return { R, cy, ty };
  }

  private lockIn(): void {
    const game = PROVE_GAMES[this.pi]!;
    const off = Math.abs(this.pm - game.threshold);
    this.cue(off <= PROVE_TOLERANCE ? "good" : "bad");
    if (off <= PROVE_TOLERANCE) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. You switch where the payoffs are equal.");
      this.note.set(`${game.stag} x p = ${game.hare}, so p = ${fmt(game.threshold)}.`);
      this.wait = 1.8;
    } else {
      this.prompt.set("Not quite. Compare the two at your belief.");
      this.note.set(`At ${fmt(this.pm)}: stag is worth ${fmt(game.evStag(this.pm))}, hare is worth ${fmt(game.hare)}.`);
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
    this.stagLine.step(dt);
    this.cross.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.6) this.revealRound();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= PROVE_GAMES.length) {
          this.prompt.set("Trust pays only above hare over stag.");
          this.note.set("Raise the safe payoff and you need more trust to hunt stag.");
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
    const s = clamp((f.h - 56) / 150, 0.62, 1.1);
    const y = f.top + 46 * s + 4;
    const off = Math.min(86, f.w / 2 - 46 * s - 8);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const belief = this.partners[Math.min(this.round, 4)]!;
    const k = Math.round(belief * 10);
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
    p.text(`stag ${k} of 10 hunts`, xr, ly + 20, { font: Type.body(12, 400), color: c.ash, align: "center", alpha: a });

    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const m: Hunt = i === 0 ? "stag" : "hare";
      const live = this.stage === "choose";
      const chosen = this.mine === m;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 5 ? 0 : 0.3) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === m ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const dr = Math.min(22, z.h * 0.19) * Math.sqrt((m === "stag" ? this.g.stag : this.g.hare) / this.g.stag);
      p.disc(gx, z.y + z.h * 0.3, dr, c.ink, 0.92 * al);
      p.text(m === "stag" ? "Stag" : "Hare", gx, z.y + z.h * 0.68, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
      p.text(m === "stag" ? `${this.g.stag} if they join` : `${this.g.hare} for sure`, gx, z.y + z.h - 9, { font: Type.body(11, 400), color: c.fog, align: "center", alpha: al });
    }
    for (let i = 0; i < 5; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (p: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(90, Math.min(210, f.h - 28 - 54));
    const maxY = this.g.stag * 1.08;
    return { x0, w, top, h, X: (p) => x0 + p * w, Y: (v) => top + h - (v / maxY) * h };
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const base = top + h;
    p.rule(x0, base, x0 + w, base, c.ink, 0.5);
    p.rule(x0, top, x0, base, c.ink, 0.5);
    p.text("payoff", x0, top - 14, { font: Type.body(12, 400), color: c.fog });
    p.text("belief they hunt stag", x0 + w, base + 40, { font: Type.body(12, 400), color: c.fog, align: "right" });
    p.text("0", x0, base + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("1", x0 + w, base + 18, { font: Type.mono(10), color: c.ash, align: "center" });

    p.line(X(0), Y(this.g.hare), X(1), Y(this.g.hare), c.ink, 1.5, 0.55);
    p.text(`Hare ${this.g.hare}`, X(0) + 8, Y(this.g.hare) - 10, { font: Type.body(12, 400), color: c.fog });
    const t = this.stagLine.value;
    if (t > 0.01) {
      p.line(X(0), Y(0), X(t), Y(this.g.stag * t), c.ink, 2, 1);
      p.text("Stag", X(0) + 8, Y(this.g.stag) + 6, { font: Type.body(12, 400), color: c.ink, alpha: t });
    }
    const cr = this.cross.value;
    if (cr > 0.01) {
      const th = this.g.threshold;
      p.line(X(th), Y(this.g.hare), X(th), base, c.ink, 1, 0.7 * cr, [3, 4]);
      p.ring(X(th), Y(this.g.hare), 8, c.ink, 1.5, cr);
      p.text(fmt(th), X(th), base + 18, { font: Type.mono(11), color: c.ink, align: "center", alpha: cr });
      for (const ch of this.choices) {
        const yv = ch.mine === "stag" ? this.g.evStag(ch.p) : this.g.hare;
        p.disc(X(ch.p), Y(yv), 4.5, c.ink, cr);
        if (ch.mine !== this.g.best(ch.p)) p.ring(X(ch.p), Y(yv), 9, c.fog, 1.25, cr);
      }
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const game = PROVE_GAMES[Math.min(this.pi, PROVE_GAMES.length - 1)]!;
    const { R, cy, ty } = this.proveGeometry();
    const rad = (v: number) => R * Math.sqrt(v / 4);
    const off = Math.min(84, f.w / 2 - R - 12);
    p.disc(this.cx - off, cy, rad(game.stag), c.ink, 0.92);
    p.disc(this.cx + off, cy, rad(game.hare), c.ink, 0.92);
    p.text(`Stag ${fmt(game.stag)}`, this.cx - off, cy + R + 22, { font: Type.mono(13), color: c.ink, align: "center" });
    p.text(`Hare ${fmt(game.hare)}`, this.cx + off, cy + R + 22, { font: Type.mono(13), color: c.ink, align: "center" });

    const { x0, x1 } = this.track();
    p.text("Your belief they hunt stag", x0, ty - 54, { font: Type.body(13, 400), color: c.fog });
    p.rule(x0, ty, x1, ty, c.ink, 0.5);
    for (const v of [0, 0.5, 1]) {
      const x = x0 + v * (x1 - x0);
      p.rule(x, ty - 5, x, ty + 5, c.ink, 0.5);
      p.text(String(v), x, ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const mx = x0 + this.pm * (x1 - x0);
    p.text(fmt(this.pm), mx, ty - 27, { font: Type.mono(12), color: c.ink, align: "center" });
    const tv = this.trueAt.value;
    if (tv > 0.01) {
      const tx = x0 + game.threshold * (x1 - x0);
      p.ring(tx, ty, 16, c.ink, 1.25, tv);
      p.text(`${fmt(game.hare)} / ${fmt(game.stag)}`, tx, ty + 46, { font: Type.mono(11), color: c.ink, align: "center", alpha: tv });
    }
    p.disc(mx, ty, 9, c.ink);
    for (let i = 0; i < PROVE_GAMES.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
