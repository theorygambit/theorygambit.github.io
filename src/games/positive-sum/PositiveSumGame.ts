import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { PayoffPlane } from "../shared/PayoffPlane";
import { Track } from "../shared/Track";
import { FEEL_DEALS, PLANE_MAX, PROVE_DEALS, acceptable, range, surplus, type Deal } from "./model";

/**
 * Feel: three merges. Drag the split and watch each disc against its dashed "alone" ring.
 * See: alone is one point, together is a longer line, and only some splits lie up and right of alone.
 * Prove: three new deals. Pick a split that leaves both better off, or call "no deal" when there is no surplus.
 */
export class PositiveSumGame extends Game {
  readonly slug = "positive-sum";
  private readonly plane = new PayoffPlane();
  private readonly track = new Track();
  private round = 0;
  private stage: "set" | "result" = "set";
  private dragging = false;
  private accepted = false;
  private readonly intro = new Damped(0, 0.7);
  private readonly youR = new Damped(0, 0.12);
  private readonly theirR = new Damped(0, 0.12);

  private seeStep = 0;
  private readonly alone = new Damped(0, 0.5);
  private readonly lineT = new Damped(0, 0.7);
  private readonly gain = new Damped(0, 0.7);

  private deals: Deal[] = [];
  private pi = 0;
  private solved = 0;
  private share = 4;
  private locked = false;
  private wait = 0;

  private readonly offer = this.add(new CanvasButton("Offer", () => this.doOffer(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly noDeal = this.add(new CanvasButton("No deal", () => this.callNoDeal()));
  private readonly propose = this.add(new CanvasButton("Offer", () => this.proveOffer(), "primary"));

  constructor(env: ConstructorParameters<typeof Game>[0]) {
    super(env);
    this.track.step = 1;
  }

  private get deal(): Deal {
    return FEEL_DEALS[Math.min(this.round, FEEL_DEALS.length - 1)]!;
  }

  begin(): void {
    this.round = 0;
    this.deals = this.env.rng.shuffle(PROVE_DEALS);
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    const d = this.deal;
    this.stage = "set";
    this.track.min = 0;
    this.track.max = d.merged;
    this.track.value = Math.round(d.merged / 2);
    this.syncDiscs(true);
    this.prompt.set(this.round === 0 ? "Together you make more. Split it." : "A new merge. Split it.");
    this.note.set("Dashed rings show what each side has alone.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = FEEL_DEALS.length - 1;
    this.enterSee();
    this.seeStep = 2;
    this.alone.snap(1);
    this.lineT.snap(1);
    this.gain.snap(1);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.offer, this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
    const bw = (f.w - 12) / 2;
    this.noDeal.place(f.x, by, bw);
    this.propose.place(f.x + bw + 12, by, bw);
    this.plane.fit(f, PLANE_MAX);
    this.track.fit(f.x + 24, f.x + f.w - 24, f.bottom - 32);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.offer.visible = feel && this.stage === "set";
    this.next.visible = feel && this.stage === "result" && this.round < FEEL_DEALS.length - 1;
    this.toSee.visible = feel && this.stage === "result" && this.round >= FEEL_DEALS.length - 1;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.noDeal.visible = this.propose.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number): void {
    if (this.beat === "see") return this.stepSee();
    if (this.beat === "feel" && this.stage === "set") {
      this.dragging = true;
      this.setFeel(x);
    } else if (this.beat === "prove" && !this.locked) {
      this.dragging = true;
      this.setProve(x);
    }
  }

  protected override onMove(x: number): void {
    if (!this.dragging) return;
    if (this.beat === "feel") this.setFeel(x);
    else if (this.beat === "prove") this.setProve(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  // ---- Feel -------------------------------------------------------------

  private setFeel(x: number): void {
    this.track.set(x);
    this.syncDiscs();
  }

  private rScale(): number {
    return clamp((this.frame.h - 100) / 2, 16, 44);
  }

  private syncDiscs(snap = false): void {
    const d = this.deal;
    const R = this.rScale();
    const s = this.track.value;
    const y = R * Math.sqrt(Math.max(s, 0.05) / PLANE_MAX);
    const t = R * Math.sqrt(Math.max(d.merged - s, 0.05) / PLANE_MAX);
    if (snap) {
      this.youR.snap(y);
      this.theirR.snap(t);
    } else {
      this.youR.set(y);
      this.theirR.set(t);
    }
  }

  private doOffer(): void {
    const d = this.deal;
    const s = this.track.value;
    this.accepted = acceptable(d, s);
    this.stage = "result";
    this.cue(this.accepted ? "good" : "bad");
    if (this.accepted) {
      this.prompt.set("Deal. Both of you are better off.");
      this.note.set(`You hold ${s}, they hold ${d.merged - s}. Alone: ${d.a} and ${d.b}.`);
    } else if (s < d.a) {
      this.prompt.set("No deal. You would be worse off.");
      this.note.set(`You would hold ${s}, less than the ${d.a} you have alone.`);
    } else {
      this.prompt.set("No deal. They would be worse off.");
      this.note.set(`They would hold ${d.merged - s}, less than the ${d.b} they have alone.`);
    }
    this.announce(this.accepted ? `Deal. You hold ${s}, they hold ${d.merged - s}.` : "No deal.");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.alone.snap(0).set(1);
    this.lineT.snap(0);
    this.gain.snap(0);
    this.afterStep();
  }

  private stepSee(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    this.afterStep();
  }

  private afterStep(): void {
    const d = FEEL_DEALS[FEEL_DEALS.length - 1]!;
    if (this.seeStep === 0) {
      this.prompt.set("Alone, you and they sit at one point.");
      this.note.set("Tap to see what merging does.");
    } else if (this.seeStep === 1) {
      this.lineT.set(1);
      this.prompt.set(`Together there is ${d.merged} to split, not ${d.a + d.b}.`);
      this.note.set("Every split is a point on this line. Tap again.");
    } else {
      this.gain.set(1);
      this.prompt.set("Only splits up and right of alone help both.");
      this.note.set("The thick part is every deal both sides accept.");
      this.announce("Splits above and to the right of the alone point leave both sides better off.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const d = this.deals[this.pi]!;
    this.locked = false;
    this.share = Math.round(d.merged / 2);
    this.gain.snap(0);
    this.prompt.set("Pick a split that leaves both better off.");
    this.note.set(`Alone: you ${d.a}, they ${d.b}. Together: ${d.merged}.`);
    this.sync();
  }

  private setProve(x: number): void {
    const d = this.deals[this.pi]!;
    const [v] = this.plane.inv(x, 0);
    this.share = clamp(Math.round(v), 0, d.merged);
  }

  private proveOffer(): void {
    const d = this.deals[this.pi]!;
    const ok = surplus(d) > 0 && acceptable(d, this.share);
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.gain.set(1);
      this.prompt.set("Right. Both are above where they started.");
      this.note.set(`You hold ${this.share}, they hold ${d.merged - this.share}.`);
      this.wait = 2;
    } else if (surplus(d) <= 0) {
      this.prompt.set("There is nothing to gain here.");
      this.note.set(`Together is worth ${d.merged}, less than ${d.a + d.b} alone.`);
    } else {
      this.prompt.set("Not quite. One of you ends up worse off.");
      this.note.set(`You hold ${this.share}, they hold ${d.merged - this.share}. Look at the alone point.`);
    }
    this.sync();
  }

  private callNoDeal(): void {
    const d = this.deals[this.pi]!;
    const ok = surplus(d) <= 0;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set("Right. Merging would destroy value.");
      this.note.set(`Together is worth ${d.merged}, less than ${d.a + d.b} alone.`);
      this.wait = 2;
    } else {
      this.prompt.set("A deal exists. Look for it.");
      this.note.set(`Together is worth ${surplus(d)} more than alone.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.alone.step(dt);
    this.lineT.step(dt);
    this.gain.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.deals.length) {
          this.prompt.set("Positive-sum: together makes more than apart.");
          this.note.set("The surplus is the reason to cooperate.");
          this.finish();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawPlane(p, c);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const d = this.deal;
    const R = this.rScale();
    const off = Math.min(90, f.w / 2 - R - 8);
    const cy = f.top + 8 + R;
    const xl = this.cx - off;
    const xr = this.cx + off;
    const base = (v: number) => R * Math.sqrt(v / PLANE_MAX);
    p.dashedRing(xl, cy, base(d.a), c.ink, 0.8 * a);
    p.dashedRing(xr, cy, base(d.b), c.ink, 0.8 * a);
    p.disc(xl, cy, this.youR.value, c.ink, 0.92 * a);
    p.ring(xr, cy, this.theirR.value, c.ink, 1.5, a);
    const s = this.track.value;
    const ly = cy + R + 22;
    p.text(`You ${s}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text(`They ${d.merged - s}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    this.track.ruler(p, c, [0, d.merged], (v) => String(v), a);
    p.text(String(s), this.track.xOf(s), this.track.y - 24, { font: Type.mono(12), color: c.ink, align: "center", alpha: a });
    this.track.marker(p, c, s, 9, a);
    this.ticks(p, c, FEEL_DEALS.length, this.round + (this.stage === "result" ? 1 : 0), this.round);
  }

  private drawPlane(p: Painter, c: Colors): void {
    const pl = this.plane;
    const d = this.beat === "see" ? FEEL_DEALS[FEEL_DEALS.length - 1]! : this.deals[Math.min(this.pi, this.deals.length - 1)]!;
    const prove = this.beat === "prove";
    pl.axes(p, c);
    const alone = prove ? 1 : this.alone.value;
    const line = prove ? 1 : this.lineT.value;
    const gain = this.gain.value;
    if (gain > 0.02 && surplus(d) > 0) {
      pl.quadrant(p, c, d.a, d.b, gain);
      const r = range(d)!;
      const [x1, y1] = pl.px(r[0], d.merged - r[0]);
      const [x2, y2] = pl.px(r[1], d.merged - r[1]);
      p.line(x1, y1, x2, y2, c.ink, 3.5, gain);
      const [tx, ty] = pl.px(d.a + (PLANE_MAX - d.a) * 0.62, d.b + (PLANE_MAX - d.b) * 0.8);
      if (!prove) p.text("better for both", tx, ty, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: gain });
    }
    if (line > 0.02) pl.sumLine(p, c, d.merged, line, 1.5);
    const [ax, ay] = pl.px(d.a, d.b);
    p.disc(ax, ay, 6, c.ink, alone);
    // The label goes on the side away from the deal line: below when the line is above and right, above when it is below.
    const labelY = surplus(d) > 0 ? ay + 24 : ay - 16;
    p.text("alone", ax, labelY, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: alone });
    if (prove) {
      const s = this.share;
      const [mx, my] = pl.px(s, d.merged - s);
      p.ring(mx, my, 11, c.ink, 1.5);
      p.disc(mx, my, 5, c.ink);
      this.ticks(p, c, this.deals.length, this.solved, this.pi);
    }
  }
}
