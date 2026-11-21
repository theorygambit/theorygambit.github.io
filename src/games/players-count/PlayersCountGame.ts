import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Track } from "../shared/Track";
import { FEEL_R, FEEL_SCENES, MAX_PLAYERS, PROVE_R, PublicGood } from "./model";

const fmt = (v: number): string => (Math.round(v * 100) / 100).toFixed(2).replace(/0$/, "").replace(/\.$/, "");

/**
 * Feel: a shared pot with one, two and five players. Invest your coin or keep it.
 * See: the return per invested coin falls as r over n. It crosses what keeping pays at n = r.
 * Prove: new multipliers. Find the biggest group where investing alone still pays.
 */
export class PlayersCountGame extends Game {
  readonly slug = "players-count";
  private readonly good = new PublicGood(FEEL_R);
  private readonly track = new Track();
  private round = 0;
  private locked = false;
  private mine: boolean | null = null;
  private others: boolean[][] = [];
  private since = 0;
  private revealed = false;
  private last = 0;
  private readonly youR = new Damped(0, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly flat = new Damped(0, 0.5);
  private readonly curve = new Damped(0, 0.7);
  private readonly cross = new Damped(0, 0.6);

  private pi = 0;
  private solved = 0;
  private locked2 = false;
  private wait = 0;
  private readonly crowd = new Damped(1, 0.3);
  private readonly show = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  constructor(env: ConstructorParameters<typeof Game>[0]) {
    super(env);
    this.track.min = 1;
    this.track.max = MAX_PLAYERS;
    this.track.step = 1;
  }

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  begin(): void {
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.revealed = false;
    this.others = FEEL_SCENES.map((s) => Array.from({ length: s.n - 1 }, () => this.env.rng.chance(0.5)));
    this.youR.snap(0);
    this.altR.snap(0);
    this.seeStep = 0;
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.prompt.set("Each of you holds 1 coin. Invest it, or keep it.");
    this.note.set("Invested coins are multiplied by 1.6 and shared equally.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = 3;
    this.enterSee();
    this.seeStep = 2;
    this.flat.snap(1);
    this.curve.snap(1);
    this.cross.snap(1);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const f = this.frame;
    const by = this.buttonY;
    for (const b of [this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
    this.track.fit(f.x + 24, f.x + f.w - 24, clamp(f.top + f.h * 0.56, f.top + 90, f.bottom - 48));
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= FEEL_SCENES.length && !this.locked;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
    this.lock.visible = this.beat === "prove" && !this.locked2;
  }

  protected override zonesActive(): Box[] | null {
    return this.beat === "feel" && !this.locked && this.round < FEEL_SCENES.length ? [this.cells(2, 0), this.cells(2, 1)] : null;
  }

  protected override onZone(i: number): void {
    this.play(i === 0);
  }

  protected override onDown(x: number): void {
    if (this.beat === "see") {
      if (this.seeStep < 2) {
        this.seeStep++;
        this.afterStep();
      }
    } else if (this.beat === "prove" && !this.locked2) this.track.set(x);
  }

  protected override onMove(x: number): void {
    if (this.beat === "prove" && !this.locked2) this.track.set(x);
  }

  // ---- Feel -------------------------------------------------------------

  private scale(v: number): number {
    return Math.sqrt(Math.max(v, 0.05) / 2.4);
  }

  private maxR(): number {
    return clamp((this.frame.h - 98) / 2, 16, 44);
  }

  private play(invest: boolean): void {
    this.mine = invest;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    this.note.set("");
    this.prompt.set(this.round === 0 ? "Watch what comes back." : "Again. Invest or keep.");
    this.youR.set(0);
    this.altR.set(0);
    this.sync();
  }

  private revealRound(): void {
    const n = FEEL_SCENES[this.round]!.n;
    const k = this.others[this.round]!.filter(Boolean).length;
    const got = this.good.payoff(n, this.mine!, k);
    const alt = this.good.payoff(n, !this.mine!, k);
    this.last = got;
    this.youR.set(this.scale(got));
    this.altR.set(this.scale(alt));
    this.revealed = true;
    this.note.set(`You ${this.mine ? "invested" : "kept"}. You got ${fmt(got)}. ${this.mine ? "Keeping" : "Investing"} would have paid ${fmt(alt)}.`);
    this.announce(`You got ${fmt(got)}. ${this.mine ? "Keeping" : "Investing"} would have paid ${fmt(alt)}.`);
    this.round++;
    this.locked = false;
    if (this.round >= FEEL_SCENES.length) this.prompt.set("Three groups. Did your best choice change?");
    else this.prompt.set(FEEL_SCENES[this.round]!.n === 2 ? "Now one other player. Invest or keep." : "Now four other players. Invest or keep.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.flat.snap(0).set(1);
    this.curve.snap(0);
    this.cross.snap(0);
    this.afterStep();
  }

  private afterStep(): void {
    if (this.seeStep === 0) {
      this.prompt.set("Keeping a coin returns exactly 1.");
      this.note.set("Tap to see what investing returns.");
    } else if (this.seeStep === 1) {
      this.curve.set(1);
      this.prompt.set("Investing returns 1.6 shared among everyone.");
      this.note.set("Your share of each coin is 1.6 over the players. Tap again.");
    } else {
      this.cross.set(1);
      this.prompt.set("Past 1.6 players, keeping beats investing.");
      this.note.set("More players dilute your return, so free riding wins.");
      this.announce("With more than 1.6 players, keeping pays more than investing.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.load();
  }

  private load(): void {
    const r = PROVE_R[this.pi]!;
    this.locked2 = false;
    this.track.value = 2;
    this.crowd.snap(2);
    this.show.snap(0);
    this.prompt.set("Find the biggest group where investing still pays.");
    this.note.set(`Each coin is multiplied by ${r} and shared by everyone.`);
    this.sync();
  }

  private lockIn(): void {
    const r = PROVE_R[this.pi]!;
    const g = new PublicGood(r);
    const n = this.track.value;
    const ok = n === g.maxPlayers();
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked2 = true;
      this.solved++;
      this.show.set(1);
      this.prompt.set("Right. One more player and keeping wins.");
      this.note.set(`At ${n}: ${fmt(g.returnPerCoin(n))} back per coin. At ${n + 1}: ${fmt(g.returnPerCoin(n + 1))}.`);
      this.wait = 2.2;
    } else {
      this.prompt.set(g.investPays(n) ? "Investing still pays there. Try a bigger group." : "Investing no longer pays there. Try a smaller group.");
      this.note.set(`At ${n} players one coin returns ${fmt(g.returnPerCoin(n))}. Keeping returns 1.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.flat.step(dt);
    this.curve.step(dt);
    this.cross.step(dt);
    this.show.step(dt);
    this.crowd.set(this.track.value);
    this.crowd.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7 && !this.revealed) this.revealRound();
    }
    if (this.beat === "prove" && this.locked2 && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= PROVE_R.length) {
          this.prompt.set("Investing pays only while the group is smaller than the multiplier.");
          this.note.set("The bigger the group, the stronger the pull to free ride.");
          this.finish();
        } else {
          this.pi++;
          this.load();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawChart(p, c, f);
    else this.drawProve(p, c, f);
  }

  private tokens(p: Painter, c: Colors, x0: number, x1: number, y: number, n: number, invested: boolean[] | null, alpha: number): void {
    const gap = Math.min(36, (x1 - x0) / Math.max(1, n));
    const start = this.cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const x = start + i * gap;
      if (i === 0) p.disc(x, y, 6, c.ink, alpha);
      else {
        p.ring(x, y, 8, c.ink, 1.5, alpha);
        if (invested && invested[i - 1]) p.disc(x, y, 3, c.ink, alpha);
      }
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    // The row always shows the group you are about to choose in, so the group size is known before you decide.
    const sc = FEEL_SCENES[Math.min(this.round, FEEL_SCENES.length - 1)]!;
    this.tokens(p, c, f.x, f.x + f.w, f.top + 14, sc.n, null, a);
    p.text(sc.label, this.cx, f.top + 44, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    const R = this.maxR();
    const cy = f.top + 58 + R;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.dashedRing(this.cx, cy, R * this.altR.value, c.ink, 0.8);
    p.disc(this.cx, cy, R * this.youR.value, c.ink, 0.95 * a * idle);
    p.text("You", this.cx, cy + R + 22, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed) p.text(fmt(this.last), this.cx, cy + R + 44, { font: Type.mono(12), color: c.ink, align: "center" });
    for (const i of [0, 1] as const) {
      const z = this.cells(2, i);
      const live = this.round < FEEL_SCENES.length && !this.locked;
      const chosen = this.locked && this.mine === (i === 0);
      const al = (live ? 1 : chosen ? 0.9 : this.round >= FEEL_SCENES.length ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedZone === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      const gy = z.y + z.h * 0.36;
      if (i === 0) p.arrow(gx, gy - 11, gx, gy + 11, c.ink, 1.5, al, 7);
      else p.ring(gx, gy, 10, c.ink, 1.5, al);
      p.text(i === 0 ? "Invest" : "Keep", gx, z.y + z.h * 0.8, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < FEEL_SCENES.length) this.ticks(p, c, FEEL_SCENES.length, this.round, this.round);
  }

  private chart(f: Frame): { x0: number; w: number; top: number; h: number; X: (n: number) => number; Y: (v: number) => number } {
    const x0 = f.x + 24;
    const w = f.w - 48;
    const top = f.top + 28;
    const h = Math.max(90, Math.min(210, f.h - 28 - 54));
    return { x0, w, top, h, X: (n) => x0 + ((n - 1) / (MAX_PLAYERS - 1)) * w, Y: (v) => top + h - (v / 1.8) * h };
  }

  private drawChart(p: Painter, c: Colors, f: Frame): void {
    const { x0, w, top, h, X, Y } = this.chart(f);
    const base = top + h;
    p.rule(x0, base, x0 + w, base, c.ink, 0.5);
    p.rule(x0, top, x0, base, c.ink, 0.5);
    p.text("back per coin", x0, top - 14, { font: Type.body(12, 400), color: c.fog });
    p.text("players", x0 + w, base + 40, { font: Type.body(12, 400), color: c.fog, align: "right" });
    for (let n = 1; n <= MAX_PLAYERS; n++) p.text(String(n), X(n), base + 18, { font: Type.mono(10), color: c.ash, align: "center" });
    const fl = this.flat.value;
    p.line(x0, Y(1), x0 + w, Y(1), c.ink, 1.5, 0.6 * fl);
    p.text("keep 1", x0 + w, Y(1) - 8, { font: Type.body(12, 400), color: c.fog, align: "right", alpha: fl });
    const cv = this.curve.value;
    if (cv > 0.01) {
      const pts: [number, number][] = [];
      const steps = 60;
      for (let i = 0; i <= steps * cv; i++) {
        const n = 1 + (i / steps) * (MAX_PLAYERS - 1);
        pts.push([X(n), Y(FEEL_R / n)]);
      }
      p.path(pts, c.ink, 2, 1);
      for (let n = 1; n <= MAX_PLAYERS; n++) if ((n - 1) / (MAX_PLAYERS - 1) <= cv) p.disc(X(n), Y(FEEL_R / n), 3.5, c.ink);
      p.text("invest", X(1) + 14, Y(FEEL_R) - 6, { font: Type.body(12, 400), color: c.ink, alpha: cv });
    }
    const cr = this.cross.value;
    if (cr > 0.01) {
      p.line(X(FEEL_R), Y(1), X(FEEL_R), base, c.ink, 1, 0.7 * cr, [3, 4]);
      p.ring(X(FEEL_R), Y(1), 8, c.ink, 1.5, cr);
      p.text(String(FEEL_R), X(FEEL_R) + 14, Y(1) - 8, { font: Type.mono(11), color: c.ink, alpha: cr });
    }
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const t = this.track;
    const n = this.crowd.value;
    this.tokens(p, c, f.x, f.x + f.w, f.top + 16, Math.max(1, Math.round(n)), null, 1);
    t.ruler(p, c, [1, 2, 3, 4, 5, 6, 7, 8], (v) => String(v));
    p.text(String(t.value), t.xOf(t.value), t.y - 24, { font: Type.mono(12), color: c.ink, align: "center" });
    const s = this.show.value;
    if (s > 0.01) p.ring(t.xOf(t.value), t.y, 12.5, c.ink, 1.5, s);
    t.marker(p, c, t.value, 9);
    this.ticks(p, c, PROVE_R.length, this.solved, this.pi);
  }
}
