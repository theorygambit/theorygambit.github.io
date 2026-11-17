import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Crowd, FEEL_CROWD, PIE, PROVE_CROWDS, PROVE_SHARE, TEXTBOOK_OFFER } from "./model";

const fmt1 = (v: number): string => (Math.round(v * 10) / 10).toFixed(1);
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: five responders, each with a private minimum. Split 10 coins and see who accepts.
 * See: the crowd's acceptance curve and your expected earnings. Drag to find the peak.
 * Prove: two new crowds. Pick the offer that earns the most on average.
 */
export class UltimatumGame extends Game {
  readonly slug = "ultimatum";
  private mins: number[] = [];
  private offer = 5;
  private round = 0;
  private stage: "set" | "wait" | "result" = "set";
  private accepted = false;
  private since = 0;
  private history: { x: number; ok: boolean }[] = [];
  private dragging = false;
  private readonly dissolve = new Damped(0, 0.35);
  private readonly ringIn = new Damped(0, 0.3);
  private readonly slash = new Damped(0, 0.3);
  private readonly intro = new Damped(0, 0.7);
  private readonly handle = new Damped(5, 0.12);

  private probe = 8;
  private found = false;
  private touched = false;
  private readonly peak = new Damped(0, 0.5);
  private readonly best = FEEL_CROWD.best();

  private pi = 0;
  private po = 5;
  private locked = false;
  private wait = 0;
  private solved = 0;
  private readonly reveal = new Damped(0, 0.6);

  private readonly main = this.add(new CanvasButton("Offer", () => this.press(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.mins = this.env.rng.shuffle(FEEL_CROWD.thresholds(5));
    this.offer = 5;
    this.handle.snap(5);
    this.round = 0;
    this.stage = "set";
    this.history = [];
    this.dissolve.snap(0);
    this.ringIn.snap(0);
    this.slash.snap(0);
    this.found = false;
    this.touched = false;
    this.probe = 8;
    this.peak.snap(0);
    this.solved = 0;
    this.main.label = "Offer";
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Split 10 coins. They can accept, or refuse and you both get nothing.");
    this.note.set("Drag the divider, then tap Offer.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (const [x, ok] of [[2, false], [3, true], [4, true], [5, true], [1, false]] as const) this.history.push({ x, ok });
    this.round = 5;
    this.enterSee();
    if (beat === "see") {
      this.probe = this.best.x;
      this.found = true;
      this.peak.snap(1);
      this.foundIt();
      return;
    }
    this.enterProve();
  }

  protected layout(): void {
    const by = this.h - 80;
    this.main.place(this.cx - 80, by, 160);
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.main.visible = feel && !(this.round >= 5 && this.stage === "result") && this.stage !== "wait";
    this.toSee.visible = feel && this.round >= 5 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.found;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private get bar(): { x0: number; w: number; cell: number; y: number; h: number } {
    const x0 = this.colX + 8;
    const w = this.colW - 16;
    return { x0, w, cell: w / PIE, y: Math.min(250, (this.h - 200) / 2 + 40), h: 44 };
  }

  private chart(): { x0: number; w: number; top: number; h: number; X: (x: number) => number; base: number } {
    const x0 = this.colX + 14;
    const w = this.colW - 28;
    const top = 200;
    const h = clamp(this.h - 200 - 262, 90, 200);
    return { x0, w, top, h, X: (x) => x0 + (x / PIE) * w, base: top + h };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && this.stage === "set") {
      const b = this.bar;
      if (y > b.y - 40 && y < b.y + 110) {
        this.dragging = true;
        this.setOffer(x);
      }
    } else if (this.beat === "see") {
      this.dragging = true;
      this.setProbe(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setPick(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setOffer(x);
    else if (this.beat === "see") this.setProbe(x);
    else if (this.beat === "prove") this.setPick(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private setOffer(x: number): void {
    const b = this.bar;
    const v = Math.round(PIE - (x - b.x0) / b.cell);
    const n = clamp(v, 0, PIE);
    if (n !== this.offer) this.offer = n;
  }

  // ---- Feel -------------------------------------------------------------

  private press(): void {
    if (this.stage === "set") {
      this.stage = "wait";
      this.since = 0;
      this.note.set("");
      this.prompt.set("They are deciding.");
      this.sync();
    } else if (this.stage === "result") {
      this.round++;
      this.stage = "set";
      this.dissolve.set(0);
      this.ringIn.set(0);
      this.slash.set(0);
      this.main.label = "Offer";
      this.prompt.set("A new person. Split 10 coins.");
      this.note.set("Drag the divider, then tap Offer.");
      this.sync();
    }
  }

  private decide(): void {
    const th = this.mins[this.round]!;
    this.accepted = this.offer >= th;
    this.history.push({ x: this.offer, ok: this.accepted });
    this.stage = "result";
    if (this.accepted) {
      this.ringIn.set(1);
      this.prompt.set("Accepted.");
      this.note.set(`You keep ${PIE - this.offer}. They get ${this.offer}.`);
    } else {
      this.dissolve.set(1);
      this.slash.set(1);
      this.prompt.set("Refused.");
      this.note.set("You both get nothing. They would rather lose than take that.");
    }
    this.announce(`Offered ${this.offer} of ${PIE}. ${this.accepted ? "Accepted" : "Refused"}.`);
    const last = this.round >= 4;
    if (last) {
      this.round = 5;
      this.prompt.set("Five people. Look at who said no.");
    } else this.main.label = "Next";
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.found = false;
    this.touched = false;
    this.probe = 8;
    this.peak.snap(0);
    this.prompt.set("Drag along the curve. Where do you earn the most?");
    this.note.set("");
    this.sync();
  }

  private setProbe(x: number): void {
    const { x0, w } = this.chart();
    this.probe = clamp(Math.round(((x - x0) / w) * PIE * 10) / 10, 0, PIE);
    this.touched = true;
    if (!this.found && Math.abs(this.probe - this.best.x) <= 0.6) this.foundIt();
    this.refreshReadout();
  }

  private foundIt(): void {
    this.found = true;
    this.peak.set(1);
    this.prompt.set(`Best is near ${fmt1(this.best.x)}. The textbook offer of ${TEXTBOOK_OFFER} is rarely taken.`);
    this.announce(`The best offer is near ${fmt1(this.best.x)} coins.`);
    this.sync();
  }

  private refreshReadout(): void {
    const c = FEEL_CROWD;
    this.note.set(`offer ${fmt1(this.probe)}, accepted ${pct(c.accept(this.probe))}, you earn ${fmt1(c.expected(this.probe))}`);
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const crowd = PROVE_CROWDS[this.pi]!;
    this.po = 5;
    this.locked = false;
    this.reveal.snap(0);
    this.prompt.set(`This is ${crowd.name}. Pick the offer that earns you the most.`);
    this.refreshPick();
    this.sync();
  }

  private setPick(x: number): void {
    const { x0, w } = this.chart();
    this.po = clamp(Math.round(((x - x0) / w) * PIE * 10) / 10, 0, PIE);
    this.refreshPick();
  }

  private refreshPick(): void {
    const crowd = PROVE_CROWDS[this.pi]!;
    this.note.set(`offer ${fmt1(this.po)}, accepted ${pct(crowd.accept(this.po))}, you keep ${fmt1(PIE - this.po)}`);
  }

  private lockIn(): void {
    const crowd: Crowd = PROVE_CROWDS[this.pi]!;
    const e = crowd.expected(this.po);
    const b = crowd.best();
    if (e >= PROVE_SHARE * b.e) {
      this.locked = true;
      this.solved++;
      this.reveal.set(1);
      this.prompt.set("Right. Fair enough to be accepted, greedy enough to pay.");
      this.note.set(`You earn ${fmt1(e)} on average. The best is ${fmt1(b.e)}.`);
      this.wait = 2;
    } else {
      this.prompt.set(this.po < b.x ? "Too greedy. Too many say no." : "Too generous. You are leaving coins.");
      this.note.set(`You earn ${fmt1(e)} on average. A better offer exists.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.dissolve.step(dt);
    this.ringIn.step(dt);
    this.slash.step(dt);
    this.peak.step(dt);
    this.reveal.step(dt);
    this.handle.set(this.offer);
    this.handle.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.decide();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= PROVE_CROWDS.length) {
          this.prompt.set("Refusal punishes greed. The best offer depends on the crowd.");
          this.note.set("Find how much unfairness they tolerate, then stay just inside it.");
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

  protected render(p: Painter, c: Colors): void {
    this.prompt.draw(p, c, this.colX, 82, this.colW);
    this.note.draw(p, c, this.cx, this.h - 182, this.colW, "center");
    if (this.beat === "feel") this.drawFeel(p, c);
    else this.drawCurves(p, c);
  }

  private drawFeel(p: Painter, c: Colors): void {
    const a = this.intro.value;
    const b = this.bar;
    const live = this.stage === "set";
    const keep = PIE - this.handle.value;
    const rx = this.cx;
    const ry = b.y - 64;
    const pulse = this.stage === "wait" ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.ring(rx, ry, 18, c.ink, 1.5, a * pulse);
    p.disc(rx, ry, 6 * this.ringIn.value, c.ink, a);
    const s = this.slash.value;
    if (s > 0.01) p.line(rx - 13 * s, ry + 13 * s, rx + 13 * s, ry - 13 * s, c.ink, 1.5, s);

    const live01 = 1 - this.dissolve.value;
    for (let i = 0; i < PIE; i++) {
      const x = b.x0 + i * b.cell;
      const yours = i + 1 <= keep + 1e-6 && i < Math.round(keep);
      const w = b.cell - 4;
      if (yours) p.rect(x + 2, b.y, w, b.h, c.ink, 0.92 * live01 * a);
      else {
        p.frame(x + 2, b.y, w, b.h, c.ink, 0.6 * live01 * a);
        if (this.stage === "result" && this.accepted) p.rect(x + 2, b.y, w, b.h, c.ink, 0.35 * a);
      }
    }
    if (live) {
      const hx = b.x0 + keep * b.cell;
      p.line(hx, b.y - 10, hx, b.y + b.h + 16, c.ink, 1, a);
      p.disc(hx, b.y + b.h + 24, 9, c.ink, a);
      p.ring(hx, b.y + b.h + 24, 15, c.ink, 1, 0.35 * a);
    }
    p.text(`You keep ${PIE - this.offer}`, b.x0, b.y + b.h + 66, { font: Type.body(14, 400), color: c.ink, alpha: a });
    p.text(`They get ${this.offer}`, b.x0 + b.w, b.y + b.h + 66, { font: Type.body(14, 400), color: c.ink, align: "right", alpha: a });

    const sy = b.y + b.h + 100;
    if (sy + 24 < this.h - 182 - 20) {
      p.rule(b.x0, sy, b.x0 + b.w, sy, c.ink, 0.3);
      p.text("your offers", b.x0, sy + 20, { font: Type.body(12, 400), color: c.fog });
      for (const h of this.history) {
        const x = b.x0 + (h.x / PIE) * b.w;
        if (h.ok) p.disc(x, sy, 4.5, c.ink);
        else {
          p.ring(x, sy, 4.5, c.ink, 1.25);
          p.line(x - 3, sy - 3, x + 3, sy + 3, c.ink, 1);
        }
      }
    }
    for (let i = 0; i < 5; i++) Glyph.step(p, c, this.cx - 40 + i * 20, this.h - 22, i < this.round || (i === this.round && this.stage === "result"), i === this.round);
  }

  private drawCurves(p: Painter, c: Colors): void {
    const prove = this.beat !== "see";
    const crowd = prove ? PROVE_CROWDS[Math.min(this.pi, PROVE_CROWDS.length - 1)]! : FEEL_CROWD;
    const { x0, w, top, h, X, base } = this.chart();
    const Y = (v: number) => base - v * h;
    p.rule(x0, base, x0 + w, base, c.ink, 0.5);
    p.rule(x0, top, x0, base, c.ink, 0.5);
    for (const v of [0, 5, 10]) {
      p.rule(X(v), base, X(v), base + 5, c.ink, 0.5);
      p.text(String(v), X(v), base + 20, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    p.text("what you offer them", x0 + w, base + 38, { font: Type.body(12, 400), color: c.fog, align: "right" });
    if (prove) p.text(crowd.name, x0, top - 12, { font: Type.body(12, 400), color: c.fog });

    const showE = !prove || this.reveal.value > 0.01;
    const ea = prove ? this.reveal.value : 1;
    const steps = 80;
    const curve = (f: (x: number) => number, lw: number, color: string, alpha: number) => {
      const ctx = p.ctx;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * PIE;
        const px = X(x);
        const py = Y(f(x));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    curve((x) => crowd.accept(x), 1.5, c.fog, 0.9);
    p.text("accepted", X(10), Y(1) - 8, { font: Type.body(12, 400), color: c.fog, align: "right" });
    if (showE) {
      curve((x) => crowd.expected(x) / PIE, 2, c.ink, ea);
      p.text("you earn", X(crowd.best().x), Y(crowd.best().e / PIE) - 14, { font: Type.body(12, 400), color: c.ink, align: "center", alpha: ea });
    }

    if (!prove) {
      const tx = X(TEXTBOOK_OFFER);
      p.ring(tx, Y(crowd.expected(TEXTBOOK_OFFER) / PIE), 6, c.ink, 1.25);
      p.text("textbook", tx - 6, Y(crowd.expected(TEXTBOOK_OFFER) / PIE) - 16, { font: Type.body(11, 400), color: c.fog });
      for (const hh of this.history) {
        const x = X(hh.x);
        if (hh.ok) p.disc(x, base, 3.5, c.ink);
        else p.ring(x, base, 3.5, c.ink, 1.25);
      }
      if (this.touched) {
        const px = X(this.probe);
        p.line(px, top, px, base, c.ink, 1, 0.7, [3, 4]);
        p.disc(px, Y(crowd.expected(this.probe) / PIE), 5, c.ink);
      }
      const pk = this.peak.value;
      if (pk > 0.01) {
        const b = crowd.best();
        p.ring(X(b.x), Y(b.e / PIE), 11, c.ink, 1.5, pk);
        p.text(`best ${fmt1(b.x)}`, X(b.x), top - 12, { font: Type.mono(11), color: c.ink, align: "center", alpha: pk });
      }
    } else {
      const px = X(this.po);
      p.line(px, top, px, base, c.ink, 1, 0.8, [3, 4]);
      p.disc(px, Y(crowd.accept(this.po)), 5, c.ink);
      p.disc(px, base, 9, c.ink);
      if (this.reveal.value > 0.01) {
        const b = crowd.best();
        p.ring(X(b.x), Y(b.e / PIE), 11, c.ink, 1.5, this.reveal.value);
      }
      for (let i = 0; i < PROVE_CROWDS.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, this.h - 22, i < this.solved, i === this.pi);
    }
  }
}
