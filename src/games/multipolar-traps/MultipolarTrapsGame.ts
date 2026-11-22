import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { Slider, drawChoice, drawTicks, fmt } from "../shared/kit";
import { Contest, FEEL_CONTEST, MAX_COST, PROVE_CONTESTS, PROVE_TOLERANCE, ROUNDS } from "./model";

type Act = "hold" | "raise";

/**
 * Feel: five rivals share a pie by level. Raise your level for a cost, or hold. Rivals copy anyone who raised.
 * See: your net each round against the fair share, and the cost everyone paid for nothing.
 * Prove: two new contests. Drag the cost until raising alone stops paying.
 */
export class MultipolarTrapsGame extends Game {
  readonly slug = "multipolar-traps";
  private readonly k = FEEL_CONTEST;
  private levels: number[] = [];
  private nets: number[] = [];
  private raisedBy: number[] = [];
  private waste = 0;
  private round = 0;
  private lastRaised = false;
  private waiting = false;
  private since = 0;
  private armed: Act | null = null;
  private readonly shares: Damped[] = [0, 1, 2, 3, 4].map(() => new Damped(2, 0.4));

  private shown = 0;
  private readonly cols: Damped[] = [0, 1, 2, 3, 4, 5].map(() => new Damped(0, 0.5));

  private contests: Contest[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly slider = new Slider();
  private readonly settle = new Damped(0, 0.4);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.levels = [0, 0, 0, 0, 0];
    this.nets = [];
    this.raisedBy = [];
    this.waste = 0;
    this.round = 0;
    this.lastRaised = false;
    this.waiting = false;
    this.shares.forEach((d) => d.snap(this.k.fair));
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Five rivals share a pie by level. Raise yours, or hold?");
    this.note.set("Raising costs 1 and the level stays. Everyone at 0 gets 2 each.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.nets = [2, 2.33, 1.4, 1, 1];
    this.raisedBy = [0, 1, 1, 1, 1];
    this.waste = 14;
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 7; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 80 : 96) : 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= ROUNDS && !this.waiting;
    this.toProve.visible = this.beat === "see" && this.shown >= 7;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "feel" && !this.waiting && this.round < ROUNDS) {
      if (inside(this.pair(0), x, y)) this.armed = "hold";
      else if (inside(this.pair(1), x, y)) this.armed = "raise";
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked && y >= f.top && y <= f.bottom) {
      this.slider.dragging = true;
      this.slider.setFromX(x, 0.05 / MAX_COST);
      this.note.set("");
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.slider.dragging) this.slider.setFromX(x, 0.05 / MAX_COST);
  }

  protected override onUp(x: number, y: number): void {
    this.slider.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.beat === "feel" && !this.waiting && inside(this.pair(a === "hold" ? 0 : 1), x, y)) this.play(a);
  }

  // ---- Feel -------------------------------------------------------------

  private play(a: Act): void {
    const rng = this.env.rng;
    const raised = a === "raise";
    const next = [...this.levels];
    let costs = 0;
    if (raised) {
      next[0]!++;
      costs++;
    }
    let rivalRaised = false;
    for (let i = 1; i < 5; i++) {
      // Rivals copy anyone who raised last round. In the first round each raises on a coin flip weighted to 30%.
      const copy = this.round === 0 ? rng.chance(0.3) : this.lastRaised;
      if (copy) {
        next[i]!++;
        costs++;
        rivalRaised = true;
      }
    }
    this.lastRaised = raised || rivalRaised;
    this.levels = next;
    this.waste += costs * this.k.cost;
    const net = this.k.net(this.levels, 0, raised);
    this.nets.push(net);
    this.raisedBy.push(raised ? 1 : 0);
    this.shares.forEach((d, i) => d.set(this.k.share(this.levels, i)));
    this.waiting = true;
    this.since = 0;
    this.cue(net >= this.k.fair ? "good" : "bad");
    this.prompt.set(raised ? "You raised." : "You held.");
    this.note.set(`Your share ${fmt(Math.round(this.k.share(this.levels, 0) * 100) / 100)}${raised ? `, cost ${this.k.cost}` : ""}. Fair is ${fmt(this.k.fair)}.`);
    this.announce(`Round ${this.round + 1}. You ${a === "raise" ? "raised" : "held"}. Net ${fmt(Math.round(net * 100) / 100)}. Fair is ${fmt(this.k.fair)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.prompt.set("Your net each round, against the fair 2.");
    this.note.set("Tap to lay out the rounds.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 7) return;
    if (this.shown < 5) {
      this.cols[this.shown]!.set(1);
      this.shown++;
      this.note.set(`${this.shown} of 5 rounds. Dashed ring: the fair share.`);
      if (this.shown === 5) this.prompt.set("Tap once more for the waste.");
    } else if (this.shown === 5) {
      this.cols[5]!.set(1);
      this.shown = 6;
      this.prompt.set(`Everyone paid, and the shares came back to where they were.`);
      this.note.set(`${fmt(this.waste)} coins spent across the table for nothing. Tap again.`);
    } else {
      this.shown = 7;
      const lone = this.k.alone;
      this.prompt.set("Raising alone pays. Everyone raising only costs.");
      this.note.set(`Alone you net ${fmt(Math.round(lone * 100) / 100)} against ${fmt(this.k.fair)}. All raising nets ${fmt(this.k.fair - this.k.cost)}.`);
      this.announce("Raising alone pays, but when everyone raises the shares return and the cost is waste.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.contests = this.env.rng.shuffle(PROVE_CONTESTS);
    this.pi = 0;
    this.solved = 0;
    this.loadContest();
    this.sync();
  }

  private cost(): number {
    return this.slider.value * MAX_COST;
  }

  private loadContest(): void {
    const k = this.contests[this.pi]!;
    this.locked = false;
    this.slider.value = 0.1 / MAX_COST;
    this.settle.snap(0);
    this.prompt.set(`${k.n} rivals share ${k.pie}. Find the cost that stops raising paying.`);
    this.note.set("Drag the cost until the disc falls to the ring.");
    this.sync();
  }

  private lockIn(): void {
    const k = this.contests[this.pi]!;
    const c = this.cost();
    if (Math.abs(c - k.breakEven) <= PROVE_TOLERANCE) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.settle.set(1);
      this.prompt.set(`Right. Above ${fmt(Math.round(k.breakEven * 100) / 100)} nobody gains by raising.`);
      this.note.set("Below it the trap holds. That is the price a rule or a fine must set.");
      this.wait = 2.4;
    } else {
      this.cue("bad");
      const alone = new Contest(k.n, k.pie, c).alone;
      this.prompt.set(c < k.breakEven ? "Too cheap. Raising still pays." : "Too dear. Nobody would raise.");
      this.note.set(`At cost ${fmt(Math.round(c * 100) / 100)} raising alone nets ${fmt(Math.round(alone * 100) / 100)} against ${fmt(Math.round(k.fair * 100) / 100)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of this.shares) d.step(dt);
    for (const d of this.cols) d.step(dt);
    this.settle.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 1.5) {
        this.waiting = false;
        this.round++;
        if (this.round < ROUNDS) {
          this.prompt.set("Rivals copy anyone who raised. Raise, or hold?");
          this.note.set("");
        } else {
          this.prompt.set("Five rounds. Where did the shares end up?");
          this.note.set(`${fmt(this.waste)} coins were spent on levels.`);
        }
        this.sync();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.contests.length) {
          this.prompt.set("Each local choice pushes everyone somewhere nobody wants.");
          this.note.set("The way out is a rule that changes the price of raising for everyone at once.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadContest();
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
    const slot = f.w / 5;
    const R = clamp(Math.min(slot * 0.4, (f.h - 70) / 2), 12, 40);
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 6);
    const cy = f.top + f.h / 2 - 14;
    for (let i = 0; i < 5; i++) {
      const x = f.x + (i + 0.5) * slot;
      p.dashedRing(x, cy, r(this.k.fair), c.ink, 0.5);
      if (i === 0) p.disc(x, cy, r(this.shares[i]!.value), c.ink, 0.92);
      else p.ring(x, cy, r(this.shares[i]!.value), c.ink, 1.5);
      p.text(i === 0 ? `You L${this.levels[0]}` : `L${this.levels[i]}`, x, cy + R + 18, { font: Type.mono(11), color: c.fog, align: "center" });
    }
    if (this.round < ROUNDS) {
      for (const i of [0, 1] as const) {
        const a: Act = i === 0 ? "hold" : "raise";
        const al = this.waiting ? 0.4 : 1;
        drawChoice(p, c, this.pair(i), { label: a === "hold" ? "Hold" : "Raise", sub: a === "hold" ? "free" : `costs ${this.k.cost}`, r: a === "hold" ? 8 : 14, alpha: al, armed: this.armed === a });
      }
    }
    drawTicks(p, c, f, this.cx, ROUNDS, this.round, Math.min(this.round, ROUNDS - 1));
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const slot = f.w / 6;
    const R = clamp(Math.min(slot * 0.4, (f.h - 60) / 2), 12, 40);
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 4);
    const cy = f.top + 14 + R;
    for (let i = 0; i < 6; i++) {
      const x = f.x + (i + 0.5) * slot;
      const a = this.cols[i]!.value;
      p.text(i < 5 ? `r${i + 1}` : "waste", x, f.top + 6, { font: Type.mono(10), color: c.fog, align: "center" });
      if (a < 0.01) {
        p.ring(x, cy, 4, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4 + i));
        continue;
      }
      if (i < 5) {
        p.dashedRing(x, cy, r(this.k.fair), c.ink, 0.6 * a);
        p.disc(x, cy, r(this.nets[i] ?? 0) * a, c.ink, 0.92 * a);
        p.text(fmt(Math.round((this.nets[i] ?? 0) * 10) / 10), x, cy + R + 16, { font: Type.mono(11), color: c.ink, align: "center", alpha: a });
      } else {
        p.disc(x, cy, R * Math.sqrt(Math.min(1, this.waste / 20)) * a, c.ink, 0.5 * a);
        p.text(fmt(Math.round(this.waste * 10) / 10), x, cy + R + 16, { font: Type.mono(11), color: c.ink, align: "center", alpha: a });
      }
    }
    drawTicks(p, c, f, this.cx, 7, this.shown, Math.min(this.shown, 6));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const k = this.contests[Math.min(this.pi, this.contests.length - 1)]!;
    const cost = this.cost();
    const alone = new Contest(k.n, k.pie, cost).alone;
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const top = Math.max(k.fair, new Contest(k.n, k.pie, 0).alone);
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / top);
    if (alone > 0.02) p.disc(xl, cy, r(alone), c.ink, 0.92);
    p.ring(xr, cy, r(k.fair), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text(`Raise alone ${fmt(Math.round(alone * 100) / 100)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`Hold ${fmt(Math.round(k.fair * 100) / 100)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    const ty = Math.min(f.bottom - 28, ly + 56);
    this.slider.place(f.x + 24, f.x + f.w - 24, ty);
    this.slider.draw(p, c);
    for (const v of [0, 1, 2, 3]) p.text(String(v), this.slider.at(v / MAX_COST), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    p.text(`Cost ${fmt(Math.round(cost * 100) / 100)}`, this.cx, ty - 22, { font: Type.mono(12), color: c.ink, align: "center" });
    const s = this.settle.value;
    if (s > 0.01) p.line(this.slider.at(k.breakEven / MAX_COST), ty - 12, this.slider.at(k.breakEven / MAX_COST), ty + 10, c.ink, 1, s);
    drawTicks(p, c, f, this.cx, this.contests.length, this.solved, this.pi);
  }
}
