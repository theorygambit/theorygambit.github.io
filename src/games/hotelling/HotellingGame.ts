import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { FEEL_START, GRID, SEE_START, Street, StreetCase, proveSet } from "./model";

const ROUNDS = 4;
const UNIFORM = Street.uniform();
const fmt = (v: number): string => String(Math.round(v * 10) / 10);

interface Geo {
  x0: number;
  x1: number;
  sy: number;
  R: number;
  X: (v: number) => number;
  V: (px: number) => number;
}

/**
 * Feel: four rounds. Place a shop on a street, customers walk to the nearer one, then the rival steps in beside you.
 * See: tap Move and watch the shops leapfrog, each beside the other, until both stand in the middle.
 * Prove: a crowd packed to one side. Drag to where both shops will settle.
 */
export class HotellingGame extends Game {
  readonly slug = "hotelling";
  private street: Street = UNIFORM;
  private you = 0.85;
  private they = FEEL_START;
  private round = 0;
  private stage: "set" | "one" | "two" = "set";
  private since = 0;
  private dragging = false;
  private bestX = 0.25;
  private bestHeld = 0;
  private readonly yv = new Damped(0.85, 0.15);
  private readonly tv = new Damped(FEEL_START, 0.3);
  private readonly owner: Damped[] = Array.from({ length: 20 }, () => new Damped(0.5, 0.35));
  private readonly show = new Damped(0, 0.4);
  private readonly cf = new Damped(0, 0.4);
  private readonly youN = new Damped(0, 0.5);
  private readonly theyN = new Damped(0, 0.5);
  private readonly intro = new Damped(0, 0.7);

  private taps = 0;
  private done = false;
  private readonly mid = new Damped(0, 0.6);

  private cases: StreetCase[] = [];
  private pi = 0;
  private px = 0.1;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly main = this.add(new CanvasButton("Place", () => this.press(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly move = this.add(new CanvasButton("Move", () => this.hop(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.street = UNIFORM;
    this.you = 0.85;
    this.they = FEEL_START;
    this.yv.snap(0.85);
    this.tv.snap(FEEL_START);
    this.round = 0;
    this.stage = "set";
    this.solved = 0;
    this.main.label = "Place";
    this.show.snap(0);
    this.cf.snap(0);
    this.youN.snap(0);
    this.theyN.snap(0);
    this.owner.forEach((o) => o.snap(0.5));
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.setBest();
    this.prompt.set("Place your shop. Customers walk to the nearer one.");
    this.note.set("Drag along the street, then tap Place.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.enterSee();
    if (beat === "see") return;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.main, this.toSee, this.move, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.main.visible = feel && !(this.round >= ROUNDS - 1 && this.stage === "two") && this.stage !== "one";
    this.toSee.visible = feel && this.round >= ROUNDS - 1 && this.stage === "two";
    this.move.visible = this.beat === "see" && !this.done;
    this.toProve.visible = this.beat === "see" && this.done;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private geo(f: Frame): Geo {
    const x0 = f.x + 14;
    const x1 = f.x + f.w - 14;
    const sy = f.top + clamp(f.h * 0.34, 76, 130);
    const R = clamp(f.h * 0.13, 14, 30);
    return { x0, x1, sy, R, X: (v) => x0 + v * (x1 - x0), V: (px) => clamp((px - x0) / (x1 - x0), 0, 1) };
  }

  private setBest(): void {
    this.bestX = this.street.bestReply(this.they);
    this.bestHeld = this.street.held(this.bestX, this.they);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (y < f.top - 6 || y > f.bottom + 6) return;
    if ((this.beat === "feel" && this.stage === "set") || (this.beat === "prove" && !this.locked)) {
      this.dragging = true;
      this.setX(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.setX(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private setX(px: number): void {
    const v = this.geo(this.frame).V(px);
    if (this.beat === "feel") {
      this.you = Math.round(v / GRID) * GRID;
      this.yv.set(this.you);
    } else this.px = Math.round(v * 100) / 100;
  }

  // ---- Feel -------------------------------------------------------------

  private recolor(a: number, b: number): void {
    this.street.pts.forEach((p, i) => {
      const da = Math.abs(p - a);
      const db = Math.abs(p - b);
      this.owner[i]?.set(da < db - 1e-9 ? 1 : Math.abs(da - db) <= 1e-9 ? 0.5 : 0);
    });
    const h = this.street.held(a, b);
    this.youN.set(h);
    this.theyN.set(this.street.n - h);
  }

  private press(): void {
    if (this.stage === "set") {
      const h = this.street.held(this.you, this.they);
      this.recolor(this.you, this.they);
      this.show.set(1);
      this.cf.set(this.bestX === this.you ? 0 : 1);
      this.stage = "one";
      this.since = 0;
      this.prompt.set(`You hold ${fmt(h)} of ${this.street.n}.`);
      this.note.set(h >= this.bestHeld ? "That was the best spot against them." : `The best spot, ringed, would hold ${fmt(this.bestHeld)}.`);
      this.announce(`Shop at ${Math.round(this.you * 100)} percent. You hold ${fmt(h)} of ${this.street.n} customers.`);
      this.cue(h >= this.bestHeld ? "good" : "bad");
    } else if (this.stage === "two") {
      this.round++;
      this.stage = "set";
      this.show.set(0);
      this.cf.set(0);
      this.owner.forEach((o) => o.set(0.5));
      this.setBest();
      this.main.label = "Place";
      this.prompt.set("Your move again. Where now?");
      this.note.set("Drag along the street, then tap Place.");
    }
    this.sync();
  }

  private rivalMoves(): void {
    this.they = this.street.move(this.they, this.you);
    this.tv.set(this.they);
    this.recolor(this.you, this.they);
    this.cf.set(0);
    this.stage = "two";
    const h = this.street.held(this.you, this.they);
    this.setBest();
    if (this.round >= ROUNDS - 1) {
      this.prompt.set("Each move ended nearer the middle.");
      this.note.set(`They stepped in beside you. You hold ${fmt(h)} now.`);
    } else {
      this.prompt.set("They stepped in beside you.");
      this.note.set(`You hold ${fmt(h)} now. They hold ${fmt(this.street.n - h)}.`);
      this.main.label = "Next";
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.street = UNIFORM;
    this.you = SEE_START.you;
    this.they = SEE_START.they;
    this.yv.snap(this.you);
    this.tv.snap(this.they);
    this.taps = 0;
    this.done = false;
    this.mid.snap(0);
    this.show.snap(1);
    this.cf.snap(0);
    this.recolor(this.you, this.they);
    this.prompt.set("Each steps beside the other, toward the crowd.");
    this.note.set("Tap Move. Watch where they end.");
    this.sync();
  }

  private hop(): void {
    if (this.done) return;
    if (this.taps % 2 === 0) {
      this.they = this.street.move(this.they, this.you);
      this.tv.set(this.they);
    } else {
      this.you = this.street.move(this.you, this.they);
      this.yv.set(this.you);
    }
    this.taps++;
    this.recolor(this.you, this.they);
    if (this.street.settled(this.you, this.they)) {
      this.done = true;
      this.mid.set(1);
      this.prompt.set("Both end in the middle.");
      this.note.set("Nobody can win more customers by moving, so they stay.");
      this.announce("Both shops end at the middle of the street.");
    } else this.note.set(`Move ${this.taps}. They hold ${fmt(this.street.held(this.they, this.you))} of ${this.street.n}.`);
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
    const c = this.cases[this.pi]!;
    this.street = c.street;
    this.px = 0.1;
    this.locked = false;
    this.trueAt.snap(0);
    this.show.snap(0);
    this.prompt.set(this.pi === 0 ? "A crowd packed to one side. Where do both shops settle?" : "A new street. Where do both settle?");
    this.note.set("Drag one shop. The rival will end beside it.");
    this.sync();
  }

  private lockIn(): void {
    const c = this.cases[this.pi]!;
    const ok = c.accepts(this.px);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set("Right. They settle at the middle customer.");
      this.note.set(`${this.street.below(c.median)} customers on one side, ${this.street.above(c.median)} on the other.`);
      this.wait = 1.8;
    } else {
      const l = this.street.below(this.px);
      const r = this.street.above(this.px);
      this.prompt.set(this.px < c.median ? "Too far left. More customers sit to the right." : "Too far right. More customers sit to the left.");
      this.note.set(`Your shop has ${l} customers on its left, ${r} on its right. Go where they balance.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const d of [this.yv, this.tv, this.show, this.cf, this.youN, this.theyN, this.mid, this.trueAt, this.intro, ...this.owner]) d.step(dt);
    if (this.beat === "feel" && this.stage === "one") {
      this.since += dt;
      if (this.since > 1.4) this.rivalMoves();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Rivals pile up at the middle customer, not the middle of the map.");
          this.note.set("Move the crowd and the settling point moves with it.");
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
    const g = this.geo(f);
    const a = this.intro.value;
    const prove = this.beat === "prove";
    p.rule(g.x0, g.sy, g.x1, g.sy, c.ink, 0.5);
    p.rule(g.x0, g.sy - 4, g.x0, g.sy + 4, c.ink, 0.5);
    p.rule(g.x1, g.sy - 4, g.x1, g.sy + 4, c.ink, 0.5);

    const rows = new Map<number, number>();
    const sh = this.show.value;
    this.street.pts.forEach((pt, i) => {
      const key = Math.round(g.X(pt) / 9);
      const k = rows.get(key) ?? 0;
      rows.set(key, k + 1);
      const x = g.X(pt);
      const y = g.sy + 12 + k * 9;
      const v = this.owner[i]!.value;
      p.ring(x, y, 3.5, c.ink, 1.25, (0.45 + 0.55 * sh * (1 - v)) * a);
      p.disc(x, y, 3.5, c.ink, sh * v * a);
    });

    const shopY = g.sy - 26;
    if (!prove) {
      const bx = g.X(this.bestX);
      p.dashedRing(bx, shopY, 13, c.ink, this.cf.value);
      p.disc(g.X(this.yv.value), shopY, 9, c.ink, a);
      p.ring(g.X(this.tv.value), shopY, 10, c.ink, 1.5, a);
      p.text("you", g.X(this.yv.value), shopY - 20, { font: Type.body(12, 400), color: c.ink, align: "center", base: "middle", alpha: a });
      p.text("they", g.X(this.tv.value), shopY - 38, { font: Type.body(12, 400), color: c.fog, align: "center", base: "middle", alpha: a });
      if (this.beat === "feel") {
        const ry = f.bottom - g.R - 24;
        const max = this.street.n;
        const xl = g.x0 + (g.x1 - g.x0) * 0.27;
        const xr = g.x0 + (g.x1 - g.x0) * 0.73;
        p.disc(xl, ry, g.R * Math.sqrt(this.youN.value / max), c.ink, 0.95 * sh);
        p.ring(xr, ry, g.R * Math.sqrt(this.theyN.value / max), c.ink, 1.5, sh);
        p.text(`you ${fmt(this.youN.value)}`, xl, ry + g.R + 14, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: sh });
        p.text(`they ${fmt(this.theyN.value)}`, xr, ry + g.R + 14, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: sh });
      } else {
        const m = this.mid.value;
        if (m > 0.01) p.ring(g.X(this.street.median()), g.sy, 6, c.ink, 1.5, m);
      }
    } else {
      const c0 = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
      const tv = this.trueAt.value;
      if (tv > 0.01) {
        p.line(g.X(c0.median), g.sy - 44, g.X(c0.median), g.sy + 4, c.ink, 1, 0.7 * tv, [3, 4]);
        p.ring(g.X(c0.median), shopY, 16, c.ink, 1.5, tv);
      }
      p.disc(g.X(this.px), shopY, 9, c.ink);
    }
    const n = prove ? this.cases.length : this.beat === "feel" ? ROUNDS : 0;
    const cur = prove ? this.pi : this.round;
    const done = prove ? this.solved : this.round + (this.stage === "two" ? 1 : 0);
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - ((n - 1) * 10) + i * 20, f.tickY, i < done, i === cur);
  }
}
