import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { MatrixView, inside, type Box } from "../shared/MatrixView";
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
  private readonly youR = new Damped(7, 0.35);
  private readonly theirR = new Damped(7, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private readonly seen = new Set<Move>();
  private readonly arrowT: Record<Move, Damped> = { hold: new Damped(0, 0.5), break: new Damped(0, 0.5) };
  private readonly region = new Damped(0, 0.6);

  private readonly tShown = new Damped(5, 0.25);
  private readonly cue = new Damped(0, 0.5);
  private readonly sArrow: Damped[] = [new Damped(1, 0.3), new Damped(1, 0.3)];
  private dragging = false;
  private dragY0 = 0;
  private dragT0 = 5;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly theyHold = this.add(new CanvasButton("They hold", () => this.inspect("hold")));
  private readonly theyBreak = this.add(new CanvasButton("They break", () => this.inspect("break")));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly gotIt = this.add(new CanvasButton("Got it", () => this.complete(), "primary"));

  begin(): void {
    this.strangers = strangerMoves((a) => this.env.rng.shuffle(a));
    this.d = this.base;
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.theirs = null;
    this.revealed = false;
    this.seen.clear();
    this.youR.snap(7);
    this.theirR.snap(7);
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
    const by = this.h - 80;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.gotIt.place(this.cx - 80, by, 160);
    const bw = (this.colW - 12) / 2;
    this.theyHold.place(this.colX, by, bw);
    this.theyBreak.place(this.colX + bw + 12, by, bw);
    this.mv.fit(this.cx, 150, this.colW, this.h - 355);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 3 && !this.locked;
    this.theyHold.visible = this.theyBreak.visible = this.beat === "see" && this.seen.size < 2;
    this.toProve.visible = this.beat === "see" && this.seen.size === 2;
    this.gotIt.visible = this.beat === "prove" && this.d.T < this.d.R;
  }

  private zone(i: 0 | 1): Box {
    const bw = (this.colW - 12) / 2;
    return { x: this.colX + i * (bw + 12), y: this.h - 150, w: bw, h: 90 };
  }

  private get midY(): number {
    return (160 + (this.h - 200)) / 2;
  }

  // ---- Feel -------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel" && !this.locked && this.round < 3) {
      if (inside(this.zone(0), x, y)) this.armed = "hold";
      else if (inside(this.zone(1), x, y)) this.armed = "break";
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
    if (p && this.beat === "feel" && !this.locked && inside(this.zone(p === "hold" ? 0 : 1), x, y)) this.play(p);
  }

  private play(m: Move): void {
    this.mine = m;
    this.theirs = this.strangers[this.round]!;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what each move pays." : "Again. Hold or Break.");
    this.youR.set(7);
    this.theirR.set(7);
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

  private rad(v: number): number {
    return v <= 0 ? 2 : 56 * Math.sqrt(v / MAX);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.revealed = false;
    this.youR.snap(7);
    this.theirR.snap(7);
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
    this.cue.snap(1);
    this.sArrow[0]!.snap(1);
    this.sArrow[1]!.snap(1);
    this.prompt.set("Drag the big disc down. Make Hold win in the left column.");
    this.note.set(`Temptation ${this.d.T}. Reward ${this.d.R}.`);
    this.sync();
  }

  private setT(t: number): void {
    this.d = this.base.with({ T: t });
    this.cue.set(0);
    const good = this.d.T < this.d.R;
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
    this.cue.step(dt);
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

  protected render(p: Painter, c: Colors): void {
    this.prompt.draw(p, c, this.colX, 82, this.colW);
    if (this.beat === "feel") this.drawFeel(p, c);
    else if (this.beat === "see") this.drawPlane(p, c);
    else this.drawProve(p, c);
    this.note.draw(p, c, this.cx, this.h - 182, this.colW, "center");
  }

  private ghostRing(p: Painter, c: Colors, x: number, y: number, r: number, alpha: number): void {
    if (r < 3 || alpha < 0.02) return;
    const ctx = p.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c.ink;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawFeel(p: Painter, c: Colors): void {
    const a = this.intro.value;
    const y = this.midY;
    const xl = this.cx - 86;
    const xr = this.cx + 86;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    this.ghostRing(p, c, xl, y, this.altR.value, 0.8);
    p.disc(xl, y, this.youR.value, c.ink, 0.95 * a * idle);
    p.ring(xr, y, this.theirR.value, c.ink, 1.5, a * idle);
    p.text("You", xl, y + 78, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, y + 78, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed && this.mine && this.theirs) {
      const last = this.d.payoff(this.mine, this.theirs);
      p.text(String(last[0]), xl, y + 100, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(String(last[1]), xr, y + 100, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    for (const i of [0, 1] as const) {
      const z = this.zone(i);
      const m: Move = i === 0 ? "hold" : "break";
      const live = this.round < 3 && !this.locked;
      const chosen = this.locked && this.mine === m;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 3 ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      const gx = z.x + z.w / 2;
      const gy = z.y + 34;
      if (m === "hold") p.ring(gx, gy, 17, c.ink, 1.5, al);
      else p.arc(gx, gy, 17, 0.55, Math.PI * 2 - 0.55, c.ink, 1.5, al);
      p.text(NAME[m], gx, z.y + 74, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < 3) for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, this.h - 22, i < this.round, i === this.round);
  }

  private plane(): { x0: number; y0: number; S: number; px: (you: number, they: number) => [number, number] } {
    const S = clamp(Math.min(this.colW - 90, this.h - 160 - 210), 120, 270);
    const x0 = this.cx - S / 2;
    const y0 = 190;
    const pad = 26;
    const inner = S - 2 * pad;
    return { x0, y0, S, px: (you, they) => [x0 + pad + (you / MAX) * inner, y0 + S - pad - (they / MAX) * inner] };
  }

  private drawPlane(p: Painter, c: Colors): void {
    const { x0, y0, S, px } = this.plane();
    p.rule(x0, y0, x0, y0 + S, c.ink, 0.5);
    p.rule(x0, y0 + S, x0 + S, y0 + S, c.ink, 0.5);
    p.text("They get", x0, y0 - 14, { font: Type.body(12, 400), color: c.fog });
    p.text("You get", x0 + S, y0 + S + 20, { font: Type.body(12, 400), color: c.fog, align: "right" });

    const r = this.region.value;
    if (r > 0.01) {
      const [bx, by] = px(1, 1);
      const [tx, ty] = px(5, 5);
      p.rect(bx, ty, tx - bx, by - ty, c.ink, 0.07 * r);
      p.frame(bx, ty, tx - bx, by - ty, c.ink, 0.35 * r);
    }
    const pts: { you: number; they: number; label: string; side: "l" | "r" }[] = [
      { you: this.d.R, they: this.d.R, label: "both hold", side: "r" },
      { you: this.d.P, they: this.d.P, label: "both break", side: "r" },
      { you: this.d.T, they: this.d.S, label: "you break", side: "l" },
      { you: this.d.S, they: this.d.T, label: "they break", side: "r" },
    ];
    for (const pt of pts) {
      const [x, y] = px(pt.you, pt.they);
      p.disc(x, y, 6, c.ink);
      p.text(pt.label, x + (pt.side === "r" ? 12 : -12), y - 10, { font: Type.body(12, 400), color: c.fog, align: pt.side === "r" ? "left" : "right" });
      p.text(`${pt.you},${pt.they}`, x + (pt.side === "r" ? 12 : -12), y + 6, { font: Type.mono(10), color: c.ash, align: pt.side === "r" ? "left" : "right" });
    }
    if (r > 0.3) {
      const [hx, hy] = px(this.d.R, this.d.R);
      p.ring(hx, hy, 12, c.ink, 1.25, r);
    }
    for (const m of ["hold", "break"] as const) {
      const t = this.arrowT[m].value;
      if (t < 0.02) continue;
      const from = m === "hold" ? px(this.d.R, this.d.R) : px(this.d.S, this.d.T);
      const to = m === "hold" ? px(this.d.T, this.d.S) : px(this.d.P, this.d.P);
      const k = 11 / Math.hypot(to[0] - from[0], to[1] - from[1]);
      const sx = from[0] + (to[0] - from[0]) * k;
      const sy = from[1] + (to[1] - from[1]) * k;
      const ex = to[0] - (to[0] - from[0]) * k;
      const ey = to[1] - (to[1] - from[1]) * k;
      p.arrow(sx, sy, sx + (ex - sx) * t, sy + (ey - sy) * t, c.ink, 1.5, t, 8);
    }
  }

  private drawProve(p: Painter, c: Colors): void {
    const mv = this.mv;
    const a = 1;
    mv.grid(p, c, a);
    const names = ["Hold", "Break"] as const;
    ([0, 1] as const).forEach((i) => {
      p.text(names[i], mv.x0 - 18, mv.rowY(i), { font: Type.body(15, 400), color: c.fog, align: "right", base: "middle" });
      p.text(names[i], mv.colX(i), mv.y0 - 14, { font: Type.body(15, 400), color: c.fog, align: "center" });
    });
    Glyph.you(p, c, mv.x0 - mv.rowLabelW + 8, mv.y0 + mv.cell, 4);
    Glyph.other(p, c, mv.x0 + mv.cell, mv.y0 - 40, 6);
    const vals: [number, number, number][] = [[0, 0, this.d.R], [0, 1, this.d.S], [1, 0, this.tShown.value], [1, 1, this.d.P]];
    for (const [r, col, v] of vals) {
      const ctr = mv.center(r, col);
      const rad = mv.radius(v, 6);
      p.disc(ctr.x, ctr.y, rad, c.ink, 0.92);
      mv.number(p, c, r, col, r === 1 && col === 0 ? Math.round(v * 2) / 2 : v);
    }
    const t = mv.center(1, 0);
    if (this.cue.value > 0.02) p.ring(t.x, t.y, mv.radius(this.tShown.value, 6) + 8 + 3 * Math.sin(this.time * 3), c.ink, 1, 0.6 * this.cue.value);
    ([0, 1] as const).forEach((col) => {
      const s = this.sArrow[col]!.value;
      if (Math.abs(s) < 0.06) return;
      const x = mv.colX(col) - mv.cell * 0.44;
      const ym = mv.y0 + mv.cell;
      p.arrow(x, ym, x, ym + s * mv.cell * 0.42, c.ink, 1.5, Math.min(1, Math.abs(s)), 8);
    });
  }
}
