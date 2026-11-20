import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Slider, drawTicks } from "../shared/kit";
import { BUILDS, Design, FEEL_DESIGN, PROVE_DESIGNS, PROVE_TOLERANCE } from "./model";

const n100 = (v: number): string => String(Math.round(v * 100));

/**
 * Feel: you release three builds of a game, from gentle to pushy. Engagement is your number, and the players have theirs.
 * See: drag the pressure up. Engagement keeps climbing and what players gain peaks, then falls.
 * Prove: two new products. Drag to the pressure that is best for the player, not the one that engages most.
 */
export class DesignEthicsGame extends Game {
  readonly slug = "design-ethics";
  private readonly d = FEEL_DESIGN;
  private released: boolean[] = [false, false, false];
  private readonly cols: Damped[] = [0, 1, 2].map(() => new Damped(0, 0.5));

  private reach = 0;
  private cur = 0;
  private dragging = false;
  private readonly care = new Damped(0, 0.5);

  private designs: Design[] = [];
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
    this.released = [false, false, false];
    this.cols.forEach((c) => c.snap(0));
    this.reach = 0;
    this.cur = 0;
    this.care.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("You design a game. Release each build and read the numbers.");
    this.note.set("Disc: engagement, your number. Ring: what players gain.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.released = [true, true, true];
    this.cols.forEach((c) => c.snap(1));
    this.enterSee();
    if (beat === "see") {
      this.reach = 1;
      this.cur = 1;
      this.check();
      this.care.snap(1);
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.released.every(Boolean);
    this.toProve.visible = this.beat === "see" && this.care.target === 1;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Geometry ---------------------------------------------------------

  private colWidth(f: Frame): number {
    return (f.w - 70) / 3;
  }

  private plot(f: Frame): { x0: number; x1: number; yTop: number; yBot: number } {
    return { x0: f.x + 10, x1: f.x + f.w - 10, yTop: f.top + 10, yBot: f.bottom - 26 };
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "feel") {
      if (y < f.top || y > f.bottom || x < f.x + 70) return;
      const i = clamp(Math.floor((x - f.x - 70) / this.colWidth(f)), 0, 2);
      if (!this.released[i]) this.release(i);
    } else if (this.beat === "see") {
      if (y >= f.top && y <= f.bottom) {
        this.dragging = true;
        this.dragSee(x);
      }
    } else if (this.beat === "prove" && !this.locked && y >= f.top && y <= f.bottom) {
      this.slider.dragging = true;
      this.slider.setFromX(x, 0.01);
      this.note.set("");
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.dragSee(x);
    if (this.slider.dragging) this.slider.setFromX(x, 0.01);
  }

  protected override onUp(): void {
    this.dragging = false;
    this.slider.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private release(i: number): void {
    this.released[i] = true;
    this.cols[i]!.set(1);
    const b = BUILDS[i]!;
    const e = this.d.engagement(b.x);
    const g = this.d.benefit(b.x);
    this.cue(g >= 0.5 * e ? "good" : "bad");
    const left = this.released.filter(Boolean).length;
    this.prompt.set(g >= 0.5 * e ? `${b.name}. They stay and they gain.` : `${b.name}. They stay. Few are better off.`);
    this.note.set(`Engagement ${n100(e)}, player gain ${n100(g)}. ${left} of 3 released.`);
    this.announce(`${b.name} build. Engagement ${n100(e)}. Player gain ${n100(g)}.`);
    if (left === 3) {
      const e3 = this.d.engagement(BUILDS[2]!.x);
      const g3 = this.d.benefit(BUILDS[2]!.x);
      const g2 = this.d.benefit(BUILDS[1]!.x);
      this.note.set(`Pushy engages most, ${n100(e3)}, and helps least, ${n100(g3)}. Standard helps most, ${n100(g2)}.`);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.reach = 0;
    this.cur = 0;
    this.care.snap(0);
    this.prompt.set("Drag right to add pressure.");
    this.note.set("Line: engagement. Faint line: what players gain.");
    this.sync();
  }

  private dragSee(x: number): void {
    const { x0, x1 } = this.plot(this.frame);
    this.cur = clamp((x - x0) / (x1 - x0), 0, 1);
    this.reach = Math.max(this.reach, this.cur);
    this.check();
  }

  private check(): void {
    if (this.care.target === 0 && this.reach >= this.d.care + 0.14) {
      this.care.set(1);
      this.cue("good");
      this.prompt.set("Engagement keeps climbing. Gain peaks, then falls.");
      this.note.set(`Gain peaks near pressure ${n100(this.d.care)}. Past it, engagement is paid for by the player.`);
      this.announce("Engagement keeps rising, but what players gain peaks and then falls.");
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.designs = this.env.rng.shuffle(PROVE_DESIGNS);
    this.pi = 0;
    this.solved = 0;
    this.loadDesign();
  }

  private loadDesign(): void {
    this.locked = false;
    this.slider.value = this.designs[this.pi]!.care > 0.5 ? 0.15 : 0.9;
    this.settle.snap(0);
    this.prompt.set(this.pi === 0 ? "A new product. Set the pressure that is best for the player." : "Another product. Best for the player, not for engagement.");
    this.note.set("Drag, and watch the ring.");
    this.sync();
  }

  private lockIn(): void {
    const ds = this.designs[this.pi]!;
    const x = this.slider.value;
    if (Math.abs(x - ds.care) <= PROVE_TOLERANCE) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.settle.set(1);
      this.prompt.set("Right. This is where care and engagement part ways.");
      this.note.set(`Gain peaks near ${n100(ds.care)}. Engagement would keep rising to 100.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.prompt.set(x < ds.care ? "Gain is still rising here. Add pressure." : "Gain has already fallen. Ease off.");
      this.note.set(`At ${n100(x)}: engagement ${n100(ds.engagement(x))}, gain ${n100(ds.benefit(x))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    for (const c of this.cols) c.step(dt);
    this.care.step(dt);
    this.settle.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.designs.length) {
          this.prompt.set("Measure what the player gains, not only how long they stay.");
          this.note.set("A design is fair when its metric and the player's interest point the same way.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadDesign();
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
    const cw = this.colWidth(f);
    const R = clamp(Math.min(cw * 0.4, (f.h - 68) / 4), 12, 34);
    const y1 = f.top + 24 + R;
    const n1 = y1 + R + 13;
    const y2 = n1 + 12 + R;
    const n2 = y2 + R + 13;
    const font = Type.body(12, 400);
    p.text("engagement", f.x, y1, { font, color: c.fog, base: "middle" });
    p.text("player gain", f.x, y2, { font, color: c.fog, base: "middle" });
    BUILDS.forEach((b, i) => {
      const x = f.x + 70 + (i + 0.5) * cw;
      const k = this.cols[i]!.value;
      p.text(b.name, x, f.top + 8, { font: Type.body(13, 400), color: c.ink, align: "center", alpha: 0.55 + 0.45 * k });
      if (k < 0.01) {
        p.ring(x, (y1 + y2) / 2, 5, c.ink, 1.25, 0.3 + 0.2 * Math.sin(this.time * 4 + i));
        return;
      }
      const e = this.d.engagement(b.x);
      const g = this.d.benefit(b.x);
      p.disc(x, y1, R * Math.sqrt(e) * k, c.ink, 0.92 * k);
      p.text(n100(e), x, n1, { font: Type.mono(11), color: c.fog, align: "center", alpha: k });
      p.ring(x, y2, R * Math.sqrt(g) * k, c.ink, 1.5, k);
      p.text(n100(g), x, n2, { font: Type.mono(11), color: c.fog, align: "center", alpha: k });
    });
    drawTicks(p, c, f, this.cx, 3, this.released.filter(Boolean).length, this.released.findIndex((r) => !r));
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const { x0, x1, yTop, yBot } = this.plot(f);
    const X = (v: number) => x0 + v * (x1 - x0);
    const Y = (v: number) => yBot - v * (yBot - yTop) * 0.95;
    p.rule(x0, yBot, x1, yBot, c.ink, 0.5);
    p.rule(x0, yTop, x0, yBot, c.ink, 0.5);
    p.text("gentle", x0, yBot + 17, { font: Type.body(11, 400), color: c.fog });
    p.text("pushy", x1, yBot + 17, { font: Type.body(11, 400), color: c.fog, align: "right" });
    const pts = (fn: (x: number) => number) => {
      const out: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        const v = (i / 60) * this.reach;
        out.push([X(v), Y(fn(v))]);
      }
      return out;
    };
    if (this.reach > 0.01) {
      p.path(pts((v) => this.d.engagement(v)), c.ink, 1.5, 0.95);
      p.path(pts((v) => this.d.benefit(v)), c.ink, 1, 0.45);
    }
    p.line(X(this.cur), yBot, X(this.cur), Y(Math.max(this.d.engagement(this.cur), 0.02)), c.ink, 0.5, 0.35, [2, 4]);
    p.disc(X(this.cur), Y(this.d.engagement(this.cur)), 5, c.ink);
    p.ring(X(this.cur), Y(this.d.benefit(this.cur)), 5, c.ink, 1.5);
    const k = this.care.value;
    if (k > 0.01) {
      const cx = X(this.d.care);
      p.line(cx, yBot, cx, Y(this.d.benefit(this.d.care)), c.ink, 1, 0.8 * k, [4, 4]);
      p.text("care", cx, yBot + 17, { font: Type.body(12, 400), color: c.ink, align: "center", alpha: k });
    }
    drawTicks(p, c, f, this.cx, 2, this.care.target === 1 ? 2 : this.reach > 0.05 ? 1 : 0, this.care.target === 1 ? 1 : 0);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const ds = this.designs[Math.min(this.pi, this.designs.length - 1)]!;
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const x = this.slider.value;
    const e = ds.engagement(x);
    const g = ds.benefit(x);
    p.disc(xl, cy, R * Math.sqrt(e), c.ink, 0.92);
    if (g > 0.003) p.ring(xr, cy, R * Math.sqrt(g), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text(`Engagement ${n100(e)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`Gain ${n100(g)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    const ty = Math.min(f.bottom - 28, ly + 56);
    this.slider.place(f.x + 24, f.x + f.w - 24, ty);
    this.slider.draw(p, c);
    p.text("gentle", f.x + 24, ty + 24, { font: Type.body(11, 400), color: c.ash });
    p.text("pushy", f.x + f.w - 24, ty + 24, { font: Type.body(11, 400), color: c.ash, align: "right" });
    const k = this.settle.value;
    if (k > 0.01) p.line(this.slider.at(ds.care), ty - 14, this.slider.at(ds.care), ty + 14, c.ink, 1, k);
    drawTicks(p, c, f, this.cx, this.designs.length, this.solved, this.pi);
  }
}
