import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import { CanvasButton } from "../../core/CanvasButton";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { drawChoice } from "../shared/kit";
import { FEEL_ROUNDS, SEE_MARKET, feelMarkets, proveSet, type Entry, type Pay } from "./model";

interface Geo {
  a: [number, number];
  b: [number, number];
  out: [number, number];
  fight: [number, number];
  accept: [number, number];
  sp: number;
  lx: number;
}

/**
 * Feel: a rival says "I will fight if you enter". Enter or stay out, four times.
 * See: tap the last move first, then the first. Only believable moves survive.
 * Prove: new payoffs. Enter or stay out, one market with a real threat and one with an empty one.
 */
export class SubgamePerfectGame extends Game {
  readonly slug = "subgame-perfect";
  private markets: Entry[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed: 0 | 1 | null = null;
  private picked: 0 | 1 | null = null;
  private readonly mine = new Damped(0, 0.4);
  private readonly theirs = new Damped(0, 0.4);
  private readonly alt = new Damped(0, 0.4);
  private readonly show = new Damped(0, 0.5);

  private readonly resB = new Damped(0, 0.45);
  private readonly resA = new Damped(0, 0.45);
  private doneB = false;
  private doneA = false;

  private cases: Entry[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly reveal = new Damped(0, 0.5);

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.markets = feelMarkets(this.env.rng);
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
    this.tapB();
    this.tapA();
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 60 : 68;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.doneA;
  }

  private hit(i: 0 | 1, x: number, y: number): boolean {
    const b = this.pair(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  private geo(f: Frame): Geo {
    const sp = clamp((f.h - 8) / 3, 40, 74);
    const y0 = f.top + 4 + sp / 2;
    const lx = this.cx + clamp(f.w / 2 - 70, 40, 100);
    const bx = this.cx + 4;
    return {
      a: [clamp(this.cx - 100, f.x + 22, this.cx), y0 + sp],
      b: [bx, y0 + 1.5 * sp],
      out: [lx, y0],
      fight: [lx, y0 + sp],
      accept: [lx, y0 + 2 * sp],
      sp,
      lx,
    };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "choose") this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
    else if (this.beat === "prove" && !this.locked) this.armed = this.hit(0, x, y) ? 0 : this.hit(1, x, y) ? 1 : null;
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = null;
    if (this.beat === "see") {
      const g = this.geo(this.frame);
      const near = (n: [number, number]) => Math.hypot(x - n[0], y - n[1]) < 28;
      if (near(g.b)) this.tapB();
      else if (near(g.a)) this.tapA();
      return;
    }
    if (a === null || !this.hit(a, x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.choose(a);
    else if (this.beat === "prove" && !this.locked) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = null;
    this.show.snap(0);
    this.prompt.set("A rival says: if you enter, I will fight.");
    this.note.set(`Market ${this.round + 1} of ${FEEL_ROUNDS}. Enter or stay out?`);
    this.sync();
  }

  private choose(i: 0 | 1): void {
    const m = this.markets[this.round]!;
    const enter = i === 0;
    const pay: Pay = enter ? m.enterPay() : m.out;
    const alt: Pay = enter ? m.out : m.enterPay();
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    this.mine.set(pay[0]);
    this.theirs.set(pay[1]);
    this.alt.snap(0).set(alt[0]);
    this.prompt.set(!enter ? "You stayed out." : m.credible() ? "You entered. They fought." : "You entered. They accepted.");
    this.note.set(`You get ${pay[0]}. The other choice would have paid ${alt[0]}.`);
    this.announce(`You get ${pay[0]}. The other choice paid ${alt[0]}.`);
    this.cue(pay[0] >= alt[0] ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.doneA = false;
    this.doneB = false;
    this.resA.snap(0);
    this.resB.snap(0);
    this.prompt.set("Tap the last move first. What will they do?");
    this.note.set("Start at the lower circle.");
    this.sync();
  }

  private tapB(): void {
    if (this.doneB) return;
    const m = SEE_MARKET;
    this.doneB = true;
    this.resB.set(1);
    this.cue("good");
    this.prompt.set("They accept. Fighting costs them.");
    this.note.set(`Once you are in, accepting pays ${m.accept[1]} and fighting ${m.fight[1]}. Now tap yours.`);
    this.announce("Once you are in, they accept. The threat was empty.");
  }

  private tapA(): void {
    if (this.doneA) return;
    if (!this.doneB) {
      this.cue("bad");
      this.note.set("Not yet. Settle the last move first.");
      return;
    }
    const m = SEE_MARKET;
    this.doneA = true;
    this.resA.set(1);
    this.cue("good");
    this.prompt.set("So you enter. The threat was empty.");
    this.note.set(`Entering pays ${m.accept[0]}, staying out ${m.out[0]}. Plans must hold at every step.`);
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
    this.locked = false;
    this.picked = null;
    this.reveal.snap(0);
    this.prompt.set("They say they will fight. Enter or stay out?");
    this.note.set("Work back from the last move.");
    this.sync();
  }

  private answer(i: 0 | 1): void {
    const m = this.cases[this.pi]!;
    const enter = i === 0;
    this.picked = i;
    this.reveal.set(1);
    const ok = enter === m.enters();
    this.cue(ok ? "good" : "bad");
    const r = m.reply();
    const why = r === "fight" ? `They really fight: ${m.fight[1]} beats ${m.accept[1]}. Entering pays ${m.fight[0]}, staying out ${m.out[0]}.` : `They accept: ${m.accept[1]} beats ${m.fight[1]}. Entering pays ${m.accept[0]}, staying out ${m.out[0]}.`;
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(enter ? "Right. The threat is empty." : "Right. The threat is real.");
      this.note.set(why);
      this.wait = 2.2;
    } else {
      this.prompt.set(enter ? "They would fight, and that hurts you." : "They would not fight. You gave up a gain.");
      this.note.set(why);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.mine, this.theirs, this.alt, this.show, this.resA, this.resB, this.reveal]) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Only a threat worth carrying out is believed.");
          this.note.set("Check each step, from the end back to the start.");
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
    else if (this.beat === "see") this.drawTree(p, c, f, SEE_MARKET, this.resB.value, this.resA.value, false);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const open = this.stage === "choose";
    (["Enter", "Stay out"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open ? 1 : 0 });
    });
    const R = clamp(Math.min((f.w - 24) / 6.6, (f.h - 60) / 2.6), 14, 46);
    const cy = f.top + R + 8;
    const xl = this.cx - 2 * R;
    const xr = this.cx + 2 * R;
    const rad = (v: number) => R * Math.sqrt(clamp(v, 0, 10) / 10);
    const sv = this.show.value;
    if (open) {
      p.dashedRing(this.cx, cy, R * 0.7, c.ink, 0.4);
    } else if (sv > 0.01) {
      p.disc(xl, cy, rad(this.mine.value), c.ink, 0.95 * sv);
      p.ring(xr, cy, rad(this.theirs.value), c.ink, 1.5, sv);
      p.dashedRing(xl, cy, rad(this.alt.value), c.ink, 0.8 * sv);
      p.text(`you ${Math.round(this.mine.value)}`, xl, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
      p.text(`they ${Math.round(this.theirs.value)}`, xr, cy + R + 16, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sv });
    }
    for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const m = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const open = !this.locked;
    (["Enter", "Stay out"] as const).forEach((n, i) => {
      drawChoice(p, c, this.pair(i as 0 | 1), { label: n, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i && this.locked, alpha: open ? 1 : 0.3 });
    });
    this.drawTree(p, c, f, m, this.reveal.value, 0, true);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }

  /** The entry tree: you (disc) choose out or in; they (ring) then choose fight or accept. */
  private drawTree(p: Painter, c: Colors, f: Frame, m: Entry, rb: number, ra: number, numbers: boolean): void {
    const g = this.geo(f);
    const R = clamp((g.sp - 30) / 2, 7, 13);
    const sc = (v: number) => R * Math.sqrt(clamp(v, 0, 10) / 10);
    const fightWins = m.reply() === "fight";
    const enters = m.enters();
    const edge = (a: [number, number], b: [number, number], keep: boolean, k: number) => {
      p.line(a[0], a[1], b[0], b[1], c.ink, 1, keep ? 0.9 : 0.9 - 0.65 * k, keep ? undefined : k > 0.5 ? [3, 4] : undefined);
    };
    const ex = g.lx - 18 - R - 6;
    edge(g.a, [ex, g.out[1]], !enters, ra);
    edge(g.a, g.b, true, 0);
    edge(g.b, [ex, g.fight[1]], fightWins, rb);
    edge(g.b, [ex, g.accept[1]], !fightWins, rb);
    const leaf = (n: [number, number], v: Pay, label: string, k: number, keep: boolean) => {
      const al = keep ? 1 : 1 - 0.6 * k;
      p.disc(n[0] - 18, n[1], sc(v[0]), c.ink, 0.95 * al);
      p.ring(n[0] + 18, n[1], sc(v[1]), c.ink, 1.5, al);
      const t = numbers ? `${v[0]}, ${v[1]}` : label;
      p.text(t, n[0], n[1] + R + 14, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: al });
    };
    leaf(g.out, m.out, "stay out", ra, !enters);
    leaf(g.fight, m.fight, "fight", rb, fightWins);
    leaf(g.accept, m.accept, "accept", rb, !fightWins);
    p.disc(g.a[0], g.a[1], 10, c.ink);
    p.ring(g.b[0], g.b[1], 10, c.ink, 1.5);
    if (this.beat === "see") {
      if (!this.doneB) p.ring(g.b[0], g.b[1], 18, c.ink, 0.8, 0.5);
      else if (!this.doneA) p.ring(g.a[0], g.a[1], 18, c.ink, 0.8, 0.5);
    }
  }
}
