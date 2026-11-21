import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Plot } from "../shared/Plot";
import { drawChoice } from "../shared/kit";
import { FEEL, FEEL_A, FEEL_ROUNDS, feelSignals, isRight, proveSet, type Light, type Move, type Profile } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const r1 = (v: number): string => String(Math.round(v * 10) / 10);
const flip = (m: Move): Move => (m === "go" ? "wait" : "go");

/**
 * Feel: a traffic light tells you to go or wait. Obey it or ignore it, five times.
 * See: tap each signal to see what obeying and ignoring pay, given what the light implies about the other driver.
 * Prove: new payoffs. Find the smallest chance of each go signal that keeps waiting worthwhile.
 */
export class CorrelatedEquilibriumGame extends Game {
  readonly slug = "correlated-equilibrium";
  private signals: Profile[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly theirs = new Damped(0, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private sel: 0 | 1 | null = null;
  private seen = new Set<number>();
  private readonly aObey = new Damped(0, 0.4);
  private readonly aIgnore = new Damped(0, 0.4);

  private cases: Light[] = [];
  private pi = 0;
  private pa = 0;
  private dragging = false;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;
  private readonly plot = new Plot({ xMin: 0, xMax: 0.5, yMin: -4, yMax: 5, padL: 30, padR: 24, padT: 28, padB: 54, maxH: 220 });
  private readonly reveal = new Damped(0, 0.5);

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
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.plot.fit(this.frame);
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
    else if (this.beat === "see") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setA(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging && this.beat === "prove") this.setA(x);
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
    const sig = this.signals[this.round]![0];
    this.prompt.set(`The light tells you to ${sig}. Obey or ignore?`);
    this.note.set(`Drive ${this.round + 1} of ${FEEL_ROUNDS}. The other driver gets a signal too.`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const [sig, rival] = this.signals[this.round]!;
    const move = i === 0 ? sig : flip(sig);
    const pay = FEEL.pay(move, rival);
    const alt = FEEL.pay(flip(move), rival);
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(pay);
    this.theirs.set(FEEL.pay(rival, move));
    this.alt.snap(0).set(alt);
    this.prompt.set(move === "go" && rival === "go" ? "Both went. Crash." : `You ${move === "go" ? "went" : "waited"}, they ${rival === "go" ? "went" : "waited"}. You get ${pay}.`);
    this.note.set(i === 0 ? `Ignoring would have paid ${alt}.` : `Obeying would have paid ${alt}.`);
    this.announce(`You get ${pay}. The other option paid ${alt}.`);
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
    this.aObey.snap(0);
    this.aIgnore.snap(0);
    this.prompt.set("Tap each signal. What do obeying and ignoring pay?");
    this.note.set("Each profile has a third of the chance.");
    this.sync();
  }

  private pick(i: 0 | 1): void {
    this.sel = i;
    this.seen.add(i);
    const l = FEEL;
    if (i === 0) {
      this.aObey.set(l.obeyWait(FEEL_A));
      this.aIgnore.set(l.goWait(FEEL_A));
      this.note.set(`Told wait, the other goes half the time. Waiting pays ${r1(l.obeyWait(FEEL_A))}, going ${r1(l.goWait(FEEL_A))}.`);
    } else {
      this.aObey.set(l.obeyGo());
      this.aIgnore.set(l.ignoreGo());
      this.note.set(`Told go, the other waits for sure. Going pays ${l.obeyGo()}, waiting ${l.ignoreGo()}.`);
    }
    if (this.seen.size >= 2) {
      this.prompt.set("Nobody gains by disobeying. The light coordinates.");
      this.announce("Each driver does best by obeying, so the signal holds.");
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
    const l = this.cases[this.pi]!;
    this.pa = 0;
    this.locked = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set(`Both wait ${l.r}. Go against wait ${l.t}. Wait against go ${l.s}.`);
    this.note.set("Drag the chance of each go signal to where obeying a wait just holds.");
    this.sync();
  }

  private setA(x: number): void {
    this.pa = clamp(Math.round(this.plot.valueAtX(x) * 100) / 100, 0, 0.5);
    if (this.wrong) {
      this.wrong = false;
      this.reveal.set(0);
    }
    this.note.set(`Each go signal: ${pct(this.pa)}.`);
  }

  private lockIn(): void {
    const l = this.cases[this.pi]!;
    const ok = isRight(l, this.pa);
    this.cue(ok ? "good" : "bad");
    this.reveal.set(1);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. From ${pct(l.minChance())} up.`);
      this.note.set("Below it, going beats waiting, so the signal falls apart.");
      this.wait = 2;
    } else {
      this.wrong = true;
      const a = this.pa;
      this.prompt.set(l.obedient(a) ? "Obeying holds, but lower still works." : "Going pays more there.");
      this.note.set(`At ${pct(a)}: waiting pays ${r1(l.obeyWait(a))}, going ${r1(l.goWait(a))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.theirs, this.alt, this.show, this.aObey, this.aIgnore, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A trusted signal can be followed by everyone.");
          this.note.set("It works only while obeying pays more than breaking it.");
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
    const open = this.stage === "choose";
    const sig = this.signals[Math.min(this.round, this.signals.length - 1)]![0];
    (["Obey", "Ignore"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 60) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 7) / 7);
    const sv = this.show.value;
    if (sig === "go") p.disc(this.cx, cy, 12, c.ink);
    else p.ring(this.cx, cy, 12, c.ink, 1.5);
    p.text(`light: ${sig}`, this.cx, cy + 12 + 16, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (!open && sv > 0.01) {
      p.disc(xl, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.ring(xr, cy, rad(this.theirs.value), c.ink, 1.5, sv);
      p.dashedRing(xl, cy, rad(this.alt.value), c.ink, 0.8 * sv);
      p.text(`you ${r1(this.mine.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      p.text(`they ${r1(this.theirs.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    (["Told wait", "Told go"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.sel === i, alpha: this.seen.size >= 2 ? 0 : this.sel === i ? 1 : 0.7 });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 60) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 7) / 7);
    if (this.sel === null) {
      p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    } else {
      p.disc(xl, cy, rad(this.aObey.value), c.ink, 0.95);
      p.ring(xr, cy, rad(this.aIgnore.value), c.ink, 1.5);
      p.text(`obey ${r1(this.aObey.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
      p.text(`ignore ${r1(this.aIgnore.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center" });
    }
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.seen.has(i), false);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const l = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const pl = this.plot;
    pl.axes(p, c, { xTicks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], xLabel: "chance of each go signal", yLabel: "waiting minus going", fmt: (v) => pct(v) });
    p.rule(pl.x0, pl.Y(0), pl.right, pl.Y(0), c.ink, 0.35);
    p.text("0", pl.x0 - 8, pl.Y(0), { font: Type.mono(10), color: c.ash, align: "right", base: "middle" });
    pl.curve(p, (a) => l.edge(a), c.ink, 1.75, 1, 50);
    const rv = this.reveal.value;
    if (rv > 0.01 && this.locked) p.ring(pl.X(l.minChance()), pl.Y(0), 10, c.ink, 1.5, rv);
    p.line(pl.X(this.pa), pl.Y(0), pl.X(this.pa), pl.Y(l.edge(this.pa)), c.ink, 1, 0.5, [3, 4]);
    p.disc(pl.X(this.pa), pl.Y(l.edge(this.pa)), 7, c.ink);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
