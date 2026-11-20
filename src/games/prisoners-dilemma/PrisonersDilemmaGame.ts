import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { MatrixView, inside } from "../shared/MatrixView";
import { Dilemma, strangerMoves, type Move } from "./model";

const NAME: Record<Move, string> = { hold: "Hold", break: "Break" };
const MAX = 5;

/**
 * Feel: three rounds against strangers. Each round shows what the other move would have paid.
 * See: a plane of the four outcomes. Tap their move and watch Break win both times, then see the
 * outcome both players would have preferred.
 * Prove: drag the temptation payoff down. Once it falls below the reward, Hold becomes a best reply.
 */
export class PrisonersDilemmaGame extends Game {
  readonly slug = "prisoners-dilemma";
  private readonly base = new Dilemma();
  private d = new Dilemma();
  private readonly mv = new MatrixView();

  private strangers: Move[] = [];
  private round = 0;
  private locked = false;
  private mine: Move | null = null;
  private theirs: Move | null = null;
  private since = 0;
  private revealed = false;
  private armed: Move | null = null;
  private readonly youR = new Damped(6, 0.35);
  private readonly theirR = new Damped(6, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private readonly seen = new Set<Move>();
  private readonly arrowT: Record<Move, Damped> = { hold: new Damped(0, 0.5), break: new Damped(0, 0.5) };
  private readonly region = new Damped(0, 0.6);

  private readonly tShown = new Damped(5, 0.25);
  private readonly hint = new Damped(0, 0.5);
  private readonly sArrow: Damped[] = [new Damped(1, 0.3), new Damped(1, 0.3)];
  private dragging = false;
  private dragY0 = 0;
  private dragT0 = 5;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly theyHold = this.add(new CanvasButton("They hold", () => this.inspect("hold")));
  private readonly theyBreak = this.add(new CanvasButton("They break", () => this.inspect("break")));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly gotIt = this.add(new CanvasButton("Got it", () => this.complete(), "primary"));

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  begin(): void {
    this.strangers = strangerMoves((a) => this.env.rng.shuffle(a));
    this.d = this.base;
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.theirs = null;
    this.revealed = false;
    this.seen.clear();
    this.youR.snap(6);
    this.theirR.snap(6);
    this.altR.snap(0);
    this.region.snap(0);
    this.arrowT.hold.snap(0);
    this.arrowT.break.snap(0);
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Hold or Break. A stranger chooses at the same time.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = 3;
    this.enterSee();
    if (beat === "prove") {
      this.seen.add("hold").add("break");
      this.enterProve();
    }
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.gotIt.place(this.cx - 80, by, 160);
    const bw = (f.w - 12) / 2;
    this.theyHold.place(f.x, by, bw);
    this.theyBreak.place(f.x + bw + 12, by, bw);
    this.mv.fit(this.cx, f.top, f.w, f.h);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 3 && !this.locked;
    this.theyHold.visible = this.theyBreak.visible = this.beat === "see" && this.seen.size < 2;
    this.toProve.visible = this.beat === "see" && this.seen.size === 2;
    this.gotIt.visible = this.beat === "prove" && this.d.T < this.d.R;
  }

  // ---- Feel -------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && !this.locked && this.round < 3) {
      if (inside(this.pair(0), x, y)) this.armed = "hold";
      else if (inside(this.pair(1), x, y)) this.armed = "break";
      return;
    }
    if (this.beat === "prove") {
      const r = this.mv.rect(1, 0);
      if (inside({ x: r.x - 20, y: r.y - 10, w: r.w + 40, h: r.h + 20 }, x, y)) {
        this.dragging = true;
        this.dragY0 = y;
        this.dragT0 = this.d.T;
      }
    }
  }

  protected override onMove(_x: number, y: number): void {
    if (!this.dragging) return;
    const unit = (this.mv.cell * 0.7) / 6;
    const t = Math.round(clamp(this.dragT0 + (this.dragY0 - y) / unit, 0, 6) * 2) / 2;
    if (t !== this.d.T) this.setT(t);
  }

  protected override onUp(x: number, y: number): void {
    this.dragging = false;
    const p = this.armed;
    this.armed = null;
    if (p && this.beat === "feel" && !this.locked && inside(this.pair(p === "hold" ? 0 : 1), x, y)) this.play(p);
  }

  private play(m: Move): void {
    this.mine = m;
    this.theirs = this.strangers[this.round]!;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what each move pays." : "Again. Hold or Break.");
    this.youR.set(6);
    this.theirR.set(6);
    this.altR.set(0);
    this.sync();
  }

  private revealRound(): void {
    const me = this.mine!;
    const th = this.theirs!;
    const [y, t] = this.d.payoff(me, th);
    const other: Move = me === "hold" ? "break" : "hold";
    const alt = this.d.payoff(other, th)[0];
    this.youR.set(this.rad(y));
    this.theirR.set(this.rad(t));
    this.altR.set(this.rad(alt));
    this.revealed = true;
    this.note.set(`They ${th === "hold" ? "held" : "broke"}. You got ${y}. ${NAME[other]} would have paid ${alt}.`);
    this.announce(`Round ${this.round + 1}. You chose ${NAME[me]}, they chose ${NAME[th]}. You got ${y}, they got ${t}. ${NAME[other]} would have paid ${alt}.`);
    this.round++;
    this.locked = false;
    if (this.round >= 3) this.prompt.set("Three strangers. Break paid more every time.");
    this.sync();
  }

  /** Disc radius for a payoff. Area carries value, scaled to the room the body has. */
  private rad(v: number): number {
    return v <= 0 ? 2 : this.maxR() * Math.sqrt(v / MAX);
  }

  private maxR(): number {
    return clamp((this.frame.h - 56) / 2, 20, 54);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.revealed = false;
    this.youR.snap(6);
    this.theirR.snap(6);
    this.altR.snap(0);
    this.seen.clear();
    this.prompt.set("Tap their move. See what you should do.");
    this.note.set("");
    this.sync();
  }

  private inspect(m: Move): void {
    this.seen.add(m);
    this.arrowT[m].set(1);
    const hold = this.d.payoff("hold", m)[0];
    const brk = this.d.payoff("break", m)[0];
    this.note.set(`If they ${m === "hold" ? "hold" : "break"}, Break pays ${brk} and Hold pays ${hold}.`);
    if (this.seen.size === 2) {
      this.region.set(1);
      this.prompt.set("Break wins either way. Yet both holding pays more.");
      this.note.set("Both break is stable. That is the dilemma.");
      this.announce("Break is better whatever they do, so both break. Both holding would leave both better off.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.d = this.base;
    this.tShown.snap(this.d.T);
    this.hint.snap(1);
    this.sArrow[0]!.snap(1);
    this.sArrow[1]!.snap(1);
    this.prompt.set("Drag the big disc down. Make Hold win in the left column.");
    this.note.set(`Temptation ${this.d.T}. Reward ${this.d.R}.`);
    this.sync();
  }

  private setT(t: number): void {
    const was = this.d.T < this.d.R;
    this.d = this.base.with({ T: t });
    this.hint.set(0);
    const good = this.d.T < this.d.R;
    if (good !== was) this.cue(good ? "good" : "bad");
    this.prompt.set(good ? "Hold is now the best reply to Hold." : "Drag the big disc down. Make Hold win in the left column.");
    this.note.set(good ? `Temptation ${t} is below the reward ${this.d.R}. Trust can be rational.` : `Temptation ${t}. Reward ${this.d.R}.`);
    if (good) this.announce("Hold is now the best reply when they hold.");
    this.sync();
  }

  private complete(): void {
    this.prompt.set("A dilemma needs temptation above reward. Lower it and trust pays.");
    this.note.set("Both holding is now stable. Next, the Stag Hunt.");
    this.gotIt.visible = false;
    this.finish();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.altR.step(dt);
    this.region.step(dt);
    this.arrowT.hold.step(dt);
    this.arrowT.break.step(dt);
    this.tShown.set(this.d.T);
    this.tShown.step(dt);
    this.hint.step(dt);
    const s0 = this.d.T > this.d.R ? 1 : this.d.T < this.d.R ? -1 : 0;
    this.sArrow[0]!.set(s0);
    this.sArrow[1]!.set(this.d.P > this.d.S ? 1 : -1);
    for (const a of this.sArrow) a.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.6 && !this.revealed) this.revealRound();
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawPlane(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const R = this.maxR();
    const cy = f.top + (f.h - (2 * R + 48)) / 2 + R;
    const off = Math.min(86, f.w / 2 - R - 10);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.dashedRing(xl, cy, this.altR.value, c.ink, 0.8);
    p.disc(xl, cy, this.youR.value, c.ink, 0.95 * a * idle);
    p.ring(xr, cy, this.theirR.value, c.ink, 1.5, a * idle);
    const ly = cy + R + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed && this.mine && this.theirs) {
      const last = this.d.payoff(this.mine, this.theirs);
      p.text(String(last[0]), xl, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(String(last[1]), xr, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    const zh = f.actionH;
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const m: Move = i === 0 ? "hold" : "break";
      const live = this.round < 3 && !this.locked;
      const chosen = this.locked && this.mine === m;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 3 ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === m ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const gr = f.compact ? 13 : 17;
      const gy = z.y + zh * 0.36;
      if (m === "hold") p.ring(gx, gy, gr, c.ink, 1.5, al);
      else p.arc(gx, gy, gr, 0.55, Math.PI * 2 - 0.55, c.ink, 1.5, al);
      p.text(NAME[m], gx, z.y + zh * 0.8, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < 3) for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  /** A wide rectangle, so labels have room beside their points. Margins keep points off the axes. */
  private plane(f: Frame): { x0: number; y0: number; W: number; H: number; px: (you: number, they: number) => [number, number] } {
    const W = f.w - 24;
    const H = Math.max(110, f.h - 52);
    const x0 = f.x + 12;
    const y0 = f.top + 22;
    const padX = 46;
    const padY = 36;
    const iw = W - 2 * padX;
    const ih = H - 2 * padY;
    return { x0, y0, W, H, px: (you, they) => [x0 + padX + (you / MAX) * iw, y0 + H - padY - (they / MAX) * ih] };
  }

  private drawPlane(p: Painter, c: Colors, f: Frame): void {
    const { x0, y0, W, H, px } = this.plane(f);
    p.rule(x0, y0, x0, y0 + H, c.ink, 0.5);
    p.rule(x0, y0 + H, x0 + W, y0 + H, c.ink, 0.5);
    p.text("They get", x0, y0 - 10, { font: Type.body(12, 400), color: c.fog });
    p.text("You get", x0 + W, y0 + H + 20, { font: Type.body(12, 400), color: c.fog, align: "right" });

    const r = this.region.value;
    if (r > 0.01) {
      const [bx, by] = px(this.d.P, this.d.P);
      const [tx, ty] = px(MAX, MAX);
      p.rect(bx, ty, tx - bx, by - ty, c.ink, 0.07 * r);
    }
    const pts: { you: number; they: number; text: string; dx: number; dy: number; align: CanvasTextAlign }[] = [
      { you: this.d.S, they: this.d.T, text: "they break", dx: 12, dy: 4, align: "left" },
      { you: this.d.R, they: this.d.R, text: "both hold", dx: 0, dy: -20, align: "center" },
      { you: this.d.P, they: this.d.P, text: "both break", dx: 0, dy: 24, align: "center" },
      { you: this.d.T, they: this.d.S, text: "you break", dx: 0, dy: 24, align: "center" },
    ];
    for (const pt of pts) {
      const [x, y] = px(pt.you, pt.they);
      p.disc(x, y, 6, c.ink);
      p.text(pt.text, x + pt.dx, y + pt.dy, { font: Type.body(12, 400), color: c.fog, align: pt.align });
    }
    if (r > 0.3) {
      const [hx, hy] = px(this.d.R, this.d.R);
      p.ring(hx, hy, 11, c.ink, 1.25, r);
    }
    for (const m of ["hold", "break"] as const) {
      const t = this.arrowT[m].value;
      if (t < 0.02) continue;
      const from = m === "hold" ? px(this.d.R, this.d.R) : px(this.d.S, this.d.T);
      const to = m === "hold" ? px(this.d.T, this.d.S) : px(this.d.P, this.d.P);
      const k = 14 / Math.hypot(to[0] - from[0], to[1] - from[1]);
      const sx = from[0] + (to[0] - from[0]) * k;
      const sy = from[1] + (to[1] - from[1]) * k;
      const ex = to[0] - (to[0] - from[0]) * k;
      const ey = to[1] - (to[1] - from[1]) * k;
      p.arrow(sx, sy, sx + (ex - sx) * t, sy + (ey - sy) * t, c.ink, 1.5, t, 8);
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const mv = this.mv;
    mv.grid(p, c, 1);
    const names = ["Hold", "Break"] as const;
    ([0, 1] as const).forEach((i) => {
      p.text(names[i], mv.x0 - 18, mv.rowY(i), { font: Type.body(15, 400), color: c.fog, align: "right", base: "middle" });
      p.text(names[i], mv.colX(i), mv.y0 - 16, { font: Type.body(15, 400), color: c.fog, align: "center" });
    });
    Glyph.you(p, c, mv.x0 - mv.rowLabelW + 10, mv.y0 + mv.cell, 4);
    Glyph.other(p, c, mv.x0 + mv.cell, mv.y0 - 46, 6);
    const vals: [number, number, number][] = [[0, 0, this.d.R], [0, 1, this.d.S], [1, 0, this.tShown.value], [1, 1, this.d.P]];
    for (const [r, col, v] of vals) {
      const ctr = mv.center(r, col);
      p.disc(ctr.x, ctr.y, mv.radius(v, 6), c.ink, 0.92);
      mv.number(p, c, r, col, r === 1 && col === 0 ? Math.round(v * 2) / 2 : v);
    }
    const t = mv.center(1, 0);
    if (this.hint.value > 0.02) {
      // A dashed ring that leaves the lower right open, where the cell's number sits.
      const hr = mv.radius(this.tShown.value, 6) + 2.5 + 0.7 * Math.sin(this.time * 3);
      for (let k = 0; k < 18; k++) {
        const a0 = (k / 18) * Math.PI * 2;
        if (a0 > -0.3 && a0 < 1.5) continue;
        p.line(t.x + hr * Math.cos(a0), t.y + hr * Math.sin(a0), t.x + hr * Math.cos(a0 + 0.17), t.y + hr * Math.sin(a0 + 0.17), c.ink, 1.25, 0.7 * this.hint.value);
      }
    }
    ([0, 1] as const).forEach((col) => {
      const s = this.sArrow[col]!.value;
      if (Math.abs(s) < 0.06) return;
      const x = mv.colX(col) - mv.cell * 0.44;
      const ym = mv.y0 + mv.cell;
      p.arrow(x, ym, x, ym + s * mv.cell * 0.42, c.ink, 1.5, Math.min(1, Math.abs(s)), 8);
    });
    void f;
  }
}
