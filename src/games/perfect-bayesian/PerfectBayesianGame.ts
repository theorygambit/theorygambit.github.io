import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { drawChoice, Slider } from "../shared/kit";
import { FEEL, FEEL_ROUNDS, HIRE, PASS, feelSignals, hireValue, isRight, proveSet, type Case } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const n0 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * Feel: an applicant shows a degree or not. Hire or pass, four times.
 * See: tap each signal to see who sends it. Strong types send it more often, so it shifts the odds.
 * Prove: new rates. Drag the share of strong senders among those who sent the signal.
 */
export class PerfectBayesianGame extends Game {
  readonly slug = "perfect-bayesian";
  private signals: boolean[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private sel: 0 | 1 | null = null;
  private seen = new Set<number>();
  private readonly rows = [new Damped(0, 0.5), new Damped(0, 0.5)];

  private cases: Case[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private dragging = false;
  private wait = 0;
  readonly sl = new Slider();
  private readonly share = new Damped(0, 0.2);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.signals = feelSignals(this.env.rng);
    this.round = 0;
    this.solved = 0;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose((i % 2) as 0 | 1);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    this.pick(0);
    this.pick(1);
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "prove" ? 44 : this.compact ? 60 : 68;
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.sl.place(f.x + 30, f.x + f.w - 30, f.bottom - 34);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.seen.size >= 2;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "see" && this.seen.size < 2) this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "prove" && !this.locked && y > this.sl.y - 40) {
      this.dragging = true;
      this.sl.setFromX(x, 0.01);
      this.touch();
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging && this.beat === "prove" && !this.locked) {
      this.sl.setFromX(x, 0.01);
      this.touch();
    }
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a === null || !this.hit(a, x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.choose(a);
    else if (this.beat === "see") this.pick(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = null;
    this.show.snap(0);
    this.prompt.set(this.signals[this.round]! ? "An applicant has a degree." : "An applicant has no degree.");
    this.note.set(`Applicant ${this.round + 1} of ${FEEL_ROUNDS}. Hiring pays ${HIRE} if strong, 0 if weak. Passing pays ${PASS}.`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const sent = this.signals[this.round]!;
    const post = FEEL.posterior(sent);
    const hire = hireValue(post);
    const pay = i === 0 ? hire : PASS;
    const alt = i === 0 ? PASS : hire;
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(pay);
    this.alt.snap(0).set(alt);
    const k = { strong: FEEL.posterior(sent) * 10 };
    this.prompt.set(`${Math.round(k.strong)} of 10 like this are strong.`);
    this.note.set(`You get ${n0(pay)} on average. The other choice pays ${n0(alt)}.`);
    this.announce(`${Math.round(k.strong)} of 10 are strong. You get ${n0(pay)}.`);
    this.cue(pay >= alt ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.sel = null;
    this.seen = new Set();
    for (const r of this.rows) r.snap(0);
    this.prompt.set("Tap each signal. Who sends it?");
    this.note.set("Half of all applicants are strong.");
    this.sync();
  }

  pick(i: 0 | 1): void {
    this.sel = i;
    this.seen.add(i);
    this.rows[i]!.set(1);
    const k = { strong: FEEL.posterior(i === 0) * 10 };
    this.note.set(`${i === 0 ? "With" : "Without"} a degree: ${Math.round(k.strong)} of 10 are strong.`);
    if (this.seen.size >= 2) {
      this.prompt.set("Strong ones send it more, so it shifts the odds.");
      this.announce("A degree makes a strong applicant more likely, and no degree makes a weak one more likely.");
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
    const k = this.cases[this.pi]!;
    this.locked = false;
    this.sl.value = 0.5;
    this.share.snap(0.5);
    this.prompt.set(`${Math.round(k.m.p * 100)} strong, ${Math.round((1 - k.m.p) * 100)} weak. Degree rates: ${Math.round(k.m.s * 100)}% and ${Math.round(k.m.w * 100)}%.`);
    this.note.set(`Among those ${k.sent ? "with" : "without"} a degree, drag the share that are strong.`);
    this.sync();
  }

  touch(): void {
    this.share.set(this.sl.value);
  }

  lockIn(): void {
    const k = this.cases[this.pi]!;
    const v = this.sl.value;
    if (isRight(k, v)) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. About ${pct(k.m.posterior(k.sent))} are strong.`);
      this.note.set("Strong over everyone who sent the signal.");
      this.wait = 2.2;
    } else {
      this.cue("bad");
      const c = k.m.counts(k.sent, 100);
      this.prompt.set(v > k.m.posterior(k.sent) ? "Too high." : "Too low.");
      this.note.set(`${Math.round(c.strong)} strong and ${Math.round(c.weak)} weak ${k.sent ? "have" : "lack"} it. ${Math.round(c.strong)} of ${Math.round(c.strong + c.weak)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.alt, this.show, this.share, ...this.rows]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A signal is believed because of who would send it.");
          this.note.set("Beliefs come from the strategies, by Bayes.");
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

  /** Ten people: strong ones are discs, weak ones are rings. */
  private group(p: Painter, c: Colors, f: Frame, y: number, strong: number, a: number): void {
    const gap = Math.min(26, (f.w - 40) / 10);
    for (let i = 0; i < 10; i++) {
      const x = this.cx - (9 * gap) / 2 + i * gap;
      if (i < Math.round(strong)) p.disc(x, y, 7, c.ink, 0.95 * a);
      else p.ring(x, y, 7, c.ink, 1.25, a);
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const open = this.stage === "choose";
    (["Hire", "Pass"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 4.6, (f.h - 90) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, HIRE) / HIRE);
    const sv = this.show.value;
    if (open) {
      p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    } else if (sv > 0.01) {
      p.disc(this.cx, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.dashedRing(this.cx, cy, rad(this.alt.value), c.ink, 0.8 * sv);
      this.group(p, c, f, cy + R + 28, FEEL.posterior(this.signals[this.round]!) * 10, sv);
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const both = this.seen.size >= 2;
    (["Degree", "No degree"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.sel === i, alpha: both ? 0 : this.sel === i ? 1 : 0.7 });
    });
    const y1 = f.top + 40;
    const y2 = y1 + Math.min(90, (f.h - 90) / 2);
    ([0, 1] as const).forEach((i) => {
      const v = this.rows[i]!.value;
      if (v < 0.02) return;
      const y = i === 0 ? y1 : y2;
      p.text(i === 0 ? "with a degree" : "without a degree", this.cx, y - 22, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: v });
      this.group(p, c, f, y, FEEL.posterior(i === 0) * 10, v);
    });
    if (!this.seen.size) p.dashedRing(this.cx, f.top + 60, 24, c.ink, 0.4);
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.seen.has(i), false);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const R = clamp(Math.min((f.w - 24) / 3, (f.h - 80) / 2.6), 16, 56);
    const cy = f.top + R + 8;
    p.ring(this.cx, cy, R, c.ink, 0.8, 0.5);
    p.disc(this.cx, cy, R * Math.sqrt(clamp(this.share.value, 0, 1)), c.ink, 0.95);
    p.text(`${pct(this.share.value)} strong`, this.cx, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    this.sl.draw(p, c);
    p.text("0%", this.sl.x0, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text("100%", this.sl.x1, this.sl.y + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
