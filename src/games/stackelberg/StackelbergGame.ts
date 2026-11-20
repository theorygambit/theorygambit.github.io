import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { FEEL, FEEL_ROUNDS, answer, isRight, proveSet, type Puzzle } from "./model";

const r1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: you commit to a quantity first, then the rival sees it and replies.
 * See: commit big and the rival's reaction shrinks its sales. Find the peak of your profit.
 * Prove: new markets. Choose the leader's best quantity, or the follower's reply to a given one.
 */
export class StackelbergGame extends Game {
  readonly slug = "stackelberg";
  private done = 0;
  private stage: "set" | "wait" | "shown" = "set";
  private since = 0;
  private q = 30;
  private last = { q1: 0, q2: 0 };
  private dragging = false;
  private readonly bar = new Damped(30, 0.35);
  private readonly fseg = new Damped(0, 0.5);
  private readonly prof1 = new Damped(0, 0.4);
  private readonly prof2 = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private probe = 20;
  private touched = false;
  private reached = false;
  private readonly peak = new Damped(0, 0.6);
  private readonly plot = new Plot({ xMin: 0, xMax: 90, yMin: 0, yMax: 1100, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });

  private cases: Puzzle[] = [];
  private pi = 0;
  private pv = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly send = this.add(new CanvasButton("Commit", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.done = 0;
    this.solved = 0;
    this.q = 30;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.q = 30 + i * 5;
      this.commit();
      this.answer();
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.setProbe(this.plot.X(45));
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.send, this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.send.visible = feel && this.stage === "set";
    this.next.visible = feel && this.stage === "shown" && this.done < FEEL_ROUNDS;
    this.toSee.visible = feel && this.stage === "shown" && this.done >= FEEL_ROUNDS;
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private bar1(f: Frame): { x0: number; x1: number; y: number } {
    return { x0: f.x + 26, x1: f.x + f.w - 26, y: f.bottom - 26 };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, _y: number): void {
    if (this.beat === "feel" && this.stage === "set") {
      this.dragging = true;
      this.setQ(x);
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setPv(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setQ(x);
    else if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove") this.setPv(x);
  }

  protected override onUp(_x: number, _y: number): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "set";
    this.show.snap(0);
    this.fseg.snap(0);
    this.prof1.snap(0);
    this.prof2.snap(0);
    this.bar.snap(this.q);
    this.prompt.set("You move first. Choose how much to sell.");
    this.note.set(`Round ${this.done + 1} of ${FEEL_ROUNDS}. You commit to ${this.q}.`);
    this.sync();
  }

  private setQ(x: number): void {
    const { x0, x1 } = this.bar1(this.frame);
    this.q = clamp(Math.round(((x - x0) / (x1 - x0)) * FEEL.a), 0, 60);
    this.bar.set(this.q);
    this.note.set(`Round ${this.done + 1} of ${FEEL_ROUNDS}. You commit to ${this.q}.`);
  }

  private commit(): void {
    this.stage = "wait";
    this.since = 0;
    this.last = { q1: this.q, q2: FEEL.reply(this.q) };
    this.prompt.set(`You sell ${this.q}. They are watching.`);
    this.note.set("");
    this.announce(`You committed to ${this.q}.`);
    this.sync();
  }

  private answer(): void {
    const { q1, q2 } = this.last;
    this.stage = "shown";
    this.done++;
    this.fseg.set(q2);
    this.show.set(1);
    const p1 = FEEL.leaderProfit(q1);
    const p2 = FEEL.followerProfit(q1);
    this.prof1.set(p1);
    this.prof2.set(p2);
    this.prompt.set(`They sell ${r1(q2)}. You earn ${r1(p1)}, they ${r1(p2)}.`);
    this.note.set(p1 > FEEL.cournotProfit() + 1 ? `Moving first beats the ${FEEL.cournotProfit()} you earn at the same time.` : `At the same time you would earn ${FEEL.cournotProfit()}.`);
    this.announce(`They replied with ${r1(q2)}. Price ${FEEL.price(q1 + q2)}.`);
    this.cue(p1 > FEEL.cournotProfit() + 1 ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.probe = 20;
    this.touched = false;
    this.reached = false;
    this.peak.snap(0);
    this.prompt.set("They will react, so commit big. Find the peak.");
    this.note.set("Drag along your quantity. Solid: they react. Dashed: they stay at 30.");
    this.sync();
  }

  private setProbe(x: number): void {
    const v = clamp(Math.round(this.plot.valueAtX(x)), 0, 90);
    this.probe = v;
    this.touched = true;
    const r = FEEL.reply(v);
    this.note.set(`You ${v}, they reply ${r1(r)}. You earn ${r1(FEEL.leaderProfit(v))}, or ${r1(FEEL.stayProfit(v, 30))} if they stayed.`);
    if (!this.reached && Math.abs(v - 45) <= 4) {
      this.reached = true;
      this.peak.set(1);
      this.prompt.set("The peak is 45, higher than 30 would give.");
      this.announce("Your profit peaks at 45 when the rival reacts.");
      this.sync();
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
    const p = this.cases[this.pi]!;
    this.pv = 0;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    const cost = p.d.c === 0 ? "No cost." : `Cost ${p.d.c} each.`;
    if (p.kind === "lead") {
      this.prompt.set(`Price is ${p.d.a} minus the total. ${cost} You lead.`);
      this.note.set("Drag to the quantity you commit to, then lock in.");
    } else {
      this.prompt.set(`Price is ${p.d.a} minus the total. ${cost} They sold ${p.q1}.`);
      this.note.set("You follow. Drag to your quantity, then lock in.");
    }
    this.sync();
  }

  private setPv(x: number): void {
    const p = this.cases[this.pi]!;
    const { x0, x1 } = this.bar1(this.frame);
    const v = clamp(Math.round(((x - x0) / (x1 - x0)) * p.d.a), 0, p.d.a);
    this.pv = p.kind === "lead" ? v : clamp(v - p.q1, 0, p.d.a - p.q1);
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`You sell ${this.pv}.`);
  }

  private lockIn(): void {
    const p = this.cases[this.pi]!;
    const ok = isRight(p, this.pv);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    const best = answer(p);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set("Right.");
      this.note.set(p.kind === "lead" ? `Half of ${p.d.a - p.d.c}: ${r1(best)}.` : `Half of what is left: (${p.d.a - p.d.c} - ${p.q1}) / 2 = ${r1(best)}.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      if (p.kind === "lead") {
        this.prompt.set(`They would reply ${r1(p.d.reply(this.pv))}.`);
        this.note.set(`You earn ${r1(p.d.leaderProfit(this.pv))}. Committing to ${r1(best)} earns ${r1(p.d.leaderProfit(best))}.`);
      } else {
        this.prompt.set(`Their ${p.q1} leaves room for ${r1(best)}.`);
        this.note.set(`You earn ${r1(p.d.profit(this.pv, p.q1))}. Selling ${r1(best)} earns ${r1(p.d.profit(best, p.q1))}.`);
      }
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.bar, this.fseg, this.prof1, this.prof2, this.show, this.peak, this.reveal]) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.8) this.answer();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("The leader commits big. The follower takes what is left.");
          this.note.set("Going first earns twice what following does.");
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
    else this.drawBarScene(p, c, f);
  }

  private dashed(p: Painter, c: Colors, pl: Plot, fn: (x: number) => number): void {
    const n = 60;
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * 90;
      const b = ((i + 1) / n) * 90;
      p.line(pl.X(a), pl.Y(fn(a)), pl.X(b), pl.Y(fn(b)), c.ink, 1.25, 0.8);
    }
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 30, 45, 60, 90], xLabel: "your quantity", yLabel: "what you earn" });
    pl.curve(p, (q) => FEEL.leaderProfit(q), c.ink, 1.75, 1, 60);
    this.dashed(p, c, pl, (q) => Math.max(0, FEEL.stayProfit(q, 30)));
    const pk = this.peak.value;
    if (pk > 0.01) p.ring(pl.X(45), pl.Y(FEEL.leaderProfit(45)), 9, c.ink, 1.5, pk);
    if (this.touched) {
      const px = pl.X(this.probe);
      p.line(px, pl.top, px, pl.base, c.ink, 1, 0.4, [3, 4]);
      p.disc(px, pl.Y(FEEL.leaderProfit(this.probe)), 4, c.ink);
      p.ring(px, pl.Y(Math.max(0, FEEL.stayProfit(this.probe, 30))), 4, c.ink, 1.5);
      const r = 14 * Math.sqrt(FEEL.reply(this.probe) / 45);
      p.dashedRing(pl.right - 20, pl.top + 16, 14, c.ink, 0.35);
      if (r > 0.5) p.ring(pl.right - 20, pl.top + 16, r, c.ink, 1.5);
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, this.reached, false);
  }

  private drawBarScene(p: Painter, c: Colors, f: Frame): void {
    const feel = this.beat === "feel";
    const pz = feel ? null : this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const a = feel ? FEEL.a : pz!.d.a;
    const { x0, x1, y } = this.bar1(f);
    const X = (v: number) => x0 + (v / a) * (x1 - x0);
    p.rule(x0, y, x1, y, c.ink, 0.4);
    const step = a <= 90 ? 30 : 40;
    for (let t = 0; t <= a; t += step) {
      p.rule(X(t), y - 3, X(t), y + 3, c.ink, 0.4);
      p.text(String(t), X(t), y + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    const sv = this.show.value;
    let lead = 0;
    let foll = 0;
    let handle = 0;
    if (feel) {
      lead = this.stage === "set" ? this.bar.value : this.last.q1;
      foll = this.fseg.value;
      handle = lead;
    } else if (pz!.kind === "lead") {
      lead = this.pv;
      handle = lead;
      foll = this.reveal.value > 0.01 ? pz!.d.reply(this.pv) * this.reveal.value : 0;
    } else {
      lead = pz!.q1;
      foll = this.pv;
      handle = lead + foll;
    }
    foll = Math.min(foll, Math.max(0, a - lead));
    p.line(x0, y, X(lead), y, c.ink, 5, 0.95);
    if (foll > 0.01) p.line(X(lead), y, X(lead + foll), y, c.ink, 5, 0.45);
    p.disc(X(handle), y, 8, c.ink);
    p.ring(X(handle), y, 8, c.ground, 1.5, 0.9);

    // profits as area
    const ref = feel ? 1200 : ((pz!.d.a - pz!.d.c) ** 2) / 8;
    const R = clamp(Math.min((f.w - 60) / 4.6, (f.h - 80) / 2.4), 14, 60);
    const cy = f.top + R + 4;
    const xl = this.cx - 2.0 * R;
    const xr = this.cx + 2.0 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, ref * 1.4) / ref);
    const ly = cy + 1.25 * R + 14;
    if (feel) {
      if (sv > 0.01) {
        p.disc(xl, cy, rad(this.prof1.value), c.ink, 0.95 * sv);
        p.ring(xr, cy, rad(this.prof2.value), c.ink, 1.5, sv);
        p.dashedRing(xl, cy, rad(FEEL.cournotProfit()), c.ink, 0.8 * sv);
        p.text(`you ${r1(this.prof1.value)}`, xl, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
        p.text(`they ${r1(this.prof2.value)}`, xr, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
        p.text(`price ${FEEL.price(this.last.q1 + this.last.q2)}`, this.cx, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: sv });
      } else {
        p.dashedRing(xl, cy, rad(900), c.ink, 0.5);
        p.text(this.stage === "wait" ? "they are deciding" : "commit, then see", this.cx, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
      }
    } else if (this.reveal.value > 0.01) {
      const rv = this.reveal.value;
      const mine = pz!.kind === "lead" ? pz!.d.leaderProfit(this.pv) : pz!.d.profit(this.pv, pz!.q1);
      const best = answer(pz!);
      const bestP = pz!.kind === "lead" ? pz!.d.leaderProfit(best) : pz!.d.profit(best, pz!.q1);
      p.disc(xl, cy, rad(mine), c.ink, 0.95 * rv);
      p.dashedRing(xr, cy, rad(bestP), c.ink, rv);
      p.text(`you ${r1(mine)}`, xl, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: rv });
      p.text(`best ${r1(bestP)}`, xr, ly, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: rv });
    }
    if (feel) for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.done, i === this.done);
    else for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
